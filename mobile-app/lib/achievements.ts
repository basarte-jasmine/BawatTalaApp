import AsyncStorage from "@react-native-async-storage/async-storage";

export async function unlockAchievement(achievementId: string, studentNumber?: string | null) {
  if (!achievementId || !studentNumber) return;
  try {
    await AsyncStorage.setItem(`@bawat-tala/achievement:${achievementId}:${studentNumber}`, "true");
  } catch {
    // Achievement display can retry on the next visit if local storage is unavailable.
  }
}
