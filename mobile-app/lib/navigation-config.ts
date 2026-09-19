export type ScreenAnimationType =
  | "default"
  | "fade"
  | "fade_from_bottom"
  | "slide_from_right"
  | "slide_from_left"
  | "slide_from_bottom"
  | "none";

export type ScreenAnimationConfig = {
  animation: ScreenAnimationType;
  animationDuration: number;
};

export const MAIN_TAB_SCREENS = new Set([
  "home",
  "journal",
  "consult",
  "muni-avatar",
]);

export function getNavigationAnimationConfig(screenName: string): ScreenAnimationConfig {
  if (MAIN_TAB_SCREENS.has(screenName)) {
    return {
      animation: "fade",
      animationDuration: 200,
    };
  }

  if (screenName === "muni-voice") {
    return {
      animation: "slide_from_bottom",
      animationDuration: 260,
    };
  }

  return {
    animation: "slide_from_right",
    animationDuration: 240,
  };
}

