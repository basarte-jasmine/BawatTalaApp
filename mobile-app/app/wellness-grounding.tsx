import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  setAmbientAudioModeAsync,
  useAmbientAudioPlayer,
  useAmbientAudioPlayerStatus,
} from "../lib/ambient-audio";
import {
  GROUNDING_AUDIO_TRACKS,
  GROUNDING_STEPS,
  GROUNDING_VIBES,
} from "../lib/wellness-grounding-content";

type PercentValue = `${number}%`;

const RAIN_STREAKS: { left: PercentValue; top: number; height: number; opacity: number }[] = [
  { left: "8%", top: -18, height: 84, opacity: 0.28 },
  { left: "22%", top: 8, height: 70, opacity: 0.22 },
  { left: "36%", top: -4, height: 90, opacity: 0.26 },
  { left: "52%", top: 18, height: 72, opacity: 0.18 },
  { left: "68%", top: -10, height: 86, opacity: 0.24 },
  { left: "82%", top: 10, height: 74, opacity: 0.2 },
];

const FLOAT_ORBS: { left: PercentValue; top: number; size: number; opacity: number }[] = [
  { left: "10%", top: 42, size: 74, opacity: 0.2 },
  { left: "62%", top: 88, size: 98, opacity: 0.16 },
  { left: "28%", top: 168, size: 58, opacity: 0.14 },
];

const TWINKLES: { left: PercentValue; top: number; size: number; opacity: number }[] = [
  { left: "14%", top: 52, size: 7, opacity: 0.9 },
  { left: "30%", top: 98, size: 5, opacity: 0.72 },
  { left: "58%", top: 58, size: 6, opacity: 0.85 },
  { left: "76%", top: 108, size: 8, opacity: 0.88 },
  { left: "44%", top: 148, size: 4, opacity: 0.68 },
  { left: "86%", top: 64, size: 5, opacity: 0.74 },
];

const WAVE_BANDS: { width: PercentValue; height: number; left: PercentValue; bottom: number; opacity: number }[] = [
  { width: "78%", height: 54, left: "-6%", bottom: 28, opacity: 0.28 },
  { width: "64%", height: 46, left: "20%", bottom: 54, opacity: 0.22 },
  { width: "72%", height: 60, left: "8%", bottom: -10, opacity: 0.3 },
];

function formatClock(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "0:00";
  }

  const rounded = Math.floor(seconds);
  const minutes = Math.floor(rounded / 60);
  const remaining = rounded % 60;
  return `${minutes}:${remaining.toString().padStart(2, "0")}`;
}

