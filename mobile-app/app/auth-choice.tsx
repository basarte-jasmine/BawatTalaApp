import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

export default function AuthChoiceScreen() {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.card}>
        <View style={styles.shapeWrap}>
          <View style={styles.shape} />
          <Image
            source={require("../assets/images/logo_sampleIMG.png")}
            style={styles.heroLogo}
            resizeMode="contain"
          />
        </View>

        <Text style={styles.welcome}>Welcome!</Text>
        <Text style={styles.subtitle}>
          Create your account to start journaling{"\n"}and track your progress.
        </Text>

        <View style={styles.buttonRow}>
          <Pressable style={styles.loginButton} onPress={() => router.push("/login")}>
            <Text style={styles.loginButtonText}>Login</Text>
          </Pressable>
          <Pressable style={styles.registerButton} onPress={() => router.push("/register")}>
            <Text style={styles.registerButtonText}>Register</Text>
          </Pressable>
        </View>

        <Pressable style={styles.googleButton} onPress={() => router.push("/register")}>
          <Text style={styles.googleButtonText}>Continue with Google</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#FFF8E9",
  },
  card: {
    flex: 1,
    backgroundColor: "#efe7d3",
    paddingHorizontal: 26,
    paddingTop: 24,
    justifyContent: "center",
  },
  shapeWrap: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  shape: {
    position: "absolute",
    width: 320,
    height: 150,
    borderRadius: 80,
    backgroundColor: "#F95555",
  },
  heroLogo: {
    width: 150,
    height: 150,
  },
  welcome: {
    fontSize: 56,
    fontWeight: "800",
    color: "#4a4033",
    textAlign: "center",
    marginBottom: 4,
  },
  subtitle: {
    textAlign: "center",
    color: "#6f5a44",
    fontSize: 16,
    lineHeight: 20,
    marginBottom: 24,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 14,
  },
  loginButton: {
    flex: 1,
    backgroundColor: "#b33131",
    borderRadius: 8,
    alignItems: "center",
    paddingVertical: 12,
  },
  loginButtonText: {
    color: "#f7efe2",
    fontSize: 22,
    fontWeight: "600",
  },
  registerButton: {
    flex: 1,
    backgroundColor: "#fff8f2",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#cb4b4b",
    paddingVertical: 12,
  },
  registerButtonText: {
    color: "#b33131",
    fontSize: 20,
    fontWeight: "600",
  },
  googleButton: {
    borderWidth: 1,
    borderColor: "#b3a68f",
    borderRadius: 8,
    alignItems: "center",
    paddingVertical: 12,
    backgroundColor: "#ebe6df",
  },
  googleButtonText: {
    color: "#4a4033",
    fontSize: 16,
    fontWeight: "600",
  },
});
