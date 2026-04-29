import { Ionicons } from "@expo/vector-icons";
import { VideoView, useVideoPlayer } from "expo-video";
import { router } from "expo-router";
import { useEffect, useState, type ComponentProps } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

type SenseMoment = {
  accent: string;
  count: string;
  icon: IoniconName;
  note: string;
  sense: string;
};

const MEDITATION_VIDEO = require("../assets/videos/The 5-4-3-2-1 Grounding Exercise to Manage Anxiety.mp4");

const SENSE_MOMENTS: SenseMoment[] = [
  {
    count: "5",
    sense: "See",
    note: "Notice five steady details around you.",
    icon: "eye-outline",
    accent: "#60B8C6",
  },
  {
    count: "4",
    sense: "Feel",
    note: "Let four points of contact bring you back.",
    icon: "hand-left-outline",
    accent: "#72A66A",
  },
  {
    count: "3",
    sense: "Hear",
    note: "Listen for three layers of sound.",
    icon: "ear-outline",
    accent: "#7B8FC7",
  },
  {
    count: "2",
    sense: "Smell",
    note: "Find two scents, or simply notice the air.",
    icon: "flower-outline",
    accent: "#B98966",
  },
  {
    count: "1",
    sense: "Taste",
    note: "End with one taste, sip, or slow breath.",
    icon: "cafe-outline",
    accent: "#C77F90",
  },
];

const MEDITATION_CUES = [
  "Settle your shoulders before you press play.",
  "Let the video carry the counting for you.",
  "Pause anytime and come back when your body feels ready.",
];

