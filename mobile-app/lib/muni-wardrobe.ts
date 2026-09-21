import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { ImageSourcePropType } from "react-native";
import {
  fetchMuniWardrobe,
  purchaseMuniWardrobeItem,
  saveMuniLoadoutRemote,
} from "./backend-api";

export type MuniCollectionOption = {
  id: string;
  label?: string;
  price: number;
  source: ImageSourcePropType;
  starter?: boolean;
};

export type MuniCollectionSectionId = "head" | "eye" | "outfit" | "background";

export type MuniCollectionSection = {
  id: MuniCollectionSectionId;
  label: string;
  options: MuniCollectionOption[];
};

export type MuniLoadout = Record<MuniCollectionSectionId, string | null>;
export type MuniOwnedItems = Record<MuniCollectionSectionId, string[]>;

export const DEFAULT_MUNI_LOADOUT: MuniLoadout = {
  background: "garden",
  head: "beanie",
  eye: "cinema-glasses",
  outfit: "spooky-ghost",
};

export const EMPTY_MUNI_LOADOUT: MuniLoadout = {
  background: null,
  head: null,
  eye: null,
  outfit: null,
};

export const COLLECTION_SECTIONS: MuniCollectionSection[] = [
  {
    id: "head",
    label: "Head",
    options: [
      { id: "artist-beret", label: "Artist Beret", price: 120, source: require("../assets/images/Muni Customization/Head/Artist_Beret.webp") },
      { id: "beanie", label: "Beanie", price: 0, starter: true, source: require("../assets/images/Muni Customization/Head/Beanie.webp") },
      { id: "blue-bandana", label: "Blue Bandana", price: 80, source: require("../assets/images/Muni Customization/Head/Blue bandana.webp") },
      { id: "green-bandana", label: "Green Bandana", price: 80, source: require("../assets/images/Muni Customization/Head/Green bandana.webp") },
      { id: "red-bandana", label: "Red Bandana", price: 80, source: require("../assets/images/Muni Customization/Head/Red bandana.webp") },
      { id: "clown-wig", label: "Clown Wig", price: 140, source: require("../assets/images/Muni Customization/Head/Clown.webp") },
      { id: "cowboy-hat", label: "Cowboy Hat", price: 130, source: require("../assets/images/Muni Customization/Head/Cowboy_Hat.webp") },
      { id: "knight-helmet", label: "Knight Helmet", price: 180, source: require("../assets/images/Muni Customization/Head/Knight_Helmet.webp") },
      { id: "laurel-wreath", label: "Laurel Wreath", price: 110, source: require("../assets/images/Muni Customization/Head/Laurel_Wreath.webp") },
      { id: "pirate-hat", label: "Pirate Hat", price: 145, source: require("../assets/images/Muni Customization/Head/Pirate_Hat.webp") },
      { id: "safari-hat", label: "Safari Hat", price: 135, source: require("../assets/images/Muni Customization/Head/Safari_Hat.webp") },
      { id: "space-helmet", label: "Space Helmet", price: 170, source: require("../assets/images/Muni Customization/Head/Space_Helmet.webp") },
      { id: "summer-hat", label: "Summer Hat", price: 125, source: require("../assets/images/Muni Customization/Head/Summer_Hat.webp") },
      { id: "wizard-hat", label: "Wizard Hat", price: 160, source: require("../assets/images/Muni Customization/Head/Wizard_Hat.webp") },
    ],
  },
  {
    id: "eye",
    label: "Eye",
    options: [
      { id: "cinema-glasses", label: "Cinema Glasses", price: 0, starter: true, source: require("../assets/images/Muni Customization/Eyes/Cinema_Glasses.webp") },
      { id: "circle-sunglasses", label: "Circle Sunglasses", price: 95, source: require("../assets/images/Muni Customization/Eyes/Circle_Sunglasses.webp") },
      { id: "cyber-visor", label: "Cyber Visor", price: 140, source: require("../assets/images/Muni Customization/Eyes/Cyber_Visor.webp") },
    ],
  },
  {
    id: "outfit",
    label: "Outfit",
    options: [
      { id: "classic", label: "Classic Muni", price: 0, starter: true, source: require("../assets/images/Muni/Body.png") },
      { id: "brown-jumper", label: "Brown Jumper", price: 100, source: require("../assets/images/Muni Customization/Outfit/Brown jumper.webp") },
      { id: "denim-jumper", label: "Denim Jumper", price: 110, source: require("../assets/images/Muni Customization/Outfit/Demin jumper.webp") },
      { id: "denim-vest", label: "Denim Vest", price: 100, source: require("../assets/images/Muni Customization/Outfit/Demin vest.webp") },
      { id: "explorer-vest", label: "Explorer Vest", price: 120, source: require("../assets/images/Muni Customization/Outfit/Explorer vest.webp") },
      { id: "green-jumper", label: "Green Jumper", price: 100, source: require("../assets/images/Muni Customization/Outfit/Green jumper.webp") },
      { id: "spooky-ghost", label: "Spooky Ghost", price: 0, starter: true, source: require("../assets/images/Muni Customization/Outfit/Spooky_Ghost_Sheet.webp") },
      { id: "yellow-vest", label: "Yellow Vest", price: 100, source: require("../assets/images/Muni Customization/Outfit/Yellow vest.webp") },
    ],
  },
  {
    id: "background",
    label: "Background",
    options: [
      { id: "beach", label: "Beach", price: 120, source: require("../assets/images/Background/Beach.webp") },
      { id: "garden", label: "Garden", price: 0, starter: true, source: require("../assets/images/Background/Garden.webp") },
      { id: "hill", label: "Hill", price: 110, source: require("../assets/images/Background/Hill.webp") },
      { id: "museum", label: "Museum", price: 150, source: require("../assets/images/Background/Museum.webp") },
      { id: "pirate-ship", label: "Pirate Ship", price: 165, source: require("../assets/images/Background/Pirate_Ship.webp") },
    ],
  },
];

