import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { FormTextInput } from "../components/forms/FormTextInput";
import { PasswordField } from "../components/forms/PasswordField";
import { AuthCardLayout } from "../components/layout/AuthCardLayout";
import { AppPrimaryButton } from "../components/ui/AppPrimaryButton";
import { loginWithStudentId } from "../lib/backend-api";
import {
  AUTH_MESSAGES,
  isValidStudentId,
  normalizeStudentIdInput,
} from "../lib/auth-validation";

export default function LoginScreen() {
  const [studentId, setStudentId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);

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

    if (!result.ok) {
      setErrorMessage(result.message ?? "Invalid username or password. Please try again.");
      return;
    }

    router.replace("/home");
  };

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
        placeholder="(e.g. 23-2903)"
        placeholderTextColor="#8D8D8D"
        autoCapitalize="none"
        labelStyle={styles.label}
        inputStyle={styles.input}
      />

      <PasswordField
        label="Password"
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
        label={isBusy ? "Logging in..." : "Login"}
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
    height: 42,
    borderRadius: 6,
    marginBottom: 0,
  },
  passwordInput: {
    paddingHorizontal: 10,
    fontSize: 14,
    color: "#111111",
    paddingVertical: 0,
    textAlignVertical: "center",
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
  errorText: {
    color: "#C31A1A",
    fontSize: 11,
    marginBottom: 8,
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
