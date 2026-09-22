import Constants from "expo-constants";
import { Platform } from "react-native";

const RENDER_API_BASE_URL = "https://bawattalaapp.onrender.com";
const LOCAL_API_PORT = "4002";

function isLoopbackHost(host: string) {
  const h = host.trim().toLowerCase();
  return h === "localhost" || h === "127.0.0.1" || h === "0.0.0.0" || h === "::1";
}

function isLoopbackUrl(url: string) {
  try {
    const parsed = new URL(url);
    return isLoopbackHost(parsed.hostname);
  } catch {
    return /localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(url);
  }
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
 * Resolves the backend base URL for the current device:
 * - Explicit non-loopback EXPO_PUBLIC_API_BASE_URL wins
 * - Loopback env is ignored on native so physical phones use Expo's LAN host
 * - Android emulator falls back to 10.0.2.2
 * - Hosted web falls back to Render
 */
export function resolveApiBaseUrl(rawEnvUrl?: string | null): string {
  const envUrl = String(rawEnvUrl || "").trim();

  if (Platform.OS === "web" && typeof window !== "undefined") {
    const host = window.location.hostname;
    if (!isLoopbackHost(host)) {
      if (envUrl && !isLoopbackUrl(envUrl)) {
        return envUrl.replace(/\/$/, "");
      }
      return RENDER_API_BASE_URL;
    }
  }

  if (envUrl && !isLoopbackUrl(envUrl)) {
    if (Platform.OS === "android" && (envUrl.includes("localhost") || envUrl.includes("127.0.0.1"))) {
      return envUrl.replace("localhost", "10.0.2.2").replace("127.0.0.1", "10.0.2.2").replace(/\/$/, "");
    }
    return envUrl.replace(/\/$/, "");
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
