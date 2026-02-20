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

export default function ResetPasswordNewScreen() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.title}>Reset your password</Text>
          <Text style={styles.subtitle}>Enter and confirm your new password below.</Text>

          <Text style={styles.label}>Enter your new password</Text>
          <TextInput
            style={styles.input}
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
            placeholder="******"
            placeholderTextColor="#8D8D8D"
          />

          <Text style={styles.label}>Confirm your new password</Text>
          <View style={styles.passwordWrap}>
            <TextInput
              style={styles.passwordInput}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showConfirmPassword}
              placeholder="******"
              placeholderTextColor="#8D8D8D"
            />
            <Pressable style={styles.eyeButton} onPress={() => setShowConfirmPassword((prev) => !prev)}>
              <Ionicons name={showConfirmPassword ? "eye-off" : "eye"} size={18} color="#1D1D1D" />
            </Pressable>
          </View>

          <Pressable style={styles.actionButton} onPress={() => router.replace("/login")}>
            <Text style={styles.actionButtonText}>Reset Password</Text>
          </Pressable>

          <Pressable style={styles.backToLogin} onPress={() => router.replace("/login")}>
            <Text style={styles.backText}>
              Go back to <Text style={styles.backLink}>login page</Text>
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
  content: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  card: {
    width: "100%",
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
    marginBottom: 7,
  },
  input: {
    height: 44,
    borderWidth: 1,
    borderColor: "#1A1A1A",
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 10,
    fontSize: 14,
    color: "#111111",
    marginBottom: 16,
  },
  passwordWrap: {
    height: 44,
    borderWidth: 1,
    borderColor: "#1A1A1A",
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 10,
    marginBottom: 58,
    flexDirection: "row",
    alignItems: "center",
  },
  passwordInput: {
    flex: 1,
    fontSize: 14,
    color: "#111111",
  },
  eyeButton: {
    width: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  actionButton: {
    width: 290,
    height: 28,
    borderRadius: 999,
    backgroundColor: "#7A9EBA",
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#5E7D95",
    shadowOpacity: 0.34,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
    marginBottom: 16,
  },
  actionButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
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