export default function WellnessGroundingScreen() {
  const { width } = useWindowDimensions();
  const compact = width < 390;
  const narrow = width < 350;
  const [videoReady, setVideoReady] = useState(false);

  const meditationPlayer = useVideoPlayer(MEDITATION_VIDEO, (player) => {
    player.loop = false;
    player.volume = 1;
    player.audioMixingMode = "doNotMix";
  });

  useEffect(() => {
    const loadingFallback = setTimeout(() => {
      setVideoReady(true);
    }, 1400);

    return () => {
      clearTimeout(loadingFallback);
      meditationPlayer.pause();
    };
  }, [meditationPlayer]);

  const handleBack = () => {
    meditationPlayer.pause();

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
        contentContainerStyle={[styles.scrollContent, compact && styles.scrollContentCompact]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.contentFrame}>
          <View style={[styles.heroCard, compact && styles.heroCardCompact]}>
            <View style={styles.heroTopRow}>
              <View style={styles.heroBadge}>
                <Ionicons name="play-circle-outline" size={16} color="#2E6B74" />
                <Text style={styles.heroBadgeText}>Video-led reset</Text>
              </View>
              <View style={styles.heroTimePill}>
                <Ionicons name="sparkles-outline" size={14} color="#58646E" />
                <Text style={styles.heroTimeText}>5-4-3-2-1</Text>
              </View>
            </View>

            <Text style={[styles.heroTitle, compact && styles.heroTitleCompact]}>
              5-4-3-2-1 Grounding Meditation
            </Text>
            <Text style={[styles.heroDescription, compact && styles.heroDescriptionCompact]}>
              A gentle guided video for naming what is around you, slowing anxious thoughts, and returning to the present moment.
            </Text>

            <View style={styles.videoFrame}>
              <VideoView
                player={meditationPlayer}
                style={styles.video}
                nativeControls
                contentFit="contain"
                fullscreenOptions={{ enable: true }}
                playsInline
                onFirstFrameRender={() => setVideoReady(true)}
              />
              {!videoReady ? (
                <View pointerEvents="none" style={styles.videoLoadingOverlay}>
                  <View style={styles.videoLoadingIcon}>
                    <Ionicons name="play" size={22} color="#FFFFFF" />
                  </View>
                  <Text style={styles.videoLoadingText}>Loading meditation video</Text>
                </View>
              ) : null}
            </View>

            <View style={[styles.videoMetaRow, narrow && styles.videoMetaRowStacked]}>
              <View style={styles.videoMetaItem}>
                <Ionicons name="videocam-outline" size={16} color="#356B73" />
                <Text style={styles.videoMetaText}>Guided exercise</Text>
              </View>
              <View style={styles.videoMetaItem}>
                <Ionicons name="heart-outline" size={16} color="#6C7250" />
                <Text style={styles.videoMetaText}>Anxiety reset</Text>
              </View>
              <View style={styles.videoMetaItem}>
                <Ionicons name="phone-portrait-outline" size={16} color="#6F617B" />
                <Text style={styles.videoMetaText}>Fullscreen ready</Text>
              </View>
            </View>
          </View>

          <View style={[styles.sensesCard, compact && styles.sensesCardCompact]}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionEyebrow}>Meditation Path</Text>
              <Text style={[styles.sectionTitle, compact && styles.sectionTitleCompact]}>
                Let the video lead each sense.
              </Text>
              <Text style={styles.sectionDescription}>
                The steps stay visible here as a quiet reference while the meditation plays.
              </Text>
            </View>

            <View style={styles.senseList}>
              {SENSE_MOMENTS.map((item) => (
                <View key={item.sense} style={styles.senseItem}>
                  <View style={[styles.senseCount, { backgroundColor: `${item.accent}1F`, borderColor: `${item.accent}42` }]}>
                    <Text style={[styles.senseCountText, { color: item.accent }]}>{item.count}</Text>
                  </View>
                  <View style={[styles.senseIconWrap, { backgroundColor: `${item.accent}16`, borderColor: `${item.accent}30` }]}>
                    <Ionicons name={item.icon} size={17} color={item.accent} />
                  </View>
                  <View style={styles.senseTextWrap}>
                    <Text style={styles.senseTitle}>{item.sense}</Text>
                    <Text style={styles.senseNote}>{item.note}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

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

          <View style={[styles.supportNote, compact && styles.supportNoteCompact]}>
            <Ionicons name="shield-checkmark-outline" size={17} color="#4E6E5C" />
            <Text style={styles.supportNoteText}>
              This meditation is a self-guided support tool. If the moment feels too heavy, you can return to the wellness menu or reach out through counseling options.
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
    paddingHorizontal: 16,
    paddingTop: 14,
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
    fontWeight: "800",
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
    fontWeight: "800",
  },
  heroTitle: {
    color: "#263E4E",
    fontSize: 27,
    lineHeight: 33,
    fontWeight: "800",
    marginBottom: 8,
  },
  heroTitleCompact: {
    fontSize: 23,
    lineHeight: 29,
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
  videoFrame: {
    width: "100%",
    aspectRatio: 16 / 9,
    borderRadius: 22,
    backgroundColor: "#142226",
    borderWidth: 1,
    borderColor: "#D5E5E1",
    overflow: "hidden",
    marginBottom: 12,
  },
  video: {
    width: "100%",
    height: "100%",
    backgroundColor: "#142226",
  },
  videoLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#142226",
    rowGap: 10,
  },
  videoLoadingIcon: {
    width: 48,
    height: 48,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#66AEB8",
  },
  videoLoadingText: {
    color: "#EAF6F6",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
  },
  videoMetaRow: {
    flexDirection: "row",
    columnGap: 8,
  },
  videoMetaRowStacked: {
    flexDirection: "column",
    rowGap: 8,
  },
  videoMetaItem: {
    flex: 1,
    minHeight: 42,
    borderRadius: 14,
    backgroundColor: "#F4F8F7",
    borderWidth: 1,
    borderColor: "#E0E9E6",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    columnGap: 6,
    paddingHorizontal: 8,
  },
  videoMetaText: {
    color: "#4E626B",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
    textAlign: "center",
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
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  sectionTitle: {
    color: "#2B4354",
    fontSize: 21,
    lineHeight: 27,
    fontWeight: "800",
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
    minHeight: 72,
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
    fontWeight: "900",
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
    fontWeight: "800",
  },
  senseNote: {
    color: "#657886",
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
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
    fontWeight: "800",
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
