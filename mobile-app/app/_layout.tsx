import { Stack } from "expo-router";
import { useEffect } from "react";
import * as SplashScreen from "expo-splash-screen";
import { useFonts } from "expo-font";
import { StyleSheet, Text, TextInput, View } from "react-native";

const APP_MAX_WIDTH = 412;

void SplashScreen.preventAutoHideAsync();

let textDefaultsApplied = false;

function applyGlobalTypography() {
  if (textDefaultsApplied) return;
  textDefaultsApplied = true;

  Text.defaultProps = Text.defaultProps ?? {};
  Text.defaultProps.style = [{ fontFamily: "Outfit" }, Text.defaultProps.style];

  TextInput.defaultProps = TextInput.defaultProps ?? {};
  TextInput.defaultProps.style = [{ fontFamily: "Outfit" }, TextInput.defaultProps.style];
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Outfit: require("../assets/fonts/Outfit-Variable.ttf"),
  });

  useEffect(() => {
    if (fontError) {
      throw fontError;
    }
    if (!fontsLoaded) return;

    applyGlobalTypography();
    void SplashScreen.hideAsync();
  }, [fontError, fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <View style={styles.root}>
      <View style={styles.frame}>
        <Stack screenOptions={{ headerShown: false }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    backgroundColor: "#E4E4E4",
  },
  frame: {
    flex: 1,
    width: "100%",
    maxWidth: APP_MAX_WIDTH,
  },
});
