import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
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
const MUNI_TOP_OFFSET = MUNI_SIZE / 2 + 8;
const COIN_SIZE = 36;
const METEOR_SIZE = 54;
const ROCKET_SIZE = 60;
const INITIAL_LIVES = 3;
const SURVIVAL_BONUS = 10;
const NO_LIFE_LOST_BONUS = 5;

function triggerHaptic(style = Haptics.ImpactFeedbackStyle.Light) {
  try {
    void Haptics.impactAsync(style);
  } catch {}
}

export default function GalaxyFallScreen() {
  const { width: screenW, height: screenH } = useWindowDimensions();
  const appWidth = Math.min(screenW, 430);

  const [gameState, setGameState] = useState<GameState>("START");
  const [coins, setCoins] = useState(0);
  const [lives, setLives] = useState(INITIAL_LIVES);
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [isVictory, setIsVictory] = useState(false);
  const [rewardTala, setRewardTala] = useState(0);
  const [showExitPrompt, setShowExitPrompt] = useState(false);
  const [bonusBreakdown, setBonusBreakdown] = useState({ coins: 0, survival: 0, flawless: 0, total: 0 });
  const gameStateRef = useRef(gameState);
  gameStateRef.current = gameState;

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
      onStartShouldSetPanResponder: () => gameStateRef.current === "PLAYING",
      onMoveShouldSetPanResponder: () => gameStateRef.current === "PLAYING",
      onPanResponderGrant: (evt) => {
        dragStartX.current = targetMuniX.current;
        touchStartX.current = evt.nativeEvent.pageX;
      },
      onPanResponderMove: (evt, gestureState) => {
        if (gameStateRef.current !== "PLAYING") return;
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

    // Keep Muni near the top while the world moves upward to create the falling illusion.
    const dx = targetMuniX.current - muniX.current;
    muniX.current += dx * 0.14;
    muniTilt.current = Math.max(-18, Math.min(18, dx * 0.35));

    particlesRef.current.forEach((particle) => {
      particle.y -= particle.speed * (dt / 16.67);
      if (particle.y < -10) {
        particle.y = gameSize.height + 10;
        particle.x = Math.random() * gameSize.width;
      }
    });

    // Invulnerability Timer
    if (invulnerableTimer.current > 0) {
      invulnerableTimer.current--;
      if (invulnerableTimer.current <= 0) {
        isInvulnerable.current = false;
      }
    }

    // Spawn items below the canvas; moving them upward makes Muni appear to fall.
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
        y: gameSize.height + itemSize / 2,
        width: itemSize,
        height: itemSize,
        speed,
        rotation: 0,
        rotationSpeed: itemType === "meteor" ? (Math.random() - 0.5) * 3 : 0,
      });
    }

    const muniY = MUNI_TOP_OFFSET;
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

      item.y -= item.speed * (dt / 16.67);

      if (item.y + item.height / 2 < muniY - MUNI_SIZE / 2) {
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

  const handleHeaderBack = () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
    if (gameState === "PLAYING") {
      setGameState("PAUSED");
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      setShowExitPrompt(true);
      return;
    }
    router.replace("/wellness-tools");
  };

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      {/* Background Graphic */}
      <Image source={ASSETS.bg} style={StyleSheet.absoluteFillObject} contentFit="cover" cachePolicy="memory-disk" priority="high" />

      {/* Apple-style Top Bar */}
      <View style={styles.topBar}>
        <Pressable
          onPress={handleHeaderBack}
          style={styles.circleButton}
          accessibilityLabel="Back"
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={20} color="#FFFFFF" />
        </Pressable>

        <View style={styles.titlePill}>
          <Text style={styles.topTitle}>Galaxy Fall</Text>
        </View>

        {gameState === "PLAYING" ? (
          <Pressable
            onPress={pauseGame}
            style={styles.circleButton}
            accessibilityLabel="Pause Flight"
            hitSlop={8}
          >
            <Ionicons name="pause" size={17} color="#FFFFFF" />
          </Pressable>
        ) : (
          <View style={styles.buttonSpacer} />
        )}
      </View>

      <View style={[styles.contentFrame, { width: appWidth }]} onLayout={handleLayout}>
        {/* START SCREEN */}
        {gameState === "START" && (
          <View style={styles.centerContainer}>
            <View style={styles.startCard}>
              <View style={styles.coverWrap}>
                <Image source={ASSETS.cover} style={styles.coverImage} contentFit="contain" cachePolicy="memory-disk" />
              </View>
              <Text style={styles.modalTitle}>Galaxy Fall</Text>
              <Text style={styles.modalDesc}>
                Float through the cosmos with Muni. Gather Tala Coins while gently weaving past meteors and rockets.
              </Text>

              <View style={styles.recordsBox}>
                <View style={styles.recordCol}>
                  <Text style={styles.recordColLabel}>BEST SCORE</Text>
                  <Text style={styles.recordColValue}>{bestScoreRef.current}</Text>
                </View>
                <View style={styles.recordDivider} />
                <View style={styles.recordCol}>
                  <Text style={styles.recordColLabel}>BEST COINS</Text>
                  <Text style={styles.recordColValue}>{bestCoinsRef.current}</Text>
                </View>
              </View>

              <Pressable style={styles.primaryPill} onPress={startGame}>
                <Ionicons name="planet-outline" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.primaryPillText}>Start Flight</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* PLAYING / PAUSED HUD & CANVAS */}
        {(gameState === "PLAYING" || gameState === "PAUSED") && (
          <View style={styles.gameWrapper} {...panResponder.panHandlers}>
            {/* Apple Floating Dark Glass HUD */}
            <View style={styles.hudCard}>
              <View style={styles.hudTopRow}>
                {/* Coins */}
                <View style={styles.hudCoinBadge}>
                  <Image source={ASSETS.coin} style={styles.hudCoinIcon} contentFit="contain" cachePolicy="memory-disk" />
                  <Text style={styles.hudCoinValue}>+{coins}</Text>
                </View>

                {/* Star Lives */}
                <View style={styles.livesRow}>
                  {Array.from({ length: INITIAL_LIVES }).map((_, idx) => (
                    <Ionicons
                      key={idx}
                      name={idx < lives ? "star" : "star-outline"}
                      size={18}
                      color={idx < lives ? "#F5C447" : "rgba(255,255,255,0.25)"}
                      style={{ marginHorizontal: 2 }}
                    />
                  ))}
                </View>

                {/* Score */}
                <View style={styles.hudStatGroup}>
                  <Text style={styles.hudStatLabel}>SCORE</Text>
                  <Text style={styles.hudStatValue}>{coins}</Text>
                </View>
              </View>

              {/* Time Track */}
              <View style={styles.timeTrack}>
                <View
                  style={[
                    styles.timeFill,
                    {
                      width: `${Math.min(Math.max((timeLeft / GAME_DURATION) * 100, 0), 100)}%`,
                      backgroundColor: timeLeft <= 10 ? "#EF4444" : timeLeft <= 20 ? "#F59E0B" : "#52B72A",
                    },
                  ]}
                />
              </View>
              <View style={styles.timeLabelRow}>
                <Ionicons name="time-outline" size={11.5} color="rgba(255,255,255,0.6)" />
                <Text style={styles.timeLabelText}>{formatTime(timeLeft)}</Text>
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
                    <Image source={ASSETS.coin} style={styles.coinImage} contentFit="contain" cachePolicy="memory-disk" />
                  )}
                  {item.type === "meteor" && (
                    <Image source={ASSETS.meteor} style={styles.meteorImage} contentFit="contain" cachePolicy="memory-disk" />
                  )}
                  {item.type === "rocket" && (
                    <Image source={ASSETS.rocket} style={styles.rocketImage} contentFit="contain" cachePolicy="memory-disk" />
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
                    top: MUNI_TOP_OFFSET - MUNI_SIZE / 2,
                    opacity: muniOpacityAnim,
                    transform: [{ rotate: `${muniTilt.current}deg` }],
                  },
                ]}
              >
                <Image source={ASSETS.muni} style={styles.muniSprite} contentFit="contain" cachePolicy="memory-disk" priority="high" />
              </Animated.View>
            </Animated.View>

            {/* Bottom Gentle Swipe Hint */}
            <View style={styles.bottomControlHint}>
              <Ionicons name="swap-horizontal" size={15} color="rgba(255,255,255,0.7)" />
              <Text style={styles.bottomControlHintText}>Drag left or right to glide</Text>
            </View>
          </View>
        )}

        {/* GAMEOVER / VICTORY OVERLAY */}
        {gameState === "GAMEOVER" && (
          <View style={styles.centerContainer}>
            <View style={styles.modalCard}>
              <View style={[styles.victoryIconWrap, !isVictory && styles.fallenIconWrap]}>
                <Ionicons
                  name={isVictory ? "sparkles" : "planet-outline"}
                  size={32}
                  color={isVictory ? "#F5C447" : "#38BDF8"}
                />
              </View>

              <Text style={styles.modalTitle}>{isVictory ? "Cosmic Arrival!" : "Gentle Landing"}</Text>
              <Text style={styles.modalDesc}>
                {isVictory
                  ? "You navigated the cosmos with peace and poise."
                  : "Muni rested safely on a starway asteroid."}
              </Text>

              {/* Rewards Breakdown */}
              <View style={styles.statsCard}>
                <View style={styles.statRow}>
                  <Text style={styles.statLabel}>Tala Coins Collected</Text>
                  <Text style={styles.statValue}>+{bonusBreakdown.coins}</Text>
                </View>
                {isVictory && (
                  <View style={styles.statRow}>
                    <Text style={styles.statLabel}>60s Survival Bonus</Text>
                    <View style={styles.bonusBadge}>
                      <Text style={styles.bonusBadgeText}>+{bonusBreakdown.survival} Tala</Text>
                    </View>
                  </View>
                )}
                {isVictory && bonusBreakdown.flawless > 0 && (
                  <View style={styles.statRow}>
                    <Text style={styles.statLabel}>Flawless Flight Bonus</Text>
                    <View style={styles.bonusBadge}>
                      <Text style={styles.bonusBadgeText}>+{bonusBreakdown.flawless} Tala</Text>
                    </View>
                  </View>
                )}
                <View style={styles.dividerLine} />
                <View style={styles.statRow}>
                  <Text style={[styles.statLabel, { fontFamily: "Outfit-Bold", color: "#FFFFFF" }]}>
                    Total Tala Earned
                  </Text>
                  <View style={styles.talaBadge}>
                    <Text style={styles.talaBadgeText}>+{bonusBreakdown.total} Tala</Text>
                  </View>
                </View>
              </View>

              <Pressable style={styles.primaryPill} onPress={startGame}>
                <Ionicons name="refresh" size={17} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.primaryPillText}>Drift Again</Text>
              </Pressable>
              <Pressable style={styles.secondaryPill} onPress={quitGame}>
                <Text style={styles.secondaryPillText}>Done</Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>

      {/* Unified Apple Pause Modal */}
      {gameState === "PAUSED" && !showExitPrompt && (
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            <View style={styles.pauseIconWrap}>
              <Ionicons name="pause" size={26} color="#52B72A" />
            </View>
            <Text style={styles.modalTitle}>Flight Paused</Text>
            <Text style={styles.modalDesc}>Take a gentle breath, Muni is floating with you.</Text>

            <Pressable style={styles.primaryPill} onPress={resumeGame}>
              <Ionicons name="play" size={17} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.primaryPillText}>Resume</Text>
            </Pressable>

            <Pressable style={styles.secondaryPill} onPress={restartGame}>
              <Ionicons name="refresh" size={17} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.secondaryPillText}>Restart Flight</Text>
            </Pressable>

            <Pressable style={styles.textAction} onPress={quitGame}>
              <Ionicons name="exit-outline" size={16} color="#F87171" style={{ marginRight: 5 }} />
              <Text style={styles.textActionRed}>Quit Game</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Exit Prompt Sheet */}
      {showExitPrompt && (
        <View style={styles.overlay}>
          <View style={styles.exitCard}>
            <Text style={styles.exitTitle}>Leave Flight?</Text>
            <Text style={styles.exitText}>Your current flight progress will be lost.</Text>
            <View style={styles.exitActions}>
              <Pressable
                style={styles.exitStay}
                onPress={() => {
                  setShowExitPrompt(false);
                  if (gameState === "PAUSED") resumeGame();
                }}
              >
                <Text style={styles.exitStayText}>Stay</Text>
              </Pressable>
              <Pressable style={styles.exitLeave} onPress={quitGame}>
                <Text style={styles.exitLeaveText}>Leave</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0B1021" },
  contentFrame: { flex: 1, alignSelf: "center", position: "relative" },

  /* Top Bar */
  topBar: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    zIndex: 100,
  },
  circleButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255, 255, 255, 0.14)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.22)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  titlePill: {
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  topTitle: {
    color: "#FFFFFF",
    fontSize: 15,
    fontFamily: "Outfit-Bold",
    letterSpacing: -0.2,
  },
  buttonSpacer: { width: 38, height: 38 },

  centerContainer: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20 },
  gameWrapper: { flex: 1, position: "relative" },

  /* HUD */
  hudCard: {
    marginHorizontal: 14,
    marginTop: 6,
    marginBottom: 8,
    backgroundColor: "rgba(15, 23, 42, 0.78)",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.16)",
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
    zIndex: 15,
  },
  hudTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  hudCoinBadge: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "rgba(245, 196, 71, 0.16)",
    borderWidth: 1,
    borderColor: "rgba(245, 196, 71, 0.3)",
  },
  hudCoinIcon: { width: 14, height: 14 },
  hudCoinValue: {
    color: "#F5C447",
    fontSize: 12.5,
    fontFamily: "Outfit-Bold",
  },
  livesRow: { flexDirection: "row", alignItems: "center" },
  hudStatGroup: {
    flexDirection: "row",
    alignItems: "baseline",
    columnGap: 5,
  },
  hudStatLabel: {
    color: "rgba(255, 255, 255, 0.55)",
    fontSize: 10,
    fontFamily: "Outfit-Bold",
    letterSpacing: 0.6,
  },
  hudStatValue: {
    color: "#FFFFFF",
    fontSize: 16.5,
    fontFamily: "Outfit-Bold",
  },
  timeTrack: {
    height: 6,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderRadius: 999,
    overflow: "hidden",
  },
  timeFill: {
    height: "100%",
    borderRadius: 999,
  },
  timeLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    columnGap: 4,
    marginTop: 4,
  },
  timeLabelText: {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: 11,
    fontFamily: "Outfit-Medium",
  },

  /* Canvas */
  canvasArea: { flex: 1, position: "relative", overflow: "hidden" },
  starParticle: { position: "absolute", backgroundColor: "#FFFFFF" },

  itemWrapper: { position: "absolute", alignItems: "center", justifyContent: "center" },
  coinImage: { width: "100%", height: "100%" },
  meteorImage: { width: "100%", height: "100%" },
  rocketImage: { width: "100%", height: "100%" },
  shieldBubble: {
    width: "100%",
    height: "100%",
    borderRadius: 999,
    backgroundColor: "rgba(0, 206, 201, 0.2)",
    borderWidth: 1.5,
    borderColor: "#00CEC9",
    alignItems: "center",
    justifyContent: "center",
  },

  scorePopupText: {
    position: "absolute",
    fontSize: 15,
    fontFamily: "Outfit-Bold",
    zIndex: 100,
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  muniContainer: {
    position: "absolute",
    width: 60,
    height: 60,
    alignItems: "center",
    justifyContent: "center",
  },
  muniSprite: { width: 56, height: 56 },

  bottomControlHint: {
    position: "absolute",
    bottom: 20,
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    columnGap: 6,
  },
  bottomControlHintText: {
    color: "rgba(255, 255, 255, 0.65)",
    fontSize: 12.5,
    fontFamily: "Outfit-Medium",
  },

  /* Overlays & Modals */
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(5, 8, 18, 0.65)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 200,
    padding: 20,
  },
  startCard: {
    width: "100%",
    maxWidth: 325,
    backgroundColor: "rgba(15, 23, 42, 0.94)",
    borderRadius: 28,
    padding: 22,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.16)",
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  coverWrap: {
    width: 130,
    height: 130,
    borderRadius: 22,
    overflow: "hidden",
    marginBottom: 14,
  },
  coverImage: { width: "100%", height: "100%" },
  modalCard: {
    width: "100%",
    maxWidth: 325,
    backgroundColor: "rgba(15, 23, 42, 0.95)",
    borderRadius: 28,
    padding: 22,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.16)",
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  pauseIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(82, 183, 42, 0.18)",
    borderWidth: 1,
    borderColor: "rgba(82, 183, 42, 0.35)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  victoryIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(245, 196, 71, 0.18)",
    borderWidth: 1,
    borderColor: "rgba(245, 196, 71, 0.35)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  fallenIconWrap: {
    backgroundColor: "rgba(56, 189, 248, 0.18)",
    borderColor: "rgba(56, 189, 248, 0.35)",
  },
  modalTitle: {
    fontSize: 22,
    fontFamily: "Outfit-Bold",
    color: "#FFFFFF",
    marginBottom: 4,
    textAlign: "center",
    letterSpacing: -0.3,
  },
  modalDesc: {
    fontSize: 13.5,
    lineHeight: 18.5,
    color: "rgba(255, 255, 255, 0.7)",
    textAlign: "center",
    marginBottom: 18,
    fontFamily: "Outfit-Regular",
  },

  recordsBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.14)",
    borderRadius: 18,
    paddingVertical: 11,
    paddingHorizontal: 16,
    width: "100%",
    marginBottom: 18,
  },
  recordCol: { alignItems: "center" },
  recordColLabel: {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: 10,
    fontFamily: "Outfit-Bold",
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  recordColValue: {
    color: "#F5C447",
    fontSize: 18,
    fontFamily: "Outfit-Bold",
  },
  recordDivider: {
    width: 1,
    height: 24,
    backgroundColor: "rgba(255, 255, 255, 0.18)",
  },

  primaryPill: {
    width: "100%",
    height: 48,
    borderRadius: 999,
    backgroundColor: "#52B72A",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#52B72A",
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
    marginBottom: 10,
  },
  primaryPillText: {
    color: "#FFFFFF",
    fontSize: 15.5,
    fontFamily: "Outfit-Bold",
  },
  secondaryPill: {
    width: "100%",
    height: 46,
    borderRadius: 999,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.16)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  secondaryPillText: {
    color: "#FFFFFF",
    fontSize: 14.5,
    fontFamily: "Outfit-Bold",
  },
  textAction: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
  },
  textActionRed: {
    color: "#F87171",
    fontSize: 14,
    fontFamily: "Outfit-SemiBold",
  },

  statsCard: {
    width: "100%",
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.14)",
    padding: 13,
    rowGap: 9,
    marginBottom: 18,
  },
  statRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statLabel: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 13,
    fontFamily: "Outfit-Regular",
  },
  statValue: {
    color: "#FFFFFF",
    fontSize: 14.5,
    fontFamily: "Outfit-Bold",
  },
  bonusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: "rgba(82, 183, 42, 0.2)",
    borderWidth: 1,
    borderColor: "rgba(82, 183, 42, 0.35)",
  },
  bonusBadgeText: {
    color: "#52B72A",
    fontSize: 11,
    fontFamily: "Outfit-Bold",
  },
  dividerLine: {
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.14)",
    marginVertical: 2,
  },
  talaBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "rgba(245, 196, 71, 0.2)",
    borderWidth: 1,
    borderColor: "rgba(245, 196, 71, 0.4)",
  },
  talaBadgeText: {
    color: "#F5C447",
    fontSize: 12,
    fontFamily: "Outfit-Bold",
  },

  /* Exit Sheet */
  exitCard: {
    width: "100%",
    maxWidth: 295,
    backgroundColor: "rgba(15, 23, 42, 0.95)",
    padding: 22,
    borderRadius: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.18)",
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 18,
    elevation: 10,
  },
  exitTitle: {
    color: "#FFFFFF",
    fontSize: 19,
    fontFamily: "Outfit-Bold",
    marginBottom: 6,
  },
  exitText: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 13.5,
    lineHeight: 18,
    textAlign: "center",
    marginBottom: 18,
    fontFamily: "Outfit-Regular",
  },
  exitActions: {
    flexDirection: "row",
    columnGap: 10,
    width: "100%",
  },
  exitStay: {
    flex: 1,
    height: 42,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  exitStayText: {
    color: "#FFFFFF",
    fontFamily: "Outfit-Bold",
    fontSize: 14,
  },
  exitLeave: {
    flex: 1,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#DC2626",
    alignItems: "center",
    justifyContent: "center",
  },
  exitLeaveText: {
    color: "#FFFFFF",
    fontFamily: "Outfit-Bold",
    fontSize: 14,
  },
});
