import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

/** Legacy AsyncStorage session blob (may still contain a token until migrated). */
export const AUTH_SESSION_STORAGE_KEY = "bawat-tala.auth-user";

/** Auth access token — SecureStore only after migration. */
export const AUTH_TOKEN_SECURE_KEY = "bawat-tala.auth-token";

/** Optional refresh token slot (written only if a refresh token is ever present). */
export const AUTH_REFRESH_TOKEN_SECURE_KEY = "bawat-tala.auth-refresh-token";

type SessionLike = {
  refreshToken?: unknown;
  token?: unknown;
  [key: string]: unknown;
};

async function secureGet(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

async function secureSet(key: string, value: string): Promise<void> {
  await SecureStore.setItemAsync(key, value);
}

async function secureDelete(key: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {
    // Already missing or unavailable on this platform.
  }
}

export async function getAuthToken(): Promise<string | null> {
  const token = await secureGet(AUTH_TOKEN_SECURE_KEY);
  return token && token.trim() ? token : null;
}

export async function setAuthToken(token: string | null): Promise<void> {
  if (!token || !token.trim()) {
    await deleteAuthToken();
    return;
  }
  await secureSet(AUTH_TOKEN_SECURE_KEY, token.trim());
}

export async function getAuthRefreshToken(): Promise<string | null> {
  const token = await secureGet(AUTH_REFRESH_TOKEN_SECURE_KEY);
  return token && token.trim() ? token : null;
}

export async function setAuthRefreshToken(token: string | null): Promise<void> {
  if (!token || !token.trim()) {
    await secureDelete(AUTH_REFRESH_TOKEN_SECURE_KEY);
    return;
  }
  await secureSet(AUTH_REFRESH_TOKEN_SECURE_KEY, token.trim());
}

/** Deletes access + refresh tokens from SecureStore. */
export async function deleteAuthToken(): Promise<void> {
  await secureDelete(AUTH_TOKEN_SECURE_KEY);
  await secureDelete(AUTH_REFRESH_TOKEN_SECURE_KEY);
}

/**
 * One-time migration: if AsyncStorage still holds a token (or refreshToken)
 * inside the session blob, copy into SecureStore and rewrite the blob without secrets.
 */
export async function migrateAuthTokenFromAsyncStorageOnce(): Promise<{
  refreshToken: string | null;
  token: string | null;
}> {
  let token = await getAuthToken();
  let refreshToken = await getAuthRefreshToken();

  const storedValue = await AsyncStorage.getItem(AUTH_SESSION_STORAGE_KEY);
  if (!storedValue) {
    return { token, refreshToken };
  }

  let parsed: SessionLike | null = null;
  try {
    parsed = JSON.parse(storedValue) as SessionLike;
  } catch {
    return { token, refreshToken };
  }

  const asyncToken = typeof parsed?.token === "string" ? parsed.token.trim() : "";
  const asyncRefresh =
    typeof parsed?.refreshToken === "string" ? String(parsed.refreshToken).trim() : "";

  let rewritten = false;

  if (asyncToken) {
    if (!token) {
      await setAuthToken(asyncToken);
      token = asyncToken;
    }
    delete parsed.token;
    rewritten = true;
  }

  if (asyncRefresh) {
    if (!refreshToken) {
      await setAuthRefreshToken(asyncRefresh);
      refreshToken = asyncRefresh;
    }
    delete parsed.refreshToken;
    rewritten = true;
  }

  if (rewritten && parsed) {
    await AsyncStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(parsed));
  }

  return { token, refreshToken };
}

/** Persist non-secret session profile to AsyncStorage (token fields stripped). */
export async function writeAuthSessionProfile(profile: Record<string, unknown>): Promise<void> {
  const { token: _t, refreshToken: _r, ...safe } = profile as SessionLike;
  await AsyncStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(safe));
}

export async function clearAuthSessionProfile(): Promise<void> {
  await AsyncStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
}
