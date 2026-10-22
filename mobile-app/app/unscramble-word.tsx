import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
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
import { WORD_DESCRIPTIONS } from "../lib/word-descriptions";
import { getGameScore, saveGameScore } from "../lib/game-scores";

const COVER = require("../assets/images/Mini Reset/Unscramble Word/Unscramble Word Cover.webp");

type GameState = "START" | "PLAYING" | "PAUSED" | "GAMEOVER";

const INITIAL_TIME = 120;

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

function triggerHaptic(style = Haptics.ImpactFeedbackStyle.Light) {
  try {
    void Haptics.impactAsync(style);
  } catch {}
}

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

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const bestScoreRef = useRef(0);
  const bestLevelRef = useRef(0);
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    getGameScore("unscramble-word").then((data) => {
      if (data?.bestScore) bestScoreRef.current = data.bestScore;
      if (data?.bestLevel) bestLevelRef.current = data.bestLevel;
      forceUpdate((p) => p + 1);
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

    const pool: LetterTile[] = chars.map((c, idx) => ({
      id: `tile_${idx}_${c}_${Math.random()}`,
      char: c,
      used: false,
    }));

    setScrambledPool(pool);
    setAnswerSlots([]);
    setIsError(false);
  };

  const startGame = () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    setScore(0);
    setLevel(1);
    setTimeLeft(INITIAL_TIME);
    setCombo(0);
    setRewardTala(0);
    rewardClaimedRef.current = false;
    setupNextWord(1);
    setGameState("PLAYING");
  };

  useEffect(() => {
    if (gameState === "PLAYING") {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            handleGameOver();
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
  }, [gameState, score, level]);

  const handleGameOver = () => {
    setGameState("GAMEOVER");
    triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
    if (!rewardClaimedRef.current) {
      rewardClaimedRef.current = true;
      claimMiniResetReward({
        activityId: "unscramble-word",
        level: level,
        roundKey: "unscramble-word-" + Date.now(),
        score: score,
      })
        .then((reward) => setRewardTala(reward.rewardTala ?? 0))
        .catch(() => undefined);
    }

    const newBest = Math.max(score, bestScoreRef.current);
    const newHigh = Math.max(level, bestLevelRef.current);
    bestScoreRef.current = newBest;
    bestLevelRef.current = newHigh;
    saveGameScore("unscramble-word", { bestScore: newBest, bestLevel: newHigh });
  };

  const pauseGame = () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
    if (gameState === "PLAYING") {
      setGameState("PAUSED");
    }
  };

  const resumeGame = () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
    if (gameState === "PAUSED") {
      setGameState("PLAYING");
    }
  };

  const restartGame = () => {
    startGame();
  };

  const quitGame = () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
    router.replace("/wellness-tools");
  };

  const triggerErrorShake = () => {
    setIsError(true);
    triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start(() => {
      setTimeout(() => setIsError(false), 300);
    });
  };

  const handlePoolPress = (tile: LetterTile) => {
    if (tile.used || isError || answerSlots.length >= currentWord.length) return;
    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);

    const newPool = scrambledPool.map((t) => (t.id === tile.id ? { ...t, used: true } : t));
    const newSlot: AnswerTile = { id: `ans_${Math.random()}`, char: tile.char, sourceId: tile.id };
    const nextAnswers = [...answerSlots, newSlot];

    setScrambledPool(newPool);
    setAnswerSlots(nextAnswers);

    if (nextAnswers.length === currentWord.length) {
      checkWord(nextAnswers);
    }
  };

  const handleAnswerPress = (answer: AnswerTile, index: number) => {
    if (isError) return;
    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);

    const nextAnswers = answerSlots.filter((_, i) => i !== index);
    const newPool = scrambledPool.map((t) => (t.id === answer.sourceId ? { ...t, used: false } : t));

    setAnswerSlots(nextAnswers);
    setScrambledPool(newPool);
  };

  const checkWord = (answers: AnswerTile[]) => {
    const builtWord = answers.map((a) => a.char).join("");

    if (builtWord === currentWord) {
      triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
      const points = 10 * currentWord.length + combo * 5;
      setScore((prev) => prev + points);
      setCombo((prev) => prev + 1);

      setTimeLeft((prev) => Math.min(prev + 5, INITIAL_TIME));

      setTimeout(() => {
        setLevel((prev) => prev + 1);
        setupNextWord(level + 1);
      }, 450);
    } else {
      triggerErrorShake();
      setCombo(0);
      Vibration.vibrate(100);

      setTimeout(() => {
        const newPool = scrambledPool.map((t) => ({ ...t, used: false }));
        setScrambledPool(newPool);
        setAnswerSlots([]);
      }, 400);
    }
  };

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return mins > 0 ? `${mins}m ${rem < 10 ? "0" : ""}${rem}s` : `${rem}s`;
  };

  const handleHeaderBack = () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
    if (gameState === "PLAYING") {
      setGameState("PAUSED");
      setShowExitPrompt(true);
      return;
    }
    router.replace("/wellness-tools");
  };

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      {/* Apple-style Top Bar */}
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
          <Text style={styles.topTitle}>Unscramble Word</Text>
        </View>

        {gameState === "PLAYING" ? (
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

      <View style={[styles.contentFrame, { width: appWidth }]}>
        {/* START SCREEN */}
        {gameState === "START" && (
          <View style={styles.centerContainer}>
            <View style={styles.startCard}>
              <View style={styles.coverWrap}>
                <Image source={COVER} style={styles.coverImage} contentFit="contain" cachePolicy="memory-disk" />
              </View>
              <Text style={styles.modalTitle}>Unscramble Word</Text>
              <Text style={styles.modalDesc}>
                Untangle peaceful words before time fades. Build streaks to restore calm and earn
                Tala.
              </Text>

              <View style={styles.recordsBox}>
                <View style={styles.recordCol}>
                  <Text style={styles.recordColLabel}>BEST SCORE</Text>
                  <Text style={styles.recordColValue}>{bestScoreRef.current}</Text>
                </View>
                <View style={styles.recordDivider} />
                <View style={styles.recordCol}>
                  <Text style={styles.recordColLabel}>WORDS REBUILT</Text>
                  <Text style={styles.recordColValue}>
                    {Math.max(0, bestLevelRef.current - 1)}
                  </Text>
                </View>
              </View>

              <Pressable style={styles.primaryPill} onPress={startGame}>
                <Ionicons name="play" size={17} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.primaryPillText}>Start Game</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* PLAYING / PAUSED VIEW */}
        {(gameState === "PLAYING" || gameState === "PAUSED") && (
          <View style={styles.gameWrapper}>
            {/* Apple Floating Glass HUD */}
            <View style={styles.hudCard}>
              <View style={styles.hudTopRow}>
                <View style={styles.hudStatGroup}>
                  <Text style={styles.hudStatLabel}>SCORE</Text>
                  <Text style={styles.hudStatValue}>{score}</Text>
                </View>
                <View style={styles.hudLevelPill}>
                  <Text style={styles.hudLevelText}>WORD {level}</Text>
                </View>
                {combo > 1 ? (
                  <View style={styles.hudComboPill}>
                    <Ionicons name="flash" size={12} color="#D97706" />
                    <Text style={styles.hudComboText}>x{combo}</Text>
                  </View>
                ) : (
                  <View style={{ minWidth: 40 }} />
                )}
              </View>

              {/* Time Bar Track */}
              <View style={styles.timeTrack}>
                <View
                  style={[
                    styles.timeFill,
                    {
                      width: `${Math.min((timeLeft / INITIAL_TIME) * 100, 100)}%`,
                      backgroundColor: timeLeft < 20 ? "#EF4444" : timeLeft < 40 ? "#F59E0B" : "#52B72A",
                    },
                  ]}
                />
              </View>
              <View style={styles.timeLabelRow}>
                <Ionicons name="time-outline" size={11.5} color="#64748B" />
                <Text style={styles.timeLabelText}>{formatTime(timeLeft)}</Text>
              </View>
            </View>

            <View style={styles.gameArea}>
              {/* Word Meaning Inset */}
              <View style={styles.hintCard}>
                <View style={styles.hintHeader}>
                  <Ionicons name="sparkles" size={13} color="#52B72A" />
                  <Text style={styles.hintLabel}>WORD MEANING</Text>
                </View>
                <Text style={styles.hintText}>
                  {WORD_DESCRIPTIONS[currentWord] || "A mindful island word to restore calm."}
                </Text>
              </View>

              <Text style={styles.instruction}>Tap letters below to form the word</Text>

              {/* Answer Slots */}
              <Animated.View
                style={[styles.answerContainer, { transform: [{ translateX: shakeAnim }] }]}
              >
                {Array.from({ length: currentWord.length }).map((_, i) => {
                  const ans = answerSlots[i];
                  const isCorrectPosition = ans && ans.char === currentWord[i];
                  return (
                    <Pressable
                      key={`slot_${i}`}
                      onPress={() => (ans ? handleAnswerPress(ans, i) : null)}
                      style={[
                        styles.answerSlot,
                        ans ? styles.answerSlotFilled : null,
                        isCorrectPosition ? styles.answerSlotCorrect : null,
                        isError && styles.answerSlotError,
                      ]}
                    >
                      <Text
                        style={[
                          styles.answerText,
                          isCorrectPosition && styles.answerTextCorrect,
                          isError && styles.answerTextError,
                        ]}
                      >
                        {ans ? ans.char : ""}
                      </Text>
                    </Pressable>
                  );
                })}
              </Animated.View>

              {/* Pool Letter Tiles */}
              <View style={styles.poolContainer}>
                {scrambledPool.map((tile) => (
                  <Pressable
                    key={tile.id}
                    onPress={() => handlePoolPress(tile)}
                    disabled={tile.used}
                    style={[styles.poolTile, tile.used && styles.poolTileUsed]}
                  >
                    <Text style={[styles.poolText, tile.used && styles.poolTextUsed]}>
                      {tile.char}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
        )}

        {/* GAMEOVER SCREEN */}
        {gameState === "GAMEOVER" && (
          <View style={styles.centerContainer}>
            <View style={styles.modalCard}>
              <View style={styles.trophyIconWrap}>
                <Ionicons name="hourglass-outline" size={28} color="#D97706" />
              </View>
              <Text style={styles.modalTitle}>Time's Up!</Text>
              <Text style={styles.modalDesc}>Your mindful focus brought steadiness and calm.</Text>

              <View style={styles.statsCard}>
                <View style={styles.statRow}>
                  <Text style={styles.statLabel}>Final Score</Text>
                  <View style={styles.statValueRow}>
                    <Text style={styles.statValue}>{score}</Text>
                    {score >= bestScoreRef.current && score > 0 ? (
                      <View style={styles.bestBadge}>
                        <Text style={styles.bestBadgeText}>BEST</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
                <View style={styles.statRow}>
                  <Text style={styles.statLabel}>Words Rebuilt</Text>
                  <Text style={styles.statValue}>{level - 1}</Text>
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
      </View>

      {/* Unified Apple Pause Modal */}
      {gameState === "PAUSED" && !showExitPrompt && (
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

      {/* iOS Confirmation Sheet */}
      {showExitPrompt && (
        <View style={styles.overlay}>
          <View style={styles.exitCard}>
            <Text style={styles.exitTitle}>Leave Game?</Text>
            <Text style={styles.exitText}>Your current game progress will be lost.</Text>
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
  screen: { flex: 1, backgroundColor: "#F8FAF7" },
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
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0F172A",
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  titlePill: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#0F172A",
    shadowOpacity: 0.06,
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

  centerContainer: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20 },
  gameWrapper: { flex: 1, paddingHorizontal: 16, paddingTop: 6 },

  /* HUD */
  hudCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#E6ECE4",
    shadowColor: "#0F172A",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    marginBottom: 14,
  },
  hudTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  hudStatGroup: {
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
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "#EAF6E8",
  },
  hudLevelText: {
    color: "#2E7C1F",
    fontSize: 11,
    fontFamily: "Outfit-Bold",
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
    fontSize: 11,
    fontFamily: "Outfit-Bold",
  },
  timeTrack: {
    height: 7,
    backgroundColor: "#EEF3EC",
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
    color: "#64748B",
    fontSize: 11,
    fontFamily: "Outfit-Medium",
  },

  /* Game Playfield */
  gameArea: { flex: 1, alignItems: "center", justifyContent: "center", paddingBottom: 20 },
  instruction: {
    fontSize: 13,
    color: "#64748B",
    fontFamily: "Outfit-Medium",
    marginBottom: 24,
  },

  hintCard: {
    backgroundColor: "#F1F7EE",
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#DEEADC",
    width: "100%",
    alignItems: "center",
  },
  hintHeader: { flexDirection: "row", alignItems: "center", columnGap: 5, marginBottom: 3 },
  hintLabel: { color: "#3E7525", fontSize: 10.5, fontFamily: "Outfit-Bold", letterSpacing: 0.8 },
  hintText: {
    color: "#1E293B",
    fontSize: 13.5,
    fontFamily: "Outfit-Medium",
    textAlign: "center",
    lineHeight: 18,
  },

  answerContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    columnGap: 8,
    rowGap: 8,
    marginBottom: 36,
  },
  answerSlot: {
    width: 46,
    height: 56,
    borderRadius: 14,
    backgroundColor: "#F1F5F9",
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center",
    borderStyle: "dashed",
  },
  answerSlotFilled: {
    backgroundColor: "#FFFFFF",
    borderColor: "#52B72A",
    borderStyle: "solid",
    shadowColor: "#52B72A",
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  answerSlotCorrect: {
    borderColor: "#52B72A",
    backgroundColor: "#EAF6E8",
  },
  answerSlotError: {
    borderColor: "#EF4444",
    backgroundColor: "#FEF2F2",
  },
  answerText: { fontSize: 24, fontFamily: "Outfit-Bold", color: "#0F172A" },
  answerTextCorrect: { color: "#2E7C1F" },
  answerTextError: { color: "#DC2626" },

  poolContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    columnGap: 10,
    rowGap: 10,
    width: "100%",
  },
  poolTile: {
    width: 50,
    height: 60,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0F172A",
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  poolTileUsed: {
    backgroundColor: "transparent",
    shadowOpacity: 0,
    elevation: 0,
    borderColor: "transparent",
  },
  poolText: { fontSize: 24, fontFamily: "Outfit-Bold", color: "#0F172A" },
  poolTextUsed: { color: "transparent" },

  /* Overlays & Modals */
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.48)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 200,
    padding: 20,
  },
  startCard: {
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
