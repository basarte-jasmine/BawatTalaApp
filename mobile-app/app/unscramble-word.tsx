import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
    Animated,
    Image,
    Pressable,
    StyleSheet,
    Text,
    useWindowDimensions,
    Vibration,
    View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { claimMiniResetReward } from "../lib/backend-api";
import { getGameScore, saveGameScore } from "../lib/game-scores";

const COVER = require("../assets/images/Mini Reset/Unscramble Word/Unscramble Word Cover.webp"); 

type GameState = "START" | "PLAYING" | "GAMEOVER";

const INITIAL_TIME = 45;

const WORDS_EASY = [
  "AIR", "ART", "AURA", "BEAM", "CALM", "CARE", "COZY", "DAWN", "DEEP", "DOVE", 
  "EASE", "ECHO", "FLOW", "FREE", "GLOW", "GROW", "HEAL", "HOPE", "HUG", "JOY", 
  "KIND", "LAKE", "LEAF", "LIFE", "LOVE", "MIND", "MOON", "MUNI", "NEST", "OPEN", 
  "PACE", "PURE", "RAIN", "RAY", "REST", "ROOT", "SAFE", "SEA", "SEED", "SKY", 
  "SLOW", "SOFT", "SOUL", "STAR", "SUN", "TIDE", "TIME", "TREE", "TRUE", "WARM", 
  "WIND", "YOGA", "ZEN"
];

const WORDS_MED = [
  "ALIGN", "AMUSE", "AWAKE", "BLISS", "BLOOM", "BREATH", "BREEZE", "CENTER", 
  "CLOUD", "DREAM", "EARTH", "EXHALE", "FLORA", "FLOWER", "FOCUS", "FOREST", 
  "GENTLE", "GROUND", "GUIDED", "HEALTH", "INHALE", "INWARD", "LIGHT", "LISTEN", 
  "LOVING", "MEADOW", "NATURE", "OCEAN", "PEACE", "PETAL", "PLANET", "PONDER", 
  "QUIET", "RELAX", "RENEW", "RIVER", "SERENE", "SILENT", "SIMPLE", "SLEEP", 
  "SMILE", "SMOOTH", "SOOTHE", "SPIRIT", "SPRING", "STILL", "SUNSET", "TENDER", 
  "UNWIND", "VALLEY", "WATER", "WONDER"
];

const WORDS_HARD = [
  "ACCEPT", "AWARENESS", "BALANCE", "BEAUTIFUL", "BLOSSOM", "BREATHING", 
  "CALMNESS", "CLARITY", "COMPASSION", "CONNECT", "COURAGE", "DISCOVER", 
  "EMBRACE", "EMPATHY", "FLOURISH", "FORGIVE", "GRATITUDE", "GROUNDING", 
  "HARMONY", "HEALING", "JOURNEY", "KINDNESS", "MEDITATE", "MINDFUL", 
  "NOURISH", "NURTURE", "PATIENCE", "PEACEFUL", "POSITIVE", "PRESENCE", 
  "PRESENT", "RADIANCE", "REFLECT", "RELAXING", "RESILIENCE", "RESTORE", 
  "SERENITY", "SILENCE", "SOOTHING", "STILLNESS", "STRENGTH", "STRETCH", 
  "SUNRISE", "TRANQUIL", "WELLNESS", "WHOLENESS"
];

type LetterTile = { id: string; char: string; used: boolean };
type AnswerTile = { id: string; char: string; sourceId: string };

