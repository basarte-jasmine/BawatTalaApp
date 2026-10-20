import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { unlockAchievement } from "../lib/achievements";
import { useAuthSession } from "../lib/auth-session";
import { claimMiniResetReward } from "../lib/backend-api";

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

export default function ImagePuzzleScreen() {
  const { user } = useAuthSession();
  const { width, height } = useWindowDimensions();
  
  const BOARD_SIZE = Math.min(width - 40, (height - 250) / 2, 340);
  const TRAY_GAP = 20;
  
  type GameState = 'intro' | 'playing' | 'transition' | 'paused' | 'gameover';
  const [gameState, setGameState] = useState<GameState>('intro');
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
  
  const stateRef = useRef({
    gameState: 'intro',
    level: 1,
    score: 0,
    hearts: 3,
    combo: 0,
    timeLeft: 0
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
      
      if (gameState === 'playing' && timeLeft > 0) {
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
    setGameState('transition');
    setCombo(0);
    
    const newHearts = currentHearts - 1;
    setHearts(newHearts);
    
    if (newHearts <= 0) {
      setGameState('gameover');
      if (!rewardClaimedRef.current) {
        rewardClaimedRef.current = true;
        claimMiniResetReward({ activityId: "image-puzzle", level: currentLevel, roundKey: `image-puzzle-${Date.now()}`, score: currentScore })
          .then((reward) => setRewardTala(reward.rewardTala ?? 0))
          .catch(() => undefined);
      }
    } else {
      setTimeout(() => {
        startPuzzle(currentLevel, newHearts, currentScore, 0);
      }, 1500);
    }
  };

  const startGame = () => {
    setScore(0);
    setLevel(1);
    setHearts(3);
    setCombo(0);
    setRewardTala(0);
    rewardClaimedRef.current = false;
    startPuzzle(1, 3, 0, 0);
  };

  const startPuzzle = (lvl: number, h: number, sc: number, c: number) => {
    const { grid, timeLimit } = getDifficulty(lvl);
    
    let nextImage = Math.floor(Math.random() * ASSETS.length);
    if (nextImage === currentImageIndex) {
      nextImage = (nextImage + 1) % ASSETS.length;
    }
    
    setCurrentImageIndex(nextImage);
    setGridSize(grid);
    setLevel(lvl);
    setGameState('playing');
    setTimeLeft(timeLimit);
    setTotalTime(timeLimit);
    
    const newPieces = [];
    const pieceCount = grid * grid;
    const trayPositions = Array.from({ length: pieceCount }, (_, i) => i).sort(() => Math.random() - 0.5);
    
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
        pan: new Animated.ValueXY({ x: 0, y: 0 })});
    }
    
    piecesRef.current = newPieces;
    setPieces([...newPieces]);
  };

  const createPanResponder = (piece: any, index: number) => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => !piece.isPlaced && stateRef.current.gameState === 'playing',
      onPanResponderGrant: () => {
        piece.pan.setOffset({
          x: (piece.pan.x as any)._value,
          y: (piece.pan.y as any)._value
        });
        piece.pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event([null, { dx: piece.pan.x, dy: piece.pan.y }], { useNativeDriver: false }),
      onPanResponderRelease: (e, gesture) => {
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
          Animated.timing(piece.pan, {
            toValue: { x: targetX - startX, y: targetY - startY },
            duration: 150,
            useNativeDriver: false
          }).start(() => {
            piece.isPlaced = true;
            setPieces([...piecesRef.current]);
            checkWinCondition();
          });
        } else {
          Animated.spring(piece.pan, {
            toValue: { x: 0, y: 0 },
            friction: 5,
            useNativeDriver: false
          }).start();
        }
      }
    });
  };

  useEffect(() => {
    panResponders.current = {};
    pieces.forEach((piece, index) => {
      panResponders.current[piece.id] = createPanResponder(piece, index);
    });
  }, [pieces, gridSize]);

  const checkWinCondition = () => {
    const allPlaced = piecesRef.current.every(p => p.isPlaced);
    if (allPlaced && stateRef.current.gameState === 'playing') {
      setGameState('transition');
      
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
      const comboBonus = (nextCombo % 3 === 0) ? 5 : 0;
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

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return mins > 0 ? `${mins}m ${rem < 10 ? '0' : ''}${rem}s` : `${rem}s`;
  };

  const confirmExit = () => {
    setShowExitPrompt(true);
  };

  const leaveGame = () => {
    setShowExitPrompt(false);
    router.replace("/wellness-tools");
  };

  const renderPieces = () => {
    const pieceSize = BOARD_SIZE / gridSize;
    const TRAY_START_Y = BOARD_SIZE + TRAY_GAP;
    
    return pieces.map(piece => {
      const pr = panResponders.current[piece.id];
      if (!pr) return null;
      
      return (
        <Animated.View
          key={piece.id}
          {...pr.panHandlers}
          style={{
            position: 'absolute',
            width: pieceSize,
            height: pieceSize,
            left: piece.trayCol * pieceSize,
            top: TRAY_START_Y + piece.trayRow * pieceSize,
            transform: piece.pan.getTranslateTransform(),
            zIndex: piece.isPlaced ? 1 : 10,
            overflow: 'hidden',
            borderRadius: piece.isPlaced ? 0 : 6,
            borderWidth: piece.isPlaced ? 0 : 1,
            borderColor: 'rgba(255,255,255,0.7)',
            elevation: piece.isPlaced ? 0 : 3,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: piece.isPlaced ? 0 : 0.2,
            shadowRadius: 2,
            backgroundColor: 'rgba(0,0,0,0.05)'}}
        >
          <Image 
            source={ASSETS[currentImageIndex]} 
            style={{
              position: 'absolute',
              width: BOARD_SIZE,
              height: BOARD_SIZE,
              left: -piece.correctCol * pieceSize,
              top: -piece.correctRow * pieceSize,
              opacity: piece.isPlaced && gameState === 'playing' ? 0.9 : 1
            }} 
            contentFit="cover" 
          />
        </Animated.View>
      );
    });
  };

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => {
            if (gameState === 'playing') pauseGame();
            else quitGame();
          }}
          style={styles.backButton}
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={26} color="#37424F" />
        </Pressable>
        <Text style={styles.headerTitle}>Image Puzzle</Text>
        {gameState === 'playing' ? (
          <Pressable onPress={pauseGame} style={styles.pauseButton} accessibilityLabel="Pause Game">
            <Ionicons name="pause-circle-outline" size={26} color="#37424F" />
          </Pressable>
        ) : (
          <View style={styles.headerSpacer} />
        )}
      </View>
      
      {gameState === 'intro' && (
        <View style={styles.introContainer}>
          <Image source={COVER} style={styles.introCover} contentFit="cover" />
          <Text style={styles.introTitle}>IMAGE PUZZLE</Text>
          <Text style={styles.introSubtitle}>Reconstruct the image gently.</Text>
          <Text style={styles.introDesc}>Complete each scene before the timer fades. The puzzle grows as you go.</Text>
          <Text style={styles.introHearts}>❤️ ❤️ ❤️</Text>
          
          <Pressable style={styles.startButton} onPress={startGame}>
            <Text style={styles.startButtonText}>START GAME</Text>
          </Pressable>
        </View>
      )}
      
      {gameState === 'gameover' && (
        <View style={styles.introContainer}>
          <Ionicons name="sad-outline" size={64} color="#C45C5C" style={{ marginBottom: 20 }} />
          <Text style={styles.introTitle}>GAME OVER</Text>
          <Text style={styles.introDesc}>Final Score: {score}</Text>
          <Text style={styles.introDesc}>Level Reached: {level}</Text>
          <Text style={styles.introDesc}>Tala Earned: {rewardTala}</Text>
          
          <Pressable style={[styles.startButton, { backgroundColor: '#6B8E65', marginTop: 30 }]} onPress={startGame}>
            <Text style={styles.startButtonText}>PLAY AGAIN</Text>
          </Pressable>
        </View>
      )}

      {(gameState === 'playing' || gameState === 'transition' || gameState === 'paused') && (
        <View style={styles.gameContainer}>
          <View style={styles.statsBar}>
            <Text style={styles.statText}>SCORE: {score}</Text>
            <Text style={styles.statText}>
              {Array.from({ length: Math.max(0, hearts) }).map(() => '❤️').join(' ')}
            </Text>
            <Text style={styles.statText}>LEVEL: {level}</Text>
          </View>

          {/* Relaxing Bar Timer */} 
          <View style={[styles.timeBarContainer, { width: BOARD_SIZE }]}>
            <View
              style={[
                styles.timeBarFill,
                {
                  width: `${Math.min(Math.max((timeLeft / Math.max(totalTime, 1)) * 100, 0), 100)}%`,
                  backgroundColor: timeLeft < 20 ? '#E9A844' : '#6B8E65',
                },
              ]}
            />
            <Text style={styles.timeText}>⏱️ {formatTime(timeLeft)}</Text>
          </View>

          <View style={[styles.metaRow, { width: BOARD_SIZE }]}>
            <View style={{ flex: 1 }}>
              {combo > 1 && <Text style={styles.comboText}>COMBO x{combo}</Text>}
            </View>
            {/* Reference Photo Thumbnail Button */}
            <Pressable
              style={styles.refPhotoBtn}
              onPress={() => setShowReferenceModal(true)}
              accessibilityLabel="View Reference Photo"
            >
              <Image source={ASSETS[currentImageIndex]} style={styles.refPhotoThumb} contentFit="cover" />
              <View style={styles.refPhotoMeta}>
                <Text style={styles.refPhotoText}>Reference</Text>
                <Ionicons name="expand-outline" size={12} color="#4F8A38" />
              </View>
            </Pressable>
          </View>

          <View style={[styles.playArea, { width: BOARD_SIZE, height: BOARD_SIZE * 2 + TRAY_GAP }]}>
            {/* Board Background with Guide Lines & Faint Ghost Image */}
            <View style={[styles.boardBg, { width: BOARD_SIZE, height: BOARD_SIZE }]}>
              <Image
                source={ASSETS[currentImageIndex]}
                style={[StyleSheet.absoluteFillObject, { opacity: 0.16 }]}
                contentFit="cover"
              />
              {/* Grid guide lines */}
              <View style={StyleSheet.absoluteFillObject}>
                {Array.from({ length: gridSize }).map((_, r) => (
                  <View key={`grow_${r}`} style={{ flexDirection: 'row', height: BOARD_SIZE / gridSize }}>
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
            
            {/* Tray Background */}
            <View style={[styles.trayBg, { width: BOARD_SIZE, height: BOARD_SIZE, top: BOARD_SIZE + TRAY_GAP }]} />

            {renderPieces()}
            
            {gameState === 'transition' && timeLeft === 0 && (
              <View style={[styles.transitionOverlay, { height: BOARD_SIZE }]}>
                <Text style={styles.transitionText}>TIME&apos;S UP</Text>
              </View>
            )}
            
            {gameState === 'transition' && timeLeft > 0 && (
              <View style={[styles.transitionOverlay, { height: BOARD_SIZE, backgroundColor: 'rgba(107, 142, 101, 0.4)' }]}>
                <Text style={styles.transitionText}>LEVEL CLEAR!</Text>
              </View>
            )}
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
      {/* Reference Photo Modal */}
      {showReferenceModal && (
        <View style={styles.refModalOverlay}>
          <View style={styles.refModalCard}>
            <View style={styles.refModalHeader}>
              <Text style={styles.refModalTitle}>Reference Photo</Text>
              <Pressable onPress={() => setShowReferenceModal(false)} style={styles.refModalCloseBtn}>
                <Ionicons name="close-circle" size={28} color="#607181" />
              </Pressable>
            </View>
            <Image
              source={ASSETS[currentImageIndex]}
              style={{ width: BOARD_SIZE, height: BOARD_SIZE, borderRadius: 16 }}
              contentFit="cover"
            />
            <Pressable style={styles.refModalDoneBtn} onPress={() => setShowReferenceModal(false)}>
              <Text style={styles.refModalDoneBtnText}>Back to Puzzle</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Unified Pause State Modal */}
      {gameState === 'paused' && (
        <View style={styles.pauseOverlay}>
          <View style={styles.pauseCard}>
            <View style={styles.pauseIconCircle}>
              <Ionicons name="pause" size={28} color="#6B8E65" />
            </View>
            <Text style={styles.pauseTitle}>Game Paused</Text>
            <Text style={styles.pauseSub}>Take your time, Muni is resting with you.</Text>

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
  screen: { flex: 1, backgroundColor: "#F7FAF5" },
  header: {
    height: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    backgroundColor: "rgba(250, 252, 249, 0.98)",
    borderBottomWidth: 1,
    borderBottomColor: "#E0E7DD",
    zIndex: 9999,
    elevation: 9999},
  backButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { color: "#33475C", fontSize: 18, fontFamily: "Outfit-Bold" },
  headerSpacer: { width: 40, height: 40 },
  
  introContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20},
  introCover: { width: 150, height: 150, borderRadius: 24, marginBottom: 20 },
  introTitle: { color: "#304D5B", fontSize: 28, fontFamily: "Outfit-Bold", marginBottom: 10 },
  introSubtitle: { color: "#465866", fontSize: 18, fontFamily: "Outfit-Medium", marginBottom: 20 },
  introDesc: { color: "#718078", fontSize: 15, textAlign: "center", marginBottom: 20, lineHeight: 22 },
  introHearts: { fontSize: 24, marginBottom: 40, letterSpacing: 5 },
  startButton: {
    backgroundColor: "#4F8A38",
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 999},
  startButtonText: { color: "#FFF", fontSize: 16, fontFamily: "Outfit-Bold", letterSpacing: 1 },
  exitOverlay: { position: "absolute", width: "100%", height: "100%", backgroundColor: "rgba(20, 31, 40, 0.5)", justifyContent: "center", alignItems: "center", zIndex: 10000, elevation: 10000 },
  exitCard: { width: 290, backgroundColor: "#FFFFFF", padding: 24, borderRadius: 20, shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 18, elevation: 12 },
  exitTitle: { color: "#33475C", fontSize: 21, fontFamily: "Outfit-Bold", marginBottom: 8 },
  exitText: { color: "#5D6678", fontSize: 14, lineHeight: 20, marginBottom: 20 },
  exitActions: { flexDirection: "row", gap: 10, justifyContent: "flex-end" },
  exitStay: { paddingHorizontal: 16, paddingVertical: 11, borderRadius: 12, backgroundColor: "#E6ECF1" },
  exitStayText: { color: "#33475C", fontFamily: "Outfit-Bold" },
  exitLeave: { paddingHorizontal: 16, paddingVertical: 11, borderRadius: 12, backgroundColor: "#B75252" },
  exitLeaveText: { color: "#FFFFFF", fontFamily: "Outfit-Bold" },
  
  gameContainer: {
    flex: 1,
    alignItems: "center",
    paddingTop: 10},
  statsBar: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 30,
    marginBottom: 4},
  statText: { color: "#33475C", fontSize: 16, fontFamily: "Outfit-Bold" },
  comboText: { color: "#E09C38", fontSize: 15, fontFamily: "Outfit-Bold" },
  
  playArea: {
    marginTop: 5,
    position: "relative"},
  boardBg: {
    position: "absolute",
    top: 0,
    left: 0,
    backgroundColor: "#EAEFE8",
    borderWidth: 2,
    borderColor: "#C5D3C1",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    borderStyle: "dashed"},
  trayBg: {
    position: "absolute",
    left: 0,
    backgroundColor: "rgba(0,0,0,0.03)",
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "rgba(0,0,0,0.05)",
    borderStyle: "dashed"},
  transitionOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(196, 92, 92, 0.4)",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    zIndex: 100},
  transitionText: {
    color: "#FFF",
    fontSize: 32,
    fontFamily: "Outfit-Bold",
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4},
  pauseButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  timeBarContainer: {
    height: 18,
    backgroundColor: '#E3ECE8',
    borderRadius: 9,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
    marginBottom: 8,
  },
  timeBarFill: { height: '100%', borderRadius: 9 },
  timeText: {
    position: 'absolute',
    width: '100%',
    textAlign: 'center',
    fontSize: 11,
    color: '#FFFFFF',
    fontFamily: 'Outfit-Bold',
    textShadowColor: 'rgba(0,0,0,0.25)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  refPhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D8E2D5',
    gap: 6,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  refPhotoThumb: { width: 26, height: 26, borderRadius: 6 },
  refPhotoMeta: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  refPhotoText: { color: '#33475C', fontSize: 12, fontFamily: 'Outfit-Bold' },
  guideCell: {
    borderWidth: 1,
    borderColor: 'rgba(107, 142, 101, 0.45)',
    borderStyle: 'dashed',
  },
  refModalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(18, 30, 24, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 15000,
    padding: 20,
  },
  refModalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  refModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 14,
  },
  refModalTitle: { fontSize: 18, fontFamily: 'Outfit-Bold', color: '#33475C' },
  refModalCloseBtn: { padding: 2 },
  refModalDoneBtn: {
    marginTop: 16,
    backgroundColor: '#6B8E65',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 28,
    alignItems: 'center',
  },
  refModalDoneBtnText: { color: '#FFFFFF', fontSize: 14, fontFamily: 'Outfit-Bold' },
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
    backgroundColor: '#F0F5EE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  pauseTitle: { fontSize: 22, fontFamily: 'Outfit-Bold', color: '#33475C', marginBottom: 6 },
  pauseSub: { fontSize: 14, color: '#607181', textAlign: 'center', marginBottom: 22, lineHeight: 19 },
  pauseBtnResume: {
    width: '100%',
    flexDirection: 'row',
    backgroundColor: '#6B8E65',
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    shadowColor: '#6B8E65',
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