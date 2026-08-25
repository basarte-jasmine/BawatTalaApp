import { Ionicons } from "@expo/vector-icons";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useEffect, useState, type ComponentProps } from "react";
import { ActivityIndicator, Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StudentProfileAvatar } from "../components/profile/StudentProfileAvatar";
import { useAppPreferences } from "../lib/app-preferences";
import { useAuthSession } from "../lib/auth-session";
import { fetchStudentProfile, updateStudentProfilePicture } from "../lib/backend-api";

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
  { id: "refer-friend", icon: "share-social-outline", label: "Refer a friend", showChevron: true },
  { id: "app-lock", icon: "lock-closed-outline", label: "Journal Lock" },
];
const APP_VERSION = "1.0.0";
const PROFILE_PICTURE_LIMIT_BYTES = 5 * 1024 * 1024;
const PROFILE_PICTURE_MAX_DIMENSION = 1024;

function getImageMimeType(asset: ImagePicker.ImagePickerAsset) {
  const mimeType = String(asset.mimeType || "").toLowerCase();
  if (mimeType === "image/jpg") return "image/jpeg";
  if (mimeType) return mimeType;

  const fileName = String(asset.fileName || asset.uri || "").toLowerCase();
  if (/\.png(?:$|\?)/.test(fileName)) return "image/png";
  if (/\.jpe?g(?:$|\?)/.test(fileName)) return "image/jpeg";
  return "";
}

function showAppAlert(title: string, message: string) {
  if (Platform.OS === "web") {
    const browserAlert = (globalThis as { alert?: (value: string) => void }).alert;
    if (typeof browserAlert === "function") {
      browserAlert(`${title}\n\n${message}`);
      return;
    }
  }

  Alert.alert(title, message);
}

