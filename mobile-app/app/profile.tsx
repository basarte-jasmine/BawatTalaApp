import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState, type ComponentProps } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
    ActivityIndicator,
    Animated,
    ImageSourcePropType,
    Modal,
    Platform,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    View
} from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StudentProfileAvatar } from "../components/profile/StudentProfileAvatar";
import { AppleTopBar } from "../components/ui/AppleTopBar";
import { showAppNotice } from "../lib/app-notice";
import { useAppPreferences } from "../lib/app-preferences";
import { useAuthSession } from "../lib/auth-session";
import { clearStudentProfilePicture, fetchStudentAppointments, fetchStudentProfile, getStudentAchievements, updateStudentProfilePicture } from "../lib/backend-api";
import { getMuniCollectionSource, hydrateMuniWardrobe, useSavedMuniLoadout } from "../lib/muni-wardrobe";

type SettingRow = {
  id: string;
  icon: ComponentProps<typeof Ionicons>["name"];
  label: string;
  showChevron?: boolean;
};

const ACCOUNT_ROWS: SettingRow[] = [
  { id: "privacy-security", icon: "shield-checkmark-outline", label: "Privacy & Security", showChevron: true },
  { id: "refer-friend", icon: "share-social-outline", label: "Refer a friend", showChevron: true },
];

const APP_ROWS: SettingRow[] = [
  { id: "recent-activity", icon: "time-outline", label: "Recent Activity", showChevron: true },
  { id: "app-lock", icon: "lock-closed-outline", label: "Journal Lock", showChevron: true },
  { id: "recently-deleted", icon: "trash-bin-outline", label: "Recently Deleted", showChevron: true },
  { id: "help-support", icon: "help-buoy-outline", label: "Help & Support", showChevron: true },
];
const APP_VERSION = "1.7";
const PROFILE_PICTURE_LIMIT_BYTES = 5 * 1024 * 1024;
const PROFILE_PICTURE_MAX_DIMENSION = 1024;
const PROFILE_FRAME_KEY = "@bawat-tala/profile-frame";
const PROFILE_FRAMES: { id: string; label: string; source: ImageSourcePropType }[] = [
  { id: "aether", label: "Aether", source: require("../assets/images/Frames/Aether Frame.webp") },
  { id: "blossom", label: "Blossom", source: require("../assets/images/Frames/Blossom Frame.webp") },
  { id: "constellation", label: "Constellation", source: require("../assets/images/Frames/Constellation Frame.webp") },
  { id: "glimmer", label: "Glimmer", source: require("../assets/images/Frames/Glimmer Frame.webp") },
  { id: "sprout", label: "Sprout", source: require("../assets/images/Frames/Sprout Frame.webp") },
  { id: "tide", label: "Tide", source: require("../assets/images/Frames/Tide Frame.webp") },
];

const DEFAULT_MUNI_BG = require("../assets/images/Background/Garden.webp");

function getImageMimeType(asset: ImagePicker.ImagePickerAsset) {
  const mimeType = String(asset.mimeType || "").toLowerCase();
  if (mimeType === "image/jpg") return "image/jpeg";
  if (mimeType) return mimeType;

  const fileName = String(asset.fileName || asset.uri || "").toLowerCase();
  if (/\.png(?:$|\?)/.test(fileName)) return "image/png";
  if (/\.jpe?g(?:$|\?)/.test(fileName)) return "image/jpeg";
  return "";
}


