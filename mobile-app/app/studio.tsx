import { useEffect } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { ActivityIndicator, StyleSheet, View } from "react-native";

export default function StudioScreen() {
  const { welcome } = useLocalSearchParams<{ welcome?: string }>();

  useEffect(() => {
    const timer = setTimeout(() => {
      if (welcome === "1") {
        router.replace({ pathname: "/home", params: { welcome: "1" } });
        return;
      }

      router.replace("/home");
    }, 2800);
    return () => clearTimeout(timer);
  }, [welcome]);

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
