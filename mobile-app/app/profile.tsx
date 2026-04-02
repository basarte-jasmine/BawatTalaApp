import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState, type ComponentProps } from "react";
import { Alert, Modal, Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAppPreferences } from "../lib/app-preferences";
import { useAuthSession } from "../lib/auth-session";

type SettingRow = {
  id: string;
  icon: ComponentProps<typeof Ionicons>["name"];
  label: string;
  showChevron?: boolean;
};

const ACCOUNT_ROWS: SettingRow[] = [
  { id: "personal-details", icon: "person-circle-outline", label: "Personal Details", showChevron: true },
  { id: "privacy-security", icon: "shield-checkmark-outline", label: "Privacy & Security", showChevron: true },
];

const APP_ROWS: SettingRow[] = [
  { id: "recent-activity", icon: "time-outline", label: "Recent Activity", showChevron: true },
  { id: "help-support", icon: "help-buoy-outline", label: "Help and Support", showChevron: true },
  { id: "feedback", icon: "chatbubble-ellipses-outline", label: "Feedback", showChevron: true },
];

const EXTRA_ROWS: SettingRow[] = [
  { id: "refer-friend", icon: "share-social-outline", label: "Refer a friend" },
  { id: "app-lock", icon: "lock-closed-outline", label: "App Lock" },
];