export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const topBarOffset = Math.max(insets.top, 14) + 48 + 14;
  const { clearUser, setUser, user } = useAuthSession();
  const { clearPreferences, profileFrameId, setProfileFrameId } = useAppPreferences();
  const [showSignOutModal, setShowSignOutModal] = useState(false);
  const [showProfilePictureOptions, setShowProfilePictureOptions] = useState(false);
  const [showFrameModal, setShowFrameModal] = useState(false);
  const [tempFrameId, setTempFrameId] = useState<string | null>(null);
  const [showFrameConfirmModal, setShowFrameConfirmModal] = useState(false);
  const [showRemovePhotoConfirmModal, setShowRemovePhotoConfirmModal] = useState(false);
  const [profilePictureUrl, setProfilePictureUrl] = useState(user?.profilePictureUrl || "");
  const [program, setProgram] = useState("");
  const [isUploadingProfilePicture, setIsUploadingProfilePicture] = useState(false);
  const [selectedFrameId, setSelectedFrameId] = useState<string | null>(null);
  const [achievementCount, setAchievementCount] = useState(0);
  const [scheduleCount, setScheduleCount] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const selectedFrame = PROFILE_FRAMES.find((frame) => frame.id === selectedFrameId)?.source ?? null;
  const savedMuniLoadout = useSavedMuniLoadout();
  const equippedBackgroundSource =
    getMuniCollectionSource("background", savedMuniLoadout?.background) ?? DEFAULT_MUNI_BG;

  // Apple spring button press scales
  const statScheduleScale = useRef(new Animated.Value(1)).current;
  const statAchieveScale = useRef(new Animated.Value(1)).current;
  const editBtnScale = useRef(new Animated.Value(1)).current;
  const signOutScale = useRef(new Animated.Value(1)).current;

  const handleButtonPressIn = (animValue: Animated.Value, toValue = 0.94) => {
    Animated.spring(animValue, {
      toValue,
      damping: 14,
      stiffness: 340,
      mass: 0.8,
      useNativeDriver: true,
    }).start();
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
  };

  const handleButtonPressOut = (animValue: Animated.Value) => {
    Animated.spring(animValue, {
      toValue: 1,
      damping: 12,
      stiffness: 240,
      mass: 0.8,
      useNativeDriver: true,
    }).start();
  };

  useEffect(() => {
    setProfilePictureUrl(user?.profilePictureUrl || "");
  }, [user?.profilePictureUrl]);

  useEffect(() => {
    if (profileFrameId) {
      setSelectedFrameId(PROFILE_FRAMES.some((frame) => frame.id === profileFrameId) ? profileFrameId : null);
      return;
    }
    // Explicit null/empty from preferences means no frame — do not revive from AsyncStorage.
    setSelectedFrameId(null);
  }, [profileFrameId]);

  const loadAchievementsData = useCallback(async () => {
    if (!user?.studentNumber) return;
    try {
      const prefix = `@bawat-tala/achievement:`;
      const suffix = `:${user.studentNumber}`;
      const keys = await AsyncStorage.getAllKeys();
      const localCount = keys.filter((k) => k.startsWith(prefix) && k.endsWith(suffix)).length;
      if (localCount > 0) {
        setAchievementCount(localCount);
      }

      const serverRes = await getStudentAchievements();
      if (serverRes.ok && Array.isArray(serverRes.achievements)) {
        setAchievementCount(serverRes.achievements.length);
        for (const item of serverRes.achievements) {
          const time = item.unlockedAt ? new Date(item.unlockedAt).getTime() : Date.now();
          await AsyncStorage.setItem(`@bawat-tala/achievement:${item.id}:${user.studentNumber}`, String(time));
        }
      }
    } catch {}
  }, [user?.studentNumber]);

  useEffect(() => {
    if (!user?.studentNumber) return;
    void fetchStudentAppointments(user.studentNumber).then((res) => {
      if (res.ok && Array.isArray(res.appointments)) {
        const active = res.appointments.filter((a) => !["CANCELLED", "DECLINED"].includes(String(a.status).toUpperCase())).length;
        setScheduleCount(active);
      }
    }).catch(() => undefined);
  }, [user?.studentNumber]);

  useEffect(() => {
    void loadAchievementsData();
  }, [loadAchievementsData]);

  useFocusEffect(
    useCallback(() => {
      void loadAchievementsData();
    }, [loadAchievementsData])
  );

  const openFramePicker = () => {
    setShowProfilePictureOptions(false);
    setTempFrameId(selectedFrameId);
    setShowFrameModal(true);
  };

  const handleApplyFramePress = () => {
    if (tempFrameId === selectedFrameId) {
      setShowFrameModal(false);
      return;
    }
    setShowFrameConfirmModal(true);
  };

  const handleConfirmSaveFrame = () => {
    const nextFrame = tempFrameId;
    setSelectedFrameId(nextFrame);
    if (user?.studentNumber) {
      const storageKey = `${PROFILE_FRAME_KEY}:${user.studentNumber}`;
      if (nextFrame) {
        void AsyncStorage.setItem(storageKey, nextFrame);
      } else {
        void AsyncStorage.removeItem(storageKey);
      }
    }
    void setProfileFrameId(nextFrame);
    setShowFrameConfirmModal(false);
    setShowFrameModal(false);
    showAppNotice("Profile Frame Saved", "Your profile frame has been updated successfully.");
  };

  useEffect(() => {
    if (!user?.studentNumber) return;
    let mounted = true;

    void fetchStudentProfile(user.studentNumber).then((result) => {
      if (!mounted || !result.ok || !result.profile) return;
      const nextProfilePictureUrl = result.profile.profilePictureUrl || "";
      const nextNickname = typeof result.profile.nickname === "string" ? result.profile.nickname : "";
      setProfilePictureUrl(nextProfilePictureUrl);
      setProgram(String(result.profile.program || "").trim());
      if (nextProfilePictureUrl !== (user.profilePictureUrl || "") || nextNickname !== (user.nickname || "")) {
        setUser({ ...user, profilePictureUrl: nextProfilePictureUrl, nickname: nextNickname });
      }
    });

    return () => {
      mounted = false;
    };
  }, [setUser, user]);
  const handleRefresh = useCallback(async () => {
    if (!user?.studentNumber) return;
    setIsRefreshing(true);
    try {
      const profileResult = await fetchStudentProfile(user.studentNumber);
      await hydrateMuniWardrobe(user.studentNumber).catch(() => undefined);
      setSelectedFrameId(
        profileFrameId && PROFILE_FRAMES.some((frame) => frame.id === profileFrameId) ? profileFrameId : null,
      );
      void fetchStudentAppointments(user.studentNumber).then((res) => {
        if (res.ok && Array.isArray(res.appointments)) {
          const active = res.appointments.filter((a) => !["CANCELLED", "DECLINED"].includes(String(a.status).toUpperCase())).length;
          setScheduleCount(active);
        }
      }).catch(() => undefined);
      await loadAchievementsData();
      if (profileResult && profileResult.ok && profileResult.profile) {
        const nextProfilePictureUrl = profileResult.profile.profilePictureUrl || "";
        const nextNickname = typeof profileResult.profile.nickname === "string" ? profileResult.profile.nickname : "";
        setProfilePictureUrl(nextProfilePictureUrl);
        setProgram(String(profileResult.profile.program || "").trim());
        if (nextProfilePictureUrl !== (user.profilePictureUrl || "") || nextNickname !== (user.nickname || "")) {
          setUser({ ...user, profilePictureUrl: nextProfilePictureUrl, nickname: nextNickname });
        }
      }
    } finally {
      setIsRefreshing(false);
    }
  }, [profileFrameId, setUser, user]);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/home");
  };

  const handleConfirmSignOut = async () => {
    setShowSignOutModal(false);
    clearPreferences();
    await clearUser();
    router.replace("/login");
  };

  const saveSelectedProfilePicture = async (asset: ImagePicker.ImagePickerAsset) => {
    if (!user?.studentNumber) {
      showAppNotice("Sign in needed", "Please sign in again before updating your profile picture.");
      return;
    }

    const mimeType = getImageMimeType(asset);
    if (!["image/jpeg", "image/png"].includes(mimeType)) {
      showAppNotice("Unsupported image", "Please choose a PNG or JPEG image only.");
      return;
    }
    if (asset.fileSize && asset.fileSize > PROFILE_PICTURE_LIMIT_BYTES) {
      showAppNotice("Image too large", "Profile pictures must be 5 MB or smaller.");
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
        format: ImageManipulator.SaveFormat.JPEG });
      if (!compressed.base64) {
        throw new Error("The compressed image could not be read.");
      }

      const compressedBytes = Math.ceil((compressed.base64.length * 3) / 4);
      if (compressedBytes > PROFILE_PICTURE_LIMIT_BYTES) {
        showAppNotice("Image too large", "Please choose a smaller image and try again.");
        return;
      }

      const result = await updateStudentProfilePicture(user.studentNumber, {
        contentType: "image/jpeg",
        dataUrl: `data:image/jpeg;base64,${compressed.base64}`,
        fileName: `${user.studentNumber}-profile` });
      if (!result.ok || !result.profilePictureUrl) {
        showAppNotice("Upload failed", result.message || "Please try again in a moment.");
        return;
      }

      setProfilePictureUrl(result.profilePictureUrl);
      setUser({ ...user, profilePictureUrl: result.profilePictureUrl });
      showAppNotice("Profile picture updated", "Your new picture will now appear across Bawat Tala.");
    } catch (error) {
      showAppNotice(
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
          showAppNotice("Camera permission needed", "Allow camera access to take a profile picture.");
          return;
        }
      } else if (Platform.OS !== "web") {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          showAppNotice("Photo permission needed", "Allow photo access to choose a profile picture.");
          return;
        }
      }

      const result = source === "camera"
        ? await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            aspect: [1, 1],
            mediaTypes: ["images"],
            quality: 1 })
        : await ImagePicker.launchImageLibraryAsync({
            allowsEditing: true,
            aspect: [1, 1],
            mediaTypes: ["images"],
            quality: 1 });

      if (!result.canceled && result.assets[0]) {
        await saveSelectedProfilePicture(result.assets[0]);
      }
    } catch {
      showAppNotice("Photo unavailable", "Please try opening the camera or photo library again.");
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

  const removeProfilePicture = async () => {
    if (!user?.studentNumber || isUploadingProfilePicture) return;
    setShowProfilePictureOptions(false);
    setIsUploadingProfilePicture(true);
    try {
      const result = await clearStudentProfilePicture();
      if (!result.ok) {
        showAppNotice("Photo not removed", result.message || "Please try again.");
        return;
      }
      setProfilePictureUrl("");
      setUser({ ...user, profilePictureUrl: "" });
    } catch {
      showAppNotice("Photo not removed", "Please try again.");
    } finally {
      setIsUploadingProfilePicture(false);
    }
  };

  const handleRowPress = async (rowId: string) => {
    switch (rowId) {
      case "schedule":
      case "personal-details":
      case "privacy-security":
      case "recent-activity":
      case "help-support":
      case "app-lock":
      case "recently-deleted":
        router.push(`/profile-settings?section=${rowId}`);
        return;
      case "refer-friend":
        router.push("/referral" as never);
        return;
      default:
        showAppNotice("Not Ready Yet", "This setting is not available right now.");
    }
  };

  return (
    <View style={styles.screen}>
      <AppleTopBar title="Profile" onBack={handleBack} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingTop: topBarOffset }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={["#73CD44"]}
            tintColor="#73CD44"
          />
        }
      >
        <View style={styles.profileHero}>
          {/* Top Banner Backdrop: Equipped Muni Room Background */}
          <View style={styles.heroBackdrop}>
            <Image
              source={equippedBackgroundSource}
              style={styles.heroBackdropImage}
              contentFit="cover"
              cachePolicy="memory-disk"
              priority="high"
            />
            <View style={styles.heroBackdropTintOverlay} />
          </View>

          {/* Overlapping Profile Avatar */}
          <View style={styles.avatarOverlapStage}>
            <View style={styles.avatarAnchor}>
            <StudentProfileAvatar
              imageUrl={profilePictureUrl}
              frameSource={selectedFrame}
              size={114}
              style={selectedFrame ? undefined : styles.avatarCircle}
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
                style={({ pressed }) => [
                  styles.cameraButton,
                  selectedFrame ? styles.cameraButtonWithFrame : styles.cameraButtonNoFrame,
                  pressed && styles.cameraButtonPressed,
                ]}
              >
                <Ionicons name="camera" size={14} color="#FFFFFF" />
              </Pressable>
            </View>
          </View>

          {/* Profile Name & ID */}
          <View style={styles.heroBody}>
            <Text style={styles.heroName}>{user?.nickname || user?.fullName || "Student"}</Text>
            <View style={styles.heroSubRow}>
              <Text style={styles.heroSubText}>
                {user?.studentNumber ? user.studentNumber : "Student profile"}
              </Text>
              {program ? (
                <>
                  <View style={styles.heroSubDot} />
                  <Text style={styles.heroSubText} numberOfLines={1}>{program}</Text>
                </>
              ) : null}
            </View>

            {/* 2-Column Stats Row: Schedule & Achievements */}
            <View style={styles.statsRow}>
              <Animated.View style={[{ flex: 1 }, { transform: [{ scale: statScheduleScale }] }]}>
                <Pressable
                  style={styles.statCol}
                  onPress={() => void handleRowPress("schedule")}
                  onPressIn={() => handleButtonPressIn(statScheduleScale)}
                  onPressOut={() => handleButtonPressOut(statScheduleScale)}
                >
                  <Text style={styles.statValue}>{scheduleCount}</Text>
                  <Text style={styles.statLabel}>Schedule</Text>
                </Pressable>
              </Animated.View>

              <View style={styles.statDivider} />

              <Animated.View style={[{ flex: 1 }, { transform: [{ scale: statAchieveScale }] }]}>
                <Pressable
                  style={styles.statCol}
                  onPress={() => router.push("/achievements" as never)}
                  onPressIn={() => handleButtonPressIn(statAchieveScale)}
                  onPressOut={() => handleButtonPressOut(statAchieveScale)}
                >
                  <Text style={styles.statValue}>{achievementCount}</Text>
                  <Text style={styles.statLabel}>Achievements</Text>
                </Pressable>
              </Animated.View>
            </View>

            {/* Action Button: Edit profile info (Full Width, App Green) */}
            <View style={styles.actionButtonWrap}>
              <Animated.View style={[{ width: "100%" }, { transform: [{ scale: editBtnScale }] }]}>
                <Pressable
                  style={styles.editProfileButton}
                  onPress={() => void handleRowPress("personal-details")}
                  onPressIn={() => handleButtonPressIn(editBtnScale, 0.96)}
                  onPressOut={() => handleButtonPressOut(editBtnScale)}
                  accessibilityRole="button"
                  accessibilityLabel="Edit profile info"
                >
                  <Ionicons name="create-outline" size={17} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.editProfileButtonText}>Edit profile info</Text>
                </Pressable>
              </Animated.View>
            </View>
          </View>
        </View>

        {/* Account Settings */}
        <View style={styles.sectionWrap}>
          <Text style={styles.sectionHeaderTitle}>Account Settings</Text>
          <View style={styles.groupCard}>
            {ACCOUNT_ROWS.map((row, index) => (
              <View key={row.id}>
                <SettingRowItem row={row} onPress={handleRowPress} />
                {index < ACCOUNT_ROWS.length - 1 ? <View style={styles.rowDivider} /> : null}
              </View>
            ))}
          </View>
        </View>

        {/* App Settings */}
        <View style={styles.sectionWrap}>
          <Text style={styles.sectionHeaderTitle}>App Settings</Text>
          <View style={styles.groupCard}>
            {APP_ROWS.map((row, index) => (
              <View key={row.id}>
                <SettingRowItem row={row} onPress={handleRowPress} />
                {index < APP_ROWS.length - 1 ? <View style={styles.rowDivider} /> : null}
              </View>
            ))}
          </View>
        </View>

        {/* Sign Out Card */}
        <View style={styles.sectionWrap}>
          <Animated.View style={{ transform: [{ scale: signOutScale }] }}>
            <View style={styles.signOutCard}>
              <Pressable
                style={styles.signOutButton}
                onPress={() => setShowSignOutModal(true)}
                onPressIn={() => handleButtonPressIn(signOutScale, 0.98)}
                onPressOut={() => handleButtonPressOut(signOutScale)}
                accessibilityRole="button"
                accessibilityLabel="Sign Out"
              >
                <Ionicons name="log-out-outline" size={18} color="#DC2626" style={{ marginRight: 6 }} />
                <Text style={styles.signOutText}>Sign Out</Text>
              </Pressable>
            </View>
          </Animated.View>
        </View>

        <View style={styles.aboutFooter}>
          <Text style={styles.aboutFooterBrand}>Bawat Tala</Text>
          <Text style={styles.aboutFooterMeta}>Version {APP_VERSION} • Keepsake Studio</Text>
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
              accessibilityRole="menuitem"
              onPress={openFramePicker}
              style={({ pressed }) => [styles.photoOptionButton, pressed && styles.photoOptionButtonPressed]}
            >
              <View style={styles.photoOptionIcon}>
                <Ionicons name="color-palette-outline" size={22} color="#558B3A" />
              </View>
              <View style={styles.photoOptionCopy}>
                <Text style={styles.photoOptionTitle}>Profile Customization</Text>
                <Text style={styles.photoOptionDescription}>Choose and save a frame for your photo.</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#87929D" />
            </Pressable>

            {profilePictureUrl ? (
              <Pressable
                accessibilityRole="menuitem"
                onPress={() => {
                  setShowProfilePictureOptions(false);
                  setShowRemovePhotoConfirmModal(true);
                }}
                style={({ pressed }) => [styles.photoOptionButton, pressed && styles.photoOptionButtonPressed]}
              >
                <View style={styles.photoOptionIcon}>
                  <Ionicons name="trash-outline" size={22} color="#C45C5C" />
                </View>
                <View style={styles.photoOptionCopy}>
                  <Text style={styles.photoOptionTitle}>Remove Photo</Text>
                  <Text style={styles.photoOptionDescription}>Reset back to the default avatar.</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#87929D" />
              </Pressable>
            ) : null}

            <Pressable
              onPress={() => setShowProfilePictureOptions(false)}
              style={({ pressed }) => [styles.photoOptionsCancel, pressed && styles.photoOptionButtonPressed]}
            >
              <Text style={styles.photoOptionsCancelText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Profile Frame Picker Modal */}
      <Modal
        visible={showFrameModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowFrameModal(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setShowFrameModal(false)}>
          <Pressable style={styles.frameModalCard} onPress={(e) => e.stopPropagation()}>
            <View style={styles.frameModalHeader}>
              <View>
                <Text style={styles.frameModalTitle}>Profile Customization</Text>
                <Text style={styles.frameModalSubtitle}>Choose a frame for your profile photo.</Text>
              </View>
              <Pressable
                accessibilityLabel="Close"
                onPress={() => setShowFrameModal(false)}
                style={styles.photoOptionsClose}
              >
                <Ionicons name="close" size={20} color="#607080" />
              </Pressable>
            </View>

            {/* Frame Live Preview */}
            <View style={styles.frameLivePreviewWrap}>
              <StudentProfileAvatar
                imageUrl={profilePictureUrl}
                frameSource={PROFILE_FRAMES.find((f) => f.id === tempFrameId)?.source ?? null}
                size={110}
              />
              <Text style={styles.frameLivePreviewLabel}>
                {PROFILE_FRAMES.find((f) => f.id === tempFrameId)?.label ?? "No Frame"}
              </Text>
            </View>

            {/* Frame Options */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.frameModalRow}>
              <Pressable
                style={[styles.frameModalOption, !tempFrameId && styles.frameModalOptionSelected]}
                onPress={() => setTempFrameId(null)}
              >
                <View style={styles.framePreview}>
                  <Ionicons name="ban-outline" size={23} color="#71808B" />
                </View>
                <Text style={styles.frameLabel}>None</Text>
              </Pressable>
              {PROFILE_FRAMES.map((frame) => (
                <Pressable
                  key={frame.id}
                  style={[styles.frameModalOption, tempFrameId === frame.id && styles.frameModalOptionSelected]}
                  onPress={() => setTempFrameId(frame.id)}
                >
                  <StudentProfileAvatar imageUrl={profilePictureUrl} frameSource={frame.source} size={56} />
                  <Text style={styles.frameLabel}>{frame.label}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <View style={styles.frameModalActions}>
              <Pressable style={styles.frameModalCancelButton} onPress={() => setShowFrameModal(false)}>
                <Text style={styles.frameModalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.frameModalSaveButton} onPress={handleApplyFramePress}>
                <Text style={styles.frameModalSaveText}>Save Frame</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Frame Save Confirmation Modal */}
      <Modal
        visible={showFrameConfirmModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowFrameConfirmModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.confirmIconWrap}>
              <Ionicons name="checkmark-circle-outline" size={32} color="#5A8A36" />
            </View>
            <Text style={styles.modalTitle}>Save Profile Frame?</Text>
            <Text style={styles.modalBody}>
              {tempFrameId
                ? `Apply the "${PROFILE_FRAMES.find((f) => f.id === tempFrameId)?.label}" frame to your profile picture?`
                : "Remove the frame from your profile picture?"}
            </Text>

            <View style={styles.modalActions}>
              <Pressable style={styles.modalSecondaryButton} onPress={() => setShowFrameConfirmModal(false)}>
                <Text style={styles.modalSecondaryText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.modalPrimaryButton} onPress={handleConfirmSaveFrame}>
                <Text style={styles.modalPrimaryText}>Yes, Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Remove Photo Confirmation Modal */}
      <Modal
        visible={showRemovePhotoConfirmModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRemovePhotoConfirmModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={[styles.confirmIconWrap, { backgroundColor: "#FDF0F0" }]}>
              <Ionicons name="trash-outline" size={30} color="#C45C5C" />
            </View>
            <Text style={styles.modalTitle}>Remove Profile Photo?</Text>
            <Text style={styles.modalBody}>
              Are you sure you want to remove your profile photo and reset back to the default avatar?
            </Text>

            <View style={styles.modalActions}>
              <Pressable style={styles.modalSecondaryButton} onPress={() => setShowRemovePhotoConfirmModal(false)}>
                <Text style={styles.modalSecondaryText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalPrimaryButton, { backgroundColor: "#C45C5C" }]}
                onPress={() => {
                  setShowRemovePhotoConfirmModal(false);
                  void removeProfilePicture();
                }}
              >
                <Text style={styles.modalPrimaryText}>Remove</Text>
              </Pressable>
            </View>
          </View>
        </View>
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
    </View>
  );
}

