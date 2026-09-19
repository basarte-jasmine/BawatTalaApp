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
        writtenDays.has(currentDay) };
  });
}

function formatLongDate(isoDate: string) {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC" });
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
  const [selectedJournalMode, setSelectedJournalMode] = useState<"muni" | "solo">("muni");

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
            
            <Text style={[styles.reflectionFootnote, compact && styles.reflectionFootnoteCompact]} numberOfLines={2}>
              Summary by Muni, an AI companion. Muni is not a psychometrician or a substitute for professional care.
            </Text>
          </View>
        </View>

        <View style={[styles.bottomSection, compact && styles.bottomSectionCompact]}>
          <Text style={styles.cardEyebrow}>WRITE AGAIN</Text>
          
          <View style={styles.carouselSection}>
            <View style={styles.carouselContainer}>
              <Pressable 
                onPress={() => setSelectedJournalMode("muni")} 
                style={styles.carouselArrow}
                disabled={selectedJournalMode === "muni"}
              >
                <Ionicons name="chevron-back" size={26} color={selectedJournalMode === "solo" ? "#4D6558" : "transparent"} />
              </Pressable>

              <View style={[styles.journalArtWrap, compact && styles.journalArtWrapCompact]}>
                <Image source={BOOK_IMAGE} style={[styles.bookImage, compact && styles.bookImageCompact, veryCompact && styles.bookImageVeryCompact]} resizeMode="contain" />
              </View>

              <Pressable 
                onPress={() => setSelectedJournalMode("solo")} 
                style={styles.carouselArrow}
                disabled={selectedJournalMode === "solo"}
              >
                <Ionicons name="chevron-forward" size={26} color={selectedJournalMode === "muni" ? "#4D6558" : "transparent"} />
              </Pressable>
            </View>

            <View style={styles.journalModeInfo}>
              <Text style={styles.journalModeTitle}>{selectedJournalMode === "muni" ? "Guided Journal" : "Solo Journal"}</Text>
              <Text style={styles.journalModeDesc}>{selectedJournalMode === "muni" ? "Reflect with Muni" : "Free write your thoughts"}</Text>
            </View>
          </View>

          <Pressable
            style={[styles.addEntryButton, compact && styles.addEntryButtonCompact]}
            onPress={() => router.push(`/write-entry?mode=new-${selectedJournalMode}`)}
          >
            <Text style={[styles.addEntryText, compact && styles.addEntryTextCompact]}>
              {selectedJournalMode === "muni" ? "Add Guided Entry" : "Add Solo Entry"}
            </Text>
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
              
              <View style={styles.modalHeaderRow}>
                <Text style={styles.modalEyebrow}>MUNI SUMMARY</Text>
                <Text style={styles.modalTitle}>{formatLongDate(weekAnchorDate)}</Text>
              </View>

              <View style={styles.modalThoughtLayout}>
                <View style={styles.modalThoughtBubble}>
                  <ScrollView style={styles.modalInsightScroll} contentContainerStyle={styles.modalInsightContent} showsVerticalScrollIndicator={false}>
                    <Text style={styles.modalInsightText}>{insightText}</Text>
                  </ScrollView>
                </View>

                <View style={styles.modalThoughtFooter}>
                  <View style={styles.thoughtDotsColumn}>
                    <View style={styles.thoughtDotLarge} />
                    <View style={styles.thoughtDotMedium} />
                    <View style={styles.thoughtDotSmall} />
                  </View>
                  <View style={styles.modalCompanionWrap}>
                    <MuniAvatar style={styles.modalCompanionImage} />
                  </View>
                </View>
              </View>

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
    backgroundColor: "#F7FAF4" },
  scroll: {
    flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: 10,
    paddingTop: 12,
    paddingBottom: 158 },
  contentCompact: {
    paddingTop: 8,
    paddingBottom: 148 },
  contentVeryCompact: {
    paddingTop: 6,
    paddingBottom: 138 },
  topSection: {
    flexShrink: 0 },
  topSectionCompact: {
    marginBottom: 2 },
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
    marginBottom: 14 },
  calendarCardCompact: {
    marginBottom: 10,
    paddingVertical: 10 },
  calendarHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10 },
  calendarHeaderCompact: {
    marginBottom: 8 },
  cardEyebrow: {
    color: "#7B8D74",
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 1,
    fontFamily: "Outfit-Bold",
    marginBottom: 8 },
  weekArrowButton: {
    width: 32,
    height: 32,
    borderRadius: 12,
    backgroundColor: "#F2F7ED",
    alignItems: "center",
    justifyContent: "center" },
  calendarTitle: {
    color: "#34475A",
    fontSize: 18,
    lineHeight: 22,
    fontFamily: "Outfit-Bold" },
  calendarTitleCompact: {
    fontSize: 16,
    lineHeight: 20 },
  calendarRow: {
    flexDirection: "row",
    justifyContent: "space-between" },
  dayItem: {
    alignItems: "center",
    rowGap: 6 },
  dayItemCompact: {
    rowGap: 4 },
  dayLabel: {
    color: "#3F4F60",
    fontSize: 15,
    lineHeight: 18,
    fontFamily: "Outfit-Bold" },
  dayLabelCompact: {
    fontSize: 13,
    lineHeight: 16 },
  dayCircle: {
    width: 31,
    height: 31,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center" },
  dayCircleCompact: {
    width: 28,
    height: 28 },
  dayCircleEmpty: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#86C74F" },
  dayCircleDone: {
    backgroundColor: "#AFE77D",
    borderWidth: 1.5,
    borderColor: "#AFE77D" },
  dayCircleActive: {
    backgroundColor: "#3E8F24",
    borderWidth: 1.5,
    borderColor: "#3E8F24" },
  dayCircleFuture: {
    backgroundColor: "#D7DDE2" },
  dayCircleSelected: {
    borderWidth: 2,
    borderColor: "#2F6F25" },
  dayCircleSelectedFilled: {
    borderWidth: 2,
    borderColor: "#285F20" },
  dayNumber: {
    color: "#3F4F60",
    fontSize: 15,
    lineHeight: 18,
    fontFamily: "Outfit-Bold" },
  dayNumberCompact: {
    fontSize: 13,
    lineHeight: 16 },
  dayNumberDone: {
    color: "#476346" },
  dayNumberActive: {
    color: "#FFFFFF" },
  dayNumberOutline: {
    color: "#3E4D5E" },
  dayNumberFuture: {
    color: "#7A8793" },
  dayNumberSelected: {
    fontFamily: "Outfit-Bold" },
  reflectionCard: {
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E4EFE0",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    shadowColor: "#5C6570",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
    marginBottom: 10,
    overflow: "hidden" },
  reflectionCardCompact: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
    marginBottom: 8 },
  reflectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10 },
  expandButton: {
    width: 28,
    height: 28,
    borderRadius: 999,
    backgroundColor: "#F2F7ED",
    alignItems: "center",
    justifyContent: "center" },
  reflectionLayoutRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    columnGap: 12,
    marginBottom: 10 },
  reflectionContentWrap: {
    flex: 1 },
  bubbleWrap: {
    backgroundColor: "#F5F9F1",
    padding: 14,
    borderRadius: 18,
    borderTopLeftRadius: 4 },
  bubbleWrapCompact: {
    padding: 10 },
  reflectionSnippetWrap: {
    flex: 1,
    overflow: "hidden",
    marginBottom: 8 },
  reflectionText: {
    color: "#33485B",
    fontSize: 15,
    lineHeight: 21 },
  reflectionTextCompact: {
    fontSize: 13,
    lineHeight: 18 },
  reflectionFootnote: {
    color: "#8FA088",
    fontSize: 10,
    lineHeight: 13,
    fontFamily: "Outfit-Bold" },
  reflectionFootnoteCompact: {
    fontSize: 9,
    lineHeight: 12 },
  companionWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#EFF7E8",
    alignItems: "center",
    justifyContent: "center" },
  companionWrapCompact: {
    width: 40,
    height: 40,
    borderRadius: 20 },
  companionImage: {
    width: 40,
    height: 40 },
  companionImageCompact: {
    width: 34,
    height: 34 },
  bottomSection: {
    marginTop: 8 },
  bottomSectionCompact: {
    marginTop: 4 },
  carouselSection: {
    marginBottom: 16 },
  carouselContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4 },
  carouselArrow: {
    width: 50,
    height: 100,
    alignItems: "center",
    justifyContent: "center" },
  carouselCenter: {
    alignItems: "center",
    flex: 1 },
  journalArtWrap: {
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 10 },
  journalArtWrapCompact: {
    marginBottom: 4 },
  bookImage: {
    width: 200,
    height: 250,
    shadowColor: "#5C6570",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 } },
  bookImageCompact: {
    width: 160,
    height: 210 },
  bookImageVeryCompact: {
    width: 130,
    height: 170 },
