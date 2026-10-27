import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { claimMiniResetReward } from "../lib/backend-api";
import { getGameScore, saveGameScore } from "../lib/game-scores";
import { startBgmTrack, playSoundEffect, playGameOverSound, playCollectTalaSound, SOUND_ASSETS } from "../lib/sound-effects";

const ASSETS = [
  require("../assets/images/Mini Reset/Gentle Pairs/Muni_Dizzy.webp"),
  require("../assets/images/Mini Reset/Gentle Pairs/Muni_Eating.webp"),
  require("../assets/images/Mini Reset/Gentle Pairs/Muni_Jar.webp"),
  require("../assets/images/Mini Reset/Gentle Pairs/Muni_Thinking.webp"),
  require("../assets/images/Mini Reset/Gentle Pairs/Muni_Yawn.webp"),
];

const TEMP_COVER = require("../assets/images/Mini Reset/Gentle Pairs/Gentle Pairs Cover.webp");
const ROUND_TIME = 120;

type GameState = "START" | "PLAYING" | "PAUSED" | "GAMEOVER";

type Card = {
  id: string;
  imageId: number;
  pairId: number;
  isFlipped: boolean;
  isMatched: boolean;
};

function triggerHaptic(style = Haptics.ImpactFeedbackStyle.Light) {
  try {
    void Haptics.impactAsync(style);
  } catch {}
}

