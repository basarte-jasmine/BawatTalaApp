import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
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
  const startedAt = useMemo(() => Date.now(), []);
  const [phase, setPhase] = useState<Phase>("INHALE");
  const [secondsLeft, setSecondsLeft] = useState(PHASE_SECONDS);
  const breathPulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
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
    return () => loop.stop();
  }, [breathPulse]);

  useEffect(() => {
    const sync = () => {
      const cycle = getCycleState(startedAt);
      setPhase(cycle.phase);
      setSecondsLeft(cycle.secondsLeft);
    };
    sync();
    const timer = setInterval(sync, 120);
    return () => clearInterval(timer);
  }, [startedAt]);

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
        <View style={styles.selectedToolCard}>
          <Text style={styles.selectedToolTitle}>Diaphragmatic Breathing</Text>
          <Text style={styles.selectedToolDesc}>
            Regulate heart rate and reduce physiological stress responses through breathing patterns.
          </Text>
        </View>

        <Text style={styles.instructions}>
          Follow the visual guide below to lower your heart rate and reduce physiological stress.
        </Text>

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
                <Text style={styles.phaseText}>{phase}</Text>
                <Text style={styles.secondsText}>{secondsLeft} Seconds</Text>
              </Animated.View>
            </Animated.View>
          </Animated.View>
        </View>

        <Text style={styles.tipText}>
          Tip: Focus on expanding your stomach as you breathe in, keeping your shoulders relaxed.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#ECECEC",
  },
  topBar: {
    height: 52,
    borderBottomWidth: 1,
    borderBottomColor: "#D3D5D7",
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
    paddingHorizontal: 6,
    paddingTop: 10,
    paddingBottom: 22,
  },
  selectedToolCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#B8DFAB",
    backgroundColor: "#C9EEB8",
    paddingHorizontal: 10,
    paddingTop: 6,
    paddingBottom: 8,
    marginBottom: 42,
  },
  selectedToolTitle: {
    color: "#33495D",
    fontSize: 16.5,
    lineHeight: 23,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 3,
  },
  selectedToolDesc: {
    color: "#31485B",
    fontSize: 15,
    lineHeight: 21,
  },
  instructions: {
    color: "#33475C",
    fontSize: 31 / 2,
    lineHeight: 22,
    marginBottom: 34,
    paddingHorizontal: 4,
  },
  circleWrap: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
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
    backgroundColor: "#ECECEC",
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
  tipText: {
    color: "#2F4156",
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    paddingHorizontal: 28,
  },
});
