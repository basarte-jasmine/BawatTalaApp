import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

export type GroundingVibe = {
  accent: string;
  animation: "float" | "rain" | "twinkle" | "wave";
  backgroundImage: number;
  edge: string;
  icon: IoniconName;
  id: string;
  moodLine: string;
  note: string;
  overlay: string;
  title: string;
};

export type GroundingStep = {
  count: number;
  examples: string[];
  helper: string;
  id: string;
  sense: string;
  title: string;
};

export const GROUNDING_VIBES: GroundingVibe[] = [
  {
    id: "rain-room",
    title: "Rain Room",
    moodLine: "Cool, steady, and quiet enough to settle racing thoughts.",
    note: "Pairs well with noticing details slowly and one by one.",
    icon: "rainy-outline",
    accent: "#7ED0D8",
    edge: "#8FD8DF",
    overlay: "rgba(26, 53, 69, 0.34)",
    animation: "rain",
    backgroundImage: require("../assets/images/Background/Hill.webp"),
  },
  {
    id: "ocean-dusk",
    title: "Ocean Dusk",
    moodLine: "Soft horizon colors with a wider, slower exhale kind of energy.",
    note: "Useful when you want the exercise to feel open, airy, and less heavy.",
    icon: "water-outline",
    accent: "#7FB9FF",
    edge: "#9BC7FF",
    overlay: "rgba(16, 55, 102, 0.28)",
    animation: "wave",
    backgroundImage: require("../assets/images/Background/Beach.webp"),
  },
  {
    id: "garden-light",
    title: "Garden Light",
    moodLine: "Warm greens and softer motion for a gentler reset.",
    note: "Great for easing back into your body when everything feels tense.",
    icon: "leaf-outline",
    accent: "#9FD26F",
    edge: "#B4DC8E",
    overlay: "rgba(31, 72, 39, 0.24)",
    animation: "float",
    backgroundImage: require("../assets/images/Background/Garden.webp"),
  },
  {
    id: "night-lantern",
    title: "Night Lantern",
    moodLine: "Dimmer, quieter, and more cocoon-like for end-of-day grounding.",
    note: "Helpful when you want less visual stimulation while staying present.",
    icon: "moon-outline",
    accent: "#BBA8FF",
    edge: "#CCBEFF",
    overlay: "rgba(28, 27, 56, 0.42)",
    animation: "twinkle",
    backgroundImage: require("../assets/images/Background/Museum.webp"),
  },
];

export const GROUNDING_STEPS: GroundingStep[] = [
  {
    id: "see",
    count: 5,
    sense: "See",
    title: "Name five things you can see.",
    helper: "Take your time and let your eyes rest on small details instead of scanning fast.",
    examples: ["light on a wall", "a shape, texture, or shadow", "something close and something far away"],
  },
  {
    id: "touch",
    count: 4,
    sense: "Feel",
    title: "Notice four things you can physically feel.",
    helper: "This can be pressure, temperature, weight, fabric, or where your body meets the chair or floor.",
    examples: ["your feet on the ground", "air on your skin", "the texture of your clothes"],
  },
  {
    id: "hear",
    count: 3,
    sense: "Hear",
    title: "Listen for three things you can hear.",
    helper: "Start with the most obvious sound, then listen for quieter layers underneath it.",
    examples: ["a fan, footsteps, or traffic", "your own breathing", "the chosen soundscape in the room"],
  },
  {
    id: "smell",
    count: 2,
    sense: "Smell",
    title: "Find two things you can smell.",
    helper: "If scent is faint, notice the absence of strong smell or the temperature of the air instead.",
    examples: ["soap, paper, or fabric", "food nearby", "the room after rain or sunlight"],
  },
  {
    id: "taste",
    count: 1,
    sense: "Taste",
    title: "Notice one thing you can taste, or take one slow grounding breath.",
    helper: "If there is no clear taste, end with one long inhale and one slow exhale.",
    examples: ["tea, water, or toothpaste", "a neutral taste in your mouth", "one steady breath in and out"],
  },
];
