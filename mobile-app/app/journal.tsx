import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Image, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { HomeBottomNav } from "../components/home/HomeBottomNav";
import { MuniAvatar } from "../components/muni/MuniAvatar";
import { fetchJournalCalendar, fetchJournalEntriesByDate } from "../lib/backend-api";
import { JournalLockGate } from "../lib/app-preferences";
import { useAuthSession } from "../lib/auth-session";
import { InformedConsentGate } from "../lib/informed-consent";
import { getManilaTodayParts } from "../lib/manila-date";
import { useOfflineSync } from "../lib/offline-sync";

type WeekDayItem = {
  date: number;
  hasEntries: boolean;
  id: string;
  isoDate: string;
  isFuture: boolean;
  isToday: boolean;
  label: string;
};

const BOOK_IMAGE = require("../assets/images/book_sample.png");
const WEEKDAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function buildIsoDate(year: number, monthIndex: number, day: number) {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function buildWeekDates(isoDate: string, writtenDays: Set<number>) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const baseDate = new Date(Date.UTC(year, month - 1, day));
  const weekday = baseDate.getUTCDay();
  const startDateMs = baseDate.getTime() - weekday * 86400000;
  const todayIso = getManilaTodayParts().isoDate;

  return Array.from({ length: 7 }, (_, index) => {
    const current = new Date(startDateMs + index * 86400000);
    const currentYear = current.getUTCFullYear();
    const currentMonth = current.getUTCMonth();
    const currentDay = current.getUTCDate();
    const currentIso = buildIsoDate(currentYear, currentMonth, currentDay);
    return {
      id: `${currentIso}-${index}`,
      label: WEEKDAY_LABELS[index],
      date: currentDay,
      isoDate: currentIso,
      isToday: currentIso === todayIso,
      isFuture: currentIso > todayIso,
      hasEntries:
        currentYear === year &&
        currentMonth === month - 1 &&
        writtenDays.has(currentDay),
    };
  });
}

