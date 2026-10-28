import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { forgotPasswordSendCode } from "../lib/backend-api";
import { useAuthSession } from "../lib/auth-session";
import {
  AUTH_MESSAGES,
  isValidStudentId,
  normalizeStudentIdInput } from "../lib/auth-validation";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
        <LinearGradient id="resetBtnGrad" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#257A54" />
          <Stop offset="0.5" stopColor="#31966B" />
          <Stop offset="1" stopColor="#43B886" />
        </LinearGradient>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#resetBtnGrad)" />
    </Svg>
  );
}

function normalizeEmailInput(value: string) {
  return value.trim().toLowerCase();
}

export default function ResetPasswordScreen() {
  const { user } = useAuthSession();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [studentId, setStudentId] = useState("");
  const [email, setEmail] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [focusedField, setFocusedField] = useState<"studentId" | "email" | null>(null);

  const isCompactHeight = height > 0 && height < 720;
  const isNarrowWidth = width > 0 && width < 360;
  const headerHeight = isCompactHeight ? 180 : 220;
  const frameWidth = Math.min(width && width > 0 ? width : APP_MAX_WIDTH, APP_MAX_WIDTH);

  const handleConfirmAccount = async () => {
    const studentNumber = normalizeStudentIdInput(studentId);
    const emailValue = normalizeEmailInput(email);

    if (!studentNumber && !emailValue) {
      setErrorMessage("Student ID and email are required.");
      return;
    }
    if (!studentNumber) {
      setErrorMessage(AUTH_MESSAGES.studentIdRequired);
      return;
    }
    if (!emailValue) {
      setErrorMessage("Email is required.");
      return;
    }
    if (!isValidStudentId(studentNumber)) {
      setErrorMessage("Enter Student ID in 23-2903 format.");
      return;
    }
    if (!EMAIL_PATTERN.test(emailValue)) {
      setErrorMessage("Enter a valid email address.");
      return;
    }

    setErrorMessage("");
    setIsBusy(true);
    const result = await forgotPasswordSendCode(studentNumber, emailValue);
    setIsBusy(false);

    if (!result.ok) {
      setErrorMessage(result.message ?? "Student ID and email do not match an active Bawat Tala account.");
      return;
    }

    router.push({
      pathname: "/reset-password-otp",
      params: {
        resendAfterSeconds: String(result.resendAfterSeconds ?? 60),
        studentId: studentNumber } });
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
            { paddingBottom: Math.max(insets.bottom + 16, 28) },
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
            <Text style={[styles.title, isCompactHeight && styles.titleCompact]}>Confirm Your Account</Text>
            <Text style={styles.subtitle}>
              Enter your details. We&apos;ll send a one-time code to the email linked to your account.
            </Text>
          </View>

          {/* Form Fields */}
          <View style={styles.formArea}>
            {/* Student ID */}
            <View
              style={[
                styles.inputWrapper,
                focusedField === "studentId" && styles.inputWrapperFocused,
              ]}
            >
              <TextInput
                value={studentId}
                onChangeText={(text) => {
                  setStudentId(text);
                  if (errorMessage) setErrorMessage("");
                }}
                placeholder="Student ID (e.g. 23-2903)"
                placeholderTextColor="#9CA3AF"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="numbers-and-punctuation"
                maxLength={10}
                editable={!isBusy}
                style={styles.textInput}
                onFocus={() => setFocusedField("studentId")}
                onBlur={() => setFocusedField(null)}
                returnKeyType="next"
              />
              {studentId.length > 0 && !isBusy && (
                <Pressable
                  onPress={() => setStudentId("")}
                  hitSlop={8}
                  style={styles.clearBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Clear ID"
                >
                  <Ionicons name="close-circle" size={17} color="#9CA3AF" />
                </Pressable>
              )}
            </View>

            {/* Email */}
            <View
              style={[
                styles.inputWrapper,
                focusedField === "email" && styles.inputWrapperFocused,
              ]}
            >
              <TextInput
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  if (errorMessage) setErrorMessage("");
                }}
                placeholder="Account Email (e.g. name@example.com)"
                placeholderTextColor="#9CA3AF"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                editable={!isBusy}
                style={styles.textInput}
                onFocus={() => setFocusedField("email")}
                onBlur={() => setFocusedField(null)}
                returnKeyType="done"
                onSubmitEditing={handleConfirmAccount}
              />
              {email.length > 0 && !isBusy && (
                <Pressable
                  onPress={() => setEmail("")}
                  hitSlop={8}
                  style={styles.clearBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Clear Email"
                >
                  <Ionicons name="close-circle" size={17} color="#9CA3AF" />
                </Pressable>
              )}
            </View>

            {/* Error Banner */}
            {!!errorMessage && (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle" size={16} color="#DC2626" style={{ marginRight: 6 }} />
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            )}

            {/* Confirm Account Button (Gradient Pill) */}
            <Pressable
              style={[styles.confirmBtn, isBusy && styles.confirmBtnDisabled]}
              onPress={handleConfirmAccount}
              disabled={isBusy}
              accessibilityRole="button"
              accessibilityState={{ disabled: isBusy, busy: isBusy }}
            >
              <GradientButtonBg />
              {isBusy ? (
                <View style={styles.btnInner}>
                  <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={styles.confirmBtnText}>Confirming...</Text>
                </View>
              ) : (
                <Text style={styles.confirmBtnText}>Confirm Account</Text>
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
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    height: 50,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.2,
    borderColor: "#E5E7EB",
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  inputWrapperFocused: {
    borderColor: "#2D7D5A",
    borderWidth: 1.5,
    shadowColor: "#2D7D5A",
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 },
  },
  textInput: {
    flex: 1,
    height: "100%",
    fontFamily: "Outfit",
    fontSize: 14.5,
    color: "#111827",
    paddingVertical: 0,
    ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : {}),
  },
  clearBtn: {
    padding: 4,
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
  confirmBtn: {
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
  confirmBtnDisabled: {
    opacity: 0.65,
  },
  btnInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  confirmBtnText: {
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