export default function UnscrambleWordScreen() {
  const { width: screenW } = useWindowDimensions();
  const appWidth = Math.min(screenW, 420);

  const [gameState, setGameState] = useState<GameState>("START");
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [timeLeft, setTimeLeft] = useState(INITIAL_TIME);
  const [combo, setCombo] = useState(0);

  const [currentWord, setCurrentWord] = useState("");
  const [scrambledPool, setScrambledPool] = useState<LetterTile[]>([]);
  const [answerSlots, setAnswerSlots] = useState<AnswerTile[]>([]);
  
  const [isError, setIsError] = useState(false);
  const [showExitPrompt, setShowExitPrompt] = useState(false);
  const [rewardTala, setRewardTala] = useState(0);
  const rewardClaimedRef = useRef(false);
  
  const shakeAnim = useRef(new Animated.Value(0)).current;
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  const bestScoreRef = useRef(0);
  const bestLevelRef = useRef(0);
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    getGameScore("unscramble-word").then((data) => {
      if (data?.bestScore) bestScoreRef.current = data.bestScore;
      if (data?.bestLevel) bestLevelRef.current = data.bestLevel;
      forceUpdate(p => p + 1);
    });
  }, []);


  const getNextWord = (currentLevel: number) => {
    let wordList = WORDS_EASY;
    if (currentLevel > 3 && currentLevel <= 8) {
      wordList = Math.random() > 0.3 ? WORDS_MED : WORDS_EASY;
    } else if (currentLevel > 8) {
      const r = Math.random();
      if (r > 0.5) wordList = WORDS_HARD;
      else if (r > 0.2) wordList = WORDS_MED;
      else wordList = WORDS_EASY;
    }
    return wordList[Math.floor(Math.random() * wordList.length)];
  };

  const setupNextWord = (lvl: number) => {
    const word = getNextWord(lvl);
    setCurrentWord(word);
    
    let chars = word.split("");
    for (let i = chars.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [chars[i], chars[j]] = [chars[j], chars[i]];
    }
    
    if (chars.join("") === word && word.length > 2) {
      [chars[0], chars[1]] = [chars[1], chars[0]];
    }

    const pool = chars.map((char, idx) => ({ id: `${char}_${idx}`, char, used: false }));
    setScrambledPool(pool);
    setAnswerSlots([]);
  };

  const startGame = () => {
    setGameState("PLAYING");
    setScore(0);
    setLevel(1);
    setCombo(0);
    setTimeLeft(INITIAL_TIME);
    setRewardTala(0);
    rewardClaimedRef.current = false;
    setupNextWord(1);
  };

  useEffect(() => {
    if (gameState === "PLAYING") {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            setGameState("GAMEOVER");
            if (!rewardClaimedRef.current) {
              rewardClaimedRef.current = true;
              claimMiniResetReward({ activityId: "unscramble-word", level, roundKey: `unscramble-word-${Date.now()}`, score })
                .then((reward) => setRewardTala(reward.rewardTala))
                .catch(() => undefined);
            }
            if (score > bestScoreRef.current) { bestScoreRef.current = score; }
            if (level > bestLevelRef.current) { bestLevelRef.current = level; }
            saveGameScore("unscramble-word", { bestScore: bestScoreRef.current, bestLevel: bestLevelRef.current });
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [gameState]);

  const triggerErrorShake = () => {
    setIsError(true);
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 40, useNativeDriver: true })
    ]).start(() => setIsError(false));
  };

  const handlePoolPress = (tile: LetterTile) => {
    if (tile.used) return;
    
    const newPool = scrambledPool.map(t => t.id === tile.id ? { ...t, used: true } : t);
    setScrambledPool(newPool);

    const newAnswers = [...answerSlots, { id: `ans_${answerSlots.length}`, char: tile.char, sourceId: tile.id }];
    setAnswerSlots(newAnswers);

    if (newAnswers.length === currentWord.length) {
      checkWin(newAnswers.map(a => a.char).join(""));
    }
  };

  const handleAnswerPress = (ansTile: AnswerTile, index: number) => {
    const newPool = scrambledPool.map(t => t.id === ansTile.sourceId ? { ...t, used: false } : t);
    setScrambledPool(newPool);

    const newAnswers = [...answerSlots];
    newAnswers.splice(index, 1);
    setAnswerSlots(newAnswers);
  };

  const checkWin = (attemptedWord: string) => {
    if (attemptedWord === currentWord) {
      const newLevel = level + 1;
      const basePoints = currentWord.length * 10;
      const comboMultiplier = 1 + (combo * 0.1);
      
      setScore(s => s + Math.floor(basePoints * comboMultiplier));
      setLevel(newLevel);
      setCombo(c => c + 1);
      
      const timeBonus = Math.max(2, currentWord.length - Math.floor(newLevel / 5));
      setTimeLeft(t => Math.min(t + timeBonus, 99));

      setTimeout(() => {
        setupNextWord(newLevel);
      }, 400);

    } else {
      triggerErrorShake();
      setCombo(0);
      Vibration.vibrate(100);
      
      setTimeout(() => {
        const newPool = scrambledPool.map(t => ({ ...t, used: false }));
        setScrambledPool(newPool);
        setAnswerSlots([]);
      }, 400);
    }
  };

  const confirmExit = () => {
    if (gameState === "PLAYING") {
      setShowExitPrompt(true);
      return;
    }
    router.replace("/wellness-tools");
  };

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <View style={styles.topBar}>
        <Text style={styles.topTitle}>Unscramble Word</Text>
      </View>

      <View style={[styles.contentFrame, { width: appWidth }]}>
        {gameState === "START" && (
          <View style={styles.centerContainer}>
            <Image source={COVER} style={styles.coverImage} resizeMode="contain" />
            <Text style={styles.overlayTitle}>Unscramble Word</Text>
            <Text style={styles.overlaySub}>Rebuild calming words before the time fades.</Text>
            
            <Pressable style={styles.btnPrimary} onPress={startGame}>
              <Text style={styles.btnPrimaryText}>Start Game</Text>
            </Pressable>
          </View>
        )}

        {gameState === "PLAYING" && (
          <View style={styles.gameWrapper}>
            <View style={styles.hud}>
              <View style={styles.hudRow}>
                <Text style={styles.scoreText}>SCORE: {score}</Text>
                <Text style={styles.levelText}>LEVEL: {level}</Text>
              </View>
              <View style={styles.timeBarContainer}>
                <View style={[styles.timeBarFill, { width: `${Math.min((timeLeft / INITIAL_TIME) * 100, 100)}%`, backgroundColor: timeLeft < 10 ? "#E76F51" : "#4A90E2" }]} />
                <Text style={styles.timeText}>{timeLeft}s</Text>
              </View>
              {combo > 1 && <Text style={styles.comboText}>COMBO x{combo}</Text>}
            </View>

            <View style={styles.gameArea}>
              <Text style={styles.instruction}>Tap letters to build the word</Text>

              <Animated.View style={[styles.answerContainer, { transform: [{ translateX: shakeAnim }] }]}>
                {Array.from({ length: currentWord.length }).map((_, i) => {
                  const ans = answerSlots[i];
                  return (
                    <Pressable
                      key={`slot_${i}`}
                      onPress={() => ans ? handleAnswerPress(ans, i) : null}
                      style={[styles.answerSlot, ans ? styles.answerSlotFilled : null, isError && styles.answerSlotError]}
                    >
                      <Text style={styles.answerText}>{ans ? ans.char : ""}</Text>
                    </Pressable>
                  );
                })}
              </Animated.View>

              <View style={styles.poolContainer}>
                {scrambledPool.map((tile) => (
                  <Pressable
                    key={tile.id}
                    onPress={() => handlePoolPress(tile)}
                    disabled={tile.used}
                    style={[styles.poolTile, tile.used && styles.poolTileUsed]}
                  >
                    <Text style={[styles.poolText, tile.used && styles.poolTextUsed]}>{tile.char}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
        )}

        {gameState === "GAMEOVER" && (
          <View style={styles.centerContainer}>
            <View style={styles.gameOverCard}>
              <Ionicons name="time-outline" size={48} color="#E76F51" style={{marginBottom: 12}} />
              <Text style={styles.goTitle}>Time&apos;s Up!</Text>
              <Text style={styles.goSub}>Your focus brought calm.</Text>
              
              <View style={styles.statsBox}>
                <View style={styles.statRow}><Text style={styles.statLabel}>Score (Best: {bestScoreRef.current})</Text><Text style={styles.statValue}>{score}</Text></View>
                <View style={styles.statRow}><Text style={styles.statLabel}>Words Rebuilt (Best: {bestLevelRef.current - 1})</Text><Text style={styles.statValue}>{level - 1}</Text></View>
                <View style={styles.statRow}><Text style={styles.statLabel}>Tala Earned</Text><Text style={styles.statValue}>{rewardTala}</Text></View>
              </View>

              <Pressable style={styles.btnPrimary} onPress={startGame}>
                <Text style={styles.btnPrimaryText}>Play Again</Text>
              </Pressable>
              <Pressable style={styles.btnSecondary} onPress={() => router.replace("/wellness-tools")}>
                <Text style={styles.btnSecondaryText}>Exit</Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>

      {showExitPrompt && (
        <View style={styles.exitOverlay}>
          <View style={styles.exitCard}>
            <Text style={styles.exitTitle}>Leave game?</Text>
            <Text style={styles.exitText}>Your current progress will be lost.</Text>
            <View style={styles.exitActions}>
              <Pressable style={styles.exitStay} onPress={() => setShowExitPrompt(false)}>
                <Text style={styles.exitStayText}>Stay</Text>
              </Pressable>
              <Pressable style={styles.exitLeave} onPress={() => router.replace("/wellness-tools")}>
                <Text style={styles.exitLeaveText}>Leave</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}

      <Pressable onPress={confirmExit} style={styles.backButton} accessibilityLabel="Leave Unscramble Word">
        <Ionicons name="chevron-back" size={28} color="#33475C" />
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F4F8F9" },
  contentFrame: { flex: 1, alignSelf: "center", position: "relative" },
  topBar: { height: 58, alignItems: "center", justifyContent: "center", borderBottomWidth: 1, borderBottomColor: "#E0E7DD", backgroundColor: "#FFFFFF", zIndex: 10 },
  topTitle: { color: "#33475C", fontSize: 18, fontFamily: "Outfit-Bold" },
  backButton: { position: "absolute", top: 8, left: 8, width: 50, height: 50, alignItems: "center", justifyContent: "center", zIndex: 9999, elevation: 9999, cursor: "pointer" },
  
  centerContainer: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20 },
  gameWrapper: { flex: 1 },

  hud: { padding: 16, backgroundColor: "#FFFFFF", borderBottomWidth: 1, borderBottomColor: "#E0E7DD", zIndex: 10 },
  hudRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12 },
  scoreText: { color: "#33475C", fontSize: 16, fontFamily: "Outfit-Bold" },
  levelText: { color: "#4A90E2", fontSize: 16, fontFamily: "Outfit-Bold" },
  timeBarContainer: { height: 18, backgroundColor: "#EAEFE8", borderRadius: 9, overflow: "hidden", position: "relative" },
  timeBarFill: { height: "100%", borderRadius: 9 },
  timeText: { position: "absolute", width: "100%", textAlign: "center", lineHeight: 18, fontSize: 12, color: "#FFFFFF", fontFamily: "Outfit-Bold", textShadowColor: "rgba(0,0,0,0.2)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  comboText: { position: "absolute", top: 12, left: "50%", transform: [{ translateX: -40 }], color: "#F4A261", fontSize: 14, fontFamily: "Outfit-Bold" },

  gameArea: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20 },
  instruction: { fontSize: 16, color: "#607181", fontFamily: "Outfit-Medium", marginBottom: 40 },
  
  answerContainer: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 10, marginBottom: 60 },
  answerSlot: { width: 46, height: 56, borderRadius: 12, backgroundColor: "rgba(0,0,0,0.04)", borderWidth: 2, borderColor: "rgba(0,0,0,0.08)", alignItems: "center", justifyContent: "center", borderStyle: "dashed" },
  answerSlotFilled: { backgroundColor: "#FFFFFF", borderColor: "#4A90E2", borderStyle: "solid", shadowColor: "#4A90E2", shadowOpacity: 0.2, shadowRadius: 4, elevation: 2 },
  answerSlotError: { borderColor: "#E76F51", backgroundColor: "#FDECE8" },
  answerText: { fontSize: 24, fontFamily: "Outfit-Bold", color: "#33475C" },

  poolContainer: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 12, width: "100%", paddingHorizontal: 10 },
  poolTile: { width: 50, height: 60, borderRadius: 14, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 5, elevation: 4, borderWidth: 1, borderColor: "#E0E7DD" },
  poolTileUsed: { backgroundColor: "rgba(0,0,0,0.04)", shadowOpacity: 0, elevation: 0, borderColor: "transparent" },
  poolText: { fontSize: 26, fontFamily: "Outfit-Bold", color: "#4A90E2" },
  poolTextUsed: { color: "transparent" },

  coverImage: { width: 150, height: 150, marginBottom: 24, borderRadius: 24 },
  overlayTitle: { fontSize: 32, fontFamily: "Outfit-Bold", color: "#33475C", marginBottom: 8 },
  overlaySub: { fontSize: 15, color: "#607181", marginBottom: 4, textAlign: "center", paddingHorizontal: 20 },
  
  gameOverCard: { width: "100%", maxWidth: 320, backgroundColor: "#FFFFFF", borderRadius: 24, padding: 24, alignItems: "center", shadowColor: "#8BA7B3", shadowOpacity: 0.2, shadowRadius: 15, elevation: 10 },
  goTitle: { fontSize: 26, fontFamily: "Outfit-Bold", color: "#E76F51", marginBottom: 6 },
  goSub: { fontSize: 15, color: "#607181", marginBottom: 24, textAlign: "center" },
  statsBox: { width: "100%", backgroundColor: "#F4F8F9", borderRadius: 16, padding: 16, marginBottom: 24, rowGap: 12 },
  statRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  statLabel: { fontSize: 13, color: "#546A7B" }, statValue: { fontSize: 16, fontFamily: "Outfit-Bold", color: "#33475C" },
  
  btnPrimary: { width: "100%", maxWidth: 280, backgroundColor: "#4A90E2", borderRadius: 14, paddingVertical: 16, alignItems: "center", marginTop: 24, shadowColor: "#4A90E2", shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  btnPrimaryText: { color: "#FFFFFF", fontSize: 16, fontFamily: "Outfit-Bold", letterSpacing: 0.5 },
  btnSecondary: { width: "100%", paddingVertical: 16, alignItems: "center" },
  btnSecondaryText: { color: "#546A7B", fontSize: 15, fontFamily: "Outfit-SemiBold" },

  exitOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center", zIndex: 10000 },
  exitCard: { backgroundColor: "#FFFFFF", padding: 24, borderRadius: 20, width: "80%", maxWidth: 320, alignItems: "center" },
  exitTitle: { fontSize: 22, fontFamily: "Outfit-Bold", color: "#33475C", marginBottom: 8 },
  exitText: { fontSize: 15, color: "#607181", textAlign: "center", marginBottom: 24 },
  exitActions: { flexDirection: "row", width: "100%", gap: 12 },
  exitStay: { flex: 1, backgroundColor: "#EAEFE8", paddingVertical: 14, borderRadius: 12, alignItems: "center" },
  exitStayText: { color: "#4D6558", fontSize: 16, fontFamily: "Outfit-Bold" },
  exitLeave: { flex: 1, backgroundColor: "#E76F51", paddingVertical: 14, borderRadius: 12, alignItems: "center" },
  exitLeaveText: { color: "#FFFFFF", fontSize: 16, fontFamily: "Outfit-Bold" },
});
