import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { PasswordField } from "../components/forms/PasswordField";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { forgotPasswordReset } from "../lib/backend-api";
import { useAuthSession } from "../lib/auth-session";
import { useAndroidKeyboardInset, useKeyboardStableHeight } from "../lib/keyboard-layout";

const STRONG_PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;
const APP_MAX_WIDTH = 412;

function HeaderBackdrop({ width, height }: { width: number; height: number }) {
  const sceneWidth = Math.min(width && width > 0 ? width : APP_MAX_WIDTH, APP_MAX_WIDTH);
  const headerHeight = Math.max(height, 160);
  const cx = sceneWidth * 0.88;
  const cy = -15;
  const rings: number[] = [];
  for (let r = 24; r <= 380; r += 16) {
    rings.push(r);
  }

  return (
    <Svg
      width={sceneWidth}
      height={headerHeight}
      style={StyleSheet.absoluteFillObject}
      viewBox={"0 0 " + sceneWidth + " " + headerHeight}
    >
      <Defs>
        <LinearGradient id="headerGradient" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#5EBFA4" />
          <Stop offset="0.42" stopColor="#7CD49F" />
          <Stop offset="0.82" stopColor="#C8E8B6" />
          <Stop offset="1" stopColor="#FCE3A1" />
        </LinearGradient>
      </Defs>
      <Rect width={sceneWidth} height={headerHeight} fill="url(#headerGradient)" />
      {rings.map((radius) => (
        <Circle
          key={radius}
          cx={cx}
          cy={cy}
          r={radius}
          stroke="rgba(255, 255, 255, 0.32)"
          strokeWidth={1}
          fill="none"
        />
      ))}
    </Svg>
  );
}

function GradientButtonBg() {
  return (
    <Svg width="100%" height="100%" style={StyleSheet.absoluteFillObject} pointerEvents="none">
      <Defs>
        <LinearGradient id="newPassBtnGrad" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#257A54" />
          <Stop offset="0.5" stopColor="#31966B" />
          <Stop offset="1" stopColor="#43B886" />
        </LinearGradient>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#newPassBtnGrad)" />
    </Svg>
  );
}

function getPasswordStrength(value: string) {
  const checks = [
    value.length >= 8,
    /[a-z]/.test(value),
    /[A-Z]/.test(value),
    /\d/.test(value),
    /[^A-Za-z\d]/.test(value),
  ];
  const score = checks.filter(Boolean).length;

  if (!value) {
    return { label: "", color: "#D0D7DE", progress: 0 };
  }
  if (score >= 5) {
    return { label: "Strong", color: "#16803A", progress: "100%" as const };
  }
  if (score >= 3) {
    return { label: "Good", color: "#B87312", progress: "66%" as const };
  }
  return { label: "Weak", color: "#C31A1A", progress: "33%" as const };
}

