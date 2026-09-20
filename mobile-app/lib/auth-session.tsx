import { clearAllStudentData, setApiAuthToken, setSessionExpiredHandler } from "./backend-api";
import { router } from "expo-router";
import { hydrateMuniWardrobe, resetMuniWardrobe } from "./muni-wardrobe";
import {
  AUTH_SESSION_STORAGE_KEY,
  clearAuthSessionProfile,
  deleteAuthToken,
  migrateAuthTokenFromAsyncStorageOnce,
  setAuthRefreshToken,
  setAuthToken,
  writeAuthSessionProfile,
} from "./auth-storage";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useRef, useState } from "react";

export type AuthUser = {
  email: string;
  firstName: string;
  fullName: string;
  profilePictureUrl?: string;
  studentNumber: string;
  token?: string;
  refreshToken?: string;
};

type AuthSessionContextValue = {
  clearUser: () => Promise<void>;
  isHydrated: boolean;
  setUser: (user: AuthUser | null) => void;
  user: AuthUser | null;
};

const AuthSessionContext = createContext<AuthSessionContextValue | null>(null);

export function AuthSessionProvider({ children }: PropsWithChildren) {
  const [user, setUserState] = useState<AuthUser | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  const userRef = useRef(user);
  userRef.current = user;

  useEffect(() => {
    setSessionExpiredHandler(() => {
      void (async () => {
        const current = userRef.current;
        const studentNumber = current?.studentNumber;
        setApiAuthToken(null);
        resetMuniWardrobe();
        setUserState(null);
        await deleteAuthToken();
        await clearAuthSessionProfile();
        if (studentNumber) {
          await clearAllStudentData(studentNumber);
        }
        try {
          router.replace("/login");
        } catch {
          // Navigation may already be unmounted.
        }
      })();
    });
    return () => setSessionExpiredHandler(null);
  }, []);

  useEffect(() => {
    let isMounted = true;

    const restoreUser = async () => {
      try {
        const { token: migratedToken } = await migrateAuthTokenFromAsyncStorageOnce();
        const storedValue = await AsyncStorage.getItem(AUTH_SESSION_STORAGE_KEY);
        if (!storedValue || !isMounted) {
          return;
        }

        const parsedUser = JSON.parse(storedValue) as AuthUser;
        if (
          parsedUser &&
          typeof parsedUser.email === "string" &&
          typeof parsedUser.firstName === "string" &&
          typeof parsedUser.fullName === "string" &&
          typeof parsedUser.studentNumber === "string"
        ) {
          const token =
            migratedToken ||
            (typeof parsedUser.token === "string" && parsedUser.token.trim()
              ? parsedUser.token.trim()
              : null);

          if (!token) {
            await clearAuthSessionProfile();
            await deleteAuthToken();
            return;
          }

          setApiAuthToken(token);
          setUserState({
            ...parsedUser,
            token,
            profilePictureUrl:
              typeof parsedUser.profilePictureUrl === "string" ? parsedUser.profilePictureUrl : "",
          });
        }
      } catch {
        if (isMounted) {
          setUserState(null);
        }
      } finally {
        if (isMounted) {
          setIsHydrated(true);
        }
      }
    };

    void restoreUser();

    return () => {
      isMounted = false;
    };
  }, []);

  const value = useMemo(
    () => ({
      clearUser: async () => {
        const studentNumber = user?.studentNumber;
        setApiAuthToken(null);
        resetMuniWardrobe();
        setUserState(null);
        await deleteAuthToken();
        await clearAuthSessionProfile();
        if (studentNumber) {
          await clearAllStudentData(studentNumber);
        }
      },
      isHydrated,
      setUser: (nextUser: AuthUser | null) => {
        setApiAuthToken(nextUser?.token ?? null);
        setUserState(nextUser);

        if (nextUser) {
          void (async () => {
            await setAuthToken(nextUser.token ?? null);
            await setAuthRefreshToken(nextUser.refreshToken ?? null);
            await writeAuthSessionProfile({ ...nextUser });
            await hydrateMuniWardrobe(nextUser.studentNumber);
          })();
          return;
        }

        resetMuniWardrobe();
        void (async () => {
          await deleteAuthToken();
          await clearAuthSessionProfile();
        })();
      },
      user,
    }),
    [isHydrated, user],
  );

  return <AuthSessionContext.Provider value={value}>{children}</AuthSessionContext.Provider>;
}

export function useAuthSession() {
  const context = useContext(AuthSessionContext);

  if (!context) {
    throw new Error("useAuthSession must be used within AuthSessionProvider.");
  }

  return context;
}
