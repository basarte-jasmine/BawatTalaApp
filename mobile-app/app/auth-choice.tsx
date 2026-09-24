import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {  Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";

export default function AuthChoiceScreen() {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.card}>
        <View style={styles.shapeWrap}>
          <View style={styles.shape} />
          <Image
            source={require("../assets/images/Logo_BT.png")}
            style={styles.heroLogo}
            contentFit="contain"
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
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F8FFF8" },
  card: {
    flex: 1,
    backgroundColor: "#F8FFF8",
    paddingHorizontal: 26,
    paddingTop: 24,
    justifyContent: "center" },
  shapeWrap: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14 },
  shape: {
    position: "absolute",
    width: 320,
    height: 150,
    borderRadius: 80,
    backgroundColor: "#D9F0E9" },
  heroLogo: {
    width: 150,
    height: 150 },
  welcome: {
    fontSize: 44,
    fontFamily: "Outfit-Bold",
    color: "#213A35",
    textAlign: "center",
    marginBottom: 4 },
  subtitle: {
    textAlign: "center",
    color: "#56706A",
    fontSize: 16,
    lineHeight: 22,
    fontFamily: "Outfit-Medium",
    marginBottom: 32 },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 14 },
  loginButton: {
    flex: 1,
    backgroundColor: "#2D7D5A",
    borderRadius: 14,
    alignItems: "center",
    paddingVertical: 14,
    shadowColor: "#1F5744",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3 },
  loginButtonText: {
    textAlign: "center",
    flexShrink: 1,
    color: "#FFFFFF",
    fontSize: 17,
    fontFamily: "Outfit-Bold" },
  registerButton: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#2D7D5A",
    paddingVertical: 14 },
  registerButtonText: {
    textAlign: "center",
    flexShrink: 1,
    color: "#2D7D5A",
    fontSize: 17,
    fontFamily: "Outfit-Bold" } });
