import { useEffect, useState } from "react";
import { ImageSourcePropType } from "react-native";

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
  head: null,
  eye: null,
  outfit: null,
};

export const COLLECTION_SECTIONS: MuniCollectionSection[] = [
  {
    id: "head",
    label: "Head",
    options: [
      { id: "artist-beret", label: "Artist Beret", price: 120, source: require("../assets/images/Head/Artist_Beret.png") },
      { id: "beanie", label: "Beanie", price: 0, starter: true, source: require("../assets/images/Head/Beanie.png") },
      { id: "clown-wig", label: "Clown Wig", price: 140, source: require("../assets/images/Head/Clown.png") },
      { id: "cowboy-hat", label: "Cowboy Hat", price: 130, source: require("../assets/images/Head/Cowboy_Hat.png") },
      { id: "knight-helmet", label: "Knight Helmet", price: 180, source: require("../assets/images/Head/Knight_Helmet.png") },
      { id: "laurel-wreath", label: "Laurel Wreath", price: 110, source: require("../assets/images/Head/Laurel_Wreath.png") },
      { id: "pirate-hat", label: "Pirate Hat", price: 145, source: require("../assets/images/Head/Pirate_Hat.png") },
      { id: "safari-hat", label: "Safari Hat", price: 135, source: require("../assets/images/Head/Safari_Hat.png") },
      { id: "space-helmet", label: "Space Helmet", price: 170, source: require("../assets/images/Head/Space_Helmet.png") },
      { id: "summer-hat", label: "Summer Hat", price: 125, source: require("../assets/images/Head/Summer_Hat.png") },
      { id: "wizard-hat", label: "Wizard Hat", price: 160, source: require("../assets/images/Head/Wizard_Hat.png") },
    ],
  },
  {
    id: "eye",
    label: "Eye",
    options: [
      { id: "cinema-glasses", label: "Cinema Glasses", price: 0, starter: true, source: require("../assets/images/Eyes/Cinema_Glasses.png") },
      { id: "circle-sunglasses", label: "Circle Sunglasses", price: 95, source: require("../assets/images/Eyes/Circle_Sunglasses.png") },
      { id: "cyber-visor", label: "Cyber Visor", price: 140, source: require("../assets/images/Eyes/Cyber_Visor.png") },
    ],
  },
  {
    id: "outfit",
    label: "Outfit",
    options: [{ id: "spooky-ghost", label: "Spooky Ghost", price: 0, starter: true, source: require("../assets/images/Outfit/Spooky ghost sheet .png") }],
  },
  {
    id: "background",
    label: "Background",
    options: [
      { id: "beach", label: "Beach", price: 120, source: require("../assets/images/Background/Beach.png") },
      { id: "garden", label: "Garden", price: 0, starter: true, source: require("../assets/images/Background/Garden.png") },
      { id: "hill", label: "Hill", price: 110, source: require("../assets/images/Background/Hill.png") },
      { id: "museum", label: "Museum", price: 150, source: require("../assets/images/Background/Museum.png") },
      { id: "pirate-ship", label: "Pirate Ship", price: 165, source: require("../assets/images/Background/Pirate_Ship.png") },
    ],
  },
];

export const MUNI_IMAGE = require("../assets/images/MUNI_default.png");
export const TALA_IMAGE = require("../assets/images/Tala_Star.png");

let savedMuniLoadout: MuniLoadout = { ...DEFAULT_MUNI_LOADOUT };
const listeners = new Set<(loadout: MuniLoadout) => void>();
let spentMuniTala = 0;
let ownedMuniItems: MuniOwnedItems = createStarterOwnedItems();
const ownedItemsListeners = new Set<(ownedItems: MuniOwnedItems) => void>();
const spentTalaListeners = new Set<(spentTala: number) => void>();

function cloneLoadout(loadout: MuniLoadout): MuniLoadout {
  return { ...loadout };
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

function notifyOwnedItems() {
  const snapshot = cloneOwnedItems(ownedMuniItems);
  ownedItemsListeners.forEach((listener) => listener(snapshot));
}

function notifySpentTala() {
  spentTalaListeners.forEach((listener) => listener(spentMuniTala));
}

export function getSavedMuniLoadout() {
  return cloneLoadout(savedMuniLoadout);
}

export function saveMuniLoadout(loadout: MuniLoadout) {
  ensureLoadoutOwned(loadout);
  savedMuniLoadout = cloneLoadout(loadout);
  listeners.forEach((listener) => listener(cloneLoadout(savedMuniLoadout)));
}

export function getOwnedMuniItems() {
  return cloneOwnedItems(ownedMuniItems);
}

export function getSpentMuniTala() {
  return spentMuniTala;
}

export function subscribeOwnedMuniItems(listener: (ownedItems: MuniOwnedItems) => void) {
  ownedItemsListeners.add(listener);
  return () => {
    ownedItemsListeners.delete(listener);
  };
}

export function subscribeSpentMuniTala(listener: (spentTala: number) => void) {
  spentTalaListeners.add(listener);
  return () => {
    spentTalaListeners.delete(listener);
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

export function getMuniCollectionOption(sectionId: MuniCollectionSectionId, optionId: string | null) {
  if (!optionId) return null;
  return COLLECTION_SECTIONS.find((section) => section.id === sectionId)?.options.find((option) => option.id === optionId) ?? null;
}

export function isMuniItemOwned(sectionId: MuniCollectionSectionId, optionId: string | null) {
  if (!optionId) return true;
  return ownedMuniItems[sectionId].includes(optionId);
}

export function purchaseMuniItem(sectionId: MuniCollectionSectionId, optionId: string) {
  const option = getMuniCollectionOption(sectionId, optionId);
  if (!option || isMuniItemOwned(sectionId, optionId)) {
    return false;
  }

  ownedMuniItems = {
    ...ownedMuniItems,
    [sectionId]: [...ownedMuniItems[sectionId], optionId],
  };
  spentMuniTala += option.price;
  notifyOwnedItems();
  notifySpentTala();
  return true;
}

export function ensureLoadoutOwned(loadout: MuniLoadout) {
  let changed = false;
  const nextOwnedItems = cloneOwnedItems(ownedMuniItems);

  (Object.keys(loadout) as MuniCollectionSectionId[]).forEach((sectionId) => {
    const itemId = loadout[sectionId];
    if (itemId && !nextOwnedItems[sectionId].includes(itemId)) {
      nextOwnedItems[sectionId].push(itemId);
      changed = true;
    }
  });

  if (!changed) return;

  ownedMuniItems = nextOwnedItems;
  notifyOwnedItems();
}

export function subscribeMuniLoadout(listener: (loadout: MuniLoadout) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useSavedMuniLoadout() {
  const [loadout, setLoadout] = useState<MuniLoadout>(() => getSavedMuniLoadout());

  useEffect(() => subscribeMuniLoadout(setLoadout), []);

  return loadout;
}

export function getMuniCollectionSource(sectionId: MuniCollectionSectionId, optionId: string | null) {
  if (!optionId) {
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
