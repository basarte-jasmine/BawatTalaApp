import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { unlockAchievement } from "../lib/achievements";
import { useAuthSession } from "../lib/auth-session";
import { claimMiniResetReward } from "../lib/backend-api";
import { getGameScore, saveGameScore } from "../lib/game-scores";

const ASSETS = [
  require("../assets/images/Mini Reset/Puzzle/Muni_Flower_Thief.webp"),
  require("../assets/images/Mini Reset/Puzzle/Muni_Flying_Kite.webp"),
  require("../assets/images/Mini Reset/Puzzle/Muni_Museum_Chaos.webp"),
  require("../assets/images/Mini Reset/Puzzle/Muni_Realistic_Binoculars.webp"),
  require("../assets/images/Mini Reset/Puzzle/Muni_Sunbathing.webp"),
];
const COVER = require("../assets/images/Mini Reset/Puzzle/Muni Puzzle Cover.webp");

function getDifficulty(level: number) {
  const grid = Math.min(4, Math.max(2, Math.floor(level / 2) + 1));
  let timeLimit = 120;
  if (level <= 2) timeLimit = 120;
  else if (level <= 4) timeLimit = 150;
  else timeLimit = 180;
  return { grid, timeLimit };
}

function triggerHaptic(style = Haptics.ImpactFeedbackStyle.Light) {
  try {
    void Haptics.impactAsync(style);
  } catch {}
}

