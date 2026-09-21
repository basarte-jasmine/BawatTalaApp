import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { getGameScore, saveGameScore } from "../lib/game-scores";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
    Animated,
    Image,
    LayoutChangeEvent,
    PanResponder,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";

const RAFT_W = 70;
const RAFT_H = 90;
const RAFT_BOTTOM_OFFSET = 120;

const BASE_SPEED = 3.5;
const PARTICLE_SPEEDS = [2, 3, 4.5, 5];
const LERP_FACTOR = 0.08;

const COLOR_WATER = "#DFF1F5";
const COLOR_BANK = "#75A096";
const COLOR_BANK_EDGE = "#5C867B";
const COLOR_TEXT = "#2F4156";
const COLOR_LEAF = "#FFEAA7";

type GameObject = { id: number; type: "croc" | "log" | "snake" | "leaf"; x: number; y: number; width: number; height: number; rotation: number; bankSide?: "left" | "right"; };
type FlowParticle = { id: number; x: number; y: number; speed: number; length: number; opacity: number; };

const ARRIVAL_ASSETS = {
  croc: require("../assets/images/Mini Reset/Muni's Arrival/Croc.webp"),
  log: require("../assets/images/Mini Reset/Muni's Arrival/Logs.webp"),
  snake: require("../assets/images/Mini Reset/Muni's Arrival/Snake.webp"),
};

