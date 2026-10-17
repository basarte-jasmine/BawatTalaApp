import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useRef, useState } from "react";
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
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import { useAuthSession } from "../lib/auth-session";
import {
  AUTH_MESSAGES,
  isValidStudentId,
  normalizeStudentIdInput,
} from "../lib/auth-validation";
import { loginWithStudentId } from "../lib/backend-api";

const APP_MAX_WIDTH = 412;

function LoginBackdrop({ height, width }: { height: number; width: number }) {
  const sceneWidth = Math.min(width && width > 0 ? width : APP_MAX_WIDTH, APP_MAX_WIDTH);
  const sceneHeight = Math.max(height && height > 0 ? height : 760, 700);
  const meadowTop = sceneHeight - 160;

  return (
    <Svg
      style={styles.backdropSvg}
      width={sceneWidth}
      height={sceneHeight}
      viewBox={`0 0 ${sceneWidth} ${sceneHeight}`}
    >
      <Defs>
        <LinearGradient id="loginSky" x1="0" x2="0" y1="0" y2="1">
          <Stop offset="0" stopColor="#F8FFF8" />
          <Stop offset="0.55" stopColor="#EEF8F2" />
          <Stop offset="1" stopColor="#E2F2E9" />
        </LinearGradient>
        <LinearGradient id="meadowGradient" x1="0" x2="1" y1="0" y2="1">
          <Stop offset="0" stopColor="#A8E2D6" />
          <Stop offset="0.5" stopColor="#87D4A2" />
          <Stop offset="1" stopColor="#F5DC8C" />
        </LinearGradient>
      </Defs>
      <Rect width={sceneWidth} height={sceneHeight} fill="url(#loginSky)" />
      <Path
        d={`M0 ${meadowTop + 36} C ${sceneWidth * 0.22} ${meadowTop - 12}, ${sceneWidth * 0.52} ${
          meadowTop + 48
        }, ${sceneWidth * 0.76} ${meadowTop + 14} C ${sceneWidth * 0.88} ${meadowTop - 6}, ${
          sceneWidth * 0.95
        } ${meadowTop + 18}, ${sceneWidth} ${meadowTop + 6} L ${sceneWidth} ${sceneHeight} L 0 ${sceneHeight} Z`}
        fill="#D6EDE2"
        opacity={0.6}
      />
      <Path
        d={`M0 ${meadowTop + 68} C ${sceneWidth * 0.2} ${meadowTop + 28}, ${sceneWidth * 0.44} ${
          meadowTop + 80
        }, ${sceneWidth * 0.68} ${meadowTop + 42} C ${sceneWidth * 0.84} ${meadowTop + 22}, ${
          sceneWidth * 0.94
        } ${meadowTop + 50}, ${sceneWidth} ${meadowTop + 32} L ${sceneWidth} ${sceneHeight} L 0 ${sceneHeight} Z`}
        fill="url(#meadowGradient)"
        opacity={0.3}
      />
      {/* Whimsical star sparkles */}
      <Path
        d="M32 90 L36 100 L47 104 L36 108 L32 118 L28 108 L17 104 L28 100 Z"
        fill="#F3C94D"
        opacity={0.4}
      />
      <Path
        d={`M${sceneWidth - 42} 118 L${sceneWidth - 38} 126 L${sceneWidth - 30} 129 L${sceneWidth - 38} 132 L${
          sceneWidth - 42
        } 140 L${sceneWidth - 46} 132 L${sceneWidth - 54} 129 L${sceneWidth - 46} 126 Z`}
        fill="#55B8A8"
        opacity={0.42}
      />
      <Path
        d={`M${sceneWidth - 84} 64 L${sceneWidth - 81} 70 L${sceneWidth - 75} 73 L${sceneWidth - 81} 76 L${
          sceneWidth - 84
        } 82 L${sceneWidth - 87} 76 L${sceneWidth - 93} 73 L${sceneWidth - 87} 70 Z`}
        fill="#F1A95D"
        opacity={0.32}
      />
      <Path
        d="M48 220 L51 225 L56 227 L51 229 L48 234 L45 229 L40 227 L45 225 Z"
        fill="#72C785"
        opacity={0.32}
      />
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
    return "Unstable internet connection. Please check your network and try again.";
  }

  return "Invalid Student ID or password.";
}

