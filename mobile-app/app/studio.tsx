import { useEffect } from "react";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

export default function StudioScreen() {
  useEffect(() => {
    const timer = setTimeout(() => router.replace("/intro"), 2800);
    return () => clearTimeout(timer);
  }, []);

  return (
    <SafeAreaView style={styles.studioScreen}>
      <View style={styles.centeredScreen}>
        <Image
          source={require("../assets/images/logo_sampleIMG.png")}
          style={styles.studioGif}
          resizeMode="contain"
        />
        <Pressable style={styles.skipButton} onPress={() => router.replace("/intro")}>
          <Text style={styles.skipButtonText}>Skip</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  studioScreen: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  centeredScreen: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  studioGif: {
    width: 260,
    height: 260,
  },
  skipButton: {
    marginTop: 20,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#b1894f",
  },
  skipButtonText: {
    color: "#6f5a44",
    fontWeight: "600",
  },
});
