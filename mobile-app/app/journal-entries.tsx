import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";
import { HomeBottomNav } from "../components/home/HomeBottomNav";
import { ConfirmationModal } from "../components/ui/ConfirmationModal";
import { deleteJournalEntry, fetchRecentJournalEntries } from "../lib/backend-api";
import { useAuthSession } from "../lib/auth-session";
import { getManilaTodayParts } from "../lib/manila-date";

const BOOK_IMAGE = require("../assets/images/book_sample.png");

type RecentEntryItem = {
  createdAt: string;
  entryDate: string;
  id: string;
  preview: string;
  summary: string;
  title: string;
};

function formatDateBox(entryDate: string) {
  const [year, month, day] = entryDate.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return {
    dayNumber: String(day),
    monthLabel: date.toLocaleString("en-US", { month: "short" }).toUpperCase(),
  };
}

function shiftIsoDate(isoDate: string, deltaDays: number) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + deltaDays);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function buildDateGroups() {
  const today = getManilaTodayParts().isoDate;
  return Array.from({ length: 7 }, (_, index) => {
    const date = shiftIsoDate(today, -index);
    if (index === 0) {
      return { id: "today", date, label: "Today" };
    }
    if (index === 1) {
      return { id: "yesterday", date, label: "Yesterday" };
    }

    const [year, month, day] = date.split("-").map(Number);
    const displayDate = new Date(year, month - 1, day);
    return {
      id: `day-${index}`,
      date,
      label: displayDate.toLocaleString("en-US", {
        month: "long",
        day: "numeric",
      }),
    };
  });
}

function formatGroupSubLabel(entryDate: string) {
  const [year, month, day] = entryDate.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleString("en-US", { weekday: "long" }).toUpperCase();
}

