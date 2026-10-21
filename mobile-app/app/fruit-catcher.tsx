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
  View,
} from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { unlockAchievement } from "../lib/achievements";
import { useAuthSession } from "../lib/auth-session";
import { claimMiniResetReward } from "../lib/backend-api";
import { getGameScore, saveGameScore } from "../lib/game-scores";

const BASKET_WIDTH = 100;
const BASKET_HEIGHT = 80;
const ITEM_SIZE = 50;

const ASSETS = {
  basket: require("../assets/images/Mini Reset/Fruit Catcher/Basket.webp"),
  banana: require("../assets/images/Mini Reset/Fruit Catcher/Banana.webp"),
  pear: require("../assets/images/Mini Reset/Fruit Catcher/Pear.webp"),
  orange: require("../assets/images/Mini Reset/Fruit Catcher/Orange.webp"),
  coconut: require("../assets/images/Mini Reset/Fruit Catcher/Coconut.webp"),
  coconutTwo: require("../assets/images/Mini Reset/Fruit Catcher/Coconut_two.webp"),
  shell: require("../assets/images/Mini Reset/Fruit Catcher/Shell.webp"),
  heart: require("../assets/images/Mini Reset/Fruit Catcher/Heart.webp"),
  beach: require("../assets/images/Mini Reset/Fruit Catcher/Beach.jpg"),
};

const FRUITS = [
  { id: "banana", src: ASSETS.banana, points: 1 },
  { id: "pear", src: ASSETS.pear, points: 1 },
  { id: "orange", src: ASSETS.orange, points: 2 },
  { id: "coconut", src: ASSETS.coconut, points: 2 },
  { id: "coconutTwo", src: ASSETS.coconutTwo, points: 3 },
];

function triggerHaptic(style = Haptics.ImpactFeedbackStyle.Light) {
  try {
    void Haptics.impactAsync(style);
  } catch {}
}

