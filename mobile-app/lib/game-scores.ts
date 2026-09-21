import AsyncStorage from "@react-native-async-storage/async-storage";

export async function getGameScore(gameId: string) {
  try {
    const data = await AsyncStorage.getItem(`@bawat-tala/game-scores:${gameId}`);
    return data ? JSON.parse(data) : null;
  } catch (e) {
    return null;
  }
}

export async function saveGameScore(gameId: string, scoreData: any) {
  try {
    const existing = await getGameScore(gameId) || {};
    const updated = { ...existing, ...scoreData };
    await AsyncStorage.setItem(`@bawat-tala/game-scores:${gameId}`, JSON.stringify(updated));
  } catch (e) {}
}
