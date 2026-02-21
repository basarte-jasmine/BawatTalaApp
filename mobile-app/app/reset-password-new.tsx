import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { FormTextInput } from "../components/forms/FormTextInput";
import { PasswordField } from "../components/forms/PasswordField";
import { AuthCardLayout } from "../components/layout/AuthCardLayout";
import { AppPrimaryButton } from "../components/ui/AppPrimaryButton";

export default function ResetPasswordNewScreen() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  return (
    <AuthCardLayout contentContainerStyle={styles.content} cardStyle={styles.card}>
      <Text style={styles.title}>Reset your password</Text>
      <Text style={styles.subtitle}>Enter and confirm your new password below.</Text>

      <FormTextInput
        label="Enter your new password"
        value={newPassword}
        onChangeText={setNewPassword}
        secureTextEntry
        placeholder="******"
        placeholderTextColor="#8D8D8D"
        labelStyle={styles.label}
      />

      <PasswordField
        label="Confirm your new password"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        showPassword={showConfirmPassword}
        onToggleVisibility={() => setShowConfirmPassword((prev) => !prev)}
        placeholder="******"
        placeholderTextColor="#8D8D8D"
        containerStyle={styles.passwordContainer}
        inputWrapStyle={styles.passwordWrap}
        inputStyle={styles.passwordInput}
      />

      <AppPrimaryButton
        label="Reset Password"
        onPress={() => router.replace("/login")}
        containerStyle={styles.actionButton}
      />

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
    marginBottom: 34,
  },
  label: {
    color: "#111111",
    fontSize: 14,
  },
  passwordContainer: {
    marginBottom: 0,
  },
  passwordWrap: {
    marginBottom: 58,
  },
  passwordInput: {
    fontSize: 14,
    color: "#111111",
  },
  actionButton: {
    marginBottom: 16,
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
