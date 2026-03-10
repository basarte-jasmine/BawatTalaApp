import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { HomeBottomNav } from "../components/home/HomeBottomNav";

type StreakStep = {
  id: string;
  points: string;
  state: "done" | "today" | "upcoming";
};

type EntryDayStyle = {
  bg: string;
  border: string;
};

const TALA_SYMBOL_IMAGE = require("../assets/images/tala_sample.png");
const PET_AWAKE_IMAGE = require("../assets/images/pet-awake_sample.png");
const SLEEPY_PET_IMAGE = require("../assets/images/pet-idle_sample.png");

const STREAK_STEPS: StreakStep[] = [
  { id: "p10", points: "+10", state: "done" },
  { id: "p20", points: "+20", state: "done" },
  { id: "p30", points: "+30", state: "today" },
  { id: "p50", points: "+50", state: "upcoming" },
  { id: "p70", points: "+70", state: "upcoming" },
  { id: "p100", points: "+100", state: "upcoming" },
  { id: "p150", points: "+150", state: "upcoming" },
];

const WEEKDAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

const MONTH_DAYS = Array.from({ length: 28 }, (_, index) => index + 1);

const ENTRY_DAY_STYLES: Partial<Record<number, EntryDayStyle>> = {
  1: { bg: "rgba(255, 214, 22, 0.5)", border: "#E3BF1A" },
  2: { bg: "rgba(232, 102, 134, 0.5)", border: "#D65978" },
  3: { bg: "rgba(241, 145, 55, 0.5)", border: "#E0832F" },
};

const DAY_SUMMARY_BY_DAY: Partial<Record<number, string>> = {
  1: "You felt calmer after checking in and wrote about one small win from your day.",
  2: "You entered the day feeling angry and chose to write through it, filling three pages with your thoughts.",
  3: "You felt stressed but grounded yourself by reflecting on what you can control next.",
};

const DEFAULT_DAILY_SUMMARY = "You've been checking in regularly! Your most common mood this month has been \"Good\".";
const LUMI_FOOTNOTE = "Summary by Lumi, your virtual companion. Bawat Tala is not a substitute for professional mental health care.";

