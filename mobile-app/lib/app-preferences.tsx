import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

type AppPreferencesContextValue = {
  appLockAutoLock: boolean;
  appLockEnabled: boolean;
  clearPreferences: () => void;
  disableAppLock: () => void;
  enableAppLock: (pin: string, autoLock: boolean) => void;
  isAppLocked: boolean;
  lockAppNow: () => void;
  notificationPreviewsEnabled: boolean;
  privateJournalModeEnabled: boolean;
  setAppLockAutoLock: (value: boolean) => void;
  setNotificationPreviewsEnabled: (value: boolean) => void;
  setPrivateJournalModeEnabled: (value: boolean) => void;
  unlockApp: (pin: string) => boolean;
  updateAppLockPin: (pin: string) => void;
};

const AppPreferencesContext = createContext<AppPreferencesContextValue | null>(null);

export function AppPreferencesProvider({ children }: PropsWithChildren) {
  const [notificationPreviewsEnabled, setNotificationPreviewsEnabled] = useState(true);
  const [privateJournalModeEnabled, setPrivateJournalModeEnabled] = useState(true);
  const [appLockEnabled, setAppLockEnabled] = useState(false);
  const [appLockPin, setAppLockPin] = useState("");
  const [appLockAutoLock, setAppLockAutoLock] = useState(true);
  const [isAppLocked, setIsAppLocked] = useState(false);
  const appStateRef = useRef(AppState.currentState);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      const currentState = appStateRef.current;
      const leavingForeground = currentState === "active" && (nextState === "inactive" || nextState === "background");

      if (leavingForeground && appLockEnabled && appLockAutoLock) {
        setIsAppLocked(true);
      }

      appStateRef.current = nextState;
    });

    return () => {
      subscription.remove();
    };
  }, [appLockAutoLock, appLockEnabled]);

  const value = useMemo<AppPreferencesContextValue>(
    () => ({
      appLockAutoLock,
      appLockEnabled,
      clearPreferences: () => {
        setNotificationPreviewsEnabled(true);
        setPrivateJournalModeEnabled(true);
        setAppLockEnabled(false);
        setAppLockPin("");
        setAppLockAutoLock(true);
        setIsAppLocked(false);
      },
      disableAppLock: () => {
        setAppLockEnabled(false);
        setAppLockPin("");
        setIsAppLocked(false);
      },
      enableAppLock: (pin: string, autoLock: boolean) => {
        setAppLockPin(pin);
        setAppLockAutoLock(autoLock);
        setAppLockEnabled(true);
        setIsAppLocked(false);
      },
      isAppLocked,
      lockAppNow: () => {
        if (!appLockEnabled || !appLockPin) return;
        setIsAppLocked(true);
      },
      notificationPreviewsEnabled,
      privateJournalModeEnabled,
      setAppLockAutoLock,
      setNotificationPreviewsEnabled,
      setPrivateJournalModeEnabled,
      unlockApp: (pin: string) => {
        if (!appLockEnabled || !appLockPin || pin !== appLockPin) {
          return false;
        }
        setIsAppLocked(false);
        return true;
      },
      updateAppLockPin: (pin: string) => {
        setAppLockPin(pin);
        setAppLockEnabled(Boolean(pin));
        if (!pin) {
          setIsAppLocked(false);
        }
      },
    }),
    [
      appLockAutoLock,
      appLockEnabled,
      appLockPin,
      isAppLocked,
      notificationPreviewsEnabled,
      privateJournalModeEnabled,
    ],
  );

  return <AppPreferencesContext.Provider value={value}>{children}</AppPreferencesContext.Provider>;
}

export function useAppPreferences() {
  const context = useContext(AppPreferencesContext);

  if (!context) {
    throw new Error("useAppPreferences must be used within AppPreferencesProvider.");
  }

  return context;
}

export function AppLockOverlay() {
  const { appLockEnabled, isAppLocked, unlockApp } = useAppPreferences();
  const [pinInput, setPinInput] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!isAppLocked) {
      setPinInput("");
      setErrorMessage("");
    }
  }, [isAppLocked]);

  if (!appLockEnabled || !isAppLocked) {
    return null;
  }

  const handleUnlock = () => {
    if (unlockApp(pinInput)) {
      setPinInput("");
      setErrorMessage("");
      return;
    }

    setErrorMessage("That PIN doesn’t match. Try again.");
  };

  return (
    <View style={styles.overlay}>
      <View style={styles.card}>
        <Text style={styles.title}>App Locked</Text>
        <Text style={styles.body}>Enter your 4-digit PIN to continue using Bawat Tala.</Text>

        <TextInput
          value={pinInput}
          onChangeText={(value) => {
            setPinInput(value.replace(/[^0-9]/g, "").slice(0, 4));
            if (errorMessage) {
              setErrorMessage("");
            }
          }}
          keyboardType="number-pad"
          secureTextEntry
          maxLength={4}
          placeholder="••••"
          placeholderTextColor="#9AA2AA"
          style={styles.input}
        />

        {!!errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}

        <Pressable
          style={[styles.button, pinInput.length < 4 && styles.buttonDisabled]}
          onPress={handleUnlock}
          disabled={pinInput.length < 4}
        >
          <Text style={styles.buttonText}>Unlock</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
    backgroundColor: "rgba(18, 24, 21, 0.38)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 22,
  },
  card: {
    width: "100%",
    maxWidth: 332,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 18,
    shadowColor: "#48535B",
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  title: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "700",
    color: "#314258",
    textAlign: "center",
    marginBottom: 8,
  },
  body: {
    fontSize: 15,
    lineHeight: 21,
    color: "#4C5D6D",
    textAlign: "center",
    marginBottom: 16,
  },
  input: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#D7E1D0",
    backgroundColor: "#FAFCF8",
    textAlign: "center",
    fontSize: 24,
    letterSpacing: 6,
    color: "#223341",
    marginBottom: 10,
  },
  errorText: {
    color: "#D64C4C",
    textAlign: "center",
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10,
  },
  button: {
    minHeight: 44,
    borderRadius: 999,
    backgroundColor: "#73CD44",
    alignItems: "center",
    justifyContent: "center",
  },
  buttonDisabled: {
    backgroundColor: "#B5D8A6",
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "700",
  },
});
