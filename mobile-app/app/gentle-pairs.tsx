import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
    
    Pressable,
    StyleSheet,
    Text,
    View,
    useWindowDimensions} from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { claimMiniResetReward } from "../lib/backend-api";
import { getGameScore, saveGameScore } from "../lib/game-scores";

const ASSETS = [
  require("../assets/images/Mini Reset/Gentle Pairs/Muni_Dizzy.webp"),
  require("../assets/images/Mini Reset/Gentle Pairs/Muni_Eating.webp"),
  require("../assets/images/Mini Reset/Gentle Pairs/Muni_Jar.webp"),
  require("../assets/images/Mini Reset/Gentle Pairs/Muni_Thinking.webp"),
  require("../assets/images/Mini Reset/Gentle Pairs/Muni_Yawn.webp"),
];

const TEMP_COVER = require("../assets/images/Mini Reset/Gentle Pairs/Gentle Pairs Cover.webp"); 
const ROUND_TIME = 60;

type GameState = "START" | "PLAYING" | "GAMEOVER";

type Card = {
  id: string;
  imageId: number;
  pairId: number;
  isFlipped: boolean;
  isMatched: boolean;
};

export default function GentlePairsScreen() {
  const { width: screenW, height: screenH } = useWindowDimensions();
  // Constrain width for desktop web
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
  const rewardClaimedRef = useRef(false);
  
  const bestScoreRef = useRef(0);
  const bestRoundRef = useRef(0);
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    getGameScore("gentle-pairs").then((data) => {
      if (data?.bestScore) bestScoreRef.current = data.bestScore;
      if (data?.bestRound) bestRoundRef.current = data.bestRound;
      forceUpdate(p => p + 1);
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
          if (!rewardClaimedRef.current) {
            rewardClaimedRef.current = true;
            claimMiniResetReward({ activityId: "gentle-pairs", level, roundKey: `gentle-pairs-${Date.now()}`, rounds: Math.max(0, round - 1), score })
              .then((reward) => setRewardTala(reward.rewardTala ?? 0))
              .catch(() => undefined);
          }
          if (score > bestScoreRef.current) bestScoreRef.current = score;
          if (round > bestRoundRef.current) bestRoundRef.current = round;
          saveGameScore("gentle-pairs", { bestScore: bestScoreRef.current, bestRound: bestRoundRef.current });
          return 0;
        }
        return current - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gameState, round]);

  const handleCardPress = (index: number) => {
    if (isLocked || cards[index].isFlipped || cards[index].isMatched) return;

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
          setCards((prev) => {
            const matchedCards = [...prev];
            matchedCards[firstIdx].isMatched = true;
            matchedCards[secondIdx].isMatched = true;
            return matchedCards;
          });
          setScore((s) => s + 10 * level);
          setFlippedIndices([]);
          setIsLocked(false);
          checkLevelComplete(newCards, firstIdx, secondIdx);
        }, 400);
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
        }, 800);
      }
    }
  };

  const checkLevelComplete = (currentCards: Card[], idx1: number, idx2: number) => {
    const isComplete = currentCards.every((c, i) => c.isMatched || i === idx1 || i === idx2);
    if (isComplete) {
      setTimeout(() => {
        setLevel((l) => {
          const nextLvl = l + 1;
          setRound((r) => r + 1);
          setMoves(0);
          setTimeLeft(ROUND_TIME);
          generateDeck(nextLvl);
          return nextLvl;
        });
      }, 600);
    }
  };

  const confirmExit = () => {
    setShowExitPrompt(true);
  };

  const leaveGame = () => {
    setShowExitPrompt(false);
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
      <View style={styles.topBar}>
        <Pressable onPress={confirmExit} style={styles.backButton} accessibilityLabel="Leave Gentle Pairs">
          <Ionicons name="chevron-back" size={28} color="#33475C" />
        </Pressable>
        <Text style={styles.topTitle}>Gentle Pairs</Text>
        <View style={styles.topBarSpacer} />
      </View>

      <View style={[styles.contentFrame, { width: appWidth }]}>
        {gameState === "START" && (
          <View style={styles.centerContainer}>
            <Image source={TEMP_COVER} style={styles.coverImage} contentFit="contain" />
            <Text style={styles.overlayTitle}>Gentle Pairs</Text>
            <Text style={styles.overlaySub}>Find the matching Muni moments.</Text>
            <Text style={styles.overlaySub}>Find every pair, then keep going.</Text>
            
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
              <View style={styles.progressRow}>
                <Text style={styles.progressText}>ROUND {round}</Text>
                <Text style={styles.progressText}>PAIRS {cards.length / 2}</Text>
                <Text style={styles.progressText}>MOVES {moves}</Text>
              </View>
              <View style={styles.timerTrack}>
                <View style={[styles.timerFill, { width: `${(timeLeft / ROUND_TIME) * 100}%`, backgroundColor: timeLeft <= 10 ? "#D9685C" : "#35A99A" }]} />
                <Text style={styles.timerText}>{timeLeft}s</Text>
              </View>
            </View>

            <View style={styles.gameArea}>
              <View style={[styles.grid, { width: gridMetrics.gridWidth, gap: gridMetrics.gap }]}>
                {cards.map((card, index) => (
                  <Pressable
                    key={card.id}
                    onPress={() => handleCardPress(index)}
                    accessibilityLabel={card.isFlipped || card.isMatched ? "Revealed Muni card" : "Reveal Muni card"}
                    style={[
                      styles.card,
                      { width: gridMetrics.width, height: gridMetrics.height },
                      card.isMatched && styles.cardMatched
                    ]}
                  >
                    {card.isFlipped || card.isMatched ? (
                      <View style={styles.cardFront}>
                        <Image source={ASSETS[card.imageId]} style={styles.cardImage} contentFit="contain" />
                      </View>
                    ) : (
                      <View style={styles.cardBack}>
                        <Ionicons name="sparkles" size={24} color="#C5D3C1" />
                      </View>
                    )}
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
        )}

        {gameState === "GAMEOVER" && (
          <View style={styles.centerContainer}>
            <View style={styles.gameOverCard}>
              <Image source={TEMP_COVER} style={styles.gameOverImage} contentFit="contain" />
              <Text style={styles.goTitle}>A gentle pause</Text>
              <Text style={styles.goSub}>The round timer ran out. Your memory trail is still here.</Text>
              <View style={styles.statsBox}>
                <View style={styles.statRow}><Text style={styles.statLabel}>Score (Best: {bestScoreRef.current})</Text><Text style={styles.statValue}>{score}</Text></View>
                <View style={styles.statRow}><Text style={styles.statLabel}>Rounds (Best: {Math.max(0, bestRoundRef.current - 1)})</Text><Text style={styles.statValue}>{Math.max(0, round - 1)}</Text></View>
                <View style={styles.statRow}><Text style={styles.statLabel}>Tala Earned</Text><Text style={styles.statValue}>{rewardTala}</Text></View>
              </View>
              <Pressable style={styles.btnPrimary} onPress={startGame}><Text style={styles.btnPrimaryText}>Start Again</Text></Pressable>
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
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F7FAF5" },
  contentFrame: { flex: 1, alignSelf: "center", width: "100%", maxWidth: 420 },
  topBar: { height: 58, alignItems: "center", justifyContent: "center", borderBottomWidth: 1, borderBottomColor: "#E0E7DD", backgroundColor: "rgba(250, 252, 249, 0.98)", zIndex: 10 },
  topTitle: { color: "#33475C", fontSize: 18, fontFamily: "Outfit-Bold" },
  topBarSpacer: { width: 50, height: 50 },
  backButton: { position: "absolute", top: 8, left: 8, width: 50, height: 50, alignItems: "center", justifyContent: "center", zIndex: 9999, elevation: 9999 },
  
  centerContainer: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20 },
  gameWrapper: { flex: 1 },

  hud: { padding: 16, backgroundColor: "#FFFFFF", borderBottomWidth: 1, borderBottomColor: "#E0E7DD" },
  hudRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  scoreText: { color: "#33475C", fontSize: 16, fontFamily: "Outfit-Bold" },
  levelText: { color: "#4F8A38", fontSize: 16, fontFamily: "Outfit-Bold" },
  progressRow: { flexDirection: "row", justifyContent: "space-between", paddingTop: 2 },
  progressText: { color: "#718078", fontSize: 11, fontFamily: "Outfit-Bold", letterSpacing: 0.5 },
  timerTrack: { height: 20, marginTop: 14, backgroundColor: "#E8EFEB", borderRadius: 10, overflow: "hidden", justifyContent: "center" },
  timerFill: { ...StyleSheet.absoluteFillObject, borderRadius: 10 },
  timerText: { textAlign: "center", color: "#FFFFFF", fontSize: 11, fontFamily: "Outfit-Bold", textShadowColor: "rgba(0,0,0,0.22)", textShadowRadius: 2 },

  gameArea: { flex: 1, alignItems: "center", justifyContent: "center", padding: 16 },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", alignItems: "center" },
  
  card: { borderRadius: 16, backgroundColor: "#FFFFFF", shadowColor: "#5D7B6A", shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  cardMatched: { opacity: 0.62 },
  cardFront: { flex: 1, borderRadius: 16, backgroundColor: "#FFFDF7", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#D5E7C8", overflow: "hidden" },
  cardBack: { flex: 1, borderRadius: 16, backgroundColor: "#DCEEE5", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#B7D9C9", overflow: "hidden" },
  cardImage: { width: "70%", height: "70%" },

  coverImage: { width: 140, height: 140, marginBottom: 20, borderRadius: 20 },
  overlayTitle: { fontSize: 32, fontFamily: "Outfit-Bold", color: "#33475C", marginBottom: 8 },
  overlaySub: { fontSize: 15, color: "#607181", marginBottom: 4 },
  
  gameOverCard: { width: "100%", maxWidth: 320, backgroundColor: "#FFFFFF", borderRadius: 24, padding: 24, alignItems: "center", shadowColor: "#8BA7B3", shadowOpacity: 0.2, shadowRadius: 15, elevation: 10 },
  gameOverImage: { width: 96, height: 96, marginBottom: 8 },
  goTitle: { fontSize: 24, fontFamily: "Outfit-Bold", color: "#E76F51", marginBottom: 6 },
  goSub: { fontSize: 14, color: "#607181", marginBottom: 20, textAlign: "center" },
  statsBox: { width: "100%", backgroundColor: "#F4F8F9", borderRadius: 16, padding: 16, marginBottom: 24, rowGap: 12 },
  statRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  statLabel: { fontSize: 13, color: "#546A7B" }, statValue: { fontSize: 15, fontFamily: "Outfit-Bold", color: "#33475C" },
  
  btnPrimary: { width: "100%", maxWidth: 280, backgroundColor: "#4F8A38", borderRadius: 14, paddingVertical: 16, alignItems: "center", marginTop: 20 },
  btnPrimaryText: { color: "#FFFFFF", fontSize: 16, fontFamily: "Outfit-Bold" },
  btnSecondary: { width: "100%", paddingVertical: 14, alignItems: "center" },
  btnSecondaryText: { color: "#546A7B", fontSize: 15, fontFamily: "Outfit-SemiBold" },
  exitOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(20, 31, 40, 0.5)", justifyContent: "center", alignItems: "center", zIndex: 10000, elevation: 10000 },
  exitCard: { width: 290, backgroundColor: "#FFFFFF", padding: 24, borderRadius: 20, shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 18, elevation: 12 },
  exitTitle: { color: "#33475C", fontSize: 21, fontFamily: "Outfit-Bold", marginBottom: 8 },
  exitText: { color: "#5D6678", fontSize: 14, lineHeight: 20, marginBottom: 20 },
  exitActions: { flexDirection: "row", gap: 10, justifyContent: "flex-end" },
  exitStay: { paddingHorizontal: 16, paddingVertical: 11, borderRadius: 12, backgroundColor: "#E6ECF1" },
  exitStayText: { color: "#33475C", fontFamily: "Outfit-Bold" },
  exitLeave: { paddingHorizontal: 16, paddingVertical: 11, borderRadius: 12, backgroundColor: "#B75252" },
  exitLeaveText: { color: "#FFFFFF", fontFamily: "Outfit-Bold" }});
