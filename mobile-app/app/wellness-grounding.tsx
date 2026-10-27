import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useCallback, useEffect, useState, type ComponentProps } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useAuthSession } from "../lib/auth-session";
import { AppleTopBar } from "../components/ui/AppleTopBar";
import { unlockAchievement } from "../lib/achievements";
import { startBgmTrack, SOUND_ASSETS } from "../lib/sound-effects";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

type SenseMoment = {
  accent: string;
  count: string;
  icon: IoniconName;
  note: string;
  sense: string;
  hint: string;
};

const SENSE_MOMENTS: SenseMoment[] = [
  {
    count: "5",
    sense: "See",
    note: "Notice five steady details around you.",
    hint: "Look for colors, textures, shadows, or small objects in your space.",
    icon: "eye-outline",
    accent: "#60B8C6",
  },
  {
    count: "4",
    sense: "Feel",
    note: "Let four points of physical contact bring you back.",
    hint: "Notice your feet on the floor, your back against the chair, or the fabric of your clothes.",
    icon: "hand-left-outline",
    accent: "#72A66A",
  },
  {
    count: "3",
    sense: "Hear",
    note: "Listen for three layers of sound.",
    hint: "Notice distant room hums, birds outside, or the quiet sound of your own breath.",
    icon: "ear-outline",
    accent: "#7B8FC7",
  },
  {
    count: "2",
    sense: "Smell",
    note: "Find two scents, or simply notice the cool air.",
    hint: "A sip of coffee, freshly washed shirt, or the ambient scent of the room.",
    icon: "flower-outline",
    accent: "#B98966",
  },
  {
    count: "1",
    sense: "Taste",
    note: "End with one taste, sip of water, or slow conscious breath.",
    hint: "Take a gentle sip of water, notice a lingering mint, or take one deep exhale.",
    icon: "cafe-outline",
    accent: "#C77F90",
  },
];

const MEDITATION_CUES = [
  "Settle your shoulders and un-clench your jaw before you start.",
  "Take your time with each sense—there is zero rush.",
  "If your mind wanders, gently guide it back to the next sense.",
];

