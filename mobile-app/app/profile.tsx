import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type SettingRow = {
  id: string;
  label: string;
  showChevron?: boolean;
};

const ACCOUNT_ROWS: SettingRow[] = [
  { id: "personal-details", label: "Personal Details", showChevron: true },
  { id: "privacy-security", label: "Privacy & Security", showChevron: true },
];

const APP_ROWS: SettingRow[] = [
  { id: "recent-activity", label: "Recent Activity", showChevron: true },
  { id: "help-support", label: "Help and Support", showChevron: true },
  { id: "feedback", label: "Feedback", showChevron: true },
];

const EXTRA_ROWS: SettingRow[] = [
  { id: "refer-friend", label: "Refer a friend" },
  { id: "app-lock", label: "App Lock" },
];

export default function ProfileScreen() {
  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/home");
  };

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.topBar}>
        <Pressable style={styles.backButton} accessibilityLabel="Go back" onPress={handleBack}>
          <Ionicons name="chevron-back" size={30} color="#3D3F43" />
        </Pressable>

        <Text style={styles.topTitle}>Profile</Text>
        <View style={styles.topBarSpacer} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.profileWrap}>
          <View style={styles.avatarCircle}>
            <Ionicons name="person-outline" size={74} color="#4A4A4A" />
          </View>
          <Text style={styles.name}>Jasmine Mae</Text>
          <Text style={styles.email}>jasminemae123@gmail.com</Text>
        </View>

        <View style={styles.groupCard}>
          <Text style={styles.groupTitle}>Account Settings</Text>
          {ACCOUNT_ROWS.map((row, index) => (
            <View key={row.id}>
              <SettingRowItem row={row} />
              {index < ACCOUNT_ROWS.length - 1 ? <View style={styles.rowDivider} /> : null}
            </View>
          ))}
        </View>

        <View style={styles.groupCard}>
          <Text style={styles.groupTitle}>App Settings</Text>
          {APP_ROWS.map((row, index) => (
            <View key={row.id}>
              <SettingRowItem row={row} />
              {index < APP_ROWS.length - 1 ? <View style={styles.rowDivider} /> : null}
            </View>
          ))}
        </View>

        <View style={styles.groupCard}>
          {EXTRA_ROWS.map((row, index) => (
            <View key={row.id}>
              <SettingRowItem row={row} />
              {index < EXTRA_ROWS.length - 1 ? <View style={styles.rowDivider} /> : null}
            </View>
          ))}
        </View>

        <Pressable style={styles.signOutButton}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function SettingRowItem({ row }: { row: SettingRow }) {
  return (
    <Pressable style={styles.rowItem}>
      <Text style={styles.rowLabel}>{row.label}</Text>
      {row.showChevron ? <Ionicons name="chevron-forward" size={20} color="#6B6E75" /> : null}
    </Pressable>
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
    borderBottomColor: "#D2D2D2",
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 6,
    shadowColor: "#777777",
    shadowOpacity: 0.12,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  backButton: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  topTitle: {
    color: "#314258",
    fontSize: 34 / 2,
    lineHeight: 23,
    fontWeight: "700",
  },
  topBarSpacer: {
    width: 38,
    height: 38,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 20,
    paddingHorizontal: 8,
    paddingBottom: 28,
  },
  profileWrap: {
    alignItems: "center",
    marginBottom: 18,
  },
  avatarCircle: {
    width: 120,
    height: 120,
    borderRadius: 999,
    backgroundColor: "#89E1D4",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  name: {
    color: "#3A4D3A",
    fontSize: 44 / 2,
    lineHeight: 29,
    fontWeight: "700",
    marginBottom: 2,
  },
  email: {
    color: "#4F4F4F",
    fontSize: 26 / 2,
    lineHeight: 18,
    textDecorationLine: "underline",
  },
  groupCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E0EE",
    backgroundColor: "#EFEDF8",
    overflow: "hidden",
    marginBottom: 8,
  },
  groupTitle: {
    color: "#324254",
    fontSize: 33 / 2,
    lineHeight: 22,
    fontWeight: "600",
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 8,
  },
  rowItem: {
    minHeight: 42,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#EFEDF8",
  },
  rowLabel: {
    color: "#36475B",
    fontSize: 33 / 2,
    lineHeight: 22,
  },
  rowDivider: {
    height: 1,
    backgroundColor: "#F7F6FB",
  },
  signOutButton: {
    height: 46,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E2DFD8",
    backgroundColor: "#F2EEE5",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 30,
    marginHorizontal: 14,
    shadowColor: "#777777",
    shadowOpacity: 0.16,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  signOutText: {
    color: "#EE596B",
    fontSize: 40 / 2,
    lineHeight: 26,
    fontWeight: "700",
  },
});