export default function ImagePuzzleScreen() {
  const { user } = useAuthSession();
  const { width, height } = useWindowDimensions();

  const BOARD_SIZE = Math.min(width - 40, (height - 250) / 2, 340);
  const TRAY_GAP = 20;

  type GameState = "intro" | "playing" | "transition" | "paused" | "gameover";
  const [gameState, setGameState] = useState<GameState>("intro");
  const [level, setLevel] = useState(1);
  const [score, setScore] = useState(0);
  const [hearts, setHearts] = useState(3);
  const [combo, setCombo] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);

  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [gridSize, setGridSize] = useState(2);
  const [totalTime, setTotalTime] = useState(120);
  const [showReferenceModal, setShowReferenceModal] = useState(false);
  const [showExitPrompt, setShowExitPrompt] = useState(false);
  const [rewardTala, setRewardTala] = useState(0);
  const rewardClaimedRef = useRef(false);

  const [bestScore, setBestScore] = useState(0);
  const [highestLevel, setHighestLevel] = useState(0);

  useEffect(() => {
    getGameScore("image-puzzle").then((data) => {
      if (data?.bestScore) setBestScore(data.bestScore);
      if (data?.highestLevel) setHighestLevel(data.highestLevel);
    });
  }, []);

  const stateRef = useRef({
    gameState: "intro",
    level: 1,
    score: 0,
    hearts: 3,
    combo: 0,
    timeLeft: 0,
  });

  useEffect(() => {
    stateRef.current = { gameState, level, score, hearts, combo, timeLeft };
  }, [gameState, level, score, hearts, combo, timeLeft]);

  const [pieces, setPieces] = useState<any[]>([]);
  const piecesRef = useRef<any[]>([]);
  const panResponders = useRef<{ [key: number]: any }>({});

  useEffect(() => {
    const interval = setInterval(() => {
      const { gameState, timeLeft, level, score, hearts } = stateRef.current;

      if (gameState === "playing" && timeLeft > 0) {
        const newTime = timeLeft - 1;
        setTimeLeft(newTime);
        stateRef.current.timeLeft = newTime;

        if (newTime === 0) {
          handleTimeUp(level, score, hearts);
        }
      }
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleTimeUp = (currentLevel: number, currentScore: number, currentHearts: number) => {
    setGameState("transition");
    setCombo(0);
    triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);

    const newHearts = currentHearts - 1;
    setHearts(newHearts);

    if (newHearts <= 0) {
      setGameState("gameover");
      if (!rewardClaimedRef.current) {
        rewardClaimedRef.current = true;
        claimMiniResetReward({
          activityId: "image-puzzle",
          level: currentLevel,
          roundKey: `image-puzzle-${Date.now()}`,
          score: currentScore,
        })
          .then((reward) => setRewardTala(reward.rewardTala ?? 0))
          .catch(() => undefined);
      }
      const newBest = Math.max(currentScore, bestScore);
      const newHigh = Math.max(currentLevel, highestLevel);
      setBestScore(newBest);
      setHighestLevel(newHigh);
      saveGameScore("image-puzzle", { bestScore: newBest, highestLevel: newHigh });
    } else {
      setTimeout(() => {
        startPuzzle(currentLevel, newHearts, currentScore, 0);
      }, 1500);
    }
  };

  const startGame = () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    setScore(0);
    setLevel(1);
    setHearts(3);
    setCombo(0);
    setRewardTala(0);
    rewardClaimedRef.current = false;
    startPuzzle(1, 3, 0, 0);
  };

  const startPuzzle = (lvl: number, h: number, sc: number, _c: number) => {
    const { grid, timeLimit } = getDifficulty(lvl);

    let nextImage = Math.floor(Math.random() * ASSETS.length);
    if (nextImage === currentImageIndex) {
      nextImage = (nextImage + 1) % ASSETS.length;
    }

    setCurrentImageIndex(nextImage);
    setGridSize(grid);
    setLevel(lvl);
    setGameState("playing");
    setTimeLeft(timeLimit);
    setTotalTime(timeLimit);

    const newPieces = [];
    const pieceCount = grid * grid;
    const trayPositions = Array.from({ length: pieceCount }, (_, i) => i).sort(
      () => Math.random() - 0.5
    );

    for (let i = 0; i < pieceCount; i++) {
      const correctRow = Math.floor(i / grid);
      const correctCol = i % grid;
      const trayRow = Math.floor(trayPositions[i] / grid);
      const trayCol = trayPositions[i] % grid;

      newPieces.push({
        id: i,
        correctRow,
        correctCol,
        trayRow,
        trayCol,
        isPlaced: false,
        pan: new Animated.ValueXY({ x: 0, y: 0 }),
      });
    }

    piecesRef.current = newPieces;
    setPieces([...newPieces]);
  };

  const createPanResponder = (piece: any, _index: number) => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () =>
        !piece.isPlaced && stateRef.current.gameState === "playing",
      onPanResponderGrant: () => {
        triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
        piece.pan.setOffset({
          x: (piece.pan.x as any)._value,
          y: (piece.pan.y as any)._value,
        });
        piece.pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event([null, { dx: piece.pan.x, dy: piece.pan.y }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: () => {
        piece.pan.flattenOffset();

        const pieceSize = BOARD_SIZE / gridSize;
        const TRAY_START_Y = BOARD_SIZE + TRAY_GAP;

        const startX = piece.trayCol * pieceSize;
        const startY = TRAY_START_Y + piece.trayRow * pieceSize;

        const currentX = startX + (piece.pan.x as any)._value;
        const currentY = startY + (piece.pan.y as any)._value;

        const targetX = piece.correctCol * pieceSize;
        const targetY = piece.correctRow * pieceSize;

        const dist = Math.sqrt(Math.pow(currentX - targetX, 2) + Math.pow(currentY - targetY, 2));
        const snapThreshold = pieceSize * 0.45;

        if (dist < snapThreshold) {
          triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
          Animated.timing(piece.pan, {
            toValue: { x: targetX - startX, y: targetY - startY },
            duration: 150,
            useNativeDriver: false,
          }).start(() => {
            piece.isPlaced = true;
            setPieces([...piecesRef.current]);
            checkWinCondition();
          });
        } else {
          Animated.spring(piece.pan, {
            toValue: { x: 0, y: 0 },
            friction: 5,
            useNativeDriver: false,
          }).start();
        }
      },
    });
  };

  useEffect(() => {
    panResponders.current = {};
    pieces.forEach((piece, index) => {
      panResponders.current[piece.id] = createPanResponder(piece, index);
    });
  }, [pieces, gridSize]);

  const checkWinCondition = () => {
    const allPlaced = piecesRef.current.every((p) => p.isPlaced);
    if (allPlaced && stateRef.current.gameState === "playing") {
      setGameState("transition");
      triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);

      const tl = stateRef.current.timeLeft;
      const lvl = stateRef.current.level;
      const curCombo = stateRef.current.combo;
      const curHearts = stateRef.current.hearts;
      const curScore = stateRef.current.score;

      const timeBonus = Math.floor(tl / 2);
      let basePoints = 10;
      if (lvl === 2) basePoints = 15;
      else if (lvl === 3) basePoints = 20;
      else if (lvl >= 4) basePoints = 25;

      const nextCombo = curCombo + 1;
      const comboBonus = nextCombo % 3 === 0 ? 5 : 0;
      const totalEarned = basePoints + timeBonus + comboBonus;

      const nextScore = curScore + totalEarned;

      setScore(nextScore);
      setCombo(nextCombo);

      if (user?.studentNumber) {
        unlockAchievement("a-softer-minute", user.studentNumber).catch(() => {});
      }

      setTimeout(() => {
        startPuzzle(lvl + 1, curHearts, nextScore, nextCombo);
      }, 1500);
    }
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
    if (gameState === "playing") {
      setGameState("paused");
      setShowExitPrompt(true);
      return;
    }
    router.replace("/wellness-tools");
  };

  const renderPieces = () => {
    const pieceSize = BOARD_SIZE / gridSize;
    const TRAY_START_Y = BOARD_SIZE + TRAY_GAP;

    return pieces.map((piece) => {
      const pr = panResponders.current[piece.id];
      if (!pr) return null;

      return (
        <Animated.View
          key={piece.id}
          {...pr.panHandlers}
          style={{
            position: "absolute",
            width: pieceSize,
            height: pieceSize,
            left: piece.trayCol * pieceSize,
            top: TRAY_START_Y + piece.trayRow * pieceSize,
            transform: piece.pan.getTranslateTransform(),
            zIndex: piece.isPlaced ? 1 : 10,
            overflow: "hidden",
            borderRadius: piece.isPlaced ? 0 : 8,
            borderWidth: piece.isPlaced ? 0 : 1,
            borderColor: "rgba(255,255,255,0.7)",
            elevation: piece.isPlaced ? 0 : 4,
            shadowColor: "#0F172A",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: piece.isPlaced ? 0 : 0.2,
            shadowRadius: 3,
            backgroundColor: "rgba(0,0,0,0.05)",
          }}
        >
          <Image
            source={ASSETS[currentImageIndex]}
            style={{
              position: "absolute",
              width: BOARD_SIZE,
              height: BOARD_SIZE,
              left: -piece.correctCol * pieceSize,
              top: -piece.correctRow * pieceSize,
              opacity: piece.isPlaced && gameState === "playing" ? 0.92 : 1,
            }}
            contentFit="cover"
          />
        </Animated.View>
      );
    });
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
          <Text style={styles.topTitle}>Image Puzzle</Text>
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

      {/* START SCREEN */}
      {gameState === "intro" && (
        <View style={styles.centerContainer}>
          <View style={styles.startCard}>
            <View style={styles.coverWrap}>
              <Image source={COVER} style={styles.coverImage} contentFit="contain" />
            </View>
            <Text style={styles.modalTitle}>Image Puzzle</Text>
            <Text style={styles.modalDesc}>
              Reconstruct cozy scenes gently, piece by piece. Drag and snap each tile into place.
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

      {/* GAMEOVER SCREEN */}
      {gameState === "gameover" && (
        <View style={styles.centerContainer}>
          <View style={styles.modalCard}>
            <View style={styles.trophyIconWrap}>
              <Ionicons name="sparkles" size={28} color="#D97706" />
            </View>
            <Text style={styles.modalTitle}>Puzzle Complete</Text>
            <Text style={styles.modalDesc}>Great observational skill and mindful patience.</Text>

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
                <Text style={styles.statLabel}>Level Reached</Text>
                <Text style={styles.statValue}>{level}</Text>
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

      {/* PLAYING / TRANSITION / PAUSED */}
      {(gameState === "playing" || gameState === "transition" || gameState === "paused") && (
        <View style={styles.gameContainer}>
          {/* Top Controls: Status Container + Reference Container side-by-side */}
          <View style={[styles.topControlsRow, { width: BOARD_SIZE }]}>
            {/* Left Status Container */}
            <View style={styles.hudCard}>
              <View style={styles.hudTopRow}>
                <View style={styles.hudStatGroup}>
                  <Text style={styles.hudStatLabel}>SCORE</Text>
                  <Text style={styles.hudStatValue}>{score}</Text>
                </View>

                <View style={styles.heartsRow}>
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Ionicons
                      key={i}
                      name={i < hearts ? "heart" : "heart-outline"}
                      size={15}
                      color={i < hearts ? "#EF4444" : "#CBD5E1"}
                    />
                  ))}
                </View>

                <View style={styles.hudLevelPill}>
                  <Text style={styles.hudLevelText}>LVL {level}</Text>
                </View>

                {combo > 1 && (
                  <View style={styles.hudComboPill}>
                    <Ionicons name="flash" size={10} color="#D97706" />
                    <Text style={styles.hudComboText}>x{combo}</Text>
                  </View>
                )}
              </View>

              {/* Prominent Visual Timer Bar with Centered Countdown */}
              <View style={styles.timeBarContainer}>
                <View
                  style={[
                    styles.timeBarFill,
                    {
                      width: `${Math.min(Math.max((timeLeft / Math.max(totalTime, 1)) * 100, 0), 100)}%`,
                      backgroundColor: timeLeft < 20 ? "#EF4444" : timeLeft < 40 ? "#F59E0B" : "#52B72A",
                    },
                  ]}
                />
                <Text style={styles.timeText}>⏱️ {formatTime(timeLeft)}</Text>
              </View>
            </View>

            {/* Tiny Reference Container Next to the Status Container */}
            <Pressable
              style={styles.refContainer}
              onPress={() => {
                triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
                setShowReferenceModal(true);
              }}
              accessibilityLabel="Enlarge Reference Photo"
            >
              <Image
                source={ASSETS[currentImageIndex]}
                style={styles.refImage}
                contentFit="cover"
              />
              <View style={styles.refBadge}>
                <Ionicons name="expand" size={10} color="#FFFFFF" />
                <Text style={styles.refBadgeText}>Reference</Text>
              </View>
            </Pressable>
          </View>

          {/* Playfield Area */}
          <View
            style={[styles.playArea, { width: BOARD_SIZE, height: BOARD_SIZE * 2 + TRAY_GAP }]}
          >
            {/* Target Board Frame */}
            <View style={[styles.boardBg, { width: BOARD_SIZE, height: BOARD_SIZE }]}>
              {/* Grid guide lines */}
              <View style={StyleSheet.absoluteFillObject}>
                {Array.from({ length: gridSize }).map((_, r) => (
                  <View
                    key={`grow_${r}`}
                    style={{ flexDirection: "row", height: BOARD_SIZE / gridSize }}
                  >
                    {Array.from({ length: gridSize }).map((_, c) => (
                      <View
                        key={`gcell_${r}_${c}`}
                        style={[
                          styles.guideCell,
                          {
                            width: BOARD_SIZE / gridSize,
                            height: BOARD_SIZE / gridSize,
                          },
                        ]}
                      />
                    ))}
                  </View>
                ))}
              </View>
            </View>

            {/* Tray Background Frame */}
            <View
              style={[
                styles.trayBg,
                { width: BOARD_SIZE, height: BOARD_SIZE, top: BOARD_SIZE + TRAY_GAP },
              ]}
            />

            {renderPieces()}

            {gameState === "transition" && timeLeft === 0 && (
              <View style={[styles.transitionOverlay, { height: BOARD_SIZE }]}>
                <Text style={styles.transitionText}>TIME&apos;S UP</Text>
              </View>
            )}

            {gameState === "transition" && timeLeft > 0 && (
              <View
                style={[
                  styles.transitionOverlay,
                  { height: BOARD_SIZE, backgroundColor: "rgba(82, 183, 42, 0.45)" },
                ]}
              >
                <Text style={styles.transitionText}>LEVEL CLEAR!</Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Exit Prompt Sheet */}
      {showExitPrompt && (
        <View style={styles.overlay}>
          <View style={styles.exitCard}>
            <Text style={styles.exitTitle}>Leave Game?</Text>
            <Text style={styles.exitText}>Your current puzzle progress will be lost.</Text>
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
              <Pressable style={styles.exitLeave} onPress={quitGame}>
                <Text style={styles.exitLeaveText}>Leave</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}

      {/* Reference Photo Modal Sheet */}
      {showReferenceModal && (
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            <View style={styles.refModalHeader}>
              <Text style={styles.modalTitle}>Reference Photo</Text>
              <Pressable
                onPress={() => setShowReferenceModal(false)}
                style={styles.circleCloseBtn}
              >
                <Ionicons name="close" size={18} color="#64748B" />
              </Pressable>
            </View>
            <Image
              source={ASSETS[currentImageIndex]}
              style={{
                width: BOARD_SIZE - 20,
                height: BOARD_SIZE - 20,
                borderRadius: 20,
                marginBottom: 16,
              }}
              contentFit="cover"
            />
            <Pressable
              style={styles.primaryPill}
              onPress={() => setShowReferenceModal(false)}
            >
              <Text style={styles.primaryPillText}>Back to Puzzle</Text>
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
            <Text style={styles.modalDesc}>Take your time, Muni is resting with you.</Text>

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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F8FAF7" },

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
  gameContainer: { flex: 1, alignItems: "center", paddingTop: 8 },

  /* HUD */
    /* HUD Redesign with Reference Container */
  topControlsRow: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 10,
    marginBottom: 10,
  },
  hudCard: {
    flex: 1,
    height: 72,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 9,
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#E6ECE4",
    shadowColor: "#0F172A",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  hudTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  hudStatGroup: {
    flexDirection: "row",
    alignItems: "baseline",
    columnGap: 4,
  },
  hudStatLabel: {
    color: "#64748B",
    fontSize: 10,
    fontFamily: "Outfit-Bold",
    letterSpacing: 0.5,
  },
  hudStatValue: {
    color: "#0F172A",
    fontSize: 16,
    fontFamily: "Outfit-Bold",
  },
  heartsRow: {
    flexDirection: "row",
    columnGap: 3,
    alignItems: "center",
  },
  hudLevelPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: "#EAF6E8",
  },
  hudLevelText: {
    color: "#2E7C1F",
    fontSize: 10.5,
    fontFamily: "Outfit-Bold",
  },
  hudComboPill: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 2,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: "#FEF3C7",
  },
  hudComboText: {
    color: "#B45309",
    fontSize: 10,
    fontFamily: "Outfit-Bold",
  },
  timeBarContainer: {
    width: "100%",
    height: 18,
    backgroundColor: "#EEF3EC",
    borderRadius: 9,
    overflow: "hidden",
    position: "relative",
    justifyContent: "center",
  },
  timeBarFill: {
    height: "100%",
    borderRadius: 9,
  },
  timeText: {
    position: "absolute",
    width: "100%",
    textAlign: "center",
    fontSize: 11,
    color: "#FFFFFF",
    fontFamily: "Outfit-Bold",
    textShadowColor: "rgba(0,0,0,0.35)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  refContainer: {
    width: 72,
    height: 72,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: "#D2E4CE",
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
    position: "relative",
    shadowColor: "#0F172A",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  refImage: {
    width: "100%",
    height: "100%",
  },
  refBadge: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(15, 23, 42, 0.72)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 2,
    columnGap: 3,
  },
  refBadgeText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontFamily: "Outfit-Bold",
    letterSpacing: 0.2,
  },
  playArea: { position: "relative" },
  boardBg: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: "#D2E4CE",
    overflow: "hidden",
    shadowColor: "#0F172A",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  guideCell: {
    borderWidth: 0.5,
    borderColor: "rgba(82, 183, 42, 0.35)",
    borderStyle: "dashed",
  },
  trayBg: {
    position: "absolute",
    backgroundColor: "#F1F6EF",
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: "#DEEADC",
    borderStyle: "dashed",
  },
  transitionOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
  },
  transitionText: {
    color: "#FFFFFF",
    fontSize: 22,
    fontFamily: "Outfit-Bold",
    letterSpacing: 1,
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
  refModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    marginBottom: 12,
  },
  circleCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
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
