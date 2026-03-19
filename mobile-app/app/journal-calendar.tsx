import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { fetchJournalCalendar, fetchJournalEntriesByDate } from "../lib/backend-api";
import { useAuthSession } from "../lib/auth-session";
import { getManilaTodayParts } from "../lib/manila-date";

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
  const manilaToday = getManilaTodayParts();
  const [selectedYear, setSelectedYear] = useState(Math.max(MIN_YEAR, manilaToday.year));
  const [entryCountsByMonth, setEntryCountsByMonth] = useState<Record<number, Record<number, number>>>({});
  const [selectedDate, setSelectedDate] = useState(manilaToday.isoDate);
  const [selectedEntries, setSelectedEntries] = useState<CalendarEntryItem[]>([]);
  const [showEntriesModal, setShowEntriesModal] = useState(false);

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

  const loadEntriesForDate = useCallback(async (isoDate: string) => {
    if (!user?.studentNumber) {
      setSelectedEntries([]);
      return;
    }

    const result = await fetchJournalEntriesByDate(user.studentNumber, isoDate);
    if (!result.ok) {
      setSelectedEntries([]);
      return;
    }
    setSelectedEntries(result.entries ?? []);
  }, [user?.studentNumber]);

  useFocusEffect(
    useCallback(() => {
      void loadCalendar(selectedYear);
      void loadEntriesForDate(selectedDate);
    }, [loadCalendar, loadEntriesForDate, selectedDate, selectedYear]),
  );

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
    void loadEntriesForDate(nextSelectedDate);
  }, [loadCalendar, loadEntriesForDate, manilaToday.isoDate, manilaToday.year]);

  const handleSelectDate = useCallback((isoDate: string, isFuture: boolean) => {
    if (isFuture) {
      return;
    }
    setSelectedDate(isoDate);
    void loadEntriesForDate(isoDate).then(() => {
      setShowEntriesModal(true);
    });
  }, [loadEntriesForDate]);

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.topBar}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={28} color="#37414A" />
        </Pressable>
        <Text style={styles.topBarTitle}>Journal</Text>
        <View style={styles.topBarSpacer} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
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
              <Text style={styles.monthTitle}>{month.name}</Text>

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

            {selectedEntries.length === 0 ? (
              <Text style={styles.emptyEntriesText}>There are no entries for that day.</Text>
            ) : (
              <View style={styles.selectedEntriesList}>
                {selectedEntries.map((entry) => (
                  <Pressable
                    key={entry.id}
                    style={styles.entryCard}
                    onPress={() => {
                      setShowEntriesModal(false);
                      router.push(`/journal-entry-view?entryId=${entry.id}`);
                    }}
                  >
                    <Text style={styles.entryTime}>{formatEntryTime(entry.createdAt)}</Text>
                    <Text style={styles.entryPreview} numberOfLines={2}>
                      {entry.preview || entry.summary || entry.title || "Journal entry"}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}

            <Pressable style={styles.closeModalButton} onPress={() => setShowEntriesModal(false)}>
              <Text style={styles.closeModalButtonText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
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
    borderBottomWidth: 1,
    borderBottomColor: "#D2D6D8",
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
    paddingTop: 10,
    paddingBottom: 32,
  },
  yearControlRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    columnGap: 6,
    marginBottom: 4,
  },
  yearArrowButton: {
    width: 28,
    height: 28,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  yearArrowButtonDisabled: {
    opacity: 0.45,
  },
  yearLabel: {
    color: "#3B4A5A",
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "700",
    minWidth: 56,
    textAlign: "center",
  },
  monthSection: {
    marginBottom: 18,
  },
  monthTitle: {
    textAlign: "center",
    color: "#3F4E5E",
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "600",
    marginBottom: 8,
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
    fontWeight: "700",
  },
  daysGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  dayCell: {
    width: `${100 / 7}%`,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
  },
  dayCircle: {
    width: 39,
    height: 39,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  dayCircleEmpty: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#86C74F",
  },
  dayCircleHasEntry: {
    backgroundColor: "#BDE69B",
    borderWidth: 1.5,
    borderColor: "#BDE69B",
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
    fontWeight: "600",
  },
  dayNumberEmpty: {
    color: "#4A5968",
  },
  dayNumberHasEntry: {
    color: "#406152",
    fontWeight: "700",
  },
  dayNumberFuture: {
    color: "#7A8793",
  },
  dayNumberSelected: {
    color: "#2F4257",
    fontWeight: "700",
  },
  selectedEntriesCard: {
    width: "100%",
    maxWidth: 340,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    paddingVertical: 14,
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
    fontWeight: "700",
    marginBottom: 10,
  },
  selectedEntriesList: {
    rowGap: 8,
  },
  entryCard: {
    borderRadius: 10,
    backgroundColor: "#F0FFE9",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  entryTime: {
    color: "#32465C",
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "700",
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
    fontWeight: "700",
  },
});