export const TALA_IMAGE = require("../assets/images/Tala_Star.png");

const SECTION_IDS: MuniCollectionSectionId[] = ["head", "eye", "outfit", "background"];

type WardrobeState = {
  hydrated: boolean;
  loadout: MuniLoadout;
  ownedItems: MuniOwnedItems;
  pendingLoadout?: MuniLoadout | null;
  totalTala: number;
};

const wardrobeByStudent = new Map<string, WardrobeState>();
let activeStudentNumber = "";
let hydratedStudentNumber = "";
const loadoutListeners = new Set<(loadout: MuniLoadout) => void>();
const ownedItemsListeners = new Set<(ownedItems: MuniOwnedItems) => void>();
const talaListeners = new Set<(totalTala: number) => void>();

function wardrobeCacheKey(studentNumber: string) {
  return `bawat-tala.muni-wardrobe.${studentNumber}`;
}

function cloneLoadout(loadout: MuniLoadout): MuniLoadout {
  return { ...loadout };
}

function isMuniLoadout(value: unknown): value is MuniLoadout {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  return SECTION_IDS.every((sectionId) => record[sectionId] === null || typeof record[sectionId] === "string");
}

function isMuniOwnedItems(value: unknown): value is MuniOwnedItems {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  return SECTION_IDS.every((sectionId) => Array.isArray(record[sectionId]));
}

async function readCachedWardrobe(studentNumber: string): Promise<WardrobeState | null> {
  try {
    const raw = await AsyncStorage.getItem(wardrobeCacheKey(studentNumber));
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as {
      loadout?: unknown;
      ownedItems?: unknown;
      pendingLoadout?: unknown;
      totalTala?: unknown;
    };
    if (!isMuniLoadout(parsed.loadout) || !isMuniOwnedItems(parsed.ownedItems)) {
      return null;
    }
    return {
      hydrated: true,
      loadout: cloneLoadout(parsed.loadout),
      pendingLoadout: isMuniLoadout(parsed.pendingLoadout) ? cloneLoadout(parsed.pendingLoadout) : null,
      ownedItems: cloneOwnedItems(parsed.ownedItems),
      totalTala: typeof parsed.totalTala === "number" && Number.isFinite(parsed.totalTala) ? Math.max(0, parsed.totalTala) : 0,
    };
  } catch {
    return null;
  }
}

