import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { OtpCodeInput } from "../components/forms/OtpCodeInput";
import { forgotPasswordResendCode, forgotPasswordVerifyCode } from "../lib/backend-api";
import { useAndroidKeyboardInset, useKeyboardStableHeight } from "../lib/keyboard-layout";

const OTP_LENGTH = 8;
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
        <LinearGradient id="otpBtnGrad" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#257A54" />
          <Stop offset="0.5" stopColor="#31966B" />
          <Stop offset="1" stopColor="#43B886" />
        </LinearGradient>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#otpBtnGrad)" />
    </Svg>
  );
}

function getInitialResendSeconds(value?: string) {
  const parsed = Math.ceil(Number(value || 60));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 60;
}

export default function ResetPasswordOtpScreen() {
  const params = useLocalSearchParams<{ resendAfterSeconds?: string; studentId?: string }>();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const studentId = String(params.studentId || "").trim();
  const initialResendSeconds = getInitialResendSeconds(String(params.resendAfterSeconds || ""));
  const [otpCode, setOtpCode] = useState("");
  const [resendSeconds, setResendSeconds] = useState(initialResendSeconds);
  const [errorMessage, setErrorMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  // The IME resizes the Android window, so layout breakpoints must not follow the live
  // height or the whole screen reflows while the keyboard is animating. See lib/keyboard-layout.
  const referenceHeight = useKeyboardStableHeight(height);
  const keyboardInset = useAndroidKeyboardInset();

  const isCompactHeight = referenceHeight > 0 && referenceHeight < 720;
  const isNarrowWidth = width > 0 && width < 360;
  const headerHeight = isCompactHeight ? 180 : 220;
  const frameWidth = Math.min(width && width > 0 ? width : APP_MAX_WIDTH, APP_MAX_WIDTH);

  useEffect(() => {
    if (!studentId) {
      setErrorMessage("Missing student ID. Please confirm your account again.");
    }
  }, [studentId]);

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const timer = setInterval(() => {
      setResendSeconds((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendSeconds]);

  const handleVerifyCode = async () => {
    if (!studentId) return;
    if (otpCode.trim().length !== OTP_LENGTH) {
      setErrorMessage("Please enter the 8-digit OTP.");
      return;
    }

    setErrorMessage("");
    setIsBusy(true);
    const result = await forgotPasswordVerifyCode(studentId, otpCode.trim());
    setIsBusy(false);

    if (!result.ok) {
      setErrorMessage(result.message ?? "The code is invalid. Please check the latest email code and try again.");
      return;
    }

    router.push({
      pathname: "/reset-password-new",
      params: { studentId } });
  };

  const handleResendCode = async () => {
    if (!studentId || resendSeconds > 0) return;

    setIsBusy(true);
    const result = await forgotPasswordResendCode(studentId);
    setIsBusy(false);

    if (!result.ok) {
      setErrorMessage(result.message ?? "Failed to send reset code.");
      return;
    }

    setResendSeconds(result.resendAfterSeconds ?? 60);
    setOtpCode("");
    setErrorMessage("");
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
            onPress={() => router.replace("/reset-password")}
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
            <Text style={[styles.title, isCompactHeight && styles.titleCompact]}>Verification Code</Text>
            <Text style={styles.subtitle}>
              Enter the 8-digit reset code sent to your email.
            </Text>
          </View>

          {/* Form Fields */}
          <View style={styles.formArea}>
            <Text style={styles.otpLabel}>Verification Code</Text>
            <OtpCodeInput
              length={OTP_LENGTH}
              value={otpCode}
              onChangeCode={(code) => {
                setOtpCode(code);
                if (errorMessage) setErrorMessage("");
              }}
              containerStyle={styles.otpRow}
            />

            {/* Error Banner */}
            {!!errorMessage && (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle" size={16} color="#DC2626" style={{ marginRight: 6 }} />
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            )}

            {/* Verify Code Button (Gradient Pill) */}
            <Pressable
              style={[styles.primaryBtn, isBusy && styles.btnDisabled]}
              onPress={handleVerifyCode}
              disabled={isBusy}
              accessibilityRole="button"
              accessibilityState={{ disabled: isBusy, busy: isBusy }}
            >
              <GradientButtonBg />
              {isBusy ? (
                <View style={styles.btnInner}>
                  <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={styles.primaryBtnText}>Verifying...</Text>
                </View>
              ) : (
                <Text style={styles.primaryBtnText}>Verify Code</Text>
              )}
            </Pressable>

            {/* Resend Code Button */}
            <Pressable
              style={[styles.resendBtn, (resendSeconds > 0 || isBusy) && styles.resendBtnDisabled]}
              onPress={handleResendCode}
              disabled={resendSeconds > 0 || isBusy}
            >
              <Text style={styles.resendBtnText}>
                {resendSeconds > 0 ? `Resend code in ${resendSeconds}s` : "Resend code"}
              </Text>
            </Pressable>

            {/* Return link */}
            <View style={styles.returnWrap}>
              <Text style={styles.returnPrompt}>
                Go back to{" "}
                <Text style={styles.returnLink} onPress={() => router.replace("/reset-password")}>
                  confirm account
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
  otpLabel: {
    fontFamily: "Outfit-SemiBold",
    fontSize: 13,
    color: "#374151",
    marginBottom: 10,
    textAlign: "center",
  },
  otpRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
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
  primaryBtn: {
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
    marginBottom: 12,
  },
  btnDisabled: {
    opacity: 0.65,
  },
  btnInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: {
    fontFamily: "Outfit-Bold",
    fontSize: 15.5,
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },
  resendBtn: {
    height: 46,
    borderRadius: 14,
    borderWidth: 1.2,
    borderColor: "#D1D5DB",
    backgroundColor: "#F9FAFB",
    alignItems: "center",
    justifyContent: "center",
  },
  resendBtnDisabled: {
    opacity: 0.55,
  },
  resendBtnText: {
    fontFamily: "Outfit-SemiBold",
    fontSize: 13.5,
    color: "#374151",
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
