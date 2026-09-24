import { useEffect } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { ActivityIndicator,  StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";

export default function StudioScreen() {
  const { welcome } = useLocalSearchParams<{ welcome?: string }>();

  useEffect(() => {
    const timer = setTimeout(() => {
      if (welcome === "1") {
        router.replace({ pathname: "/home", params: { welcome: "1" } });
        return;
      }

      router.replace("/home");
    }, 1300);
    return () => clearTimeout(timer);
  }, [welcome]);

  return (
    <SafeAreaView style={styles.studioScreen}>
      <View style={styles.centeredScreen}>
        <Image
          source={require("../assets/images/Logo_BT.png")}
          style={styles.logo}
          contentFit="contain"
        />
        <Text style={styles.title}>Bawat Tala</Text>
        <Text style={styles.subtitle}>Preparing your sanctuary...</Text>
        <ActivityIndicator size="large" color="#6FCB43" />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  studioScreen: {
    flex: 1,
    backgroundColor: "#F8FFF8" },
  centeredScreen: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24 },
  logo: {
    width: 96,
    height: 96,
    marginBottom: 16 },
  title: {
    fontSize: 26,
    fontFamily: "Outfit-Bold",
    color: "#213A35",
    marginBottom: 6 },
  subtitle: {
    fontSize: 15,
    fontFamily: "Outfit-Medium",
    color: "#56706A",
    marginBottom: 24 } });
