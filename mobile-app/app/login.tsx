import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
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
import { useAuthSession } from "../lib/auth-session";
import { useAndroidKeyboardInset, useKeyboardStableHeight } from "../lib/keyboard-layout";
import {
  AUTH_MESSAGES,
  isValidStudentId,
  normalizeStudentIdInput,
} from "../lib/auth-validation";
import { loginWithStudentId } from "../lib/backend-api";

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
      pointerEvents="none"
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
        <LinearGradient id="btnGrad" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#257A54" />
          <Stop offset="0.5" stopColor="#31966B" />
          <Stop offset="1" stopColor="#43B886" />
        </LinearGradient>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#btnGrad)" />
    </Svg>
  );
}

function getLoginErrorMessage(message?: string) {
  const normalized = String(message || "").toLowerCase();

  if (normalized.includes("verify")) {
    return "Please verify your account before logging in.";
  }
  if (normalized.includes("too many")) {
    return "Too many login attempts. Please try again later.";
  }
  if (normalized.includes("server") || normalized.includes("connection") || normalized.includes("network")) {
    return "Unable to connect to the server. Please check your network and try again.";
  }

  return "Invalid Student ID or password. Please try again.";
}

export default function LoginScreen() {
  const { setUser } = useAuthSession();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [studentId, setStudentId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [focusedField, setFocusedField] = useState<"studentId" | "password" | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [reactivationPrompt, setReactivationPrompt] = useState<{
    message?: string;
    scheduledDeletionAt?: string;
  } | null>(null);

  const passwordInputRef = useRef<TextInput>(null);

  // The IME resizes the Android window, so layout breakpoints must not follow the live
  // height or the whole screen reflows while the keyboard is animating. See lib/keyboard-layout.
  const referenceHeight = useKeyboardStableHeight(height);

  const isCompactHeight = referenceHeight > 0 && referenceHeight < 720;
  const isNarrowWidth = width > 0 && width < 360;
  const headerHeight = isCompactHeight ? 180 : 220;

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const rememberedPref = await AsyncStorage.getItem("@bawat-tala/remember-me");
        if (rememberedPref === "false") {
          if (mounted) setRememberMe(false);
        } else {
          const savedId = await AsyncStorage.getItem("@bawat-tala/remembered-student-id");
          if (savedId && mounted) {
            setStudentId(savedId);
            setRememberMe(true);
          }
        }
      } catch {}
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Bottom slack so the ScrollView can move the focused field above the IME without
  // double-compensating the container. See lib/keyboard-layout.
  const keyboardInset = useAndroidKeyboardInset();

  const handleLogin = async () => {
    const studentNumber = normalizeStudentIdInput(studentId);
    const passwordValue = password.trim();

    if (!studentNumber && !passwordValue) {
      setErrorMessage(AUTH_MESSAGES.enterUsernameAndPassword);
      return;
    }
    if (!studentNumber) {
      setErrorMessage(AUTH_MESSAGES.studentIdRequired);
      return;
    }
    if (!passwordValue) {
      setErrorMessage(AUTH_MESSAGES.passwordRequired);
      return;
    }
    if (!isValidStudentId(studentNumber)) {
      setErrorMessage(AUTH_MESSAGES.invalidEmailOrPassword);
      return;
    }

    setErrorMessage("");
    setIsBusy(true);
    const result = await loginWithStudentId(studentNumber, passwordValue);
    setIsBusy(false);

    if (result.requiresReactivation) {
      setReactivationPrompt({
        message: result.message,
        scheduledDeletionAt: result.scheduledDeletionAt,
      });
      return;
    }

    if (!result.ok) {
      setErrorMessage(getLoginErrorMessage(result.message));
      return;
    }

    if (!result.user?.token) {
      setErrorMessage("Unable to start your session. Please try again.");
      return;
    }

    try {
      if (rememberMe) {
        await AsyncStorage.setItem("@bawat-tala/remembered-student-id", studentNumber);
        await AsyncStorage.setItem("@bawat-tala/remember-me", "true");
      } else {
        await AsyncStorage.removeItem("@bawat-tala/remembered-student-id");
        await AsyncStorage.setItem("@bawat-tala/remember-me", "false");
      }
    } catch {}

    setUser(result.user);
    router.replace({ pathname: "/studio", params: { welcome: "1" } });
  };

  const handleConfirmReactivation = async () => {
    const studentNumber = normalizeStudentIdInput(studentId);
    const passwordValue = password.trim();
    if (!studentNumber || !passwordValue) return;

    setIsBusy(true);
    setErrorMessage("");
    const result = await loginWithStudentId(studentNumber, passwordValue, { reactivate: true });
    setIsBusy(false);

    if (!result.ok || !result.user?.token) {
      setErrorMessage(result.message || "Reactivation failed. Please try again.");
      setReactivationPrompt(null);
      return;
    }

    try {
      if (rememberMe) {
        await AsyncStorage.setItem("@bawat-tala/remembered-student-id", studentNumber);
        await AsyncStorage.setItem("@bawat-tala/remember-me", "true");
      } else {
        await AsyncStorage.removeItem("@bawat-tala/remembered-student-id");
        await AsyncStorage.setItem("@bawat-tala/remember-me", "false");
      }
    } catch {}

    setReactivationPrompt(null);
    setUser(result.user);
    router.replace({ pathname: "/studio", params: { welcome: "1" } });
  };

  const frameWidth = Math.min(width && width > 0 ? width : APP_MAX_WIDTH, APP_MAX_WIDTH);
  const Container = Platform.OS === "ios" ? KeyboardAvoidingView : View;

  return (
    <Container
      style={styles.screen}
      {...(Platform.OS === "ios" ? { behavior: "padding" as const, keyboardVerticalOffset: 0 } : {})}
    >
      {/* Top Graphic Header */}
      <View style={[styles.headerContainer, { width: frameWidth, height: headerHeight }]}>
        <HeaderBackdrop width={frameWidth} height={headerHeight} />
        <SafeAreaView edges={["top"]} style={styles.headerSafeArea}>
          <Pressable
            style={styles.backButton}
            onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
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
          keyboardShouldPersistTaps="always"
          keyboardDismissMode="none"
          showsVerticalScrollIndicator={false}
        >
          {/* Brand Logo & Welcome Headings */}
          <View style={[styles.titleArea, isCompactHeight && styles.titleAreaCompact]}>
            <View style={[styles.logoBadge, isCompactHeight && styles.logoBadgeCompact]}>
              <Image
                source={require("../assets/images/Logo_BT.png")}
                style={[styles.logoImage, isCompactHeight && styles.logoImageCompact]}
                contentFit="contain"
              />
            </View>
            <Text style={[styles.title, isCompactHeight && styles.titleCompact]}>Welcome Back</Text>
            <Text style={styles.subtitle}>
              Ready to continue your journaling journey?
            </Text>
            <Text style={styles.subtitleBold}>
              Your sanctuary is right here.
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
                onSubmitEditing={() => passwordInputRef.current?.focus()}
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

            {/* Password */}
            <View
              style={[
                styles.inputWrapper,
                focusedField === "password" && styles.inputWrapperFocused,
              ]}
            >
              <TextInput
                ref={passwordInputRef}
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  if (errorMessage) setErrorMessage("");
                }}
                placeholder="Password"
                placeholderTextColor="#9CA3AF"
                secureTextEntry={!showPassword}
                editable={!isBusy}
                style={styles.textInput}
                onFocus={() => setFocusedField("password")}
                onBlur={() => setFocusedField(null)}
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />
              <Pressable
                onPress={() => setShowPassword((prev) => !prev)}
                hitSlop={10}
                style={styles.eyeBtn}
                accessibilityRole="button"
                accessibilityLabel={showPassword ? "Hide password" : "Show password"}
              >
                <Ionicons
                  name={showPassword ? "eye-off-outline" : "eye-outline"}
                  size={20}
                  color="#9CA3AF"
                />
              </Pressable>
            </View>

            {/* Utility Row: Remember me & Forgot Password */}
            <View style={styles.utilityRow}>
              <Pressable
                onPress={() => setRememberMe((prev) => !prev)}
                style={styles.rememberWrap}
                hitSlop={6}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: rememberMe }}
              >
                <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
                  {rememberMe && <Ionicons name="checkmark" size={12} color="#FFFFFF" />}
                </View>
                <Text style={styles.rememberText}>Remember me</Text>
              </Pressable>

              <Pressable
                disabled={isBusy}
                onPress={() => router.push("/reset-password")}
                hitSlop={6}
              >
                <Text style={styles.forgotText}>Forgot password?</Text>
              </Pressable>
            </View>

            {/* Error Message Banner */}
            {!!errorMessage && (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle" size={16} color="#DC2626" style={{ marginRight: 7 }} />
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            )}

            {/* Log In Button (Gradient Pill) */}
            <Pressable
              style={[styles.loginBtn, isBusy && styles.loginBtnDisabled]}
              onPress={handleLogin}
              disabled={isBusy}
              accessibilityRole="button"
              accessibilityState={{ disabled: isBusy, busy: isBusy }}
            >
              <GradientButtonBg />
              {isBusy ? (
                <View style={styles.btnInner}>
                  <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={styles.loginBtnText}>Logging in...</Text>
                </View>
              ) : (
                <Text style={styles.loginBtnText}>Log In</Text>
              )}
            </Pressable>

            {/* Register / Sign Up Link */}
            <View style={styles.registerWrap}>
              <Text style={styles.registerPrompt}>
                Don&apos;t have an account?{" "}
                <Text
                  style={styles.registerLink}
                  onPress={() => !isBusy && router.push("/register")}
                >
                  Register
                </Text>
              </Text>
            </View>
          </View>
        </ScrollView>
      </View>

      {/* Account Reactivation Modal */}
      <Modal
        visible={Boolean(reactivationPrompt)}
        transparent
        animationType="fade"
        onRequestClose={() => setReactivationPrompt(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconWrap}>
              <Ionicons name="alert-circle-outline" size={28} color="#2D7D5A" />
            </View>
            <Text style={styles.modalTitle}>Reactivate Account</Text>
            <Text style={styles.modalBody}>
              This account is currently scheduled for deletion. Reactivating will restore your access immediately.
            </Text>
            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalCancelBtn}
                onPress={() => setReactivationPrompt(null)}
                disabled={isBusy}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={styles.modalConfirmBtn}
                onPress={() => void handleConfirmReactivation()}
                disabled={isBusy}
              >
                <Text style={styles.modalConfirmText}>{isBusy ? "Reactivating..." : "Reactivate"}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </Container>
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
    marginTop: 0,
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
  },
  subtitleBold: {
    fontFamily: "Outfit-SemiBold",
    fontSize: 13.5,
    lineHeight: 19,
    color: "#1F2937",
    textAlign: "center",
    marginTop: 2,
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
  eyeBtn: {
    padding: 6,
  },
  utilityRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 2,
    marginBottom: 22,
    paddingHorizontal: 2,
  },
  rememberWrap: {
    flexDirection: "row",
    alignItems: "center",
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: "#9CA3AF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
    backgroundColor: "#FFFFFF",
  },
  checkboxChecked: {
    backgroundColor: "#2D7D5A",
    borderColor: "#2D7D5A",
  },
  rememberText: {
    fontFamily: "Outfit",
    fontSize: 13,
    color: "#4B5563",
  },
  forgotText: {
    fontFamily: "Outfit-Medium",
    fontSize: 13,
    color: "#2D7D5A",
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
  loginBtn: {
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
  },
  loginBtnDisabled: {
    opacity: 0.65,
  },
  btnInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  loginBtnText: {
    fontFamily: "Outfit-Bold",
    fontSize: 15.5,
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },
  registerWrap: {
    alignItems: "center",
    marginTop: 22,
  },
  registerPrompt: {
    fontFamily: "Outfit",
    fontSize: 13,
    color: "#6B7280",
  },
  registerLink: {
    fontFamily: "Outfit-Bold",
    color: "#2D7D5A",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(17, 24, 39, 0.45)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 22,
  },
  modalCard: {
    width: "100%",
    maxWidth: 328,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 20,
    alignItems: "center",
    shadowColor: "#000000",
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  modalIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#EAF6EE",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  modalTitle: {
    color: "#111827",
    fontSize: 18,
    fontFamily: "Outfit-Bold",
    marginBottom: 8,
  },
  modalBody: {
    color: "#6B7280",
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    marginBottom: 18,
  },
  modalActions: {
    flexDirection: "row",
    columnGap: 10,
    width: "100%",
  },
  modalCancelBtn: {
    flex: 1,
    height: 42,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  modalCancelText: {
    color: "#4B5563",
    fontSize: 13.5,
    fontFamily: "Outfit-SemiBold",
  },
  modalConfirmBtn: {
    flex: 1,
    height: 42,
    borderRadius: 12,
    backgroundColor: "#2D7D5A",
    alignItems: "center",
    justifyContent: "center",
  },
  modalConfirmText: {
    color: "#FFFFFF",
    fontSize: 13.5,
    fontFamily: "Outfit-SemiBold",
  },
});



