import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuthSession } from "../lib/auth-session";
import { fetchMonthlyMoods } from "../lib/backend-api";
import { getManilaTodayParts } from "../lib/manila-date";

type MoodStat = {
  color: string;
  count: number;
  emoji: string;
  id: string;
};

type CalendarDay = {
  isOutsideMonth?: boolean;
  dayNumber: number | null;
  moodId: string | null;
  state: "empty" | "future" | "mood";
};

const SLEEPY_PET_IMAGE = require("../assets/images/pet-idle_sample.png");

const WEEKDAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

const INSIGHT_TEXT = "You've been checking in regularly! Your most common mood this month has been \"Good\".";
const INSIGHT_FOOTNOTE = "Summary by Lumi, your virtual companion. Bawat Tala is not a substitute for professional mental health care.";

const MOOD_META: Record<string, { color: string; emoji: string; label: string }> = {
  angry: { color: "#E86686", emoji: "\uD83D\uDE21", label: "Angry" },
  anxious: { color: "#B895C8", emoji: "\uD83D\uDE30", label: "Anxious" },
  calm: { color: "#97CFDA", emoji: "\uD83D\uDE0C", label: "Calm" },
  happy: { color: "#F8D330", emoji: "\uD83D\uDE42", label: "Happy" },
  sad: { color: "#7EA9D9", emoji: "\uD83D\uDE22", label: "Sad" },
  stressed: { color: "#F19137", emoji: "\uD83D\uDE23", label: "Stressed" },
};

const MIN_YEAR = 2026;
const MIN_MONTH_INDEX = 0;

function getMonthName(monthIndex: number) {
  return new Date(2026, monthIndex, 1).toLocaleString("en-US", { month: "long" });
}

function getDayFromMoodDate(value: string) {
  const match = String(value || "").match(/(\d{4})-(\d{2})-(\d{2})/);
  return match ? Number(match[3]) : 0;
}