export default function LoginScreen() {
  const { setUser } = useAuthSession();
  const { height, width } = useWindowDimensions();
  const [studentId, setStudentId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState<"studentId" | "password" | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [reactivationPrompt, setReactivationPrompt] = useState<{
    message?: string;
    scheduledDeletionAt?: string;
  } | null>(null);

  const passwordInputRef = useRef<TextInput>(null);

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

    setReactivationPrompt(null);
    setUser(result.user);
    router.replace({ pathname: "/studio", params: { welcome: "1" } });
  };

  const frameWidth = Math.min(width, APP_MAX_WIDTH);

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
    >
      <LoginBackdrop height={height} width={frameWidth} />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.topNav}>
          <Pressable
            style={styles.backButton}
            onPress={() => (router.canGoBack() ? router.back() : router.replace("/auth-choice"))}
            disabled={isBusy}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={20} color="#213A35" />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Brand Header */}
          <View style={styles.headerArea}>
            <View style={styles.logoBadge}>
              <Image
                source={require("../assets/images/Logo_BT.png")}
                style={styles.logo}
                contentFit="contain"
              />
            </View>
            <Text style={styles.title}>Welcome Back</Text>
            <Text style={styles.subtitle}>
              Sign in to continue your reflection journey and find your daily calm.
            </Text>
          </View>

          {/* Form Card */}
          <View style={styles.formCard}>
            {/* Student ID Field */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>
                Student ID <Text style={styles.requiredAsterisk}>*</Text>
              </Text>
              <View
                style={[
                  styles.inputWrapper,
                  focusedField === "studentId" && styles.inputWrapperFocused,
                ]}
              >
                <Ionicons
                  name="card-outline"
                  size={19}
                  color={focusedField === "studentId" ? "#2D7D5A" : "#728B81"}
                  style={styles.fieldIcon}
                />
                <TextInput
                  value={studentId}
                  onChangeText={(text) => {
                    setStudentId(text);
                    if (errorMessage) setErrorMessage("");
                  }}
                  placeholder="(e.g. 23-2903)"
                  placeholderTextColor="#96ACA2"
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
                    accessibilityLabel="Clear student ID"
                  >
                    <Ionicons name="close-circle" size={17} color="#9DB1A7" />
                  </Pressable>
                )}
              </View>
            </View>

            {/* Password Field */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>
                Password <Text style={styles.requiredAsterisk}>*</Text>
              </Text>
              <View
                style={[
                  styles.inputWrapper,
                  focusedField === "password" && styles.inputWrapperFocused,
                ]}
              >
                <Ionicons
                  name="lock-closed-outline"
                  size={19}
                  color={focusedField === "password" ? "#2D7D5A" : "#728B81"}
                  style={styles.fieldIcon}
                />
                <TextInput
                  ref={passwordInputRef}
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    if (errorMessage) setErrorMessage("");
                  }}
                  placeholder="Enter your password"
                  placeholderTextColor="#96ACA2"
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
                  hitSlop={8}
                  style={styles.eyeBtn}
                  accessibilityRole="button"
                  accessibilityLabel={showPassword ? "Hide password" : "Show password"}
                >
                  <Ionicons
                    name={showPassword ? "eye-off-outline" : "eye-outline"}
                    size={20}
                    color="#657F75"
                  />
                </Pressable>
              </View>
            </View>

            {/* Forgot Password Link */}
            <Pressable
              style={[styles.forgotWrap, isBusy && styles.disabledLink]}
              disabled={isBusy}
              onPress={() => router.push("/reset-password")}
              hitSlop={8}
            >
              <Text style={styles.forgotText}>Forgot Password?</Text>
            </Pressable>

            {/* Error Banner */}
            {!!errorMessage && (
              <View style={styles.errorBanner}>
                <Ionicons
                  name="alert-circle"
                  size={18}
                  color="#DC2626"
                  style={styles.errorIcon}
                />
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            )}

            {/* Primary Log In Button */}
            <Pressable
              style={[styles.loginButton, isBusy && styles.loginButtonDisabled]}
              onPress={handleLogin}
              disabled={isBusy}
              accessibilityRole="button"
              accessibilityState={{ disabled: isBusy, busy: isBusy }}
            >
              {isBusy ? (
                <View style={styles.buttonInner}>
                  <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={styles.loginButtonText}>Logging in...</Text>
                </View>
              ) : (
                <View style={styles.buttonInner}>
                  <Text style={styles.loginButtonText}>Log In</Text>
                  <Ionicons name="arrow-forward" size={17} color="#FFFFFF" style={{ marginLeft: 6 }} />
                </View>
              )}
            </Pressable>

            {/* Elegant Divider */}
            <View style={styles.orRow}>
              <View style={styles.orLine} />
              <View style={styles.orBadge}>
                <Text style={styles.orBadgeText}>or</Text>
              </View>
              <View style={styles.orLine} />
            </View>

            {/* Create Account Secondary Button */}
            <View style={styles.registerSection}>
              <Text style={styles.registerPrompt}>New to Bawat Tala?</Text>
              <Pressable
                style={[styles.registerOutlineBtn, isBusy && styles.disabledLink]}
                disabled={isBusy}
                onPress={() => router.push("/register")}
                accessibilityRole="button"
              >
                <Ionicons name="sparkles-outline" size={16} color="#2D7D5A" style={{ marginRight: 6 }} />
                <Text style={styles.registerOutlineBtnText}>Create Student Account</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>

      {/* Reactivation Modal */}
      <Modal
        visible={Boolean(reactivationPrompt)}
        transparent
        animationType="fade"
        onRequestClose={() => setReactivationPrompt(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconWrap}>
              <Ionicons name="shield-checkmark-outline" size={32} color="#2D7D5A" />
            </View>
            <Text style={styles.modalTitle}>Reactivate Account?</Text>
            <Text style={styles.modalBody}>
              Your account is currently scheduled for deletion. Would you like to cancel deletion and reactivate your account?
            </Text>
            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalSecondaryButton}
                onPress={() => setReactivationPrompt(null)}
                disabled={isBusy}
              >
                <Text style={styles.modalSecondaryText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={styles.modalPrimaryButton}
                onPress={() => void handleConfirmReactivation()}
                disabled={isBusy}
              >
                <Text style={styles.modalPrimaryText}>
                  {isBusy ? "Reactivating..." : "Reactivate"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F8FFF8",
  },
  backdropSvg: {
    ...StyleSheet.absoluteFillObject,
    pointerEvents: "none",
  },
  safeArea: {
    flex: 1,
  },
  topNav: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255, 255, 255, 0.85)",
    borderWidth: 1,
    borderColor: "#E0EBE4",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#224A38",
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 22,
    paddingBottom: 36,
    justifyContent: "center",
  },
  headerArea: {
    alignItems: "center",
    marginBottom: 20,
  },
  logoBadge: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#DCF0E5",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
    shadowColor: "#2D7D5A",
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  logo: {
    width: 56,
    height: 56,
  },
  title: {
    fontFamily: "Outfit-Bold",
    fontSize: 27,
    lineHeight: 33,
    color: "#1B362C",
    textAlign: "center",
    letterSpacing: -0.3,
  },
  subtitle: {
    fontFamily: "Outfit-Regular",
    fontSize: 13.5,
    lineHeight: 19,
    color: "#56706A",
    textAlign: "center",
    marginTop: 6,
    paddingHorizontal: 16,
  },
  formCard: {
    width: "100%",
    maxWidth: 368,
    alignSelf: "center",
    backgroundColor: "rgba(255, 255, 255, 0.94)",
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: "rgba(216, 238, 226, 0.9)",
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 22,
    shadowColor: "#224A38",
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  fieldGroup: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontFamily: "Outfit-SemiBold",
    fontSize: 13,
    lineHeight: 18,
    color: "#203B32",
    marginBottom: 6,
  },
  requiredAsterisk: {
    color: "#D94F4F",
    fontWeight: "700",
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    height: 48,
    borderRadius: 14,
    backgroundColor: "#F7FAF8",
    borderWidth: 1.5,
    borderColor: "#DCE7E1",
    paddingHorizontal: 12,
  },
  inputWrapperFocused: {
    borderColor: "#2D7D5A",
    backgroundColor: "#FFFFFF",
    shadowColor: "#2D7D5A",
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  fieldIcon: {
    marginRight: 9,
  },
  textInput: {
    flex: 1,
    height: "100%",
    fontFamily: "Outfit",
    fontSize: 14,
    color: "#183228",
    paddingVertical: 0,
    ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : {}),
  },
  clearBtn: {
    padding: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  eyeBtn: {
    padding: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  forgotWrap: {
    alignSelf: "flex-end",
    marginTop: -4,
    marginBottom: 16,
  },
  forgotText: {
    fontFamily: "Outfit-SemiBold",
    fontSize: 12.5,
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
    marginBottom: 14,
  },
  errorIcon: {
    marginRight: 8,
  },
  errorText: {
    flex: 1,
    fontFamily: "Outfit-Medium",
    fontSize: 12.5,
    lineHeight: 17,
    color: "#991B1B",
  },
  loginButton: {
    height: 48,
    borderRadius: 14,
    backgroundColor: "#2D7D5A",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#1B523A",
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  loginButtonDisabled: {
    opacity: 0.65,
  },
  buttonInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  loginButtonText: {
    fontFamily: "Outfit-Bold",
    fontSize: 15,
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },
  orRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 16,
  },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#E2ECE7",
  },
  orBadge: {
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: "#F0F5F2",
    marginHorizontal: 8,
  },
  orBadgeText: {
    fontFamily: "Outfit-Medium",
    fontSize: 11.5,
    color: "#728B81",
  },
  registerSection: {
    alignItems: "center",
  },
  registerPrompt: {
    fontFamily: "Outfit-Regular",
    fontSize: 12.5,
    color: "#6B847A",
    marginBottom: 8,
  },
  registerOutlineBtn: {
    width: "100%",
    height: 44,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#2D7D5A",
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  registerOutlineBtnText: {
    fontFamily: "Outfit-Bold",
    fontSize: 13.5,
    color: "#2D7D5A",
  },
  disabledLink: {
    opacity: 0.5,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(18, 30, 24, 0.48)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 22,
  },
  modalCard: {
    width: "100%",
    maxWidth: 328,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 20,
    alignItems: "center",
    shadowColor: "#1B362C",
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  modalIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#EAF6EE",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  modalTitle: {
    color: "#1B2E24",
    fontSize: 19,
    fontFamily: "Outfit-Bold",
    textAlign: "center",
    marginBottom: 8,
  },
  modalBody: {
    color: "#52606C",
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
  modalSecondaryButton: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#F2F5F3",
    alignItems: "center",
    justifyContent: "center",
  },
  modalSecondaryText: {
    color: "#566271",
    fontSize: 13.5,
    fontFamily: "Outfit-Bold",
  },
  modalPrimaryButton: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#2D7D5A",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#1B523A",
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  modalPrimaryText: {
    color: "#FFFFFF",
    fontSize: 13.5,
    fontFamily: "Outfit-Bold",
  },
});