export default function ProfileScreen() {
  const { clearUser, setUser, user } = useAuthSession();
  const { clearPreferences } = useAppPreferences();
  const [showSignOutModal, setShowSignOutModal] = useState(false);
  const [showProfilePictureOptions, setShowProfilePictureOptions] = useState(false);
  const [profilePictureUrl, setProfilePictureUrl] = useState(user?.profilePictureUrl || "");
  const [isUploadingProfilePicture, setIsUploadingProfilePicture] = useState(false);

  useEffect(() => {
    setProfilePictureUrl(user?.profilePictureUrl || "");
  }, [user?.profilePictureUrl]);

  useEffect(() => {
    if (!user?.studentNumber) return;
    let mounted = true;

    void fetchStudentProfile(user.studentNumber).then((result) => {
      if (!mounted || !result.ok || !result.profile) return;
      const nextProfilePictureUrl = result.profile.profilePictureUrl || "";
      setProfilePictureUrl(nextProfilePictureUrl);
      if (nextProfilePictureUrl !== (user.profilePictureUrl || "")) {
        setUser({ ...user, profilePictureUrl: nextProfilePictureUrl });
      }
    });

    return () => {
      mounted = false;
    };
  }, [setUser, user]);
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

  const saveSelectedProfilePicture = async (asset: ImagePicker.ImagePickerAsset) => {
    if (!user?.studentNumber) {
      showAppAlert("Sign in needed", "Please sign in again before updating your profile picture.");
      return;
    }

    const mimeType = getImageMimeType(asset);
    if (!["image/jpeg", "image/png"].includes(mimeType)) {
      showAppAlert("Unsupported image", "Please choose a PNG or JPEG image only.");
      return;
    }
    if (asset.fileSize && asset.fileSize > PROFILE_PICTURE_LIMIT_BYTES) {
      showAppAlert("Image too large", "Profile pictures must be 5 MB or smaller.");
      return;
    }

    try {
      setIsUploadingProfilePicture(true);
      const longestSide = Math.max(asset.width || 0, asset.height || 0);
      const actions: ImageManipulator.Action[] = [];
      if (longestSide > PROFILE_PICTURE_MAX_DIMENSION) {
        if (asset.width >= asset.height) {
          actions.push({ resize: { width: PROFILE_PICTURE_MAX_DIMENSION } });
        } else {
          actions.push({ resize: { height: PROFILE_PICTURE_MAX_DIMENSION } });
        }
      }

      const compressed = await ImageManipulator.manipulateAsync(asset.uri, actions, {
        base64: true,
        compress: 0.72,
        format: ImageManipulator.SaveFormat.JPEG,
      });
      if (!compressed.base64) {
        throw new Error("The compressed image could not be read.");
      }

      const compressedBytes = Math.ceil((compressed.base64.length * 3) / 4);
      if (compressedBytes > PROFILE_PICTURE_LIMIT_BYTES) {
        showAppAlert("Image too large", "Please choose a smaller image and try again.");
        return;
      }

      const result = await updateStudentProfilePicture(user.studentNumber, {
        contentType: "image/jpeg",
        dataUrl: `data:image/jpeg;base64,${compressed.base64}`,
        fileName: `${user.studentNumber}-profile`,
      });
      if (!result.ok || !result.profilePictureUrl) {
        showAppAlert("Upload failed", result.message || "Please try again in a moment.");
        return;
      }

      setProfilePictureUrl(result.profilePictureUrl);
      setUser({ ...user, profilePictureUrl: result.profilePictureUrl });
      showAppAlert("Profile picture updated", "Your new picture will now appear across Bawat Tala.");
    } catch (error) {
      showAppAlert(
        "Upload failed",
        error instanceof Error ? error.message : "Please try choosing the image again.",
      );
    } finally {
      setIsUploadingProfilePicture(false);
    }
  };

  const chooseProfilePicture = async (source: "camera" | "library") => {
    try {
      if (source === "camera" && Platform.OS !== "web") {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          showAppAlert("Camera permission needed", "Allow camera access to take a profile picture.");
          return;
        }
      } else if (Platform.OS !== "web") {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          showAppAlert("Photo permission needed", "Allow photo access to choose a profile picture.");
          return;
        }
      }

      const result = source === "camera"
        ? await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            aspect: [1, 1],
            mediaTypes: ["images"],
            quality: 1,
          })
        : await ImagePicker.launchImageLibraryAsync({
            allowsEditing: true,
            aspect: [1, 1],
            mediaTypes: ["images"],
            quality: 1,
          });

      if (!result.canceled && result.assets[0]) {
        await saveSelectedProfilePicture(result.assets[0]);
      }
    } catch {
      showAppAlert("Photo unavailable", "Please try opening the camera or photo library again.");
    }
  };

  const openProfilePictureOptions = () => {
    if (isUploadingProfilePicture) return;
    setShowProfilePictureOptions(true);
  };

  const selectProfilePictureSource = (source: "camera" | "library") => {
    setShowProfilePictureOptions(false);
    void chooseProfilePicture(source);
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
        router.push("/referral" as never);
        return;
      default:
        showAppAlert("Not Ready Yet", "This setting is not available right now.");
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
            <View style={styles.avatarStage}>
              <StudentProfileAvatar
                imageUrl={profilePictureUrl}
                size={120}
                style={styles.avatarCircle}
              />
              {isUploadingProfilePicture ? (
                <View style={styles.avatarLoadingOverlay}>
                  <ActivityIndicator color="#FFFFFF" size="small" />
                </View>
              ) : null}
              <Pressable
                accessibilityLabel="Update profile picture"
                disabled={isUploadingProfilePicture}
                onPress={openProfilePictureOptions}
                style={({ pressed }) => [styles.cameraButton, pressed && styles.cameraButtonPressed]}
              >
                <Ionicons name="camera" size={19} color="#FFFFFF" />
              </Pressable>
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

        <View style={styles.aboutFooter}>
          <Text style={styles.aboutFooterBrand}>Bawat Tala</Text>
          <Text style={styles.aboutFooterMeta}>Version {APP_VERSION}</Text>
          <Text style={styles.aboutFooterMeta}>Built by FANTAFOUR</Text>
          <Text style={styles.aboutFooterMeta}>Keepsake Studio</Text>
        </View>
      </ScrollView>

      <Modal
        visible={showProfilePictureOptions}
        transparent
        animationType="fade"
        onRequestClose={() => setShowProfilePictureOptions(false)}
      >
        <Pressable
          accessibilityLabel="Close profile picture options"
          style={styles.modalBackdrop}
          onPress={() => setShowProfilePictureOptions(false)}
        >
          <Pressable
            accessibilityRole="menu"
            onPress={(event) => event.stopPropagation()}
            style={styles.photoOptionsCard}
          >
            <View style={styles.photoOptionsHeader}>
              <View>
                <Text style={styles.photoOptionsTitle}>Update profile picture</Text>
                <Text style={styles.photoOptionsSubtitle}>Choose how you want to add your photo.</Text>
              </View>
              <Pressable
                accessibilityLabel="Close"
                onPress={() => setShowProfilePictureOptions(false)}
                style={styles.photoOptionsClose}
              >
                <Ionicons name="close" size={20} color="#607080" />
              </Pressable>
            </View>

            <Pressable
              accessibilityRole="menuitem"
              onPress={() => selectProfilePictureSource("camera")}
              style={({ pressed }) => [styles.photoOptionButton, pressed && styles.photoOptionButtonPressed]}
            >
              <View style={styles.photoOptionIcon}>
                <Ionicons name="camera-outline" size={22} color="#558B3A" />
              </View>
              <View style={styles.photoOptionCopy}>
                <Text style={styles.photoOptionTitle}>Take Photo</Text>
                <Text style={styles.photoOptionDescription}>Use your camera to take a new picture.</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#87929D" />
            </Pressable>

            <Pressable
              accessibilityRole="menuitem"
              onPress={() => selectProfilePictureSource("library")}
              style={({ pressed }) => [styles.photoOptionButton, pressed && styles.photoOptionButtonPressed]}
            >
              <View style={styles.photoOptionIcon}>
                <Ionicons name="images-outline" size={22} color="#558B3A" />
              </View>
              <View style={styles.photoOptionCopy}>
                <Text style={styles.photoOptionTitle}>Choose from Library</Text>
                <Text style={styles.photoOptionDescription}>Select a PNG or JPEG up to 5 MB.</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#87929D" />
            </Pressable>

            <Pressable
              onPress={() => setShowProfilePictureOptions(false)}
              style={({ pressed }) => [styles.photoOptionsCancel, pressed && styles.photoOptionButtonPressed]}
            >
              <Text style={styles.photoOptionsCancelText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

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
  avatarStage: {
    height: 128,
    width: 128,
    marginBottom: 8,
  },
  avatarCircle: {
    backgroundColor: "#89E1D4",
    borderWidth: 4,
    borderColor: "#F2FFFA",
  },
  avatarLoadingOverlay: {
    position: "absolute",
    left: 0,
    top: 0,
    width: 120,
    height: 120,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(33, 55, 47, 0.52)",
  },
  cameraButton: {
    position: "absolute",
    right: 2,
    bottom: 2,
    width: 38,
    height: 38,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#5E9D41",
    borderWidth: 3,
    borderColor: "#FFFFFF",
    shadowColor: "#365D29",
    shadowOpacity: 0.22,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  cameraButtonPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.96 }],
  },
  name: {
    width: "100%",
    maxWidth: 300,
    color: "#304558",
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 4,
  },
  email: {
    width: "100%",
    maxWidth: 300,
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
  aboutFooter: {
    alignItems: "center",
    marginTop: 18,
    paddingBottom: 8,
    rowGap: 2,
  },
  aboutFooterBrand: {
    color: "#516476",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
  },
  aboutFooterMeta: {
    color: "#8A96A1",
    fontSize: 11,
    lineHeight: 15,
    textAlign: "center",
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
  photoOptionsCard: {
    width: "100%",
    maxWidth: 390,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    padding: 18,
    rowGap: 10,
    shadowColor: "#405047",
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 5,
  },
  photoOptionsHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    columnGap: 12,
    marginBottom: 4,
  },
  photoOptionsTitle: {
    color: "#304558",
    fontSize: 19,
    lineHeight: 25,
    fontWeight: "700",
  },
  photoOptionsSubtitle: {
    color: "#6A7885",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 2,
  },
  photoOptionsClose: {
    width: 34,
    height: 34,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F3F6F8",
  },
  photoOptionButton: {
    minHeight: 70,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E3EBE0",
    backgroundColor: "#F8FCF5",
    paddingHorizontal: 13,
    paddingVertical: 11,
    flexDirection: "row",
    alignItems: "center",
    columnGap: 11,
  },
  photoOptionButtonPressed: {
    opacity: 0.76,
  },
  photoOptionIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#EDF7E7",
    alignItems: "center",
    justifyContent: "center",
  },
  photoOptionCopy: {
    flex: 1,
    minWidth: 0,
  },
  photoOptionTitle: {
    color: "#344A3B",
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "700",
  },
  photoOptionDescription: {
    color: "#718078",
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  photoOptionsCancel: {
    minHeight: 42,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  photoOptionsCancelText: {
    color: "#687681",
    fontSize: 14,
    fontWeight: "700",
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