async function persistWardrobe(studentNumber: string, state: WardrobeState) {
  if (!studentNumber) {
    return;
  }
  try {
    await AsyncStorage.setItem(
      wardrobeCacheKey(studentNumber),
      JSON.stringify({
        loadout: state.loadout,
        pendingLoadout: state.pendingLoadout ?? null,
        ownedItems: state.ownedItems,
        totalTala: state.totalTala,
      }),
    );
  } catch {
    // Keep the in-memory look even if disk cache fails.
  }
}


function cloneOwnedItems(ownedItems: MuniOwnedItems): MuniOwnedItems {
  return {
    background: [...ownedItems.background],
    eye: [...ownedItems.eye],
    head: [...ownedItems.head],
    outfit: [...ownedItems.outfit],
  };
}

function createStarterOwnedItems(): MuniOwnedItems {
  return COLLECTION_SECTIONS.reduce(
    (collection, section) => {
      collection[section.id] = section.options.filter((option) => option.starter).map((option) => option.id);
      return collection;
    },
    {
      background: [] as string[],
      eye: [] as string[],
      head: [] as string[],
      outfit: [] as string[],
    },
  );
}

function createEmptyOwnedItems(): MuniOwnedItems {
  return {
    background: [],
    eye: [],
    head: [],
    outfit: [],
  };
}

function createUnhydratedState(): WardrobeState {
  return {
    hydrated: false,
    loadout: cloneLoadout(DEFAULT_MUNI_LOADOUT),
    ownedItems: createStarterOwnedItems(),
    totalTala: 0,
  };
}

function createDefaultState(): WardrobeState {
  return {
    hydrated: true,
    loadout: cloneLoadout(DEFAULT_MUNI_LOADOUT),
    ownedItems: createStarterOwnedItems(),
    totalTala: 0,
  };
}

function getActiveState(): WardrobeState {
  if (!activeStudentNumber) {
    return createUnhydratedState();
  }
  return wardrobeByStudent.get(activeStudentNumber) ?? createUnhydratedState();
}

function notifyAll(state: WardrobeState) {
  const loadout = cloneLoadout(state.loadout);
  const ownedItems = cloneOwnedItems(state.ownedItems);
  loadoutListeners.forEach((listener) => listener(loadout));
  ownedItemsListeners.forEach((listener) => listener(ownedItems));
  talaListeners.forEach((listener) => listener(state.totalTala));
}

function applyRemoteWardrobe(payload: {
  loadout?: MuniLoadout | null;
  ownedItems?: MuniOwnedItems | null;
  totalTala?: number;
}) {
  let state: WardrobeState;
  if (!activeStudentNumber) {
    state = createUnhydratedState();
  } else {
    const existing = wardrobeByStudent.get(activeStudentNumber);
    if (existing) {
      state = existing;
    } else {
      state = createUnhydratedState();
      wardrobeByStudent.set(activeStudentNumber, state);
    }
  }
  if (payload.ownedItems) {
    state.ownedItems = cloneOwnedItems({
      background: payload.ownedItems.background ?? state.ownedItems.background,
      eye: payload.ownedItems.eye ?? state.ownedItems.eye,
      head: payload.ownedItems.head ?? state.ownedItems.head,
      outfit: payload.ownedItems.outfit ?? state.ownedItems.outfit,
    });
  }
  if (payload.loadout) {
    if (state.pendingLoadout) {
      // A look chosen offline is newer than the server copy; keep it until synced.
      state.loadout = cloneLoadout(state.pendingLoadout);
    } else {
      state.loadout = cloneLoadout({
        background: payload.loadout.background !== undefined ? payload.loadout.background : state.loadout.background,
        eye: payload.loadout.eye !== undefined ? payload.loadout.eye : state.loadout.eye,
        head: payload.loadout.head !== undefined ? payload.loadout.head : state.loadout.head,
        outfit: payload.loadout.outfit !== undefined ? payload.loadout.outfit : state.loadout.outfit,
      });
    }
  }
  if (typeof payload.totalTala === "number" && Number.isFinite(payload.totalTala)) {
    state.totalTala = Math.max(0, payload.totalTala);
  }
  state.hydrated = true;
  if (activeStudentNumber) {
    hydratedStudentNumber = activeStudentNumber;
    wardrobeByStudent.set(activeStudentNumber, state);
    void persistWardrobe(activeStudentNumber, state);
  }
  notifyAll(state);
  return state;
}

