import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import {
  fetchStudentPreferences,
  resendJournalLockResetCode,
  resetJournalLockWithEmailCode,
  saveStudentPreferences,
  sendJournalLockResetCode,
  verifyJournalLockPin,
  verifyJournalLockResetCode,
  type StudentPreferences,
} from "./backend-api";
import { useAuthSession } from "./auth-session";
import {
  disableMuniReminders,
  getMuniRemindersEnabled,
  scheduleMuniReminders,
  syncMuniReminderSchedule,
} from "./muni-reminders";

type AppPreferencesContextValue = {
  appLockAutoLock: boolean;
  appLockEnabled: boolean;
  hasAppLockPin: boolean;
  clearPreferences: () => void;
 disableAppLock: (pin: string) => Promise<{ ok: boolean; message?: string }>;
 enableAppLock: (pin: string, autoLock: boolean) => Promise<{ ok: boolean; message?: string }>;
 enableExistingAppLock: (autoLock: boolean, pin?: string) => Promise<{ ok: boolean; message?: string }>;
 isAppLocked: boolean;
  lockAppNow: () => void;
  muniRemindersEnabled: boolean;
  notificationPreviewsEnabled: boolean;
  privateJournalModeEnabled: boolean;
  setAppLockAutoLock: (value: boolean) => void;
  setMuniRemindersEnabled: (value: boolean) => Promise<{ ok: boolean; message?: string }>;
  setNotificationPreviewsEnabled: (value: boolean) => void;
  setPrivateJournalModeEnabled: (value: boolean) => void;
  resendAppLockResetCode: () => Promise<{ ok: boolean; message?: string; resendAfterSeconds?: number }>;
  resetAppLockWithEmailCode: (journalLockPin: string) => Promise<{ ok: boolean; message?: string }>;
  sendAppLockResetCode: () => Promise<{ ok: boolean; message?: string; resendAfterSeconds?: number }>;
  verifyAppLockResetCode: (token: string) => Promise<{ ok: boolean; message?: string }>;
  unlockApp: (pin: string) => Promise<boolean>;
  updateAppLockPin: (previousPin: string, pin: string) => Promise<{ ok: boolean; message?: string }>;
};

const AppPreferencesContext = createContext<AppPreferencesContextValue | null>(null);
const DEFAULT_PREFERENCES: StudentPreferences = {
  hasJournalLockPin: false,
  journalLockAutoLock: true,
  journalLockEnabled: false,
  notificationPreviewsEnabled: true,
  privateJournalModeEnabled: true,
};