export default function GentlePairsScreen() {
  const { width: screenW, height: screenH } = useWindowDimensions();
  const appWidth = Math.min(screenW, 420);

  const [gameState, setGameState] = useState<GameState>("START");
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [round, setRound] = useState(1);
  const [moves, setMoves] = useState(0);
  const [timeLeft, setTimeLeft] = useState(ROUND_TIME);

  const [cards, setCards] = useState<Card[]>([]);
  const [flippedIndices, setFlippedIndices] = useState<number[]>([]);
  const [isLocked, setIsLocked] = useState(false);

  const [showExitPrompt, setShowExitPrompt] = useState(false);
  const [rewardTala, setRewardTala] = useState(0);
  // Looping Muni Games BGM
  useEffect(() => {
    if (gameState === "PLAYING") {
      const bgm = startBgmTrack(SOUND_ASSETS.muniGamesBgm, 0.22);
      return () => bgm.stop();
    }
  }, [gameState]);


  const rewardClaimedRef = useRef(false);

  const bestScoreRef = useRef(0);
  const bestRoundRef = useRef(0);
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    getGameScore("gentle-pairs").then((data) => {
      if (data?.bestScore) bestScoreRef.current = data.bestScore;
      if (data?.bestRound) bestRoundRef.current = data.bestRound;
      forceUpdate((p) => p + 1);
    });
  }, []);

  const generateDeck = (lvl: number) => {
    const pairCount = Math.min(ASSETS.length, 2 + Math.floor((lvl - 1) / 2));

    let deck: Card[] = [];
    for (let i = 0; i < pairCount; i++) {
      const imageId = i % ASSETS.length;
      deck.push({ id: `${i}_A`, imageId, pairId: i, isFlipped: false, isMatched: false });
      deck.push({ id: `${i}_B`, imageId, pairId: i, isFlipped: false, isMatched: false });
    }

    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }

    setCards(deck);
    setFlippedIndices([]);
    setIsLocked(false);
  };

  const startGame = () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    setGameState("PLAYING");
    setScore(0);
    setLevel(1);
    setRound(1);
    setMoves(0);
    setTimeLeft(ROUND_TIME);
    setRewardTala(0);
    rewardClaimedRef.current = false;
    generateDeck(1);
  };

  useEffect(() => {
    if (gameState !== "PLAYING") return;

    const timer = setInterval(() => {
      setTimeLeft((current) => {
        if (current <= 1) {
          setGameState("GAMEOVER");
          triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
          if (!rewardClaimedRef.current) {
            rewardClaimedRef.current = true;
            claimMiniResetReward({
              activityId: "gentle-pairs",
              level,
              roundKey: `gentle-pairs-${Date.now()}`,
              rounds: Math.max(0, round - 1),
              score,
            })
              .then((reward) => setRewardTala(reward.rewardTala ?? 0))
              .catch(() => undefined);
          }
          if (score > bestScoreRef.current) bestScoreRef.current = score;
          if (round > bestRoundRef.current) bestRoundRef.current = round;
          saveGameScore("gentle-pairs", {
            bestScore: bestScoreRef.current,
            bestRound: bestRoundRef.current,
          });
          return 0;
        }
        return current - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gameState, round]);

  const handleCardPress = (index: number) => {
    if (isLocked || gameState !== "PLAYING" || cards[index].isFlipped || cards[index].isMatched)
      return;

    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
    setMoves((m) => m + 1);

    const newCards = [...cards];
    newCards[index].isFlipped = true;
    setCards(newCards);

    const newFlipped = [...flippedIndices, index];
    setFlippedIndices(newFlipped);

    if (newFlipped.length === 2) {
      setIsLocked(true);
      const [firstIdx, secondIdx] = newFlipped;

      if (newCards[firstIdx].pairId === newCards[secondIdx].pairId) {
        setTimeout(() => {
          triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
          setCards((prev) => {
            const matchedCards = [...prev];
            matchedCards[firstIdx].isMatched = true;
            matchedCards[secondIdx].isMatched = true;
            return matchedCards;
          });
          setScore((s) => s + 10 * level);
          setTimeLeft((t) => Math.min(ROUND_TIME, t + 6));
          setFlippedIndices([]);
          setIsLocked(false);
          checkLevelComplete(newCards, firstIdx, secondIdx);
        }, 350);
      } else {
        setTimeout(() => {
          setCards((prev) => {
            const flippedBack = [...prev];
            flippedBack[firstIdx].isFlipped = false;
            flippedBack[secondIdx].isFlipped = false;
            return flippedBack;
          });
          setFlippedIndices([]);
          setIsLocked(false);
        }, 750);
      }
    }
  };

  const checkLevelComplete = (currentCards: Card[], idx1: number, idx2: number) => {
    const isComplete = currentCards.every((c, i) => c.isMatched || i === idx1 || i === idx2);
    if (isComplete) {
      setTimeout(() => {
        triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
        setLevel((l) => {
          const nextLvl = l + 1;
          setRound((r) => r + 1);
          setMoves(0);
          setTimeLeft(ROUND_TIME);
          generateDeck(nextLvl);
          return nextLvl;
        });
      }, 500);
    }
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

  const getGridMetrics = () => {
    const totalCards = cards.length || 4;
    const columns = totalCards <= 4 ? 2 : totalCards <= 6 ? 3 : 4;
    const gap = 10;
    const gridWidth = appWidth - 32;
    const cardWidth = (gridWidth - (columns - 1) * gap) / columns;
    const rows = Math.ceil(totalCards / columns);
    const availableHeight = Math.max(120, screenH - 260);
    const cardHeight = Math.min(cardWidth * 1.12, (availableHeight - (rows - 1) * gap) / rows);
    return { columns, gap, gridWidth, width: cardWidth, height: Math.max(62, cardHeight) };
  };

  const gridMetrics = getGridMetrics();

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
          <Text style={styles.topTitle}>Gentle Pairs</Text>
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
                <Image source={TEMP_COVER} style={styles.coverImage} contentFit="contain" cachePolicy="memory-disk" />
              </View>
              <Text style={styles.modalTitle}>Gentle Pairs</Text>
              <Text style={styles.modalDesc}>
                Find the matching Muni moments at your own comfortable pace. Match all pairs to advance!
              </Text>

              <View style={styles.recordsBox}>
                <View style={styles.recordCol}>
                  <Text style={styles.recordColLabel}>BEST SCORE</Text>
                  <Text style={styles.recordColValue}>{bestScoreRef.current}</Text>
                </View>
                <View style={styles.recordDivider} />
                <View style={styles.recordCol}>
                  <Text style={styles.recordColLabel}>TOP ROUND</Text>
                  <Text style={styles.recordColValue}>
                    {Math.max(0, bestRoundRef.current - 1)}
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
                <View style={styles.hudRoundPill}>
                  <Text style={styles.hudRoundText}>ROUND {round}</Text>
                </View>
                <View style={styles.hudMovesGroup}>
                  <Text style={styles.hudStatLabel}>MOVES</Text>
                  <Text style={styles.hudMovesValue}>{moves}</Text>
                </View>
              </View>

              {/* Time Track */}
              <View style={styles.timeTrack}>
                <View
                  style={[
                    styles.timeFill,
                    {
                      width: `${(timeLeft / ROUND_TIME) * 100}%`,
                      backgroundColor: timeLeft <= 15 ? "#EF4444" : timeLeft <= 35 ? "#F59E0B" : "#52B72A",
                    },
                  ]}
                />
              </View>
              <View style={styles.timeLabelRow}>
                <Ionicons name="time-outline" size={11.5} color="#64748B" />
                <Text style={styles.timeLabelText}>{formatTime(timeLeft)}</Text>
              </View>
            </View>

            {/* Card Grid Area */}
            <View style={styles.gameArea}>
              <View
                style={[
                  styles.grid,
                  { width: gridMetrics.gridWidth, rowGap: gridMetrics.gap, columnGap: gridMetrics.gap },
                ]}
              >
                {cards.map((card, index) => (
                  <Pressable
                    key={card.id}
                    onPress={() => handleCardPress(index)}
                    accessibilityLabel={
                      card.isFlipped || card.isMatched ? "Revealed Muni card" : "Reveal Muni card"
                    }
                    style={[
                      styles.card,
                      { width: gridMetrics.width, height: gridMetrics.height },
                      card.isMatched && styles.cardMatched,
                    ]}
                  >
                    {card.isFlipped || card.isMatched ? (
                      <View style={styles.cardFront}>
                        <Image
                          source={ASSETS[card.imageId]}
                          style={styles.cardImage}
                          contentFit="contain"
                          cachePolicy="memory-disk"
                        />
                      </View>
                    ) : (
                      <View style={styles.cardBack}>
                        <Ionicons name="sparkles" size={20} color="#6EA866" />
                      </View>
                    )}
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
                <Ionicons name="leaf-outline" size={28} color="#D97706" />
              </View>
              <Text style={styles.modalTitle}>A Gentle Pause</Text>
              <Text style={styles.modalDesc}>
                The round timer ran out. Your memory trail and calm focus remain with you.
              </Text>

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
                  <Text style={styles.statLabel}>Rounds Completed</Text>
                  <Text style={styles.statValue}>{Math.max(0, round - 1)}</Text>
                </View>
                <View style={styles.statRow}>
                  <Text style={styles.statLabel}>Total Moves</Text>
                  <Text style={styles.statValue}>{moves}</Text>
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
  hudRoundPill: {
    paddingHorizontal: 10,
    paddingVertical: 3.5,
    borderRadius: 999,
    backgroundColor: "#EAF6E8",
  },
  hudRoundText: {
    color: "#2E7C1F",
    fontSize: 11,
    fontFamily: "Outfit-Bold",
  },
  hudMovesGroup: {
    flexDirection: "row",
    alignItems: "baseline",
    columnGap: 5,
  },
  hudMovesValue: {
    color: "#334155",
    fontSize: 15,
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

  /* Grid Area */
  gameArea: { flex: 1, alignItems: "center", justifyContent: "center" },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
  },
  card: {
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    shadowColor: "#0F172A",
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
    overflow: "hidden",
  },
  cardMatched: {
    borderColor: "#52B72A",
    borderWidth: 2,
    backgroundColor: "#F2FAF0",
    shadowColor: "#52B72A",
    shadowOpacity: 0.2,
  },
  cardFront: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    padding: 6,
  },
  cardBack: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EAF6E8",
  },
  cardImage: { width: "90%", height: "90%" },

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
