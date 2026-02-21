import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { FormTextInput } from "../components/forms/FormTextInput";
import { AuthCardLayout } from "../components/layout/AuthCardLayout";
import { AppPrimaryButton } from "../components/ui/AppPrimaryButton";

export default function ResetPasswordScreen() {
  const [studentId, setStudentId] = useState("");
  const [birthdate, setBirthdate] = useState("");

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
        placeholder="xx-xxxx"
        placeholderTextColor="#8D8D8D"
        autoCapitalize="none"
        labelStyle={styles.label}
      />

      <FormTextInput
        label="Birthdate"
        value={birthdate}
        onChangeText={setBirthdate}
        placeholder="MM/DD/YYYY"
        placeholderTextColor="#8D8D8D"
        labelStyle={styles.label}
      />

      <AppPrimaryButton
        label="Confirm Account"
        onPress={() => router.push("/reset-password-otp")}
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
    lineHeight: 20,
    marginBottom: 30,
  },
  label: {
    color: "#111111",
    fontSize: 14,
  },
  actionButton: {
    marginTop: 24,
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
