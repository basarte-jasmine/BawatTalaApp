import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { HomeBottomNav } from "../components/home/HomeBottomNav";

type ProgressItem = {
  id: string;
  label: string;
  value: string;
};

type EntryItem = {
  id: string;
  text: string;
  time: string;
};

type EntryGroup = {
  id: string;
  dayLabel: string;
  dayOfMonth: string;
  monthLabel: string;
  subLabel: string;
  entries: EntryItem[];
};

const BOOK_IMAGE = require("../assets/images/book_sample.png");

const PROGRESS_ITEMS: ProgressItem[] = [
  { id: "today", value: "5", label: "Today's Entries" },
  { id: "monthly", value: "23", label: "Monthly Entries" },
  { id: "total", value: "25", label: "Total Entries" },
];

const ENTRY_GROUPS: EntryGroup[] = [
  {
    id: "group-25",
    dayLabel: "Today",
    dayOfMonth: "25",
    monthLabel: "FEB",
    subLabel: "WEDNESDAY",
    entries: [
      { id: "g25-1", time: "5:00 PM", text: "Today I finally noticed the small buds blooming on the plants in our balcony." },
      { id: "g25-2", time: "12:00 PM", text: "Today I finally noticed the small buds blooming on the plants in our balcony." },
      { id: "g25-3", time: "3:00 AM", text: "Today I finally noticed the small buds blooming on the plants in our balcony." },
    ],
  },
  {
    id: "group-23",
    dayLabel: "Monday",
    dayOfMonth: "23",
    monthLabel: "FEB",
    subLabel: "2 DAYS AGO",
    entries: [
      { id: "g23-1", time: "5:00 PM", text: "Today I finally noticed the small buds blooming on the plants in our balcony." },
      { id: "g23-2", time: "12:00 PM", text: "Today I finally noticed the small buds blooming on the plants in our balcony." },
      { id: "g23-3", time: "3:00 AM", text: "Today I finally noticed the small buds blooming on the plants in our balcony." },
    ],
  },
];

export default function JournalEntriesScreen() {
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
            <Text style={styles.progressTitle}>Your Progress</Text>
            <Pressable
              style={styles.progressCalendarButton}
              onPress={() => router.push("/journal-calendar")}
              accessibilityLabel="Open yearly journal calendar"
            >
              <Ionicons name="calendar-outline" size={18} color="#3D4A57" />
            </Pressable>
          </View>

          <View style={styles.progressRow}>
            {PROGRESS_ITEMS.map((item) => (
              <View key={item.id} style={styles.progressItem}>
                <Text style={styles.progressValue}>{item.value}</Text>
                <Text style={styles.progressLabel}>{item.label}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.recentHeader}>
          <Text style={styles.recentTitle}>Recent Entries</Text>
          <Ionicons name="list" size={18} color="#3E4A56" />
        </View>

        {ENTRY_GROUPS.map((group) => (
          <View key={group.id} style={styles.entryGroup}>
            <View style={styles.groupHeadRow}>
              <View style={styles.groupDateBox}>
                <Text style={styles.groupDayNumber}>{group.dayOfMonth}</Text>
                <Text style={styles.groupMonth}>{group.monthLabel}</Text>
              </View>

              <View style={styles.groupTextWrap}>
                <Text style={styles.groupDayLabel}>{group.dayLabel}</Text>
                <Text style={styles.groupSubLabel}>{group.subLabel}</Text>
              </View>
            </View>

            <View style={styles.groupEntriesList}>
              {group.entries.map((entry) => (
                <View key={entry.id} style={styles.entryCard}>
                  <View style={styles.entryIconWrap}>
                    <Image source={BOOK_IMAGE} style={styles.entryIconImage} resizeMode="contain" />
                  </View>

                  <View style={styles.entryTextWrap}>
                    <Text style={styles.entryTime}>{entry.time}</Text>
                    <Text style={styles.entryBody} numberOfLines={2}>
                      {entry.text}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>

      <HomeBottomNav activeTab="journal" />
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
    borderBottomColor: "#D0D4D6",
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    shadowColor: "#6E6E6E",
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
    fontSize: 34 / 2,
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
    paddingBottom: 110,
  },
  progressCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#C5CBD0",
    backgroundColor: "#F4F5F4",
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 8,
    shadowColor: "#777777",
    shadowOpacity: 0.14,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
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
    width: 26,
    height: 26,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  progressTitle: {
    color: "#31465A",
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "600",
  },
  progressRow: {
    flexDirection: "row",
    columnGap: 6,
  },
  progressItem: {
    flex: 1,
    minHeight: 58,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#A9D08F",
    backgroundColor: "#BDE7A6",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
  },
  progressValue: {
    color: "#32465C",
    fontSize: 48 / 2,
    lineHeight: 30,
    fontWeight: "700",
  },
  progressLabel: {
    color: "#465B6E",
    fontSize: 14 / 1.05,
    lineHeight: 16,
    textAlign: "center",
  },
  recentHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  recentTitle: {
    color: "#324254",
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "700",
  },
  entryGroup: {
    marginBottom: 14,
  },
  groupHeadRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    columnGap: 8,
  },
  groupDateBox: {
    width: 48,
    height: 54,
    borderRadius: 4,
    backgroundColor: "#DFECD9",
    alignItems: "center",
    justifyContent: "center",
  },
  groupDayNumber: {
    color: "#2F4256",
    fontSize: 34 / 2,
    lineHeight: 21,
    fontWeight: "700",
  },
  groupMonth: {
    color: "#3D5669",
    fontSize: 28 / 2,
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
    fontSize: 19 / 1.02,
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
  groupEntriesList: {
    rowGap: 4,
  },
  entryCard: {
    borderRadius: 4,
    backgroundColor: "#DFECD9",
    flexDirection: "row",
    paddingHorizontal: 8,
    paddingVertical: 6,
    columnGap: 8,
  },
  entryIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 999,
    backgroundColor: "#EDEFEA",
    alignItems: "center",
    justifyContent: "center",
  },
  entryIconImage: {
    width: 38,
    height: 38,
  },
  entryTextWrap: {
    flex: 1,
    paddingTop: 2,
  },
  entryTime: {
    color: "#2E4155",
    fontSize: 17 / 1.05,
    lineHeight: 20,
    fontWeight: "700",
    marginBottom: 0,
  },
  entryBody: {
    color: "#304459",
    fontSize: 13,
    lineHeight: 16,
  },
});
