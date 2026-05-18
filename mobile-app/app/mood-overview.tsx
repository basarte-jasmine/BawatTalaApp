import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Image, ImageSourcePropType, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuthSession } from "../lib/auth-session";
import { fetchMonthlyMoods, type MoodEntryRecord } from "../lib/backend-api";
import { EMOTION_META, EMOTION_ORDER, createEmotionCounts, normalizeEmotionId } from "../lib/emotions";
import { InformedConsentGate } from "../lib/informed-consent";
import { getManilaTodayParts } from "../lib/manila-date";

type MoodStat = {
  color: string;
  count: number;
  id: string;
  image: ImageSourcePropType | null;
  label: string;
};

type CalendarDay = {
  isSelected?: boolean;
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

function formatDisplayDate(year: number, monthIndex: number, dayNumber: number) {
  return new Date(year, monthIndex, dayNumber).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatCheckInTime(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatMoodSourceLabel(value?: string) {
  return String(value || "").toUpperCase() === "JOURNAL" ? "Journal" : "Input";
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
  const [monthlyEntries, setMonthlyEntries] = useState<MoodEntryRecord[]>([]);
  const [monthlyCounts, setMonthlyCounts] = useState<Record<string, number>>(() => createEmotionCounts());
  const [mostCommonMoodId, setMostCommonMoodId] = useState<string | null>(null);
  const [totalCheckIns, setTotalCheckIns] = useState(0);
  const [selectedDayNumber, setSelectedDayNumber] = useState(now.day);
  const [showDailyRecordsModal, setShowDailyRecordsModal] = useState(false);

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

  useEffect(() => {
    const totalDaysInMonth = new Date(displayYear, displayMonthIndex + 1, 0).getDate();
    const viewedCurrentMonth = viewedMonthKey === todayMonthKey;
    const firstEntryDay = [...entriesByDay.keys()].sort((a, b) => a - b)[0];
    const fallbackDay = viewedCurrentMonth ? todayDay : firstEntryDay ?? 1;
    const maxSelectableDay = viewedCurrentMonth ? Math.min(todayDay, totalDaysInMonth) : totalDaysInMonth;

    if (selectedDayNumber < 1 || selectedDayNumber > maxSelectableDay) {
      setSelectedDayNumber(Math.min(fallbackDay, maxSelectableDay));
    }
  }, [displayMonthIndex, displayYear, entriesByDay, selectedDayNumber, todayDay, todayMonthKey, viewedMonthKey]);

  const selectedDayEntries = useMemo(
    () =>
      monthlyEntries.filter((entry) => getDayFromMoodDate(entry.moodDate) === selectedDayNumber),
    [monthlyEntries, selectedDayNumber],
  );

  const selectedDayCounts = useMemo(() => {
    const counts = createEmotionCounts();
    selectedDayEntries.forEach((entry) => {
      const moodId = normalizeEmotionId(entry.moodId);
      if (Object.prototype.hasOwnProperty.call(counts, moodId)) {
        counts[moodId] += 1;
      }
    });
    return counts;
  }, [selectedDayEntries]);

  const selectedDayMostCommonMoodId = useMemo(() => {
    const [moodId, count] = Object.entries(selectedDayCounts).sort((a, b) => b[1] - a[1])[0] ?? [];
    return count > 0 ? moodId : null;
  }, [selectedDayCounts]);
  const selectedDayMoodStats = useMemo(
    () =>
      EMOTION_ORDER.map((id) => ({
        id,
        count: selectedDayCounts[id] ?? 0,
        meta: EMOTION_META[id],
      })).filter((item) => item.count > 0),
    [selectedDayCounts],
  );

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
        isSelected: selectedDayNumber === dayNumber,
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
  }, [displayMonthIndex, displayYear, entriesByDay, isFutureMonth, selectedDayNumber, todayDay, todayMonthKey, viewedMonthKey]);

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
  const selectedDayMostCommonMood = selectedDayMostCommonMoodId ? EMOTION_META[selectedDayMostCommonMoodId] ?? null : null;
  const selectedDayLabel = formatDisplayDate(displayYear, displayMonthIndex, selectedDayNumber);
  const selectedDayCheckInLabel = `${selectedDayEntries.length} emotion ${selectedDayEntries.length === 1 ? "check-in" : "check-ins"}`;
  const selectedDayMoodKindLabel = `${selectedDayMoodStats.length} ${selectedDayMoodStats.length === 1 ? "kind" : "kinds"}`;
  const selectedDayRecordLabel = `${selectedDayEntries.length} ${selectedDayEntries.length === 1 ? "record" : "records"}`;
  const dailyInsightText =
    selectedDayEntries.length <= 0
      ? `No emotions were logged on ${selectedDayLabel}. Pick any day with a badge to see Muni's daily reflection.`
      : selectedDayMostCommonMood?.label
        ? `Muni counted ${selectedDayCheckInLabel.toLowerCase()} on ${selectedDayLabel}. The strongest pattern for this day is "${selectedDayMostCommonMood.label}".`
        : `Muni counted ${selectedDayCheckInLabel.toLowerCase()} on ${selectedDayLabel}.`;
  const monthlySubText =
    totalCheckIns <= 0
      ? "No monthly check-ins yet."
      : `${emotionCheckInLabel} across ${activeEmotionDays} ${activeEmotionDays === 1 ? "day" : "days"}${multiCheckInDays ? `, ${multiCheckInDays} with multiple check-ins` : ""}.`;

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.topBar}>
        <Pressable style={styles.backButton} onPress={handleBack} accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={27} color="#3B454F" />
        </Pressable>
        <Text style={styles.topTitle}>Emotion Overview</Text>
        <View style={styles.topBarSpacer} />
      </View>

      <InformedConsentGate feature="mood">
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.dailyCard}>
          <View style={styles.dailyHeader}>
            <View style={styles.summaryHeaderCopy}>
              <Text style={styles.summaryEyebrow}>SELECTED DAY</Text>
              <Text style={styles.summaryMonth}>{selectedDayLabel}</Text>
              <Text style={styles.summarySub}>{selectedDayCheckInLabel}</Text>
            </View>

            <View style={styles.dailyMoodWrap}>
              <Text style={styles.commonMoodMeta}>Daily Pattern</Text>
              <View style={[styles.commonMoodFace, selectedDayMostCommonMood && { borderColor: selectedDayMostCommonMood.color }]}>
                {selectedDayMostCommonMood?.image ? (
                  <Image source={selectedDayMostCommonMood.image} style={styles.commonMoodImage} resizeMode="contain" />
                ) : selectedDayMostCommonMood ? (
                  <View style={styles.commonMoodPlaceholder} />
                ) : (
                  <Text style={styles.commonMoodFallback}>-</Text>
                )}
              </View>
              <Text style={styles.commonMoodLabel}>{selectedDayMostCommonMood?.label ?? "No emotion yet"}</Text>
            </View>
          </View>

          <View style={styles.dailyBreakdownHeader}>
            <Text style={styles.dailyBreakdownTitle}>Emotion mix</Text>
            <Text style={styles.dailyBreakdownMeta}>{selectedDayMoodKindLabel}</Text>
          </View>

          {selectedDayMoodStats.length ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.dailyMixScroller}
            >
              {selectedDayMoodStats.map((item) => (
                <View key={item.id} style={styles.dailyMixChip}>
                  <View style={[styles.dailyMixFace, { borderColor: item.meta.color }]}>
                    {item.meta.image ? (
                      <Image source={item.meta.image} style={styles.dailyMixImage} resizeMode="contain" />
                    ) : (
                      <View style={[styles.dailyEntryFallback, { backgroundColor: item.meta.color }]} />
                    )}
                  </View>
                  <View style={styles.dailyMixCopy}>
                    <Text style={styles.dailyMixLabel} numberOfLines={1}>{item.meta.label}</Text>
                    <Text style={styles.dailyMixCount}>{item.count}x</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          ) : (
            <Text style={styles.dailyEmptyText}>No emotions logged for this day.</Text>
          )}

          <View style={styles.dailyBreakdownHeader}>
            <Text style={styles.dailyBreakdownTitle}>Check-in trail</Text>
            <Text style={styles.dailyBreakdownMeta}>{selectedDayRecordLabel}</Text>
          </View>

          <Pressable
            style={[
              styles.dailyRecordsButton,
              !selectedDayEntries.length && styles.dailyRecordsButtonDisabled,
            ]}
            onPress={() => setShowDailyRecordsModal(true)}
            disabled={!selectedDayEntries.length}
            accessibilityRole="button"
            accessibilityLabel="Open daily emotion records"
          >
            {selectedDayEntries.length ? (
              <>
                <View style={styles.dailyRecordsButtonCopy}>
                  <Text style={styles.dailyRecordsButtonTitle}>View daily records</Text>
                  <Text style={styles.dailyRecordsButtonMeta}>Emotion, time, and source</Text>
                </View>
                <Ionicons name="list-outline" size={20} color="#31465A" />
              </>
            ) : (
              <Text style={styles.dailyRecordsEmptyText}>No check-ins yet</Text>
            )}
          </Pressable>
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
                  <Pressable
                    disabled={day.isOutsideMonth || day.state === "future"}
                    onPress={() => {
                      if (day.dayNumber) {
                        setSelectedDayNumber(day.dayNumber);
                      }
                    }}
                    style={[
                      styles.dayCircle,
                      day.isOutsideMonth && styles.dayCircleOutsideMonth,
                      day.state === "mood" && moodMeta && { backgroundColor: moodMeta.color },
                      day.state === "future" && styles.dayCircleFuture,
                      day.state === "empty" && styles.dayCircleEmpty,
                      day.state === "empty" && styles.dayCircleEmptyBorder,
                      isToday && styles.dayCircleToday,
                      day.isSelected && styles.dayCircleSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayNumber,
                        day.isOutsideMonth && styles.dayNumberOutsideMonth,
                        day.state === "future" && styles.dayNumberFuture,
                        day.state === "mood" && styles.dayNumberMood,
                        day.isSelected && styles.dayNumberSelected,
                      ]}
                    >
                      {day.dayNumber}
                    </Text>
                    {day.state === "mood" && Number(day.checkInCount || 0) > 1 ? (
                      <View style={styles.dayCountBadge}>
                        <Text style={styles.dayCountBadgeText}>{day.checkInCount}</Text>
                      </View>
                    ) : null}
                  </Pressable>
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
            <Text style={styles.insightText}>{dailyInsightText}</Text>
            <Text style={styles.insightFootnote}>{INSIGHT_FOOTNOTE}</Text>
          </View>
        </View>

        <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <View style={styles.summaryHeaderCopy}>
              <Text style={styles.summaryEyebrow}>MONTHLY TOTALS</Text>
              <Text style={styles.summaryMonth}>{`${getMonthName(displayMonthIndex)} ${displayYear}`}</Text>
              <Text style={styles.summarySub}>{monthlySubText}</Text>
            </View>

            <View style={styles.commonMoodWrap}>
              <Text style={styles.commonMoodMeta}>Most Common</Text>
              <View style={[styles.commonMoodFace, mostCommonMood && { borderColor: mostCommonMood.color }]}>
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
                <View style={[styles.statFace, { borderColor: item.color }]}>
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
      </ScrollView>

      <Modal
        visible={showDailyRecordsModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDailyRecordsModal(false)}
      >
        <View style={styles.detailModalBackdrop}>
          <View style={styles.recordsModalCard}>
            <View style={styles.recordsModalHeader}>
              <View style={styles.recordsModalHeaderCopy}>
                <Text style={styles.detailModalEyebrow}>DAILY RECORDS</Text>
                <Text style={styles.detailModalTitle}>{selectedDayLabel}</Text>
                <Text style={styles.detailModalMeta}>{selectedDayRecordLabel}</Text>
              </View>
              <Pressable style={styles.recordsModalCloseButton} onPress={() => setShowDailyRecordsModal(false)} accessibilityLabel="Close records">
                <Ionicons name="close" size={20} color="#31465A" />
              </Pressable>
            </View>

            <View style={styles.recordsTableHeader}>
              <Text style={[styles.recordsTableHeaderText, styles.recordsEmotionCell]}>Emotion</Text>
              <Text style={[styles.recordsTableHeaderText, styles.recordsTimeCell]}>Time</Text>
              <Text style={[styles.recordsTableHeaderText, styles.recordsSourceHeaderCell]}>From</Text>
            </View>

            <ScrollView style={styles.recordsTableScroll} contentContainerStyle={styles.recordsTableContent}>
              {selectedDayEntries.map((entry, index) => {
                const moodMeta = EMOTION_META[entry.moodId] ?? null;
                return (
                  <View key={entry.id ?? `${entry.moodId}-${index}`} style={styles.recordsTableRow}>
                    <Text style={[styles.recordsTableText, styles.recordsEmotionCell]} numberOfLines={1}>
                      {moodMeta?.label ?? entry.moodLabel}
                    </Text>
                    <Text style={[styles.recordsTableText, styles.recordsTimeCell]} numberOfLines={1}>
                      {formatCheckInTime(entry.createdAt) || "-"}
                    </Text>
                    <View style={styles.recordsSourceCell}>
                      <Text style={styles.recordsSourcePill}>{formatMoodSourceLabel(entry.moodSource)}</Text>
                    </View>
                  </View>
                );
              })}
            </ScrollView>

            <Pressable style={styles.detailModalButton} onPress={() => setShowDailyRecordsModal(false)}>
              <Text style={styles.detailModalButtonText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
      </InformedConsentGate>
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
  dailyCard: {
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
  dailyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    columnGap: 12,
    marginBottom: 12,
  },
  dailyMoodWrap: {
    alignItems: "center",
    minWidth: 88,
    flexShrink: 0,
  },
  dailyBreakdownHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
    marginBottom: 7,
  },
  dailyBreakdownTitle: {
    color: "#31465A",
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "700",
  },
  dailyBreakdownMeta: {
    color: "#7B8876",
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "700",
  },
  dailyMixScroller: {
    columnGap: 8,
    paddingRight: 2,
    paddingBottom: 1,
  },
  dailyMixChip: {
    width: 126,
    minHeight: 50,
    borderRadius: 16,
    backgroundColor: "#F8FBF5",
    borderWidth: 1,
    borderColor: "#E0E9DA",
    flexDirection: "row",
    alignItems: "center",
    columnGap: 8,
    paddingHorizontal: 9,
    paddingVertical: 7,
  },
  dailyMixFace: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  dailyMixImage: {
    width: 40,
    height: 40,
    borderRadius: 14,
  },
  dailyMixCopy: {
    flex: 1,
    minWidth: 0,
  },
  dailyMixLabel: {
    color: "#31465A",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
  },
  dailyMixCount: {
    color: "#6A7481",
    fontSize: 11,
    lineHeight: 15,
    marginTop: 1,
  },
  dailyRecordsButton: {
    minHeight: 54,
    borderRadius: 16,
    backgroundColor: "#F8FBF5",
    borderWidth: 1,
    borderColor: "#D9E7D2",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    columnGap: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  dailyRecordsButtonDisabled: {
    opacity: 0.72,
  },
  dailyEntryFallback: {
    width: 20,
    height: 20,
    borderRadius: 999,
  },
  dailyRecordsButtonCopy: {
    flex: 1,
    minWidth: 0,
  },
  dailyRecordsButtonTitle: {
    color: "#31465A",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "800",
  },
  dailyRecordsButtonMeta: {
    color: "#6A7481",
    fontSize: 11,
    lineHeight: 15,
    marginTop: 1,
  },
  dailyRecordsEmptyText: {
    color: "#6A7481",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
  },
  dailyEmptyText: {
    color: "#6A7481",
    fontSize: 13,
    lineHeight: 18,
    paddingVertical: 6,
  },
  summaryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    columnGap: 12,
    marginBottom: 12,
  },
  summaryHeaderCopy: {
    flex: 1,
    minWidth: 0,
    paddingRight: 2,
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
    flexShrink: 1,
  },
  commonMoodWrap: {
    alignItems: "center",
    minWidth: 84,
    flexShrink: 0,
  },
  commonMoodMeta: {
    color: "#6E7E8B",
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "700",
    marginBottom: 4,
  },
  commonMoodFace: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: "#F8FBF5",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
    borderWidth: 1.5,
    borderColor: "#DCE5DB",
    overflow: "hidden",
  },
  commonMoodImage: {
    width: 56,
    height: 56,
    borderRadius: 16,
  },
  commonMoodPlaceholder: {
    width: 56,
    height: 56,
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
    width: 56,
    height: 56,
    borderRadius: 17,
    backgroundColor: "#F9FBF7",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
    borderWidth: 1.5,
    borderColor: "#DCE5DB",
    overflow: "hidden",
  },
  statImage: {
    width: 52,
    height: 52,
    borderRadius: 15,
  },
  statImagePlaceholder: {
    width: 52,
    height: 52,
  },
  statCount: {
    color: "#4B5968",
    fontSize: 13,
    lineHeight: 16,
    fontWeight: "700",
  },
  statLabel: {
    color: "#7A8792",
    fontSize: 9,
    lineHeight: 11,
    marginTop: 2,
    minHeight: 22,
    textAlign: "center",
  },
  detailModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(36, 47, 42, 0.28)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 22,
  },
  detailModalCard: {
    width: "100%",
    maxWidth: 340,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DFEADB",
    paddingHorizontal: 20,
    paddingVertical: 18,
    shadowColor: "#24302B",
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  recordsModalCard: {
    width: "100%",
    maxWidth: 390,
    maxHeight: "82%",
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DFEADB",
    paddingHorizontal: 14,
    paddingTop: 16,
    paddingBottom: 14,
    shadowColor: "#24302B",
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  recordsModalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    columnGap: 12,
    marginBottom: 14,
  },
  recordsModalHeaderCopy: {
    flex: 1,
    minWidth: 0,
  },
  recordsModalCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 14,
    backgroundColor: "#F4F8F1",
    alignItems: "center",
    justifyContent: "center",
  },
  detailModalEyebrow: {
    color: "#7C8F77",
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 1,
    fontWeight: "800",
    marginBottom: 6,
  },
  detailModalTitle: {
    color: "#31465A",
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "800",
  },
  detailModalMeta: {
    color: "#6A7481",
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  detailModalTime: {
    color: "#31465A",
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "700",
    marginTop: 14,
  },
  recordsTableHeader: {
    minHeight: 34,
    borderRadius: 12,
    backgroundColor: "#EEF5EA",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    marginBottom: 6,
  },
  recordsTableHeaderText: {
    color: "#647960",
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "900",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  recordsTableScroll: {
    maxHeight: 320,
  },
  recordsTableContent: {
    rowGap: 6,
    paddingBottom: 2,
  },
  recordsTableRow: {
    minHeight: 42,
    borderRadius: 12,
    backgroundColor: "#FAFCF8",
    borderWidth: 1,
    borderColor: "#E4EDDE",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
  },
  recordsTableText: {
    color: "#31465A",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
  },
  recordsEmotionCell: {
    flex: 1.15,
    minWidth: 0,
    paddingRight: 8,
  },
  recordsTimeCell: {
    width: 78,
    paddingRight: 8,
  },
  recordsSourceCell: {
    width: 70,
    alignItems: "flex-start",
  },
  recordsSourceHeaderCell: {
    width: 70,
    paddingRight: 0,
  },
  recordsSourcePill: {
    color: "#31465A",
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "800",
    backgroundColor: "#EEF5EA",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    overflow: "hidden",
  },
  detailModalButton: {
    height: 42,
    borderRadius: 14,
    backgroundColor: "#31465A",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 18,
  },
  detailModalButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "800",
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
  dayCircleSelected: {
    borderWidth: 2,
    borderColor: "#31465A",
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
  dayNumberSelected: {
    color: "#263647",
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
    marginBottom: 14,
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

