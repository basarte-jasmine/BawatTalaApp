import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import { syncOfflineStudentData } from "./backend-api";
import { useAuthSession } from "./auth-session";

type OfflineSyncContextValue = {
  isSyncing: boolean;
  refreshKey: number;
  syncNow: () => Promise<void>;
};

const OfflineSyncContext = createContext<OfflineSyncContextValue | null>(null);
const ACTIVE_SYNC_INTERVAL_MS = 45000;

export function OfflineSyncProvider({ children }: PropsWithChildren) {
  const { isHydrated, user } = useAuthSession();
  const [isSyncing, setIsSyncing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const syncInFlightRef = useRef(false);
  const appStateRef = useRef(AppState.currentState);
  const studentNumber = user?.studentNumber || "";

  const syncNow = useCallback(async () => {
    if (!isHydrated || !studentNumber || syncInFlightRef.current) {
      return;
    }

    syncInFlightRef.current = true;
    setIsSyncing(true);
    try {
      await syncOfflineStudentData(studentNumber);
    } finally {
      syncInFlightRef.current = false;
      setIsSyncing(false);
      setRefreshKey((current) => current + 1);
    }
  }, [isHydrated, studentNumber]);

  useEffect(() => {
    if (!studentNumber) return;
    void syncNow();
  }, [studentNumber, syncNow]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextState;

      if (nextState === "active" && previousState !== "active") {
        void syncNow();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [syncNow]);

  useEffect(() => {
    if (!studentNumber) return undefined;

    const timer = setInterval(() => {
      if (AppState.currentState === "active") {
        void syncNow();
      }
    }, ACTIVE_SYNC_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [studentNumber, syncNow]);

  const value = useMemo<OfflineSyncContextValue>(
    () => ({
      isSyncing,
      refreshKey,
      syncNow,
    }),
    [isSyncing, refreshKey, syncNow],
  );

  return <OfflineSyncContext.Provider value={value}>{children}</OfflineSyncContext.Provider>;
}

export function useOfflineSync() {
  const context = useContext(OfflineSyncContext);

  if (!context) {
    throw new Error("useOfflineSync must be used within OfflineSyncProvider.");
  }

  return context;
}
