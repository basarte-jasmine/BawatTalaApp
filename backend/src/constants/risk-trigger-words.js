const RISK_LEVEL_LABELS = {
  NONE: "Balanced / Stable",
  LOW: "Distressed / Needs Support",
  HIGH: "Crisis / Critical Need",
};

const DEFAULT_RISK_TRIGGER_WORDS = [
  { phrase: "suicide", riskLevel: "HIGH", category: "Self-harm or suicide" },
  { phrase: "suicidal", riskLevel: "HIGH", category: "Self-harm or suicide" },
  { phrase: "kill myself", riskLevel: "HIGH", category: "Self-harm or suicide" },
  { phrase: "end my life", riskLevel: "HIGH", category: "Self-harm or suicide" },
  { phrase: "hurt myself", riskLevel: "HIGH", category: "Self-harm or suicide" },
  { phrase: "self harm", riskLevel: "HIGH", category: "Self-harm or suicide" },
  { phrase: "self-harm", riskLevel: "HIGH", category: "Self-harm or suicide" },
  { phrase: "i want to die", riskLevel: "HIGH", category: "Self-harm or suicide" },
  { phrase: "i wanna die", riskLevel: "HIGH", category: "Self-harm or suicide" },
  { phrase: "ayoko na mabuhay", riskLevel: "HIGH", category: "Self-harm or suicide" },
  { phrase: "gusto ko nang mamatay", riskLevel: "HIGH", category: "Self-harm or suicide" },
  { phrase: "gusto ko na mamatay", riskLevel: "HIGH", category: "Self-harm or suicide" },
  { phrase: "papatayin ko sarili ko", riskLevel: "HIGH", category: "Self-harm or suicide" },
  { phrase: "sasaktan ko sarili ko", riskLevel: "HIGH", category: "Self-harm or suicide" },
  { phrase: "saktan ang sarili", riskLevel: "HIGH", category: "Self-harm or suicide" },
  { phrase: "magpapakamatay", riskLevel: "HIGH", category: "Self-harm or suicide" },
  { phrase: "mamatay na lang", riskLevel: "HIGH", category: "Self-harm or suicide" },
  { phrase: "wala nang dahilan mabuhay", riskLevel: "HIGH", category: "Self-harm or suicide" },
  { phrase: "abuse", riskLevel: "HIGH", category: "Abuse or immediate danger" },
  { phrase: "inaabuso", riskLevel: "HIGH", category: "Abuse or immediate danger" },
  { phrase: "binubugbog", riskLevel: "HIGH", category: "Abuse or immediate danger" },
  { phrase: "rape", riskLevel: "HIGH", category: "Abuse or immediate danger" },
  { phrase: "sexual assault", riskLevel: "HIGH", category: "Abuse or immediate danger" },
  { phrase: "panic attack", riskLevel: "LOW", category: "Significant distress" },
  { phrase: "can't stop crying", riskLevel: "LOW", category: "Significant distress" },
  { phrase: "cant stop crying", riskLevel: "LOW", category: "Significant distress" },
  { phrase: "sobrang lungkot", riskLevel: "LOW", category: "Significant distress" },
  { phrase: "sobrang bigat", riskLevel: "LOW", category: "Significant distress" },
  { phrase: "wala na akong gana", riskLevel: "LOW", category: "Significant distress" },
  { phrase: "i feel hopeless", riskLevel: "LOW", category: "Significant distress" },
  { phrase: "hopeless", riskLevel: "LOW", category: "Significant distress" },
  { phrase: "burned out", riskLevel: "LOW", category: "Significant distress" },
  { phrase: "burnt out", riskLevel: "LOW", category: "Significant distress" },
  { phrase: "pagod na pagod", riskLevel: "LOW", category: "Significant distress" },
  { phrase: "hindi ko na kaya", riskLevel: "LOW", category: "Significant distress" },
  { phrase: "di ko na kaya", riskLevel: "LOW", category: "Significant distress" },
  { phrase: "overwhelmed", riskLevel: "LOW", category: "Significant distress" },
  { phrase: "matinding anxiety", riskLevel: "LOW", category: "Significant distress" },
  { phrase: "severe anxiety", riskLevel: "LOW", category: "Significant distress" },
];

function normalizeRiskTriggerPhrase(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function normalizeRiskTriggerLevel(value) {
  const normalized = String(value || "")
    .trim()
    .toUpperCase();
  return normalized === "HIGH" || normalized === "LOW" ? normalized : "";
}

function getRiskLevelLabel(value) {
  return RISK_LEVEL_LABELS[String(value || "NONE").trim().toUpperCase()] || RISK_LEVEL_LABELS.NONE;
}

module.exports = {
  DEFAULT_RISK_TRIGGER_WORDS,
  RISK_LEVEL_LABELS,
  getRiskLevelLabel,
  normalizeRiskTriggerLevel,
  normalizeRiskTriggerPhrase,
};
