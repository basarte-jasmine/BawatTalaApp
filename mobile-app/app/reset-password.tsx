import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { FormTextInput } from "../components/forms/FormTextInput";
import { PasswordField } from "../components/forms/PasswordField";
import { AuthCardLayout } from "../components/layout/AuthCardLayout";
import { AppPrimaryButton } from "../components/ui/AppPrimaryButton";
import { forgotPasswordSendCode } from "../lib/backend-api";
import {
  AUTH_MESSAGES,
  isValidStudentId,
  normalizeStudentIdInput,
} from "../lib/auth-validation";

export default function ResetPasswordScreen() {
  const [studentId, setStudentId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  const handleConfirmAccount = async () => {
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
    const result = await forgotPasswordSendCode(studentNumber, passwordValue);
    setIsBusy(false);

    if (!result.ok) {
      setErrorMessage(result.message ?? "The account could not be verified. Please check your details.");
      return;
    }

    router.push({
      pathname: "/reset-password-otp",
      params: { studentId: studentNumber },
    });
  };

  return (
    <AuthCardLayout contentContainerStyle={styles.content} cardStyle={styles.card}>
      <Text style={styles.title}>Confirm your account</Text>
      <Text style={styles.subtitle}>
        Enter your details. We&apos;ll send a one-time code to the email linked to your account.
      </Text>

      <FormTextInput
        label="Student ID"
        value={studentId}
        onChangeText={setStudentId}
        placeholder="(e.g. 23-2903)"
        placeholderTextColor="#8D8D8D"
        autoCapitalize="none"
        labelStyle={styles.label}
      />

      <PasswordField
        label="Password"
        value={password}
        onChangeText={setPassword}
        showPassword={showPassword}
        onToggleVisibility={() => setShowPassword((prev) => !prev)}
        placeholder="Enter your password"
        placeholderTextColor="#8D8D8D"
        containerStyle={styles.passwordContainer}
        inputWrapStyle={styles.passwordWrap}
        inputStyle={styles.passwordInput}
      />

      <AppPrimaryButton
        label={isBusy ? "Confirming..." : "Confirm Account"}
        onPress={handleConfirmAccount}
        containerStyle={styles.actionButton}
      />

      {!!errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}

      <Pressable style={styles.backToLogin} onPress={() => router.replace("/login")}>
        <Text style={styles.backText}>
          Go back to <Text style={styles.backLink}>login page</Text>
        </Text>
      </Pressable>
    </AuthCardLayout>
  );
}

const styles = StyleSheet.create({
  content: {
    justifyContent: "center",
  },
  card: {
    maxWidth: 320,
  },
  title: {
    textAlign: "center",
    color: "#111111",
    fontSize: 40 / 2,
    lineHeight: 26,
    fontFamily: "Fraunces-Regular",
    marginBottom: 8,
  },
  subtitle: {
    textAlign: "center",
    color: "#1A1A1A",
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 30,
  },
  label: {
    color: "#111111",
    fontSize: 14,
  },
  passwordContainer: {
    marginBottom: 0,
  },
  passwordWrap: {
    marginBottom: 0,
  },
  passwordInput: {
    fontSize: 14,
    color: "#111111",
  },
  actionButton: {
    marginTop: 24,
    marginBottom: 16,
  },
  errorText: {
    color: "#C31A1A",
    fontSize: 12,
    marginBottom: 12,
  },
  backToLogin: {
    alignItems: "center",
  },
  backText: {
    color: "#111111",
    fontSize: 13,
  },
  backLink: {
    color: "#2C7DB0",
  },
});
