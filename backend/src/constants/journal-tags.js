const JOURNAL_POSITIVE_TAGS = [
  "Gratitude / Appreciation",
  "Hobbies & Interests",
  "Travel & Adventure",
  "Personal Growth / Epiphanies",
  "Spirituality / Faith",
];

const JOURNAL_CONCERN_TAGS = [
  "Personal problems",
  "Mental health",
  "Academic problems",
  "Interpersonal relationships",
  "Peer",
  "Family",
  "Romantic",
  "Career guidance",
  "Financial guidance",
  "Anxiety",
  "Stress",
  "Bullying",
  "Adjustment",
  "Others",
];

const JOURNAL_TAG_OPTIONS = [...JOURNAL_POSITIVE_TAGS, ...JOURNAL_CONCERN_TAGS];

const TAG_BY_NORMALIZED = new Map(
  JOURNAL_TAG_OPTIONS.map((tag) => [tag.toLowerCase(), tag]),
);

function uniqueTags(tags) {
  const deduped = [];
  for (const tag of tags) {
    if (tag && !deduped.includes(tag)) {
      deduped.push(tag);
    }
  }
  return deduped;
}

function expandJournalTag(value) {
  const normalized = String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();

  if (!normalized) return [];
  if (TAG_BY_NORMALIZED.has(normalized)) return [TAG_BY_NORMALIZED.get(normalized)];

  const aliases = {
    academic: ["Academic problems"],
    "academic problem": ["Academic problems"],
    "academic problems": ["Academic problems"],
    "academic stress": ["Academic problems", "Stress"],
    anxiety: ["Anxiety"],
    stress: ["Stress"],
    "anxiety/stress": ["Anxiety", "Stress"],
    "anxiety / stress": ["Anxiety", "Stress"],
    relationship: ["Interpersonal relationships"],
    relationships: ["Interpersonal relationships"],
    "interpersonal relationship": ["Interpersonal relationships"],
    "interpersonal relationships": ["Interpersonal relationships"],
    peer: ["Peer"],
    "peer relationship": ["Interpersonal relationships", "Peer"],
    family: ["Family"],
    "family issues": ["Interpersonal relationships", "Family"],
    "family relationship": ["Interpersonal relationships", "Family"],
    romantic: ["Romantic"],
    "romantic relationship": ["Interpersonal relationships", "Romantic"],
    career: ["Career guidance"],
    "career guidance": ["Career guidance"],
    financial: ["Financial guidance"],
    "financial concern": ["Financial guidance"],
    "financial concerns": ["Financial guidance"],
    "financial guidance": ["Financial guidance"],
    burnout: ["Stress"],
    "burnout / exhaustion": ["Stress"],
    "burnout/exhaustion": ["Stress"],
    bullying: ["Bullying"],
    adjustment: ["Adjustment"],
    "personal problem": ["Personal problems"],
    "personal problems": ["Personal problems"],
    "mental health": ["Mental health"],
    other: ["Others"],
    others: ["Others"],
  };

  return aliases[normalized] || [];
}

function normalizeJournalTag(value) {
  return expandJournalTag(value)[0] || "";
}

function normalizeJournalTags(value) {
  const rawItems = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];

  return uniqueTags(rawItems.flatMap((item) => expandJournalTag(item)));
}

function inferJournalTagsFromText(text) {
  const value = String(text || "").toLowerCase();
  if (!value) return ["Others"];

  const tags = [];
  const add = (...items) => {
    for (const item of items) {
      if (item && !tags.includes(item)) tags.push(item);
    }
  };

  if (/\b(grateful|gratitude|thankful|appreciate|appreciation|salamat)\b/.test(value)) {
    add("Gratitude / Appreciation");
  }
  if (/\b(hobby|hobbies|music|song|draw|drawing|paint|painting|game|gaming|dance|sport|reading|book|interest)\b/.test(value)) {
    add("Hobbies & Interests");
  }
  if (/\b(travel|trip|adventure|vacation|journey|explore|outing)\b/.test(value)) {
    add("Travel & Adventure");
  }
  if (/\b(realized|realised|learned|learnt|growth|epiphany|improve|improving|reflection|breakthrough)\b/.test(value)) {
    add("Personal Growth / Epiphanies");
  }
  if (/\b(faith|pray|prayer|church|spiritual|spirituality|god|lord)\b/.test(value)) {
    add("Spirituality / Faith");
  }
  if (/\b(personal|identity|self-worth|self worth|private problem|my problem)\b/.test(value)) {
    add("Personal problems");
  }
  if (/\b(mental|depress|depression|hopeless|self-harm|self harm|suicide|suicidal|panic)\b/.test(value)) {
    add("Mental health");
  }
  if (/\b(school|exam|exams|quiz|quizzes|grade|grades|class|academic|study|professor|teacher|subject|assignment|assignments|thesis|project|projects)\b/.test(value)) {
    add("Academic problems");
  }
  if (/\b(friend|friends|friendship|classmate|peer|social|relationship|relationships)\b/.test(value)) {
    add("Interpersonal relationships", "Peer");
  }
  if (/\b(family|mother|father|parent|parents|sibling|sister|brother|home)\b/.test(value)) {
    add("Interpersonal relationships", "Family");
  }
  if (/\b(romantic|crush|boyfriend|girlfriend|partner|dating|breakup|ex|love life)\b/.test(value)) {
    add("Interpersonal relationships", "Romantic");
  }
  if (/\b(career|course shift|future|profession|job|internship|resume|work)\b/.test(value)) {
    add("Career guidance");
  }
  if (/\b(money|financial|tuition|budget|allowance|debt|expense|expenses)\b/.test(value)) {
    add("Financial guidance");
  }
  if (/\b(anxiety|anxious|worry|worried|panic)\b/.test(value)) {
    add("Anxiety");
  }
  if (/\b(stress|stressed|overwhelmed|burnout|burned out|burnt out|pressure|exhausted|drained)\b/.test(value)) {
    add("Stress");
  }
  if (/\b(bully|bullied|bullying|harass|harassed|harassment)\b/.test(value)) {
    add("Bullying");
  }
  if (/\b(adjust|adjustment|homesick|new school|transition|settle|settling)\b/.test(value)) {
    add("Adjustment");
  }

  return tags.length ? tags : ["Others"];
}

function resolveJournalEntryTags(row = {}) {
  const storedTags = normalizeJournalTags(row.concern_tags);
  if (storedTags.length) return storedTags;

  const primaryTags = normalizeJournalTags(row.primary_concern);
  if (primaryTags.length) return primaryTags;

  const text = [
    row.summary,
    row.admin_flag_reason,
    ...(Array.isArray(row.insights) ? row.insights : []),
  ].join(" ");

  if (!String(text || "").trim()) return [];
  return inferJournalTagsFromText(text);
}

module.exports = {
  JOURNAL_CONCERN_TAGS,
  JOURNAL_POSITIVE_TAGS,
  JOURNAL_TAG_OPTIONS,
  inferJournalTagsFromText,
  normalizeJournalTag,
  normalizeJournalTags,
  resolveJournalEntryTags,
};