export function AppPreferencesProvider({ children }: PropsWithChildren) {
  const { isHydrated, user } = useAuthSession();
  const [notificationPreviewsEnabled, setNotificationPreviewsEnabledState] = useState(
    DEFAULT_PREFERENCES.notificationPreviewsEnabled,
  );
  const [privateJournalModeEnabled, setPrivateJournalModeEnabledState] = useState(
    DEFAULT_PREFERENCES.privateJournalModeEnabled,
  );
  const [appLockEnabled, setAppLockEnabled] = useState(false);
  const [hasAppLockPin, setHasAppLockPin] = useState(false);
  const [appLockAutoLock, setAppLockAutoLockState] = useState(DEFAULT_PREFERENCES.journalLockAutoLock);
  const [isAppLocked, setIsAppLocked] = useState(false);
  const [muniRemindersEnabled, setMuniRemindersEnabledState] = useState(false);
  const appStateRef = useRef(AppState.currentState);
  const studentNumber = user?.studentNumber || "";

  const applyPreferences = useCallback((preferences: StudentPreferences) => {
    setNotificationPreviewsEnabledState(preferences.notificationPreviewsEnabled);
    setPrivateJournalModeEnabledState(preferences.privateJournalModeEnabled);
    setAppLockAutoLockState(preferences.journalLockAutoLock);
    setAppLockEnabled(preferences.journalLockEnabled);
    setHasAppLockPin(preferences.hasJournalLockPin);
    setIsAppLocked(preferences.journalLockEnabled);
  }, []);

  const resetPreferences = useCallback(() => {
    applyPreferences(DEFAULT_PREFERENCES);
    setIsAppLocked(false);
    setMuniRemindersEnabledState(false);
  }, [applyPreferences]);

  useEffect(() => {
    if (!isHydrated) return;
    if (!studentNumber) {
      resetPreferences();
      return;
    }

    let mounted = true;
    void fetchStudentPreferences(studentNumber).then((result) => {
      if (!mounted || !result.ok || !result.preferences) return;
      applyPreferences(result.preferences);
    });

    return () => {
      mounted = false;
    };
  }, [applyPreferences, isHydrated, resetPreferences, studentNumber]);

  useEffect(() => {
    if (!isHydrated) return;
    if (!studentNumber) {
      setMuniRemindersEnabledState(false);
      return;
    }

    let mounted = true;
    void getMuniRemindersEnabled(studentNumber)
      .then((enabled) => {
        if (!mounted) return;
        setMuniRemindersEnabledState(enabled);
        if (enabled) {
          void syncMuniReminderSchedule(studentNumber, user?.firstName);
        }
      })
      .catch(() => {
        if (mounted) setMuniRemindersEnabledState(false);
      });

    return () => {
      mounted = false;
    };
  }, [isHydrated, resetPreferences, studentNumber, user?.firstName]);

  const persistPreferences = useCallback(
    async (
      preferences: Parameters<typeof saveStudentPreferences>[1],
    ): Promise<{ ok: boolean; message?: string; preferences?: StudentPreferences | null }> => {
      if (!studentNumber) {
        return { ok: false, message: "Student session is missing." };
      }

      const result = await saveStudentPreferences(studentNumber, preferences);
      if (result.ok && result.preferences) {
        applyPreferences(result.preferences);
      }
      return result;
    },
    [applyPreferences, studentNumber],
  );

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
      hasAppLockPin,
      clearPreferences: resetPreferences,
      disableAppLock: async (pin: string) => {
        const verified = await verifyJournalLockPin(studentNumber, pin);
        if (!verified.ok || !verified.unlocked) {
          return { ok: false, message: verified.message || "Enter your current PIN to turn Journal Lock off." };
        }
        const result = await persistPreferences({
          currentJournalLockPin: pin,
          journalLockEnabled: false,
          previousJournalLockPin: pin,
        });
        if (!result.ok) return result;
        setIsAppLocked(false);
        return result;
      },
     enableAppLock: async (pin: string, autoLock: boolean) => {
       const result = await persistPreferences({
         journalLockAutoLock: autoLock,
         journalLockEnabled: true,
         journalLockPin: pin,
       });
       if (!result.ok) return result;
       setIsAppLocked(true);
       return result;
     },
     enableExistingAppLock: async (autoLock: boolean, pin?: string) => {
       const result = await persistPreferences({
         currentJournalLockPin: pin,
         journalLockAutoLock: autoLock,
         journalLockEnabled: true,
         journalLockPin: pin,
       });
       if (!result.ok) return result;
       setIsAppLocked(true);
       return result;
     },
      isAppLocked,
      lockAppNow: () => {
        if (!appLockEnabled) return;
        setIsAppLocked(true);
      },
      muniRemindersEnabled,
      notificationPreviewsEnabled,
      privateJournalModeEnabled,
      setAppLockAutoLock: (nextValue: boolean) => {
        setAppLockAutoLockState(nextValue);
        if (appLockEnabled) {
          void persistPreferences({ journalLockAutoLock: nextValue });
        }
      },
      setMuniRemindersEnabled: async (nextValue: boolean) => {
        if (!studentNumber) {
          return { ok: false, message: "Student session is missing." };
        }

        if (!nextValue) {
          setMuniRemindersEnabledState(false);
          await disableMuniReminders(studentNumber);
          return { ok: true, message: "Muni reminders are off." };
        }

        const result = await scheduleMuniReminders(studentNumber, user?.firstName);
        setMuniRemindersEnabledState(result.ok);
        return result;
      },
      setNotificationPreviewsEnabled: (nextValue: boolean) => {
        setNotificationPreviewsEnabledState(nextValue);
        void persistPreferences({ notificationPreviewsEnabled: nextValue });
      },
      setPrivateJournalModeEnabled: (nextValue: boolean) => {
        setPrivateJournalModeEnabledState(nextValue);
        void persistPreferences({ privateJournalModeEnabled: nextValue });
      },
      sendAppLockResetCode: async () => {
        if (!studentNumber) {
          return { ok: false, message: "Student session is missing." };
        }
        return sendJournalLockResetCode();
      },
      resendAppLockResetCode: async () => {
        if (!studentNumber) {
          return { ok: false, message: "Student session is missing." };
        }
        return resendJournalLockResetCode();
      },
      verifyAppLockResetCode: async (token: string) => {
        if (!studentNumber) {
          return { ok: false, message: "Student session is missing." };
        }
        return verifyJournalLockResetCode(token);
      },
      resetAppLockWithEmailCode: async (journalLockPin: string) => {
        if (!studentNumber) {
          return { ok: false, message: "Student session is missing." };
        }
        const result = await resetJournalLockWithEmailCode(studentNumber, journalLockPin);
        if (result.ok && result.preferences) {
          applyPreferences(result.preferences);
          setIsAppLocked(true);
        }
        return result;
      },
      unlockApp: async (pin: string) => {
        if (!appLockEnabled || !studentNumber) {
          return false;
        }
        const result = await verifyJournalLockPin(studentNumber, pin);
        if (!result.ok || !result.unlocked) return false;
        setIsAppLocked(false);
        return true;
      },
      updateAppLockPin: async (previousPin: string, pin: string) => {
        const result = await persistPreferences({
          journalLockPin: pin,
          previousJournalLockPin: previousPin,
        });
        if (!result.ok) return result;
        setIsAppLocked(true);
        return result;
      },
    }),
    [
      appLockAutoLock,
      appLockEnabled,
      applyPreferences,
      hasAppLockPin,
      isAppLocked,
      muniRemindersEnabled,
      notificationPreviewsEnabled,
      persistPreferences,
      privateJournalModeEnabled,
      resetPreferences,
      studentNumber,
      user?.firstName,
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

export function JournalLockGate({ children }: PropsWithChildren) {
  const { appLockEnabled, isAppLocked, unlockApp } = useAppPreferences();
  const [pinInput, setPinInput] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    if (!isAppLocked) {
      setPinInput("");
      setErrorMessage("");
    }
  }, [isAppLocked]);

  if (!appLockEnabled || !isAppLocked) {
    return <>{children}</>;
  }

  const handleUnlock = async () => {
    setIsBusy(true);
    const unlocked = await unlockApp(pinInput);
    setIsBusy(false);

    if (unlocked) {
      setPinInput("");
      setErrorMessage("");
      return;
    }

    setErrorMessage("That PIN doesn't match. Try again.");
  };

  const handleLeave = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/home");
  };

  const handleForgotPin = () => {
    router.replace("/profile-settings?section=app-lock&resetPin=1");
  };

  return (
    <View style={styles.journalLockWrap}>
      <View style={styles.journalLockGlowLeft} />
      <View style={styles.journalLockGlowRight} />

      <View style={styles.journalLockCard}>
        <View style={styles.journalLockIconWrap}>
          <Ionicons name="book-outline" size={22} color="#4F9630" />
        </View>

        <Text style={styles.journalLockEyebrow}>JOURNAL LOCK</Text>
        <Text style={styles.journalLockTitle}>Unlock your journal</Text>
        <Text style={styles.journalLockBody}>
          Your entries stay private here. Enter your 4-digit PIN to keep reading or writing.
        </Text>

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

        <View style={styles.journalLockActions}>
          <Pressable style={styles.journalLockSecondaryButton} onPress={handleLeave}>
            <Text style={styles.journalLockSecondaryText}>Back</Text>
          </Pressable>

          <Pressable
            style={[
              styles.button,
              (isBusy || pinInput.length < 4) && styles.buttonDisabled,
            ]}
            onPress={handleUnlock}
            disabled={isBusy || pinInput.length < 4}
          >
            <Text style={styles.buttonText}>{isBusy ? "Checking..." : "Unlock"}</Text>
          </Pressable>
        </View>

        <Pressable style={styles.forgotPinButton} onPress={handleForgotPin}>
          <Text style={styles.forgotPinText}>Forgot PIN?</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function AppLockOverlay() {
  return null;
}

const styles = StyleSheet.create({
  journalLockWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 22,
    backgroundColor: "#F5F9F2",
    overflow: "hidden",
  },
  journalLockGlowLeft: {
    position: "absolute",
    top: -28,
    left: -24,
    width: 148,
    height: 148,
    borderRadius: 999,
    backgroundColor: "#DDF4C9",
    opacity: 0.9,
  },
  journalLockGlowRight: {
    position: "absolute",
    right: -36,
    bottom: 28,
    width: 168,
    height: 168,
    borderRadius: 999,
    backgroundColor: "#E7F4FF",
    opacity: 0.8,
  },
  journalLockCard: {
    width: "100%",
    maxWidth: 332,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 18,
    shadowColor: "#48535B",
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
    borderWidth: 1,
    borderColor: "#E0ECD7",
    alignItems: "center",
  },
  journalLockIconWrap: {
    width: 58,
    height: 58,
    borderRadius: 999,
    backgroundColor: "#F2FBE7",
    borderWidth: 1,
    borderColor: "#DCECCC",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  journalLockEyebrow: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
    color: "#6D8264",
    letterSpacing: 1.3,
    marginBottom: 8,
  },
  journalLockTitle: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "700",
    color: "#314258",
    textAlign: "center",
    marginBottom: 8,
  },
  journalLockBody: {
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
    width: "100%",
  },
  errorText: {
    color: "#D64C4C",
    textAlign: "center",
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10,
  },
  journalLockActions: {
    width: "100%",
    flexDirection: "row",
    columnGap: 10,
  },
  forgotPinButton: {
    marginTop: 14,
    minHeight: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  forgotPinText: {
    color: "#3D5569",
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "800",
  },
  button: {
    flex: 1,
    minHeight: 44,
    borderRadius: 999,
    backgroundColor: "#73CD44",
    alignItems: "center",
    justifyContent: "center",
  },
  journalLockSecondaryButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D8E2E9",
    alignItems: "center",
    justifyContent: "center",
  },
  journalLockSecondaryText: {
    color: "#4E6070",
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "700",
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
