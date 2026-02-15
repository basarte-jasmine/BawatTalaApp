import { router } from "expo-router";
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useState } from "react";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.fullscreen}
    >
      <ScrollView contentContainerStyle={styles.formScroll}>
        <View style={styles.container}>
          <Image
            source={require("../assets/images/textLOGO.png")}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.panelTitle}>Welcome back!</Text>
          <Text style={styles.panelSubtitle}>
            Create your account to start journaling{"\n"}and track your progress.
          </Text>

          <Text style={styles.inputLabel}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="user@gmail.com"
            placeholderTextColor="#8a8a8a"
          />

          <Text style={styles.inputLabel}>Password</Text>
          <View style={styles.passwordWrap}>
            <TextInput
              style={styles.passwordInput}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              placeholder="******"
              placeholderTextColor="#8a8a8a"
            />
            <Pressable onPress={() => setShowPassword((prev) => !prev)} style={styles.eyeButton}>
              <Text style={styles.eyeText}>{showPassword ? "Hide" : "Show"}</Text>
            </Pressable>
          </View>

          <Pressable style={styles.forgotWrap}>
            <Text style={styles.forgotText}>Forgot Password?</Text>
          </Pressable>

          <Pressable style={styles.primaryButton} onPress={() => router.replace("/home")}>
            <Text style={styles.primaryButtonText}>Login</Text>
          </Pressable>

          <Pressable style={styles.textLinkButton} onPress={() => router.push("/register")}>
            <Text style={styles.textLink}>
              Don&apos;t have an account? <Text style={styles.textLinkAccent}>Register</Text>
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fullscreen: {
    flex: 1,
    backgroundColor: "#efe7d3",
  },
  formScroll: {
    flexGrow: 1,
  },
  container: {
    paddingHorizontal: 18,
    paddingTop: 42,
    paddingBottom: 30,
  },
  logo: {
    alignSelf: "center",
    width: 170,
    height: 150,
    marginBottom: 8,
  },
  panelTitle: {
    fontSize: 46,
    fontWeight: "700",
    color: "#4a4033",
    textAlign: "center",
    marginBottom: 10,
  },
  panelSubtitle: {
    color: "#6f5a44",
    fontSize: 17,
    marginBottom: 42,
    lineHeight: 24,
    textAlign: "center",
  },
  inputLabel: {
    color: "#4a4033",
    marginBottom: 6,
    fontSize: 28,
    fontWeight: "600",
  },
  input: {
    borderWidth: 1,
    borderColor: "#4a4033",
    backgroundColor: "#f0f0ef",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 21,
    color: "#4a4033",
    marginBottom: 18,
  },
  passwordWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#4a4033",
    borderRadius: 14,
    backgroundColor: "#f0f0ef",
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 21,
    color: "#4a4033",
  },
  eyeButton: {
    paddingHorizontal: 12,
  },
  eyeText: {
    fontSize: 16,
    color: "#4a4033",
    fontWeight: "700",
  },
  forgotWrap: {
    marginTop: 10,
    marginBottom: 24,
  },
  forgotText: {
    color: "#0078a9",
    fontSize: 31,
    fontWeight: "500",
  },
  primaryButton: {
    backgroundColor: "#8f2a2a",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 16,
  },
  primaryButtonText: {
    color: "#f7efe2",
    fontSize: 34,
    fontWeight: "700",
  },
  textLinkButton: {
    marginTop: 8,
    alignItems: "center",
  },
  textLink: {
    color: "#2e2a24",
    fontSize: 30,
    fontWeight: "500",
  },
  textLinkAccent: {
    color: "#0078a9",
    fontWeight: "700",
  },
});