function renderSceneDecorations(
  animation: "float" | "rain" | "twinkle" | "wave",
  accent: string,
  drift: Animated.Value,
  glow: Animated.Value,
  rain: Animated.Value,
) {
  const driftX = drift.interpolate({
    inputRange: [0, 1],
    outputRange: [-16, 16],
  });
  const driftY = drift.interpolate({
    inputRange: [0, 1],
    outputRange: [8, -10],
  });
  const pulseScale = glow.interpolate({
    inputRange: [0, 1],
    outputRange: [0.94, 1.08],
  });
  const pulseOpacity = glow.interpolate({
    inputRange: [0, 1],
    outputRange: [0.5, 1],
  });
  const rainTranslate = rain.interpolate({
    inputRange: [0, 1],
    outputRange: [-40, 84],
  });

  if (animation === "rain") {
    return (
      <View pointerEvents="none" style={styles.sceneDecorWrap}>
        {RAIN_STREAKS.map((streak, index) => (
          <Animated.View
            key={`${streak.left}-${index}`}
            style={[
              styles.rainStreak,
              {
                left: streak.left,
                top: streak.top,
                height: streak.height,
                opacity: streak.opacity,
                backgroundColor: accent,
                transform: [{ translateY: rainTranslate }, { rotate: "-14deg" }],
              },
            ]}
          />
        ))}
      </View>
    );
  }

  if (animation === "wave") {
    return (
      <View pointerEvents="none" style={styles.sceneDecorWrap}>
        {WAVE_BANDS.map((band, index) => (
          <Animated.View
            key={`${band.left}-${index}`}
            style={[
              styles.waveBand,
              {
                width: band.width,
                height: band.height,
                left: band.left,
                bottom: band.bottom,
                opacity: band.opacity,
                backgroundColor: accent,
                transform: [{ translateX: index % 2 === 0 ? driftX : Animated.multiply(driftX, -0.8) }],
              },
            ]}
          />
        ))}
      </View>
    );
  }

  if (animation === "twinkle") {
    return (
      <View pointerEvents="none" style={styles.sceneDecorWrap}>
        {TWINKLES.map((twinkle, index) => (
          <Animated.View
            key={`${twinkle.left}-${index}`}
            style={[
              styles.twinkle,
              {
                left: twinkle.left,
                top: twinkle.top,
                width: twinkle.size,
                height: twinkle.size,
                borderRadius: twinkle.size / 2,
                opacity: Animated.multiply(pulseOpacity, twinkle.opacity),
                backgroundColor: accent,
                transform: [{ scale: index % 2 === 0 ? pulseScale : 1 }],
              },
            ]}
          />
        ))}
      </View>
    );
  }

  return (
    <View pointerEvents="none" style={styles.sceneDecorWrap}>
      {FLOAT_ORBS.map((orb, index) => (
        <Animated.View
          key={`${orb.left}-${index}`}
          style={[
            styles.floatOrb,
            {
              left: orb.left,
              top: orb.top,
              width: orb.size,
              height: orb.size,
              borderRadius: orb.size / 2,
              opacity: orb.opacity,
              backgroundColor: accent,
              transform: [
                { translateY: index % 2 === 0 ? driftY : Animated.multiply(driftY, -0.65) },
                { scale: pulseScale },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
}

export default function WellnessGroundingScreen() {
  const { width } = useWindowDimensions();
  const isCompact = width < 380;
  const frameWidth = Math.min(width - 24, 460);
  const sceneHeight = Math.max(320, Math.min(width * 0.86, 380));
  const [selectedVibeId, setSelectedVibeId] = useState(GROUNDING_VIBES[0].id);
  const [selectedAudioId, setSelectedAudioId] = useState(GROUNDING_AUDIO_TRACKS[0].id);
  const [activeStepId, setActiveStepId] = useState(GROUNDING_STEPS[0].id);
  const [completedStepIds, setCompletedStepIds] = useState<string[]>([]);
  const selectedVibe = GROUNDING_VIBES.find((item) => item.id === selectedVibeId) ?? GROUNDING_VIBES[0];
  const selectedAudio = GROUNDING_AUDIO_TRACKS.find((item) => item.id === selectedAudioId) ?? GROUNDING_AUDIO_TRACKS[0];
  const activeStep = GROUNDING_STEPS.find((step) => step.id === activeStepId) ?? GROUNDING_STEPS[0];
  const audioPlayer = useAmbientAudioPlayer(null, { updateInterval: 250 });
  const audioStatus = useAmbientAudioPlayerStatus(audioPlayer);
  const shouldResumeAfterSwitchRef = useRef(false);
  const drift = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const rain = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    setAmbientAudioModeAsync({
      interruptionMode: "mixWithOthers",
      playsInSilentMode: true,
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    audioPlayer.loop = true;
    audioPlayer.volume = 0.82;
    return () => {
      audioPlayer.pause();
      audioPlayer.seekTo(0);
    };
  }, [audioPlayer]);

  useEffect(() => {
    audioPlayer.pause();
    audioPlayer.replace(selectedAudio.source);
    audioPlayer.loop = true;
    audioPlayer.volume = 0.82;
    audioPlayer.seekTo(0);

    if (shouldResumeAfterSwitchRef.current) {
      audioPlayer.play();
    }

    shouldResumeAfterSwitchRef.current = false;
  }, [audioPlayer, selectedAudio.source]);

  useEffect(() => {
    const driftLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, {
          toValue: 1,
          duration: 4800,
          useNativeDriver: true,
        }),
        Animated.timing(drift, {
          toValue: 0,
          duration: 4800,
          useNativeDriver: true,
        }),
      ]),
    );
    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, {
          toValue: 1,
          duration: 3200,
          useNativeDriver: true,
        }),
        Animated.timing(glow, {
          toValue: 0,
          duration: 3200,
          useNativeDriver: true,
        }),
      ]),
    );
    const rainLoop = Animated.loop(
      Animated.timing(rain, {
        toValue: 1,
        duration: 1800,
        useNativeDriver: true,
      }),
    );

    driftLoop.start();
    glowLoop.start();
    rainLoop.start();

    return () => {
      driftLoop.stop();
      glowLoop.stop();
      rainLoop.stop();
    };
  }, [drift, glow, rain]);

  const completedCount = completedStepIds.length;
  const progressRatio = completedCount / GROUNDING_STEPS.length;
  const progressWidth = `${Math.max(progressRatio * 100, completedCount > 0 ? 10 : 0)}%` as PercentValue;
  const currentStepIndex = GROUNDING_STEPS.findIndex((step) => step.id === activeStep.id);
  const isCurrentStepDone = completedStepIds.includes(activeStep.id);
  const groundingComplete = completedCount === GROUNDING_STEPS.length;
  const currentTimeLabel = formatClock(audioStatus.currentTime);
  const durationLabel = audioStatus.duration > 0 ? formatClock(audioStatus.duration) : selectedAudio.durationLabel.replace(" loop", "");

  const handleBack = () => {
    audioPlayer.pause();

    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace("/wellness-tools");
  };

  const handleTogglePlayback = () => {
    if (audioStatus.playing) {
      audioPlayer.pause();
      return;
    }

    audioPlayer.play();
  };

  const handleChooseAudio = (trackId: string) => {
    if (trackId === selectedAudioId) {
      return;
    }

    shouldResumeAfterSwitchRef.current = audioStatus.playing;
    setSelectedAudioId(trackId);
  };

  const handlePlayTrack = (trackId: string) => {
    if (trackId === selectedAudioId) {
      if (audioStatus.playing) {
        audioPlayer.pause();
        return;
      }

      audioPlayer.play();
      return;
    }

    shouldResumeAfterSwitchRef.current = true;
    setSelectedAudioId(trackId);
  };

  const handleMarkStepDone = () => {
    setCompletedStepIds((current) => {
      if (current.includes(activeStep.id)) {
        return current;
      }

      return [...current, activeStep.id];
    });

    const nextStep = GROUNDING_STEPS[currentStepIndex + 1];
    if (nextStep) {
      setActiveStepId(nextStep.id);
    }
  };

  const handleAdvanceStep = () => {
    const nextStep = GROUNDING_STEPS[currentStepIndex + 1];
    if (nextStep) {
      setActiveStepId(nextStep.id);
    }
  };

  const handleResetGrounding = () => {
    setCompletedStepIds([]);
    setActiveStepId(GROUNDING_STEPS[0].id);
  };

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.topBar}>
        <Pressable style={styles.backButton} accessibilityLabel="Go back" onPress={handleBack}>
          <Ionicons name="chevron-back" size={28} color="#37424F" />
        </Pressable>
        <Text style={styles.topTitle}>Wellness Tools</Text>
        <View style={styles.topBarSpacer} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.contentFrame, { width: frameWidth }]}>
          <View style={[styles.sceneCard, { height: sceneHeight, borderColor: selectedVibe.edge }]}>
            <ImageBackground source={selectedVibe.backgroundImage} style={styles.sceneImage} imageStyle={styles.sceneImageInner}>
              <View style={[styles.sceneOverlay, { backgroundColor: selectedVibe.overlay }]} />
              {renderSceneDecorations(selectedVibe.animation, selectedVibe.accent, drift, glow, rain)}

              <View style={styles.sceneTopRow}>
                <View style={styles.sceneBadge}>
                  <Ionicons name="sparkles-outline" size={15} color="#FFFFFF" />
                  <Text style={styles.sceneBadgeText}>Grounding Room</Text>
                </View>
                <View style={styles.sceneMetaPill}>
                  <Ionicons name={selectedVibe.icon} size={14} color="#FFFFFF" />
                  <Text style={styles.sceneMetaPillText}>{selectedVibe.title}</Text>
                </View>
              </View>

              <View style={styles.sceneBody}>
                <Text style={styles.sceneTitle}>5-4-3-2-1 Sensory Grounding</Text>
                <Text style={styles.sceneDescription}>
                  Set a calmer backdrop, pick your sound, and move through each sense at your own pace.
                </Text>
                <Text style={styles.sceneMoodLine}>{selectedVibe.moodLine}</Text>
              </View>

              <View style={styles.nowPlayingCard}>
                <View style={styles.nowPlayingTopRow}>
                  <View style={styles.nowPlayingTextWrap}>
                    <Text style={styles.nowPlayingEyebrow}>Now in the room</Text>
                    <Text style={styles.nowPlayingTitle}>{selectedAudio.title}</Text>
                    <Text style={styles.nowPlayingTone}>{selectedAudio.tone}</Text>
                  </View>
                  <Pressable style={styles.heroPlayButton} onPress={handleTogglePlayback}>
                    <Ionicons
                      name={audioStatus.playing ? "pause" : "play"}
                      size={18}
                      color="#314555"
                    />
                  </Pressable>
                </View>

                <View style={styles.timelineTrack}>
                  <View style={[styles.timelineFill, { width: audioStatus.duration > 0 ? `${Math.min((audioStatus.currentTime / audioStatus.duration) * 100, 100)}%` : "0%" }]} />
                </View>

                <View style={styles.timelineMeta}>
                  <Text style={styles.timelineMetaText}>{audioStatus.playing ? currentTimeLabel : "Paused"}</Text>
                  <Text style={styles.timelineMetaText}>{durationLabel}</Text>
                </View>
              </View>
            </ImageBackground>
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Choose your vibe</Text>
            <Text style={styles.sectionDescription}>
              Give the exercise a setting that feels safer, softer, or quieter for you right now.
            </Text>

            <View style={styles.vibeGrid}>
              {GROUNDING_VIBES.map((vibe) => {
                const isSelected = vibe.id === selectedVibeId;

                return (
                  <Pressable
                    key={vibe.id}
                    style={[
                      styles.vibeCard,
                      { width: isCompact ? "100%" : "48%" },
                      isSelected && [styles.vibeCardSelected, { borderColor: vibe.edge, backgroundColor: `${vibe.accent}1C` }],
                    ]}
                    onPress={() => setSelectedVibeId(vibe.id)}
                  >
                    <View style={styles.vibeCardTopRow}>
                      <View style={[styles.vibeIconWrap, { backgroundColor: `${vibe.accent}22`, borderColor: `${vibe.accent}35` }]}>
                        <Ionicons name={vibe.icon} size={18} color={vibe.accent} />
                      </View>
                      {isSelected ? (
                        <View style={[styles.selectedTag, { backgroundColor: `${vibe.accent}22`, borderColor: `${vibe.accent}35` }]}>
                          <Text style={[styles.selectedTagText, { color: vibe.accent }]}>Selected</Text>
                        </View>
                      ) : null}
                    </View>

                    <Text style={styles.vibeTitle}>{vibe.title}</Text>
                    <Text style={styles.vibeNote}>{vibe.note}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Pick your audio</Text>
            <Text style={styles.sectionDescription}>
              Keep it silent if you want, or let one soundscape hold the room while you ground yourself.
            </Text>

            <View style={styles.audioList}>
              {GROUNDING_AUDIO_TRACKS.map((track) => {
                const isSelected = track.id === selectedAudioId;
                const isPlayingThisTrack = isSelected && audioStatus.playing;

                return (
                  <Pressable
                    key={track.id}
                    style={[
                      styles.audioCard,
                      isSelected && [styles.audioCardSelected, { borderColor: selectedVibe.edge, backgroundColor: `${selectedVibe.accent}14` }],
                    ]}
                    onPress={() => handleChooseAudio(track.id)}
                  >
                    <View style={styles.audioCardLeft}>
                      <View style={[styles.audioIconWrap, { backgroundColor: `${selectedVibe.accent}18`, borderColor: `${selectedVibe.accent}30` }]}>
                        <Ionicons name={track.icon} size={18} color={selectedVibe.accent} />
                      </View>
                      <View style={styles.audioTextWrap}>
                        <View style={styles.audioTitleRow}>
                          <Text style={styles.audioTitle}>{track.title}</Text>
                          <Text style={styles.audioDuration}>{track.durationLabel}</Text>
                        </View>
                        <Text style={styles.audioTone}>{track.tone}</Text>
                        <Text style={styles.audioNote}>{track.note}</Text>
                      </View>
                    </View>

                    <Pressable
                      style={[styles.audioPlayButton, isPlayingThisTrack && { backgroundColor: selectedVibe.accent, borderColor: selectedVibe.accent }]}
                      onPress={() => handlePlayTrack(track.id)}
                    >
                      <Ionicons
                        name={isPlayingThisTrack ? "pause" : "play"}
                        size={16}
                        color={isPlayingThisTrack ? "#FFFFFF" : "#3D5163"}
                      />
                    </Pressable>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.groundingHeaderRow}>
              <View style={styles.groundingHeaderText}>
                <Text style={styles.sectionTitle}>Move through your senses</Text>
                <Text style={styles.sectionDescription}>
                  No need to rush. Let the room hold steady while you name each sense.
                </Text>
              </View>
              <Pressable style={styles.resetButton} onPress={handleResetGrounding}>
                <Ionicons name="refresh-outline" size={14} color="#5B6D7B" />
                <Text style={styles.resetButtonText}>Reset</Text>
              </Pressable>
            </View>

            <View style={styles.progressTrackWrap}>
              <View style={styles.progressTrackBg}>
                <View style={[styles.progressTrackFill, { width: progressWidth, backgroundColor: selectedVibe.accent }]} />
              </View>
              <Text style={styles.progressText}>{completedCount}/5 senses checked in</Text>
            </View>

            <View style={styles.stepChipWrap}>
              {GROUNDING_STEPS.map((step) => {
                const isActive = step.id === activeStepId;
                const isDone = completedStepIds.includes(step.id);

                return (
                  <Pressable
                    key={step.id}
                    style={[
                      styles.stepChip,
                      isActive && [styles.stepChipActive, { borderColor: selectedVibe.edge, backgroundColor: `${selectedVibe.accent}18` }],
                      isDone && styles.stepChipDone,
                    ]}
                    onPress={() => setActiveStepId(step.id)}
                  >
                    <View style={[styles.stepCountBadge, isDone && { backgroundColor: selectedVibe.accent }]}>
                      <Text style={[styles.stepCountBadgeText, isDone && styles.stepCountBadgeTextDone]}>{step.count}</Text>
                    </View>
                    <Text style={styles.stepChipText}>{step.sense}</Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={[styles.activeStepCard, { borderColor: `${selectedVibe.accent}33` }]}>
              <View style={styles.activeStepTopRow}>
                <View>
                  <Text style={styles.activeStepEyebrow}>Current sense</Text>
                  <Text style={styles.activeStepTitle}>{activeStep.title}</Text>
                </View>
                <View style={[styles.activeStepCountWrap, { backgroundColor: `${selectedVibe.accent}20`, borderColor: `${selectedVibe.accent}34` }]}>
                  <Text style={[styles.activeStepCount, { color: selectedVibe.accent }]}>{activeStep.count}</Text>
                </View>
              </View>

              <Text style={styles.activeStepHelper}>{activeStep.helper}</Text>

              <View style={styles.exampleList}>
                {activeStep.examples.map((example) => (
                  <View key={example} style={styles.examplePill}>
                    <Ionicons name="ellipse" size={6} color={selectedVibe.accent} />
                    <Text style={styles.exampleText}>{example}</Text>
                  </View>
                ))}
              </View>

              {groundingComplete ? (
                <View style={[styles.completionCard, { backgroundColor: `${selectedVibe.accent}16`, borderColor: `${selectedVibe.accent}30` }]}>
                  <Ionicons name="checkmark-circle" size={18} color={selectedVibe.accent} />
                  <Text style={styles.completionText}>
                    You moved through all five senses. Stay here a little longer if the calm is helping.
                  </Text>
                </View>
              ) : null}

              <View style={[styles.stepActionRow, isCompact && styles.stepActionRowCompact]}>
                <Pressable
                  style={[
                    styles.primaryStepButton,
                    { backgroundColor: selectedVibe.accent },
                    isCompact && styles.primaryStepButtonCompact,
                    isCurrentStepDone && styles.primaryStepButtonDone,
                  ]}
                  onPress={handleMarkStepDone}
                >
                  <Ionicons name={isCurrentStepDone ? "checkmark-circle" : "checkmark"} size={16} color="#FFFFFF" />
                  <Text style={styles.primaryStepButtonText}>
                    {isCurrentStepDone ? "Already checked in" : "Mark this sense done"}
                  </Text>
                </Pressable>

                {currentStepIndex < GROUNDING_STEPS.length - 1 ? (
                  <Pressable style={[styles.secondaryStepButton, isCompact && styles.secondaryStepButtonCompact]} onPress={handleAdvanceStep}>
                    <Text style={styles.secondaryStepButtonText}>Next sense</Text>
                    <Ionicons name="arrow-forward" size={16} color="#455A69" />
                  </Pressable>
                ) : null}
              </View>
            </View>
          </View>

          <View style={styles.supportNote}>
            <Ionicons name="heart-outline" size={16} color="#5A7D63" />
            <Text style={styles.supportNoteText}>
              This space is meant to slow the moment down. If you need more support after grounding, you can return to other wellness tools or counseling options.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#EEF4F3",
  },
  topBar: {
    height: 52,
    borderBottomWidth: 1,
    borderBottomColor: "#E6ECF1",
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    shadowColor: "#777777",
    shadowOpacity: 0.12,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  topTitle: {
    color: "#33475C",
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "700",
  },
  topBarSpacer: {
    width: 36,
    height: 36,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 12,
    paddingTop: 14,
    paddingBottom: 36,
    alignItems: "center",
  },
  contentFrame: {
    maxWidth: 460,
  },
  sceneCard: {
    borderRadius: 30,
    overflow: "hidden",
    borderWidth: 1,
    marginBottom: 14,
    backgroundColor: "#DCE8E7",
    shadowColor: "#44545D",
    shadowOpacity: 0.14,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4,
  },
  sceneImage: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 18,
    justifyContent: "space-between",
  },
  sceneImageInner: {
    borderRadius: 30,
  },
  sceneOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  sceneDecorWrap: {
    ...StyleSheet.absoluteFillObject,
  },
  rainStreak: {
    position: "absolute",
    width: 2,
    borderRadius: 999,
  },
  waveBand: {
    position: "absolute",
    borderRadius: 999,
  },
  floatOrb: {
    position: "absolute",
  },
  twinkle: {
    position: "absolute",
  },
  sceneTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    columnGap: 12,
  },
  sceneBadge: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
  },
  sceneBadgeText: {
    color: "#FFFFFF",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
  },
  sceneMetaPill: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(20,29,38,0.28)",
  },
  sceneMetaPillText: {
    color: "#FFFFFF",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
  },
  sceneBody: {
    rowGap: 8,
  },
  sceneTitle: {
    color: "#FFFFFF",
    fontSize: 27,
    lineHeight: 32,
    fontWeight: "800",
    maxWidth: 280,
  },
  sceneDescription: {
    color: "rgba(255,255,255,0.92)",
    fontSize: 14,
    lineHeight: 20,
    maxWidth: 290,
  },
  sceneMoodLine: {
    color: "rgba(255,255,255,0.84)",
    fontSize: 13,
    lineHeight: 18,
    maxWidth: 272,
  },
  nowPlayingCard: {
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.92)",
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.9)",
  },
  nowPlayingTopRow: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 12,
  },
  nowPlayingTextWrap: {
    flex: 1,
  },
  nowPlayingEyebrow: {
    color: "#789087",
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  nowPlayingTitle: {
    color: "#2F4458",
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "700",
  },
  nowPlayingTone: {
    color: "#5F7384",
    fontSize: 13,
    lineHeight: 18,
  },
  heroPlayButton: {
    width: 42,
    height: 42,
    borderRadius: 999,
    backgroundColor: "#F3F7F6",
    borderWidth: 1,
    borderColor: "#E2EAE7",
    alignItems: "center",
    justifyContent: "center",
  },
  timelineTrack: {
    height: 7,
    borderRadius: 999,
    backgroundColor: "#E3ECE8",
    marginTop: 14,
    overflow: "hidden",
  },
  timelineFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#5D9E72",
  },
  timelineMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  timelineMetaText: {
    color: "#637687",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
  },
  sectionCard: {
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E1EAE8",
    paddingHorizontal: 14,
    paddingTop: 16,
    paddingBottom: 18,
    marginBottom: 14,
    shadowColor: "#596A74",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  sectionTitle: {
    color: "#2F4458",
    fontSize: 19,
    lineHeight: 24,
    fontWeight: "700",
  },
  sectionDescription: {
    color: "#627787",
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  vibeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 10,
    marginTop: 14,
  },
  vibeCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E4ECE8",
    backgroundColor: "#F8FBFA",
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 12,
  },
  vibeCardSelected: {
    borderWidth: 1.5,
  },
  vibeCardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    columnGap: 8,
    marginBottom: 10,
  },
  vibeIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  selectedTag: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  selectedTagText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "700",
  },
  vibeTitle: {
    color: "#33495E",
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "700",
    marginBottom: 5,
  },
  vibeNote: {
    color: "#667B8A",
    fontSize: 13,
    lineHeight: 18,
  },
  audioList: {
    rowGap: 10,
    marginTop: 14,
  },
  audioCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E3ECE8",
    backgroundColor: "#FBFCFC",
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    columnGap: 12,
  },
  audioCardSelected: {
    borderWidth: 1.5,
  },
  audioCardLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    columnGap: 10,
  },
  audioIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  audioTextWrap: {
    flex: 1,
  },
  audioTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    columnGap: 10,
    marginBottom: 3,
  },
  audioTitle: {
    flex: 1,
    color: "#314758",
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "700",
  },
  audioDuration: {
    color: "#748692",
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "700",
  },
  audioTone: {
    color: "#536A7A",
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 3,
  },
  audioNote: {
    color: "#758693",
    fontSize: 12,
    lineHeight: 17,
  },
  audioPlayButton: {
    width: 38,
    height: 38,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#DCE5E2",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  groundingHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    columnGap: 12,
  },
  groundingHeaderText: {
    flex: 1,
  },
  resetButton: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#F3F6F7",
    borderWidth: 1,
    borderColor: "#E4EAEE",
  },
  resetButtonText: {
    color: "#5B6D7B",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
  },
  progressTrackWrap: {
    marginTop: 14,
  },
  progressTrackBg: {
    height: 8,
    borderRadius: 999,
    backgroundColor: "#E5EEEA",
    overflow: "hidden",
  },
  progressTrackFill: {
    height: "100%",
    borderRadius: 999,
  },
  progressText: {
    color: "#6B7D88",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
    marginTop: 7,
  },
  stepChipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: 8,
    rowGap: 8,
    marginTop: 14,
  },
  stepChip: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E2E8EC",
    backgroundColor: "#FFFFFF",
  },
  stepChipActive: {
    borderWidth: 1.5,
  },
  stepChipDone: {
    backgroundColor: "#F5FBF7",
  },
  stepCountBadge: {
    width: 24,
    height: 24,
    borderRadius: 999,
    backgroundColor: "#EEF3F5",
    alignItems: "center",
    justifyContent: "center",
  },
  stepCountBadgeText: {
    color: "#4B6172",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
  },
  stepCountBadgeTextDone: {
    color: "#FFFFFF",
  },
  stepChipText: {
    color: "#465A6A",
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "700",
  },
  activeStepCard: {
    borderRadius: 20,
    borderWidth: 1,
    backgroundColor: "#FAFCFC",
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 14,
    marginTop: 14,
  },
  activeStepTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    columnGap: 10,
  },
  activeStepEyebrow: {
    color: "#72868F",
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  activeStepTitle: {
    flexShrink: 1,
    color: "#2E4557",
    fontSize: 18,
    lineHeight: 23,
    fontWeight: "700",
    maxWidth: 260,
  },
  activeStepCountWrap: {
    minWidth: 42,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  activeStepCount: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "800",
  },
  activeStepHelper: {
    color: "#5D7282",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 12,
  },
  exampleList: {
    rowGap: 8,
    marginTop: 14,
  },
  examplePill: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 8,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E4EBEE",
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  exampleText: {
    flex: 1,
    color: "#4E6577",
    fontSize: 13,
    lineHeight: 18,
  },
  completionCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    columnGap: 10,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginTop: 14,
  },
  completionText: {
    flex: 1,
    color: "#3F5B67",
    fontSize: 13,
    lineHeight: 18,
  },
  stepActionRow: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 10,
    marginTop: 16,
  },
  stepActionRowCompact: {
    flexDirection: "column",
    alignItems: "stretch",
  },
  primaryStepButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    columnGap: 8,
    paddingHorizontal: 14,
  },
  primaryStepButtonCompact: {
    width: "100%",
  },
  primaryStepButtonDone: {
    opacity: 0.82,
  },
  primaryStepButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "700",
  },
  secondaryStepButton: {
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#DFE7EB",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    columnGap: 8,
  },
  secondaryStepButtonCompact: {
    width: "100%",
  },
  secondaryStepButtonText: {
    color: "#455A69",
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "700",
  },
  supportNote: {
    borderRadius: 18,
    backgroundColor: "#F7FBF8",
    borderWidth: 1,
    borderColor: "#DFECE3",
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "flex-start",
    columnGap: 10,
    marginBottom: 6,
  },
  supportNoteText: {
    flex: 1,
    color: "#587166",
    fontSize: 13,
    lineHeight: 19,
  },
});
