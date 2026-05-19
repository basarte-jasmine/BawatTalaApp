import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { FormTextInput } from "../components/forms/FormTextInput";
import { AuthCardLayout } from "../components/layout/AuthCardLayout";
import { AppPrimaryButton } from "../components/ui/AppPrimaryButton";
import { forgotPasswordSendCode } from "../lib/backend-api";
import { useAuthSession } from "../lib/auth-session";
import {
  AUTH_MESSAGES,
  isValidStudentId,
  normalizeStudentIdInput,
} from "../lib/auth-validation";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmailInput(value: string) {
  return value.trim().toLowerCase();
}

export default function ResetPasswordScreen() {
  const { user } = useAuthSession();
  const [studentId, setStudentId] = useState("");
  const [email, setEmail] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);

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
        studentId: studentNumber,
      },
    });
  };

  const handleReturn = () => {
    router.replace(user ? "/profile" : "/login");
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

      <FormTextInput
        label="Email"
        value={email}
        onChangeText={setEmail}
        placeholder="Enter your account email"
        placeholderTextColor="#8D8D8D"
        autoCapitalize="none"
        keyboardType="email-address"
        labelStyle={styles.label}
      />

      <AppPrimaryButton
        label={isBusy ? "Confirming..." : "Confirm Account"}
        onPress={handleConfirmAccount}
        containerStyle={styles.actionButton}
      />

      {!!errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}

      <Pressable style={styles.backToLogin} onPress={handleReturn}>
        <Text style={styles.backText}>
          Go back to <Text style={styles.backLink}>{user ? "profile page" : "login page"}</Text>
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
    fontSize: 20,
    lineHeight: 28,
    fontFamily: "Outfit",
    fontWeight: "700",
    marginBottom: 8,
  },
  subtitle: {
    textAlign: "center",
    color: "#1A1A1A",
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 24,
  },
  label: {
    color: "#111111",
    fontSize: 12,
  },
  actionButton: {
    marginTop: 18,
    marginBottom: 14,
  },
  errorText: {
    color: "#C31A1A",
    fontSize: 11,
    marginBottom: 12,
  },
  backToLogin: {
    alignItems: "center",
  },
  backText: {
    color: "#111111",
    fontSize: 11,
  },
  backLink: {
    color: "#2C7DB0",
  },
});