export function resetMuniWardrobe() {
  activeStudentNumber = "";
  hydratedStudentNumber = "";
  notifyAll(createUnhydratedState());
}

export function getSavedMuniLoadout() {
  if (activeStudentNumber) {
    const existing = wardrobeByStudent.get(activeStudentNumber);
    if (existing) {
      return cloneLoadout(existing.loadout);
    }
  }
  return cloneLoadout(EMPTY_MUNI_LOADOUT);
}

export function getOwnedMuniItems() {
  return cloneOwnedItems(getActiveState().ownedItems);
}

export function getSpentMuniTala() {
  return 0;
}

export function getAvailableMuniTala() {
  return getActiveState().totalTala;
}

export function subscribeOwnedMuniItems(listener: (ownedItems: MuniOwnedItems) => void) {
  ownedItemsListeners.add(listener);
  listener(getOwnedMuniItems());
  return () => {
    ownedItemsListeners.delete(listener);
  };
}

export function subscribeSpentMuniTala(listener: (spentTala: number) => void) {
  const wrapped = (_totalTala: number) => listener(0);
  talaListeners.add(wrapped);
  return () => {
    talaListeners.delete(wrapped);
  };
}

export function subscribeAvailableMuniTala(listener: (totalTala: number) => void) {
  talaListeners.add(listener);
  listener(getAvailableMuniTala());
  return () => {
    talaListeners.delete(listener);
  };
}

export function useOwnedMuniItems() {
  const [ownedItems, setOwnedItems] = useState<MuniOwnedItems>(() => getOwnedMuniItems());

  useEffect(() => subscribeOwnedMuniItems(setOwnedItems), []);

  return ownedItems;
}

export function useSpentMuniTala() {
  const [spentTala, setSpentTala] = useState(() => getSpentMuniTala());

  useEffect(() => subscribeSpentMuniTala(setSpentTala), []);

  return spentTala;
}

export function useAvailableMuniTala() {
  const [totalTala, setTotalTala] = useState(() => getAvailableMuniTala());

  useEffect(() => subscribeAvailableMuniTala(setTotalTala), []);

  return totalTala;
}

export function getMuniCollectionOption(sectionId: MuniCollectionSectionId, optionId: string | null) {
  if (!optionId) return null;
  return COLLECTION_SECTIONS.find((section) => section.id === sectionId)?.options.find((option) => option.id === optionId) ?? null;
}

export function isMuniItemOwned(sectionId: MuniCollectionSectionId, optionId: string | null) {
  if (!optionId) return true;
  return getActiveState().ownedItems[sectionId].includes(optionId);
}

export async function hydrateMuniWardrobe(studentNumber: string) {
  const nextStudent = String(studentNumber || "").trim();
  if (!nextStudent) {
    resetMuniWardrobe();
    return createUnhydratedState();
  }

  activeStudentNumber = nextStudent;
  let existing: WardrobeState | null | undefined = wardrobeByStudent.get(nextStudent);
  if (!existing) {
    existing = await readCachedWardrobe(nextStudent);
    if (existing) {
      wardrobeByStudent.set(nextStudent, existing);
    }
  }
  if (existing) {
    existing.hydrated = true;
    hydratedStudentNumber = nextStudent;
    notifyAll(existing);
    // Refresh remotely in the background so wardrobe UI is not blocked on network.
    void (async () => {
      // Push a look chosen offline as soon as the connection returns.
      if (existing.pendingLoadout) {
        const saved = await saveMuniLoadoutRemote({
          loadout: existing.pendingLoadout,
          studentNumber: nextStudent,
        });
        if (saved.ok) {
          existing.pendingLoadout = null;
        }
      }
      const result = await fetchMuniWardrobe(nextStudent);
      if (!result.ok || activeStudentNumber !== nextStudent) {
        return;
      }
      applyRemoteWardrobe(result);
    })();
    return existing;
  }

  // Cold start: render a usable state immediately and hydrate remotely in the
  // background so the wardrobe screen never waits on the network.
  const initialState = createDefaultState();
  wardrobeByStudent.set(nextStudent, initialState);
  hydratedStudentNumber = nextStudent;
  notifyAll(initialState);
  void fetchMuniWardrobe(nextStudent).then((result) => {
    if (!result.ok || activeStudentNumber !== nextStudent) {
      return;
    }
    applyRemoteWardrobe(result);
  });
  return initialState;
}