export default function CalendarCheckInScreen() {
  const { height, width } = useWindowDimensions();
  const compact = height < 760;
  const veryCompact = height < 700;
  const ultraCompact = height < 680;
  const tiny = height < 620;
  const narrow = width < 360;
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const selectedDaySummary = selectedDay ? DAY_SUMMARY_BY_DAY[selectedDay] : undefined;
  const activeSummaryText =
    selectedDay === null
      ? DEFAULT_DAILY_SUMMARY
      : selectedDaySummary ?? "No journal entry was added for this day yet. Try another date with a recorded mood.";
  const activeSummaryImage = selectedDay === null ? SLEEPY_PET_IMAGE : PET_AWAKE_IMAGE;

  const onDayPress = (dayNumber: number) => {
    setSelectedDay((currentDay) => (currentDay === dayNumber ? null : dayNumber));
  };

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={[styles.topBar, compact && styles.topBarCompact, tiny && styles.topBarTiny]}>
        <Pressable style={styles.backButton} onPress={() => router.replace("/journal")}>
          <Ionicons name="chevron-back" size={30} color="#37414A" />
        </Pressable>
      </View>

      <View
        style={[
          styles.content,
          compact && styles.contentCompact,
          veryCompact && styles.contentVeryCompact,
          ultraCompact && styles.contentUltraCompact,
          tiny && styles.contentTiny,
        ]}
      >
            <View
              style={styles.checkInCard}
            >
              <View style={[styles.streakRow, narrow && styles.streakRowNarrow]}>
                {STREAK_STEPS.map((step) => (
                  <View
                    key={step.id}
                    style={[
                      styles.streakItem,
                      compact && styles.streakItemCompact,
                      ultraCompact && styles.streakItemUltraCompact,
                      step.state === "done" && styles.streakItemDone,
                      step.state === "today" && styles.streakItemToday,
                      step.state === "upcoming" && styles.streakItemUpcoming,
                    ]}
                  >
                    {step.state === "done" ? (
                      <Ionicons name="checkmark-circle" size={compact ? 18 : 20} color="#9AB8A9" />
                    ) : (
                      <Image
                        source={TALA_SYMBOL_IMAGE}
                        style={[
                          styles.streakTalaIcon,
                          compact && styles.streakTalaIconCompact,
                          step.state === "today" && styles.streakTalaIconToday,
                          step.state === "today" && compact && styles.streakTalaIconTodayCompact,
                        ]}
                        resizeMode="contain"
                      />
                    )}
                    <Text
                      style={[
                        styles.streakPoints,
                        compact && styles.streakPointsCompact,
                        step.state === "done" && styles.streakPointsDone,
                        step.state === "today" && styles.streakPointsToday,
                      ]}
                    >
                      {step.points}
                    </Text>
                  </View>
                ))}
              </View>

              <Pressable
                style={[
                  styles.checkInButton,
                  compact && styles.checkInButtonCompact,
                  ultraCompact && styles.checkInButtonUltraCompact,
                ]}
              >
                <Text style={[styles.checkInButtonText, compact && styles.checkInButtonTextCompact]}>Check in</Text>
              </Pressable>
            </View>

            <Text
              style={[
                styles.sectionTitle,
                compact && styles.sectionTitleCompact,
                ultraCompact && styles.sectionTitleUltraCompact,
              ]}
            >
              Entry Overview
            </Text>

            <View style={[styles.overviewRow, compact && styles.overviewRowCompact]}>
              <View style={styles.overviewCard}>
                <Text style={[styles.overviewNumber, compact && styles.overviewNumberCompact]}>3</Text>
                <View style={styles.overviewLabelRow}>
                  <Text style={[styles.overviewLabel, compact && styles.overviewLabelCompact]}>This Month&apos;s Entries</Text>
                  <Ionicons name="leaf" size={12} color="#66717A" />
                </View>
              </View>

              <View style={styles.overviewCard}>
                <Text style={[styles.overviewNumber, compact && styles.overviewNumberCompact]}>25</Text>
                <View style={styles.overviewLabelRow}>
                  <Text style={[styles.overviewLabel, compact && styles.overviewLabelCompact]}>Total Entries</Text>
                  <Ionicons name="leaf" size={12} color="#66717A" />
                </View>
              </View>
            </View>

            <View
              style={styles.monthCard}
            >
              <Text style={[styles.yearLabel, compact && styles.yearLabelCompact]}>2026</Text>

              <View style={styles.monthHeader}>
                <Ionicons name="chevron-back" size={17} color="#334355" />
                <Text style={[styles.monthLabel, compact && styles.monthLabelCompact]}>February</Text>
                <Ionicons name="chevron-forward" size={17} color="#334355" />
              </View>

              <View style={styles.weekHeader}>
                {WEEKDAY_LABELS.map((dayLabel) => (
                  <Text key={dayLabel} style={[styles.weekdayLabel, compact && styles.weekdayLabelCompact]}>
                    {dayLabel}
                  </Text>
                ))}
              </View>

              <View style={[styles.monthGrid, compact && styles.monthGridCompact]}>
                {MONTH_DAYS.map((dayNumber) => {
                  const entryStyle = ENTRY_DAY_STYLES[dayNumber];
                  const hasEntry = Boolean(entryStyle);

                  return (
                    <Pressable
                      key={dayNumber}
                      onPress={() => onDayPress(dayNumber)}
                      style={[
                        styles.dayCell,
                        compact && styles.dayCellCompact,
                        ultraCompact && styles.dayCellUltraCompact,
                        hasEntry && { backgroundColor: entryStyle?.bg, borderColor: entryStyle?.border },
                        selectedDay === dayNumber && styles.dayCellSelected,
                      ]}
                    >
                      <Text style={[styles.dayNumber, compact && styles.dayNumberCompact, hasEntry && styles.dayNumberWithEntry]}>
                        {hasEntry ? "\uD83E\uDEB6" : dayNumber}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.daySummaryCard}>
              <View style={styles.daySummaryImageWrap}>
                <Image source={activeSummaryImage} style={[styles.daySummaryImage, compact && styles.daySummaryImageCompact]} resizeMode="contain" />
              </View>

              <View style={styles.daySummaryTextWrap}>
                <Text
                  style={[styles.daySummaryText, compact && styles.daySummaryTextCompact, tiny && styles.daySummaryTextTiny]}
                  numberOfLines={3}
                  adjustsFontSizeToFit
                  minimumFontScale={0.82}
                >
                  {activeSummaryText}
                </Text>
                <Text
                  style={[styles.daySummaryFootnote, compact && styles.daySummaryFootnoteCompact]}
                  numberOfLines={2}
                  adjustsFontSizeToFit
                  minimumFontScale={0.85}
                >
                  {LUMI_FOOTNOTE}
                </Text>
              </View>
            </View>
      </View>

      <HomeBottomNav activeTab="home" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#ECECEC",
  },
  topBar: {
    height: 46,
    borderBottomWidth: 1,
    borderBottomColor: "#CFD1D3",
    backgroundColor: "#F3F3F3",
    justifyContent: "center",
    paddingHorizontal: 6,
    shadowColor: "#5A5A5A",
    shadowOpacity: 0.16,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  topBarCompact: {
    height: 40,
  },
  topBarTiny: {
    height: 36,
  },
  backButton: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  contentViewport: {
    flex: 1,
    overflow: "hidden",
  },
  contentScaleWrap: {
    flex: 1,
    justifyContent: "flex-start",
  },
  content: {
    flex: 1,
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 74,
  },
  contentCompact: {
    paddingTop: 8,
    paddingBottom: 72,
  },
  contentVeryCompact: {
    paddingTop: 6,
    paddingBottom: 68,
  },
  contentUltraCompact: {
    paddingTop: 5,
    paddingBottom: 64,
  },
  contentTiny: {
    paddingTop: 4,
    paddingBottom: 62,
  },
  checkInCard: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#C7CCCE",
    backgroundColor: "#F5F6F5",
    paddingHorizontal: 6,
    paddingVertical: 8,
    marginBottom: 10,
    shadowColor: "#7C7C7C",
    shadowOpacity: 0.12,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  checkInCardCompact: {
    marginBottom: 8,
    paddingVertical: 6,
  },
  checkInCardUltraCompact: {
    marginBottom: 6,
    paddingVertical: 5,
  },
  checkInCardTiny: {
    marginBottom: 5,
    paddingVertical: 4,
  },
  streakRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  streakRowNarrow: {
    columnGap: 2,
  },
  streakItem: {
    width: 41,
    height: 52,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#C9CED1",
    alignItems: "center",
    justifyContent: "center",
    rowGap: 2,
  },
  streakItemCompact: {
    width: 38,
    height: 48,
  },
  streakItemUltraCompact: {
    width: 35,
    height: 42,
  },
  streakItemDone: {
    backgroundColor: "#F3F3F3",
  },
  streakItemToday: {
    backgroundColor: "#FEF8EE",
    borderColor: "#C8A15C",
  },
  streakItemUpcoming: {
    backgroundColor: "#C5E9B0",
    borderColor: "#A6D086",
  },
  streakPoints: {
    fontSize: 10,
    lineHeight: 12,
    color: "#45614F",
    fontWeight: "700",
  },
  streakPointsCompact: {
    fontSize: 9,
    lineHeight: 11,
  },
  streakPointsDone: {
    color: "#A3A8AC",
  },
  streakPointsToday: {
    color: "#5F656B",
  },
  streakTalaIcon: {
    width: 20,
    height: 20,
  },
  streakTalaIconCompact: {
    width: 17,
    height: 17,
  },
  streakTalaIconToday: {
    width: 22,
    height: 22,
  },
  streakTalaIconTodayCompact: {
    width: 19,
    height: 19,
  },
  checkInButton: {
    height: 27,
    borderRadius: 999,
    backgroundColor: "#6FBE45",
    borderWidth: 1,
    borderColor: "#63A73E",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 62,
  },
  checkInButtonCompact: {
    height: 25,
    marginHorizontal: 56,
  },
  checkInButtonUltraCompact: {
    height: 23,
    marginHorizontal: 50,
  },
  checkInButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "700",
  },
  checkInButtonTextCompact: {
    fontSize: 13,
    lineHeight: 16,
  },
  sectionTitle: {
    color: "#334255",
    fontSize: 32 / 2,
    lineHeight: 20,
    fontWeight: "700",
    marginBottom: 6,
    marginLeft: 4,
  },
  sectionTitleCompact: {
    marginBottom: 5,
  },
  sectionTitleUltraCompact: {
    marginBottom: 4,
  },
  overviewRow: {
    flexDirection: "row",
    columnGap: 8,
    marginBottom: 9,
  },
  overviewRowCompact: {
    marginBottom: 7,
  },
  overviewCard: {
    flex: 1,
    minHeight: 52,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#CBD0D3",
    backgroundColor: "#F4F5F4",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
    shadowColor: "#777777",
    shadowOpacity: 0.13,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  overviewCardUltraCompact: {
    minHeight: 44,
  },
  overviewNumber: {
    color: "#324355",
    fontSize: 34 / 2,
    lineHeight: 22,
    fontWeight: "700",
  },
  overviewNumberCompact: {
    fontSize: 15,
    lineHeight: 19,
  },
  overviewLabel: {
    color: "#5B6670",
    fontSize: 11,
    lineHeight: 14,
    textAlign: "center",
  },
  overviewLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 3,
  },
  overviewLabelCompact: {
    fontSize: 10,
    lineHeight: 13,
  },
  monthCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#C7CCCF",
    backgroundColor: "#F5F6F5",
    paddingHorizontal: 10,
    paddingTop: 6,
    paddingBottom: 9,
    marginBottom: 10,
    shadowColor: "#7A7A7A",
    shadowOpacity: 0.12,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  monthCardCompact: {
    paddingBottom: 7,
    marginBottom: 7,
  },
  monthCardVeryCompact: {
    paddingHorizontal: 8,
    paddingTop: 5,
    paddingBottom: 6,
  },
  monthCardUltraCompact: {
    marginBottom: 6,
    paddingBottom: 5,
  },
  monthCardTiny: {
    paddingHorizontal: 7,
    marginBottom: 5,
  },
  yearLabel: {
    color: "#304355",
    fontSize: 38 / 2,
    lineHeight: 23,
    fontWeight: "700",
    marginBottom: 2,
    marginLeft: 3,
  },
  yearLabelCompact: {
    fontSize: 17,
    lineHeight: 20,
  },
  monthHeader: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 4,
    marginBottom: 5,
    marginLeft: 1,
  },
  monthLabel: {
    color: "#2F4052",
    fontSize: 30 / 2,
    lineHeight: 20,
    fontWeight: "700",
  },
  monthLabelCompact: {
    fontSize: 14,
    lineHeight: 18,
  },
  weekHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    marginBottom: 4,
  },
  weekdayLabel: {
    color: "#7A5946",
    fontSize: 31 / 2,
    lineHeight: 18,
    fontWeight: "700",
  },
  weekdayLabelCompact: {
    fontSize: 13,
    lineHeight: 16,
  },
  monthGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 5,
    paddingHorizontal: 3,
  },
  monthGridCompact: {
    rowGap: 4,
    paddingHorizontal: 1,
  },
  dayCell: {
    width: "13.25%",
    aspectRatio: 1,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#CED1D4",
    backgroundColor: "#F7F8F7",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    overflow: "hidden",
  },
  dayCellCompact: {
    width: "13.3%",
  },
  dayCellUltraCompact: {
    width: "13.35%",
  },
  dayCellSelected: {
    borderWidth: 1.5,
    borderColor: "#3E4D5D",
  },
  dayNumber: {
    color: "#6A6F75",
    fontSize: 10,
    lineHeight: 12,
  },
  dayNumberCompact: {
    fontSize: 9,
    lineHeight: 11,
  },
  dayNumberWithEntry: {
    fontSize: 18,
    lineHeight: 20,
  },
  daySummaryCard: {
    marginTop: 8,
    marginBottom: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#C8CDD0",
    backgroundColor: "#F6F7F6",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 10,
    shadowColor: "#7A7A7A",
    shadowOpacity: 0.12,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  daySummaryCardCompact: {
    marginTop: 6,
    marginBottom: 8,
    paddingVertical: 8,
  },
  daySummaryImageWrap: {
    width: 112,
    alignItems: "center",
    justifyContent: "center",
  },
  daySummaryImage: {
    width: 108,
    height: 86,
  },
  daySummaryImageCompact: {
    width: 94,
    height: 74,
  },
  daySummaryTextWrap: {
    flex: 1,
    paddingRight: 6,
    rowGap: 7,
  },
  daySummaryText: {
    color: "#33485B",
    fontSize: 33 / 2,
    lineHeight: 23,
  },
  daySummaryTextCompact: {
    fontSize: 14,
    lineHeight: 20,
  },
  daySummaryFootnote: {
    color: "#7B858E",
    fontSize: 10,
    lineHeight: 13,
  },
  daySummaryFootnoteCompact: {
    fontSize: 9,
    lineHeight: 12,
  },
  bottomRow: {
    flexDirection: "row",
    columnGap: 8,
    alignItems: "stretch",
    marginTop: 8,
    marginBottom: 10,
  },
  bottomRowCompact: {
    columnGap: 6,
    marginTop: 6,
    marginBottom: 8,
  },
  bottomRowUltraCompact: {
    columnGap: 5,
    marginTop: 4,
    marginBottom: 6,
  },
  sleepyPetWrap: {
    width: "40%",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#C8CDD0",
    backgroundColor: "#F7F8F7",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    paddingVertical: 6,
    minHeight: 104,
    shadowColor: "#7A7A7A",
    shadowOpacity: 0.12,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  sleepyPetWrapCompact: {
    width: "39%",
    minHeight: 90,
    paddingVertical: 5,
  },
  sleepyPetWrapUltraCompact: {
    width: "38%",
    minHeight: 76,
    paddingVertical: 4,
  },
  sleepyPetImage: {
    width: "95%",
    height: 90,
  },
  sleepyPetImageCompact: {
    height: 74,
  },
  sleepyPetImageUltraCompact: {
    height: 62,
  },
  streakCard: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#C8CDD0",
    backgroundColor: "#F7F8F7",
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 8,
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 104,
    shadowColor: "#7A7A7A",
    shadowOpacity: 0.12,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  streakCardCompact: {
    minHeight: 90,
    paddingTop: 6,
    paddingBottom: 6,
  },
  streakCardUltraCompact: {
    minHeight: 76,
    paddingTop: 5,
    paddingBottom: 5,
  },
  streakText: {
    color: "#2B2B2B",
    textAlign: "center",
    fontSize: 13,
    lineHeight: 17,
  },
  streakTextCompact: {
    fontSize: 12,
    lineHeight: 15,
  },
  bigFeatherIcon: {
    marginVertical: 1,
  },
  pickButton: {
    height: 23,
    borderRadius: 999,
    backgroundColor: "#B9EC95",
    borderWidth: 1,
    borderColor: "#A5D680",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "stretch",
  },
  pickButtonCompact: {
    height: 22,
  },
  pickButtonUltraCompact: {
    height: 20,
  },
  pickButtonText: {
    color: "#2F6E26",
    fontSize: 13,
    lineHeight: 16,
    fontWeight: "700",
  },
  pickButtonTextCompact: {
    fontSize: 12,
    lineHeight: 15,
  },
});
