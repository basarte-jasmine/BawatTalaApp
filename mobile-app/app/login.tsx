import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { FormTextInput } from "../components/forms/FormTextInput";
import { PasswordField } from "../components/forms/PasswordField";
import { AuthCardLayout } from "../components/layout/AuthCardLayout";
import { AppPrimaryButton } from "../components/ui/AppPrimaryButton";

export default function LoginScreen() {
  const [studentId, setStudentId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  return (
    <AuthCardLayout contentContainerStyle={styles.scrollContent} cardStyle={styles.card}>
      <Text style={styles.title}>Welcome!</Text>
      <Text style={styles.subtitle}>
        Log in to your account to start journaling{"\n"}and track your progress.
      </Text>

      <FormTextInput
        label="Student ID"
        value={studentId}
        onChangeText={setStudentId}
        placeholder="xx-xxxx"
        placeholderTextColor="#8D8D8D"
        autoCapitalize="none"
        labelStyle={styles.label}
        inputStyle={styles.input}
      />

      <PasswordField
        label="Password or Birthdate"
        value={password}
        onChangeText={setPassword}
        showPassword={showPassword}
        onToggleVisibility={() => setShowPassword((prev) => !prev)}
        placeholder="MM/DD/YYYY"
        placeholderTextColor="#8D8D8D"
        containerStyle={styles.passwordContainer}
        inputWrapStyle={styles.passwordWrap}
        inputStyle={styles.passwordInput}
      />

      <Pressable style={styles.forgotWrap} onPress={() => router.push("/reset-password")}>
        <Text style={styles.forgotText}>Forgot Password?</Text>
      </Pressable>

      <AppPrimaryButton
        label="Login"
        onPress={() => router.replace("/home")}
        containerStyle={styles.loginButton}
        labelStyle={styles.loginButtonText}
      />

      <View style={styles.orRow}>
        <View style={styles.orLine} />
        <Text style={styles.orText}>OR</Text>
        <View style={styles.orLine} />
      </View>

      <Pressable style={styles.googleButton}>
        <Text style={styles.googleText}>
          Sign up with <Text style={styles.googleG}>G</Text>
        </Text>
      </Pressable>

      <Pressable style={styles.registerWrap} onPress={() => router.push("/register")}>
        <Text style={styles.registerText}>
          Don&apos;t have an account? <Text style={styles.registerLink}>Register</Text>
        </Text>
      </Pressable>
    </AuthCardLayout>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 28,
  },
  card: {
    maxWidth: 320,
  },
  title: {
    textAlign: "center",
    fontSize: 38 / 2,
    lineHeight: 24,
    color: "#111111",
    fontFamily: "Fraunces-Regular",
    marginBottom: 8,
  },
  subtitle: {
    textAlign: "center",
    fontSize: 22 / 2,
    lineHeight: 15,
    color: "#1B1B1B",
    marginBottom: 26,
  },
  label: {
    fontSize: 22 / 2,
    lineHeight: 16,
    color: "#1A1A1A",
  },
  input: {
    fontSize: 14,
    color: "#111111",
    marginBottom: 8,
  },
  passwordContainer: {
    marginBottom: 0,
  },
  passwordWrap: {
    height: 42 / 2,
    borderRadius: 6,
    marginBottom: 0,
  },
  passwordInput: {
    paddingHorizontal: 10,
    fontSize: 10,
    color: "#111111",
  },
  forgotWrap: {
    alignSelf: "flex-start",
    marginBottom: 16,
  },
  forgotText: {
    color: "#2C7DB0",
    fontSize: 11,
  },
  loginButton: {
    height: 25,
    marginBottom: 12,
    shadowRadius: 3,
    elevation: 4,
  },
  loginButtonText: {
    fontSize: 13,
    fontWeight: "700",
  },
  orRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#BEBEBE",
  },
  orText: {
    marginHorizontal: 10,
    color: "#555555",
    fontSize: 10,
    fontWeight: "600",
  },
  googleButton: {
    width: 290,
    alignSelf: "center",
    height: 25,
    borderRadius: 999,
    backgroundColor: "#E8ECEF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    shadowColor: "#99A2AB",
    shadowOpacity: 0.28,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  googleText: {
    color: "#434343",
    fontSize: 13,
    fontWeight: "500",
  },
  googleG: {
    color: "#4285F4",
    fontWeight: "700",
  },
  registerWrap: {
    alignItems: "center",
  },
  registerText: {
    color: "#2A2A2A",
    fontSize: 11,
  },
  registerLink: {
    color: "#2C7DB0",
  },
});
