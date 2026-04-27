import type { ImageSourcePropType } from "react-native";

export type EmotionOption = {
  color: string;
  id: string;
  image: ImageSourcePropType | null;
  label: string;
};

export const EMOTIONS: EmotionOption[] = [
  { color: "#FDBA58", id: "excitement", image: require("../assets/images/Moods/happy.gif"), label: "Excitement" },
  { color: "#FFD616", id: "joy", image: require("../assets/images/Moods/happy.gif"), label: "Joy" },
  { color: "#97CFDA", id: "contentment", image: require("../assets/images/Moods/calm.gif"), label: "Contentment" },
  { color: "#78C6A3", id: "relief", image: require("../assets/images/Moods/calm.gif"), label: "Relief" },
  { color: "#F0A0B8", id: "embarrassment", image: require("../assets/images/Moods/anxious.gif"), label: "Embarrassment" },
  { color: "#B895C8", id: "guilt", image: require("../assets/images/Moods/anxious.gif"), label: "Guilt" },
  { color: "#A7B4C6", id: "disappointment", image: require("../assets/images/Moods/sad.gif"), label: "Disappointment" },
  { color: "#7EA9D9", id: "sadness", image: require("../assets/images/Moods/sad.gif"), label: "Sadness" },
  { color: "#F19137", id: "anxiety", image: require("../assets/images/Moods/anxious.gif"), label: "Anxiety" },
  { color: "#E86686", id: "anger", image: require("../assets/images/Moods/angry.gif"), label: "Anger" },
];

export const EMOTION_ORDER = EMOTIONS.map((emotion) => emotion.id);

export const LEGACY_EMOTION_ALIASES: Record<string, string> = {
  angry: "anger",
  anxious: "anxiety",
  calm: "contentment",
  excited: "excitement",
  happy: "joy",
  lonely: "sadness",
  overwhelmed: "anxiety",
  sad: "sadness",
  stressed: "anxiety",
  tired: "disappointment",
};

export function normalizeEmotionId(value: string) {
  const emotionId = String(value || "").trim().toLowerCase();
  return LEGACY_EMOTION_ALIASES[emotionId] || emotionId;
}

export const EMOTION_META = Object.fromEntries(
  [
    ...EMOTIONS.map((emotion) => [emotion.id, emotion]),
    ...Object.entries(LEGACY_EMOTION_ALIASES).map(([legacyId, emotionId]) => [
      legacyId,
      EMOTIONS.find((emotion) => emotion.id === emotionId) ?? null,
    ]),
  ].filter((entry): entry is [string, EmotionOption] => Boolean(entry[1])),
) as Record<string, EmotionOption>;

export function createEmotionCounts(): Record<string, number> {
  return Object.fromEntries(EMOTION_ORDER.map((emotionId) => [emotionId, 0])) as Record<string, number>;
}
