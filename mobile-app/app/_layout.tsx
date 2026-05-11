import { Stack } from "expo-router";
import { useEffect } from "react";
import * as SplashScreen from "expo-splash-screen";
import { useFonts } from "expo-font";
import { StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import { AuthSessionProvider } from "../lib/auth-session";
import { AppPreferencesProvider } from "../lib/app-preferences";
import { warmBackend } from "../lib/backend-api";

const APP_MAX_WIDTH = 412;
const DESKTOP_FRAME_BREAKPOINT = 768;

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
  const { width } = useWindowDimensions();
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

  useEffect(() => {
    void warmBackend();
  }, []);

  if (!fontsLoaded) return null;

  const useDesktopFrame = width >= DESKTOP_FRAME_BREAKPOINT;

  return (
    <View style={[styles.root, useDesktopFrame && styles.desktopRoot]}>
      <View style={[styles.frame, useDesktopFrame && styles.desktopFrame]}>
        <AppPreferencesProvider>
          <AuthSessionProvider>
            <Stack
              screenOptions={{
                headerShown: false,
                animation: "fade_from_bottom",
                animationDuration: 160,
              }}
            />
          </AuthSessionProvider>
        </AppPreferencesProvider>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    backgroundColor: "#F7FAF4",
  },
  desktopRoot: {
    backgroundColor: "#E4E4E4",
  },
  frame: {
    flex: 1,
    width: "100%",
  },
  desktopFrame: {
    maxWidth: APP_MAX_WIDTH,
  },
});
