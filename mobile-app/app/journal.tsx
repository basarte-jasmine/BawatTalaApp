import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { HomeBottomNav } from "../components/home/HomeBottomNav";

type CalendarDay = {
  active?: boolean;
  date: number;
  id: string;
  label: string;
};

const PET_IMAGE = require("../assets/images/pet_sample.png");
const BOOK_IMAGE = require("../assets/images/book_sample.png");

const CALENDAR_DAYS: CalendarDay[] = [
  { id: "su", label: "Su", date: 1 },
  { id: "mo", label: "Mo", date: 2 },
  { id: "tu", label: "Tu", date: 3, active: true },
  { id: "we", label: "We", date: 4 },
  { id: "th", label: "Th", date: 5 },
  { id: "fr", label: "Fr", date: 6 },
  { id: "sa", label: "Sa", date: 7 },
];

export default function JournalScreen() {
  const { height } = useWindowDimensions();
  const compact = height < 760;
  const veryCompact = height < 700;
  const openCalendarCheckIn = () => {
    router.push("/calendar-checkin");
  };

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={[styles.content, compact && styles.contentCompact, veryCompact && styles.contentVeryCompact]}>
        <View style={[styles.topSection, compact && styles.topSectionCompact]}>
          <Pressable
            style={[styles.calendarCard, compact && styles.calendarCardCompact]}
            onPress={openCalendarCheckIn}
          >
            <View style={[styles.calendarHeader, compact && styles.calendarHeaderCompact]}>
              <Text style={[styles.calendarTitle, compact && styles.calendarTitleCompact]}>February 3, 2026</Text>
              <Ionicons name="chevron-forward" size={22} color="#3A4A5B" />
            </View>

            <View style={styles.calendarRow}>
              {CALENDAR_DAYS.map((day) => (
                <View key={day.id} style={[styles.dayItem, compact && styles.dayItemCompact]}>
                  {(() => {
                    const done = day.date <= 2;
                    const active = day.date === 3;
                    const outlined = !done && !active;
                    return (
                      <>
                        <Text style={[styles.dayLabel, compact && styles.dayLabelCompact]}>{day.label}</Text>
                        <View
                          style={[
                            styles.dayCircle,
                            compact && styles.dayCircleCompact,
                            done && styles.dayCircleDone,
                            active && styles.dayCircleActive,
                            outlined && styles.dayCircleOutline,
                          ]}
                        >
                          <Text
                            style={[
                              styles.dayNumber,
                              compact && styles.dayNumberCompact,
                              done && styles.dayNumberDone,
                              active && styles.dayNumberActive,
                              outlined && styles.dayNumberOutline,
                            ]}
                          >
                            {day.date}
                          </Text>
                        </View>
                      </>
                    );
                  })()}
                </View>
              ))}
            </View>
          </Pressable>

          <View style={[styles.reflectionCard, compact && styles.reflectionCardCompact]}>
            <Text style={[styles.reflectionText, compact && styles.reflectionTextCompact]} numberOfLines={veryCompact ? 4 : 5}>
              Yesterday, you kept replaying a conversation and worrying about how you were perceived. But in the end, you
              realized there was no clear evidence of conflict and chose to let the thought pass rather than feed it.
            </Text>

            <View style={[styles.reflectionFooterRow, compact && styles.reflectionFooterRowCompact]}>
              <View style={[styles.companionWrap, compact && styles.companionWrapCompact]}>
                <Image source={PET_IMAGE} style={[styles.companionImage, compact && styles.companionImageCompact]} resizeMode="contain" />
              </View>

              <Text style={[styles.reflectionFootnote, compact && styles.reflectionFootnoteCompact]} numberOfLines={3}>
                Summary by Lumi, your virtual companion. Bawat Tala is not a substitute for professional mental health
                care.
              </Text>
            </View>
          </View>
        </View>

        <View style={[styles.bottomSection, compact && styles.bottomSectionCompact]}>
          <View style={[styles.journalArtWrap, compact && styles.journalArtWrapCompact]}>
            <Image source={BOOK_IMAGE} style={[styles.bookImage, compact && styles.bookImageCompact, veryCompact && styles.bookImageVeryCompact]} resizeMode="contain" />
          </View>

          <Pressable
            style={[styles.addEntryButton, compact && styles.addEntryButtonCompact]}
            onPress={() => router.push("/write-entry")}
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
      </View>

      <HomeBottomNav activeTab="journal" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#ECECEC",
  },
  content: {
    flex: 1,
    paddingHorizontal: 8,
    paddingTop: 10,
    paddingBottom: 112,
  },
  contentCompact: {
    paddingTop: 8,
    paddingBottom: 102,
  },
  contentVeryCompact: {
    paddingTop: 6,
    paddingBottom: 94,
  },
  topSection: {
    flexShrink: 0,
  },
  topSectionCompact: {
    marginBottom: 2,
  },
  calendarCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#C6CBD0",
    backgroundColor: "#F4F5F4",
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: "#777777",
    shadowOpacity: 0.15,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
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
  dayCircleDone: {
    backgroundColor: "#AFE77D",
  },
  dayCircleActive: {
    backgroundColor: "#3E8F24",
  },
  dayCircleOutline: {
    backgroundColor: "#F6F7F6",
    borderWidth: 1,
    borderColor: "#3E4D5E",
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
  reflectionCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#C8CDD1",
    backgroundColor: "#F4F5F4",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    shadowColor: "#777777",
    shadowOpacity: 0.15,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    marginBottom: 10,
    minHeight: 160,
  },
  reflectionCardCompact: {
    minHeight: 142,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
    marginBottom: 8,
  },
  reflectionFooterRow: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 10,
  },
  reflectionFooterRowCompact: {
    columnGap: 8,
  },
  reflectionText: {
    color: "#33485B",
    fontSize: 15,
    lineHeight: 21,
    marginBottom: 10,
  },
  reflectionTextCompact: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 8,
  },
  reflectionFootnote: {
    flex: 1,
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
    marginTop: 4,
  },
  bottomSectionCompact: {
    marginTop: 2,
  },
  journalArtWrap: {
    alignItems: "center",
    marginTop: 0,
    marginBottom: 16,
  },
  journalArtWrapCompact: {
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
    backgroundColor: "#B8EC93",
    borderWidth: 1,
    borderColor: "#9CCE78",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 18,
    marginBottom: 10,
    shadowColor: "#707070",
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
    color: "#33465B",
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
    backgroundColor: "#E8E8E8",
    borderWidth: 1,
    borderColor: "#AAB0B6",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 18,
  },
  viewEntriesButtonCompact: {
    height: 40,
  },
  viewEntriesText: {
    color: "#33465B",
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "700",
  },
  viewEntriesTextCompact: {
    fontSize: 15,
    lineHeight: 19,
  },
});