export default function WellnessGroundingScreen() {
  const { user } = useAuthSession();
  const [activeStep, setActiveStep] = useState<number>(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  useEffect(() => {
    const bgm = startBgmTrack(SOUND_ASSETS.wellnessToolsBgm, 0.28);
    return () => bgm.stop();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (user?.studentNumber) {
        unlockAchievement("a-softer-minute", user.studentNumber);
      }
    }, 5000);
    return () => clearTimeout(timer);
  }, [user?.studentNumber]);

  const { width } = useWindowDimensions();
  const compact = width < 390;

  const handleStepPress = (idx: number) => {
    setActiveStep(idx);
    setCompletedSteps((prev) => {
      const next = new Set(prev);
      next.add(idx);
      return next;
    });
  };

  const isAllCompleted = completedSteps.size === SENSE_MOMENTS.length;
  const currentSense = SENSE_MOMENTS[activeStep] || SENSE_MOMENTS[0];

  return (
    <View style={styles.screen}>
      <AppleTopBar title="5-4-3-2-1 Sensory Grounding" onBack={() => router.back()} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, compact && styles.scrollContentCompact]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.contentFrame}>
          {/* Hero Header */}
          <View style={[styles.heroCard, compact && styles.heroCardCompact]}>
            <View style={styles.heroTopRow}>
              <View style={styles.heroBadge}>
                <Ionicons name="leaf-outline" size={16} color="#2E6B74" />
                <Text style={styles.heroBadgeText}>Sensory Reset</Text>
              </View>
              <View style={styles.heroTimePill}>
                <Ionicons name="sparkles-outline" size={14} color="#58646E" />
                <Text style={styles.heroTimeText}>5-4-3-2-1</Text>
              </View>
            </View>

            <Text style={[styles.heroTitle, compact && styles.heroTitleCompact]}>
              5-4-3-2-1 Grounding Practice
            </Text>
            <Text style={[styles.heroDescription, compact && styles.heroDescriptionCompact]}>
              A gentle self-guided practice for naming what is around you, slowing anxious thoughts, and returning to the present moment.
            </Text>

            {/* Before You Begin Cues */}
          <View style={[styles.cueCard, compact && styles.cueCardCompact]}>
            <View style={styles.cueHeaderIcon}>
              <Ionicons name="leaf-outline" size={20} color="#4F7E5B" />
            </View>
            <View style={styles.cueTextWrap}>
              <Text style={styles.cueTitle}>Before you begin</Text>
              <View style={styles.cueList}>
                {MEDITATION_CUES.map((cue) => (
                  <View key={cue} style={styles.cueItem}>
                    <View style={styles.cueDot} />
                    <Text style={styles.cueText}>{cue}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>

            {/* Active Sense Showcase Card */}
            <View style={[styles.activeSenseCard, { borderColor: currentSense.accent + "55" }]}>
              <View style={styles.activeSenseHeader}>
                <View style={[styles.activeSenseCountBadge, { backgroundColor: currentSense.accent + "22", borderColor: currentSense.accent }]}>
                  <Text style={[styles.activeSenseCountText, { color: currentSense.accent }]}>{currentSense.count}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.activeSenseLabel}>Things to {currentSense.sense}</Text>
                  <Text style={styles.activeSenseNote}>{currentSense.note}</Text>
                </View>
                <Ionicons name={currentSense.icon} size={28} color={currentSense.accent} />
              </View>

              <View style={styles.activeSenseHintBox}>
                <Ionicons name="bulb-outline" size={15} color="#5B7065" style={{ marginTop: 2, marginRight: 6 }} />
                <Text style={styles.activeSenseHintText}>{currentSense.hint}</Text>
              </View>

              {isAllCompleted ? (
                <View style={styles.completionBanner}>
                  <View style={styles.completionIconWrap}>
                    <Ionicons name="checkmark-done" size={18} color="#2D6B3C" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.completionTitle}>You are centered and grounded 🍃</Text>
                    <Text style={styles.completionText}>
                      You completed all 5 senses. Take this calm with you.
                    </Text>
                  </View>
                  <Pressable
                    style={styles.repeatBtn}
                    onPress={() => {
                      setCompletedSteps(new Set());
                      setActiveStep(0);
                    }}
                    hitSlop={6}
                    accessibilityLabel="Practice again"
                  >
                    <Ionicons name="refresh" size={13} color="#2D6B3C" />
                    <Text style={styles.repeatBtnText}>Restart</Text>
                  </Pressable>
                </View>
              ) : null}

              <Pressable
                style={[
                  styles.nextSenseBtn,
                  isAllCompleted
                    ? styles.nextSenseBtnDisabled
                    : { backgroundColor: currentSense.accent },
                ]}
                disabled={isAllCompleted}
                onPress={() => {
                  setCompletedSteps((prev) => new Set(prev).add(activeStep));
                  if (activeStep < SENSE_MOMENTS.length - 1) {
                    setActiveStep(activeStep + 1);
                  }
                }}
              >
                <Text
                  style={[
                    styles.nextSenseBtnText,
                    isAllCompleted && styles.nextSenseBtnTextDisabled,
                  ]}
                >
                  {isAllCompleted
                    ? "Grounding Completed ✓"
                    : activeStep < SENSE_MOMENTS.length - 1
                    ? "Next Sense (" + SENSE_MOMENTS[activeStep + 1].sense + ") →"
                    : "Complete Grounding ✓"}
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Senses Step-by-Step Overview */}
          <View style={[styles.sensesCard, compact && styles.sensesCardCompact]}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionEyebrow}>Sensory Roadmap</Text>
              <Text style={[styles.sectionTitle, compact && styles.sectionTitleCompact]}>
                Step through each sense
              </Text>
              <Text style={styles.sectionDescription}>
                Tap any step to explore or take them in sequence.
              </Text>
            </View>

            <View style={styles.senseList}>
              {SENSE_MOMENTS.map((item, idx) => {
                const isActive = activeStep === idx;
                const isDone = completedSteps.has(idx);

                return (
                  <Pressable
                    key={item.sense}
                    style={[
                      styles.senseItem,
                      isActive && { borderColor: item.accent, backgroundColor: item.accent + "0C" },
                    ]}
                    onPress={() => handleStepPress(idx)}
                  >
                    <View
                      style={[
                        styles.senseCount,
                        {
                          backgroundColor: isDone ? item.accent : item.accent + "1F",
                          borderColor: item.accent,
                        },
                      ]}
                    >
                      {isDone ? (
                        <Ionicons name="checkmark" size={18} color="#FFFFFF" />
                      ) : (
                        <Text style={[styles.senseCountText, { color: item.accent }]}>{item.count}</Text>
                      )}
                    </View>

                    <View style={[styles.senseIconWrap, { backgroundColor: item.accent + "16", borderColor: item.accent + "30" }]}>
                      <Ionicons name={item.icon} size={17} color={item.accent} />
                    </View>

                    <View style={styles.senseTextWrap}>
                      <Text style={styles.senseTitle}>{item.sense}</Text>
                      <Text style={styles.senseNote}>{item.note}</Text>
                    </View>

                    {isActive ? (
                      <View style={[styles.activePill, { backgroundColor: item.accent }]}>
                        <Text style={styles.activePillText}>Active</Text>
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Supportive Disclaimer */}
          <View style={[styles.supportNote, compact && styles.supportNoteCompact]}>
            <Ionicons name="shield-checkmark-outline" size={17} color="#4E6E5C" />
            <Text style={styles.supportNoteText}>
              This exercise is a self-guided grounding tool. If you feel overwhelmed, take slow breaths or explore our consultation options for support.
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#EFF5F2",
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
    fontFamily: "Outfit-Bold",
  },
  topBarSpacer: {
    width: 36,
    height: 36,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 78,
    paddingBottom: 40,
    alignItems: "center",
  },
  scrollContentCompact: {
    paddingHorizontal: 12,
  },
  contentFrame: {
    width: "100%",
    maxWidth: 460,
    alignSelf: "center",
  },
  heroCard: {
    width: "100%",
    borderRadius: 28,
    backgroundColor: "#FBFEFC",
    borderWidth: 1,
    borderColor: "#D9E8E4",
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 16,
    marginBottom: 12,
    shadowColor: "#5A6D70",
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4,
  },
  heroCardCompact: {
    borderRadius: 24,
    paddingHorizontal: 12,
    paddingTop: 12,
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    columnGap: 10,
    marginBottom: 12,
  },
  heroBadge: {
    flexShrink: 1,
    flexDirection: "row",
    alignItems: "center",
    columnGap: 7,
    borderRadius: 999,
    backgroundColor: "#EAF7F6",
    borderWidth: 1,
    borderColor: "#CBE9E7",
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  heroBadgeText: {
    color: "#2E6B74",
    fontSize: 12,
    lineHeight: 16,
    fontFamily: "Outfit-Bold",
  },
  heroTimePill: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 6,
    borderRadius: 999,
    backgroundColor: "#F5F7F1",
    borderWidth: 1,
    borderColor: "#E2E8DA",
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  heroTimeText: {
    color: "#58646E",
    fontSize: 12,
    lineHeight: 16,
    fontFamily: "Outfit-Bold",
  },
  heroTitle: {
    color: "#263E4E",
    fontSize: 26,
    lineHeight: 32,
    fontFamily: "Outfit-Bold",
    marginBottom: 8,
  },
  heroTitleCompact: {
    fontSize: 22,
    lineHeight: 28,
  },
  heroDescription: {
    color: "#607584",
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 14,
  },
  heroDescriptionCompact: {
    fontSize: 13,
    lineHeight: 19,
  },
  activeSenseCard: {
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    padding: 14,
    marginTop: 6,
    shadowColor: "#5A6D70",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  activeSenseHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
  },
  activeSenseCountBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  activeSenseCountText: {
    fontSize: 22,
    lineHeight: 26,
    fontFamily: "Outfit-Bold",
  },
  activeSenseLabel: {
    fontSize: 17,
    fontFamily: "Outfit-Bold",
    color: "#2A3E31",
  },
  activeSenseNote: {
    fontSize: 13,
    fontFamily: "Outfit-Medium",
    color: "#5F7466",
    marginTop: 2,
  },
  activeSenseHintBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#F4F7F4",
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
  },
  activeSenseHintText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    fontFamily: "Outfit",
    color: "#4A5F52",
  },
  completionBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EDF7EE",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#CCE5CF",
    paddingHorizontal: 12,
    paddingVertical: 10,
    columnGap: 10,
    marginBottom: 10,
  },
  completionIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#DCF2DE",
    alignItems: "center",
    justifyContent: "center",
  },
  completionTitle: {
    fontSize: 13,
    fontFamily: "Outfit-Bold",
    color: "#245A30",
    marginBottom: 2,
  },
  completionText: {
    fontSize: 11,
    fontFamily: "Outfit-Medium",
    color: "#4A6E52",
    lineHeight: 15,
  },
  repeatBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#DCF2DE",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    columnGap: 3,
  },
  repeatBtnText: {
    fontSize: 11,
    fontFamily: "Outfit-Bold",
    color: "#2D6B3C",
  },
  nextSenseBtnDisabled: {
    backgroundColor: "#E2ECE2",
    borderColor: "#C5D8C4",
    borderWidth: 1,
  },
  nextSenseBtnTextDisabled: {
    color: "#607865",
  },
  nextSenseBtn: {
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  nextSenseBtnText: {
    color: "#FFFFFF",
    fontSize: 13.5,
    fontFamily: "Outfit-Bold",
  },
  sensesCard: {
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DDE9E5",
    paddingHorizontal: 14,
    paddingTop: 15,
    paddingBottom: 14,
    marginBottom: 12,
    shadowColor: "#6C777C",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  sensesCardCompact: {
    borderRadius: 22,
    paddingHorizontal: 12,
  },
  sectionHeader: {
    marginBottom: 12,
  },
  sectionEyebrow: {
    color: "#6D8588",
    fontSize: 11,
    lineHeight: 15,
    fontFamily: "Outfit-Bold",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  sectionTitle: {
    color: "#2B4354",
    fontSize: 21,
    lineHeight: 27,
    fontFamily: "Outfit-Bold",
    marginBottom: 5,
  },
  sectionTitleCompact: {
    fontSize: 19,
    lineHeight: 25,
  },
  sectionDescription: {
    color: "#627887",
    fontSize: 13,
    lineHeight: 19,
  },
  senseList: {
    rowGap: 9,
  },
  senseItem: {
    minHeight: 70,
    borderRadius: 18,
    backgroundColor: "#F8FBFA",
    borderWidth: 1,
    borderColor: "#E3ECE9",
    flexDirection: "row",
    alignItems: "center",
    columnGap: 10,
    paddingHorizontal: 11,
    paddingVertical: 10,
  },
  senseCount: {
    width: 36,
    height: 36,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  senseCountText: {
    fontSize: 18,
    lineHeight: 22,
    fontFamily: "Outfit-Bold",
  },
  senseIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  senseTextWrap: {
    flex: 1,
  },
  senseTitle: {
    color: "#2D4352",
    fontSize: 15,
    lineHeight: 20,
    fontFamily: "Outfit-Bold",
  },
  senseNote: {
    color: "#657886",
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  activePill: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  activePillText: {
    color: "#FFFFFF",
    fontSize: 10.5,
    fontFamily: "Outfit-Bold",
  },
  cueCard: {
    borderRadius: 22,
    backgroundColor: "#F5FAF4",
    borderWidth: 1,
    borderColor: "#DCE9D9",
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "flex-start",
    columnGap: 12,
    marginBottom: 12,
  },
  cueCardCompact: {
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  cueHeaderIcon: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: "#E8F5E8",
    borderWidth: 1,
    borderColor: "#D2E7D1",
    alignItems: "center",
    justifyContent: "center",
  },
  cueTextWrap: {
    flex: 1,
  },
  cueTitle: {
    color: "#334A3B",
    fontSize: 16,
    lineHeight: 21,
    fontFamily: "Outfit-Bold",
    marginBottom: 8,
  },
  cueList: {
    rowGap: 7,
  },
  cueItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    columnGap: 8,
  },
  cueDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: "#77A97A",
    marginTop: 7,
  },
  cueText: {
    flex: 1,
    color: "#5E7467",
    fontSize: 13,
    lineHeight: 18,
  },
  supportNote: {
    width: "100%",
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
  supportNoteCompact: {
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  supportNoteText: {
    flex: 1,
    color: "#587166",
    fontSize: 13,
    lineHeight: 19,
  },
});

