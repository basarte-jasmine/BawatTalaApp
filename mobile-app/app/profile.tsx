import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuthSession } from "../lib/auth-session";

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
  const { clearUser, user } = useAuthSession();
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
    clearUser();
    router.replace("/login");
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
          <Text style={styles.name}>{user?.fullName || "User"}</Text>
          <Text style={styles.email}>{user?.email || "No email available"}</Text>
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

function SettingRowItem({ row }: { row: SettingRow }) {
  return (
    <Pressable style={styles.rowItem}>
      <Text style={styles.rowLabel}>{row.label}</Text>
      {row.showChevron ? <Ionicons name="chevron-forward" size={18} color="#7E8490" /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  topBar: {
    height: 52,
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
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
    marginBottom: 6,
    shadowColor: "#777777",
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  groupTitle: {
    color: "#2E3F54",
    fontSize: 33 / 2,
    lineHeight: 22,
    fontWeight: "500",
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 6,
  },
  rowItem: {
    minHeight: 44,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
  },
  rowLabel: {
    color: "#34475D",
    fontSize: 17,
    lineHeight: 22,
  },
  rowDivider: {
    height: 1,
    backgroundColor: "#F1F3F5",
  },
  signOutButton: {
    height: 46,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
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
