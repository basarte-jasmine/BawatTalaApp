import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
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
import { getGameScore, saveGameScore } from "../lib/game-scores";

const ASSETS = {
  orig: require("../assets/images/Mini Reset/Muni Match/Orig.webp"),
  blue: require("../assets/images/Mini Reset/Muni Match/Blue.webp"),
  purple: require("../assets/images/Mini Reset/Muni Match/Purple.webp"),
  red: require("../assets/images/Mini Reset/Muni Match/Red.webp"),
  cover: require("../assets/images/Mini Reset/Muni Match/cover.webp"),
  coin: require("../assets/images/Tala_Star.png"),
};

type MuniColor = "orig" | "blue" | "purple" | "red";
type GameState = "START" | "PLAYING" | "PAUSED" | "GAMEOVER";

type Tile = {
  id: string;
  color: MuniColor;
};

type Popup = {
  id: string;
  text: string;
  x: number;
  y: number;
  color: string;
};

const ROWS = 8;
const COLS = 7;
const GAME_DURATION = 90; // 90 seconds
const TARGET_SCORE = 300; // Target score
const TARGET_BONUS_COINS = 10;
const COLOR_KEYS: MuniColor[] = ["orig", "blue", "purple", "red"];

function createTile(): Tile {
  return {
    id: `tile_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    color: COLOR_KEYS[Math.floor(Math.random() * COLOR_KEYS.length)],
  };
}

function findConnectedGroup(board: (Tile | null)[][], startR: number, startC: number): { r: number; c: number }[] {
  const targetTile = board[startR][startC];
  if (!targetTile) return [];
  const targetColor = targetTile.color;

  const visited = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
  const queue: { r: number; c: number }[] = [{ r: startR, c: startC }];
  visited[startR][startC] = true;
  const group: { r: number; c: number }[] = [];

  while (queue.length > 0) {
    const current = queue.shift()!;
    group.push(current);

    const neighbors = [
      { r: current.r - 1, c: current.c },
      { r: current.r + 1, c: current.c },
      { r: current.r, c: current.c - 1 },
      { r: current.r, c: current.c + 1 },
    ];

    for (const { r, c } of neighbors) {
      if (r >= 0 && r < ROWS && c >= 0 && c < COLS) {
        if (!visited[r][c] && board[r][c]?.color === targetColor) {
          visited[r][c] = true;
          queue.push({ r, c });
        }
      }
    }
  }

  return group;
}

function hasAnyValidMatch(board: (Tile | null)[][]): boolean {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (board[r][c]) {
        const group = findConnectedGroup(board, r, c);
        if (group.length >= 3) return true;
      }
    }
  }
  return false;
}

function generatePlayableBoard(): Tile[][] {
  let board: Tile[][];
  let attempts = 0;
  do {
    board = [];
    for (let r = 0; r < ROWS; r++) {
      const row: Tile[] = [];
      for (let c = 0; c < COLS; c++) {
        row.push(createTile());
      }
      board.push(row);
    }
    attempts++;
  } while (!hasAnyValidMatch(board) && attempts < 20);

  return board;
}

export default function MuniMatchScreen() {
  const { width: screenW } = useWindowDimensions();
  const appWidth = Math.min(screenW, 430);
  const GRID_PADDING = 12;
  const GAP = 4;
  const availableW = appWidth - GRID_PADDING * 2;
  const tileSize = Math.floor((availableW - (COLS - 1) * GAP) / COLS);

  const [gameState, setGameState] = useState<GameState>("START");
  const [score, setScore] = useState(0);
  const [coins, setCoins] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [targetBonusGranted, setTargetBonusGranted] = useState(false);
  const [rewardTala, setRewardTala] = useState(0);
  const [popups, setPopups] = useState<Popup[]>([]);
  const [board, setBoard] = useState<Tile[][]>([]);
  const [wobbleCoord, setWobbleCoord] = useState<{ r: number; c: number } | null>(null);

  const bestScoreRef = useRef(0);
  const bestCoinsRef = useRef(0);
  const [, forceUpdate] = useState(0);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rewardClaimedRef = useRef(false);

  useEffect(() => {
    getGameScore("muni-match").then((data) => {
      if (data?.bestScore) bestScoreRef.current = data.bestScore;
      if (data?.bestCoins) bestCoinsRef.current = data.bestCoins;
      forceUpdate((p) => p + 1);
    });
  }, []);

  const finishGame = useCallback((finalScore: number, finalCoins: number, reachedTarget: boolean) => {
    setGameState("GAMEOVER");
    if (timerRef.current) clearInterval(timerRef.current);

    const bonus = reachedTarget ? TARGET_BONUS_COINS : 0;
    const totalTala = finalCoins + bonus;

    if (!rewardClaimedRef.current) {
      rewardClaimedRef.current = true;
      claimMiniResetReward({
        activityId: "muni-match",
        level: 1,
        roundKey: `muni-match-${Date.now()}`,
        score: totalTala,
      })
        .then((reward) => setRewardTala(reward.rewardTala ?? 0))
        .catch(() => undefined);
    }

    if (finalScore > bestScoreRef.current) bestScoreRef.current = finalScore;
    if (totalTala > bestCoinsRef.current) bestCoinsRef.current = totalTala;
    saveGameScore("muni-match", {
      bestScore: bestScoreRef.current,
      bestCoins: bestCoinsRef.current,
    });
  }, []);

  const startGame = () => {
    const newBoard = generatePlayableBoard();
    setBoard(newBoard);
    setScore(0);
    setCoins(0);
    setTimeLeft(GAME_DURATION);
    setTargetBonusGranted(false);
    setRewardTala(0);
    setPopups([]);
    setWobbleCoord(null);
    rewardClaimedRef.current = false;
    setGameState("PLAYING");
  };

  const pauseGame = () => {
    if (gameState === "PLAYING") {
      setGameState("PAUSED");
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const resumeGame = () => {
    if (gameState === "PAUSED") {
      setGameState("PLAYING");
    }
  };

  const restartGame = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    startGame();
  };

  const quitGame = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    router.replace("/wellness-tools");
  };

  // 90-second countdown timer
  useEffect(() => {
    if (gameState === "PLAYING") {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            finishGame(score, coins, targetBonusGranted);
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
  }, [gameState, score, coins, targetBonusGranted, finishGame]);

  // Clean popups
  useEffect(() => {
    if (popups.length > 0) {
      const t = setTimeout(() => {
        setPopups((prev) => prev.slice(1));
      }, 800);
      return () => clearTimeout(t);
    }
  }, [popups]);

  // Tile Tap Handler
  const handleTilePress = (r: number, c: number, pageX: number, pageY: number) => {
    if (gameState !== "PLAYING") return;
    if (!board[r] || !board[r][c]) return;

    const group = findConnectedGroup(board, r, c);

    if (group.length < 3) {
      // Need at least 3!
      setWobbleCoord({ r, c });
      setTimeout(() => setWobbleCoord(null), 300);
      Vibration.vibrate(40);
      return;
    }

    // Match 3 or more!
    Vibration.vibrate(60);
    const count = group.length;

    // Coins:
    // 3 munis = 1 coin, 4 munis = 2 coins, 5+ munis = 3 coins
    let earnedCoins = 1;
    if (count === 4) earnedCoins = 2;
    else if (count >= 5) earnedCoins = 3;

    // Score points:
    let earnedPoints = 30;
    if (count === 4) earnedPoints = 50;
    else if (count >= 5) earnedPoints = 80 + (count - 5) * 20;

    const newScore = score + earnedPoints;
    setScore(newScore);

    let nextTargetGranted = targetBonusGranted;
    let extraBonusCoins = 0;

    // Target score bonus (+10 coins once upon reaching 300 points)
    if (!targetBonusGranted && newScore >= TARGET_SCORE) {
      nextTargetGranted = true;
      setTargetBonusGranted(true);
      extraBonusCoins = TARGET_BONUS_COINS;
      setPopups((prev) => [
        ...prev,
        {
          id: `popup_target_${Date.now()}`,
          text: "+10 Target Bonus!",
          x: pageX - 60,
          y: pageY - 40,
          color: "#4F8A38",
        },
      ]);
    }

    const nextCoins = coins + earnedCoins + extraBonusCoins;
    setCoins(nextCoins);

    setPopups((prev) => [
      ...prev,
      {
        id: `popup_${Date.now()}_${Math.random()}`,
        text: `+${earnedCoins} Tala`,
        x: pageX - 30,
        y: pageY - 10,
        color: "#F5C447",
      },
    ]);

    // Apply Gravity and Refill Columns
    const newBoard = board.map((row) => [...row]);
    // 1. Clear matched
    for (const pos of group) {
      newBoard[pos.r][pos.c] = null as any;
    }

    // 2. Drop and refill per column
    for (let col = 0; col < COLS; col++) {
      const remaining: Tile[] = [];
      for (let row = ROWS - 1; row >= 0; row--) {
        if (newBoard[row][col] !== null) {
          remaining.push(newBoard[row][col]);
        }
      }
      for (let row = ROWS - 1; row >= 0; row--) {
        if (remaining.length > 0) {
          newBoard[row][col] = remaining.shift()!;
        } else {
          newBoard[row][col] = createTile();
        }
      }
    }

    // 3. Ensure board has playable moves, otherwise shuffle
    if (!hasAnyValidMatch(newBoard)) {
      setBoard(generatePlayableBoard());
    } else {
      setBoard(newBoard);
    }
  };

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return mins > 0 ? `${mins}m ${rem < 10 ? "0" : ""}${rem}s` : `${rem}s`;
  };

  const targetProgress = Math.min(Math.max((score / TARGET_SCORE) * 100, 0), 100);

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      {/* Top Header */}
      <View style={styles.topBar}>
        <Pressable
          onPress={() => {
            if (gameState === "PLAYING") pauseGame();
            else quitGame();
          }}
          style={styles.backButton}
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={26} color="#33475C" />
        </Pressable>
        <Text style={styles.topTitle}>Muni Match</Text>
        {gameState === "PLAYING" ? (
          <Pressable onPress={pauseGame} style={styles.pauseButton} accessibilityLabel="Pause Game">
            <Ionicons name="pause-circle-outline" size={26} color="#33475C" />
          </Pressable>
        ) : (
          <View style={styles.pausePlaceholder} />
        )}
      </View>

      <View style={[styles.contentFrame, { width: appWidth }]}>
        {/* START SCREEN */}
        {gameState === "START" && (
          <View style={styles.centerContainer}>
            <Image source={ASSETS.cover} style={styles.coverImage} contentFit="contain" />
            <Text style={styles.overlayTitle}>Muni Match</Text>
            <Text style={styles.overlaySub}>
              Match 3 or more connected Munis of the same color. Reach the 300-point target for a 10 Tala bonus!
            </Text>

            <View style={styles.recordsPill}>
              <View style={styles.recordItem}>
                <Text style={styles.recordLabel}>Best Score</Text>
                <Text style={styles.recordValue}>{bestScoreRef.current}</Text>
              </View>
              <View style={styles.recordDivider} />
              <View style={styles.recordItem}>
                <Text style={styles.recordLabel}>Best Tala</Text>
                <Text style={styles.recordValue}>{bestCoinsRef.current}</Text>
              </View>
            </View>

            <Pressable style={styles.btnPrimary} onPress={startGame}>
              <Ionicons name="sparkles" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.btnPrimaryText}>Start Match</Text>
            </Pressable>
          </View>
        )}

        {/* PLAYING / PAUSED VIEW */}
        {(gameState === "PLAYING" || gameState === "PAUSED") && (
          <View style={styles.gameWrapper}>
            {/* HUD */}
            <View style={styles.hud}>
              <View style={styles.hudRow}>
                {/* Score & Target */}
                <View style={styles.scoreContainer}>
                  <Text style={styles.scoreText}>SCORE: {score}</Text>
                  <View style={styles.targetRow}>
                    <Text style={styles.targetLabel}>TARGET {TARGET_SCORE}</Text>
                    {targetBonusGranted && (
                      <View style={styles.targetTag}>
                        <Text style={styles.targetTagText}>✓ +10 BONUS</Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* Tala Coins Counter */}
                <View style={styles.coinBadge}>
                  <Image source={ASSETS.coin} style={styles.coinIcon} contentFit="contain" />
                  <Text style={styles.coinCount}>+{coins}</Text>
                </View>
              </View>

              {/* Target Progress Bar */}
              <View style={styles.targetProgressBar}>
                <View style={[styles.targetProgressFill, { width: `${targetProgress}%` }]} />
              </View>

              {/* 90s Relaxing Bar Timer */}
              <View style={styles.timeBarContainer}>
                <View
                  style={[
                    styles.timeBarFill,
                    {
                      width: `${Math.min(Math.max((timeLeft / GAME_DURATION) * 100, 0), 100)}%`,
                      backgroundColor: timeLeft <= 15 ? "#E9A844" : "#4A90E2",
                    },
                  ]}
                />
                <Text style={styles.timeText}>⏱️ {formatTime(timeLeft)}</Text>
              </View>
            </View>

            {/* Board Container */}
            <View style={[styles.boardArea, { padding: GRID_PADDING }]}>
              {board.map((row, r) => (
                <View key={`row_${r}`} style={[styles.gridRow, { gap: GAP }]}>
                  {row.map((tile, c) => {
                    const isWobbling = wobbleCoord?.r === r && wobbleCoord?.c === c;
                    return (
                      <Pressable
                        key={tile ? tile.id : `empty_${r}_${c}`}
                        onPress={(e) => {
                          const { pageX, pageY } = e.nativeEvent;
                          handleTilePress(r, c, pageX, pageY);
                        }}
                        style={[
                          styles.tileWrap,
                          {
                            width: tileSize,
                            height: tileSize,
                          },
                          isWobbling && styles.tileWobble,
                        ]}
                        accessibilityLabel={`Muni tile ${tile?.color || "empty"}`}
                      >
                        {tile && (
                          <Image
                            source={ASSETS[tile.color]}
                            style={styles.tileImage}
                            contentFit="contain"
                          />
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </View>

            {/* Floating Popups */}
            {popups.map((p) => (
              <Text key={p.id} style={[styles.popupText, { left: p.x, top: p.y, color: p.color }]}>
                {p.text}
              </Text>
            ))}
          </View>
        )}

        {/* GAMEOVER / SUMMARY MODAL */}
        {gameState === "GAMEOVER" && (
          <View style={styles.centerContainer}>
            <View style={styles.gameOverCard}>
              <View style={styles.trophyCircle}>
                <Ionicons name="sparkles" size={36} color="#F5C447" />
              </View>
              <Text style={styles.goTitle}>Time&apos;s Up!</Text>
              <Text style={styles.goSub}>Wonderful color matching and focus.</Text>

              {/* Stats Breakdown */}
              <View style={styles.statsBox}>
                <View style={styles.statRow}>
                  <Text style={styles.statLabel}>Final Match Score</Text>
                  <Text style={styles.statValue}>{score} pts</Text>
                </View>
                <View style={styles.statRow}>
                  <Text style={styles.statLabel}>Matched Tala Coins</Text>
                  <Text style={styles.statValue}>+{coins}</Text>
                </View>
                {targetBonusGranted && (
                  <View style={styles.statRow}>
                    <Text style={styles.statLabel}>Target Reached Bonus (300+ pts)</Text>
                    <Text style={[styles.statValue, { color: "#4F8A38" }]}>+{TARGET_BONUS_COINS} Tala</Text>
                  </View>
                )}
                <View style={styles.statDivider} />
                <View style={styles.statRow}>
                  <Text style={[styles.statLabel, styles.statLabelBold]}>Total Tala Earned</Text>
                  <Text style={[styles.statValue, styles.statValueBold]}>
                    {coins + (targetBonusGranted ? TARGET_BONUS_COINS : 0)}
                  </Text>
                </View>
              </View>

              <Pressable style={styles.btnPrimary} onPress={startGame}>
                <Ionicons name="refresh" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.btnPrimaryText}>Match Again</Text>
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
            <Text style={styles.pauseTitle}>Game Paused</Text>
            <Text style={styles.pauseSub}>Take a gentle breath, Muni is resting with you.</Text>

            <Pressable style={styles.pauseBtnResume} onPress={resumeGame}>
              <Ionicons name="play" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.pauseBtnResumeText}>Resume</Text>
            </Pressable>

            <Pressable style={styles.pauseBtnRestart} onPress={restartGame}>
              <Ionicons name="refresh" size={18} color="#33475C" style={{ marginRight: 8 }} />
              <Text style={styles.pauseBtnRestartText}>Restart Match</Text>
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
  screen: { flex: 1, backgroundColor: "#F7FAF6" },
  contentFrame: { flex: 1, alignSelf: "center", position: "relative" },
  topBar: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E0E7DD",
    backgroundColor: "#FFFFFF",
    zIndex: 10,
  },
  topTitle: { color: "#33475C", fontSize: 18, fontFamily: "Outfit-Bold" },
  backButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  pauseButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  pausePlaceholder: { width: 40, height: 40 },

  centerContainer: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  coverImage: { width: 140, height: 140, borderRadius: 24, marginBottom: 16 },
  overlayTitle: { fontSize: 28, fontFamily: "Outfit-Bold", color: "#33475C", marginBottom: 8 },
  overlaySub: {
    fontSize: 14,
    color: "#607181",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
    paddingHorizontal: 12,
  },

  recordsPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    paddingVertical: 10,
    paddingHorizontal: 22,
    borderRadius: 18,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#E0E7DD",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  recordItem: { alignItems: "center", minWidth: 80 },
  recordLabel: { color: "#7A8A96", fontSize: 11, fontFamily: "Outfit-Medium" },
  recordValue: { color: "#33475C", fontSize: 17, fontFamily: "Outfit-Bold", marginTop: 2 },
  recordDivider: { width: 1, height: 24, backgroundColor: "#E6ECE4", marginHorizontal: 16 },

  gameWrapper: { flex: 1 },

  hud: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E0E7DD",
    zIndex: 10,
  },
  hudRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  scoreContainer: { flex: 1 },
  scoreText: { color: "#33475C", fontSize: 17, fontFamily: "Outfit-Bold" },
  targetRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  targetLabel: { color: "#7A8A96", fontSize: 11, fontFamily: "Outfit-Medium" },
  targetTag: {
    backgroundColor: "#EBF8EE",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#D2F1D8",
  },
  targetTagText: { color: "#2E7D42", fontSize: 10, fontFamily: "Outfit-Bold" },

  coinBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF9E6",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#FCE8A8",
    gap: 4,
  },
  coinIcon: { width: 18, height: 18 },
  coinCount: { color: "#9C7832", fontSize: 14, fontFamily: "Outfit-Bold" },

  targetProgressBar: {
    height: 4,
    backgroundColor: "#EAF0E8",
    borderRadius: 2,
    overflow: "hidden",
    marginBottom: 10,
  },
  targetProgressFill: { height: "100%", backgroundColor: "#4F8A38", borderRadius: 2 },

  timeBarContainer: {
    height: 18,
    backgroundColor: "#E3ECE8",
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
    textShadowColor: "rgba(0,0,0,0.25)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },

  boardArea: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  gridRow: {
    flexDirection: "row",
    marginBottom: 4,
  },
  tileWrap: {
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
  },
  tileWobble: {
    borderColor: "#E76F51",
    backgroundColor: "#FDECE8",
  },
  tileImage: {
    width: "88%",
    height: "88%",
  },

  popupText: {
    position: "absolute",
    fontSize: 16,
    fontFamily: "Outfit-Bold",
    textShadowColor: "rgba(0,0,0,0.3)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  gameOverCard: {
    width: "100%",
    maxWidth: 330,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    shadowColor: "#8BA7B3",
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 12,
  },
  trophyCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#FEF7E6",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  goTitle: { fontSize: 24, fontFamily: "Outfit-Bold", color: "#33475C", marginBottom: 6 },
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
  statLabelBold: { fontFamily: "Outfit-Bold", color: "#33475C" },
  statValue: { fontSize: 15, fontFamily: "Outfit-Bold", color: "#33475C" },
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
    backgroundColor: "rgba(22, 36, 44, 0.55)",
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
    shadowColor: "#102028",
    shadowOpacity: 0.25,
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
  pauseTitle: { fontSize: 22, fontFamily: "Outfit-Bold", color: "#33475C", marginBottom: 6 },
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
    shadowColor: "#4A90E2",
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
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
