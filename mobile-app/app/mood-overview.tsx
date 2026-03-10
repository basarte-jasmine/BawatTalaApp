import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type MoodStat = {
  color: string;
  count: number;
  emoji: string;
  id: string;
};

type CalendarMood =
  | "blue"
  | "yellow"
  | "red"
  | "orange"
  | "purple"
  | "outlined-green"
  | "selected-blue"
  | "none";

const SLEEPY_PET_IMAGE = require("../assets/images/pet-idle_sample.png");

const WEEKDAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

const MOOD_STATS: MoodStat[] = [
  { id: "happy", emoji: "\uD83D\uDE42", color: "#F8D330", count: 2 },
  { id: "calm", emoji: "\uD83D\uDE0C", color: "#97CFDA", count: 1 },
  { id: "sad", emoji: "\uD83D\uDE22", color: "#7EA9D9", count: 0 },
  { id: "stressed", emoji: "\uD83D\uDE23", color: "#F19137", count: 0 },
  { id: "angry", emoji: "\uD83D\uDE21", color: "#E86686", count: 0 },
  { id: "anxious", emoji: "\uD83D\uDE30", color: "#B895C8", count: 0 },
];

const MONTH_CALENDAR_STYLES: Record<number, CalendarMood> = {
  1: "blue",
  2: "yellow",
  3: "red",
  4: "purple",
  5: "purple",
  6: "red",
  7: "orange",
  8: "blue",
  9: "purple",
  10: "outlined-green",
  11: "yellow",
  12: "red",
  13: "orange",
  14: "yellow",
  15: "blue",
  16: "outlined-green",
  17: "purple",
  18: "blue",
  19: "yellow",
  20: "orange",
  21: "outlined-green",
  22: "outlined-green",
  23: "outlined-green",
  24: "yellow",
  25: "selected-blue",
  26: "none",
  27: "none",
  28: "none",
};

const DAYS = Array.from({ length: 28 }, (_, index) => index + 1);

const INSIGHT_TEXT = "You've been checking in regularly! Your most common mood this month has been \"Good\".";
const INSIGHT_FOOTNOTE = "Summary by Lumi, your virtual companion. Bawat Tala is not a substitute for professional mental health care.";

