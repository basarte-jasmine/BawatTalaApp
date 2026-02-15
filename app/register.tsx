import { router } from "expo-router";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useState } from "react";

export default function RegisterScreen() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.fullscreen}
    >
      <ScrollView contentContainerStyle={styles.formScroll}>
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Create account</Text>
          <Text style={styles.panelSubtitle}>For now, register with username and password.</Text>

          <Text style={styles.inputLabel}>Username</Text>
          <TextInput
            style={styles.input}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            placeholder="yourname"
            placeholderTextColor="#8a8a8a"
          />

          <Text style={styles.inputLabel}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            placeholder="********"
            placeholderTextColor="#8a8a8a"
          />

          <Pressable style={styles.primaryButton} onPress={() => router.replace("/home")}>
            <Text style={styles.primaryButtonText}>Register</Text>
          </Pressable>

          <Pressable style={styles.textLinkButton} onPress={() => router.push("/login")}>
            <Text style={styles.textLink}>Already registered? Login</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fullscreen: {
    flex: 1,
    backgroundColor: "#e7e3df",
  },
  formScroll: {
    flexGrow: 1,
    justifyContent: "center",
  },
  panel: {
    backgroundColor: "#efe7d3",
    margin: 20,
    padding: 22,
    borderRadius: 20,
    shadowColor: "#4a4033",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  panelTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: "#4a4033",
    marginBottom: 8,
  },
  panelSubtitle: {
    color: "#6f5a44",
    fontSize: 14,
    marginBottom: 20,
    lineHeight: 20,
  },
  inputLabel: {
    color: "#4a4033",
    marginBottom: 6,
    fontSize: 13,
    fontWeight: "600",
  },
  input: {
    borderWidth: 1,
    borderColor: "#cdbda0",
    backgroundColor: "#f6f0e2",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    color: "#4a4033",
    marginBottom: 12,
  },
  primaryButton: {
    backgroundColor: "#8f2a2a",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 12,
  },
  primaryButtonText: {
    color: "#f7efe2",
    fontSize: 16,
    fontWeight: "700",
  },
  textLinkButton: {
    marginTop: 8,
    alignItems: "center",
  },
  textLink: {
    color: "#8f2a2a",
    fontSize: 14,
    fontWeight: "600",
  },
});