export default function MunisArrivalScreen() {
  const [gameState, setGameState] = useState<"START" | "PLAYING" | "GAMEOVER">("START");
  const [startStep, setStartStep] = useState(0);
  const gameStateRef = useRef(gameState);

  const [distance, setDistance] = useState(0);
  const [leaves, setLeaves] = useState(0);
  const [health, setHealth] = useState(3);
  
  const bestDriftRef = useRef(0);
  const [, forceUpdate] = useState(0); // Ensure score updates after load

  useEffect(() => {
    getGameScore("munis-arrival").then((data) => {
      if (data?.bestDrift) {
        bestDriftRef.current = data.bestDrift;
        forceUpdate(prev => prev + 1);
      }
    });
  }, []);


  const gameWidth = useRef(0);
  const gameHeight = useRef(0);
  const raftX = useRef(0);
  const targetRaftX = useRef(0);
  const dragStartX = useRef(0);
  const itemsRef = useRef<GameObject[]>([]);
  const particlesRef = useRef<FlowParticle[]>([]);
  const frameCount = useRef(0);
  const nextId = useRef(1);
  const reqRef = useRef<number>(null);
  const wavePhase = useRef(0);
  
  const annoyedTimer = useRef(0);
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const [, setTick] = useState(0);
  const [gameSize, setGameSize] = useState({ width: 0, height: 0 });
  const [showExitPrompt, setShowExitPrompt] = useState(false);

  gameStateRef.current = gameState;

  const triggerShake = useCallback(() => {
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 12, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -12, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 12, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -12, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 40, useNativeDriver: true })
    ]).start();
  }, [shakeAnim]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        dragStartX.current = targetRaftX.current;
      },
      onPanResponderMove: (_evt, gestureState) => {
        if (gameStateRef.current !== "PLAYING") return;
        let newX = dragStartX.current + gestureState.dx;
        const { minX, maxX } = getRaftBounds();
        if (newX < minX) newX = minX;
        if (newX > maxX) newX = maxX;
        targetRaftX.current = newX;
      },
    })
  ).current;

  const handleGameLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width === gameWidth.current && height === gameHeight.current) return;

    gameWidth.current = width;
    gameHeight.current = height;
    const centeredX = width / 2;
    if (raftX.current === 0) {
      raftX.current = centeredX;
      targetRaftX.current = centeredX;
    }
    if (particlesRef.current.length === 0) {
      for (let i = 0; i < 15; i++) {
        particlesRef.current.push({
          id: nextId.current++,
          x: Math.random() * width,
          y: Math.random() * height,
          speed: PARTICLE_SPEEDS[Math.floor(Math.random() * PARTICLE_SPEEDS.length)],
          length: Math.random() * 20 + 10,
          opacity: Math.random() * 0.4 + 0.1,
        });
      }
    }
    setGameSize({ width, height });
  };

  const getRaftBounds = () => {
    const raftY = gameHeight.current - RAFT_BOTTOM_OFFSET - RAFT_H / 2;
    const stepH = gameHeight.current / 10;
    const bankOffset = Math.sin((raftY / Math.max(1, stepH) * 0.8) - wavePhase.current) * (gameWidth.current * 0.08);
    const bankWidth = gameWidth.current * 0.15;
    const leftBank = bankWidth + bankOffset;
    const rightBank = gameWidth.current - bankWidth + bankOffset;
    const minX = leftBank + RAFT_W / 2 + 4;
    const maxX = rightBank - RAFT_W / 2 - 4;

    return { minX, maxX: Math.max(minX, maxX) };
  };

  const confirmExit = () => {
    setShowExitPrompt(true);
  };

  const leaveGame = () => {
    setShowExitPrompt(false);
    router.replace("/wellness-tools");
  };

  useEffect(() => {
    if (gameState === "START") {
      const timers = [
        setTimeout(() => setStartStep(1), 2500),
        setTimeout(() => setStartStep(2), 5000),
        setTimeout(() => setStartStep(3), 7500),
        setTimeout(() => setStartStep(4), 10000),
      ];
      return () => timers.forEach(clearTimeout);
    }
  }, [gameState]);

  useEffect(() => {
    if (startStep === 4) startGame();
  }, [startStep]);

  const startGame = () => {
    setGameState("PLAYING");
    setDistance(0);
    setLeaves(0);
    setHealth(3);
    itemsRef.current = [];
    raftX.current = gameWidth.current / 2;
    targetRaftX.current = gameWidth.current / 2;
    frameCount.current = 0;
    annoyedTimer.current = 0;
  };

  useEffect(() => {
    if (gameState !== "PLAYING") return;

    const loop = () => {
      frameCount.current++;
      wavePhase.current += 0.03;
      
      if (annoyedTimer.current > 0) {
        annoyedTimer.current--;
      }

      if (frameCount.current % 10 === 0) {
        setDistance((d) => {
          const newD = d + 1;
          if (newD > bestDriftRef.current) bestDriftRef.current = newD;
          return newD;
        });
      }

      const raftBounds = getRaftBounds();
      targetRaftX.current = Math.max(raftBounds.minX, Math.min(raftBounds.maxX, targetRaftX.current));
      raftX.current += (targetRaftX.current - raftX.current) * LERP_FACTOR;
      raftX.current = Math.max(raftBounds.minX, Math.min(raftBounds.maxX, raftX.current));

      particlesRef.current.forEach((p) => {
        p.y += p.speed;
        if (p.y > gameHeight.current) {
          p.y = -p.length;
          p.x = Math.random() * gameWidth.current;
        }
      });

      const raftTop = gameHeight.current - RAFT_BOTTOM_OFFSET - RAFT_H;
      const hitBox = { x: raftX.current - RAFT_W / 3, y: raftTop + RAFT_H * 0.2, w: RAFT_W * 0.6, h: RAFT_H * 0.6 };

      for (let i = itemsRef.current.length - 1; i >= 0; i--) {
        const item = itemsRef.current[i];
        item.y += BASE_SPEED;

        if (item.type === "log" && item.bankSide) {
          const bankOffset = Math.sin((item.y / Math.max(1, gameHeight.current / 10) * 0.8) - wavePhase.current) * (gameWidth.current * 0.08);
          const bankEdge = item.bankSide === "left"
            ? gameWidth.current * 0.15 + bankOffset
            : gameWidth.current * 0.85 + bankOffset;
          item.x = item.bankSide === "left"
            ? bankEdge - item.width * 0.3
            : bankEdge + item.width * 0.3;
        }

        if (item.y > gameHeight.current + 50) {
          itemsRef.current.splice(i, 1);
          continue;
        }

        const itemHitBox = { x: item.x - item.width / 2, y: item.y - item.height / 2, w: item.width, h: item.height };
        const isHit = hitBox.x < itemHitBox.x + itemHitBox.w && hitBox.x + hitBox.w > itemHitBox.x && hitBox.y < itemHitBox.y + itemHitBox.h && hitBox.y + hitBox.h > itemHitBox.y;

        if (isHit) {
          if (item.type === "leaf") {
            setLeaves((l) => l + 1);
            itemsRef.current.splice(i, 1);
          } else {
            setHealth((h) => {
              const newH = h - 1;
              if (newH <= 0) setGameState("GAMEOVER");
saveGameScore("munis-arrival", { bestDrift: bestDriftRef.current });
              return newH;
            });
            
            annoyedTimer.current = 60;
            triggerShake();

            const bounceDir = item.x > raftX.current ? -40 : 40;
            raftX.current += bounceDir;
            targetRaftX.current += bounceDir;
            itemsRef.current.splice(i, 1);
          }
        }
      }

      if (frameCount.current % 80 === 0) {
        const isLeaf = Math.random() > 0.6;
        const margin = gameWidth.current * 0.2;
        const spawnX = Math.random() * Math.max(1, gameWidth.current - margin * 2) + margin;
        const type = isLeaf ? "leaf" : (["croc", "log", "snake"] as const)[Math.floor(Math.random() * 3)];
        let x = spawnX;
        let width = 28;
        let height = 28;
        let rotation = 0;
        let bankSide: "left" | "right" | undefined;

        if (type === "log") {
          width = Math.min(170, Math.max(110, gameWidth.current * 0.42));
          height = 54;
          const fromLeft = Math.random() < 0.5;
          bankSide = fromLeft ? "left" : "right";
          const bankOffset = Math.sin((-50 / Math.max(1, gameHeight.current / 10) * 0.8) - wavePhase.current) * (gameWidth.current * 0.08);
          const leftBank = gameWidth.current * 0.15 + bankOffset;
          const rightBank = gameWidth.current * 0.85 + bankOffset;
          x = fromLeft ? leftBank - width * 0.3 : rightBank + width * 0.3;
          rotation = fromLeft ? -14 : 14;
        } else if (type === "croc") {
          width = 44 + Math.random() * 22;
          height = width * 0.72;
          rotation = Math.random() * 50 - 25;
        } else if (type === "snake") {
          width = 58 + Math.random() * 50;
          height = 30 + Math.random() * 14;
          rotation = Math.random() * 360;
        }
        
        itemsRef.current.push({
          id: nextId.current++,
          type,
          x,
          y: -50,
          width,
          height,
          rotation,
          bankSide,
        });
      }

      setTick((t) => t + 1);
      reqRef.current = requestAnimationFrame(loop);
    };

    reqRef.current = requestAnimationFrame(loop);
    return () => { if (reqRef.current) cancelAnimationFrame(reqRef.current); };
  }, [gameState, triggerShake]);

  const generateBankPaths = () => {
    const { width, height } = gameSize;
    let leftPath = `M 0,0 `; let rightPath = `M ${width},0 `;
    const steps = 10; const stepH = height / steps; const baseW = width * 0.15;
    for (let i = 0; i <= steps + 1; i++) {
      const y = i * stepH;
      const offset = Math.sin((i * 0.8) - wavePhase.current) * (width * 0.08);
      leftPath += `L ${baseW + offset},${y} `;
      rightPath += `L ${width - baseW + offset},${y} `;
    }
    leftPath += `L 0,${height} Z`; rightPath += `L ${width},${height} Z`;
    return { leftPath, rightPath };
  };

  const { leftPath, rightPath } = generateBankPaths();

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <Animated.View onLayout={handleGameLayout} style={[styles.gameContainer, { transform: [{ translateX: shakeAnim }] }]}> 
        
        
        <View style={StyleSheet.absoluteFill}>
          {particlesRef.current.map((p) => (
            <View key={p.id} style={[styles.particle, { left: p.x, top: p.y, height: p.length, opacity: p.opacity }]} />
          ))}
        </View>

        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Svg width={gameSize.width} height={gameSize.height}>
            <Path d={leftPath} fill={COLOR_BANK} stroke={COLOR_BANK_EDGE} strokeWidth={4} />
            <Path d={rightPath} fill={COLOR_BANK} stroke={COLOR_BANK_EDGE} strokeWidth={4} />
          </Svg>
        </View>

        <View style={styles.touchArea} {...panResponder.panHandlers}>
          {itemsRef.current.map((item) => (
            <View key={item.id} style={[styles.itemWrap, { left: item.x - item.width / 2, top: item.y - item.height / 2, width: item.width, height: item.height, transform: [{ rotate: `${item.rotation}deg` }] }]}> 
              {item.type === "leaf" ? (
                <View style={[styles.leaf, { width: item.width, height: item.height }]} />
              ) : (
                <Image
                  source={ARRIVAL_ASSETS[item.type]}
                  style={[styles.itemImage, { width: item.width, height: item.height }]}
                  resizeMode="contain"
                />
              )}
            </View>
          ))}

          <Image
            source={
              annoyedTimer.current > 0 
                ? require("../assets/images/Mini Reset/Muni's Arrival/Muni_Raft_Annoyed.webp")
                : require("../assets/images/Mini Reset/Muni's Arrival/Muni_LostwRaft.webp")
            }
            style={[styles.raft, { left: raftX.current - RAFT_W / 2, top: gameSize.height - RAFT_BOTTOM_OFFSET - RAFT_H }]}
            resizeMode="contain"
          />
        </View>
      </Animated.View>

      {gameState === "PLAYING" && (
        <View style={styles.hudTop}>
          <View style={styles.hudLeft}><Text style={styles.hudLabel}>Distance</Text><Text style={styles.hudValue}>{distance}m</Text></View>
          
          <View style={styles.hudCenter}>
            <View style={styles.healthRow}>
              {[1, 2, 3].map((idx) => (
                <View key={idx} style={[styles.zzzBubble, health < idx && styles.zzzBubbleLost]}>
                  <Text style={[styles.zzzText, health < idx && styles.zzzTextLost]}>Zzz</Text>
                </View>
              ))}
            </View>
          </View>
          <View style={styles.hudRight}><Text style={styles.hudLabel}>Glow Leaves</Text><Text style={styles.hudValue}>{leaves}</Text></View>
        </View>
      )}

      {gameState === "START" && (
        <View style={styles.overlay}>
          <Image source={require("../assets/images/Mini Reset/Muni's Arrival/Muni's Arrival Cover.webp")} style={styles.coverImage} resizeMode="cover" />
          <Text style={[styles.startText, startStep >= 0 && styles.textVisible]}>Muni&apos;s Arrival</Text>
          <Text style={[styles.startSub, startStep >= 1 && styles.textVisible]}>Muni has just arrived.</Text>
          <Text style={[styles.startSub, startStep >= 2 && styles.textVisible]}>They&apos;re still asleep.</Text>
          <Text style={[styles.startSub, startStep >= 3 && styles.textVisible]}>Guide the raft gently.</Text>
        </View>
      )}

      {gameState === "GAMEOVER" && (
        <View style={styles.overlay}>
          <View style={styles.gameOverCard}>
            <Text style={styles.goTitle}>Muni woke up.</Text>
            <Text style={styles.goSub}>The river got a little too bumpy.</Text>
            
            <View style={styles.statsBox}>
              <View style={styles.statRow}><Text style={styles.statLabel}>Distance</Text><Text style={styles.statValue}>{distance}m</Text></View>
              <View style={styles.statRow}><Text style={styles.statLabel}>Glow Leaves</Text><Text style={styles.statValue}>{leaves}</Text></View>
              <View style={styles.statRow}><Text style={styles.statLabel}>Best Drift</Text><Text style={styles.statValue}>{bestDriftRef.current}m</Text></View>
            </View>

            <Pressable style={styles.btnPrimary} onPress={startGame}><Text style={styles.btnPrimaryText}>Drift Again</Text></Pressable>
            <Pressable style={styles.btnSecondary} onPress={confirmExit}><Text style={styles.btnSecondaryText}>Leave River</Text></Pressable>
          </View>
        </View>
      )}
      <View style={styles.topBar} pointerEvents="box-none">
        <Pressable onPress={confirmExit} style={styles.backButton} accessibilityLabel="Leave Muni's Arrival">
          <Ionicons name="chevron-back" size={28} color={COLOR_TEXT} />
        </Pressable>
      </View>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLOR_WATER },
  gameContainer: { flex: 1 },
  topBar: { position: "absolute", top: 0, left: 0, right: 0, height: 60, zIndex: 9999, elevation: 9999 },
  backButton: { width: 48, height: 48, marginTop: 6, marginLeft: 8, alignItems: "center", justifyContent: "center", zIndex: 10000, elevation: 10000 },
  touchArea: { flex: 1, position: "absolute", width: "100%", height: "100%", zIndex: 10 },
  particle: { position: "absolute", width: 2, backgroundColor: "#FFFFFF", borderRadius: 2 },
  raft: { position: "absolute", width: RAFT_W, height: RAFT_H },
  itemWrap: { position: "absolute", alignItems: "center", justifyContent: "center" },
  itemImage: { position: "absolute" },
  leaf: { backgroundColor: COLOR_LEAF, borderRadius: 12, borderTopRightRadius: 2, borderBottomLeftRadius: 2, shadowColor: COLOR_LEAF, shadowOpacity: 0.9, shadowRadius: 8, elevation: 4 },
  hudTop: { position: "absolute", top: 50, width: "100%", flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 20, zIndex: 20 },
  hudLeft: { alignItems: "flex-start" }, hudRight: { alignItems: "flex-end" }, hudCenter: { alignItems: "center", justifyContent: "flex-start", marginTop: 8 },
  hudLabel: { color: "#627882", fontSize: 11, fontFamily: "Outfit-Bold", textTransform: "uppercase", letterSpacing: 0.5 },
  hudValue: { color: COLOR_TEXT, fontSize: 18, fontFamily: "Outfit-Bold" },
  sleepText: { color: "#4A6273", fontSize: 13, fontFamily: "Outfit-SemiBold", opacity: 0.8 },
  healthRow: { flexDirection: "row", gap: 6 },
  zzzBubble: { paddingHorizontal: 10, paddingVertical: 5, backgroundColor: "rgba(255, 255, 255, 0.8)", borderRadius: 12, borderWidth: 1, borderColor: "rgba(255, 255, 255, 1)" },
  zzzBubbleLost: { backgroundColor: "rgba(255, 255, 255, 0.15)", borderColor: "rgba(255, 255, 255, 0.3)" },
  zzzText: { color: "#1A2F45", fontSize: 12, fontFamily: "Outfit-Bold" },
  zzzTextLost: { color: "rgba(26, 47, 69, 0.3)" },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(223, 241, 245, 0.85)", alignItems: "center", justifyContent: "center", zIndex: 100 },
  coverImage: { width: 150, height: 150, borderRadius: 20, marginBottom: 18 },
  startText: { fontSize: 28, fontFamily: "Outfit-Bold", color: COLOR_TEXT, opacity: 0, marginBottom: 12 },
  startSub: { fontSize: 15, color: "#546A7B", opacity: 0, marginBottom: 6 },
  textVisible: { opacity: 1 },
  gameOverCard: { width: 300, backgroundColor: "#FFFFFF", borderRadius: 24, padding: 24, alignItems: "center", shadowColor: "#8BA7B3", shadowOpacity: 0.2, shadowRadius: 15, elevation: 10 },
  goTitle: { fontSize: 22, fontFamily: "Outfit-Bold", color: COLOR_TEXT, marginBottom: 6 },
  goSub: { fontSize: 14, color: "#607181", marginBottom: 20, textAlign: "center" },
  statsBox: { width: "100%", backgroundColor: "#F4F8F9", borderRadius: 16, padding: 16, marginBottom: 24, rowGap: 12 },
  statRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  statLabel: { fontSize: 13, color: "#546A7B" }, statValue: { fontSize: 15, fontFamily: "Outfit-Bold", color: COLOR_TEXT },
  btnPrimary: { width: "100%", backgroundColor: "#4C7E32", borderRadius: 14, paddingVertical: 14, alignItems: "center", marginBottom: 10 },
  btnPrimaryText: { color: "#FFFFFF", fontSize: 15, fontFamily: "Outfit-Bold" },
  btnSecondary: { width: "100%", paddingVertical: 14, alignItems: "center" },
  btnSecondaryText: { color: "#546A7B", fontSize: 15, fontFamily: "Outfit-SemiBold" },
  exitOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(25, 43, 52, 0.45)", alignItems: "center", justifyContent: "center", zIndex: 20000, elevation: 20000 },
  exitCard: { width: 290, backgroundColor: "#FFFFFF", borderRadius: 20, padding: 24, shadowColor: "#18323A", shadowOpacity: 0.25, shadowRadius: 18, elevation: 12 },
  exitTitle: { color: COLOR_TEXT, fontSize: 21, fontFamily: "Outfit-Bold", marginBottom: 8 },
  exitText: { color: "#607181", fontSize: 14, lineHeight: 20, marginBottom: 20 },
  exitActions: { flexDirection: "row", gap: 10, justifyContent: "flex-end" },
  exitStay: { paddingHorizontal: 16, paddingVertical: 11, borderRadius: 12, backgroundColor: "#EEF3F4" },
  exitStayText: { color: COLOR_TEXT, fontFamily: "Outfit-Bold" },
  exitLeave: { paddingHorizontal: 16, paddingVertical: 11, borderRadius: 12, backgroundColor: "#B75252" },
  exitLeaveText: { color: "#FFFFFF", fontFamily: "Outfit-Bold" },
});
