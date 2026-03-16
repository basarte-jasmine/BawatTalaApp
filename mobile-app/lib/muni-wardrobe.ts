import { useEffect, useState } from "react";
import { ImageSourcePropType } from "react-native";

export type MuniCollectionOption = {
  id: string;
  source: ImageSourcePropType;
};

export type MuniCollectionSectionId = "head" | "eye" | "outfit" | "background";

export type MuniCollectionSection = {
  id: MuniCollectionSectionId;
  label: string;
  options: MuniCollectionOption[];
};

export type MuniLoadout = Record<MuniCollectionSectionId, string | null>;

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
      { id: "artist-beret", source: require("../assets/images/Head/Artist_Beret.png") },
      { id: "beanie", source: require("../assets/images/Head/Beanie.png") },
      { id: "clown-wig", source: require("../assets/images/Head/Clown.png") },
      { id: "cowboy-hat", source: require("../assets/images/Head/Cowboy_Hat.png") },
      { id: "knight-helmet", source: require("../assets/images/Head/Knight_Helmet.png") },
      { id: "laurel-wreath", source: require("../assets/images/Head/Laurel_Wreath.png") },
      { id: "pirate-hat", source: require("../assets/images/Head/Pirate_Hat.png") },
      { id: "safari-hat", source: require("../assets/images/Head/Safari_Hat.png") },
      { id: "space-helmet", source: require("../assets/images/Head/Space_Helmet.png") },
      { id: "summer-hat", source: require("../assets/images/Head/Summer_Hat.png") },
      { id: "wizard-hat", source: require("../assets/images/Head/Wizard_Hat.png") },
    ],
  },
  {
    id: "eye",
    label: "Eye",
    options: [
      { id: "cinema-glasses", source: require("../assets/images/Eyes/Cinema_Glasses.png") },
      { id: "circle-sunglasses", source: require("../assets/images/Eyes/Circle_Sunglasses.png") },
      { id: "cyber-visor", source: require("../assets/images/Eyes/Cyber_Visor.png") },
    ],
  },
  {
    id: "outfit",
    label: "Outfit",
    options: [{ id: "spooky-ghost", source: require("../assets/images/Outfit/Spooky ghost sheet .png") }],
  },
  {
    id: "background",
    label: "Background",
    options: [
      { id: "beach", source: require("../assets/images/Background/Beach.png") },
      { id: "garden", source: require("../assets/images/Background/Garden.png") },
      { id: "hill", source: require("../assets/images/Background/Hill.png") },
      { id: "museum", source: require("../assets/images/Background/Museum.png") },
      { id: "pirate-ship", source: require("../assets/images/Background/Pirate_Ship.png") },
    ],
  },
];

export const MUNI_IMAGE = require("../assets/images/MUNI_default.png");
export const TALA_IMAGE = require("../assets/images/Tala_Star.png");

let savedMuniLoadout: MuniLoadout = { ...DEFAULT_MUNI_LOADOUT };
const listeners = new Set<(loadout: MuniLoadout) => void>();

function cloneLoadout(loadout: MuniLoadout): MuniLoadout {
  return { ...loadout };
}

export function getSavedMuniLoadout() {
  return cloneLoadout(savedMuniLoadout);
}

export function saveMuniLoadout(loadout: MuniLoadout) {
  savedMuniLoadout = cloneLoadout(loadout);
  listeners.forEach((listener) => listener(cloneLoadout(savedMuniLoadout)));
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

  return (
    COLLECTION_SECTIONS.find((section) => section.id === sectionId)?.options.find((option) => option.id === optionId)?.source ?? null
  );
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
