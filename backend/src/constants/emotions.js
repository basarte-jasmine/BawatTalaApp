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
  stress: "anxiety",
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

/**
 * Resolves the single representative emotion for a day from all its emotion check-in records.
 * Rule 1: Most frequently recorded emotion for the day.
 * Rule 2: If tie in frequency, the latest recorded emotion among the tied emotions wins.
 * Rule 3: Single check-in uses that emotion.
 * Rule 4: No check-in preserves empty state (returns null).
 */
function resolveRepresentativeEmotion(entries = []) {
  if (!Array.isArray(entries) || entries.length === 0) return null;
  const counts = new Map();
  const latestTimeMap = new Map();
  for (const entry of entries) {
    const rawId = entry.mood_id || entry.moodId;
    if (!rawId) continue;
    const normId = normalizeEmotionId(rawId);
    if (!normId) continue;
    counts.set(normId, (counts.get(normId) || 0) + 1);
    const rawTime = entry.created_at || entry.createdAt || entry.timestamp || 0;
    const timeMs = rawTime ? new Date(rawTime).getTime() : 0;
    const prevTime = latestTimeMap.get(normId) || 0;
    if (timeMs >= prevTime) {
      latestTimeMap.set(normId, timeMs);
    }
  }
  if (counts.size === 0) return null;
  let bestMoodId = null;
  let maxCount = -1;
  let latestTiedTime = -1;
  for (const [moodId, count] of counts.entries()) {
    const latestTime = latestTimeMap.get(moodId) || 0;
    if (count > maxCount || (count === maxCount && latestTime >= latestTiedTime)) {
      bestMoodId = moodId;
      maxCount = count;
      latestTiedTime = latestTime;
    }
  }
  return bestMoodId;
}

module.exports = {
  EMOTION_LABELS,
  EMOTION_OPTIONS,
  LEGACY_EMOTION_ALIASES,
  createEmotionCounts,
  getEmotionLabel,
  normalizeEmotionId,
  resolveRepresentativeEmotion,
};
