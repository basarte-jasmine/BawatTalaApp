import { createContext, PropsWithChildren, useContext, useMemo, useState } from "react";

export type AuthUser = {
  email: string;
  firstName: string;
  fullName: string;
  studentNumber: string;
};

type AuthSessionContextValue = {
  clearUser: () => void;
  setUser: (user: AuthUser | null) => void;
  user: AuthUser | null;
};

const AuthSessionContext = createContext<AuthSessionContextValue | null>(null);

export function AuthSessionProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<AuthUser | null>(null);

  const value = useMemo(
    () => ({
      clearUser: () => setUser(null),
      setUser,
      user,
    }),
    [user],
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
