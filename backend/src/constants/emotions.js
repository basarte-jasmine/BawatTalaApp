const EMOTION_OPTIONS = [
  { id: "happy", label: "Happy" },
  { id: "calm", label: "Calm" },
  { id: "sad", label: "Sad" },
  { id: "stressed", label: "Stressed" },
  { id: "angry", label: "Angry" },
  { id: "anxious", label: "Anxious" },
  { id: "excited", label: "Excited" },
  { id: "tired", label: "Tired" },
  { id: "lonely", label: "Lonely" },
  { id: "overwhelmed", label: "Overwhelmed" },
];

const EMOTION_LABELS = Object.fromEntries(
  EMOTION_OPTIONS.map(({ id, label }) => [id, label]),
);

function createEmotionCounts() {
  return Object.fromEntries(EMOTION_OPTIONS.map(({ id }) => [id, 0]));
}

module.exports = {
  EMOTION_LABELS,
  EMOTION_OPTIONS,
  createEmotionCounts,
};
