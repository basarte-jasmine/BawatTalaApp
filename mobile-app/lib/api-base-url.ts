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

/** True for release / store / static web builds. */
function isProductionClient() {
  return typeof __DEV__ !== "undefined" ? !__DEV__ : process.env.NODE_ENV === "production";
}

/** Opt-in only: LAN backend for local Wi-Fi testing. Default is Render so any network works. */
function allowLanApi() {
  const flag = String(process.env.EXPO_PUBLIC_ALLOW_LAN_API || "").trim().toLowerCase();
  return flag === "1" || flag === "true" || flag === "yes";
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
 * Accounts are NOT limited to one device — failed multi-device login is almost always a bad API host.
 * Private LAN URLs are ignored unless EXPO_PUBLIC_ALLOW_LAN_API=1 (local Wi-Fi testing only).
 */
export function resolveApiBaseUrl(rawEnvUrl?: string | null): string {
  const envUrl = String(rawEnvUrl || "").trim().replace(/\/$/, "");
  const production = isProductionClient();
  const lanOk = allowLanApi();

  // Never ship / honor private LAN or loopback in production builds.
  if (production) {
    if (envUrl && !isLoopbackUrl(envUrl) && !isPrivateLanUrl(envUrl)) {
      return envUrl;
    }
    return RENDER_API_BASE_URL;
  }

  // Dev / Expo Go: default to Render so phones on cellular or other Wi-Fi can log in.
  // LAN only when explicitly allowed.
  if (envUrl && !isLoopbackUrl(envUrl) && !isPrivateLanUrl(envUrl)) {
    return envUrl;
  }

  if (lanOk) {
    if (envUrl && isPrivateLanUrl(envUrl)) {
      return envUrl;
    }
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const host = window.location.hostname;
      if (isPrivateLanHost(host)) {
        return withLocalPort(host);
      }
    }
    const expoHost = getExpoDevHost();
    if (expoHost && isPrivateLanHost(expoHost)) {
      return withLocalPort(expoHost);
    }
    if (Platform.OS === "android") {
      return withLocalPort("10.0.2.2");
    }
    if (envUrl && isLoopbackUrl(envUrl)) {
      return envUrl.replace("localhost", "10.0.2.2").replace("127.0.0.1", "10.0.2.2");
    }
    return withLocalPort("localhost");
  }

  // Hosted web (non-LAN hostname) or any device without LAN opt-in → Render.
  if (Platform.OS === "web" && typeof window !== "undefined") {
    const host = window.location.hostname;
    if (!isLoopbackHost(host) && !isPrivateLanHost(host)) {
      return RENDER_API_BASE_URL;
    }
  }

  return RENDER_API_BASE_URL;
}

export const API_BASE_URL = resolveApiBaseUrl(process.env.EXPO_PUBLIC_API_BASE_URL);

/** For debug / clearer login errors. */
export function getResolvedApiBaseUrl() {
  return API_BASE_URL;
}
