import Constants from "expo-constants";
import { Platform } from "react-native";

export const RENDER_API_BASE_URL = "https://bawattalaapp.onrender.com";
const LOCAL_API_PORT = "4002";

function isLoopbackHost(host: string) {
  const h = host.trim().toLowerCase();
  return h === "localhost" || h === "127.0.0.1" || h === "0.0.0.0" || h === "::1" || h === "10.0.2.2";
}

function isPrivateLanHost(host: string) {
  return /^(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3})$/.test(
    host.trim(),
  );
}

function isLoopbackUrl(url: string) {
  try {
    return isLoopbackHost(new URL(url).hostname);
  } catch {
    return /localhost|127\.0\.0\.1|0\.0\.0\.0|10\.0\.2\.2/i.test(url);
  }
}

function isPrivateLanUrl(url: string) {
  try {
    return isPrivateLanHost(new URL(url).hostname);
  } catch {
    return /192\.168\.|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\./i.test(url);
  }
}

/** True for release / store / static web builds. LAN URLs must never ship here. */
function isProductionClient() {
  return typeof __DEV__ !== "undefined" ? !__DEV__ : process.env.NODE_ENV === "production";
}

/** LAN/dev host Expo is serving from (physical phones use this, not localhost). */
export function getExpoDevHost(): string | null {
  const candidates = [
    Constants.expoConfig?.hostUri,
    (Constants as { expoGoConfig?: { debuggerHost?: string } }).expoGoConfig?.debuggerHost,
    (Constants as { manifest2?: { extra?: { expoGo?: { debuggerHost?: string }; expoClient?: { hostUri?: string } } } })
      .manifest2?.extra?.expoGo?.debuggerHost,
    (Constants as { manifest2?: { extra?: { expoClient?: { hostUri?: string } } } }).manifest2?.extra?.expoClient
      ?.hostUri,
    (Constants as { manifest?: { debuggerHost?: string; hostUri?: string } }).manifest?.debuggerHost,
    (Constants as { manifest?: { debuggerHost?: string; hostUri?: string } }).manifest?.hostUri,
  ];

  for (const value of candidates) {
    if (!value || typeof value !== "string") continue;
    const host = value.split(":")[0]?.trim();
    if (host && !isLoopbackHost(host)) {
      return host;
    }
  }
  return null;
}

function withLocalPort(host: string) {
  return `http://${host}:${LOCAL_API_PORT}`;
}

/**
 * Resolves the backend base URL for the current device.
 * Production never keeps private LAN / loopback hosts (those only work on one Wi-Fi).
 */
export function resolveApiBaseUrl(rawEnvUrl?: string | null): string {
  const envUrl = String(rawEnvUrl || "").trim().replace(/\/$/, "");
  const production = isProductionClient();

  // Release builds: never honor LAN/loopback env leftovers from a local .env bake.
  if (production) {
    if (envUrl && !isLoopbackUrl(envUrl) && !isPrivateLanUrl(envUrl)) {
      return envUrl;
    }
    return RENDER_API_BASE_URL;
  }

  if (Platform.OS === "web" && typeof window !== "undefined") {
    const host = window.location.hostname;
    if (!isLoopbackHost(host)) {
      if (isPrivateLanHost(host)) {
        if (envUrl && !isLoopbackUrl(envUrl) && !isPrivateLanUrl(envUrl)) {
          return envUrl;
        }
        return withLocalPort(host);
      }
      if (envUrl && !isLoopbackUrl(envUrl) && !isPrivateLanUrl(envUrl)) {
        return envUrl;
      }
      return RENDER_API_BASE_URL;
    }
  }

  if (envUrl && !isLoopbackUrl(envUrl)) {
    // Dev: allow explicit LAN for local phone testing.
    return envUrl;
  }

  const expoHost = getExpoDevHost();
  if (expoHost) {
    return withLocalPort(expoHost);
  }

  if (Platform.OS === "android") {
    return withLocalPort("10.0.2.2");
  }

  return withLocalPort("localhost");
}

export const API_BASE_URL = resolveApiBaseUrl(process.env.EXPO_PUBLIC_API_BASE_URL);