export default function ProfileScreen() {
  const { clearUser, user } = useAuthSession();
  const { clearPreferences } = useAppPreferences();
  const [showSignOutModal, setShowSignOutModal] = useState(false);
  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/home");
  };

  const handleConfirmSignOut = () => {
    setShowSignOutModal(false);
    clearPreferences();
    clearUser();
    router.replace("/login");
  };

  const handleRowPress = async (rowId: string) => {
    switch (rowId) {
      case "schedule":
      case "personal-details":
      case "privacy-security":
      case "recent-activity":
      case "help-support":
      case "feedback":
      case "app-lock":
        router.push(`/profile-settings?section=${rowId}`);
        return;
      case "refer-friend":
        await Share.share({
          message:
            "I’ve been using Bawat Tala to journal, check in with my mood, and reach support when I need it. You can check it out at https://bawattalapro.online/",
          title: "Share Bawat Tala",
        });
        return;
      default:
        Alert.alert("Not Ready Yet", "This setting is not available right now.");
    }
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
        <View style={styles.profileHero}>
          <View style={styles.heroGlowLeft} />
          <View style={styles.heroGlowRight} />
          <View style={styles.profileWrap}>
            <View style={styles.avatarCircle}>
              <Ionicons name="person-outline" size={74} color="#4A4A4A" />
            </View>
            <Text style={styles.name}>{user?.fullName || "User"}</Text>
            <Text style={styles.email}>{user?.email || "Your Bawat Tala space is ready."}</Text>
            <View style={styles.identityRow}>
              <View style={styles.identityChip}>
                <Ionicons name="card-outline" size={14} color="#5E7D58" />
                <Text style={styles.identityChipText}>{user?.studentNumber || "Student profile"}</Text>
              </View>
            </View>
          </View>
        </View>

        <Pressable style={styles.scheduleShortcut} onPress={() => void handleRowPress("schedule")}>
          <View style={styles.scheduleShortcutIconWrap}>
            <Ionicons name="calendar-clear-outline" size={20} color="#5A8A36" />
          </View>
          <View style={styles.scheduleShortcutContent}>
            <Text style={styles.scheduleShortcutText}>View My Schedule</Text>
            <Text style={styles.scheduleShortcutMeta}>See your consultations and upcoming booked dates.</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#7E8490" />
        </Pressable>

        <View style={styles.groupCard}>
          <Text style={styles.groupTitle}>Account Settings</Text>
          {ACCOUNT_ROWS.map((row, index) => (
            <View key={row.id}>
              <SettingRowItem row={row} onPress={handleRowPress} />
              {index < ACCOUNT_ROWS.length - 1 ? <View style={styles.rowDivider} /> : null}
            </View>
          ))}
        </View>

        <View style={styles.groupCard}>
          <Text style={styles.groupTitle}>App Settings</Text>
          {APP_ROWS.map((row, index) => (
            <View key={row.id}>
              <SettingRowItem row={row} onPress={handleRowPress} />
              {index < APP_ROWS.length - 1 ? <View style={styles.rowDivider} /> : null}
            </View>
          ))}
        </View>

        <View style={styles.groupCard}>
          {EXTRA_ROWS.map((row, index) => (
            <View key={row.id}>
              <SettingRowItem row={row} onPress={handleRowPress} />
              {index < EXTRA_ROWS.length - 1 ? <View style={styles.rowDivider} /> : null}
            </View>
          ))}
        </View>

        <Pressable style={styles.signOutButton} onPress={() => setShowSignOutModal(true)}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </Pressable>
      </ScrollView>

      <Modal
        visible={showSignOutModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSignOutModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalBody}>
              Sign out of your account?
            </Text>

            <View style={styles.modalActions}>
              <Pressable style={styles.modalSecondaryButton} onPress={() => setShowSignOutModal(false)}>
                <Text style={styles.modalSecondaryText}>Cancel</Text>
              </Pressable>

              <Pressable style={styles.modalPrimaryButton} onPress={handleConfirmSignOut}>
                <Text style={styles.modalPrimaryText}>Sign Out</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function SettingRowItem({ onPress, row }: { onPress: (rowId: string) => void | Promise<void>; row: SettingRow }) {
  return (
    <Pressable style={styles.rowItem} onPress={() => void onPress(row.id)}>
      <View style={styles.rowLeading}>
        <View style={styles.rowIconWrap}>
          <Ionicons name={row.icon} size={18} color="#5A8A36" />
        </View>
        <Text style={styles.rowLabel}>{row.label}</Text>
      </View>
      {row.showChevron ? <Ionicons name="chevron-forward" size={18} color="#7E8490" /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F7FAFC",
  },
  topBar: {
    height: 52,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 6,
    shadowColor: "#777777",
    shadowOpacity: 0.1,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
    borderBottomWidth: 1,
    borderBottomColor: "#EEF2F5",
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
    paddingTop: 16,
    paddingHorizontal: 12,
    paddingBottom: 32,
  },
  profileHero: {
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E7EEF4",
    overflow: "hidden",
    marginBottom: 14,
    shadowColor: "#6A7682",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  heroGlowLeft: {
    position: "absolute",
    top: -36,
    left: -20,
    width: 120,
    height: 120,
    borderRadius: 999,
    backgroundColor: "#DDF8C7",
    opacity: 0.75,
  },
  heroGlowRight: {
    position: "absolute",
    right: -30,
    bottom: -36,
    width: 140,
    height: 140,
    borderRadius: 999,
    backgroundColor: "#E8F5FF",
    opacity: 0.85,
  },
  profileWrap: {
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 20,
  },
  avatarCircle: {
    width: 120,
    height: 120,
    borderRadius: 999,
    backgroundColor: "#89E1D4",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
    borderWidth: 4,
    borderColor: "#F2FFFA",
  },
  name: {
    color: "#304558",
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "700",
    marginBottom: 4,
  },
  email: {
    color: "#5E7080",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    marginBottom: 12,
  },
  identityRow: {
    flexDirection: "row",
    justifyContent: "center",
  },
  identityChip: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#F4F9EF",
    borderWidth: 1,
    borderColor: "#DAEAC8",
  },
  identityChipText: {
    color: "#58704C",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
  },
  groupCard: {
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E7EEF4",
    shadowColor: "#6B7681",
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  scheduleShortcut: {
    minHeight: 74,
    borderRadius: 20,
    backgroundColor: "#F5F1FF",
    borderWidth: 1,
    borderColor: "#E8E0FF",
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    columnGap: 12,
    marginBottom: 12,
    shadowColor: "#777777",
    shadowOpacity: 0.08,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  scheduleShortcutIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E0EAD2",
  },
  scheduleShortcutContent: {
    flex: 1,
  },
  scheduleShortcutText: {
    color: "#33475C",
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "700",
    marginBottom: 2,
  },
  scheduleShortcutMeta: {
    color: "#6B7685",
    fontSize: 13,
    lineHeight: 18,
  },
  groupTitle: {
    color: "#2E3F54",
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "700",
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
  },
  rowItem: {
    minHeight: 54,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
  },
  rowLeading: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 12,
    flex: 1,
    paddingRight: 12,
  },
  rowIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: "#F4FAED",
    borderWidth: 1,
    borderColor: "#DBEAC8",
    alignItems: "center",
    justifyContent: "center",
  },
  rowLabel: {
    color: "#34475D",
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "500",
  },
  rowDivider: {
    height: 1,
    backgroundColor: "#EEF3F6",
    marginLeft: 60,
  },
  signOutButton: {
    height: 50,
    borderRadius: 999,
    backgroundColor: "#FFF7F8",
    borderWidth: 1,
    borderColor: "#F4D8DC",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 18,
    marginHorizontal: 10,
    shadowColor: "#B49AA1",
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  signOutText: {
    color: "#EE596B",
    fontSize: 40 / 2,
    lineHeight: 26,
    fontWeight: "700",
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
    maxWidth: 320,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 16,
    shadowColor: "#5F695D",
    shadowOpacity: 0.16,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  modalBody: {
    color: "#52606C",
    fontSize: 17,
    lineHeight: 24,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: "row",
    columnGap: 10,
  },
  modalSecondaryButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#B5BCC4",
    shadowOpacity: 0.12,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  modalSecondaryText: {
    color: "#566271",
    fontSize: 13,
    fontWeight: "700",
  },
  modalPrimaryButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: 999,
    backgroundColor: "#79C943",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#4B8F22",
    shadowOpacity: 0.18,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  modalPrimaryText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
});