journalModeInfo: {
    alignItems: "center" },
  journalModeTitle: {
    color: "#34475A",
    fontSize: 16,
    lineHeight: 20,
    fontFamily: "Outfit-Bold",
    marginBottom: 2 },
  journalModeDesc: {
    color: "#7B8D74",
    fontSize: 13 },
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
    elevation: 3 },
  addEntryButtonCompact: {
    height: 42,
    marginBottom: 8 },
  addEntryText: {
    color: "#FFFFFF",
    fontSize: 18,
    lineHeight: 22,
    fontFamily: "Outfit-Bold" },
  addEntryTextCompact: {
    fontSize: 16,
    lineHeight: 20 },
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
    elevation: 2 },
  viewEntriesButtonCompact: {
    height: 40 },
  viewEntriesText: {
    color: "#4D6558",
    fontSize: 17,
    lineHeight: 22,
    fontFamily: "Outfit-Bold" },
  viewEntriesTextCompact: {
    fontSize: 15,
    lineHeight: 19 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(12, 18, 15, 0.8)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 22 },
  modalCard: {
    width: "100%",
    maxWidth: 340,
    maxHeight: "85%",
    backgroundColor: "transparent",
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 0 },
  modalHeaderRow: {
    marginBottom: 24,
    alignItems: "center" },
  modalEyebrow: {
    color: "#C2D2B8",
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 2,
    fontFamily: "Outfit-Bold",
    marginBottom: 4,
    textAlign: "center" },
  modalTitle: {
    color: "#FFFFFF",
    fontSize: 22,
    lineHeight: 28,
    fontFamily: "Outfit-Bold",
    textAlign: "center" },
  modalThoughtLayout: {
    alignItems: "flex-end",
    marginBottom: 16 },
  modalThoughtBubble: {
    backgroundColor: "#F5F9F1",
    padding: 18,
    borderRadius: 24,
    width: "100%",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4 },
  modalThoughtFooter: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 6,
    marginRight: 10 },
  thoughtDotsColumn: {
    alignItems: "center",
    marginRight: 8,
    marginTop: -4 },
  thoughtDotLarge: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#F5F9F1",
    marginBottom: 4,
    marginLeft: -16 },
  thoughtDotMedium: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: "#F5F9F1",
    marginBottom: 4,
    marginLeft: -4 },
  thoughtDotSmall: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "#F5F9F1",
    marginBottom: 4,
    marginLeft: 8 },
  modalCompanionWrap: {
    width: 60,
    height: 60,
    alignItems: "center",
    justifyContent: "center" },
  modalCompanionImage: {
    width: 60,
    height: 60 },
  modalInsightScroll: {
    flex: 1,
    maxHeight: 300 },
  modalInsightContent: {
    paddingBottom: 4 },
  modalInsightText: {
    color: "#33485B",
    fontSize: 16,
    lineHeight: 24 },
  modalCloseButton: {
    marginTop: 8,
    minHeight: 46,
    borderRadius: 999,
    backgroundColor: "#79C943",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4 },
  modalCloseButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    lineHeight: 20,
    fontFamily: "Outfit-Bold" } });
