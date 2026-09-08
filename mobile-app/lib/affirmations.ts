import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

const AFFIRMATIONS_ENDPOINT = "https://www.affirmations.dev/";
const AFFIRMATIONS_STORAGE_KEY = "bawat-tala.cached-affirmations.v7";

const NEGATIVE_TRIGGER_WORDS = [
  "die",
  "death",
  "kill",
  "dead",
  "hate",
  "haters",
  "grave",
  "suck",
  "sucking",
  "shadows get darker",
  "pain",
  "suffer",
  "cruel",
  "fear",
  "afraid",
  "flaws",
  "failure",
  "fool",
  "sad",
  "grief",
  "tragedy",
  "evil",
  "ugly",
  "darkness",
  "doom",
  "worthless",
  "enemy",
  "dick",
  "shit",
  "hair is thinning",
  "scalp",
  "cars are bad",
  "shipwreck",
  "naked",
  "mouth closed",
  "religion",
  "press makes",
  "surrenders to god",
];

export function isUpbeatAndPositive(text: unknown): boolean {
  if (!text || typeof text !== "string") return false;
  const clean = text.trim();
  if (clean.length < 10 || clean.length > 140) return false;
  if (clean.includes("Too many requests") || clean.includes("auth key")) return false;

  const lower = clean.toLowerCase();
  for (const word of NEGATIVE_TRIGGER_WORDS) {
    const regex = new RegExp(`\\b${word}\\b`, "i");
    if (regex.test(lower)) {
      return false;
    }
  }
  return true;
}

function getDefaultApiBaseUrl() {
  return Platform.OS === "android"
    ? "http://10.0.2.2:4002"
    : "http://localhost:4002";
}

function normalizeApiBaseUrl(rawUrl: string) {
  if (
    Platform.OS === "android" &&
    (rawUrl.includes("localhost") || rawUrl.includes("127.0.0.1"))
  ) {
    return rawUrl
      .replace("localhost", "10.0.2.2")
      .replace("127.0.0.1", "10.0.2.2");
  }
  return rawUrl;
}

const API_BASE_URL = normalizeApiBaseUrl(
  process.env.EXPO_PUBLIC_API_BASE_URL ?? getDefaultApiBaseUrl(),
);

async function tryFetchJson(url: string, timeoutMs = 3500): Promise<any> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const separator = url.includes("?") ? "&" : "?";
    const cacheBustedUrl = `${url}${separator}_t=${Date.now() + Math.random()}`;
    const res = await fetch(cacheBustedUrl, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
      },
    });
    if (res.ok) {
      return await res.json();
    }
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
  return null;
}

export async function fetchAffirmationFromApi(): Promise<string | null> {
  // 1. Backend proxy endpoint
  const backendData = await tryFetchJson(`${API_BASE_URL}/api/affirmations`);
  if (typeof backendData?.quote === "string" && isUpbeatAndPositive(backendData.quote)) {
    return backendData.quote.trim();
  }
  if (typeof backendData?.affirmation === "string" && isUpbeatAndPositive(backendData.affirmation)) {
    return backendData.affirmation.trim();
  }

  // 2. affirmations.dev direct (positive self-help affirmations only)
  const affData = await tryFetchJson(AFFIRMATIONS_ENDPOINT);
  if (typeof affData?.affirmation === "string" && isUpbeatAndPositive(affData.affirmation)) {
    return affData.affirmation.trim();
  }

  return null;
}

export async function getStoredAffirmations(): Promise<string[]> {
  try {
    const stored = await AsyncStorage.getItem(AFFIRMATIONS_STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => isUpbeatAndPositive(item));
    }
    return [];
  } catch {
    return [];
  }
}

export async function storeAffirmation(affirmation: string): Promise<void> {
  if (!isUpbeatAndPositive(affirmation)) return;
  const clean = affirmation.trim();

  try {
    const existing = await getStoredAffirmations();
    const updated = [clean, ...existing.filter((item) => item !== clean)].slice(0, 50);
    await AsyncStorage.setItem(AFFIRMATIONS_STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage failure
  }
}