export default function FruitCatcherScreen() {
  const { user } = useAuthSession();
  const [gameState, setGameState] = useState<"start" | "playing" | "paused" | "gameover">("start");
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [hearts, setHearts] = useState(3);
  const [combo, setCombo] = useState(0);

  const [fruitsCaught, setFruitsCaught] = useState(0);
  const [longestCombo, setLongestCombo] = useState(0);
  const [rewardTala, setRewardTala] = useState(0);
  const rewardClaimedRef = useRef(false);

  const [popups, setPopups] = useState<any[]>([]);
  const [showExitPrompt, setShowExitPrompt] = useState(false);

  const [bestScore, setBestScore] = useState(0);
  const [highestLevel, setHighestLevel] = useState(0);

  useEffect(() => {
    getGameScore("fruit-catcher").then((data) => {
      if (data?.bestScore) setBestScore(data.bestScore);
      if (data?.highestLevel) setHighestLevel(data.highestLevel);
    });
  }, []);

  const basketX = useRef(new Animated.Value(0)).current;
  const basketXValue = useRef(0);
  const gameWidth = useRef(0);
  const gameHeight = useRef(0);
  const dragStartX = useRef(0);

  const itemsRef = useRef<any[]>([]);
  const [, forceRender] = useState({});

  const requestRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const spawnTimerRef = useRef<number>(0);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => gameState === "playing",
      onMoveShouldSetPanResponder: () => gameState === "playing",
      onPanResponderGrant: () => {
        dragStartX.current = basketXValue.current;
      },
      onPanResponderMove: (_evt, gestureState) => {
        let newX = dragStartX.current + gestureState.dx;
        const maxX = Math.max(0, gameWidth.current - BASKET_WIDTH);
        if (newX < 0) newX = 0;
        if (newX > maxX) newX = maxX;
        basketX.setValue(newX);
      },
    })
  ).current;

  const handleGameAreaLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    gameWidth.current = width;
    gameHeight.current = height;

    const centeredX = Math.max(0, (width - BASKET_WIDTH) / 2);
    const currentX = Math.min(basketXValue.current, Math.max(0, width - BASKET_WIDTH));
    const nextX = basketXValue.current === 0 ? centeredX : currentX;
    basketXValue.current = nextX;
    basketX.setValue(nextX);
  };

  useEffect(() => {
    const listener = basketX.addListener(({ value }) => {
      basketXValue.current = value;
    });
    return () => basketX.removeListener(listener);
  }, [basketX]);

  useEffect(() => {
    if (gameState !== "playing") return;
    let newLevel = 1;
    if (score >= 200) newLevel = 7 + Math.floor((score - 200) / 100);
    else if (score >= 150) newLevel = 6;
    else if (score >= 100) newLevel = 5;
    else if (score >= 70) newLevel = 4;
    else if (score >= 40) newLevel = 3;
    else if (score >= 20) newLevel = 2;

    if (newLevel !== level) {
      setLevel(newLevel);
    }
  }, [score, level, gameState]);

  const gameLoop = (time: number) => {
    if (gameState !== "playing") return;

    if (!lastTimeRef.current) lastTimeRef.current = time;
    const deltaTime = time - lastTimeRef.current;
    lastTimeRef.current = time;

    const baseSpeed = 0.08 + Math.min(level, 5) * 0.01;
    const spawnRate = Math.max(900, 2000 - Math.min(level, 6) * 120);
    const shellProbability = Math.min(0.2, 0.05 + level * 0.02);

    if (gameWidth.current <= 0 || gameHeight.current <= 0) {
      requestRef.current = requestAnimationFrame(gameLoop);
      return;
    }

    spawnTimerRef.current += deltaTime;
    if (spawnTimerRef.current > spawnRate) {
      spawnTimerRef.current = 0;
      const isShell = Math.random() < shellProbability;
      const newItem = {
        id: Math.random().toString(),
        type: isShell ? "shell" : "fruit",
        fruitData: isShell ? undefined : FRUITS[Math.floor(Math.random() * FRUITS.length)],
        x: Math.random() * Math.max(0, gameWidth.current - ITEM_SIZE),
        y: -ITEM_SIZE,
        speed: baseSpeed + Math.random() * 0.1,
        caught: false,
      };
      itemsRef.current.push(newItem);
    }

    const basketY = gameHeight.current - BASKET_HEIGHT - 20;

    let currentCombo = combo;
    let currentScore = score;
    let currentHearts = hearts;
    let comboGrown = false;

    for (let i = itemsRef.current.length - 1; i >= 0; i--) {
      const item = itemsRef.current[i];
      if (item.caught) continue;

      item.y += item.speed * deltaTime;

      const hitBasket =
        item.y + ITEM_SIZE >= basketY &&
        item.y <= basketY + BASKET_HEIGHT * 0.5 &&
        item.x + ITEM_SIZE >= basketXValue.current &&
        item.x <= basketXValue.current + BASKET_WIDTH;

      if (hitBasket) {
        item.caught = true;
        if (item.type === "fruit" && item.fruitData) {
          const pts = item.fruitData.points;
          currentScore += pts;
          currentCombo += 1;
          comboGrown = true;

          setFruitsCaught((prev) => prev + 1);
          triggerHaptic(Haptics.ImpactFeedbackStyle.Light);

          const p = {
            id: Math.random().toString(),
            text: "+" + pts,
            x: item.x,
            y: basketY - 20,
            type: "score",
          };
          setPopups((prev) => [...prev, p]);

          if (currentCombo % 5 === 0 && currentCombo > 0) {
            currentScore += 3;
            setPopups((prev) => [
              ...prev,
              {
                id: Math.random().toString(),
                text: "+3 COMBO!",
                x: gameWidth.current / 2 - 45,
                y: basketY - 60,
                type: "bonus",
              },
            ]);
            triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
          }
        } else if (item.type === "shell") {
          currentHearts -= 1;
          currentCombo = 0;
          triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
          setPopups((prev) => [
            ...prev,
            { id: Math.random().toString(), text: "-1 ❤️", x: item.x, y: basketY - 20, type: "damage" },
          ]);
        }
        itemsRef.current.splice(i, 1);
      } else if (item.y > gameHeight.current) {
        itemsRef.current.splice(i, 1);
      }
    }

    if (comboGrown) {
      setCombo(currentCombo);
      setLongestCombo((prev) => Math.max(prev, currentCombo));
    } else if (currentCombo === 0 && combo > 0) {
      setCombo(0);
    }

    if (currentScore !== score) setScore(currentScore);

    if (currentHearts !== hearts) {
      setHearts(currentHearts);
      if (currentHearts <= 0) {
        setGameState("gameover");
        const curScore = currentScore;
        const curLevel = level;
        if (!rewardClaimedRef.current) {
          rewardClaimedRef.current = true;
          claimMiniResetReward({
            activityId: "fruit-catcher",
            level: curLevel,
            roundKey: "fruit-catcher-" + Date.now(),
            score: curScore,
          })
            .then((reward) => setRewardTala(reward.rewardTala ?? 0))
            .catch(() => undefined);
        }
        let newBest = bestScore;
        let newHigh = highestLevel;
        if (curScore > bestScore) {
          newBest = curScore;
          setBestScore(curScore);
        }
        if (curLevel > highestLevel) {
          newHigh = curLevel;
          setHighestLevel(curLevel);
        }
        saveGameScore("fruit-catcher", { bestScore: newBest, highestLevel: newHigh });
        if (user?.studentNumber) unlockAchievement("a-softer-minute", user.studentNumber);
        return;
      }
    }

    forceRender({});
    requestRef.current = requestAnimationFrame(gameLoop);
  };

  useEffect(() => {
    if (gameState === "playing") {
      lastTimeRef.current = performance.now();
      requestRef.current = requestAnimationFrame(gameLoop);
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [gameState, score, level, hearts, combo, popups]);

  useEffect(() => {
    if (popups.length > 0) {
      const t = setTimeout(() => {
        setPopups((prev) => prev.slice(1));
      }, 800);
      return () => clearTimeout(t);
    }
  }, [popups]);

  const startGame = () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    setGameState("playing");
    setScore(0);
    setLevel(1);
    setHearts(3);
    setCombo(0);
    setFruitsCaught(0);
    setLongestCombo(0);
    setRewardTala(0);
    rewardClaimedRef.current = false;
    itemsRef.current = [];
    setPopups([]);
    const centeredX = Math.max(0, (gameWidth.current - BASKET_WIDTH) / 2);
    basketXValue.current = centeredX;
    basketX.setValue(centeredX);
  };

  const pauseGame = () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
    if (gameState === "playing") {
      setGameState("paused");
    }
  };

  const resumeGame = () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
    if (gameState === "paused") {
      setGameState("playing");
    }
  };

  const restartGame = () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    startGame();
  };

  const quitGame = () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
    router.replace("/wellness-tools");
  };

  const handleHeaderBack = () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
    if (gameState === "playing") {
      setGameState("paused");
      setShowExitPrompt(true);
      return;
    }
    router.replace("/wellness-tools");
  };

  const leaveGame = () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    setShowExitPrompt(false);
    router.replace("/wellness-tools");
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <Image source={ASSETS.beach} style={styles.background} contentFit="cover" />

      {/* Apple-style Header Bar */}
      <View style={styles.topBar}>
        <Pressable
          onPress={handleHeaderBack}
          style={styles.circleButton}
          accessibilityLabel="Back"
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={20} color="#0F172A" />
        </Pressable>

        <View style={styles.titlePill}>
          <Text style={styles.topTitle}>Fruit Catcher</Text>
        </View>

        {gameState === "playing" ? (
          <Pressable
            onPress={pauseGame}
            style={styles.circleButton}
            accessibilityLabel="Pause Game"
            hitSlop={8}
          >
            <Ionicons name="pause" size={17} color="#0F172A" />
          </Pressable>
        ) : (
          <View style={styles.buttonSpacer} />
        )}
      </View>

      {/* Apple Floating Glass HUD */}
      {(gameState === "playing" || gameState === "paused") && (
        <View style={styles.hudContainer}>
          <View style={styles.hudCard}>
            <View style={styles.hudLeft}>
              <View style={styles.hudStatPill}>
                <Text style={styles.hudStatLabel}>SCORE</Text>
                <Text style={styles.hudStatValue}>{score}</Text>
              </View>
              <View style={styles.hudLevelPill}>
                <Text style={styles.hudLevelText}>LVL {level}</Text>
              </View>
            </View>

            <View style={styles.hudRight}>
              {combo > 1 ? (
                <View style={styles.hudComboPill}>
                  <Ionicons name="flash" size={12} color="#D97706" />
                  <Text style={styles.hudComboText}>x{combo}</Text>
                </View>
              ) : null}

              <View style={styles.heartsRow}>
                {Array.from({ length: 3 }).map((_, i) => (
                  <Image
                    key={i}
                    source={ASSETS.heart}
                    style={[styles.heart, i >= hearts && styles.emptyHeart]}
                  />
                ))}
              </View>
            </View>
          </View>
        </View>
      )}

      {/* Main Interactive Playfield */}
      <View style={styles.gameArea} onLayout={handleGameAreaLayout} {...panResponder.panHandlers}>
        {gameState === "playing" && (
          <>
            {itemsRef.current.map((item) => (
              <Image
                key={item.id}
                source={item.type === "shell" ? ASSETS.shell : item.fruitData?.src}
                style={[styles.item, { left: item.x, top: item.y }]}
              />
            ))}
            {popups.map((p) => (
              <Text
                key={p.id}
                style={[
                  styles.popupText,
                  p.type === "damage"
                    ? styles.popupDamage
                    : p.type === "bonus"
                    ? styles.popupBonus
                    : null,
                  { left: p.x, top: p.y },
                ]}
              >
                {p.text}
              </Text>
            ))}
            <Animated.Image
              source={ASSETS.basket}
              style={[styles.basket, { transform: [{ translateX: basketX }] }]}
            />
          </>
        )}
      </View>

      {/* Apple Arcade Welcome Card */}
      {gameState === "start" && (
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            <View style={styles.startIconWrap}>
              <Image source={ASSETS.basket} style={styles.startBasketIcon} contentFit="contain" />
            </View>
            <Text style={styles.modalTitle}>Fruit Catcher</Text>
            <Text style={styles.modalDesc}>
              Catch orchard fruits in your basket and avoid tricky shells. Chain catches to boost
              your combo!
            </Text>

            <View style={styles.recordsBox}>
              <View style={styles.recordCol}>
                <Text style={styles.recordColLabel}>BEST SCORE</Text>
                <Text style={styles.recordColValue}>{bestScore}</Text>
              </View>
              <View style={styles.recordDivider} />
              <View style={styles.recordCol}>
                <Text style={styles.recordColLabel}>TOP LEVEL</Text>
                <Text style={styles.recordColValue}>{highestLevel || 1}</Text>
              </View>
            </View>

            <Pressable style={styles.primaryPill} onPress={startGame}>
              <Ionicons name="play" size={17} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.primaryPillText}>Start Game</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Game Over Celebration Sheet */}
      {gameState === "gameover" && (
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            <View style={styles.trophyIconWrap}>
              <Ionicons name="trophy" size={28} color="#D97706" />
            </View>
            <Text style={styles.modalTitle}>Run Complete!</Text>
            <Text style={styles.modalDesc}>Great agility and steady mindful focus.</Text>

            <View style={styles.statsCard}>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Final Score</Text>
                <View style={styles.statValueRow}>
                  <Text style={styles.statValue}>{score}</Text>
                  {score >= bestScore && score > 0 ? (
                    <View style={styles.bestBadge}>
                      <Text style={styles.bestBadgeText}>BEST</Text>
                    </View>
                  ) : null}
                </View>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Highest Level</Text>
                <Text style={styles.statValue}>{level}</Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Fruits Caught</Text>
                <Text style={styles.statValue}>{fruitsCaught}</Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Longest Combo</Text>
                <Text style={styles.statValue}>x{longestCombo}</Text>
              </View>
              {rewardTala > 0 ? (
                <View style={styles.statRow}>
                  <Text style={styles.statLabel}>Tala Earned</Text>
                  <View style={styles.talaBadge}>
                    <Text style={styles.talaBadgeText}>+{rewardTala} Tala</Text>
                  </View>
                </View>
              ) : null}
            </View>

            <Pressable style={styles.primaryPill} onPress={startGame}>
              <Ionicons name="refresh" size={17} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.primaryPillText}>Play Again</Text>
            </Pressable>
            <Pressable style={styles.secondaryPill} onPress={quitGame}>
              <Text style={styles.secondaryPillText}>Done</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Unified Apple Pause Modal */}
      {gameState === "paused" && !showExitPrompt && (
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            <View style={styles.pauseIconWrap}>
              <Ionicons name="pause" size={26} color="#52B72A" />
            </View>
            <Text style={styles.modalTitle}>Game Paused</Text>
            <Text style={styles.modalDesc}>Take a gentle breath, Muni is resting with you.</Text>

            <Pressable style={styles.primaryPill} onPress={resumeGame}>
              <Ionicons name="play" size={17} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.primaryPillText}>Resume</Text>
            </Pressable>

            <Pressable style={styles.secondaryPill} onPress={restartGame}>
              <Ionicons name="refresh" size={17} color="#334155" style={{ marginRight: 6 }} />
              <Text style={styles.secondaryPillText}>Restart</Text>
            </Pressable>

            <Pressable style={styles.textAction} onPress={quitGame}>
              <Ionicons name="exit-outline" size={16} color="#DC2626" style={{ marginRight: 5 }} />
              <Text style={styles.textActionRed}>Quit Game</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* iOS Confirmation Sheet for Leaving */}
      {showExitPrompt && (
        <View style={styles.overlay}>
          <View style={styles.exitCard}>
            <Text style={styles.exitTitle}>Leave Game?</Text>
            <Text style={styles.exitText}>Your current run progress will be lost.</Text>
            <View style={styles.exitActions}>
              <Pressable
                style={styles.exitStay}
                onPress={() => {
                  setShowExitPrompt(false);
                  if (gameState === "paused") resumeGame();
                }}
              >
                <Text style={styles.exitStayText}>Stay</Text>
              </Pressable>
              <Pressable style={styles.exitLeave} onPress={leaveGame}>
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
  container: { flex: 1, backgroundColor: "#87CEEB" },
  background: { position: "absolute", width: "100%", height: "100%", opacity: 0.8 },

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
    backgroundColor: "rgba(255, 255, 255, 0.88)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.6)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0F172A",
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  titlePill: {
    backgroundColor: "rgba(255, 255, 255, 0.85)",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.6)",
    shadowColor: "#0F172A",
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  topTitle: {
    color: "#0F172A",
    fontSize: 15,
    fontFamily: "Outfit-Bold",
    letterSpacing: -0.2,
  },
  buttonSpacer: { width: 38, height: 38 },

  /* HUD */
  hudContainer: {
    position: "absolute",
    top: 60,
    left: 16,
    right: 16,
    zIndex: 20,
  },
  hudCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255, 255, 255, 0.92)",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.7)",
    shadowColor: "#0F172A",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  hudLeft: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 8,
  },
  hudStatPill: {
    flexDirection: "row",
    alignItems: "baseline",
    columnGap: 5,
  },
  hudStatLabel: {
    color: "#64748B",
    fontSize: 10,
    fontFamily: "Outfit-Bold",
    letterSpacing: 0.6,
  },
  hudStatValue: {
    color: "#0F172A",
    fontSize: 17,
    fontFamily: "Outfit-Bold",
  },
  hudLevelPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "#EAF6E8",
  },
  hudLevelText: {
    color: "#2E7C1F",
    fontSize: 11,
    fontFamily: "Outfit-Bold",
  },
  hudRight: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 10,
  },
  hudComboPill: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "#FEF3C7",
  },
  hudComboText: {
    color: "#B45309",
    fontSize: 11.5,
    fontFamily: "Outfit-Bold",
  },
  heartsRow: {
    flexDirection: "row",
    columnGap: 4,
    alignItems: "center",
  },
  heart: { width: 22, height: 22, resizeMode: "contain" },
  emptyHeart: { opacity: 0.25 },

  /* Game Canvas */
  gameArea: { flex: 1, position: "relative" },
  basket: {
    position: "absolute",
    bottom: 20,
    width: BASKET_WIDTH,
    height: BASKET_HEIGHT,
    resizeMode: "contain",
  },
  item: { position: "absolute", width: ITEM_SIZE, height: ITEM_SIZE, resizeMode: "contain" },
  popupText: {
    position: "absolute",
    color: "#FFFFFF",
    fontSize: 18,
    fontFamily: "Outfit-Bold",
    zIndex: 20,
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  popupDamage: { color: "#EF4444" },
  popupBonus: { color: "#F59E0B", fontSize: 20 },

  /* Apple Arcade Overlays & Cards */
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.48)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 200,
    padding: 20,
  },
  modalCard: {
    width: "100%",
    maxWidth: 325,
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    padding: 22,
    alignItems: "center",
    shadowColor: "#0F172A",
    shadowOpacity: 0.18,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  startIconWrap: {
    width: 68,
    height: 68,
    borderRadius: 22,
    backgroundColor: "#EAF6E8",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  startBasketIcon: { width: 44, height: 44 },
  pauseIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#EAF6E8",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  trophyIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#FEF3C7",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 22,
    fontFamily: "Outfit-Bold",
    color: "#0F172A",
    marginBottom: 4,
    textAlign: "center",
    letterSpacing: -0.3,
  },
  modalDesc: {
    fontSize: 13.5,
    lineHeight: 18.5,
    color: "#64748B",
    textAlign: "center",
    marginBottom: 18,
    fontFamily: "Outfit-Regular",
  },

  recordsBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    backgroundColor: "#F8FAF8",
    borderWidth: 1,
    borderColor: "#E6ECE4",
    borderRadius: 18,
    paddingVertical: 11,
    paddingHorizontal: 16,
    width: "100%",
    marginBottom: 18,
  },
  recordCol: { alignItems: "center" },
  recordColLabel: {
    color: "#64748B",
    fontSize: 10,
    fontFamily: "Outfit-Bold",
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  recordColValue: {
    color: "#0F172A",
    fontSize: 18,
    fontFamily: "Outfit-Bold",
  },
  recordDivider: {
    width: 1,
    height: 24,
    backgroundColor: "#E2E8F0",
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
    shadowOpacity: 0.28,
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
    backgroundColor: "#F1F5F9",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  secondaryPillText: {
    color: "#334155",
    fontSize: 14.5,
    fontFamily: "Outfit-Bold",
  },
  textAction: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
  },
  textActionRed: {
    color: "#DC2626",
    fontSize: 14,
    fontFamily: "Outfit-SemiBold",
  },

  statsCard: {
    width: "100%",
    backgroundColor: "#F8FAF8",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E6ECE4",
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
    color: "#64748B",
    fontSize: 13,
    fontFamily: "Outfit-Regular",
  },
  statValueRow: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 6,
  },
  statValue: {
    color: "#0F172A",
    fontSize: 14.5,
    fontFamily: "Outfit-Bold",
  },
  bestBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: "#FEF3C7",
  },
  bestBadgeText: {
    color: "#B45309",
    fontSize: 9.5,
    fontFamily: "Outfit-Bold",
  },
  talaBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "#FEF3C7",
  },
  talaBadgeText: {
    color: "#B45309",
    fontSize: 12,
    fontFamily: "Outfit-Bold",
  },

  /* Exit Sheet */
  exitCard: {
    width: "100%",
    maxWidth: 295,
    backgroundColor: "#FFFFFF",
    padding: 22,
    borderRadius: 24,
    alignItems: "center",
    shadowColor: "#0F172A",
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 10,
  },
  exitTitle: {
    color: "#0F172A",
    fontSize: 19,
    fontFamily: "Outfit-Bold",
    marginBottom: 6,
  },
  exitText: {
    color: "#64748B",
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
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  exitStayText: {
    color: "#334155",
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
