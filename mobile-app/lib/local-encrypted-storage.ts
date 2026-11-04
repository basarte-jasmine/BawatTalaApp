import * as SecureStore from "expo-secure-store";
import CryptoJS from "crypto-js";
import AsyncStorage from "@react-native-async-storage/async-storage";

const DEVICE_KEY_SECURE = "bawat-tala.local-data-aes-key";
const DEVICE_KEY_FALLBACK = "bawat-tala.local-data-aes-key-fallback";
const CIPHER_PREFIX = "btenc:v1:";

let memoryDeviceKey: string | null = null;

async function getOrCreateDeviceKey(): Promise<string> {
  if (memoryDeviceKey && memoryDeviceKey.length >= 32) return memoryDeviceKey;
  try {
    const existing = await SecureStore.getItemAsync(DEVICE_KEY_SECURE);
    if (existing && existing.length >= 32) {
      memoryDeviceKey = existing;
      return existing;
    }
  } catch {}
  try {
    const fallback = await AsyncStorage.getItem(DEVICE_KEY_FALLBACK);
    if (fallback && fallback.length >= 32) {
      memoryDeviceKey = fallback;
      try { await SecureStore.setItemAsync(DEVICE_KEY_SECURE, fallback); } catch {}
      return fallback;
    }
  } catch {}
  const key = CryptoJS.lib.WordArray.random(32).toString(CryptoJS.enc.Hex);
  memoryDeviceKey = key;
  try { await SecureStore.setItemAsync(DEVICE_KEY_SECURE, key); } catch {}
  try { await AsyncStorage.setItem(DEVICE_KEY_FALLBACK, key); } catch {}
  return key;
}

export function looksLikeEncryptedPayload(value: string | null | undefined): boolean {
  return Boolean(value && value.startsWith(CIPHER_PREFIX));
}

/** AES-256 encrypt a UTF-8 string for AsyncStorage at rest. */
export async function encryptLocalPayload(plaintext: string): Promise<string> {
  const key = await getOrCreateDeviceKey();
  const encrypted = CryptoJS.AES.encrypt(plaintext, key).toString();
  return `${CIPHER_PREFIX}${encrypted}`;
}

/** Decrypt a payload previously written by encryptLocalPayload. Plaintext pass-through for migration. */
export async function decryptLocalPayload(stored: string): Promise<string> {
  if (!looksLikeEncryptedPayload(stored)) {
    return stored;
  }
  const key = await getOrCreateDeviceKey();
  const cipherText = stored.slice(CIPHER_PREFIX.length);
  try {
    const bytes = CryptoJS.AES.decrypt(cipherText, key);
    const plaintext = bytes.toString(CryptoJS.enc.Utf8);
    if (!plaintext) {
      throw new Error("Unable to decrypt local payload.");
    }
    return plaintext;
  } catch {
    throw new Error("Unable to decrypt local payload.");
  }
}