export default function MoodOverviewScreen() {
  const { user } = useAuthSession();
  const [now, setNow] = useState(() => getManilaTodayParts());
  const initialMonth = useMemo(() => {
    const currentYear = now.year;
    const currentMonthIndex = now.monthIndex;

    if (currentYear < MIN_YEAR) {
      return { monthIndex: MIN_MONTH_INDEX, year: MIN_YEAR };
    }

    return { monthIndex: currentMonthIndex, year: currentYear };
  }, [now]);
  const [displayYear, setDisplayYear] = useState(initialMonth.year);
  const [displayMonthIndex, setDisplayMonthIndex] = useState(initialMonth.monthIndex);
  const [monthlyEntries, setMonthlyEntries] = useState<{ moodDate: string; moodId: string; moodLabel: string }[]>([]);
  const [monthlyCounts, setMonthlyCounts] = useState<Record<string, number>>({
    angry: 0,
    anxious: 0,
    calm: 0,
    happy: 0,
    sad: 0,
    stressed: 0,
  });
  const [mostCommonMoodId, setMostCommonMoodId] = useState<string | null>(null);
  const [totalCheckIns, setTotalCheckIns] = useState(0);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/home");
  };

  const loadMonth = useCallback(async () => {
    if (!user?.studentNumber) {
      setMonthlyEntries([]);
      setMostCommonMoodId(null);
      setTotalCheckIns(0);
      setMonthlyCounts({
        angry: 0,
        anxious: 0,
        calm: 0,
        happy: 0,
        sad: 0,
        stressed: 0,
      });
      return;
    }

    const result = await fetchMonthlyMoods(user.studentNumber, displayYear, displayMonthIndex + 1);
    if (!result.ok) {
      return;
    }

    setMonthlyEntries(result.entries ?? []);
    setMonthlyCounts({
      angry: result.counts?.angry ?? 0,
      anxious: result.counts?.anxious ?? 0,
      calm: result.counts?.calm ?? 0,
      happy: result.counts?.happy ?? 0,
      sad: result.counts?.sad ?? 0,
      stressed: result.counts?.stressed ?? 0,
    });
    setMostCommonMoodId(result.mostCommonMoodId ?? null);
    setTotalCheckIns(result.totalCheckIns ?? 0);
  }, [displayMonthIndex, displayYear, user?.studentNumber]);

  useFocusEffect(
    useCallback(() => {
      setNow(getManilaTodayParts());
      void loadMonth();
    }, [loadMonth]),
  );

  const moodStats: MoodStat[] = useMemo(
    () =>
      Object.entries(MOOD_META).map(([id, meta]) => ({
        id,
        emoji: meta.emoji,
        color: meta.color,
        count: monthlyCounts[id] ?? 0,
      })),
    [monthlyCounts],
  );

  const todayMonthKey = `${now.year}-${now.monthIndex}`;
  const viewedMonthKey = `${displayYear}-${displayMonthIndex}`;
  const todayDay = now.day;
  const isFutureMonth =
    displayYear > now.year ||
    (displayYear === now.year && displayMonthIndex > now.monthIndex);

  const entriesByDay = useMemo(() => {
    const map = new Map<number, string>();
    monthlyEntries.forEach((entry) => {
      const day = getDayFromMoodDate(entry.moodDate);
      if (day) {
        map.set(day, entry.moodId);
      }
    });
    return map;
  }, [monthlyEntries]);

  const calendarDays = useMemo(() => {
    const firstDayIndex = new Date(displayYear, displayMonthIndex, 1).getDay();
    const totalDaysInMonth = new Date(displayYear, displayMonthIndex + 1, 0).getDate();
    const days: CalendarDay[] = [];

    for (let index = 0; index < firstDayIndex; index += 1) {
      days.push({ dayNumber: null, moodId: null, state: "empty" });
    }

    for (let dayNumber = 1; dayNumber <= totalDaysInMonth; dayNumber += 1) {
      const moodId = entriesByDay.get(dayNumber) ?? null;
      const isFutureDay = viewedMonthKey === todayMonthKey && dayNumber > todayDay;
      days.push({
        dayNumber,
        isOutsideMonth: false,
        moodId,
        state: moodId ? "mood" : isFutureMonth || isFutureDay ? "future" : "empty",
      });
    }

    const trailingDays = (7 - (days.length % 7)) % 7;
    for (let dayNumber = 1; dayNumber <= trailingDays; dayNumber += 1) {
      days.push({
        dayNumber,
        isOutsideMonth: true,
        moodId: null,
        state: "future",
      });
    }

    return days;
  }, [displayMonthIndex, displayYear, entriesByDay, isFutureMonth, todayDay, todayMonthKey, viewedMonthKey]);

  const canGoPrevious = displayYear > MIN_YEAR || (displayYear === MIN_YEAR && displayMonthIndex > MIN_MONTH_INDEX);
  const goPreviousMonth = () => {
    if (!canGoPrevious) {
      return;
    }

    if (displayMonthIndex === 0) {
      setDisplayMonthIndex(11);
      setDisplayYear((prev) => prev - 1);
      return;
    }

    setDisplayMonthIndex((prev) => prev - 1);
  };

  const goNextMonth = () => {
    if (displayMonthIndex === 11) {
      setDisplayMonthIndex(0);
      setDisplayYear((prev) => prev + 1);
      return;
    }

    setDisplayMonthIndex((prev) => prev + 1);
  };

  const mostCommonMood = mostCommonMoodId ? MOOD_META[mostCommonMoodId] : null;

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
              <Text style={styles.summaryMonth}>{`${getMonthName(displayMonthIndex)} ${displayYear}`}</Text>
              <Text style={styles.summarySub}>{`${totalCheckIns} Check-ins`}</Text>
            </View>

            <View style={styles.commonMoodWrap}>
              <View style={[styles.commonMoodFace, mostCommonMood && { backgroundColor: mostCommonMood.color }]}>
                <Text style={styles.commonMoodEmoji}>{mostCommonMood?.emoji ?? "-"}</Text>
              </View>
              <Text style={styles.commonMoodLabel}>{mostCommonMood?.label ?? "No mood yet"}</Text>
            </View>
          </View>

          <View style={styles.statsRow}>
            {moodStats.map((item) => (
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
          <Pressable onPress={goPreviousMonth} disabled={!canGoPrevious} style={styles.monthArrowButton}>
            <Ionicons name="chevron-back" size={20} color={canGoPrevious ? "#384A5D" : "#B4BCC5"} />
          </Pressable>
          <Text style={styles.monthLabel}>{getMonthName(displayMonthIndex)}</Text>
          <Pressable onPress={goNextMonth} style={styles.monthArrowButton}>
            <Ionicons name="chevron-forward" size={20} color="#384A5D" />
          </Pressable>
        </View>

        <View style={styles.weekHeaderRow}>
          {WEEKDAY_LABELS.map((day) => (
            <Text key={day} style={styles.weekdayText}>
              {day}
            </Text>
          ))}
        </View>

        <View style={styles.calendarGrid}>
          {calendarDays.map((day, index) => {
            const moodMeta = day.moodId ? MOOD_META[day.moodId] : null;
            const isToday =
              !day.isOutsideMonth &&
              viewedMonthKey === todayMonthKey &&
              day.dayNumber === todayDay;

            return (
              <View key={`${day.dayNumber ?? "blank"}-${index}`} style={styles.dayCell}>
                {day.dayNumber === null ? <View style={styles.dayCircleBlank} /> : (
                <View
                  style={[
                    styles.dayCircle,
                    day.isOutsideMonth && styles.dayCircleOutsideMonth,
                    day.state === "mood" && moodMeta && { backgroundColor: moodMeta.color },
                    day.state === "future" && styles.dayCircleFuture,
                    day.state === "empty" && styles.dayCircleEmpty,
                    day.state === "empty" && styles.dayCircleEmptyBorder,
                    isToday && styles.dayCircleToday,
                  ]}
                >
                  <Text
                    style={[
                      styles.dayNumber,
                      day.isOutsideMonth && styles.dayNumberOutsideMonth,
                      day.state === "future" && styles.dayNumberFuture,
                      day.state === "mood" && styles.dayNumberMood,
                    ]}
                  >
                    {day.dayNumber}
                  </Text>
                </View>
                )}
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
    backgroundColor: "#FFFFFF",
  },
  topBar: {
    height: 52,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    shadowColor: "#525C67",
    shadowOpacity: 0.16,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
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
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 10,
    marginBottom: 12,
    shadowColor: "#525C67",
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
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
  monthArrowButton: {
    width: 28,
    alignItems: "center",
    justifyContent: "center",
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
  dayCircleBlank: {
    width: 33,
    height: 33,
  },
  dayCircle: {
    width: 33,
    height: 33,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#8BCB68",
  },
  dayCircleFuture: {
    backgroundColor: "#D7DADF",
    borderColor: "#C5CBD2",
  },
  dayCircleOutsideMonth: {
    opacity: 0.72,
  },
  dayCircleEmpty: {
    backgroundColor: "#FFFFFF",
  },
  dayCircleEmptyBorder: {
    borderColor: "#8BCB68",
  },
  dayCircleToday: {
    borderWidth: 2,
    borderColor: "#5FAD38",
  },
  dayNumber: {
    color: "#4B5F73",
    fontSize: 15 / 1.08,
    lineHeight: 18,
    fontWeight: "700",
  },
  dayNumberMood: {
    color: "#3D4450",
  },
  dayNumberFuture: {
    color: "#7B848E",
    fontWeight: "600",
  },
  dayNumberOutsideMonth: {
    color: "#8D96A0",
  },
  insightCard: {
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 10,
    shadowColor: "#525C67",
    shadowOpacity: 0.16,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
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
