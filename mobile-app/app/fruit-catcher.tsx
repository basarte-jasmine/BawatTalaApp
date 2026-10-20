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
    View} from "react-native";
import { Image } from "expo-image";
const AnimatedExpoImage = Animated.createAnimatedComponent(Image);
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
  beach: require("../assets/images/Mini Reset/Fruit Catcher/Beach.jpg")};

const FRUITS = [
  { id: "banana", src: ASSETS.banana, points: 1 },
  { id: "pear", src: ASSETS.pear, points: 1 },
  { id: "orange", src: ASSETS.orange, points: 2 },
  { id: "coconut", src: ASSETS.coconut, points: 2 },
  { id: "coconutTwo", src: ASSETS.coconutTwo, points: 3 },
];

export default function FruitCatcherScreen() {
  const { user } = useAuthSession();
  const [gameState, setGameState] = useState<'start' | 'playing' | 'paused' | 'gameover'>('start');
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
      onPanResponderMove: (evt, gestureState) => {
        let newX = dragStartX.current + gestureState.dx;
        const maxX = Math.max(0, gameWidth.current - BASKET_WIDTH);
        if (newX < 0) newX = 0;
        if (newX > maxX) newX = maxX;
        basketX.setValue(newX);
      }})
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
    const shellProbability = Math.min(0.20, 0.05 + level * 0.02);

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
        speed: baseSpeed + (Math.random() * 0.1),
        caught: false};
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

          const p = { id: Math.random().toString(), text: "+" + pts, x: item.x, y: basketY - 20, type: "score" };
          setPopups((prev) => [...prev, p]);

          if (currentCombo % 5 === 0 && currentCombo > 0) {
            currentScore += 3;
            setPopups((prev) => [...prev, { id: Math.random().toString(), text: "+3 BONUS!", x: gameWidth.current / 2 - 40, y: basketY - 60, type: "bonus" }]);
          }
        } else if (item.type === "shell") {
          currentHearts -= 1;
          currentCombo = 0;
          setPopups((prev) => [...prev, { id: Math.random().toString(), text: "-1", x: item.x, y: basketY - 20, type: "damage" }]);
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
        setGameState('gameover');
        const curScore = currentScore;
        const curLevel = level;
        if (!rewardClaimedRef.current) {
          rewardClaimedRef.current = true;
          claimMiniResetReward({ activityId: "fruit-catcher", level: curLevel, roundKey: "fruit-catcher-" + Date.now(), score: curScore })
            .then((reward) => setRewardTala(reward.rewardTala ?? 0))
            .catch(() => undefined);
        }
        let newBest = bestScore;
        let newHigh = highestLevel;
        if (curScore > bestScore) { newBest = curScore; setBestScore(curScore); }
        if (curLevel > highestLevel) { newHigh = curLevel; setHighestLevel(curLevel); }
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
    if (gameState === 'playing') {
      setGameState('paused');
    }
  };

  const resumeGame = () => {
    if (gameState === 'paused') {
      setGameState('playing');
    }
  };

  const restartGame = () => {
    startGame();
  };

  const quitGame = () => {
    router.replace('/wellness-tools');
  };

  const confirmExit = () => {
    setShowExitPrompt(true);
  };

  const leaveGame = () => {
    setShowExitPrompt(false);
    router.replace("/wellness-tools");
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <Image source={ASSETS.beach} style={styles.background} contentFit="cover" />
      
      <View style={styles.topBar}>
        <Pressable
          onPress={() => {
            if (gameState === 'playing') pauseGame();
            else quitGame();
          }}
          style={styles.backButton}
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={26} color="#FFFFFF" />
        </Pressable>
        <Text style={styles.topTitle}>Fruit Catcher</Text>
        {gameState === 'playing' ? (
          <Pressable onPress={pauseGame} style={styles.pauseButton} accessibilityLabel="Pause Game">
            <Ionicons name="pause-circle-outline" size={26} color="#FFFFFF" />
          </Pressable>
        ) : (
          <View style={styles.pausePlaceholder} />
        )}
      </View>

      {(gameState === "playing" || gameState === "paused" || gameState === "gameover") && (
        <View style={styles.hud}>
          <View style={styles.hudRow}>
            <Text style={styles.scoreText}>SCORE: {score}</Text>
            <Text style={styles.levelText}>LEVEL: {level}</Text>
          </View>
          <View style={styles.hudRow}>
            <View style={styles.heartsRow}>
              {Array.from({ length: 3 }).map((_, i) => (
                <Image
                  key={i}
                  source={ASSETS.heart}
                  style={[styles.heart, i >= hearts && styles.emptyHeart]}
                />
              ))}
            </View>
            <Text style={styles.comboText}>COMBO x{combo}</Text>
          </View>
        </View>
      )}

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
              <Text key={p.id} style={[styles.popupText, p.type === "damage" ? styles.popupDamage : p.type === "bonus" ? styles.popupBonus : null, { left: p.x, top: p.y }]}>
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

      {gameState === "start" && (
        <View style={styles.overlay}>
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>FRUIT CATCHER</Text>
            <Text style={styles.panelText}>Catch the fruits.</Text>
            <Text style={styles.panelText}>Avoid the shells!</Text>
            <Pressable style={styles.button} onPress={startGame}>
              <Text style={styles.buttonText}>START GAME</Text>
            </Pressable>
          </View>
        </View>
      )}

      {gameState === "gameover" && (
        <View style={styles.overlay}>
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>GAME OVER</Text>
            <Text style={styles.panelText}>Final Score: {score} (Best: {bestScore})</Text>
            <Text style={styles.panelText}>Highest Level: {level} (Best: {highestLevel})</Text>
            <Text style={styles.panelText}>Fruits Caught: {fruitsCaught}</Text>
            <Text style={styles.panelText}>Longest Combo: {longestCombo}</Text>
            <Text style={styles.panelText}>Tala Earned: {rewardTala}</Text>
            <Pressable style={styles.button} onPress={startGame}>
              <Text style={styles.buttonText}>RESTART</Text>
            </Pressable>
            <Pressable style={[styles.button, styles.buttonSecondary]} onPress={() => router.replace("/wellness-tools")}>
              <Text style={styles.buttonTextSecondary}>EXIT</Text>
            </Pressable>
          </View>
        </View>
      )}
      {showExitPrompt && (
        <View style={styles.exitOverlay}>
          <View style={styles.exitCard}>
            <Text style={styles.exitTitle}>Leave game?</Text>
            <Text style={styles.exitText}>Your current progress will be lost.</Text>
            <View style={styles.exitActions}>
              <Pressable style={styles.exitStay} onPress={() => setShowExitPrompt(false)}><Text style={styles.exitStayText}>Stay</Text></Pressable>
              <Pressable style={styles.exitLeave} onPress={leaveGame}><Text style={styles.exitLeaveText}>Leave</Text></Pressable>
            </View>
          </View>
        </View>
      )}
      {/* Unified Pause State Modal */}
      {gameState === 'paused' && (
        <View style={styles.pauseOverlay}>
          <View style={styles.pauseCard}>
            <View style={styles.pauseIconCircle}>
              <Ionicons name="pause" size={28} color="#4F8A38" />
            </View>
            <Text style={styles.pauseTitle}>Game Paused</Text>
            <Text style={styles.pauseSub}>Take a gentle breath, Muni is resting with you.</Text>

            <Pressable style={styles.pauseBtnResume} onPress={resumeGame}>
              <Ionicons name="play" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.pauseBtnResumeText}>Resume</Text>
            </Pressable>

            <Pressable style={styles.pauseBtnRestart} onPress={restartGame}>
              <Ionicons name="refresh" size={18} color="#33475C" style={{ marginRight: 8 }} />
              <Text style={styles.pauseBtnRestartText}>Restart</Text>
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
  container: { flex: 1, backgroundColor: "#87CEEB" },
  background: { position: "absolute", width: "100%", height: "100%", opacity: 0.8 },
  topBar: { height: 52, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 4, zIndex: 9999, elevation: 9999 },
  backButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center" },
  topTitle: { color: "#FFFFFF", fontSize: 18, fontFamily: "Outfit-Bold", textShadowColor: 'rgba(0, 0, 0, 0.5)', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 2 },
  hud: { position: "absolute", top: 60, left: 16, right: 16, zIndex: 10 },
  hudRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  scoreText: { color: "#FFFFFF", fontSize: 18, fontFamily: "Outfit-Bold", textShadowColor: 'rgba(0, 0, 0, 0.75)', textShadowOffset: { width: -1, height: 1 }, textShadowRadius: 10 },
  levelText: { color: "#FFFFFF", fontSize: 18, fontFamily: "Outfit-Bold", textShadowColor: 'rgba(0, 0, 0, 0.75)', textShadowOffset: { width: -1, height: 1 }, textShadowRadius: 10 },
  heartsRow: { flexDirection: "row", gap: 4 },
  heart: { width: 24, height: 24, resizeMode: "contain" },
  emptyHeart: { opacity: 0.3 },
  comboText: { color: "#FFD700", fontSize: 16, fontFamily: "Outfit-Bold", textShadowColor: 'rgba(0, 0, 0, 0.75)', textShadowOffset: { width: -1, height: 1 }, textShadowRadius: 10 },
  gameArea: { flex: 1, position: "relative" },
  basket: { position: "absolute", bottom: 20, width: BASKET_WIDTH, height: BASKET_HEIGHT, resizeMode: "contain" },
  item: { position: "absolute", width: ITEM_SIZE, height: ITEM_SIZE, resizeMode: "contain" },
  popupText: { position: "absolute", color: "#FFFFFF", fontSize: 18, fontFamily: "Outfit-Bold", zIndex: 20, textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 2 },
  popupDamage: { color: "#FF4444" },
  popupBonus: { color: "#FFD700", fontSize: 22 },
  overlay: { position: "absolute", width: "100%", height: "100%", backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center", zIndex: 30 },
  panel: { backgroundColor: "#FFFFFF", padding: 24, borderRadius: 24, alignItems: "center", minWidth: 280, shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 10, elevation: 5 },
  panelTitle: { fontSize: 28, fontFamily: "Outfit-Bold", color: "#33475C", marginBottom: 16 },
  panelText: { fontSize: 16, color: "#5D6678", marginBottom: 8, fontFamily: "Outfit-SemiBold" },
  button: { backgroundColor: "#557E4C", paddingHorizontal: 24, paddingVertical: 12, borderRadius: 999, marginTop: 16, width: "100%", alignItems: "center" },
  buttonText: { color: "#FFFFFF", fontSize: 16, fontFamily: "Outfit-Bold" },
  buttonSecondary: { backgroundColor: "#E6ECF1", marginTop: 12 },
  buttonTextSecondary: { color: "#596987", fontSize: 16, fontFamily: "Outfit-Bold" },
  exitOverlay: { position: "absolute", width: "100%", height: "100%", backgroundColor: "rgba(20, 31, 40, 0.5)", justifyContent: "center", alignItems: "center", zIndex: 10000, elevation: 10000 },
  exitCard: { width: 290, backgroundColor: "#FFFFFF", padding: 24, borderRadius: 20, shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 18, elevation: 12 },
  exitTitle: { color: "#33475C", fontSize: 21, fontFamily: "Outfit-Bold", marginBottom: 8 },
  exitText: { color: "#5D6678", fontSize: 14, lineHeight: 20, marginBottom: 20 },
  exitActions: { flexDirection: "row", gap: 10, justifyContent: "flex-end" },
  exitStay: { paddingHorizontal: 16, paddingVertical: 11, borderRadius: 12, backgroundColor: "#E6ECF1" },
  exitStayText: { color: "#33475C", fontFamily: "Outfit-Bold" },
  exitLeave: { paddingHorizontal: 16, paddingVertical: 11, borderRadius: 12, backgroundColor: "#B75252" },
  exitLeaveText: { color: "#FFFFFF", fontFamily: "Outfit-Bold" },
  pauseButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  pausePlaceholder: { width: 44, height: 44 },
  pauseOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(22, 36, 44, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10000,
    padding: 20,
  },
  pauseCard: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#102028',
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 12,
  },
  pauseIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#EDF5FD',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  pauseTitle: { fontSize: 22, fontFamily: 'Outfit-Bold', color: '#33475C', marginBottom: 6 },
  pauseSub: { fontSize: 14, color: '#607181', textAlign: 'center', marginBottom: 22, lineHeight: 19 },
  pauseBtnResume: {
    width: '100%',
    flexDirection: 'row',
    backgroundColor: '#4F8A38',
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    shadowColor: '#4F8A38',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  pauseBtnResumeText: { color: '#FFFFFF', fontSize: 15, fontFamily: 'Outfit-Bold' },
  pauseBtnRestart: {
    width: '100%',
    flexDirection: 'row',
    backgroundColor: '#F0F4F8',
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  pauseBtnRestartText: { color: '#33475C', fontSize: 15, fontFamily: 'Outfit-Bold' },
  pauseBtnQuit: {
    width: '100%',
    flexDirection: 'row',
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pauseBtnQuitText: { color: '#C45C5C', fontSize: 14, fontFamily: 'Outfit-SemiBold' },
});