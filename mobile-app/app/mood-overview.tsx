import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Image, ImageSourcePropType, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuthSession } from "../lib/auth-session";
import { fetchMonthlyMoods } from "../lib/backend-api";
import { EMOTION_META, EMOTION_ORDER, createEmotionCounts } from "../lib/emotions";
import { getManilaTodayParts } from "../lib/manila-date";

type MoodStat = {
  color: string;
  count: number;
  id: string;
  image: ImageSourcePropType | null;
  label: string;
};

type CalendarDay = {
  isOutsideMonth?: boolean;
  checkInCount?: number;
  dayNumber: number | null;
  moodId: string | null;
  state: "empty" | "future" | "mood";
};

const WEEKDAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MUNI_IMAGE = require("../assets/images/MUNI_default.png");
const INSIGHT_FOOTNOTE = "Summary by Muni, your virtual companion. Bawat Tala is not a substitute for professional mental health care.";

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
  const [monthlyEntries, setMonthlyEntries] = useState<{ createdAt?: string; id?: string; moodDate: string; moodId: string; moodLabel: string }[]>([]);
  const [monthlyCounts, setMonthlyCounts] = useState<Record<string, number>>(() => createEmotionCounts());
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
      setMonthlyCounts(createEmotionCounts());
      return;
    }

    const result = await fetchMonthlyMoods(user.studentNumber, displayYear, displayMonthIndex + 1);
    if (!result.ok) {
      return;
    }

    setMonthlyEntries(result.entries ?? []);
    setMonthlyCounts({
      ...createEmotionCounts(),
      ...(result.counts ?? {}),
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
      EMOTION_ORDER.map((id) => ({
        id,
        color: EMOTION_META[id].color,
        count: monthlyCounts[id] ?? 0,
        image: EMOTION_META[id].image,
        label: EMOTION_META[id].label,
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
    const map = new Map<number, { count: number; latestMoodId: string }>();
    monthlyEntries.forEach((entry) => {
      const day = getDayFromMoodDate(entry.moodDate);
      if (day) {
        const current = map.get(day);
        map.set(day, {
          count: (current?.count ?? 0) + 1,
          latestMoodId: entry.moodId,
        });
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
      const dayEntry = entriesByDay.get(dayNumber);
      const moodId = dayEntry?.latestMoodId ?? null;
      const isFutureDay = viewedMonthKey === todayMonthKey && dayNumber > todayDay;
      days.push({
        checkInCount: dayEntry?.count ?? 0,
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

  const mostCommonMood = mostCommonMoodId ? EMOTION_META[mostCommonMoodId] ?? null : null;
  const emotionCheckInLabel = `${totalCheckIns} emotion ${totalCheckIns === 1 ? "check-in" : "check-ins"}`;
  const activeEmotionDays = entriesByDay.size;
  const multiCheckInDays = [...entriesByDay.values()].filter((item) => item.count > 1).length;
  const insightText =
    totalCheckIns <= 0
      ? "Start checking in with your emotions and your monthly patterns will appear here."
      : mostCommonMood?.label
        ? `Muni counted ${emotionCheckInLabel.toLowerCase()} across ${activeEmotionDays} ${activeEmotionDays === 1 ? "day" : "days"}. Your most common emotion this month is "${mostCommonMood.label}"${multiCheckInDays ? `, with ${multiCheckInDays} ${multiCheckInDays === 1 ? "day" : "days"} showing more than one check-in.` : "."}`
        : "You've been checking in regularly. Keep tracking your emotions to notice patterns.";

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.topBar}>
        <Pressable style={styles.backButton} onPress={handleBack} accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={27} color="#3B454F" />
        </Pressable>
        <Text style={styles.topTitle}>Emotion Overview</Text>
        <View style={styles.topBarSpacer} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <View>
              <Text style={styles.summaryEyebrow}>THIS MONTH</Text>
              <Text style={styles.summaryMonth}>{`${getMonthName(displayMonthIndex)} ${displayYear}`}</Text>
              <Text style={styles.summarySub}>{emotionCheckInLabel}</Text>
            </View>

            <View style={styles.commonMoodWrap}>
              <Text style={styles.commonMoodMeta}>Most Common</Text>
              <View style={styles.commonMoodFace}>
                {mostCommonMood?.image ? (
                  <Image source={mostCommonMood.image} style={styles.commonMoodImage} resizeMode="contain" />
                ) : mostCommonMood ? (
                  <View style={styles.commonMoodPlaceholder} />
                ) : (
                  <Text style={styles.commonMoodFallback}>-</Text>
                )}
              </View>
              <Text style={styles.commonMoodLabel}>{mostCommonMood?.label ?? "No emotion yet"}</Text>
            </View>
          </View>

          <View style={styles.statsRow}>
            {moodStats.map((item) => (
              <View key={item.id} style={styles.statItem}>
                <View style={styles.statFace}>
                  {item.image ? (
                    <Image source={item.image} style={styles.statImage} resizeMode="contain" />
                  ) : (
                    <View style={styles.statImagePlaceholder} />
                  )}
                </View>
                <Text style={styles.statCount}>{item.count}</Text>
                <Text style={styles.statLabel} numberOfLines={2}>{item.label}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.calendarCard}>
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
              const moodMeta = day.moodId ? EMOTION_META[day.moodId] ?? null : null;
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
                    {day.state === "mood" && Number(day.checkInCount || 0) > 1 ? (
                      <View style={styles.dayCountBadge}>
                        <Text style={styles.dayCountBadgeText}>{day.checkInCount}</Text>
                      </View>
                    ) : null}
                  </View>
                  )}
                </View>
              );
            })}
          </View>
        </View>

        <View style={styles.insightCard}>
          <View style={styles.insightImageWrap}>
            <Image source={MUNI_IMAGE} style={styles.insightImage} resizeMode="contain" />
          </View>

          <View style={styles.insightTextWrap}>
            <Text style={styles.insightText}>{insightText}</Text>
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
    backgroundColor: "#F6FAF3",
  },
  topBar: {
    height: 52,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#DCE6D8",
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
    paddingHorizontal: 10,
    paddingTop: 12,
    paddingBottom: 22,
  },
  summaryCard: {
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E1EBD9",
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 14,
    marginBottom: 14,
    shadowColor: "#525C67",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  summaryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  summaryEyebrow: {
    color: "#7C8F77",
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 1,
    fontWeight: "700",
    marginBottom: 4,
  },
  summaryMonth: {
    color: "#31465A",
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "700",
  },
  summarySub: {
    color: "#6A7481",
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  commonMoodWrap: {
    alignItems: "center",
    minWidth: 84,
  },
  commonMoodMeta: {
    color: "#6E7E8B",
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "700",
    marginBottom: 4,
  },
  commonMoodFace: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: "#F8FBF5",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
    borderWidth: 1,
    borderColor: "#DCE5DB",
  },
  commonMoodImage: {
    width: 38,
    height: 38,
  },
  commonMoodPlaceholder: {
    width: 38,
    height: 38,
  },
  commonMoodFallback: {
    color: "#3F4F61",
    fontSize: 19,
    lineHeight: 22,
  },
  commonMoodLabel: {
    color: "#3F4F61",
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "600",
    maxWidth: 84,
    textAlign: "center",
  },
  statsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: 12,
  },
  statItem: {
    alignItems: "center",
    paddingHorizontal: 2,
    width: "20%",
  },
  statFace: {
    width: 48,
    height: 46,
    borderRadius: 14,
    backgroundColor: "#F9FBF7",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
    borderWidth: 1,
    borderColor: "#DCE5DB",
  },
  statImage: {
    width: 38,
    height: 38,
  },
  statImagePlaceholder: {
    width: 38,
    height: 38,
  },
  statCount: {
    color: "#4B5968",
    fontSize: 13,
    lineHeight: 16,
    fontWeight: "700",
  },
  statLabel: {
    color: "#7A8792",
    fontSize: 10,
    lineHeight: 12,
    marginTop: 2,
    minHeight: 24,
    textAlign: "center",
  },
  calendarCard: {
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E1EBD9",
    paddingHorizontal: 10,
    paddingTop: 12,
    paddingBottom: 12,
    marginBottom: 14,
    shadowColor: "#525C67",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  monthHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  monthArrowButton: {
    width: 32,
    height: 32,
    borderRadius: 12,
    backgroundColor: "#F4F8F1",
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
    paddingHorizontal: 2,
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
    rowGap: 7,
    paddingHorizontal: 0,
  },
  dayCell: {
    width: "13.6%",
    alignItems: "center",
  },
  dayCircleBlank: {
    width: 36,
    height: 36,
  },
  dayCircle: {
    width: 36,
    height: 36,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#8BCB68",
    position: "relative",
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
  dayCountBadge: {
    position: "absolute",
    right: -4,
    top: -5,
    minWidth: 16,
    height: 16,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#6AAF43",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  dayCountBadgeText: {
    color: "#2E6B23",
    fontSize: 9,
    lineHeight: 11,
    fontWeight: "800",
  },
  insightCard: {
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E1EBD9",
    paddingHorizontal: 12,
    paddingVertical: 12,
    shadowColor: "#525C67",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
    marginBottom: 4,
  },
  insightImageWrap: {
    width: 92,
    alignItems: "center",
    justifyContent: "center",
  },
  insightImage: {
    width: 72,
    height: 72,
  },
  insightTextWrap: {
    flex: 1,
    paddingRight: 6,
    rowGap: 6,
  },
  insightText: {
    color: "#33485B",
    fontSize: 15,
    lineHeight: 22,
  },
  insightFootnote: {
    color: "#6F7B86",
    fontSize: 10,
    lineHeight: 14,
  },
});