function formatCreatedAtTime(createdAt: string) {
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

export default function JournalEntriesScreen() {
  const { user } = useAuthSession();
  const [entries, setEntries] = useState<RecentEntryItem[]>([]);
  const [progress, setProgress] = useState({
    monthlyCount: 0,
    todayCount: 0,
    totalCount: 0,
  });
  const [pendingDeleteEntryId, setPendingDeleteEntryId] = useState<string | null>(null);

  const loadEntries = useCallback(async () => {
    if (!user?.studentNumber) {
      setEntries([]);
      setProgress({ monthlyCount: 0, todayCount: 0, totalCount: 0 });
      return;
    }

    const result = await fetchRecentJournalEntries(user.studentNumber, 20);
    if (!result.ok) {
      setEntries([]);
      setProgress({ monthlyCount: 0, todayCount: 0, totalCount: 0 });
      return;
    }

    setEntries(result.entries ?? []);
    setProgress(
      result.progress ?? {
        monthlyCount: 0,
        todayCount: 0,
        totalCount: 0,
      },
    );
  }, [user?.studentNumber]);

  useFocusEffect(
    useCallback(() => {
      void loadEntries();
    }, [loadEntries]),
  );

  const progressItems = [
    { id: "today", value: String(progress.todayCount), label: "Today's Entries" },
    { id: "monthly", value: String(progress.monthlyCount), label: "Monthly Entries" },
    { id: "total", value: String(progress.totalCount), label: "Total Entries" },
  ];

  const dayGroups = useMemo(() => buildDateGroups(), []);

  const groupedEntries = useMemo(() => {
    const source = new Map<string, RecentEntryItem[]>();
    for (const entry of entries) {
      const current = source.get(entry.entryDate) || [];
      current.push(entry);
      source.set(entry.entryDate, current);
    }

    return dayGroups.map((group) => ({
      ...group,
      entries: source.get(group.date) ?? [],
    }));
  }, [dayGroups, entries]);

  const handleConfirmDelete = async () => {
    if (!user?.studentNumber || !pendingDeleteEntryId) return;
    const result = await deleteJournalEntry(user.studentNumber, pendingDeleteEntryId);
    setPendingDeleteEntryId(null);
    if (result.ok) {
      void loadEntries();
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.topBar}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={28} color="#39434F" />
        </Pressable>
        <Text style={styles.topBarTitle}>Recent Entries</Text>
        <View style={styles.topBarSpacer} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <View>
              <Text style={styles.progressEyebrow}>OVERVIEW</Text>
              <Text style={styles.progressTitle}>Your Progress</Text>
            </View>
            <Pressable
              style={styles.progressCalendarButton}
              onPress={() => router.push("/journal-calendar")}
              accessibilityLabel="Open yearly journal calendar"
            >
              <Ionicons name="calendar-outline" size={18} color="#3D4A57" />
            </Pressable>
          </View>

          <View style={styles.progressRow}>
            {progressItems.map((item) => (
              <View key={item.id} style={styles.progressItem}>
                <Text style={styles.progressValue}>{item.value}</Text>
                <Text style={styles.progressLabel}>{item.label}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.recentHeader}>
          <Text style={styles.recentTitle}>Recent Entries</Text>
        </View>

        {groupedEntries.map((group) => {
          const dateBox = formatDateBox(group.date);

          return (
            <View key={group.id} style={styles.entryGroup}>
              <View style={styles.groupHeadRow}>
                <View style={styles.groupDateBox}>
                  <Text style={styles.groupDayNumber}>{dateBox.dayNumber}</Text>
                  <Text style={styles.groupMonth}>{dateBox.monthLabel}</Text>
                </View>

                <View style={styles.groupTextWrap}>
                  <Text style={styles.groupDayLabel}>{group.label}</Text>
                  <Text style={styles.groupSubLabel}>{formatGroupSubLabel(group.date)}</Text>
                </View>
              </View>

              {group.entries.length === 0 ? (
                <View style={styles.emptyDayCard}>
                  <Text style={styles.emptyDayText}>There are no entries for that day.</Text>
                </View>
              ) : (
                <View style={styles.groupEntriesList}>
                  {group.entries.map((entry) => (
                    <Swipeable
                      key={entry.id}
                      overshootRight={false}
                      renderRightActions={() => (
                        <Pressable style={styles.deleteSwipeAction} onPress={() => setPendingDeleteEntryId(entry.id)}>
                          <Ionicons name="trash-outline" size={18} color="#FFFFFF" />
                          <Text style={styles.deleteSwipeText}>Delete</Text>
                        </Pressable>
                      )}
                    >
                      <Pressable
                        style={styles.entryCard}
                        onPress={() => router.push(`/journal-entry-view?entryId=${entry.id}`)}
                      >
                        <View style={styles.entryIconWrap}>
                          <Image source={BOOK_IMAGE} style={styles.entryIconImage} resizeMode="contain" />
                        </View>

                        <View style={styles.entryTextWrap}>
                          <Text style={styles.entryTime}>{formatCreatedAtTime(entry.createdAt)}</Text>
                          <Text style={styles.entryBody} numberOfLines={2}>
                            {entry.preview || entry.summary || entry.title || "Journal entry"}
                          </Text>
                        </View>

                        <View style={styles.entryChevronWrap}>
                          <Ionicons name="chevron-forward" size={18} color="#6E7D89" />
                        </View>
                      </Pressable>
                    </Swipeable>
                  ))}
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>

      <ConfirmationModal
        visible={Boolean(pendingDeleteEntryId)}
        message="Delete this journal entry?"
        cancelLabel="Cancel"
        confirmLabel="Delete"
        confirmTone="danger"
        onCancel={() => setPendingDeleteEntryId(null)}
        onConfirm={() => {
          void handleConfirmDelete();
        }}
      />

      <HomeBottomNav activeTab="journal" />
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
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 110,
  },
  progressCard: {
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2ECD9",
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 12,
    shadowColor: "#5C6570",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
    marginBottom: 14,
  },
  progressHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  progressCalendarButton: {
    width: 34,
    height: 34,
    borderRadius: 14,
    backgroundColor: "#F2F7EE",
    alignItems: "center",
    justifyContent: "center",
  },
  progressEyebrow: {
    color: "#7D8F78",
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 1,
    fontWeight: "700",
    marginBottom: 2,
  },
  progressTitle: {
    color: "#31465A",
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "600",
  },
  progressRow: {
    flexDirection: "row",
    columnGap: 8,
  },
  progressItem: {
    flex: 1,
    minHeight: 72,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#DBE8D0",
    backgroundColor: "#F3FBEA",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
  },
  progressValue: {
    color: "#32465C",
    fontSize: 26,
    lineHeight: 32,
    fontWeight: "700",
  },
  progressLabel: {
    color: "#5B6E62",
    fontSize: 12,
    lineHeight: 16,
    textAlign: "center",
  },
  recentHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  recentTitle: {
    color: "#324254",
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "700",
  },
  entryGroup: {
    marginBottom: 20,
  },
  groupHeadRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    columnGap: 10,
  },
  groupDateBox: {
    width: 56,
    height: 60,
    borderRadius: 16,
    backgroundColor: "#EEF8E5",
    borderWidth: 1,
    borderColor: "#D9EBCB",
    alignItems: "center",
    justifyContent: "center",
  },
  groupDayNumber: {
    color: "#2F4256",
    fontSize: 17,
    lineHeight: 21,
    fontWeight: "700",
  },
  groupMonth: {
    color: "#3D5669",
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "600",
    marginTop: -1,
  },
  groupTextWrap: {
    flex: 1,
    paddingTop: 1,
  },
  groupDayLabel: {
    color: "#344A61",
    fontSize: 18,
    lineHeight: 23,
    fontWeight: "700",
  },
  groupSubLabel: {
    color: "#75808A",
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "600",
    letterSpacing: 0.2,
    marginTop: 1,
  },
  emptyDayCard: {
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E3ECD9",
    paddingHorizontal: 14,
    paddingVertical: 14,
    shadowColor: "#5C6570",
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  emptyDayText: {
    color: "#677784",
    fontSize: 14,
    lineHeight: 19,
  },
  groupEntriesList: {
    rowGap: 8,
  },
  entryCard: {
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2ECD9",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    columnGap: 10,
    shadowColor: "#5C6570",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  deleteSwipeAction: {
    width: 92,
    borderRadius: 18,
    backgroundColor: "#D85B5B",
    alignItems: "center",
    justifyContent: "center",
    rowGap: 4,
    marginLeft: 8,
  },
  deleteSwipeText: {
    color: "#FFFFFF",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
  },
  entryIconWrap: {
    width: 54,
    height: 54,
    borderRadius: 999,
    backgroundColor: "#F4FAEE",
    borderWidth: 1,
    borderColor: "#E0EBD8",
    alignItems: "center",
    justifyContent: "center",
  },
  entryIconImage: {
    width: 40,
    height: 40,
  },
  entryTextWrap: {
    flex: 1,
  },
  entryTime: {
    color: "#2E4155",
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "700",
    marginBottom: 2,
  },
  entryBody: {
    color: "#526372",
    fontSize: 13,
    lineHeight: 19,
  },
  entryChevronWrap: {
    width: 28,
    height: 28,
    borderRadius: 999,
    backgroundColor: "#F5F8F2",
    alignItems: "center",
    justifyContent: "center",
  },
});
