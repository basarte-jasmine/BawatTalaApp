import { Asset } from "expo-asset";

export const CRITICAL_ASSETS = [
  require("../assets/images/Tala_Star.png"),
  require("../assets/images/MUNI_default.png"),
  require("../assets/images/MUNI_Active.png"),
  require("../assets/images/MUNI_Outline.png"),
  require("../assets/images/Notification Badge.png"),
  require("../assets/images/Muni/Feet.webp"),
  require("../assets/images/Muni/Body.webp"),
  require("../assets/images/Muni/Right_Hand.png"),
  require("../assets/images/Muni/Arm1.webp"),
  require("../assets/images/Muni/Arm2.webp"),
  require("../assets/images/Muni/Arm3.webp"),
  require("../assets/images/Muni/Eyes_Full_Open.webp"),
  require("../assets/images/Muni/Eyes_Half_Open.webp"),
  require("../assets/images/Muni/Eyes_Closed.webp"),
  require("../assets/images/Background/Beach.webp"),
  require("../assets/images/Background/Garden.webp"),
  require("../assets/images/EmotionsInactive/angry.png"),
  require("../assets/images/EmotionsInactive/anxious.png"),
  require("../assets/images/EmotionsInactive/Contentment.png"),
  require("../assets/images/EmotionsInactive/Disappointment.png"),
  require("../assets/images/EmotionsInactive/Embarrassment.png"),
  require("../assets/images/EmotionsInactive/Excitement.png"),
  require("../assets/images/EmotionsInactive/Guilt.png"),
  require("../assets/images/EmotionsInactive/Joy.png"),
  require("../assets/images/EmotionsInactive/Relief.png"),
  require("../assets/images/EmotionsInactive/sad.png"),
  require("../assets/images/Mini Reset/Fruit Catcher/Fruit Catcher Cover.webp"),
  require("../assets/images/Mini Reset/Galaxy Fall/cover.webp"),
  require("../assets/images/Mini Reset/Gentle Pairs/Gentle Pairs Cover.webp"),
  require("../assets/images/Mini Reset/Muni Match/cover.webp"),
  require("../assets/images/Mini Reset/Puzzle/Muni Puzzle Cover.webp"),
  require("../assets/images/Mini Reset/Unscramble Word/Unscramble Word Cover.webp"),
];

export async function preloadCoreAssetsAsync(): Promise<void> {
  try {
    const assetPromises = CRITICAL_ASSETS.map((asset) => Asset.fromModule(asset).downloadAsync());
    await Promise.all(assetPromises);
  } catch {
    // Non-blocking fallback
  }
}
