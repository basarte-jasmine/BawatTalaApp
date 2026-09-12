import { router } from "expo-router";
import { useState } from "react";
import { Alert, Image, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { FormTextInput } from "../components/forms/FormTextInput";
import { PasswordField } from "../components/forms/PasswordField";
import { AuthCardLayout } from "../components/layout/AuthCardLayout";
import { AppPrimaryButton } from "../components/ui/AppPrimaryButton";
import { loginWithStudentId } from "../lib/backend-api";
import {
  AUTH_MESSAGES,
  isValidStudentId,
  normalizeStudentIdInput } from "../lib/auth-validation";
import { useAuthSession } from "../lib/auth-session";

function getLoginErrorMessage(message?: string) {
  const normalized = String(message || "").toLowerCase();

  if (normalized.includes("verify")) {
    return "Please verify your account before logging in.";
  }
  if (normalized.includes("too many")) {
    return "Too many login attempts. Please try again later.";
  }
  if (normalized.includes("server") || normalized.includes("connection") || normalized.includes("network")) {
    return "We could not connect right now. Please try again.";
  }

  return "Invalid Student ID or password.";
}

export default function LoginScreen() {
  const { setUser } = useAuthSession();
  const [studentId, setStudentId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [reactivationPrompt, setReactivationPrompt] = useState<{ message?: string; scheduledDeletionAt?: string } | null>(null);

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

  return (
    <AuthCardLayout contentContainerStyle={styles.scrollContent} cardStyle={styles.card}>
      <Image source={require("../assets/images/BT_Logo.png")} style={styles.logo} resizeMode="contain" />
      <Text style={styles.title}>Welcome!</Text>
      <Text style={styles.subtitle}>
        Log in to your account to start journaling{"\n"}and track your progress.
      </Text>

      <FormTextInput
        label="Student ID"
        value={studentId}
        onChangeText={setStudentId}
        placeholder="(e.g. 23-2903)"
        placeholderTextColor="#8D8D8D"
        autoCapitalize="none"
        editable={!isBusy}
        labelStyle={styles.label}
        inputStyle={styles.input}
      />

      <PasswordField
        label="Password"
        value={password}
        onChangeText={setPassword}
        showPassword={showPassword}
        onToggleVisibility={() => setShowPassword((prev) => !prev)}
        editable={!isBusy}
        containerStyle={styles.passwordContainer}
        inputWrapStyle={styles.passwordWrap}
        inputStyle={styles.passwordInput}
      />

      <Pressable style={[styles.forgotWrap, isBusy && styles.disabledLink]} disabled={isBusy} onPress={() => router.push("/reset-password")}>
        <Text style={styles.forgotText}>Forgot Password?</Text>
      </Pressable>

      <AppPrimaryButton
        label={isBusy ? "Logging in..." : "Login"}
        loading={isBusy}
        disabled={isBusy}
        onPress={handleLogin}
        containerStyle={styles.loginButton}
        labelStyle={styles.loginButtonText}
      />

      {!!errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}

      <View style={styles.orRow}>
        <View style={styles.orLine} />
        <Text style={styles.orText}>OR</Text>
        <View style={styles.orLine} />
      </View>

      <Pressable style={[styles.registerWrap, isBusy && styles.disabledLink]} disabled={isBusy} onPress={() => router.push("/register")}>
        <Text style={styles.registerText}>
          Don&apos;t have an account? <Text style={styles.registerLink}>Register</Text>
        </Text>
      </Pressable>
      <Modal
        visible={Boolean(reactivationPrompt)}
        transparent
        animationType="fade"
        onRequestClose={() => setReactivationPrompt(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
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
                <Text style={styles.modalPrimaryText}>{isBusy ? "Reactivating..." : "Reactivate"}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </AuthCardLayout>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    justifyContent: "center",
    paddingHorizontal: 26,
    paddingVertical: 28 },
  card: {
    maxWidth: 320 },
  logo: {
    width: 72,
    height: 72,
    alignSelf: "center",
    marginBottom: 12 },
  title: {
    textAlign: "center",
    fontSize: 23,
    lineHeight: 30,
    color: "#111111",

    fontFamily: "Outfit-Bold",
    marginBottom: 4 },
  subtitle: {
    textAlign: "center",
    fontSize: 12,
    lineHeight: 18,
    color: "#1B1B1B",
    marginBottom: 18 },
  label: {
    fontSize: 12,
    lineHeight: 16,
    color: "#1A1A1A" },
  input: {
    fontSize: 13,
    color: "#111111",
    marginBottom: 10 },
  passwordContainer: {
    marginBottom: 0 },
  passwordWrap: {
    minHeight: 38,
    borderRadius: 7,
    marginBottom: 0 },
  passwordInput: {
    fontSize: 13,
    color: "#111111",
    paddingVertical: 8,
    textAlignVertical: "center" },
  forgotWrap: {
    alignSelf: "flex-start",
    marginBottom: 18,
    marginTop: -2 },
  forgotText: {
    color: "#2C7DB0",
    fontSize: 11 },
  loginButton: {
    marginBottom: 10 },
  loginButtonText: {
    fontSize: 13,
    fontFamily: "Outfit-Bold" },
  errorText: {
    color: "#C31A1A",
    fontSize: 11,
    marginBottom: 10 },
  orRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10 },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#BEBEBE" },
  orText: {
    marginHorizontal: 10,
    color: "#555555",
    fontSize: 11,
    fontFamily: "Outfit-SemiBold" },
  registerWrap: {
    alignItems: "center" },
  registerText: {
    color: "#2A2A2A",
    fontSize: 11 },
  registerLink: {
    color: "#2C7DB0" },
  disabledLink: {
    opacity: 0.5 }
,  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(21, 27, 24, 0.44)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 22,
  },
  modalCard: {
    width: "100%",
    maxWidth: 320,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 18,
    shadowColor: "#5F695D",
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  modalTitle: {
    color: "#1B2E24",
    fontSize: 18,
    fontFamily: "Outfit-Bold",
    textAlign: "center",
    marginBottom: 8,
  },
  modalBody: {
    color: "#52606C",
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: "row",
    columnGap: 10,
  },
  modalSecondaryButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 999,
    backgroundColor: "#F2F5F3",
    alignItems: "center",
    justifyContent: "center",
  },
  modalSecondaryText: {
    color: "#566271",
    fontSize: 13,
    fontFamily: "Outfit-Bold",
  },
  modalPrimaryButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 999,
    backgroundColor: "#79C943",
    alignItems: "center",
    justifyContent: "center",
  },
  modalPrimaryText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontFamily: "Outfit-Bold",
  },});
