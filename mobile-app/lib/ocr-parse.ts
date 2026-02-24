import { PROGRAM_OPTIONS } from "./register-data";
import { normalizeStudentNumber } from "./format";

type ParsedIdData = {
  fullName: string;
  studentNumber: string;
  program: string;
};

export function parseIdText(ocrText: string): ParsedIdData {
  const lines = ocrText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const rawStudent =
    lines.find((line) => /\b\d{2}\s*[- ]\s*\d{4}\b/.test(line))?.match(/\d{2}\s*[- ]\s*\d{4}/)?.[0] ?? "";

  const rawProgram =
    lines.find((line) =>
      PROGRAM_OPTIONS.some((program) =>
        line.toLowerCase().replace(/[^a-z0-9]+/g, " ").includes(program.toLowerCase().replace(/[^a-z0-9]+/g, " "))
      )
    ) ?? "";

  const normalizedProgram =
    PROGRAM_OPTIONS.find((program) =>
      rawProgram.toLowerCase().replace(/[^a-z0-9]+/g, " ").includes(program.toLowerCase().replace(/[^a-z0-9]+/g, " "))
    ) ?? "";

  const programLineIndex = rawProgram ? lines.findIndex((line) => line === rawProgram) : -1;

  const rawName = findNameLine(lines, programLineIndex);

  return {
    fullName: rawName,
    studentNumber: normalizeStudentNumber(rawStudent),
    program: normalizedProgram || rawProgram,
  };
}

function findNameLine(lines: string[], programLineIndex: number) {
  if (programLineIndex > 0) {
    const directAbove = lines[programLineIndex - 1];
    if (isLikelyStudentName(directAbove)) return directAbove;
  }

  if (programLineIndex > 1) {
    const twoAbove = lines[programLineIndex - 2];
    if (isLikelyStudentName(twoAbove)) return twoAbove;
  }

  return lines.find((line) => isLikelyStudentName(line)) ?? "";
}

function isLikelyStudentName(line: string) {
  if (!line) return false;
  if (!/^[A-Za-z .'-]{6,}$/.test(line)) return false;
  if (/\d/.test(line)) return false;

  const normalized = line.toLowerCase().replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();
  const blockedWords = [
    "pamantasan",
    "lungsod",
    "valenzuela",
    "plvworld",
    "information technology",
    "engineering",
    "education",
    "psychology",
    "communication",
    "accountancy",
    "marketing",
  ];

  if (blockedWords.some((word) => normalized.includes(word))) return false;

  const words = normalized.split(" ").filter(Boolean);
  return words.length >= 2;
}
