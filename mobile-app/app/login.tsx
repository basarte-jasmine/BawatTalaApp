import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

export default function LoginScreen() {
  const [studentId, setStudentId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.screen}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <Text style={styles.title}>Welcome!</Text>
          <Text style={styles.subtitle}>
            Log in to your account to start journaling{"\n"}and track your progress.
          </Text>

          <Text style={styles.label}>Student ID</Text>
          <TextInput
            style={styles.input}
            value={studentId}
            onChangeText={setStudentId}
            placeholder="xx-xxxx"
            placeholderTextColor="#8D8D8D"
            autoCapitalize="none"
          />

          <Text style={styles.label}>Password or Birthdate</Text>
          <View style={styles.passwordWrap}>
            <TextInput
              style={styles.passwordInput}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              placeholder="MM/DD/YYYY"
              placeholderTextColor="#8D8D8D"
            />
            <Pressable style={styles.eyeButton} onPress={() => setShowPassword((prev) => !prev)}>
              <Ionicons name={showPassword ? "eye-off" : "eye"} size={18} color="#1D1D1D" />
            </Pressable>
          </View>

          <Pressable style={styles.forgotWrap} onPress={() => router.push("/reset-password")}>
            <Text style={styles.forgotText}>Forgot Password?</Text>
          </Pressable>

          <Pressable style={styles.loginButton} onPress={() => router.replace("/home")}>
            <Text style={styles.loginButtonText}>Login</Text>
          </Pressable>

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
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 28,
    alignItems: "center",
  },
  card: {
    width: "100%",
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
    marginBottom: 6,
  },
  input: {
    height: 42 / 2,
    borderWidth: 1,
    borderColor: "#1A1A1A",
    borderRadius: 6,
    paddingHorizontal: 10,
    fontSize: 14,
    color: "#111111",
    marginBottom: 12,
  },
  passwordWrap: {
    height: 42 / 2,
    borderWidth: 1,
    borderColor: "#1A1A1A",
    borderRadius: 6,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 10,
    fontSize: 10,
    color: "#111111",
  },
  eyeButton: {
    width: 36,
    alignItems: "center",
    justifyContent: "center",
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
    width: 290,
    alignSelf: "center",
    height: 25,
    borderRadius: 999,
    backgroundColor: "#7A9EBA",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    shadowColor: "#5E7D95",
    shadowOpacity: 0.34,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  loginButtonText: {
    color: "#FFFFFF",
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
