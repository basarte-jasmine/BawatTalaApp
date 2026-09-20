import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { claimAchievementReward, enqueuePendingAchievement } from "./backend-api";

const EMOTION_PROGRESS_KEY = "@bawat-tala/achievement-emotions";

export async function unlockAchievement(achievementId: string, studentNumber?: string | null) {
  if (!achievementId || !studentNumber) return null;
  let result;
  try {
    result = await claimAchievementReward(achievementId);
  } catch {
    await enqueuePendingAchievement(studentNumber, achievementId);
    return null;
  }
  if (!result || (!(result.ok || result.alreadyUnlocked) && looksLikeNetworkFailure(result))) {
    await enqueuePendingAchievement(studentNumber, achievementId);
    return result ?? null;
  }
  if (result.ok || result.alreadyUnlocked) {
    try {
      await AsyncStorage.setItem(`@bawat-tala/achievement:${achievementId}:${studentNumber}`, "true");
      if (result.ok && !result.alreadyUnlocked) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "Achievement Unlocked!",
            body: result.message || "You earned a new achievement.",
          },
          trigger: null,
        });
      }
    } catch {
      // The server remains the source of truth if local storage is unavailable.
    }
  }
  return result;
}

function looksLikeNetworkFailure(result: { ok?: boolean; message?: string } | null | undefined) {
  if (!result || result.ok) return false;
  const message = String(result.message || "").toLowerCase();
  return (
    message.includes("network") ||
    message.includes("timeout") ||
    message.includes("failed to fetch") ||
    message.includes("connection") ||
    message.includes("offline")
  );
}

export async function recordEmotionForAchievement(emotionId: string, studentNumber?: string | null) {
  if (!emotionId || !studentNumber) return;
  try {
    const key = `${EMOTION_PROGRESS_KEY}:${studentNumber}`;
    const stored = await AsyncStorage.getItem(key);
    const emotions = new Set<string>(stored ? JSON.parse(stored) : []);
    emotions.add(emotionId);
    await AsyncStorage.setItem(key, JSON.stringify([...emotions]));
    const required = ["excitement", "joy", "contentment", "relief", "embarrassment", "guilt", "disappointment", "sadness", "anxiety", "anger"];
    if (required.every((id) => emotions.has(id))) await unlockAchievement("a-sky-with-many-colors", studentNumber);
  } catch {
    // Emotion history remains available if achievement progress cannot be cached.
  }
}
