import { PROGRAM_OPTIONS } from "./register-data";

export function formatProgramName(value) {
  const raw = String(value || "").trim().replace(/\s+/g, " ");
  if (!raw) return "";
  return PROGRAM_OPTIONS.find((option) => option.toLowerCase() === raw.toLowerCase()) || toTitleCase(raw);
}

export function toTitleCase(value) {
  const ROMAN_NUMERALS = new Set([
    "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X",
    "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX"
  ]);

  const LOWERCASE_PARTICLES = new Set([
    "de", "del", "la", "los", "las", "da", "di", "van", "von", "y"
  ]);

  function formatSegment(segment) {
    if (!segment) return "";
    const upper = segment.toUpperCase();
    if (ROMAN_NUMERALS.has(upper)) return upper;
    if (upper === "JR" || upper === "JR.") return upper.endsWith(".") ? "Jr." : "Jr";
    if (upper === "SR" || upper === "SR.") return upper.endsWith(".") ? "Sr." : "Sr";

    if (/^[a-zA-Z]'[a-zA-Z]/.test(segment)) {
      const parts = segment.split("'");
      return parts
        .map((p, i) => (i === 0 ? p.toUpperCase() : formatSegment(p)))
        .join("'");
    }

    if (/^mc[a-z]/i.test(segment) && segment.length > 2) {
      return "Mc" + segment.charAt(2).toUpperCase() + segment.slice(3).toLowerCase();
    }

    return segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase();
  }

  function formatWord(word, index) {
    if (!word) return "";
    const lower = word.toLowerCase();

    if (word.includes("-")) {
      return word
        .split("-")
        .map((part, pIdx) => {
          if (index > 0 && pIdx === 0 && LOWERCASE_PARTICLES.has(part.toLowerCase())) {
            return part.toLowerCase();
          }
          return formatSegment(part);
        })
        .join("-");
    }

    if (index > 0 && LOWERCASE_PARTICLES.has(lower)) {
      return lower;
    }

    return formatSegment(word);
  }

  const raw = String(value || "").trim().replace(/\s+/g, " ");
  if (!raw) return "";

  const words = raw.split(" ");
  return words.map((w, idx) => formatWord(w, idx)).join(" ");
}
