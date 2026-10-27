import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
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

function triggerHaptic(style = Haptics.ImpactFeedbackStyle.Light) {
  try {
    void Haptics.impactAsync(style);
  } catch {}
}

function createTile(): Tile {
  return {
    id: `tile_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    color: COLOR_KEYS[Math.floor(Math.random() * COLOR_KEYS.length)],
  };
}

function findConnectedGroup(
  board: (Tile | null)[][],
  startR: number,
  startC: number
): { r: number; c: number }[] {
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
  const GAP = 5;
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
  const [selectedPath, setSelectedPath] = useState<{ r: number; c: number }[]>([]);
  const [showExitPrompt, setShowExitPrompt] = useState(false);

  const bestScoreRef = useRef(0);
  const bestCoinsRef = useRef(0);
  const [, forceUpdate] = useState(0);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rewardClaimedRef = useRef(false);
  const gameStateRef = useRef(gameState);
  const boardRef = useRef(board);
  const scoreRef = useRef(score);
  const coinsRef = useRef(coins);
  const targetBonusGrantedRef = useRef(targetBonusGranted);
  gameStateRef.current = gameState;
  boardRef.current = board;
  scoreRef.current = score;
  coinsRef.current = coins;
  targetBonusGrantedRef.current = targetBonusGranted;

  useEffect(() => {
    getGameScore("muni-match").then((data) => {
      if (data?.bestScore) bestScoreRef.current = data.bestScore;
      if (data?.bestCoins) bestCoinsRef.current = data.bestCoins;
      forceUpdate((p) => p + 1);
    });
  }, []);

  const finishGame = useCallback((finalScore: number, finalCoins: number, reachedTarget: boolean) => {
    setGameState("GAMEOVER");
    triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
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
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    const newBoard = generatePlayableBoard();
    setBoard(newBoard);
    setScore(0);
    setCoins(0);
    setTimeLeft(GAME_DURATION);
    setTargetBonusGranted(false);
    setRewardTala(0);
    setPopups([]);
    setWobbleCoord(null);
    setSelectedPath([]);
    rewardClaimedRef.current = false;
    setGameState("PLAYING");
  };

  const pauseGame = () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
    if (gameState === "PLAYING") {
      setGameState("PAUSED");
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const resumeGame = () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
    if (gameState === "PAUSED") {
      setGameState("PLAYING");
    }
  };

  const restartGame = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    startGame();
  };

  const quitGame = () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
    if (timerRef.current) clearInterval(timerRef.current);
    router.replace("/wellness-tools");
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

  const pathRef = useRef<{ r: number; c: number }[]>([]);
  const pathColorRef = useRef<MuniColor | null>(null);

  const getTileAtPoint = (locationX: number, locationY: number) => {
    const stride = tileSize + GAP;
    const c = Math.floor((locationX - GRID_PADDING) / stride);
    const r = Math.floor((locationY - GRID_PADDING) / stride);
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return null;
    const tileLeft = GRID_PADDING + c * stride;
    const tileTop = GRID_PADDING + r * stride;
    if (locationX > tileLeft + tileSize || locationY > tileTop + tileSize) return null;
    return { r, c };
  };

  const addPathTile = (position: { r: number; c: number }) => {
    const tile = boardRef.current[position.r]?.[position.c];
    if (!tile) return;
    const path = pathRef.current;
    const last = path[path.length - 1];

    if (!pathColorRef.current) {
      pathColorRef.current = tile.color;
    }
    if (tile.color !== pathColorRef.current) return;
    if (last && last.r === position.r && last.c === position.c) return;

    if (path.length > 1) {
      const previous = path[path.length - 2];
      if (previous.r === position.r && previous.c === position.c) {
        path.pop();
        setSelectedPath([...path]);
        return;
      }
    }

    if (last && Math.abs(last.r - position.r) + Math.abs(last.c - position.c) !== 1) return;
    if (path.some((item) => item.r === position.r && item.c === position.c)) return;
    path.push(position);
    setSelectedPath([...path]);
    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
  };

  const finishPath = (pageX: number, pageY: number) => {
    const group = pathRef.current;
    pathRef.current = [];
    pathColorRef.current = null;
    setSelectedPath([]);
    if (group.length < 3) {
      if (group.length > 0) {
        triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
        setWobbleCoord(group[0]);
        setTimeout(() => setWobbleCoord(null), 300);
        Vibration.vibrate(30);
      }
      return;
    }

    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    const count = group.length;

    let earnedCoins = 1;
    if (count === 4) earnedCoins = 2;
    else if (count >= 5) earnedCoins = 3;

    let earnedPoints = 30;
    if (count === 4) earnedPoints = 50;
    else if (count >= 5) earnedPoints = 80 + (count - 5) * 20;

    const newScore = scoreRef.current + earnedPoints;
    setScore(newScore);

    let extraBonusCoins = 0;

    if (!targetBonusGrantedRef.current && newScore >= TARGET_SCORE) {
      triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
      setTargetBonusGranted(true);
      extraBonusCoins = TARGET_BONUS_COINS;
      setPopups((prev) => [
        ...prev,
        {
          id: `popup_target_${Date.now()}`,
          text: "+10 Target Bonus!",
          x: pageX - 60,
          y: pageY - 40,
          color: "#2E7C1F",
        },
      ]);
    }

    const nextCoins = coinsRef.current + earnedCoins + extraBonusCoins;
    setCoins(nextCoins);

    setPopups((prev) => [
      ...prev,
      {
        id: `popup_${Date.now()}_${Math.random()}`,
        text: `+${earnedCoins} Tala`,
        x: pageX - 30,
        y: pageY - 10,
        color: "#D97706",
      },
    ]);

    const newBoard = boardRef.current.map((row) => [...row]);
    for (const pos of group) {
      newBoard[pos.r][pos.c] = null as any;
    }

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

    if (!hasAnyValidMatch(newBoard)) {
      setBoard(generatePlayableBoard());
    } else {
      setBoard(newBoard);
    }
  };

  const boardPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => gameStateRef.current === "PLAYING",
      onMoveShouldSetPanResponder: () => gameStateRef.current === "PLAYING",
      onPanResponderGrant: (event) => {
        pathRef.current = [];
        pathColorRef.current = null;
        setSelectedPath([]);
        const position = getTileAtPoint(event.nativeEvent.locationX, event.nativeEvent.locationY);
        if (position) addPathTile(position);
      },
      onPanResponderMove: (event) => {
        const position = getTileAtPoint(event.nativeEvent.locationX, event.nativeEvent.locationY);
        if (position) addPathTile(position);
      },
      onPanResponderRelease: (event) => {
        finishPath(event.nativeEvent.pageX, event.nativeEvent.pageY);
      },
      onPanResponderTerminate: () => finishPath(0, 0),
    })
  ).current;

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return mins > 0 ? `${mins}m ${rem < 10 ? "0" : ""}${rem}s` : `${rem}s`;
  };

  const targetProgress = Math.min(Math.max((score / TARGET_SCORE) * 100, 0), 100);

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
          <Text style={styles.topTitle}>Muni Match</Text>
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
                <Image source={ASSETS.cover} style={styles.coverImage} contentFit="contain" cachePolicy="memory-disk" />
              </View>
              <Text style={styles.modalTitle}>Muni Match</Text>
              <Text style={styles.modalDesc}>
                Drag through 3 or more adjacent Munis of the same color to connect them. Release to
                clear your line, earn points, and reach the 300-point target for a 10 Tala bonus!
              </Text>

              <View style={styles.recordsBox}>
                <View style={styles.recordCol}>
                  <Text style={styles.recordColLabel}>BEST SCORE</Text>
                  <Text style={styles.recordColValue}>{bestScoreRef.current}</Text>
                </View>
                <View style={styles.recordDivider} />
                <View style={styles.recordCol}>
                  <Text style={styles.recordColLabel}>BEST TALA</Text>
                  <Text style={styles.recordColValue}>{bestCoinsRef.current}</Text>
                </View>
              </View>

              <Pressable style={styles.primaryPill} onPress={startGame}>
                <Ionicons name="play" size={17} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.primaryPillText}>Start Match</Text>
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

                <View style={styles.targetPill}>
                  <Text style={styles.targetPillLabel}>TARGET 300</Text>
                  {targetBonusGranted ? (
                    <View style={styles.bonusChip}>
                      <Ionicons name="checkmark-circle" size={12} color="#2E7C1F" />
                      <Text style={styles.bonusChipText}>+10 Tala</Text>
                    </View>
                  ) : null}
                </View>

                <View style={styles.coinBadge}>
                  <Image source={ASSETS.coin} style={styles.coinIcon} contentFit="contain" cachePolicy="memory-disk" />
                  <Text style={styles.coinCount}>+{coins}</Text>
                </View>
              </View>



              {/* Time Track */}
              <View style={styles.timeTrack}>
                <View
                  style={[
                    styles.timeFill,
                    {
                      width: `${Math.min(Math.max((timeLeft / GAME_DURATION) * 100, 0), 100)}%`,
                      backgroundColor: timeLeft <= 15 ? "#EF4444" : timeLeft <= 30 ? "#F59E0B" : "#52B72A",
                    },
                  ]}
                />
              </View>
              <View style={styles.timeLabelRow}>
                <Ionicons name="time-outline" size={11.5} color="#64748B" />
                <Text style={styles.timeLabelText}>{formatTime(timeLeft)}</Text>
              </View>
            </View>

            {/* Board Container */}
            <View
              style={[styles.boardArea, { padding: GRID_PADDING }]}
              {...boardPanResponder.panHandlers}
            >
              {selectedPath.slice(1).map((position, index) => {
                const previous = selectedPath[index];
                const x1 = GRID_PADDING + previous.c * (tileSize + GAP) + tileSize / 2;
                const y1 = GRID_PADDING + previous.r * (tileSize + GAP) + tileSize / 2;
                const x2 = GRID_PADDING + position.c * (tileSize + GAP) + tileSize / 2;
                const y2 = GRID_PADDING + position.r * (tileSize + GAP) + tileSize / 2;
                const length = Math.hypot(x2 - x1, y2 - y1);
                const angle = Math.atan2(y2 - y1, x2 - x1);
                return (
                  <View
                    key={`path_${previous.r}_${previous.c}_${position.r}_${position.c}`}
                    pointerEvents="none"
                    style={[
                      styles.pathSegment,
                      {
                        left: (x1 + x2) / 2 - length / 2,
                        top: (y1 + y2) / 2 - 3,
                        width: length,
                        transform: [{ rotate: `${angle}rad` }],
                      },
                    ]}
                  />
                );
              })}
              {board.map((row, r) => (
                <View key={`row_${r}`} style={[styles.gridRow, { gap: GAP }]}>
                  {row.map((tile, c) => {
                    const isWobbling = wobbleCoord?.r === r && wobbleCoord?.c === c;
                    return (
                      <View
                        key={tile ? tile.id : `empty_${r}_${c}`}
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
                            cachePolicy="memory-disk"
                          />
                        )}
                      </View>
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

        {/* GAMEOVER SCREEN */}
        {gameState === "GAMEOVER" && (
          <View style={styles.centerContainer}>
            <View style={styles.modalCard}>
              <View style={styles.trophyIconWrap}>
                <Ionicons name="sparkles" size={28} color="#D97706" />
              </View>
              <Text style={styles.modalTitle}>Match Complete!</Text>
              <Text style={styles.modalDesc}>Wonderful color matching and mindful focus.</Text>

              <View style={styles.statsCard}>
                <View style={styles.statRow}>
                  <Text style={styles.statLabel}>Final Score</Text>
                  <View style={styles.statValueRow}>
                    <Text style={styles.statValue}>{score} pts</Text>
                    {score >= bestScoreRef.current && score > 0 ? (
                      <View style={styles.bestBadge}>
                        <Text style={styles.bestBadgeText}>BEST</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
                <View style={styles.statRow}>
                  <Text style={styles.statLabel}>Matched Coins</Text>
                  <Text style={styles.statValue}>+{coins}</Text>
                </View>
                {targetBonusGranted && (
                  <View style={styles.statRow}>
                    <Text style={styles.statLabel}>Target Bonus (300+)</Text>
                    <View style={styles.bonusBadge}>
                      <Text style={styles.bonusBadgeText}>+{TARGET_BONUS_COINS} Tala</Text>
                    </View>
                  </View>
                )}
                <View style={styles.dividerLine} />
                <View style={styles.statRow}>
                  <Text style={[styles.statLabel, { fontFamily: "Outfit-Bold", color: "#0F172A" }]}>
                    Total Tala Earned
                  </Text>
                  <View style={styles.talaBadge}>
                    <Text style={styles.talaBadgeText}>
                      +{coins + (targetBonusGranted ? TARGET_BONUS_COINS : 0)} Tala
                    </Text>
                  </View>
                </View>
              </View>

              <Pressable style={styles.primaryPill} onPress={startGame}>
                <Ionicons name="refresh" size={17} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.primaryPillText}>Match Again</Text>
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
              <Text style={styles.secondaryPillText}>Restart Match</Text>
            </Pressable>

            <Pressable style={styles.textAction} onPress={quitGame}>
              <Ionicons name="exit-outline" size={16} color="#DC2626" style={{ marginRight: 5 }} />
              <Text style={styles.textActionRed}>Quit Game</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Exit Prompt Sheet */}
      {showExitPrompt && (
        <View style={styles.overlay}>
          <View style={styles.exitCard}>
            <Text style={styles.exitTitle}>Leave Match?</Text>
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
  gameWrapper: { flex: 1, paddingHorizontal: 12, paddingTop: 6 },

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
    marginBottom: 10,
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
  targetPill: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "#F1F5F9",
  },
  targetPillLabel: {
    color: "#64748B",
    fontSize: 10.5,
    fontFamily: "Outfit-Bold",
  },
  bonusChip: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 2,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 999,
    backgroundColor: "#EAF6E8",
  },
  bonusChipText: {
    color: "#2E7C1F",
    fontSize: 10,
    fontFamily: "Outfit-Bold",
  },
  coinBadge: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "#FEF3C7",
  },
  coinIcon: { width: 14, height: 14 },
  coinCount: {
    color: "#B45309",
    fontSize: 12,
    fontFamily: "Outfit-Bold",
  },
  targetProgressBar: {
    height: 5,
    backgroundColor: "#EEF3EC",
    borderRadius: 999,
    overflow: "hidden",
    marginBottom: 6,
  },
  targetProgressFill: {
    height: "100%",
    backgroundColor: "#52B72A",
    borderRadius: 999,
  },
  timeTrack: {
    height: 6,
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

  /* Board */
  boardArea: {
    backgroundColor: "rgba(255, 255, 255, 0.94)",
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: "#E6ECE4",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0F172A",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  gridRow: {
    flexDirection: "row",
    marginBottom: 5,
  },
  tileWrap: {
    borderRadius: 12,
    backgroundColor: "#F8FAF8",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#EEF3EC",
  },
  tileWobble: {
    transform: [{ scale: 1.15 }],
    borderColor: "#EF4444",
  },
  pathSegment: {
    position: "absolute",
    height: 6,
    borderRadius: 999,
    backgroundColor: "#8B5CF6",
    shadowColor: "#8B5CF6",
    shadowOpacity: 0.7,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 5,
    zIndex: 2,
  },
  tileImage: {
    width: "82%",
    height: "82%",
    pointerEvents: "none",
    userSelect: "none",
  } as any,
  popupText: {
    position: "absolute",
    fontSize: 15,
    fontFamily: "Outfit-Bold",
    zIndex: 100,
    textShadowColor: "rgba(0,0,0,0.2)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

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
  bonusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: "#EAF6E8",
  },
  bonusBadgeText: {
    color: "#2E7C1F",
    fontSize: 11,
    fontFamily: "Outfit-Bold",
  },
  dividerLine: {
    height: 1,
    backgroundColor: "#E2E8F0",
    marginVertical: 2,
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
