const INTERPERSONAL_RELATIONSHIP_CONCERN = "Interpersonal relationships";
const INTERPERSONAL_RELATIONSHIP_SUBCONCERNS = [
  "Peer relationship",
  "Family relationship",
  "Romantic relationship",
];

const APPOINTMENT_CONCERN_OPTIONS = [
  "Personal problems",
  "Mental health",
  "Career guidance",
  "Financial guidance",
  "Burnout / Exhaustion",
  "Academic problems",
  INTERPERSONAL_RELATIONSHIP_CONCERN,
  "Anxiety",
  "Stress",
  "Bullying",
  "Adjustment",
  "Others",
];

const APPOINTMENT_CONCERN_SUBCATEGORIES = {
  [INTERPERSONAL_RELATIONSHIP_CONCERN]: INTERPERSONAL_RELATIONSHIP_SUBCONCERNS,
};

const APPOINTMENT_CONCERN_VALUES = [
  ...APPOINTMENT_CONCERN_OPTIONS,
  ...INTERPERSONAL_RELATIONSHIP_SUBCONCERNS,
];

function normalizeAppointmentConcern(value) {
  const normalized = String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();

  if (!normalized) return "";

  const exact = APPOINTMENT_CONCERN_VALUES.find(
    (item) => item.toLowerCase() === normalized,
  );
  if (exact) return exact;

  const aliases = {
    academic: "Academic problems",
    "academic stress": "Academic problems",
    "academic problem": "Academic problems",
    anxiety: "Anxiety",
    stress: "Stress",
    "anxiety/stress": "Anxiety",
    "anxiety / stress": "Anxiety",
    relationship: INTERPERSONAL_RELATIONSHIP_CONCERN,
    relationships: INTERPERSONAL_RELATIONSHIP_CONCERN,
    peer: "Peer relationship",
    family: "Family relationship",
    "family issues": "Family relationship",
    romantic: "Romantic relationship",
    career: "Career guidance",
    "career guidance": "Career guidance",
    financial: "Financial guidance",
    "financial concern": "Financial guidance",
    "financial concerns": "Financial guidance",
    burnout: "Burnout / Exhaustion",
    "burnout / exhaustion": "Burnout / Exhaustion",
    "burnout/exhaustion": "Burnout / Exhaustion",
    bullying: "Bullying",
    adjustment: "Adjustment",
    "mental health": "Mental health",
    "personal problem": "Personal problems",
    other: "Others",
    others: "Others",
  };

  return aliases[normalized] || "";
}

module.exports = {
  APPOINTMENT_CONCERN_OPTIONS,
  APPOINTMENT_CONCERN_SUBCATEGORIES,
  APPOINTMENT_CONCERN_VALUES,
  INTERPERSONAL_RELATIONSHIP_CONCERN,
  INTERPERSONAL_RELATIONSHIP_SUBCONCERNS,
  normalizeAppointmentConcern,
};
