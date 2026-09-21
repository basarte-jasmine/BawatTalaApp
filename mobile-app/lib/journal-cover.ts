import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";

export type JournalCoverElementType = "text" | "sticker";
export type JournalCoverSticker = "sparkles" | "heart" | "flower" | "leaf" | "sunny" | "star";

export interface JournalCoverElement {
  id: string;
  type: JournalCoverElementType;
  content: string;
  color?: string;
  fontFamily?: string;
  icon?: JournalCoverSticker;
  x: number;
  y: number;
  scale: number;
  rotation: number;
}

export interface JournalCoverDesign {
  version: 1;
  color: string;
  elements: JournalCoverElement[];
  previewUri: string | null;
  updatedAt: string;
}

const STORAGE_PREFIX = "@bawat-tala/journal-cover:";
const PREVIEW_DIRECTORY = "journal-covers";

function getJournalCoverKey(studentNumber: string, mode: "muni" | "solo" = "solo") {
  return `${STORAGE_PREFIX}${studentNumber}:${mode}`;
}

export async function loadJournalCover(studentNumber: string, mode: "muni" | "solo" = "solo"): Promise<JournalCoverDesign | null> {
  if (!studentNumber) return null;

  const storedValue = await AsyncStorage.getItem(getJournalCoverKey(studentNumber, mode));
  if (!storedValue) return null;

  try {
    const parsed = JSON.parse(storedValue) as JournalCoverDesign;
    if (parsed.version !== 1 || typeof parsed.color !== "string" || !Array.isArray(parsed.elements)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function persistJournalCoverPreview(studentNumber: string, mode: "muni" | "solo", previewUri: string | null): Promise<string | null> {
  if (!studentNumber || !previewUri || !FileSystem.documentDirectory) return null;

  const directory = `${FileSystem.documentDirectory}${PREVIEW_DIRECTORY}/`;
  const destination = `${directory}${encodeURIComponent(studentNumber)}_${mode}.webp`;

  try {
    await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
    await FileSystem.deleteAsync(destination, { idempotent: true });
    await FileSystem.moveAsync({ from: previewUri, to: destination });
    return destination;
  } catch {
    return null;
  }
}

export async function saveJournalCover(
  studentNumber: string,
  mode: "muni" | "solo",
  design: Omit<JournalCoverDesign, "updatedAt">,
): Promise<JournalCoverDesign> {
  const savedDesign: JournalCoverDesign = {
    ...design,
    updatedAt: new Date().toISOString(),
  };
  await AsyncStorage.setItem(getJournalCoverKey(studentNumber, mode), JSON.stringify(savedDesign));
  return savedDesign;
}

