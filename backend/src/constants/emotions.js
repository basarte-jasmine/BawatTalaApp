const EMOTION_OPTIONS = [
  { id: "excitement", label: "Excitement" },
  { id: "joy", label: "Joy" },
  { id: "contentment", label: "Contentment" },
  { id: "relief", label: "Relief" },
  { id: "embarrassment", label: "Embarrassment" },
  { id: "guilt", label: "Guilt" },
  { id: "disappointment", label: "Disappointment" },
  { id: "sadness", label: "Sadness" },
  { id: "anxiety", label: "Anxiety" },
  { id: "anger", label: "Anger" },
];

const EMOTION_LABELS = Object.fromEntries(
  EMOTION_OPTIONS.map(({ id, label }) => [id, label]),
);

const LEGACY_EMOTION_ALIASES = {
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

function normalizeEmotionId(value) {
  const moodId = String(value || "").trim().toLowerCase();
  return LEGACY_EMOTION_ALIASES[moodId] || moodId;
}

function getEmotionLabel(value) {
  const moodId = normalizeEmotionId(value);
  return EMOTION_LABELS[moodId] || "";
}

function createEmotionCounts() {
  return Object.fromEntries(EMOTION_OPTIONS.map(({ id }) => [id, 0]));
}

module.exports = {
  EMOTION_LABELS,
  EMOTION_OPTIONS,
  createEmotionCounts,
  getEmotionLabel,
  normalizeEmotionId,
};
