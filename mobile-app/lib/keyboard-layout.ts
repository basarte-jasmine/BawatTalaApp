import { useEffect, useState } from "react";
import { Keyboard, Platform } from "react-native";

/**
 * Height used for responsive breakpoints that must not react to the Android IME.
 *
 * With `softwareKeyboardLayoutMode: "resize"`, opening the keyboard shrinks the window, so
 * `useWindowDimensions().height` drops by the keyboard height *while the IME is animating in*.
 * Feeding that live value into layout breakpoints reflows the whole screen mid-animation
 * (header height, compact logo/title styles) — which is what made the login form flicker.
 *
 * The height is captured once, at mount, on Android only. iOS and web keep the live value
 * because the keyboard never resizes the window there.
 */
export function useKeyboardStableHeight(liveHeight: number): number {
  const [mountHeight] = useState(() => (liveHeight > 0 ? liveHeight : 0));

  if (Platform.OS !== "android" || mountHeight <= 0) return liveHeight;
  return mountHeight;
}

/**
 * Bottom padding (px) to add to a scrollable form's content so the focused field can be
 * scrolled clear of the Android soft keyboard.
 *
 * On Android < 15 the window already resizes for the IME, so this only adds slack at the end
 * of the content — it never double-compensates the container (unlike `KeyboardAvoidingView`
 * with `behavior="padding"`, which is why that combination is avoided here). On Android 15+
 * with edge-to-edge the window does not resize at all, and this is what makes the form
 * scrollable above the keyboard.
 *
 * Returns 0 on iOS so the existing `KeyboardAvoidingView` behaviour is untouched.
 */
export function useAndroidKeyboardInset(): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    if (Platform.OS !== "android") return;
    const showSubscription = Keyboard.addListener("keyboardDidShow", (event) => {
      setInset(event.endCoordinates?.height ?? 0);
    });
    const hideSubscription = Keyboard.addListener("keyboardDidHide", () => {
      setInset(0);
    });
    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  return inset;
}
