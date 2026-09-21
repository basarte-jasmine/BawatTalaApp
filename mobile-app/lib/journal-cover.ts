import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import {
  clearPendingJournalCover,
  fetchJournalCoverRemote,
  queuePendingJournalCover,
  saveJournalCoverRemote,
} from "./backend-api";

export type JournalCoverElementType = "text" | "sticker";
export type JournalCoverSticker =
  | "BirdStamp"
  | "BlueEyedGrass"
  | "Cactus"
  | "Daffodil"
  | "FlowerStamp"
  | "LadyBugStamp"
  | "PinkFlower"
  | "SleepingCatStamp"
  | "Turtle"
  | "sparkles"
  | "heart"
  | "flower"
  | "leaf"
  | "sunny"
  | "star";

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

export async function loadJournalCover(
  studentNumber: string,
  mode: "muni" | "solo" = "solo",
  onRemoteUpdate?: (design: JournalCoverDesign) => void,
): Promise<JournalCoverDesign | null> {
  if (!studentNumber) return null;

  let localDesign: JournalCoverDesign | null = null;
  const storedValue = await AsyncStorage.getItem(getJournalCoverKey(studentNumber, mode));
  if (storedValue) {
    try {
      const parsed = JSON.parse(storedValue) as JournalCoverDesign;
      if (parsed.version === 1 && typeof parsed.color === "string" && Array.isArray(parsed.elements)) {
        localDesign = parsed;
      }
    } catch {
      localDesign = null;
    }
  }

  const syncRemote = async () => {
    try {
      const res = await fetchJournalCoverRemote(mode);
      if (res.ok && res.cover) {
        const remoteDesign: JournalCoverDesign = {
          version: 1,
          color: typeof res.cover.color === "string" ? res.cover.color : "#AFC4B1",
          elements: Array.isArray(res.cover.elements) ? res.cover.elements : [],
          previewUri: res.cover.previewUri || null,
          updatedAt: res.cover.updatedAt || new Date().toISOString(),
        };
        const hasChanged =
          !localDesign ||
          localDesign.color !== remoteDesign.color ||
          localDesign.previewUri !== remoteDesign.previewUri ||
          JSON.stringify(localDesign.elements) !== JSON.stringify(remoteDesign.elements);

        if (hasChanged) {
          await AsyncStorage.setItem(getJournalCoverKey(studentNumber, mode), JSON.stringify(remoteDesign));
          if (onRemoteUpdate) {
            onRemoteUpdate(remoteDesign);
          }
          return remoteDesign;
        }
      }
    } catch {
      // Offline or network error - ignore gracefully
    }
    return null;
  };

  if (localDesign) {
    // Return local cache immediately for 0ms render offline, sync in background
    void syncRemote();
    return localDesign;
  }

  // No local cache (e.g. running on web app or new install) -> await remote fetch
  const remote = await syncRemote();
  return remote || null;
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
  customPreviewDataUri?: string | null,
): Promise<JournalCoverDesign> {
  const savedDesign: JournalCoverDesign = {
    ...design,
    updatedAt: new Date().toISOString(),
  };

  // 1. Save locally first (100% reliable offline support)
  await AsyncStorage.setItem(getJournalCoverKey(studentNumber, mode), JSON.stringify(savedDesign));

  // 2. Resolve preview data URI for backend storage
  let previewDataUri: string | null = customPreviewDataUri || null;
  if (!previewDataUri && design.previewUri) {
    if (design.previewUri.startsWith("data:")) {
      previewDataUri = design.previewUri;
    } else if (FileSystem.documentDirectory && typeof FileSystem.readAsStringAsync === "function") {
      try {
        const base64 = await FileSystem.readAsStringAsync(design.previewUri, {
          encoding: "base64" as any,
        });
        if (base64) {
          previewDataUri = `data:image/webp;base64,${base64}`;
        }
      } catch {
        // Non-blocking
      }
    }
  }

  // 3. Queue for sync in case the device is offline
  await queuePendingJournalCover(studentNumber, mode, {
    color: savedDesign.color,
    elements: savedDesign.elements,
    previewUri: previewDataUri || design.previewUri,
  });

  // 4. Push to backend immediately if online
  try {
    const remoteRes = await saveJournalCoverRemote(mode, {
      color: savedDesign.color,
      elements: savedDesign.elements,
      previewUri: previewDataUri || design.previewUri,
    });
    if (remoteRes.ok) {
      await clearPendingJournalCover(studentNumber, mode);
    }
  } catch {
    // Offline - queued and will sync when connection returns
  }

  return savedDesign;
}

