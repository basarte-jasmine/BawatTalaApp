/** Matcha palette shared by library shell + EPUB reader chrome. */
export const LIBRARY_MATCHA = {
  primary: "#70C943",
  primaryDark: "#4F7E3E",
  primaryMid: "#5C8A4A",
  surface: "#F7FAF6",
  surfaceCard: "#FFFFFF",
  surfaceSoft: "#E8F6DF",
  surfaceTint: "#D7F0B7",
  surfaceMint: "#C5E8B0",
  border: "#D5E8CB",
  borderSoft: "#E2EFE0",
  text: "#35485B",
  textMuted: "#5C655B",
  textSoft: "#6F845C",
  danger: "#8B4C43",
  dangerSoft: "#F6E8E6",
  overlay: "rgba(112, 201, 67, 0.12)",
  ringTrack: "rgba(197, 232, 176, 0.85)",
  ringFill: "#70C943",
  accentPalette: ["#70C943", "#A8E08A", "#D7F0B7", "#9FD67A", "#C5E8B0", "#5C8A4A"] as const,
} as const;

export type LibraryMatcha = typeof LIBRARY_MATCHA;

/** Map any pastel / cream accent onto the matcha palette (stable by string hash). */
export function matchaAccentFor(seed: string | undefined, fallbackIndex = 0): string {
  const palette = LIBRARY_MATCHA.accentPalette;
  const value = String(seed || "");
  if (!value) return palette[fallbackIndex % palette.length];
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  return palette[hash % palette.length];
}

export function titleInitial(title: string | undefined): string {
  const trimmed = String(title || "").trim();
  if (!trimmed) return "B";
  const letter = trimmed[0];
  return /[a-zA-Z0-9]/.test(letter) ? letter.toUpperCase() : "B";
}