function formatLongDate(isoDate: string) {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default function JournalScreen() {
  const { user } = useAuthSession();
  const { isSyncing, refreshKey, syncNow } = useOfflineSync();
  const { height } = useWindowDimensions();
  const compact = height < 760;
  const veryCompact = height < 700;
  const manilaToday = getManilaTodayParts();
  const [calendarDays, setCalendarDays] = useState<WeekDayItem[]>([]);
  const [weekAnchorDate, setWeekAnchorDate] = useState(manilaToday.isoDate);
  const [insightText, setInsightText] = useState(
    "There is no journal summary for this date yet.",
  );
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showFullInsightModal, setShowFullInsightModal] = useState(false);

  const selectedDay = useMemo(
    () => calendarDays.find((day) => day.isoDate === weekAnchorDate) ?? null,
    [calendarDays, weekAnchorDate],
  );

  const loadWeekData = useCallback(async (targetIsoDate: string) => {
    if (!user?.studentNumber) {
      setCalendarDays([]);
      setInsightText("There is no journal summary for this date yet.");
      return;
    }

    const [year, month] = targetIsoDate.split("-").map(Number);
    const calendarResult = await fetchJournalCalendar(user.studentNumber, year);
    const monthIndex = month - 1;
    const writtenDays = new Set<number>(calendarResult.writtenDaysByMonth?.[String(monthIndex)] ?? []);
    const builtWeek = buildWeekDates(targetIsoDate, writtenDays);
    setCalendarDays(builtWeek);

    const dateResult = await fetchJournalEntriesByDate(user.studentNumber, targetIsoDate);
    const combinedInsights = (dateResult.entries ?? [])
      .flatMap((entry) => entry.insights ?? [])
      .map((item) => String(item || "").trim())
      .filter(Boolean);

    const uniqueInsights = [...new Set(combinedInsights)];

    setInsightText(
      uniqueInsights.length > 0
        ? uniqueInsights.join(" ")
        : "There is no journal summary for this date yet.",
    );
  }, [user?.studentNumber]);

  useFocusEffect(
    useCallback(() => {
      void loadWeekData(weekAnchorDate);
    }, [loadWeekData, weekAnchorDate]),
  );

  useEffect(() => {
    if (!user?.studentNumber) return;
    void loadWeekData(weekAnchorDate);
  }, [loadWeekData, refreshKey, user?.studentNumber, weekAnchorDate]);

  const handleRefreshJournal = useCallback(async () => {
    setIsRefreshing(true);
    await syncNow();
    await loadWeekData(weekAnchorDate);
    setIsRefreshing(false);
  }, [loadWeekData, syncNow, weekAnchorDate]);

  const handleMoveWeek = useCallback((direction: -1 | 1) => {
    const [year, month, day] = weekAnchorDate.split("-").map(Number);
    const baseDate = new Date(Date.UTC(year, month - 1, day));
    const nextDate = new Date(baseDate.getTime() + direction * 7 * 86400000);
    const nextIso = buildIsoDate(nextDate.getUTCFullYear(), nextDate.getUTCMonth(), nextDate.getUTCDate());
    setWeekAnchorDate(nextIso);
    void loadWeekData(nextIso);
  }, [loadWeekData, weekAnchorDate]);

  const handleSelectDay = useCallback((isoDate: string, isFuture: boolean) => {
    if (isFuture) {
      return;
    }
    setWeekAnchorDate(isoDate);
    void loadWeekData(isoDate);
  }, [loadWeekData]);

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <JournalLockGate>
        <InformedConsentGate feature="journal">
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.content, compact && styles.contentCompact, veryCompact && styles.contentVeryCompact]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing || isSyncing}
              onRefresh={handleRefreshJournal}
              colors={["#73CD44"]}
              tintColor="#73CD44"
            />
          }
        >
        <View style={[styles.topSection, compact && styles.topSectionCompact]}>
          <View style={[styles.calendarCard, compact && styles.calendarCardCompact]}>
            <Text style={styles.cardEyebrow}>THIS WEEK</Text>
            <View style={[styles.calendarHeader, compact && styles.calendarHeaderCompact]}>
              <Pressable onPress={() => handleMoveWeek(-1)} style={styles.weekArrowButton}>
                <Ionicons name="chevron-back" size={22} color="#3A4A5B" />
              </Pressable>

              <Text style={[styles.calendarTitle, compact && styles.calendarTitleCompact]}>
                {formatLongDate(weekAnchorDate)}
              </Text>

              <Pressable onPress={() => handleMoveWeek(1)} style={styles.weekArrowButton}>
                <Ionicons name="chevron-forward" size={22} color="#3A4A5B" />
              </Pressable>
            </View>

            <View style={styles.calendarRow}>
              {calendarDays.map((day) => (
                <View key={day.id} style={[styles.dayItem, compact && styles.dayItemCompact]}>
                  <Text style={[styles.dayLabel, compact && styles.dayLabelCompact]}>{day.label}</Text>
                  <Pressable
                    onPress={() => handleSelectDay(day.isoDate, day.isFuture)}
                    disabled={day.isFuture}
                    style={[
                      styles.dayCircle,
                      compact && styles.dayCircleCompact,
                      !day.isFuture && styles.dayCircleEmpty,
                      day.hasEntries && styles.dayCircleDone,
                      day.isToday && day.hasEntries && styles.dayCircleActive,
                      day.isFuture && styles.dayCircleFuture,
                      selectedDay?.isoDate === day.isoDate && !day.hasEntries && !day.isFuture && styles.dayCircleSelected,
                      selectedDay?.isoDate === day.isoDate && day.hasEntries && styles.dayCircleSelectedFilled,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayNumber,
                        compact && styles.dayNumberCompact,
                        day.hasEntries && styles.dayNumberDone,
                        day.isToday && day.hasEntries && styles.dayNumberActive,
                        !day.isFuture && !day.hasEntries && styles.dayNumberOutline,
                        day.isFuture && styles.dayNumberFuture,
                        selectedDay?.isoDate === day.isoDate && !day.isFuture && styles.dayNumberSelected,
                      ]}
                    >
                      {day.date}
                    </Text>
                  </Pressable>
                </View>
              ))}
            </View>
          </View>

          <View style={[styles.reflectionCard, compact && styles.reflectionCardCompact]}>
            <View style={styles.reflectionHeader}>
              <Text style={styles.cardEyebrow}>MUNI SUMMARY</Text>
              <Pressable
                style={styles.expandButton}
                onPress={() => setShowFullInsightModal(true)}
                accessibilityLabel="Open full summary"
              >
                <Ionicons name="expand-outline" size={16} color="#586C7F" />
              </Pressable>
            </View>

            <Pressable style={styles.reflectionSnippetWrap} onPress={() => setShowFullInsightModal(true)}>
              <Text style={[styles.reflectionText, compact && styles.reflectionTextCompact]} numberOfLines={compact ? 2 : 3}>
                {insightText}
              </Text>
            </Pressable>

            <View style={[styles.reflectionFooterRow, compact && styles.reflectionFooterRowCompact]}>
              <View style={[styles.companionWrap, compact && styles.companionWrapCompact]}>
                <MuniAvatar style={[styles.companionImage, compact && styles.companionImageCompact]} />
              </View>

              <Text style={[styles.reflectionFootnote, compact && styles.reflectionFootnoteCompact]} numberOfLines={2}>
                Summary by Muni, an AI companion. Muni is not a psychometrician or a substitute for professional care.
              </Text>
            </View>
          </View>
        </View>

        <View style={[styles.bottomSection, compact && styles.bottomSectionCompact]}>
          <Text style={styles.cardEyebrow}>WRITE AGAIN</Text>
          <View style={[styles.journalArtWrap, compact && styles.journalArtWrapCompact]}>
            <Image source={BOOK_IMAGE} style={[styles.bookImage, compact && styles.bookImageCompact, veryCompact && styles.bookImageVeryCompact]} resizeMode="contain" />
          </View>

          <Pressable
            style={[styles.addEntryButton, compact && styles.addEntryButtonCompact]}
            onPress={() => router.push("/write-entry?mode=new")}
          >
            <Text style={[styles.addEntryText, compact && styles.addEntryTextCompact]}>Add Entry</Text>
          </Pressable>

          <Pressable
            style={[styles.viewEntriesButton, compact && styles.viewEntriesButtonCompact]}
            onPress={() => router.push("/journal-entries")}
          >
            <Text style={[styles.viewEntriesText, compact && styles.viewEntriesTextCompact]}>View Entries</Text>
          </Pressable>
        </View>
        </ScrollView>

        <Modal
          visible={showFullInsightModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowFullInsightModal(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <View style={styles.modalHeaderCopy}>
                  <Text style={styles.modalEyebrow}>MUNI SUMMARY</Text>
                  <Text style={styles.modalTitle}>{formatLongDate(weekAnchorDate)}</Text>
                </View>

                <View style={styles.modalCompanionWrap}>
                  <MuniAvatar style={styles.modalCompanionImage} />
                </View>
              </View>

              <ScrollView style={styles.modalInsightScroll} contentContainerStyle={styles.modalInsightContent} showsVerticalScrollIndicator={false}>
                <Text style={styles.modalInsightText}>{insightText}</Text>
              </ScrollView>

              <Pressable style={styles.modalCloseButton} onPress={() => setShowFullInsightModal(false)}>
                <Text style={styles.modalCloseButtonText}>Close</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
        </InformedConsentGate>
      </JournalLockGate>

      <HomeBottomNav activeTab="journal" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F7FAF4",
  },
  scroll: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 10,
    paddingTop: 12,
    paddingBottom: 158,
  },
  contentCompact: {
    paddingTop: 8,
    paddingBottom: 148,
  },
  contentVeryCompact: {
    paddingTop: 6,
    paddingBottom: 138,
  },
  topSection: {
    flexShrink: 0,
  },
  topSectionCompact: {
    marginBottom: 2,
  },
  calendarCard: {
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E4EFE0",
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: "#5C6570",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
    marginBottom: 14,
  },
  calendarCardCompact: {
    marginBottom: 10,
    paddingVertical: 10,
  },
  calendarHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  calendarHeaderCompact: {
    marginBottom: 8,
  },
  cardEyebrow: {
    color: "#7B8D74",
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 1,
    fontWeight: "700",
    marginBottom: 8,
  },
  weekArrowButton: {
    width: 32,
    height: 32,
    borderRadius: 12,
    backgroundColor: "#F2F7ED",
    alignItems: "center",
    justifyContent: "center",
  },
  calendarTitle: {
    color: "#34475A",
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "700",
  },
  calendarTitleCompact: {
    fontSize: 16,
    lineHeight: 20,
  },
  calendarRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  dayItem: {
    alignItems: "center",
    rowGap: 6,
  },
  dayItemCompact: {
    rowGap: 4,
  },
  dayLabel: {
    color: "#3F4F60",
    fontSize: 15,
    lineHeight: 18,
    fontWeight: "700",
  },
  dayLabelCompact: {
    fontSize: 13,
    lineHeight: 16,
  },
  dayCircle: {
    width: 31,
    height: 31,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  dayCircleCompact: {
    width: 28,
    height: 28,
  },
  dayCircleEmpty: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#86C74F",
  },
  dayCircleDone: {
    backgroundColor: "#AFE77D",
    borderWidth: 1.5,
    borderColor: "#AFE77D",
  },
  dayCircleActive: {
    backgroundColor: "#3E8F24",
    borderWidth: 1.5,
    borderColor: "#3E8F24",
  },
  dayCircleFuture: {
    backgroundColor: "#D7DDE2",
  },
  dayCircleSelected: {
    borderWidth: 2,
    borderColor: "#2F6F25",
  },
  dayCircleSelectedFilled: {
    borderWidth: 2,
    borderColor: "#285F20",
  },
  dayNumber: {
    color: "#3F4F60",
    fontSize: 15,
    lineHeight: 18,
    fontWeight: "700",
  },
  dayNumberCompact: {
    fontSize: 13,
    lineHeight: 16,
  },
  dayNumberDone: {
    color: "#476346",
  },
  dayNumberActive: {
    color: "#FFFFFF",
  },
  dayNumberOutline: {
    color: "#3E4D5E",
  },
  dayNumberFuture: {
    color: "#7A8793",
  },
  dayNumberSelected: {
    fontWeight: "700",
  },
  reflectionCard: {
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E4EFE0",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    shadowColor: "#5C6570",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
    marginBottom: 10,
    height: 168,
    overflow: "hidden",
  },
  reflectionCardCompact: {
    height: 150,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
    marginBottom: 8,
  },
  reflectionFooterRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    columnGap: 10,
    minHeight: 48,
    marginTop: "auto",
  },
  reflectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  expandButton: {
    width: 28,
    height: 28,
    borderRadius: 999,
    backgroundColor: "#F4F8F1",
    alignItems: "center",
    justifyContent: "center",
  },
  reflectionSnippetWrap: {
    flex: 1,
    overflow: "hidden",
    marginBottom: 8,
  },
  reflectionFooterRowCompact: {
    columnGap: 8,
  },
  reflectionText: {
    color: "#33485B",
    fontSize: 15,
    lineHeight: 21,
    marginBottom: 0,
  },
  reflectionTextCompact: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 8,
  },
  reflectionFootnote: {
    flex: 1,
    flexShrink: 1,
    color: "#7B858E",
    fontSize: 10,
    lineHeight: 13,
    paddingTop: 2,
  },
  reflectionFootnoteCompact: {
    fontSize: 9,
    lineHeight: 12,
    paddingTop: 1,
  },
  companionWrap: {
    width: 54,
    height: 54,
    alignItems: "center",
    justifyContent: "center",
  },
  companionWrapCompact: {
    width: 44,
    height: 44,
  },
  companionImage: {
    width: 52,
    height: 52,
  },
  companionImageCompact: {
    width: 42,
    height: 42,
  },
  bottomSection: {
    marginTop: 8,
  },
  bottomSectionCompact: {
    marginTop: 4,
  },
  journalArtWrap: {
    width: 222,
    height: 222,
    borderRadius: 40,
    backgroundColor: "#F1F8EB",
    borderWidth: 1,
    borderColor: "#E3EFDA",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginTop: 0,
    marginBottom: 16,
    shadowColor: "#5C6570",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  journalArtWrapCompact: {
    width: 206,
    height: 206,
    marginBottom: 10,
  },
  bookImage: {
    width: 184,
    height: 244,
  },
  bookImageCompact: {
    width: 168,
    height: 224,
  },
  bookImageVeryCompact: {
    width: 146,
    height: 192,
  },
  addEntryButton: {
    height: 46,
    borderRadius: 999,
    backgroundColor: "#7BCB45",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 18,
    marginBottom: 10,
    shadowColor: "#5C6570",
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  addEntryButtonCompact: {
    height: 42,
    marginBottom: 8,
  },
  addEntryText: {
    color: "#FFFFFF",
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "700",
  },
  addEntryTextCompact: {
    fontSize: 16,
    lineHeight: 20,
  },
  viewEntriesButton: {
    height: 42,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D9E7D1",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 18,
    shadowColor: "#5C6570",
    shadowOpacity: 0.14,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  viewEntriesButtonCompact: {
    height: 40,
  },
  viewEntriesText: {
    color: "#4D6558",
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "700",
  },
  viewEntriesTextCompact: {
    fontSize: 15,
    lineHeight: 19,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(21, 27, 24, 0.34)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 22,
  },
  modalCard: {
    width: "100%",
    maxWidth: 340,
    maxHeight: "76%",
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E0ECD7",
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 16,
    shadowColor: "#525C67",
    shadowOpacity: 0.16,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 12,
    marginBottom: 12,
  },
  modalHeaderCopy: {
    flex: 1,
  },
  modalEyebrow: {
    color: "#7B8D74",
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 1,
    fontWeight: "700",
    marginBottom: 4,
  },
  modalTitle: {
    color: "#32465C",
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "700",
  },
  modalCompanionWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "#EFF7E8",
    borderWidth: 1,
    borderColor: "#D8E9CB",
    alignItems: "center",
    justifyContent: "center",
  },
  modalCompanionImage: {
    width: 34,
    height: 34,
  },
  modalInsightScroll: {
    maxHeight: 280,
  },
  modalInsightContent: {
    paddingBottom: 4,
  },
  modalInsightText: {
    color: "#33485B",
    fontSize: 15,
    lineHeight: 22,
  },
  modalCloseButton: {
    marginTop: 14,
    minHeight: 40,
    borderRadius: 999,
    backgroundColor: "#79C943",
    alignItems: "center",
    justifyContent: "center",
  },
  modalCloseButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "700",
  },
});

