/**
 * Android release APKs blank custom-font text when fontFamily is a Regular face
 * (e.g. "Outfit") combined with fontWeight 600/700/800/900. Map weights to
 * explicit Outfit-* faces and strip fontWeight.
 */
import React from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  type StyleProp,
  type TextStyle,
} from "react-native";

const WEIGHT_TO_FACE: Record<string, string> = {
  "100": "Outfit",
  "200": "Outfit",
  "300": "Outfit",
  "400": "Outfit",
  normal: "Outfit",
  "500": "Outfit-Medium",
  medium: "Outfit-Medium",
  "600": "Outfit-SemiBold",
  semibold: "Outfit-SemiBold",
  "700": "Outfit-Bold",
  "800": "Outfit-Bold",
  "900": "Outfit-Bold",
  bold: "Outfit-Bold",
};

function isOutfitish(family: string | undefined): boolean {
  if (!family) return true;
  return family === "Outfit" || family === "Outfit-Regular" || family.startsWith("Outfit-");
}

export function outfitFace(
  weight: "regular" | "medium" | "semibold" | "bold" = "regular",
): TextStyle {
  switch (weight) {
    case "medium":
      return { fontFamily: "Outfit-Medium" };
    case "semibold":
      return { fontFamily: "Outfit-SemiBold" };
    case "bold":
      return { fontFamily: "Outfit-Bold" };
    default:
      return { fontFamily: "Outfit" };
  }
}

export function resolveOutfitTextStyle(style: StyleProp<TextStyle>): TextStyle | StyleProp<TextStyle> {
  const flat = StyleSheet.flatten(style);
  if (!flat || typeof flat !== "object") {
    return style;
  }

  const family = typeof flat.fontFamily === "string" ? flat.fontFamily : undefined;
  if (family && !isOutfitish(family)) {
    return flat;
  }

  const weight = flat.fontWeight != null ? String(flat.fontWeight) : null;
  const alreadyFaced = Boolean(family && family.startsWith("Outfit-") && family !== "Outfit-Regular");

  if (alreadyFaced) {
    if (!weight) return flat;
    const { fontWeight: _removed, ...rest } = flat;
    return rest;
  }

  if (!weight) {
    return { ...flat, fontFamily: family ?? "Outfit" };
  }

  const face = WEIGHT_TO_FACE[weight] ?? "Outfit-Bold";
  const { fontWeight: _removed, ...rest } = flat;
  return { ...rest, fontFamily: face };
}

type ComponentWithRender = {
  render?: (...args: unknown[]) => React.ReactElement | null;
};

let installed = false;

export function installSafeOutfitTypography() {
  if (installed) return;
  installed = true;

  const patchComponent = (Component: ComponentWithRender) => {
    if (typeof Component.render !== "function") {
      return false;
    }
    const previousRender = Component.render.bind(Component);
    Component.render = (...args: unknown[]) => {
      const element = previousRender(...args);
      if (!React.isValidElement(element)) {
        return element;
      }
      const props = element.props as { style?: StyleProp<TextStyle> };
      return React.cloneElement(element, {
        style: resolveOutfitTextStyle(props.style),
      } as never);
    };
    return true;
  };

  const textPatched = patchComponent(Text as unknown as ComponentWithRender);
  const inputPatched = patchComponent(TextInput as unknown as ComponentWithRender);
  if (!textPatched || !inputPatched) {
    console.warn(
      "Outfit typography: Text.render patch unavailable; relying on StyleSheet face mapping.",
    );
  }
}
