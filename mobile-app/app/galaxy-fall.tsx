import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  LayoutChangeEvent,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  Vibration,
  View,
} from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { claimMiniResetReward } from "../lib/backend-api";
import { getGameScore, saveGameScore } from "../lib/game-scores";

const ASSETS = {
  bg: require("../assets/images/Mini Reset/Galaxy Fall/bg.png"),
  cover: require("../assets/images/Mini Reset/Galaxy Fall/cover.webp"),
  meteor: require("../assets/images/Mini Reset/Galaxy Fall/meteor.svg"),
  rocket: require("../assets/images/Mini Reset/Galaxy Fall/rocket.svg"),
  muni: require("../assets/images/MUNI_default.png"),
  coin: require("../assets/images/Tala_Star.png"),
};

type GameState = "START" | "PLAYING" | "PAUSED" | "GAMEOVER";

type FallingItem = {
  id: string;
  type: "coin" | "meteor" | "rocket" | "shield";
  x: number;
  y: number;
  width: number;
  height: number;
  speed: number;
  rotation: number;
  rotationSpeed: number;
  collected?: boolean;
};

type StarParticle = {
  id: number;
  x: number;
  y: number;
  size: number;
  speed: number;
  opacity: number;
};

type ScorePopup = {
  id: string;
  text: string;
  x: number;
  y: number;
  color: string;
};

const GAME_DURATION = 60; // 60 seconds flight
const MUNI_SIZE = 72;
const MUNI_BOTTOM_OFFSET = 120;
const COIN_SIZE = 36;
const METEOR_SIZE = 54;
const ROCKET_SIZE = 60;
const INITIAL_LIVES = 3;
const SURVIVAL_BONUS = 10;
const NO_LIFE_LOST_BONUS = 5;

