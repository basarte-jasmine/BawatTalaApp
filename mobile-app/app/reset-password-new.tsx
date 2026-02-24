import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { PasswordField } from "../components/forms/PasswordField";
import { AuthCardLayout } from "../components/layout/AuthCardLayout";
import { AppPrimaryButton } from "../components/ui/AppPrimaryButton";
import { forgotPasswordReset } from "../lib/backend-api";

const STRONG_PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;

export default function ResetPasswordNewScreen() {
  const params = useLocalSearchParams<{ studentId?: string }>();
  const studentId = String(params.studentId || "").trim();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  const handleResetPassword = async () => {
    if (!newPassword) {
      setErrorMessage("New password is required");
      return;
    }
    if (!STRONG_PASSWORD_PATTERN.test(newPassword)) {
      setErrorMessage(
        "Password must be at least 8 characters and include uppercase, lowercase, number, and symbol.",
      );
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
      router.replace("/login");
    }, 1200);
  };

  return (
    <AuthCardLayout contentContainerStyle={styles.content} cardStyle={styles.card}>
      <Text style={styles.title}>Reset your password</Text>
      <Text style={styles.subtitle}>Enter and confirm your new password below.</Text>

      <PasswordField
        label="Enter your new password"
        value={newPassword}
        onChangeText={setNewPassword}
        showPassword={showNewPassword}
        onToggleVisibility={() => setShowNewPassword((prev) => !prev)}
        placeholder="Enter new password"
        placeholderTextColor="#8D8D8D"
        containerStyle={styles.passwordContainer}
        inputWrapStyle={styles.passwordWrap}
        inputStyle={styles.passwordInput}
      />

      <PasswordField
        label="Confirm your new password"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        showPassword={showConfirmPassword}
        onToggleVisibility={() => setShowConfirmPassword((prev) => !prev)}
        placeholder="Confirm new password"
        placeholderTextColor="#8D8D8D"
        containerStyle={styles.passwordContainer}
        inputWrapStyle={styles.passwordWrap}
        inputStyle={styles.passwordInput}
      />

      <AppPrimaryButton
        label={isBusy ? "Updating..." : "Reset Password"}
        onPress={handleResetPassword}
        containerStyle={styles.actionButton}
      />

      {!!errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}
      {!!successMessage && <Text style={styles.successText}>{successMessage}</Text>}

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
    fontSize: 20,
    lineHeight: 26,
    fontFamily: "Fraunces-Regular",
    marginBottom: 8,
  },
  subtitle: {
    textAlign: "center",
    color: "#1A1A1A",
    fontSize: 13,
    marginBottom: 26,
  },
  passwordContainer: {
    marginBottom: 0,
  },
  passwordWrap: {
    marginBottom: 12,
  },
  passwordInput: {
    fontSize: 14,
    color: "#111111",
  },
  actionButton: {
    marginTop: 8,
    marginBottom: 12,
  },
  errorText: {
    color: "#C31A1A",
    fontSize: 12,
    marginBottom: 8,
  },
  successText: {
    color: "#16803A",
    fontSize: 12,
    marginBottom: 8,
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
