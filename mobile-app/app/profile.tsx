import { Ionicons } from "@expo/vector-icons";
import { showAppNotice } from "../lib/app-notice";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useCallback, useEffect, useState, type ComponentProps } from "react";
import {
  ActivityIndicator,
  Image,
  ImageSourcePropType,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  RefreshControl,
  StyleSheet,
  Text,
  View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StudentProfileAvatar } from "../components/profile/StudentProfileAvatar";
import { useAppPreferences } from "../lib/app-preferences";
import { useAuthSession } from "../lib/auth-session";
import { clearStudentProfilePicture, fetchStudentProfile, updateStudentProfilePicture } from "../lib/backend-api";
import { hydrateMuniWardrobe } from "../lib/muni-wardrobe";

type SettingRow = {
  id: string;
  icon: ComponentProps<typeof Ionicons>["name"];
  label: string;
  showChevron?: boolean;
};

const ACCOUNT_ROWS: SettingRow[] = [
  { id: "personal-details", icon: "person-circle-outline", label: "Personal Details", showChevron: true },
  { id: "privacy-security", icon: "shield-checkmark-outline", label: "Privacy & Security", showChevron: true },
  { id: "refer-friend", icon: "share-social-outline", label: "Refer a friend", showChevron: true },
];

const APP_ROWS: SettingRow[] = [
  { id: "recent-activity", icon: "time-outline", label: "Recent Activity", showChevron: true },
  { id: "app-lock", icon: "lock-closed-outline", label: "Journal Lock", showChevron: true },
  { id: "recently-deleted", icon: "trash-bin-outline", label: "Recently Deleted", showChevron: true },
  { id: "help-support", icon: "help-buoy-outline", label: "Help & Support", showChevron: true },
];
const APP_VERSION = "1.0.0";
const PROFILE_PICTURE_LIMIT_BYTES = 5 * 1024 * 1024;
const PROFILE_PICTURE_MAX_DIMENSION = 1024;
const PROFILE_FRAME_KEY = "@bawat-tala/profile-frame";
const PROFILE_FRAMES: { id: string; label: string; source: ImageSourcePropType }[] = [
  { id: "aether", label: "Aether", source: require("../assets/images/Frames/Aether Frame.png") },
  { id: "blossom", label: "Blossom", source: require("../assets/images/Frames/Blossom Frame.png") },
  { id: "constellation", label: "Constellation", source: require("../assets/images/Frames/Constellation Frame.png") },
  { id: "glimmer", label: "Glimmer", source: require("../assets/images/Frames/Glimmer Frame.png") },
  { id: "sprout", label: "Sprout", source: require("../assets/images/Frames/Sprout Frame.png") },
  { id: "tide", label: "Tide", source: require("../assets/images/Frames/Tide Frame.png") },
];
const BOTTLE_ACHIEVEMENT_IMAGE = require("../assets/images/Achievements/A Bottle for Tomorrow.jpg");

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
  const { clearUser, setUser, user } = useAuthSession();
  const { clearPreferences } = useAppPreferences();
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
  const [hasBottleAchievement, setHasBottleAchievement] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const selectedFrame = PROFILE_FRAMES.find((frame) => frame.id === selectedFrameId)?.source ?? null;

  useEffect(() => {
    setProfilePictureUrl(user?.profilePictureUrl || "");
  }, [user?.profilePictureUrl]);

  useEffect(() => {
    if (!user?.studentNumber) return;
    void Promise.all([
      AsyncStorage.getItem(`${PROFILE_FRAME_KEY}:${user.studentNumber}`),
      AsyncStorage.getItem(`@bawat-tala/future-bottle:${user.studentNumber}`),
    ]).then(([frameId, bottles]) => {
      setSelectedFrameId(PROFILE_FRAMES.some((frame) => frame.id === frameId) ? frameId : null);
      setHasBottleAchievement(Boolean(bottles && bottles !== "[]"));
    });
  }, [user?.studentNumber]);

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
    setSelectedFrameId(tempFrameId);
    if (user?.studentNumber) {
      void AsyncStorage.setItem(`${PROFILE_FRAME_KEY}:${user.studentNumber}`, tempFrameId ?? "");
    }
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
      setProfilePictureUrl(nextProfilePictureUrl);
      setProgram(String(result.profile.program || "").trim());
      if (nextProfilePictureUrl !== (user.profilePictureUrl || "")) {
        setUser({ ...user, profilePictureUrl: nextProfilePictureUrl });
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
      const [frameId, bottles, profileResult] = await Promise.all([
        AsyncStorage.getItem(`${PROFILE_FRAME_KEY}:${user.studentNumber}`),
        AsyncStorage.getItem(`@bawat-tala/future-bottle:${user.studentNumber}`),
        fetchStudentProfile(user.studentNumber),
      ]);
      await hydrateMuniWardrobe(user.studentNumber).catch(() => undefined);
      setSelectedFrameId(PROFILE_FRAMES.some((frame) => frame.id === frameId) ? frameId : null);
      setHasBottleAchievement(Boolean(bottles && bottles !== "[]"));
      if (profileResult && profileResult.ok && profileResult.profile) {
        const nextProfilePictureUrl = profileResult.profile.profilePictureUrl || "";
        setProfilePictureUrl(nextProfilePictureUrl);
        setProgram(String(profileResult.profile.program || "").trim());
        if (nextProfilePictureUrl !== (user.profilePictureUrl || "")) {
          setUser({ ...user, profilePictureUrl: nextProfilePictureUrl });
        }
      }
    } finally {
      setIsRefreshing(false);
    }
  }, [setUser, user]);

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
          <View style={styles.heroGlowLeft} />
          <View style={styles.heroGlowRight} />
          <View style={styles.profileWrap}>
            <View style={styles.avatarStage}>
              <StudentProfileAvatar
                imageUrl={profilePictureUrl}
                frameSource={selectedFrame}
                size={120}
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
                style={({ pressed }) => [styles.cameraButton, pressed && styles.cameraButtonPressed]}
              >
                <Ionicons name="camera" size={19} color="#FFFFFF" />
              </Pressable>
            </View>
            <Text style={styles.name}>{user?.fullName || "User"}</Text>
            <Text style={styles.email}>{program || "Student"}</Text>
            <View style={styles.identityRow}>
              <View style={styles.identityChip}>
                <Ionicons name="card-outline" size={14} color="#5E7D58" />
                <Text style={styles.identityChipText}>{user?.studentNumber || "Student profile"}</Text>
              </View>
            </View>
          </View>
        </View>



        <View style={styles.cardsRow}>
          {/* Left Column: Schedule */}
          <Pressable style={styles.gridCardSchedule} onPress={() => void handleRowPress("schedule")}>
            <View style={styles.gridCardTopRow}>
              <View style={styles.gridScheduleIconWrap}>
                <Ionicons name="calendar-clear-outline" size={20} color="#5A8A36" />
              </View>
              <Ionicons name="chevron-forward" size={16} color="#7E8490" />
            </View>
            <Text style={styles.gridCardTitle}>My Schedule</Text>
            <Text style={styles.gridCardSubtitle} numberOfLines={2}>Consultations & booked dates</Text>
          </Pressable>

          {/* Right Column: Achievements */}
          <Pressable style={styles.gridCardAchievement} onPress={() => router.push("/achievements" as never)}>
            <View style={styles.gridCardTopRow}>
              <View style={styles.gridAchievementImageWrap}>
                <Image
                  source={BOTTLE_ACHIEVEMENT_IMAGE}
                  style={[styles.achievementImage, !hasBottleAchievement && styles.achievementImageLocked]}
                  resizeMode="cover"
                />
              </View>
            </View>
            <Text style={styles.gridCardTitle} numberOfLines={1}>A Bottle for Tomorrow</Text>
            <Text style={styles.gridCardSubtitle} numberOfLines={2}>Write your first future bottle note.</Text>
          </Pressable>
        </View>

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
    paddingTop: 16,
    paddingHorizontal: 12,
    paddingBottom: 32 },
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
    elevation: 2 },
  heroGlowLeft: {
    position: "absolute",
    top: -36,
    left: -20,
    width: 120,
    height: 120,
    borderRadius: 999,
    backgroundColor: "#DDF8C7",
    opacity: 0.75 },
  heroGlowRight: {
    position: "absolute",
    right: -30,
    bottom: -36,
    width: 140,
    height: 140,
    borderRadius: 999,
    backgroundColor: "#E8F5FF",
    opacity: 0.85 },
  profileWrap: {
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 20 },
  avatarStage: {
    height: 172,
    width: 172,
    marginBottom: 8,
    alignItems: "center",
    justifyContent: "center" },
  avatarCircle: {
    backgroundColor: "#89E1D4",
    borderWidth: 4,
    borderColor: "#F2FFFA" },
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
  cameraButton: {
    position: "absolute",
    right: 8,
    bottom: 8,
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
    elevation: 4 },
  cameraButtonPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.96 }] },
  name: {
    width: "100%",
    maxWidth: 300,
    color: "#304558",
    fontSize: 28,
    lineHeight: 34,
    fontFamily: "Outfit-Bold",
    textAlign: "center",
    marginBottom: 4 },
  email: {
    width: "100%",
    maxWidth: 300,
    color: "#5E7080",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    marginBottom: 12 },
  identityRow: {
    flexDirection: "row",
    justifyContent: "center" },
  identityChip: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#F4F9EF",
    borderWidth: 1,
    borderColor: "#DAEAC8" },
  identityChipText: {
    color: "#58704C",
    fontSize: 12,
    lineHeight: 16,
    fontFamily: "Outfit-Bold" },
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
    elevation: 2 },
  cardsRow: {
    flexDirection: "row",
    columnGap: 10,
    marginBottom: 12,
  },
  gridCardSchedule: {
    flex: 1,
    minHeight: 112,
    borderRadius: 20,
    backgroundColor: "#F5F1FF",
    borderWidth: 1,
    borderColor: "#E8E0FF",
    padding: 13,
    justifyContent: "space-between",
    shadowColor: "#777777",
    shadowOpacity: 0.06,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  gridCardAchievement: {
    flex: 1,
    minHeight: 112,
    borderRadius: 20,
    backgroundColor: "#FFFDF8",
    borderWidth: 1,
    borderColor: "#EEE4CF",
    padding: 13,
    justifyContent: "space-between",
    shadowColor: "#777777",
    shadowOpacity: 0.06,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  gridCardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  gridScheduleIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E0EAD2",
  },
  gridAchievementImageWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#ECEBE6",
  },
  gridCardTitle: {
    color: "#33475C",
    fontSize: 15,
    lineHeight: 19,
    fontFamily: "Outfit-Bold",
    marginBottom: 2,
  },
  gridCardSubtitle: {
    color: "#6B7685",
    fontSize: 12,
    lineHeight: 16,
  },
  gridAchievementEyebrow: {
    color: "#9B7E3F",
    fontSize: 10,
    fontFamily: "Outfit-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.3,
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
    elevation: 2 },
  scheduleShortcutIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E0EAD2" },
  scheduleShortcutContent: {
    flex: 1 },
  scheduleShortcutText: {
    color: "#33475C",
    fontSize: 18,
    lineHeight: 22,
    fontFamily: "Outfit-Bold",
    marginBottom: 2 },
  scheduleShortcutMeta: {
    color: "#6B7685",
    fontSize: 13,
    lineHeight: 18 },
  groupTitle: {
    color: "#2E3F54",
    fontSize: 15,
    lineHeight: 20,
    fontFamily: "Outfit-Bold",
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8 },
  rowItem: {
    minHeight: 54,
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
    paddingRight: 12 },
  rowIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: "#F4FAED",
    borderWidth: 1,
    borderColor: "#DBEAC8",
    alignItems: "center",
    justifyContent: "center" },
  rowLabel: {
    color: "#34475D",
    fontSize: 16,
    lineHeight: 21,
    fontFamily: "Outfit-Medium" },
  rowDivider: {
    height: 1,
    backgroundColor: "#EEF3F6",
    marginLeft: 60 },
  signOutButton: {
    minHeight: 46,
    borderRadius: 999,
    backgroundColor: "#FFF7F8",
    borderWidth: 1,
    borderColor: "#F4D8DC",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 18,
    marginBottom: 10,
    marginHorizontal: 10,
    shadowColor: "#B49AA1",
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2 },
  signOutText: {
    color: "#EE596B",
    fontSize: 16,
    lineHeight: 20,
    fontFamily: "Outfit-Bold" },
  aboutFooter: {
    alignItems: "center",
    marginTop: 18,
    paddingBottom: 8,
    rowGap: 2 },
  aboutFooterBrand: {
    color: "#516476",
    fontSize: 13,
    lineHeight: 18,
    fontFamily: "Outfit-Bold" },
  aboutFooterMeta: {
    color: "#8A96A1",
    fontSize: 11,
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
    elevation: 6,
  },
  frameModalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  frameModalTitle: {
    color: "#304558",
    fontSize: 19,
    lineHeight: 25,
    fontFamily: "Outfit-Bold",
  },
  frameModalSubtitle: {
    color: "#6A7885",
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  frameLivePreviewWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    marginBottom: 12,
    backgroundColor: "#F8FCF5",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E3EBE0",
  },
  frameLivePreviewLabel: {
    color: "#465848",
    fontSize: 13,
    fontFamily: "Outfit-Bold",
    marginTop: 8,
  },
  frameModalRow: {
    columnGap: 10,
    paddingVertical: 6,
    paddingHorizontal: 2,
  },
  frameModalOption: {
    width: 68,
    alignItems: "center",
    borderRadius: 14,
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderWidth: 1,
    borderColor: "transparent",
  },
  frameModalOptionSelected: {
    backgroundColor: "#EDF6E9",
    borderColor: "#70C943",
  },
  frameModalActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    columnGap: 10,
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#EEF3ED",
  },
  frameModalCancelButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 14,
    backgroundColor: "#F3F6F8",
    alignItems: "center",
    justifyContent: "center",
  },
  frameModalCancelText: {
    color: "#5E6E7D",
    fontSize: 14,
    fontFamily: "Outfit-SemiBold",
  },
  frameModalSaveButton: {
    flex: 1.2,
    minHeight: 44,
    borderRadius: 14,
    backgroundColor: "#558B3A",
    alignItems: "center",
    justifyContent: "center",
  },
  frameModalSaveText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily: "Outfit-Bold",
  },
  confirmIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#EDF6E9",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  modalTitle: {
    color: "#2C3E50",
    fontSize: 18,
    fontFamily: "Outfit-Bold",
    marginBottom: 6,
    textAlign: "center",
  },
  customizationSubtitle: { color: "#71808B", fontSize: 13, lineHeight: 18, marginTop: -2, marginBottom: 12 },
  frameRow: { columnGap: 10, paddingRight: 8 },
  frameOption: { width: 70, alignItems: "center", borderRadius: 14, paddingVertical: 5 },
  frameOptionSelected: { backgroundColor: "#EDF6E9" },
  framePreview: { width: 58, height: 58, borderRadius: 29, backgroundColor: "#F0F4F2", alignItems: "center", justifyContent: "center" },
  frameLabel: { color: "#5E6B76", fontSize: 10, fontFamily: "Outfit-Bold", marginTop: 5 },
  achievementCard: { marginHorizontal: 16, marginBottom: 12, borderRadius: 22, backgroundColor: "#FFFDF8", borderWidth: 1, borderColor: "#EEE4CF", padding: 13, flexDirection: "row", alignItems: "center", columnGap: 11 },
  achievementImageWrap: { width: 58, height: 58, borderRadius: 16, overflow: "hidden", backgroundColor: "#ECEBE6" },
  achievementImage: { width: "100%", height: "100%" },
  achievementImageLocked: { opacity: 0.25 },
  achievementCopy: { flex: 1 },
  achievementEyebrow: { color: "#9B7E3F", fontSize: 10, fontFamily: "Outfit-Bold", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 2 },
  achievementTitle: { color: "#414846", fontSize: 15, fontFamily: "Outfit-Bold", marginBottom: 2 },
  achievementDesc: { color: "#717A76", fontSize: 12, lineHeight: 16 },
  achievementAction: { alignItems: "center" },
  achievementActionText: { color: "#8D7743", fontSize: 11, fontFamily: "Outfit-Bold" },
});

