import { ResizeMode, Video } from "expo-av";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";

export default function App() {
  const [screen, setScreen] = useState("landing");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  if (screen === "landing") {
    return (
      <View style={styles.landing}>
        {/* Placeholder for Keepsake Games logo */}
        <View style={styles.logoPlaceholder}>
          <Text style={styles.logoPlaceholderText}>Logo</Text>
        </View>
        
        <Text style={styles.logo}>Keepsake Games</Text>

        <TouchableOpacity
          style={styles.button}
          onPress={() => setScreen("welcome")}
        >
          <Text style={styles.buttonText}>Enter</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (screen === "welcome") {
  return (
    <View style={styles.welcome}>
      <Video
        source={require("assets/STUDIO LOGO.mp4")}
        style={styles.video}
        resizeMode={ResizeMode.CONTAIN}
        shouldPlay
        isLooping
        isMuted
      />

      <Text style={styles.title}>BAWAT TALA</Text>

      <View style={styles.taglineContainer}>
        <Text style={styles.subtitle}>
          NURTURE YOUR MIND{"\n"}one leaf at a time
        </Text>
      </View>

      <TouchableOpacity
        style={styles.button}
        onPress={() => setScreen("login")}
      >
        <Text style={styles.buttonText}>Start my Journey</Text>
      </TouchableOpacity>
    </View>
  );
}


  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.loginContainer}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          {/* Placeholder for login illustration */}
          <View style={styles.imagePlaceholder}>
            <Text style={styles.placeholderText}>Login Image</Text>
          </View>

          <Text style={styles.welcomeTitle}>Welcome!</Text>
          <Text style={styles.welcomeSubtitle}>
            Create your account to start journaling{"\n"}and track your progress.
          </Text>

          {/* Email Input */}
          <Text style={styles.label}>Email</Text>
          <TextInput
            placeholder="user@example.com"
            placeholderTextColor="#999"
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          {/* Password Input */}
          <Text style={styles.label}>Password</Text>
          <View style={styles.passwordContainer}>
            <TextInput
              placeholder="••••••••"
              placeholderTextColor="#999"
              style={styles.passwordInput}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
            />
            <TouchableOpacity
              style={styles.eyeIcon}
              onPress={() => setShowPassword(!showPassword)}
            >
              <Text>{showPassword ? "👁️" : "👁️‍🗨️"}</Text>
            </TouchableOpacity>
          </View>

          {/* Forgot Password */}
          <TouchableOpacity style={styles.forgotContainer}>
            <Text style={styles.forgotText}>Forgot Password?</Text>
          </TouchableOpacity>

          {/* Login Button */}
          <TouchableOpacity style={styles.loginButton}>
            <Text style={styles.loginButtonText}>Login</Text>
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.dividerContainer}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.divider} />
          </View>

          {/* Google Sign Up */}
          <TouchableOpacity style={styles.googleButton}>
            <Text style={styles.googleButtonText}>Sign up with Google</Text>
          </TouchableOpacity>

          {/* Back Button */}
          <TouchableOpacity
            onPress={() => setScreen("welcome")}
            style={styles.backButton}
          >
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  landing: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 20,
  },
  logoPlaceholder: {
    width: 100,
    height: 100,
    backgroundColor: "#E8E8E8",
    borderRadius: 50,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 30,
  },
  logoPlaceholderText: {
    color: "#999",
    fontSize: 12,
  },
  logo: {
    fontSize: 24,
    fontWeight: "600",
    marginBottom: 30,
    textAlign: "center",
  },
  welcome: {
    flex: 1,
    backgroundColor: "linear-gradient(135deg, #A8E063 0%, #7FD856 100%)",
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 40,
    alignItems: "center",
    },
  video: {
    width: 200,
    height: 200,
    marginBottom: 20,
  },
  imagePlaceholder: {
    width: 150,
    height: 150,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 30,
  },
  placeholderText: {
    color: "#fff",
    fontSize: 14,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    marginBottom: 15,
    color: "#000",
    letterSpacing: 2,
  },
  taglineContainer: {
    alignItems: "center",
    marginBottom: 40,
  },
  leafIcon: {
    marginBottom: 10,
  },
  leafEmoji: {
    fontSize: 24,
  },
  subtitle: {
    textAlign: "center",
    marginBottom: 40,
    color: "#000",
    fontSize: 14,
    fontWeight: "500",
  },
  loginContainer: {
    flex: 1,
    backgroundColor: "#A8E063",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  scrollContent: {
    justifyContent: "center",
    paddingVertical: 20,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 25,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  welcomeTitle: {
    fontSize: 26,
    fontWeight: "bold",
    marginBottom: 8,
    color: "#000",
  },
  welcomeSubtitle: {
    fontSize: 13,
    color: "#666",
    marginBottom: 25,
    lineHeight: 18,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#000",
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#DDD",
    padding: 12,
    borderRadius: 8,
    marginBottom: 15,
    fontSize: 14,
    backgroundColor: "#FAFAFA",
  },
  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#DDD",
    borderRadius: 8,
    paddingRight: 10,
    marginBottom: 15,
    backgroundColor: "#FAFAFA",
  },
  passwordInput: {
    flex: 1,
    padding: 12,
    fontSize: 14,
  },
  eyeIcon: {
    padding: 8,
  },
  forgotContainer: {
    alignSelf: "flex-end",
    marginBottom: 20,
  },
  forgotText: {
    color: "#A8E063",
    fontSize: 12,
    fontWeight: "500",
  },
  button: {
    backgroundColor: "#D4F45C",
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
  },
  buttonText: {
    color: "#000",
    fontSize: 16,
    fontWeight: "600",
  },
  loginButton: {
    backgroundColor: "#000",
    paddingVertical: 14,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 15,
  },
  loginButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 15,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: "#DDD",
  },
  dividerText: {
    marginHorizontal: 10,
    color: "#999",
    fontSize: 12,
    fontWeight: "500",
  },
  googleButton: {
    borderWidth: 1,
    borderColor: "#DDD",
    paddingVertical: 12,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  googleButtonText: {
    color: "#000",
    fontSize: 14,
    fontWeight: "600",
  },
  backButton: {
    paddingVertical: 10,
    alignItems: "center",
  },
  backButtonText: {
    color: "#666",
    fontSize: 14,
    fontWeight: "500",
  },
});
