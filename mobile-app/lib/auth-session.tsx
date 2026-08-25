import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from "react";

export type AuthUser = {
  email: string;
  firstName: string;
  fullName: string;
  profilePictureUrl?: string;
  studentNumber: string;
};

type AuthSessionContextValue = {
  clearUser: () => void;
  isHydrated: boolean;
  setUser: (user: AuthUser | null) => void;
  user: AuthUser | null;
};

const AuthSessionContext = createContext<AuthSessionContextValue | null>(null);
const AUTH_SESSION_STORAGE_KEY = "bawat-tala.auth-user";

export function AuthSessionProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const restoreUser = async () => {
      try {
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
          setUser({
            ...parsedUser,
            profilePictureUrl:
              typeof parsedUser.profilePictureUrl === "string" ? parsedUser.profilePictureUrl : "",
          });
        }
      } catch {
        if (isMounted) {
          setUser(null);
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
      clearUser: () => {
        setUser(null);
        void AsyncStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
      },
      isHydrated,
      setUser: (nextUser: AuthUser | null) => {
        setUser(nextUser);

        if (nextUser) {
          void AsyncStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(nextUser));
          return;
        }

        void AsyncStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
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
