import Constants from "expo-constants";
import { Platform } from "react-native";

/**
 * Public API gateway (Vercel rewrites /api + /health → Render).
 * Same pattern as admin-web: some networks time out on *.onrender.com directly.
 */
export const API_GATEWAY_BASE_URL = "https://bawat-tala-app.vercel.app";

/** @deprecated Use API_GATEWAY_BASE_URL — kept so older imports keep working. */
export const RENDER_API_BASE_URL = API_GATEWAY_BASE_URL;

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

function isRenderHostedUrl(url: string) {
  try {
    return new URL(url).hostname.endsWith(".onrender.com");
  } catch {
    return /\.onrender\.com/i.test(url);
  }
}

function isVercelHost(host: string) {
  const h = host.trim().toLowerCase();
  return h.endsWith(".vercel.app") || h.includes("vercel");
}

/** True for release / store / static web builds. */
function isProductionClient() {
  return typeof __DEV__ !== "undefined" ? !__DEV__ : process.env.NODE_ENV === "production";
}

/** Opt-in only: LAN backend for local Wi-Fi testing. Default is the Vercel→Render gateway. */
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
 * Prefer a public non-Render URL. Direct *.onrender.com is rejected because some
 * devices/networks time out reaching Render (admin already proxies via Vercel).
 */
function pickPublicApiUrl(envUrl: string): string | null {
  if (!envUrl) return null;
  if (isLoopbackUrl(envUrl) || isPrivateLanUrl(envUrl) || isRenderHostedUrl(envUrl)) {
    return null;
  }
  return envUrl;
}

/**
 * Resolves the backend base URL for the current device.
 * - Web on Vercel: same-origin "" so /api and /health use Vercel rewrites (admin fix).
 * - APK / other clients: https://bawat-tala-app.vercel.app (gateway → Render).
 * - Never default to bawattalaapp.onrender.com.
 */
export function resolveApiBaseUrl(rawEnvUrl?: string | null): string {
  const envUrl = String(rawEnvUrl || "").trim().replace(/\/$/, "");
  const production = isProductionClient();
  const lanOk = allowLanApi();

  // Expo web hosted on Vercel: relative paths → same-origin proxy (no direct Render).
  if (Platform.OS === "web" && typeof window !== "undefined") {
    const host = window.location.hostname;
    if (isVercelHost(host)) {
      return "";
    }
  }

  const publicEnv = pickPublicApiUrl(envUrl);

  if (production) {
    return publicEnv || API_GATEWAY_BASE_URL;
  }

  // Dev / Expo Go: public gateway by default so cellular / other Wi-Fi works.
  if (publicEnv) {
    return publicEnv;
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

  return API_GATEWAY_BASE_URL;
}

export const API_BASE_URL = resolveApiBaseUrl(process.env.EXPO_PUBLIC_API_BASE_URL);

/** For debug / clearer login errors. */
export function getResolvedApiBaseUrl() {
  return API_BASE_URL;
}