function SettingRowItem({ onPress, row }: { onPress: (rowId: string) => void | Promise<void>; row: SettingRow }) {
  const rowScale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(rowScale, {
      toValue: 0.98,
      damping: 14,
      stiffness: 340,
      mass: 0.8,
      useNativeDriver: true,
    }).start();
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
  };

  const handlePressOut = () => {
    Animated.spring(rowScale, {
      toValue: 1,
      damping: 12,
      stiffness: 240,
      mass: 0.8,
      useNativeDriver: true,
    }).start();
  };

  const iconMeta: { [key: string]: { bg: string; color: string } } = {
    "privacy-security": { bg: "#EFF6FF", color: "#2563EB" },
    "refer-friend": { bg: "#FAF5FF", color: "#7C3AED" },
    "recent-activity": { bg: "#FFFBEB", color: "#D97706" },
    "app-lock": { bg: "#ECFDF5", color: "#059669" },
    "recently-deleted": { bg: "#FEF2F2", color: "#DC2626" },
    "help-support": { bg: "#F0FDFA", color: "#0D9488" },
  };

  const meta = iconMeta[row.id] ?? { bg: "#F1F5F9", color: "#475569" };

  return (
    <Animated.View style={{ transform: [{ scale: rowScale }] }}>
      <Pressable
        style={styles.rowItem}
        onPress={() => void onPress(row.id)}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        accessibilityRole="button"
        accessibilityLabel={row.label}
      >
        <View style={styles.rowLeading}>
          <View style={[styles.rowIconWrap, { backgroundColor: meta.bg }]}>
            <Ionicons name={row.icon} size={18} color={meta.color} />
          </View>
          <Text style={styles.rowLabel}>{row.label}</Text>
        </View>
        {row.showChevron ? <Ionicons name="chevron-forward" size={16} color="#94A3B8" /> : null}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F7FAFC" },
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
    borderBottomColor: "#EEF2F5" },
  backButton: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center" },
  topTitle: {
    color: "#314258",
    fontSize: 34 / 2,
    lineHeight: 23,
    fontFamily: "Outfit-Bold" },
  topBarSpacer: {
    width: 38,
    height: 38 },
  scroll: {
    flex: 1 },
  scrollContent: {
    paddingTop: 78,
    paddingHorizontal: 12,
    paddingBottom: 32 },
  profileHero: {
    borderRadius: 28,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E7EEF4",
    overflow: "hidden",
    marginBottom: 14,
    shadowColor: "#6A7682",
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3 },
  heroBackdrop: {
    width: "100%",
    height: 154,
    position: "relative",
    overflow: "hidden" },
  heroBackdropImage: {
    ...StyleSheet.absoluteFillObject },
  heroBackdropTintOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.04)" },
  avatarOverlapStage: {
    alignSelf: "center",
    marginTop: -96,
    marginBottom: 8,
    alignItems: "center",
    justifyContent: "center" },
  avatarAnchor: {
    position: "relative" },
  avatarCircle: {
    borderRadius: 999,
    borderWidth: 3,
    borderColor: "#FFFFFF",
    backgroundColor: "transparent",
    overflow: "hidden" },
  avatarLoadingOverlay: {
    position: "absolute",
    left: "50%",
    top: "50%",
    marginLeft: -60,
    marginTop: -60,
    width: 120,
    height: 120,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(33, 55, 47, 0.52)" },
  heroBody: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 16,
    alignItems: "center" },
  heroName: {
    color: "#0F172A",
    fontSize: 22,
    lineHeight: 28,
    fontFamily: "Outfit-Bold",
    textAlign: "center" },
  heroSubRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 3,
    marginBottom: 6,
    paddingHorizontal: 12 },
  heroSubText: {
    color: "#64748B",
    fontSize: 13,
    lineHeight: 17,
    fontFamily: "Outfit-Medium" },
  heroSubDot: {
    width: 3.5,
    height: 3.5,
    borderRadius: 2,
    backgroundColor: "#94A3B8",
    marginHorizontal: 7 },
  statsRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    marginTop: 8,
    marginBottom: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#F1F5F9" },
  statCol: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center" },
  statValue: {
    color: "#0F172A",
    fontSize: 20,
    lineHeight: 25,
    fontFamily: "Outfit-Bold" },
  statLabel: {
    color: "#64748B",
    fontSize: 11.5,
    lineHeight: 15,
    fontFamily: "Outfit-Medium",
    marginTop: 2 },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: "#E2E8F0" },
  actionButtonWrap: {
    width: "100%",
    marginTop: 2,
    paddingHorizontal: 4 },
  editProfileButton: {
    height: 44,
    borderRadius: 999,
    backgroundColor: "#52B72A",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    shadowColor: "#2D771F",
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3 },
  editProfileButtonText: {
    color: "#FFFFFF",
    fontSize: 14.5,
    lineHeight: 19,
    fontFamily: "Outfit-Bold" },
  cameraButton: {
    position: "absolute",
    zIndex: 20,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#52B72A",
    borderWidth: 2.5,
    borderColor: "#FFFFFF",
    shadowColor: "#1B3B12",
    shadowOpacity: 0.22,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4 },
  cameraButtonWithFrame: {
    right: 18,
    bottom: 18 },
  cameraButtonNoFrame: {
    right: 2,
    bottom: 2 },
  cameraButtonPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.96 }] },
  sectionWrap: {
    marginBottom: 14,
  },
  sectionHeaderTitle: {
    color: "#64748B",
    fontSize: 11.5,
    lineHeight: 15,
    fontFamily: "Outfit-Bold",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  groupCard: {
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#0D2112",
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  rowItem: {
    minHeight: 52,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF" },
  rowLeading: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 12,
    flex: 1,
    paddingRight: 10 },
  rowIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center" },
  rowLabel: {
    color: "#0F172A",
    fontSize: 15,
    lineHeight: 20,
    fontFamily: "Outfit-Medium" },
  rowDivider: {
    height: 1,
    backgroundColor: "#F1F5F9",
    marginLeft: 58 },
  signOutCard: {
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#0D2112",
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  signOutButton: {
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  signOutText: {
    color: "#DC2626",
    fontSize: 15,
    lineHeight: 19,
    fontFamily: "Outfit-Bold" },
  aboutFooter: {
    alignItems: "center",
    marginTop: 14,
    paddingBottom: 8,
    rowGap: 2 },
  aboutFooterBrand: {
    color: "#64748B",
    fontSize: 13,
    lineHeight: 18,
    fontFamily: "Outfit-Bold" },
  aboutFooterMeta: {
    color: "#94A3B8",
    fontSize: 11.5,
    lineHeight: 15,
    textAlign: "center" },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(21, 27, 24, 0.34)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 22 },
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
    elevation: 4 },
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
    elevation: 5 },
  photoOptionsHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    columnGap: 12,
    marginBottom: 4 },
  photoOptionsTitle: {
    color: "#304558",
    fontSize: 19,
    lineHeight: 25,
    fontFamily: "Outfit-Bold" },
  photoOptionsSubtitle: {
    color: "#6A7885",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 2 },
  photoOptionsClose: {
    width: 34,
    height: 34,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F3F6F8" },
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
    columnGap: 11 },
  photoOptionButtonPressed: {
    opacity: 0.76 },
  photoOptionIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#EDF7E7",
    alignItems: "center",
    justifyContent: "center" },
  photoOptionCopy: {
    flex: 1,
    minWidth: 0 },
  photoOptionTitle: {
    color: "#344A3B",
    fontSize: 15,
    lineHeight: 20,
    fontFamily: "Outfit-Bold" },
  photoOptionDescription: {
    color: "#718078",
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2 },
  photoOptionsCancel: {
    minHeight: 42,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2 },
  photoOptionsCancelText: {
    color: "#687681",
    fontSize: 14,
    fontFamily: "Outfit-Bold" },
  modalBody: {
    color: "#52606C",
    fontSize: 17,
    lineHeight: 24,
    fontFamily: "Outfit-SemiBold",
    textAlign: "center",
    marginBottom: 16 },
  modalActions: {
    flexDirection: "row",
    columnGap: 10 },
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
    elevation: 1 },
  modalSecondaryText: {
    color: "#566271",
    fontSize: 13,
    fontFamily: "Outfit-Bold" },
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
    elevation: 2 },
  modalPrimaryText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontFamily: "Outfit-Bold" },
  frameModalCard: {
    width: "100%",
    maxWidth: 390,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    padding: 20,
    shadowColor: "#405047",
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6},
  frameModalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 12},
  frameModalTitle: {
    color: "#304558",
    fontSize: 19,
    lineHeight: 25,
    fontFamily: "Outfit-Bold"},
  frameModalSubtitle: {
    color: "#6A7885",
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2},
  frameLivePreviewWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    marginBottom: 12,
    backgroundColor: "#F8FCF5",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E3EBE0"},
  frameLivePreviewLabel: {
    color: "#465848",
    fontSize: 13,
    fontFamily: "Outfit-Bold",
    marginTop: 8},
  frameModalRow: {
    columnGap: 10,
    paddingVertical: 6,
    paddingHorizontal: 2},
  frameModalOption: {
    width: 68,
    alignItems: "center",
    borderRadius: 14,
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderWidth: 1,
    borderColor: "transparent"},
  frameModalOptionSelected: {
    backgroundColor: "#EDF6E9",
    borderColor: "#70C943"},
  frameModalActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    columnGap: 10,
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#EEF3ED"},
  frameModalCancelButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 14,
    backgroundColor: "#F3F6F8",
    alignItems: "center",
    justifyContent: "center"},
  frameModalCancelText: {
    color: "#5E6E7D",
    fontSize: 14,
    fontFamily: "Outfit-SemiBold"},
  frameModalSaveButton: {
    flex: 1.2,
    minHeight: 44,
    borderRadius: 14,
    backgroundColor: "#558B3A",
    alignItems: "center",
    justifyContent: "center"},
  frameModalSaveText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily: "Outfit-Bold"},
  confirmIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#EDF6E9",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12},
  modalTitle: {
    color: "#2C3E50",
    fontSize: 18,
    fontFamily: "Outfit-Bold",
    marginBottom: 6,
    textAlign: "center"},
  customizationSubtitle: { color: "#71808B", fontSize: 13, lineHeight: 18, marginTop: -2, marginBottom: 12 },
  frameRow: { columnGap: 10, paddingRight: 8 },
  frameOption: { width: 70, alignItems: "center", borderRadius: 14, paddingVertical: 5 },
  frameOptionSelected: { backgroundColor: "#EDF6E9" },
  framePreview: { width: 58, height: 58, borderRadius: 29, backgroundColor: "#F0F4F2", alignItems: "center", justifyContent: "center" },
  frameLabel: { color: "#5E6B76", fontSize: 10, fontFamily: "Outfit-Bold", marginTop: 5 }});