export default function MoodOverviewScreen() {
  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/home");
  };

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.topBar}>
        <Pressable style={styles.backButton} onPress={handleBack} accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={27} color="#3B454F" />
        </Pressable>
        <Text style={styles.topTitle}>Mood Overview</Text>
        <View style={styles.topBarSpacer} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <View>
              <Text style={styles.summaryMonth}>February 2026</Text>
              <Text style={styles.summarySub}>3 Check-ins</Text>
            </View>

            <View style={styles.commonMoodWrap}>
              <View style={styles.commonMoodFace}>
                <Text style={styles.commonMoodEmoji}>{"\uD83D\uDE42"}</Text>
              </View>
              <Text style={styles.commonMoodLabel}>Most Common</Text>
            </View>
          </View>

          <View style={styles.statsRow}>
            {MOOD_STATS.map((item) => (
              <View key={item.id} style={styles.statItem}>
                <View style={[styles.statFace, { backgroundColor: item.color }]}>
                  <Text style={styles.statEmoji}>{item.emoji}</Text>
                </View>
                <Text style={styles.statCount}>{item.count}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.monthHeader}>
          <Ionicons name="chevron-back" size={20} color="#384A5D" />
          <Text style={styles.monthLabel}>February</Text>
          <Ionicons name="chevron-forward" size={20} color="#384A5D" />
        </View>

        <View style={styles.weekHeaderRow}>
          {WEEKDAY_LABELS.map((day) => (
            <Text key={day} style={styles.weekdayText}>
              {day}
            </Text>
          ))}
        </View>

        <View style={styles.calendarGrid}>
          {DAYS.map((day) => {
            const moodStyle = MONTH_CALENDAR_STYLES[day];
            const isPlain = moodStyle === "none";

            return (
              <View key={day} style={styles.dayCell}>
                <View
                  style={[
                    styles.dayCircle,
                    moodStyle === "blue" && styles.dayCircleBlue,
                    moodStyle === "yellow" && styles.dayCircleYellow,
                    moodStyle === "red" && styles.dayCircleRed,
                    moodStyle === "orange" && styles.dayCircleOrange,
                    moodStyle === "purple" && styles.dayCirclePurple,
                    moodStyle === "outlined-green" && styles.dayCircleOutlinedGreen,
                    moodStyle === "selected-blue" && styles.dayCircleSelectedBlue,
                    isPlain && styles.dayCirclePlain,
                  ]}
                >
                  <Text
                    style={[
                      styles.dayNumber,
                      isPlain && styles.dayNumberPlain,
                      moodStyle === "selected-blue" && styles.dayNumberSelected,
                    ]}
                  >
                    {day}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>

        <View style={styles.insightCard}>
          <View style={styles.insightImageWrap}>
            <Image source={SLEEPY_PET_IMAGE} style={styles.insightImage} resizeMode="contain" />
          </View>

          <View style={styles.insightTextWrap}>
            <Text style={styles.insightText}>{INSIGHT_TEXT}</Text>
            <Text style={styles.insightFootnote}>{INSIGHT_FOOTNOTE}</Text>
          </View>
        </View>
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
    borderBottomColor: "#D0D2D4",
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    shadowColor: "#737373",
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
    color: "#33465B",
    fontSize: 36 / 2,
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
    paddingBottom: 18,
  },
  summaryCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#C5CACF",
    backgroundColor: "#F6F7F6",
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 10,
    marginBottom: 12,
    shadowColor: "#777777",
    shadowOpacity: 0.14,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  summaryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  summaryMonth: {
    color: "#31465A",
    fontSize: 35 / 2,
    lineHeight: 24,
    fontWeight: "700",
  },
  summarySub: {
    color: "#6A7481",
    fontSize: 14,
    lineHeight: 18,
    marginTop: 1,
  },
  commonMoodWrap: {
    alignItems: "center",
    marginTop: -2,
  },
  commonMoodFace: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: "#F8D330",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 1,
  },
  commonMoodEmoji: {
    fontSize: 23,
    lineHeight: 26,
  },
  commonMoodLabel: {
    color: "#3F4F61",
    fontSize: 11,
    lineHeight: 14,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  statItem: {
    alignItems: "center",
    width: "16%",
  },
  statFace: {
    width: 47,
    height: 41,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 3,
  },
  statEmoji: {
    fontSize: 28,
    lineHeight: 30,
  },
  statCount: {
    color: "#5E6771",
    fontSize: 13,
    lineHeight: 16,
  },
  monthHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
    paddingHorizontal: 8,
  },
  monthLabel: {
    color: "#33475B",
    fontSize: 35 / 2,
    lineHeight: 23,
    fontWeight: "700",
  },
  weekHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 6,
    marginBottom: 6,
  },
  weekdayText: {
    width: "13.5%",
    textAlign: "center",
    color: "#384B5F",
    fontSize: 18 / 1.2,
    lineHeight: 18,
    fontWeight: "700",
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 6,
    paddingHorizontal: 4,
    marginBottom: 14,
  },
  dayCell: {
    width: "13.6%",
    alignItems: "center",
  },
  dayCircle: {
    width: 33,
    height: 33,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  dayCircleBlue: {
    backgroundColor: "#7FA7D7",
  },
  dayCircleYellow: {
    backgroundColor: "#F8D330",
  },
  dayCircleRed: {
    backgroundColor: "#E86884",
  },
  dayCircleOrange: {
    backgroundColor: "#F19137",
  },
  dayCirclePurple: {
    backgroundColor: "#B895C8",
  },
  dayCircleOutlinedGreen: {
    backgroundColor: "#F8FBF7",
    borderWidth: 1,
    borderColor: "#82C866",
  },
  dayCircleSelectedBlue: {
    backgroundColor: "#8EC7E8",
    borderWidth: 2,
    borderColor: "#8BCB5A",
  },
  dayCirclePlain: {
    backgroundColor: "transparent",
    borderWidth: 0,
  },
  dayNumber: {
    color: "#4B5F73",
    fontSize: 15 / 1.08,
    lineHeight: 18,
    fontWeight: "700",
  },
  dayNumberSelected: {
    color: "#FFFFFF",
  },
  dayNumberPlain: {
    color: "#5E725F",
    fontWeight: "600",
  },
  insightCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#C9CED2",
    backgroundColor: "#F5F6F5",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 10,
    shadowColor: "#777777",
    shadowOpacity: 0.12,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
    marginBottom: 4,
  },
  insightImageWrap: {
    width: 104,
    alignItems: "center",
    justifyContent: "center",
  },
  insightImage: {
    width: 96,
    height: 76,
  },
  insightTextWrap: {
    flex: 1,
    paddingRight: 4,
    rowGap: 6,
  },
  insightText: {
    color: "#33485B",
    fontSize: 17,
    lineHeight: 26,
  },
  insightFootnote: {
    color: "#6F7B86",
    fontSize: 10.5,
    lineHeight: 14,
  },
});
