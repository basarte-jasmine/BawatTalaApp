import { useEffect } from "react";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { ActivityIndicator, StyleSheet, View } from "react-native";

export default function StudioScreen() {
  useEffect(() => {
    const timer = setTimeout(() => router.replace("/home"), 2800);
    return () => clearTimeout(timer);
  }, []);

  return (
    <SafeAreaView style={styles.studioScreen}>
      <View style={styles.centeredScreen}>
        <ActivityIndicator size="large" color="#6FCB43" />
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
});
