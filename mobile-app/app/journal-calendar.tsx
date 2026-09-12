import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { fetchJournalCalendar, fetchJournalEntriesByDate } from "../lib/backend-api";
import { JournalLockGate } from "../lib/app-preferences";
import { useAuthSession } from "../lib/auth-session";
import { getManilaTodayParts } from "../lib/manila-date";
import { useOfflineSync } from "../lib/offline-sync";

type CalendarEntryItem = {
  createdAt: string;
  entryDate: string;
  id: string;
  preview: string;
  summary: string;
  title: string;
};

type MonthMeta = {
  daysInMonth: number;
  firstDay: number;
  monthIndex: number;
  name: string;
};

const MIN_YEAR = 2020;
const DAY_PAGE_SIZE = 10;
const WEEKDAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function buildMonths(year: number): MonthMeta[] {
  return MONTH_NAMES.map((name, monthIndex) => {
    const firstDay = new Date(year, monthIndex, 1).getDay();
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    return { monthIndex, name, firstDay, daysInMonth };
  });
}

function buildIsoDate(year: number, monthIndex: number, day: number) {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function formatDateHeading(isoDate: string) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatEntryTime(createdAt: string) {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export default function JournalCalendarScreen() {
  const { user } = useAuthSession();
  const { isSyncing, refreshKey, syncNow } = useOfflineSync();
  const manilaToday = getManilaTodayParts();
  const handledReopenDateRef = useRef<string | null>(null);
  const { reopenDate: reopenDateParam } = useLocalSearchParams<{ reopenDate?: string }>();
  const reopenDate = Array.isArray(reopenDateParam) ? reopenDateParam[0] : reopenDateParam;
  const [selectedYear, setSelectedYear] = useState(Math.max(MIN_YEAR, manilaToday.year));
  const [entryCountsByMonth, setEntryCountsByMonth] = useState<Record<number, Record<number, number>>>({});
  const [selectedDate, setSelectedDate] = useState(manilaToday.isoDate);
  const [selectedEntries, setSelectedEntries] = useState<CalendarEntryItem[]>([]);
  const [entriesPage, setEntriesPage] = useState(1);
  const [hasMoreEntries, setHasMoreEntries] = useState(false);
  const [totalEntryCount, setTotalEntryCount] = useState(0);
  const [entriesLoading, setEntriesLoading] = useState(false);
  const [loadingMoreEntries, setLoadingMoreEntries] = useState(false);
  const [showEntriesModal, setShowEntriesModal] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const months = useMemo(() => buildMonths(selectedYear), [selectedYear]);

  const loadCalendar = useCallback(async (year: number) => {
    if (!user?.studentNumber) {
      setEntryCountsByMonth({});
      return;
    }

    const result = await fetchJournalCalendar(user.studentNumber, year);
    if (!result.ok) {
      setEntryCountsByMonth({});
      return;
    }

    const mapped: Record<number, Record<number, number>> = {};
    for (const [monthKey, value] of Object.entries(result.entryCountsByMonth ?? {})) {
      const parsedMonth = Number(monthKey);
      mapped[parsedMonth] = {};
      for (const [dayKey, count] of Object.entries(value ?? {})) {
        mapped[parsedMonth][Number(dayKey)] = Number(count);
      }
    }
    setEntryCountsByMonth(mapped);
  }, [user?.studentNumber]);

  const loadEntriesForDate = useCallback(async (isoDate: string, page = 1, append = false) => {
    if (!user?.studentNumber) {
      setSelectedEntries([]);
      setHasMoreEntries(false);
      setTotalEntryCount(0);
      return;
    }

    if (append) {
      setLoadingMoreEntries(true);
    } else {
      setEntriesLoading(true);
    }

    const result = await fetchJournalEntriesByDate(user.studentNumber, isoDate, {
      page,
      pageSize: DAY_PAGE_SIZE,
    });

    if (append) {
      setLoadingMoreEntries(false);
    } else {
      setEntriesLoading(false);
    }

    if (!result.ok) {
      if (!append) {
        setSelectedEntries([]);
        setHasMoreEntries(false);
        setTotalEntryCount(0);
      }
      return;
    }

    const nextEntries = result.entries ?? [];
    setSelectedEntries((prev) => (append ? [...prev, ...nextEntries] : nextEntries));
    setEntriesPage(Number(result.page) || page);
    setHasMoreEntries(Boolean(result.hasMore));
    setTotalEntryCount(Number(result.totalCount ?? nextEntries.length));
  }, [user?.studentNumber]);

  useFocusEffect(
    useCallback(() => {
      void loadCalendar(selectedYear);
    }, [loadCalendar, selectedYear]),
  );

  useEffect(() => {
    if (!reopenDate || !/^\d{4}-\d{2}-\d{2}$/.test(reopenDate)) {
      handledReopenDateRef.current = null;
      return;
    }
    if (handledReopenDateRef.current === reopenDate) {
      return;
    }
    handledReopenDateRef.current = reopenDate;

    const [yearStr] = reopenDate.split("-");
    const year = Number(yearStr);
    if (Number.isFinite(year) && year >= MIN_YEAR) {
      setSelectedYear(year);
    }
    setSelectedDate(reopenDate);
    setShowEntriesModal(true);
    void loadEntriesForDate(reopenDate, 1, false);
    router.setParams({ reopenDate: undefined });
  }, [loadEntriesForDate, reopenDate]);

  useEffect(() => {
    if (!user?.studentNumber) return;
    void loadCalendar(selectedYear);
  }, [loadCalendar, refreshKey, selectedYear, user?.studentNumber]);

  const handleRefreshCalendar = useCallback(async () => {
    setIsRefreshing(true);
    await syncNow();
    await loadCalendar(selectedYear);
    if (showEntriesModal) {
      await loadEntriesForDate(selectedDate, 1, false);
    }
    setIsRefreshing(false);
  }, [loadCalendar, loadEntriesForDate, selectedDate, selectedYear, showEntriesModal, syncNow]);

  const handleChangeYear = useCallback((nextYear: number) => {
    if (nextYear < MIN_YEAR) {
      return;
    }
    setSelectedYear(nextYear);

    const nextSelectedDate =
      nextYear === manilaToday.year
        ? manilaToday.isoDate
        : `${nextYear}-01-01`;
    setSelectedDate(nextSelectedDate);
    void loadCalendar(nextYear);
  }, [loadCalendar, manilaToday.isoDate, manilaToday.year]);

  const handleSelectDate = useCallback((isoDate: string, isFuture: boolean) => {
    if (isFuture) {
      return;
    }
    setSelectedDate(isoDate);
    setShowEntriesModal(true);
    void loadEntriesForDate(isoDate, 1, false);
  }, [loadEntriesForDate]);

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.topBar}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={28} color="#37414A" />
        </Pressable>
        <Text style={styles.topBarTitle}>Journal Calendar</Text>
        <View style={styles.topBarSpacer} />
      </View>

      <JournalLockGate>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing || isSyncing}
              onRefresh={handleRefreshCalendar}
              colors={["#73CD44"]}
              tintColor="#73CD44"
            />
          }
        >
          <View style={styles.yearControlRow}>
            <Pressable
              style={[styles.yearArrowButton, selectedYear <= MIN_YEAR && styles.yearArrowButtonDisabled]}
              disabled={selectedYear <= MIN_YEAR}
              onPress={() => handleChangeYear(selectedYear - 1)}
            >
              <Ionicons name="chevron-up" size={22} color={selectedYear <= MIN_YEAR ? "#A3ABB4" : "#3D4B59"} />
            </Pressable>

            <Text style={styles.yearLabel}>{selectedYear}</Text>

            <Pressable
              style={styles.yearArrowButton}
              onPress={() => handleChangeYear(selectedYear + 1)}
            >
              <Ionicons name="chevron-down" size={22} color="#3D4B59" />
            </Pressable>
          </View>

          {months.map((month) => {
            const entryCounts = entryCountsByMonth[month.monthIndex] ?? {};
            const totalCells = month.firstDay + month.daysInMonth;
            const trailingSpacers = (7 - (totalCells % 7)) % 7;
            const cells = Array.from({ length: totalCells + trailingSpacers }, (_, index) => {
              const dayNumber = index - month.firstDay + 1;
              if (dayNumber < 1 || dayNumber > month.daysInMonth) {
                return { dayNumber: null as number | null, key: `blank-${month.monthIndex}-${index}` };
              }
              return { dayNumber, key: `day-${month.monthIndex}-${dayNumber}` };
            });

            return (
              <View key={`${selectedYear}-${month.name}`} style={styles.monthSection}>
                <View style={styles.monthHeader}>
                  <Text style={styles.monthTitle}>{month.name}</Text>
                </View>

                <View style={styles.weekHeaderRow}>
                  {WEEKDAY_LABELS.map((label) => (
                    <Text key={`${month.name}-${label}`} style={styles.weekHeaderText}>
                      {label}
                    </Text>
                  ))}
                </View>

                <View style={styles.daysGrid}>
                  {cells.map((cell) => {
                    if (cell.dayNumber === null) {
                      return <View key={cell.key} style={styles.dayCell} />;
                    }

                    const isoDate = buildIsoDate(selectedYear, month.monthIndex, cell.dayNumber);
                    const isFuture = isoDate > manilaToday.isoDate;
                    const hasEntries = Number(entryCounts[cell.dayNumber] || 0) > 0;
                    const isToday = isoDate === manilaToday.isoDate;
                    const isSelected = isoDate === selectedDate;

                    return (
                      <View key={cell.key} style={styles.dayCell}>
                        <Pressable
                          style={[
                            styles.dayCircle,
                            !isFuture && styles.dayCircleEmpty,
                            hasEntries && styles.dayCircleHasEntry,
                            isToday && hasEntries && styles.dayCircleTodayHasEntry,
                            isFuture && styles.dayCircleFuture,
                            isSelected && !isFuture && !hasEntries && styles.dayCircleSelectedEmpty,
                            isSelected && hasEntries && styles.dayCircleSelectedFilled,
                          ]}
                          onPress={() => handleSelectDate(isoDate, isFuture)}
                        >
                          <Text
                            style={[
                              styles.dayNumber,
                              !isFuture && styles.dayNumberEmpty,
                              hasEntries && styles.dayNumberHasEntry,
                              isFuture && styles.dayNumberFuture,
                              isSelected && !isFuture && styles.dayNumberSelected,
                            ]}
                          >
                            {cell.dayNumber}
                          </Text>
                        </Pressable>
                      </View>
                    );
                  })}
                </View>
              </View>
            );
          })}
        </ScrollView>

        <Modal
          visible={showEntriesModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowEntriesModal(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.selectedEntriesCard}>
              <Text style={styles.selectedEntriesTitle}>{formatDateHeading(selectedDate)}</Text>
              {totalEntryCount > 0 ? (
                <Text style={styles.selectedEntriesMeta}>
                  Showing {selectedEntries.length} of {totalEntryCount}
                </Text>
              ) : null}

              {entriesLoading ? (
                <ActivityIndicator color="#73CD44" style={{ marginVertical: 16 }} />
              ) : selectedEntries.length === 0 ? (
                <Text style={styles.emptyEntriesText}>There are no entries for that day.</Text>
              ) : (
                <ScrollView style={styles.selectedEntriesScroll} showsVerticalScrollIndicator={false}>
                  <View style={styles.selectedEntriesList}>
                    {selectedEntries.map((entry) => (
                      <Pressable
                        key={entry.id}
                        style={styles.entryCard}
                        onPress={() => {
                          setShowEntriesModal(false);
                          router.push(
                            `/journal-entry-view?entryId=${encodeURIComponent(entry.id)}&fromCalendar=1&calendarDate=${encodeURIComponent(selectedDate)}`,
                          );
                        }}
                      >
                        <Text style={styles.entryTime}>{formatEntryTime(entry.createdAt)}</Text>
                        <Text style={styles.entryPreview} numberOfLines={2}>
                          {entry.preview || entry.summary || entry.title || "Journal entry"}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  {hasMoreEntries ? (
                    <Pressable
                      style={[styles.loadMoreButton, loadingMoreEntries && styles.loadMoreButtonDisabled]}
                      disabled={loadingMoreEntries}
                      onPress={() => void loadEntriesForDate(selectedDate, entriesPage + 1, true)}
                    >
                      {loadingMoreEntries ? (
                        <ActivityIndicator color="#FFFFFF" />
                      ) : (
                        <Text style={styles.loadMoreButtonText}>Load more</Text>
                      )}
                    </Pressable>
                  ) : null}
                </ScrollView>
              )}

              <Pressable style={styles.closeModalButton} onPress={() => setShowEntriesModal(false)}>
                <Text style={styles.closeModalButtonText}>Close</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      </JournalLockGate>
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
    borderBottomWidth: 1,
    borderBottomColor: "#D8E3D4",
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    shadowColor: "#5C6570",
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
  topBarTitle: {
    color: "#2F4155",
    fontSize: 17,
    lineHeight: 22,
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
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 40,
  },
  yearControlRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2ECD9",
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 14,
    shadowColor: "#5C6570",
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  yearArrowButton: {
    width: 36,
    height: 36,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F2F7EE",
  },
  yearArrowButtonDisabled: {
    opacity: 0.45,
  },
  yearLabel: {
    color: "#3B4A5A",
    fontSize: 18,
    lineHeight: 24,
    fontFamily: "Outfit-Bold",
    minWidth: 56,
    textAlign: "center",
  },
  monthSection: {
    marginBottom: 16,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2ECD9",
    paddingHorizontal: 10,
    paddingVertical: 14,
    shadowColor: "#5C6570",
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  monthHeader: {
    marginBottom: 8,
  },
  monthTitle: {
    textAlign: "center",
    color: "#3F4E5E",
    fontSize: 20,
    lineHeight: 26,
    fontFamily: "Outfit-Bold",
  },
  weekHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 3,
    paddingHorizontal: 4,
  },
  weekHeaderText: {
    width: `${100 / 7}%`,
    textAlign: "center",
    color: "#435365",
    fontSize: 16,
    lineHeight: 20,
    fontFamily: "Outfit-Bold",
  },
  daysGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  dayCell: {
    width: `${100 / 7}%`,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 5,
  },
  dayCircle: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  dayCircleEmpty: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#9BC96F",
  },
  dayCircleHasEntry: {
    backgroundColor: "#EFF8E7",
    borderWidth: 1.5,
    borderColor: "#BDE09D",
  },
  dayCircleTodayHasEntry: {
    backgroundColor: "#8FCE61",
    borderColor: "#7ABD4D",
  },
  dayCircleFuture: {
    backgroundColor: "#D7DDE2",
  },
  dayCircleSelectedEmpty: {
    borderWidth: 2,
    borderColor: "#2F6F25",
  },
  dayCircleSelectedFilled: {
    borderWidth: 2,
    borderColor: "#2F6F25",
  },
  dayNumber: {
    fontSize: 16,
    lineHeight: 20,
    fontFamily: "Outfit-SemiBold",
  },
  dayNumberEmpty: {
    color: "#4A5968",
  },
  dayNumberHasEntry: {
    color: "#406152",
    fontFamily: "Outfit-Bold",
  },
  dayNumberFuture: {
    color: "#7A8793",
  },
  dayNumberSelected: {
    color: "#2F4257",
    fontFamily: "Outfit-Bold",
  },
  selectedEntriesCard: {
    width: "100%",
    maxWidth: 340,
    maxHeight: "78%",
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2ECD9",
    paddingHorizontal: 16,
    paddingVertical: 16,
    shadowColor: "#525C67",
    shadowOpacity: 0.16,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  selectedEntriesTitle: {
    color: "#2F4257",
    fontSize: 18,
    lineHeight: 24,
    fontFamily: "Outfit-Bold",
    marginBottom: 4,
  },
  selectedEntriesMeta: {
    color: "#70808D",
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 10,
    fontFamily: "Outfit-SemiBold",
  },
  selectedEntriesScroll: {
    maxHeight: 360,
  },
  selectedEntriesList: {
    rowGap: 8,
  },
  entryCard: {
    borderRadius: 16,
    backgroundColor: "#F8FCF4",
    borderWidth: 1,
    borderColor: "#E2ECD9",
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  entryTime: {
    color: "#32465C",
    fontSize: 15,
    lineHeight: 20,
    fontFamily: "Outfit-Bold",
    marginBottom: 2,
  },
  entryPreview: {
    color: "#425566",
    fontSize: 14,
    lineHeight: 19,
  },
  emptyEntriesText: {
    color: "#70808D",
    fontSize: 14,
    lineHeight: 20,
  },
  loadMoreButton: {
    marginTop: 12,
    minHeight: 40,
    borderRadius: 999,
    backgroundColor: "#5C9F3A",
    alignItems: "center",
    justifyContent: "center",
  },
  loadMoreButtonDisabled: {
    opacity: 0.7,
  },
  loadMoreButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    lineHeight: 18,
    fontFamily: "Outfit-Bold",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(21, 27, 24, 0.34)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 22,
  },
  closeModalButton: {
    marginTop: 12,
    minHeight: 40,
    borderRadius: 999,
    backgroundColor: "#79C943",
    alignItems: "center",
    justifyContent: "center",
  },
  closeModalButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    lineHeight: 18,
    fontFamily: "Outfit-Bold",
  },
});
