import type { ImageSourcePropType } from "react-native";

export type EmotionOption = {
  activeImage: ImageSourcePropType | null;
  color: string;
  id: string;
  inactiveImage: ImageSourcePropType | null;
  image: ImageSourcePropType | null;
  label: string;
};

const ACTIVE_EMOTION_IMAGES = {
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

const INACTIVE_EMOTION_IMAGES = {
  anger: require("../assets/images/EmotionsInactive/angry.png"),
  anxiety: require("../assets/images/EmotionsInactive/anxious.png"),
  contentment: require("../assets/images/EmotionsInactive/Contentment.png"),
  disappointment: require("../assets/images/EmotionsInactive/Disappointment.png"),
  embarrassment: require("../assets/images/EmotionsInactive/Embarrassment.png"),
  excitement: require("../assets/images/EmotionsInactive/Excitement.png"),
  guilt: require("../assets/images/EmotionsInactive/Guilt.png"),
  joy: require("../assets/images/EmotionsInactive/Joy.png"),
  relief: require("../assets/images/EmotionsInactive/Relief.png"),
  sadness: require("../assets/images/EmotionsInactive/sad.png"),
} satisfies Record<string, ImageSourcePropType>;

export const EMOTIONS: EmotionOption[] = [
  {
    activeImage: ACTIVE_EMOTION_IMAGES.excitement,
    color: "#FDBA58",
    id: "excitement",
    inactiveImage: INACTIVE_EMOTION_IMAGES.excitement,
    image: INACTIVE_EMOTION_IMAGES.excitement,
    label: "Excited",
  },
  {
    activeImage: ACTIVE_EMOTION_IMAGES.joy,
    color: "#FFD616",
    id: "joy",
    inactiveImage: INACTIVE_EMOTION_IMAGES.joy,
    image: INACTIVE_EMOTION_IMAGES.joy,
    label: "Joy",
  },
  {
    activeImage: ACTIVE_EMOTION_IMAGES.contentment,
    color: "#97CFDA",
    id: "contentment",
    inactiveImage: INACTIVE_EMOTION_IMAGES.contentment,
    image: INACTIVE_EMOTION_IMAGES.contentment,
    label: "Content",
  },
  {
    activeImage: ACTIVE_EMOTION_IMAGES.relief,
    color: "#78C6A3",
    id: "relief",
    inactiveImage: INACTIVE_EMOTION_IMAGES.relief,
    image: INACTIVE_EMOTION_IMAGES.relief,
    label: "Relief",
  },
  {
    activeImage: ACTIVE_EMOTION_IMAGES.embarrassment,
    color: "#F0A0B8",
    id: "embarrassment",
    inactiveImage: INACTIVE_EMOTION_IMAGES.embarrassment,
    image: INACTIVE_EMOTION_IMAGES.embarrassment,
    label: "Embarrassed",
  },
  {
    activeImage: ACTIVE_EMOTION_IMAGES.guilt,
    color: "#B895C8",
    id: "guilt",
    inactiveImage: INACTIVE_EMOTION_IMAGES.guilt,
    image: INACTIVE_EMOTION_IMAGES.guilt,
    label: "Guilt",
  },
  {
    activeImage: ACTIVE_EMOTION_IMAGES.disappointment,
    color: "#A7B4C6",
    id: "disappointment",
    inactiveImage: INACTIVE_EMOTION_IMAGES.disappointment,
    image: INACTIVE_EMOTION_IMAGES.disappointment,
    label: "Disappointed",
  },
  {
    activeImage: ACTIVE_EMOTION_IMAGES.sadness,
    color: "#7EA9D9",
    id: "sadness",
    inactiveImage: INACTIVE_EMOTION_IMAGES.sadness,
    image: INACTIVE_EMOTION_IMAGES.sadness,
    label: "Sadness",
  },
  {
    activeImage: ACTIVE_EMOTION_IMAGES.anxiety,
    color: "#F19137",
    id: "anxiety",
    inactiveImage: INACTIVE_EMOTION_IMAGES.anxiety,
    image: INACTIVE_EMOTION_IMAGES.anxiety,
    label: "Anxiety",
  },
  {
    activeImage: ACTIVE_EMOTION_IMAGES.anger,
    color: "#E86686",
    id: "anger",
    inactiveImage: INACTIVE_EMOTION_IMAGES.anger,
    image: INACTIVE_EMOTION_IMAGES.anger,
    label: "Anger",
  },
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

export function getEmotionImageSource(emotion: EmotionOption | null | undefined, active = false) {
  if (!emotion) return null;
  if (active && emotion.activeImage) return emotion.activeImage;
  return emotion.inactiveImage ?? emotion.image;
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
