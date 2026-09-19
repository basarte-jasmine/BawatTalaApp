import AsyncStorage from "@react-native-async-storage/async-storage";
import { claimAchievementReward } from "./backend-api";

export async function unlockAchievement(achievementId: string, studentNumber?: string | null) {
  if (!achievementId || !studentNumber) return null;
  let result;
  try {
    result = await claimAchievementReward(achievementId);
  } catch {
    return null;
  }
  if (result.ok || result.alreadyUnlocked) {
    try {
      await AsyncStorage.setItem(`@bawat-tala/achievement:${achievementId}:${studentNumber}`, "true");
    } catch {
      // The server remains the source of truth if local storage is unavailable.
    }
  }
  return result;
}
