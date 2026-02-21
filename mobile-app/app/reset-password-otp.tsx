import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { FormTextInput } from "../components/forms/FormTextInput";
import { AuthCardLayout } from "../components/layout/AuthCardLayout";
import { AppPrimaryButton } from "../components/ui/AppPrimaryButton";

export default function ResetPasswordOtpScreen() {
  const [otpCode, setOtpCode] = useState("");

  return (
    <AuthCardLayout contentContainerStyle={styles.content} cardStyle={styles.card}>
      <Text style={styles.title}>Enter verification code</Text>
      <Text style={styles.subtitle}>
        We sent a 6-digit code to the email linked to your account.
      </Text>

      <FormTextInput
        label="Verification Code"
        value={otpCode}
        onChangeText={setOtpCode}
        placeholder="123456"
        placeholderTextColor="#8D8D8D"
        keyboardType="number-pad"
        maxLength={6}
        labelStyle={styles.label}
        inputStyle={styles.input}
      />

      <AppPrimaryButton
        label="Verify Code"
        onPress={() => router.push("/reset-password-new")}
        containerStyle={styles.actionButton}
      />

      <Pressable style={styles.linkButton}>
        <Text style={styles.linkText}>Didn&apos;t get a code? <Text style={styles.linkAccent}>Resend</Text></Text>
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
  input: {
    letterSpacing: 2,
  },
  actionButton: {
    marginTop: 24,
    marginBottom: 16,
  },
  linkButton: {
    alignItems: "center",
  },
  linkText: {
    color: "#111111",
    fontSize: 13,
  },
  linkAccent: {
    color: "#2C7DB0",
  },
});
