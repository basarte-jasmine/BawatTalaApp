import type { ImageSourcePropType } from "react-native";

export type EmotionOption = {
  color: string;
  id: string;
  image: ImageSourcePropType | null;
  label: string;
};

const EMOTION_IMAGES = {
  anger: require("../assets/images/Emotions/angry.gif"),
  anxiety: require("../assets/images/Emotions/anxious.gif"),
  contentment: require("../assets/images/Emotions/Contentment.gif"),
  disappointment: require("../assets/images/Emotions/Disappointment .gif"),
  embarrassment: require("../assets/images/Emotions/Embarrassment .gif"),
  excitement: require("../assets/images/Emotions/Excitement .gif"),
  guilt: require("../assets/images/Emotions/Guilt.gif"),
  joy: require("../assets/images/Emotions/Joy.gif"),
  relief: require("../assets/images/Emotions/Relief.gif"),
  sadness: require("../assets/images/Emotions/sad.gif"),
} satisfies Record<string, ImageSourcePropType>;

export const EMOTIONS: EmotionOption[] = [
  { color: "#FDBA58", id: "excitement", image: EMOTION_IMAGES.excitement, label: "Excited" },
  { color: "#FFD616", id: "joy", image: EMOTION_IMAGES.joy, label: "Joy" },
  { color: "#97CFDA", id: "contentment", image: EMOTION_IMAGES.contentment, label: "Content" },
  { color: "#78C6A3", id: "relief", image: EMOTION_IMAGES.relief, label: "Relief" },
  { color: "#F0A0B8", id: "embarrassment", image: EMOTION_IMAGES.embarrassment, label: "Embarrass" },
  { color: "#B895C8", id: "guilt", image: EMOTION_IMAGES.guilt, label: "Guilt" },
  { color: "#A7B4C6", id: "disappointment", image: EMOTION_IMAGES.disappointment, label: "Disappointed" },
  { color: "#7EA9D9", id: "sadness", image: EMOTION_IMAGES.sadness, label: "Sadness" },
  { color: "#F19137", id: "anxiety", image: EMOTION_IMAGES.anxiety, label: "Anxiety" },
  { color: "#E86686", id: "anger", image: EMOTION_IMAGES.anger, label: "Anger" },
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