export default function GalaxyFallScreen() {
  const { width: screenW, height: screenH } = useWindowDimensions();
  const appWidth = Math.min(screenW, 430);

  const [gameState, setGameState] = useState<GameState>("START");
  const [coins, setCoins] = useState(0);
  const [lives, setLives] = useState(INITIAL_LIVES);
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [isVictory, setIsVictory] = useState(false);
  const [rewardTala, setRewardTala] = useState(0);
  const [bonusBreakdown, setBonusBreakdown] = useState({ coins: 0, survival: 0, flawless: 0, total: 0 });

  const [popups, setPopups] = useState<ScorePopup[]>([]);
  const [gameSize, setGameSize] = useState({ width: appWidth, height: screenH });

  const bestScoreRef = useRef(0);
  const bestCoinsRef = useRef(0);
  const [, forceUpdate] = useState(0);

  // Animation & Physics Refs
  const muniX = useRef(appWidth / 2);
  const targetMuniX = useRef(appWidth / 2);
  const dragStartX = useRef(appWidth / 2);
  const touchStartX = useRef(0);
  const muniTilt = useRef(0);

  const itemsRef = useRef<FallingItem[]>([]);
  const particlesRef = useRef<StarParticle[]>([]);
  const frameCount = useRef(0);
  const lastTimeRef = useRef(0);
  const animFrameRef = useRef<number | null>(null);

  const isInvulnerable = useRef(false);
  const invulnerableTimer = useRef(0);
  const rewardClaimedRef = useRef(false);

  const shakeAnim = useRef(new Animated.Value(0)).current;
  const muniOpacityAnim = useRef(new Animated.Value(1)).current;

  // Load High Scores
  useEffect(() => {
    getGameScore("galaxy-fall").then((data) => {
      if (data?.bestScore) bestScoreRef.current = data.bestScore;
      if (data?.bestCoins) bestCoinsRef.current = data.bestCoins;
      forceUpdate((p) => p + 1);
    });
  }, []);

  // Initialize Starfield Particles
  const initParticles = (width: number, height: number) => {
    const list: StarParticle[] = [];
    for (let i = 0; i < 28; i++) {
      list.push({
        id: i,
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() * 2.5 + 1,
        speed: Math.random() * 2.2 + 0.8,
        opacity: Math.random() * 0.7 + 0.3,
      });
    }
    particlesRef.current = list;
  };

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width > 0 && height > 0) {
      setGameSize({ width, height });
      if (particlesRef.current.length === 0) {
        initParticles(width, height);
      }
      if (muniX.current === 0 || muniX.current === appWidth / 2) {
        const centered = width / 2;
        muniX.current = centered;
        targetMuniX.current = centered;
      }
    }
  };

  // Fluid Pan Responder for Swiping / Dragging Muni
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        dragStartX.current = targetMuniX.current;
        touchStartX.current = evt.nativeEvent.pageX;
      },
      onPanResponderMove: (evt, gestureState) => {
        if (gameState !== "PLAYING") return;
        let newX = dragStartX.current + gestureState.dx * 1.05;
        const halfMuni = MUNI_SIZE / 2;
        const minX = halfMuni + 6;
        const maxX = gameSize.width - halfMuni - 6;
        newX = Math.max(minX, Math.min(maxX, newX));
        targetMuniX.current = newX;
      },
    })
  ).current;

  // Gentle Shake Animation on Collision
  const triggerShake = () => {
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 8, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -6, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 40, useNativeDriver: true }),
    ]).start();
  };

  // Flashing Effect During Invulnerability
  const triggerInvulnerability = () => {
    isInvulnerable.current = true;
    invulnerableTimer.current = 90; // ~1.5s at 60fps
    Animated.loop(
      Animated.sequence([
        Animated.timing(muniOpacityAnim, { toValue: 0.35, duration: 110, useNativeDriver: true }),
        Animated.timing(muniOpacityAnim, { toValue: 1, duration: 110, useNativeDriver: true }),
      ]),
      { iterations: 6 }
    ).start(() => {
      isInvulnerable.current = false;
      muniOpacityAnim.setValue(1);
    });
  };

  const startGame = () => {
    setGameState("PLAYING");
    setCoins(0);
    setLives(INITIAL_LIVES);
    setTimeLeft(GAME_DURATION);
    setIsVictory(false);
    setRewardTala(0);
    setPopups([]);
    rewardClaimedRef.current = false;
    itemsRef.current = [];
    isInvulnerable.current = false;
    invulnerableTimer.current = 0;
    muniOpacityAnim.setValue(1);

    const centered = gameSize.width / 2;
    muniX.current = centered;
    targetMuniX.current = centered;
    muniTilt.current = 0;
    frameCount.current = 0;
    lastTimeRef.current = performance.now();
  };

  const pauseGame = () => {
    if (gameState === "PLAYING") {
      setGameState("PAUSED");
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    }
  };

  const resumeGame = () => {
    if (gameState === "PAUSED") {
      setGameState("PLAYING");
      lastTimeRef.current = performance.now();
    }
  };

  const restartGame = () => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    startGame();
  };

  const quitGame = () => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    router.replace("/wellness-tools");
  };

  const finishGame = (survived: boolean, finalCoins: number, finalLives: number) => {
    setGameState("GAMEOVER");
    setIsVictory(survived);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);

    const survivalPts = survived ? SURVIVAL_BONUS : 0;
    const flawlessPts = survived && finalLives === INITIAL_LIVES ? NO_LIFE_LOST_BONUS : 0;
    const totalEarned = finalCoins + survivalPts + flawlessPts;

    setBonusBreakdown({
      coins: finalCoins,
      survival: survivalPts,
      flawless: flawlessPts,
      total: totalEarned,
    });

    if (!rewardClaimedRef.current) {
      rewardClaimedRef.current = true;
      claimMiniResetReward({
        activityId: "galaxy-fall",
        level: 1,
        roundKey: `galaxy-fall-${Date.now()}`,
        score: totalEarned,
      })
        .then((reward) => setRewardTala(reward.rewardTala ?? 0))
        .catch(() => undefined);
    }

    if (totalEarned > bestScoreRef.current) bestScoreRef.current = totalEarned;
    if (finalCoins > bestCoinsRef.current) bestCoinsRef.current = finalCoins;
    saveGameScore("galaxy-fall", {
      bestScore: bestScoreRef.current,
      bestCoins: bestCoinsRef.current,
    });
  };

  // Main Game Animation Loop
  const gameLoop = (time: number) => {
    if (gameState !== "PLAYING") return;

    if (!lastTimeRef.current) lastTimeRef.current = time;
    const dt = Math.min(time - lastTimeRef.current, 50); // cap large frame drops
    lastTimeRef.current = time;

    frameCount.current++;

    // 1. Countdown Timer (exact 1-second cadence)
    if (frameCount.current % 60 === 0) {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          finishGame(true, coins, lives);
          return 0;
        }
        return prev - 1;
      });
    }

    // 2. Muni Smooth Horizontal Interpolation & Dynamic Tilt
    const dx = targetMuniX.current - muniX.current;
    muniX.current += dx * 0.14;
    muniTilt.current = Math.max(-18, Math.min(18, dx * 0.35));

    // 3. Upward Star Particles (giving descending feeling)
    particlesRef.current.forEach((p) => {
      p.y -= p.speed;
      if (p.y < -10) {
        p.y = gameSize.height + 10;
        p.x = Math.random() * gameSize.width;
      }
    });

    // 4. Invulnerability Timer
    if (invulnerableTimer.current > 0) {
      invulnerableTimer.current--;
      if (invulnerableTimer.current <= 0) {
        isInvulnerable.current = false;
      }
    }

    // 5. Spawning Items (Coins, Meteors, Rockets)
    // Relaxed, rhythmic interval so it feels floaty and peaceful
    if (frameCount.current % 50 === 0) {
      const rand = Math.random();
      const halfW = 30;
      const spawnX = Math.random() * (gameSize.width - halfW * 2) + halfW;

      let itemType: "coin" | "meteor" | "rocket" | "shield" = "coin";
      let itemSize = COIN_SIZE;
      let speed = 2.4 + Math.random() * 0.8;

      if (rand < 0.55) {
        // Tala Coin
        itemType = "coin";
        itemSize = COIN_SIZE;
        speed = 2.2 + Math.random() * 0.6;
      } else if (rand < 0.82) {
        // Meteor
        itemType = "meteor";
        itemSize = METEOR_SIZE;
        speed = 2.8 + Math.random() * 1.0;
      } else if (rand < 0.96) {
        // Rocketship
        itemType = "rocket";
        itemSize = ROCKET_SIZE;
        speed = 3.6 + Math.random() * 1.2;
      } else {
        // Gentle Cosmic Shield (rare bonus)
        itemType = "shield";
        itemSize = COIN_SIZE + 4;
        speed = 2.0;
      }

      itemsRef.current.push({
        id: `item_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        type: itemType,
        x: spawnX,
        y: -itemSize,
        width: itemSize,
        height: itemSize,
        speed,
        rotation: 0,
        rotationSpeed: itemType === "meteor" ? (Math.random() - 0.5) * 3 : 0,
      });
    }

    // 6. Move Items & Check Hitboxes
    const muniY = gameSize.height - MUNI_BOTTOM_OFFSET - MUNI_SIZE / 2;
    const muniHitbox = {
      x: muniX.current - MUNI_SIZE * 0.32,
      y: muniY - MUNI_SIZE * 0.32,
      w: MUNI_SIZE * 0.64,
      h: MUNI_SIZE * 0.64,
    };

    let updatedCoins = coins;
    let updatedLives = lives;

    for (let i = itemsRef.current.length - 1; i >= 0; i--) {
      const item = itemsRef.current[i];
      if (item.collected) continue;

      item.y += item.speed;
      item.rotation += item.rotationSpeed;

      // Item off screen bottom
      if (item.y > gameSize.height + 40) {
        itemsRef.current.splice(i, 1);
        continue;
      }

      // Hitbox Collision Check
      const itemHitbox = {
        x: item.x - item.width * 0.38,
        y: item.y - item.height * 0.38,
        w: item.width * 0.76,
        h: item.height * 0.76,
      };

      const isColliding =
        muniHitbox.x < itemHitbox.x + itemHitbox.w &&
        muniHitbox.x + muniHitbox.w > itemHitbox.x &&
        muniHitbox.y < itemHitbox.y + itemHitbox.h &&
        muniHitbox.y + muniHitbox.h > itemHitbox.y;

      if (isColliding) {
        item.collected = true;

        if (item.type === "coin") {
          updatedCoins += 1;
          setCoins(updatedCoins);
          setPopups((prev) => [
            ...prev,
            { id: Math.random().toString(), text: "+1 Tala", x: item.x, y: item.y - 10, color: "#F5C447" },
          ]);
        } else if (item.type === "shield") {
          // Restore 1 life if below max, or grant invulnerability
          if (updatedLives < INITIAL_LIVES) {
            updatedLives += 1;
            setLives(updatedLives);
            setPopups((prev) => [
              ...prev,
              { id: Math.random().toString(), text: "+1 Star Heart", x: item.x, y: item.y - 10, color: "#6C5CE7" },
            ]);
          }
          triggerInvulnerability();
        } else if (item.type === "meteor" || item.type === "rocket") {
          if (!isInvulnerable.current) {
            updatedLives -= 1;
            setLives(updatedLives);
            triggerShake();
            triggerInvulnerability();
            Vibration.vibrate(100);

            setPopups((prev) => [
              ...prev,
              { id: Math.random().toString(), text: "-1", x: item.x, y: item.y - 10, color: "#E76F51" },
            ]);

            if (updatedLives <= 0) {
              itemsRef.current.splice(i, 1);
              finishGame(false, updatedCoins, 0);
              return;
            }
          }
        }
        itemsRef.current.splice(i, 1);
      }
    }

    forceUpdate((p) => p + 1);
    animFrameRef.current = requestAnimationFrame(gameLoop);
  };

  useEffect(() => {
    if (gameState === "PLAYING") {
      lastTimeRef.current = performance.now();
      animFrameRef.current = requestAnimationFrame(gameLoop);
    }
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [gameState, coins, lives, timeLeft]);

  // Clean Up Popups after brief display
  useEffect(() => {
    if (popups.length > 0) {
      const t = setTimeout(() => {
        setPopups((prev) => prev.slice(1));
      }, 750);
      return () => clearTimeout(t);
    }
  }, [popups]);

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return mins > 0 ? `${mins}m ${rem < 10 ? "0" : ""}${rem}s` : `${rem}s`;
  };

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      {/* Background Graphic */}
      <Image source={ASSETS.bg} style={StyleSheet.absoluteFillObject} contentFit="cover" />

      {/* Top Header Bar */}
      <View style={styles.topBar}>
        <Pressable
          onPress={() => {
            if (gameState === "PLAYING") pauseGame();
            else quitGame();
          }}
          style={styles.backButton}
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={26} color="#FFFFFF" />
        </Pressable>
        <Text style={styles.topTitle}>Galaxy Fall</Text>
        {gameState === "PLAYING" ? (
          <Pressable onPress={pauseGame} style={styles.pauseButton} accessibilityLabel="Pause Flight">
            <Ionicons name="pause-circle-outline" size={26} color="#FFFFFF" />
          </Pressable>
        ) : (
          <View style={styles.pausePlaceholder} />
        )}
      </View>

      <View style={[styles.contentFrame, { width: appWidth }]} onLayout={handleLayout}>
        {/* START SCREEN */}
        {gameState === "START" && (
          <View style={styles.centerContainer}>
            <Image source={ASSETS.cover} style={styles.coverImage} contentFit="contain" />
            <Text style={styles.overlayTitle}>Galaxy Fall</Text>
            <Text style={styles.overlaySub}>
              Float through the cosmos with Muni. Gather Tala Coins while gently weaving past meteors and rockets.
            </Text>

            <View style={styles.recordsPill}>
              <View style={styles.recordItem}>
                <Text style={styles.recordLabel}>Best Score</Text>
                <Text style={styles.recordValue}>{bestScoreRef.current}</Text>
              </View>
              <View style={styles.recordDivider} />
              <View style={styles.recordItem}>
                <Text style={styles.recordLabel}>Best Coins</Text>
                <Text style={styles.recordValue}>{bestCoinsRef.current}</Text>
              </View>
            </View>

            <Pressable style={styles.btnPrimary} onPress={startGame}>
              <Ionicons name="planet-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.btnPrimaryText}>Start Flight</Text>
            </Pressable>
          </View>
        )}

        {/* PLAYING / PAUSED HUD & CANVAS */}
        {(gameState === "PLAYING" || gameState === "PAUSED") && (
          <View style={styles.gameWrapper} {...panResponder.panHandlers}>
            {/* Top HUD */}
            <View style={styles.hud}>
              <View style={styles.hudRow}>
                {/* Coins */}
                <View style={styles.hudItem}>
                  <Image source={ASSETS.coin} style={styles.hudCoinIcon} contentFit="contain" />
                  <Text style={styles.hudValue}>{coins}</Text>
                </View>

                {/* Star Lives */}
                <View style={styles.livesRow}>
                  {Array.from({ length: INITIAL_LIVES }).map((_, idx) => (
                    <Ionicons
                      key={idx}
                      name={idx < lives ? "star" : "star-outline"}
                      size={20}
                      color={idx < lives ? "#F5C447" : "rgba(255,255,255,0.3)"}
                      style={{ marginHorizontal: 2 }}
                    />
                  ))}
                </View>

                {/* Score */}
                <View style={styles.hudItem}>
                  <Text style={styles.hudLabel}>SCORE</Text>
                  <Text style={styles.hudValue}>{coins}</Text>
                </View>
              </View>

              {/* Relaxing Bar Timer */}
              <View style={styles.timeBarContainer}>
                <View
                  style={[
                    styles.timeBarFill,
                    {
                      width: `${Math.min(Math.max((timeLeft / GAME_DURATION) * 100, 0), 100)}%`,
                      backgroundColor: timeLeft <= 10 ? "#E9A844" : "#4A90E2",
                    },
                  ]}
                />
                <Text style={styles.timeText}>⏱️ {formatTime(timeLeft)}</Text>
              </View>
            </View>

            {/* Interactive Flight Canvas */}
            <Animated.View style={[styles.canvasArea, { transform: [{ translateX: shakeAnim }] }]}>
              {/* Upward Star Particles */}
              {particlesRef.current.map((p) => (
                <View
                  key={p.id}
                  style={[
                    styles.starParticle,
                    {
                      left: p.x,
                      top: p.y,
                      width: p.size,
                      height: p.size,
                      borderRadius: p.size / 2,
                      opacity: p.opacity,
                    },
                  ]}
                />
              ))}

              {/* Falling Coins, Meteors, Rockets */}
              {itemsRef.current.map((item) => (
                <View
                  key={item.id}
                  style={[
                    styles.itemWrapper,
                    {
                      left: item.x - item.width / 2,
                      top: item.y - item.height / 2,
                      width: item.width,
                      height: item.height,
                      transform: [{ rotate: `${item.rotation}deg` }],
                    },
                  ]}
                >
                  {item.type === "coin" && (
                    <Image source={ASSETS.coin} style={styles.coinImage} contentFit="contain" />
                  )}
                  {item.type === "meteor" && (
                    <Image source={ASSETS.meteor} style={styles.meteorImage} contentFit="contain" />
                  )}
                  {item.type === "rocket" && (
                    <Image source={ASSETS.rocket} style={styles.rocketImage} contentFit="contain" />
                  )}
                  {item.type === "shield" && (
                    <View style={styles.shieldBubble}>
                      <Ionicons name="shield-checkmark" size={24} color="#00CEC9" />
                    </View>
                  )}
                </View>
              ))}

              {/* Float Popups (+1 Tala, etc.) */}
              {popups.map((pop) => (
                <Text
                  key={pop.id}
                  style={[
                    styles.scorePopupText,
                    { left: pop.x - 30, top: pop.y, color: pop.color },
                  ]}
                >
                  {pop.text}
                </Text>
              ))}

              {/* Muni Character */}
              <Animated.View
                style={[
                  styles.muniContainer,
                  {
                    left: muniX.current - MUNI_SIZE / 2,
                    bottom: MUNI_BOTTOM_OFFSET,
                    opacity: muniOpacityAnim,
                    transform: [{ rotate: `${muniTilt.current}deg` }],
                  },
                ]}
              >
                {/* Gentle Starlight Aura */}
                <View style={styles.muniGlow} />
                <Image source={ASSETS.muni} style={styles.muniSprite} contentFit="contain" />
              </Animated.View>
            </Animated.View>

            {/* Bottom Gentle Swipe Hint */}
            <View style={styles.bottomControlHint}>
              <Ionicons name="swap-horizontal" size={16} color="rgba(255,255,255,0.6)" />
              <Text style={styles.bottomControlHintText}>Drag left or right to glide</Text>
            </View>
          </View>
        )}

        {/* GAMEOVER / VICTORY OVERLAY */}
        {gameState === "GAMEOVER" && (
          <View style={styles.centerContainer}>
            <View style={styles.gameOverCard}>
              <View style={[styles.victoryIconWrap, !isVictory && styles.fallenIconWrap]}>
                <Ionicons
                  name={isVictory ? "sparkles" : "planet-outline"}
                  size={36}
                  color={isVictory ? "#F5C447" : "#4A90E2"}
                />
              </View>

              <Text style={styles.goTitle}>{isVictory ? "Cosmic Arrival!" : "Gentle Landing"}</Text>
              <Text style={styles.goSub}>
                {isVictory
                  ? "You navigated the cosmos with peace and poise."
                  : "Muni rested safely on an asteroid."}
              </Text>

              {/* Rewards Breakdown */}
              <View style={styles.statsBox}>
                <View style={styles.statRow}>
                  <Text style={styles.statLabel}>Tala Coins Collected</Text>
                  <Text style={styles.statValue}>+{bonusBreakdown.coins}</Text>
                </View>
                {isVictory && (
                  <View style={styles.statRow}>
                    <Text style={styles.statLabel}>60s Survival Bonus</Text>
                    <Text style={[styles.statValue, { color: "#4F8A38" }]}>+{bonusBreakdown.survival}</Text>
                  </View>
                )}
                {isVictory && bonusBreakdown.flawless > 0 && (
                  <View style={styles.statRow}>
                    <Text style={styles.statLabel}>Flawless Flight Bonus (No Lives Lost)</Text>
                    <Text style={[styles.statValue, { color: "#4F8A38" }]}>+{bonusBreakdown.flawless}</Text>
                  </View>
                )}
                <View style={styles.statDivider} />
                <View style={styles.statRow}>
                  <Text style={[styles.statLabel, styles.statLabelBold]}>Total Tala Earned</Text>
                  <Text style={[styles.statValue, styles.statValueBold]}>{bonusBreakdown.total}</Text>
                </View>
              </View>

              <Pressable style={styles.btnPrimary} onPress={startGame}>
                <Ionicons name="refresh" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.btnPrimaryText}>Drift Again</Text>
              </Pressable>
              <Pressable style={styles.btnSecondary} onPress={quitGame}>
                <Text style={styles.btnSecondaryText}>Exit to Tools</Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>

      {/* PAUSE MODAL */}
      {gameState === "PAUSED" && (
        <View style={styles.pauseOverlay}>
          <View style={styles.pauseCard}>
            <View style={styles.pauseIconCircle}>
              <Ionicons name="pause" size={28} color="#4A90E2" />
            </View>
            <Text style={styles.pauseTitle}>Flight Paused</Text>
            <Text style={styles.pauseSub}>Take a gentle breath, Muni is floating with you.</Text>

            <Pressable style={styles.pauseBtnResume} onPress={resumeGame}>
              <Ionicons name="play" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.pauseBtnResumeText}>Resume</Text>
            </Pressable>

            <Pressable style={styles.pauseBtnRestart} onPress={restartGame}>
              <Ionicons name="refresh" size={18} color="#33475C" style={{ marginRight: 8 }} />
              <Text style={styles.pauseBtnRestartText}>Restart Flight</Text>
            </Pressable>

            <Pressable style={styles.pauseBtnQuit} onPress={quitGame}>
              <Ionicons name="exit-outline" size={18} color="#C45C5C" style={{ marginRight: 8 }} />
              <Text style={styles.pauseBtnQuitText}>Quit Game</Text>
            </Pressable>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0B1021" },
  contentFrame: { flex: 1, alignSelf: "center", position: "relative" },
  topBar: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    backgroundColor: "rgba(11, 16, 33, 0.85)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.1)",
    zIndex: 20,
  },
  topTitle: { color: "#FFFFFF", fontSize: 18, fontFamily: "Outfit-Bold" },
  backButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  pauseButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  pausePlaceholder: { width: 40, height: 40 },

  centerContainer: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  coverImage: { width: 140, height: 140, borderRadius: 24, marginBottom: 16 },
  overlayTitle: { fontSize: 30, fontFamily: "Outfit-Bold", color: "#FFFFFF", marginBottom: 8 },
  overlaySub: {
    fontSize: 14,
    color: "#D0D8E8",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
    paddingHorizontal: 10,
  },

  recordsPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    paddingVertical: 10,
    paddingHorizontal: 22,
    borderRadius: 18,
    marginBottom: 26,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
  },
  recordItem: { alignItems: "center", minWidth: 80 },
  recordLabel: { color: "rgba(255, 255, 255, 0.6)", fontSize: 11, fontFamily: "Outfit-Medium" },
  recordValue: { color: "#F5C447", fontSize: 17, fontFamily: "Outfit-Bold", marginTop: 2 },
  recordDivider: { width: 1, height: 24, backgroundColor: "rgba(255, 255, 255, 0.2)", marginHorizontal: 16 },

  gameWrapper: { flex: 1, position: "relative" },

  hud: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "rgba(11, 16, 33, 0.6)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.08)",
    zIndex: 15,
  },
  hudRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  hudItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  hudCoinIcon: { width: 22, height: 22 },
  hudLabel: { color: "rgba(255, 255, 255, 0.6)", fontSize: 11, fontFamily: "Outfit-Bold" },
  hudValue: { color: "#FFFFFF", fontSize: 16, fontFamily: "Outfit-Bold" },
  livesRow: { flexDirection: "row", alignItems: "center" },

  timeBarContainer: {
    height: 18,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderRadius: 9,
    overflow: "hidden",
    position: "relative",
    justifyContent: "center",
  },
  timeBarFill: { height: "100%", borderRadius: 9 },
  timeText: {
    position: "absolute",
    width: "100%",
    textAlign: "center",
    fontSize: 11,
    color: "#FFFFFF",
    fontFamily: "Outfit-Bold",
    textShadowColor: "rgba(0,0,0,0.4)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },

  canvasArea: { flex: 1, position: "relative", overflow: "hidden" },
  starParticle: { position: "absolute", backgroundColor: "#FFFFFF" },

  itemWrapper: { position: "absolute", alignItems: "center", justifyContent: "center" },
  coinImage: { width: "100%", height: "100%" },
  meteorImage: { width: "100%", height: "100%" },
  rocketImage: { width: "100%", height: "100%" },
  shieldBubble: {
    width: "100%",
    height: "100%",
    borderRadius: 20,
    backgroundColor: "rgba(0, 206, 201, 0.25)",
    borderWidth: 1.5,
    borderColor: "#00CEC9",
    alignItems: "center",
    justifyContent: "center",
  },

  scorePopupText: {
    position: "absolute",
    fontSize: 14,
    fontFamily: "Outfit-Bold",
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  muniContainer: {
    position: "absolute",
    width: MUNI_SIZE,
    height: MUNI_SIZE,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  muniGlow: {
    position: "absolute",
    width: MUNI_SIZE + 16,
    height: MUNI_SIZE + 16,
    borderRadius: (MUNI_SIZE + 16) / 2,
    backgroundColor: "rgba(108, 92, 231, 0.25)",
  },
  muniSprite: { width: "100%", height: "100%" },

  bottomControlHint: {
    position: "absolute",
    bottom: 24,
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  bottomControlHintText: {
    color: "rgba(255, 255, 255, 0.55)",
    fontSize: 13,
    fontFamily: "Outfit-Medium",
  },

  gameOverCard: {
    width: "100%",
    maxWidth: 330,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 12,
  },
  victoryIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#FEF7E6",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  fallenIconWrap: { backgroundColor: "#EDF5FD" },
  goTitle: { fontSize: 24, fontFamily: "Outfit-Bold", color: "#1D2D44", marginBottom: 6 },
  goSub: { fontSize: 14, color: "#607181", textAlign: "center", marginBottom: 20 },

  statsBox: {
    width: "100%",
    backgroundColor: "#F4F8F9",
    borderRadius: 16,
    padding: 14,
    marginBottom: 20,
    rowGap: 10,
  },
  statRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  statLabel: { fontSize: 13, color: "#546A7B" },
  statLabelBold: { fontFamily: "Outfit-Bold", color: "#1D2D44" },
  statValue: { fontSize: 15, fontFamily: "Outfit-Bold", color: "#1D2D44" },
  statValueBold: { fontSize: 18, color: "#4A90E2" },
  statDivider: { height: 1, backgroundColor: "#E0E7DD", marginVertical: 4 },

  btnPrimary: {
    width: "100%",
    maxWidth: 290,
    backgroundColor: "#4A90E2",
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#4A90E2",
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  btnPrimaryText: { color: "#FFFFFF", fontSize: 15, fontFamily: "Outfit-Bold" },
  btnSecondary: { width: "100%", paddingVertical: 12, alignItems: "center" },
  btnSecondaryText: { color: "#546A7B", fontSize: 14, fontFamily: "Outfit-SemiBold" },

  pauseOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(11, 16, 33, 0.7)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10000,
    padding: 20,
  },
  pauseCard: {
    width: "100%",
    maxWidth: 320,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  pauseIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#EDF5FD",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  pauseTitle: { fontSize: 22, fontFamily: "Outfit-Bold", color: "#1D2D44", marginBottom: 6 },
  pauseSub: { fontSize: 14, color: "#607181", textAlign: "center", marginBottom: 22, lineHeight: 19 },
  pauseBtnResume: {
    width: "100%",
    flexDirection: "row",
    backgroundColor: "#4A90E2",
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  pauseBtnResumeText: { color: "#FFFFFF", fontSize: 15, fontFamily: "Outfit-Bold" },
  pauseBtnRestart: {
    width: "100%",
    flexDirection: "row",
    backgroundColor: "#F0F4F8",
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  pauseBtnRestartText: { color: "#33475C", fontSize: 15, fontFamily: "Outfit-Bold" },
  pauseBtnQuit: {
    width: "100%",
    flexDirection: "row",
    paddingVertical: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  pauseBtnQuitText: { color: "#C45C5C", fontSize: 14, fontFamily: "Outfit-SemiBold" },
});