export async function purchaseMuniItem(sectionId: MuniCollectionSectionId, optionId: string) {
  const option = getMuniCollectionOption(sectionId, optionId);
  if (!option || isMuniItemOwned(sectionId, optionId) || !activeStudentNumber) {
    return false;
  }

  const result = await purchaseMuniWardrobeItem({
    itemId: optionId,
    sectionId,
    studentNumber: activeStudentNumber,
  });
  if (!result.ok) {
    return false;
  }
  applyRemoteWardrobe(result);
  return true;
}

export async function saveMuniLoadout(loadout: MuniLoadout) {
  const state = getActiveState();
  if (!activeStudentNumber || !state.hydrated) {
    return false;
  }

  const previousLoadout = cloneLoadout(state.loadout);
  const nextLoadout = cloneLoadout(loadout);
  SECTION_IDS.forEach((sectionId) => {
    const itemId = nextLoadout[sectionId];
    if (itemId && !state.ownedItems[sectionId].includes(itemId)) {
      nextLoadout[sectionId] = previousLoadout[sectionId];
    }
  });

  state.loadout = nextLoadout;
  wardrobeByStudent.set(activeStudentNumber, state);
  notifyAll(state);
  // Persist the chosen look locally first so offline changes survive reloads.
  await persistWardrobe(activeStudentNumber, state);

  const result = await saveMuniLoadoutRemote({
    loadout: nextLoadout,
    studentNumber: activeStudentNumber,
  });
  if (!result.ok) {
    // Offline: keep the locally saved look instead of reverting. It will be
    // pushed to the server on the next successful wardrobe sync.
    state.loadout = nextLoadout;
    state.pendingLoadout = nextLoadout;
    wardrobeByStudent.set(activeStudentNumber, state);
    notifyAll(state);
    await persistWardrobe(activeStudentNumber, state);
    return true;
  }
  state.pendingLoadout = null;
  applyRemoteWardrobe(result);
  return true;
}

export function subscribeMuniLoadout(listener: (loadout: MuniLoadout) => void) {
  loadoutListeners.add(listener);
  listener(getSavedMuniLoadout());
  return () => {
    loadoutListeners.delete(listener);
  };
}

export function useSavedMuniLoadout() {
  const [loadout, setLoadout] = useState<MuniLoadout>(() => getSavedMuniLoadout());

  useEffect(() => subscribeMuniLoadout(setLoadout), []);

  return loadout;
}

export function getMuniCollectionSource(sectionId: MuniCollectionSectionId, optionId: string | null) {
  if (!optionId || optionId === "classic") {
    return null;
  }

  return getMuniCollectionOption(sectionId, optionId)?.source ?? null;
}

export function getHeadAccessoryStyle(headId: string | null) {
  if (!headId) {
    return null;
  }

  return {
    transform: [{ translateY: 0 }, { scale: 1.04 }],
  } as const;
}

export function getEyeAccessoryStyle(eyeId: string | null) {
  if (!eyeId) {
    return null;
  }

  return {
    transform: [{ translateY: 0 }, { scale: 1.01 }],
  } as const;
}

export function areMuniLoadoutsEqual(left: MuniLoadout, right: MuniLoadout) {
  return (
    left.background === right.background &&
    left.head === right.head &&
    left.eye === right.eye &&
    left.outfit === right.outfit
  );
}
