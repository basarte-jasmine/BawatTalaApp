import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type MonthMeta = {
  daysInMonth: number;
  firstDay: number;
  monthIndex: number;
  name: string;
};

const YEAR = 2026;
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

// Sample written-entry days for 2026 (can be replaced with backend data later).
const WRITTEN_DAYS_BY_MONTH: Record<number, number[]> = {
  0: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 16, 17, 18, 20, 22, 23, 24, 25, 26, 27],
  1: [1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 13, 14, 15, 17, 18, 19, 20, 24, 25],
  2: [3, 8, 12],
  3: [4, 6, 10],
  4: [2, 7],
  5: [1, 9],
  6: [5, 12],
  7: [2, 13, 27],
  8: [4, 14],
  9: [1, 8, 15, 22],
  10: [3, 11],
  11: [1, 9, 16, 24],
};

const MONTHS: MonthMeta[] = MONTH_NAMES.map((name, monthIndex) => {
  const firstDay = new Date(YEAR, monthIndex, 1).getDay();
  const daysInMonth = new Date(YEAR, monthIndex + 1, 0).getDate();
  return { monthIndex, name, firstDay, daysInMonth };
});

export default function JournalCalendarScreen() {
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
        <Text style={styles.yearLabel}>{YEAR}</Text>

        {MONTHS.map((month) => {
          const writtenDays = new Set(WRITTEN_DAYS_BY_MONTH[month.monthIndex] ?? []);
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
            <View key={month.name} style={styles.monthSection}>
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

                  const isWritten = writtenDays.has(cell.dayNumber);
                  const isFocusedDay = month.monthIndex === 1 && cell.dayNumber === 25;

                  return (
                    <View key={cell.key} style={styles.dayCell}>
                      <View
                        style={[
                          styles.dayCircle,
                          isWritten && styles.dayCircleWritten,
                          isFocusedDay && styles.dayCircleFocused,
                        ]}
                      >
                        <Text
                          style={[
                            styles.dayNumber,
                            isWritten && styles.dayNumberWritten,
                            isFocusedDay && styles.dayNumberFocused,
                          ]}
                        >
                          {cell.dayNumber}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          );
        })}
      </ScrollView>
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
    borderBottomColor: "#D2D6D8",
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
    paddingTop: 8,
    paddingBottom: 24,
  },
  yearLabel: {
    textAlign: "right",
    color: "#3B4A5A",
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "700",
    marginBottom: 4,
    paddingRight: 2,
  },
  monthSection: {
    marginBottom: 18,
  },
  monthTitle: {
    textAlign: "center",
    color: "#3F4E5E",
    fontSize: 22 / 2 * 2,
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
    width: 31,
    height: 31,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  dayCircleWritten: {
    backgroundColor: "#B8E889",
  },
  dayCircleFocused: {
    backgroundColor: "#3E8F24",
  },
  dayNumber: {
    color: "#4A5968",
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "600",
  },
  dayNumberWritten: {
    color: "#4C6356",
    fontWeight: "700",
  },
  dayNumberFocused: {
    color: "#FFFFFF",
  },
});
