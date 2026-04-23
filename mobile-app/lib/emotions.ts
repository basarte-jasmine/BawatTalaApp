import type { ImageSourcePropType } from "react-native";

export type EmotionOption = {
  color: string;
  id: string;
  image: ImageSourcePropType | null;
  label: string;
};

export const EMOTIONS: EmotionOption[] = [
  { color: "#FFD616", id: "happy", image: require("../assets/images/Moods/happy.gif"), label: "Happy" },
  { color: "#97CFDA", id: "calm", image: require("../assets/images/Moods/calm.gif"), label: "Calm" },
  { color: "#7EA9D9", id: "sad", image: require("../assets/images/Moods/sad.gif"), label: "Sad" },
  { color: "#F19137", id: "stressed", image: require("../assets/images/Moods/stressed.gif"), label: "Stressed" },
  { color: "#E86686", id: "angry", image: require("../assets/images/Moods/angry.gif"), label: "Angry" },
  { color: "#B895C8", id: "anxious", image: require("../assets/images/Moods/anxious.gif"), label: "Anxious" },
  { color: "#FDBA58", id: "excited", image: null, label: "Excited" },
  { color: "#A7B4C6", id: "tired", image: null, label: "Tired" },
  { color: "#8FA7DB", id: "lonely", image: null, label: "Lonely" },
  { color: "#D68A5C", id: "overwhelmed", image: null, label: "Overwhelmed" },
];

export const EMOTION_ORDER = EMOTIONS.map((emotion) => emotion.id);

export const EMOTION_META = Object.fromEntries(
  EMOTIONS.map((emotion) => [emotion.id, emotion]),
) as Record<string, EmotionOption>;

export function createEmotionCounts(): Record<string, number> {
  return Object.fromEntries(EMOTION_ORDER.map((emotionId) => [emotionId, 0])) as Record<string, number>;
}