export default function ResetPasswordNewScreen() {
  const params = useLocalSearchParams<{ studentId?: string }>();
  const { user } = useAuthSession();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const studentId = String(params.studentId || "").trim();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const passwordStrength = getPasswordStrength(newPassword);

  // The IME resizes the Android window, so layout breakpoints must not follow the live
  // height or the whole screen reflows while the keyboard is animating. See lib/keyboard-layout.
  const referenceHeight = useKeyboardStableHeight(height);
  const keyboardInset = useAndroidKeyboardInset();

  const isCompactHeight = referenceHeight > 0 && referenceHeight < 720;
  const isNarrowWidth = width > 0 && width < 360;
  const headerHeight = isCompactHeight ? 180 : 220;
  const frameWidth = Math.min(width && width > 0 ? width : APP_MAX_WIDTH, APP_MAX_WIDTH);

  const handleResetPassword = async () => {
    if (!newPassword) {
      setErrorMessage("New password is required");
      return;
    }
    if (!STRONG_PASSWORD_PATTERN.test(newPassword)) {
      setErrorMessage("Choose a stronger password.");
      return;
    }
    if (!confirmPassword) {
      setErrorMessage("Confirm your password");
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage("Passwords do not match");
      return;
    }
    if (!studentId) {
      setErrorMessage("Missing student ID. Please restart reset password.");
      return;
    }

    setErrorMessage("");
    setSuccessMessage("");
    setIsBusy(true);
    const result = await forgotPasswordReset(studentId, newPassword, confirmPassword);
    setIsBusy(false);

    if (!result.ok) {
      setErrorMessage(result.message || "Unable to reset password.");
      return;
    }

    setSuccessMessage("Password updated successfully");
    setTimeout(() => {
      router.replace(user ? "/profile" : "/login");
    }, 1200);
  };

  const handleReturn = () => {
    router.replace(user ? "/profile" : "/login");
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={0}
    >
      {/* Top Graphic Header */}
      <View style={[styles.headerContainer, { width: frameWidth, height: headerHeight }]}>
        <HeaderBackdrop width={frameWidth} height={headerHeight} />
        <SafeAreaView edges={["top"]} style={styles.headerSafeArea}>
          <Pressable
            style={styles.backButton}
            onPress={handleReturn}
            disabled={isBusy}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <Ionicons name="chevron-back" size={20} color="#18362B" />
            <Text style={styles.backText}>Back</Text>
          </Pressable>
        </SafeAreaView>
      </View>

      {/* White Bottom Sheet Overlapping Header */}
      <View style={styles.sheetCard}>
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            isNarrowWidth && styles.scrollContentNarrow,
            { paddingBottom: Math.max(insets.bottom + 16, 28) + keyboardInset },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="none"
          showsVerticalScrollIndicator={false}
        >
          {/* Brand Logo & Headings */}
          <View style={[styles.titleArea, isCompactHeight && styles.titleAreaCompact]}>
            <View style={[styles.logoBadge, isCompactHeight && styles.logoBadgeCompact]}>
              <Image
                source={require("../assets/images/Logo_BT.png")}
                style={[styles.logoImage, isCompactHeight && styles.logoImageCompact]}
                contentFit="contain"
              />
            </View>
            <Text style={[styles.title, isCompactHeight && styles.titleCompact]}>Create New Password</Text>
            <Text style={styles.subtitle}>
              Enter and confirm a password you have not used recently.
            </Text>
          </View>

          {/* Form Fields */}
          <View style={styles.formArea}>
            <PasswordField
              label="New Password"
              value={newPassword}
              onChangeText={(text) => {
                setNewPassword(text);
                if (errorMessage) setErrorMessage("");
              }}
              showPassword={showNewPassword}
              onToggleVisibility={() => setShowNewPassword((prev) => !prev)}
              placeholder="Enter new password"
              placeholderTextColor="#9CA3AF"
              containerStyle={styles.passwordContainer}
              inputWrapStyle={styles.passwordWrap}
              inputStyle={styles.passwordInput}
            />
            {!!newPassword && (
              <View style={styles.strengthWrap}>
                <View style={styles.strengthTrack}>
                  <View
                    style={[
                      styles.strengthFill,
                      { width: passwordStrength.progress, backgroundColor: passwordStrength.color },
                    ]}
                  />
                </View>
                <Text style={[styles.passwordStrengthText, { color: passwordStrength.color }]}>
                  {passwordStrength.label}
                </Text>
              </View>
            )}

            <PasswordField
              label="Confirm New Password"
              value={confirmPassword}
              onChangeText={(text) => {
                setConfirmPassword(text);
                if (errorMessage) setErrorMessage("");
              }}
              showPassword={showConfirmPassword}
              onToggleVisibility={() => setShowConfirmPassword((prev) => !prev)}
              placeholder="Confirm new password"
              placeholderTextColor="#9CA3AF"
              containerStyle={styles.passwordContainer}
              inputWrapStyle={styles.passwordWrap}
              inputStyle={styles.passwordInput}
            />

            {/* Error Banner */}
            {!!errorMessage && (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle" size={16} color="#DC2626" style={{ marginRight: 6 }} />
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            )}

            {/* Success Banner */}
            {!!successMessage && (
              <View style={styles.successBanner}>
                <Ionicons name="checkmark-circle" size={16} color="#16803A" style={{ marginRight: 6 }} />
                <Text style={styles.successText}>{successMessage}</Text>
              </View>
            )}

            {/* Reset Password Button (Gradient Pill) */}
            <Pressable
              style={[styles.resetBtn, isBusy && styles.resetBtnDisabled]}
              onPress={handleResetPassword}
              disabled={isBusy}
              accessibilityRole="button"
              accessibilityState={{ disabled: isBusy, busy: isBusy }}
            >
              <GradientButtonBg />
              {isBusy ? (
                <View style={styles.btnInner}>
                  <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={styles.resetBtnText}>Updating...</Text>
                </View>
              ) : (
                <Text style={styles.resetBtnText}>Reset Password</Text>
              )}
            </Pressable>

            {/* Return link */}
            <View style={styles.returnWrap}>
              <Text style={styles.returnPrompt}>
                Go back to{" "}
                <Text style={styles.returnLink} onPress={handleReturn}>
                  {user ? "profile page" : "login page"}
                </Text>
              </Text>
            </View>
          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#5EBFA4",
  },
  headerContainer: {
    alignSelf: "center",
    overflow: "hidden",
  },
  headerSafeArea: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingVertical: 6,
    paddingRight: 10,
  },
  backText: {
    fontFamily: "Outfit-Medium",
    fontSize: 15,
    color: "#18362B",
    marginLeft: 3,
  },
  sheetCard: {
    flex: 1,
    marginTop: -32,
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    overflow: "hidden",
    shadowColor: "#1B3A2E",
    shadowOpacity: 0.1,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -6 },
    elevation: 8,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
    justifyContent: "flex-start",
  },
  scrollContentNarrow: {
    paddingHorizontal: 16,
  },
  titleArea: {
    alignItems: "center",
    marginBottom: 24,
  },
  titleAreaCompact: {
    marginBottom: 16,
  },
  logoBadge: {
    width: 68,
    height: 68,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#E1F2E8",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    shadowColor: "#2D7D5A",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  logoBadgeCompact: {
    width: 56,
    height: 56,
    borderRadius: 16,
    marginBottom: 8,
  },
  logoImage: {
    width: 48,
    height: 48,
  },
  logoImageCompact: {
    width: 38,
    height: 38,
  },
  title: {
    fontFamily: "Outfit-Bold",
    fontSize: 26,
    lineHeight: 32,
    color: "#111827",
    textAlign: "center",
    letterSpacing: -0.3,
  },
  titleCompact: {
    fontSize: 23,
    lineHeight: 28,
  },
  subtitle: {
    fontFamily: "Outfit",
    fontSize: 13.5,
    lineHeight: 19,
    color: "#6B7280",
    textAlign: "center",
    marginTop: 6,
    paddingHorizontal: 10,
  },
  formArea: {
    width: "100%",
    maxWidth: 350,
    alignSelf: "center",
  },
  fieldLabel: {
    fontFamily: "Outfit-SemiBold",
    fontSize: 13,
    color: "#374151",
    marginBottom: 6,
  },
  passwordContainer: {
    marginBottom: 12,
  },
  passwordWrap: {
    minHeight: 50,
    borderRadius: 14,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
    borderWidth: 1.2,
  },
  passwordInput: {
    fontSize: 14.5,
    fontFamily: "Outfit",
    color: "#111827",
  },
  strengthWrap: {
    marginTop: -4,
    marginBottom: 14,
  },
  strengthTrack: {
    height: 4,
    borderRadius: 999,
    backgroundColor: "#E5E7EB",
    overflow: "hidden",
  },
  strengthFill: {
    height: "100%",
    borderRadius: 999,
  },
  passwordStrengthText: {
    fontSize: 11,
    fontFamily: "Outfit-SemiBold",
    marginTop: 4,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  errorText: {
    flex: 1,
    fontFamily: "Outfit-Medium",
    fontSize: 12.5,
    lineHeight: 17,
    color: "#B91C1C",
  },
  successBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#BBF7D0",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  successText: {
    flex: 1,
    fontFamily: "Outfit-Medium",
    fontSize: 12.5,
    lineHeight: 17,
    color: "#16803A",
  },
  resetBtn: {
    backgroundColor: "#2D7D5A",
    height: 50,
    borderRadius: 16,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#20724F",
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
    marginTop: 6,
  },
  resetBtnDisabled: {
    opacity: 0.65,
  },
  btnInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  resetBtnText: {
    fontFamily: "Outfit-Bold",
    fontSize: 15.5,
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },
  returnWrap: {
    alignItems: "center",
    marginTop: 22,
  },
  returnPrompt: {
    fontFamily: "Outfit",
    fontSize: 13,
    color: "#6B7280",
  },
  returnLink: {
    fontFamily: "Outfit-Bold",
    color: "#2D7D5A",
  },
});
