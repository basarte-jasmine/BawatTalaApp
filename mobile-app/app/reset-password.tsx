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

export default function ResetPasswordScreen() {
  const [studentId, setStudentId] = useState("");
  const [birthdate, setBirthdate] = useState("");

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.title}>Confirm your account</Text>
          <Text style={styles.subtitle}>
            Enter your details. We&apos;ll send a one-time code to the email linked to your account.
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

          <Text style={styles.label}>Birthdate</Text>
          <TextInput
            style={styles.input}
            value={birthdate}
            onChangeText={setBirthdate}
            placeholder="MM/DD/YYYY"
            placeholderTextColor="#8D8D8D"
          />

          <Pressable style={styles.actionButton} onPress={() => router.push("/reset-password-otp")}>
            <Text style={styles.actionButtonText}>Confirm Account</Text>
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
    lineHeight: 20,
    marginBottom: 30,
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
    marginTop: 24,
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
