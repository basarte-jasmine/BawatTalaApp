import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const PHASE_SECONDS = 4;
const CYCLE_SECONDS = PHASE_SECONDS * 2;

type Phase = "INHALE" | "EXHALE";

function getCycleState(startedAt: number) {
  const elapsedSeconds = ((Date.now() - startedAt) / 1000) % CYCLE_SECONDS;
  const inInhale = elapsedSeconds < PHASE_SECONDS;
  const phase: Phase = inInhale ? "INHALE" : "EXHALE";
  const position = inInhale ? elapsedSeconds : elapsedSeconds - PHASE_SECONDS;
  const secondsLeft = Math.max(1, PHASE_SECONDS - Math.floor(position));
  return { phase, secondsLeft };
}

export default function WellnessBreathingScreen() {
  const { width } = useWindowDimensions();
  const frame = Math.min(width, 412);
  const ringSize = Math.max(224, Math.min(frame - 54, 286));
  const middleRingSize = ringSize * 0.78;
  const innerRingSize = ringSize * 0.57;
  const sessionStartedAtRef = useRef<number | null>(null);
  const [phase, setPhase] = useState<Phase>("INHALE");
  const [secondsLeft, setSecondsLeft] = useState(PHASE_SECONDS);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const breathPulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;

    if (isSessionActive) {
      breathPulse.setValue(0);
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(breathPulse, {
            toValue: 1,
            duration: PHASE_SECONDS * 1000,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(breathPulse, {
            toValue: 0,
            duration: PHASE_SECONDS * 1000,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
      );
      loop.start();
    } else {
      breathPulse.stopAnimation(() => {
        breathPulse.setValue(0);
      });
    }

    return () => {
      loop?.stop();
    };
  }, [breathPulse, isSessionActive]);

  useEffect(() => {
    if (!isSessionActive || sessionStartedAtRef.current === null) {
      setPhase("INHALE");
      setSecondsLeft(PHASE_SECONDS);
      return;
    }

    const sync = () => {
      if (sessionStartedAtRef.current === null) {
        return;
      }

      const cycle = getCycleState(sessionStartedAtRef.current);
      setPhase(cycle.phase);
      setSecondsLeft(cycle.secondsLeft);
    };

    sync();
    const timer = setInterval(sync, 120);
    return () => clearInterval(timer);
  }, [isSessionActive]);

  const outerScale = breathPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.95, 1],
  });
  const middleScale = breathPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.9, 1],
  });
  const innerScale = breathPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.86, 1],
  });

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/wellness-tools");
  };

  const handleStartSession = () => {
    sessionStartedAtRef.current = Date.now();
    setPhase("INHALE");
    setSecondsLeft(PHASE_SECONDS);
    setIsSessionActive(true);
  };

  const handleStopSession = () => {
    sessionStartedAtRef.current = null;
    setIsSessionActive(false);
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
        <View style={styles.heroCard}>
          <View style={styles.heroBadge}>
            <Ionicons name="leaf-outline" size={16} color="#4B7C2E" />
            <Text style={styles.heroBadgeText}>Wellness Tool</Text>
          </View>
          <Text style={styles.selectedToolTitle}>Diaphragmatic Breathing</Text>
          <Text style={styles.selectedToolDesc}>
            Regulate your nervous system through a slower, steadier breathing rhythm.
          </Text>
        </View>

        <View style={styles.instructionsCard}>
          <Text style={styles.instructionsEyebrow}>Guided Rhythm</Text>
          <Text style={styles.instructions}>
            Press start when you are ready, then follow the circle as it expands and softens.
          </Text>
        </View>

        <View style={styles.breathCard}>
          <View style={styles.phasePill}>
            <Text style={styles.phasePillText}>
              {isSessionActive ? (phase === "INHALE" ? "Breathe In" : "Breathe Out") : "Press start when ready"}
            </Text>
          </View>
          <View style={styles.circleWrap}>
            <Animated.View
              style={[
                styles.outerRing,
                {
                  width: ringSize,
                  height: ringSize,
                  borderRadius: ringSize / 2,
                  transform: [{ scale: outerScale }],
                },
              ]}
            >
              <Animated.View
                style={[
                  styles.middleRing,
                  {
                    width: middleRingSize,
                    height: middleRingSize,
                    borderRadius: middleRingSize / 2,
                    transform: [{ scale: middleScale }],
                  },
                ]}
              >
                <Animated.View
                  style={[
                    styles.innerRing,
                    {
                      width: innerRingSize,
                      height: innerRingSize,
                      borderRadius: innerRingSize / 2,
                      transform: [{ scale: innerScale }],
                    },
                  ]}
                >
                  <Text style={styles.phaseText}>{isSessionActive ? phase : "READY"}</Text>
                  <Text style={styles.secondsText}>{isSessionActive ? `${secondsLeft} Seconds` : "Start to begin"}</Text>
                </Animated.View>
              </Animated.View>
            </Animated.View>
          </View>
          <Text style={styles.sessionHint}>
            {isSessionActive
              ? "You can stop the exercise any time if you need a pause."
              : "The breathing guide will stay still until you choose to begin."}
          </Text>
          <Pressable
            style={[styles.sessionButton, isSessionActive ? styles.stopButton : styles.startButton]}
            accessibilityRole="button"
            onPress={isSessionActive ? handleStopSession : handleStartSession}
          >
            <Ionicons
              name={isSessionActive ? "stop-circle-outline" : "play-circle-outline"}
              size={18}
              color="#FFFFFF"
            />
            <Text style={styles.sessionButtonText}>{isSessionActive ? "Stop exercise" : "Start exercise"}</Text>
          </Pressable>
        </View>

        <View style={styles.tipCard}>
          <Ionicons name="bulb-outline" size={18} color="#5B8B35" />
          <Text style={styles.tipText}>
            Tip: let your stomach expand as you inhale, and keep your shoulders soft instead of lifting them.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F7FAF6",
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
    paddingBottom: 28,
  },
  heroCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#CFE7B2",
    backgroundColor: "#DDF3C0",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
    marginBottom: 12,
    shadowColor: "#66737E",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  heroBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    columnGap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.74)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.86)",
    marginBottom: 10,
  },
  heroBadgeText: {
    color: "#4B7C2E",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
  },
  selectedToolTitle: {
    color: "#33495D",
    fontSize: 21,
    lineHeight: 27,
    fontWeight: "700",
    marginBottom: 6,
  },
  selectedToolDesc: {
    color: "#496158",
    fontSize: 14,
    lineHeight: 20,
  },
  instructionsCard: {
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E6EEE7",
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 16,
  },
  instructionsEyebrow: {
    color: "#6E875A",
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  instructions: {
    color: "#33475C",
    fontSize: 15,
    lineHeight: 21,
  },
  breathCard: {
    borderRadius: 28,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E6EEE7",
    paddingHorizontal: 10,
    paddingTop: 18,
    paddingBottom: 18,
    marginBottom: 16,
    shadowColor: "#66737E",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  phasePill: {
    alignSelf: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#EEF8E5",
    borderWidth: 1,
    borderColor: "#D8EBC7",
    marginBottom: 16,
  },
  phasePillText: {
    color: "#4B7C2E",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
  },
  circleWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  outerRing: {
    borderWidth: 12,
    borderColor: "#67C343",
    alignItems: "center",
    justifyContent: "center",
  },
  middleRing: {
    borderWidth: 11,
    borderColor: "#B3EA84",
    alignItems: "center",
    justifyContent: "center",
  },
  innerRing: {
    borderWidth: 9,
    borderColor: "#3D8E1A",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  phaseText: {
    color: "#334254",
    fontSize: 22 / 1.1,
    lineHeight: 30 / 1.1,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  secondsText: {
    color: "#334254",
    fontSize: 21 / 1.1,
    lineHeight: 27 / 1.1,
    fontWeight: "700",
  },
  sessionHint: {
    color: "#61717F",
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    marginTop: 18,
    marginBottom: 14,
    paddingHorizontal: 10,
  },
  sessionButton: {
    minHeight: 50,
    borderRadius: 999,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    columnGap: 8,
  },
  startButton: {
    backgroundColor: "#5CBA36",
  },
  stopButton: {
    backgroundColor: "#5C6F7E",
  },
  sessionButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "700",
  },
  tipCard: {
    borderRadius: 18,
    backgroundColor: "#F8FCF3",
    borderWidth: 1,
    borderColor: "#E0ECD5",
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "flex-start",
    columnGap: 10,
  },
  tipText: {
    flex: 1,
    color: "#4D6072",
    fontSize: 13,
    lineHeight: 19,
  },
});
