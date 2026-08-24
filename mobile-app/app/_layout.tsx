import { router, Stack } from "expo-router";
import { useEffect } from "react";
import * as SplashScreen from "expo-splash-screen";
import { useFonts } from "expo-font";
import { StatusBar } from "expo-status-bar";
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  type TextInputProps,
  type TextProps,
} from "react-native";
import { AuthSessionProvider } from "../lib/auth-session";
import { AppPreferencesProvider } from "../lib/app-preferences";
import { warmBackend } from "../lib/backend-api";
import { configureMuniNotificationBehavior } from "../lib/muni-reminders";
import { OfflineSyncProvider } from "../lib/offline-sync";

const APP_MAX_WIDTH = 412;
const DESKTOP_FRAME_BREAKPOINT = 768;

void SplashScreen.preventAutoHideAsync();

let textDefaultsApplied = false;
type ComponentWithDefaults<Props> = {
  defaultProps?: Partial<Props>;
};

function applyGlobalTypography() {
  if (textDefaultsApplied) return;
  textDefaultsApplied = true;

  const textComponent = Text as typeof Text & ComponentWithDefaults<TextProps>;
  textComponent.defaultProps = textComponent.defaultProps ?? {};
  textComponent.defaultProps.style = [{ fontFamily: "Outfit" }, textComponent.defaultProps.style];

  const textInputComponent = TextInput as typeof TextInput & ComponentWithDefaults<TextInputProps>;
  textInputComponent.defaultProps = textInputComponent.defaultProps ?? {};
  textInputComponent.defaultProps.style = [{ fontFamily: "Outfit" }, textInputComponent.defaultProps.style];
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

  useEffect(() => {
    void configureMuniNotificationBehavior();

    let subscription: { remove: () => void } | null = null;
    void import("expo-notifications")
      .then((Notifications) => {
        subscription = Notifications.addNotificationResponseReceivedListener((response) => {
          const route = response.notification.request.content.data?.route;
          if (typeof route === "string" && route.startsWith("/")) {
            router.push(route as never);
          }
        });
      })
      .catch(() => undefined);

    return () => {
      subscription?.remove();
    };
  }, []);

  if (!fontsLoaded) return null;

  const useDesktopFrame = width >= DESKTOP_FRAME_BREAKPOINT;

  return (
    <View style={[styles.root, useDesktopFrame && styles.desktopRoot]}>
      <StatusBar style="dark" backgroundColor="#F7FAF4" />
      <View style={[styles.frame, useDesktopFrame && styles.desktopFrame]}>
        <AuthSessionProvider>
          <AppPreferencesProvider>
            <OfflineSyncProvider>
              <Stack
                screenOptions={{
                  headerShown: false,
                  animation: "fade_from_bottom",
                  animationDuration: 160,
                }}
              />
            </OfflineSyncProvider>
          </AppPreferencesProvider>
        </AuthSessionProvider>
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
