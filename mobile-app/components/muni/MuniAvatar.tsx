import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Image, ImageSourcePropType, StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import {
  getEyeAccessoryStyle,
  getHeadAccessoryStyle,
  getMuniCollectionSource,
  MuniLoadout,
  useSavedMuniLoadout,
} from "../../lib/muni-wardrobe";

type MuniAvatarProps = {
  animated?: boolean;
  loadout?: MuniLoadout;
  style?: StyleProp<ViewStyle>;
};

// Safe underscore filenames — spaced names can fail Metro asset resolution in release APKs.
const MUNI_FEET = require("../../assets/images/Muni/Feet.png");
const MUNI_BODY = require("../../assets/images/Muni/Body.png");
const MUNI_LEFT_HAND = require("../../assets/images/Muni/Left_Hand.png");
const MUNI_RIGHT_HAND = require("../../assets/images/Muni/Right_Hand.png");
const MUNI_EYES_OPEN = require("../../assets/images/Muni/Eyes_Full_Open.png");
const MUNI_EYES_HALF = require("../../assets/images/Muni/Eyes_Half_Open.png");
const MUNI_EYES_CLOSED = require("../../assets/images/Muni/Eyes_Closed.png");
const AVATAR_CANVAS_SIZE = 205;

const BLINK_FRAMES: ImageSourcePropType[] = [
  MUNI_EYES_OPEN,
  MUNI_EYES_HALF,
  MUNI_EYES_CLOSED,
  MUNI_EYES_HALF,
  MUNI_EYES_OPEN,
];

const CRITICAL_BODY_SOURCES: ImageSourcePropType[] = [
  MUNI_BODY,
  MUNI_FEET,
  MUNI_LEFT_HAND,
  MUNI_RIGHT_HAND,
  MUNI_EYES_OPEN,
];

let criticalPreloadStarted = false;

function preloadCriticalBodyParts() {
  if (criticalPreloadStarted) return;
  criticalPreloadStarted = true;
  // RN Web does not implement Image.resolveAssetSource; calling it blanked the whole Expo web tree.
  const resolveAssetSource = (Image as typeof Image & {
    resolveAssetSource?: (source: ImageSourcePropType) => { uri?: string } | null;
  }).resolveAssetSource;
  if (typeof resolveAssetSource !== "function") return;
  CRITICAL_BODY_SOURCES.forEach((source) => {
    try {
      const resolved = resolveAssetSource(source);
      if (resolved?.uri && typeof Image.prefetch === "function") {
        void Image.prefetch(resolved.uri).catch(() => undefined);
      }
    } catch {
      // Ignore per-asset resolution failures; Images still load via <Image source={...} />.
    }
  });
}

export function MuniAvatar({ animated = true, loadout, style }: MuniAvatarProps) {
  const savedLoadout = useSavedMuniLoadout();
  const activeLoadout = loadout ?? savedLoadout;
  const equippedOutfitSource = getMuniCollectionSource("outfit", activeLoadout.outfit);
  const equippedEyeSource = getMuniCollectionSource("eye", activeLoadout.eye);
  const equippedHeadSource = getMuniCollectionSource("head", activeLoadout.head);
  const equippedEyeStyle = getEyeAccessoryStyle(activeLoadout.eye);
  const equippedHeadStyle = getHeadAccessoryStyle(activeLoadout.head);
  const isGhostOutfit = activeLoadout.outfit === "spooky-ghost";
  const breath = useRef(new Animated.Value(0)).current;
  const wave = useRef(new Animated.Value(0)).current;
  const handsOpacity = useRef(new Animated.Value(0)).current;
  const faceOpacity = useRef(new Animated.Value(0)).current;
  const accessoryOpacity = useRef(new Animated.Value(0)).current;
  const [avatarSize, setAvatarSize] = useState({ height: 96, width: 96 });
  const [blinkFrameIndex, setBlinkFrameIndex] = useState(0);
  const [bodyReady, setBodyReady] = useState(false);
  const [showHands, setShowHands] = useState(false);
  const [showFace, setShowFace] = useState(false);
  const [showAccessories, setShowAccessories] = useState(false);

  useEffect(() => {
    preloadCriticalBodyParts();
  }, []);

  useEffect(() => {
    if (!bodyReady) return;
    setShowHands(true);
    Animated.timing(handsOpacity, {
      toValue: 1,
      duration: 160,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) return;
      setShowFace(true);
      Animated.timing(faceOpacity, {
        toValue: 1,
        duration: 140,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start(({ finished: faceDone }) => {
        if (!faceDone) return;
        setShowAccessories(true);
        Animated.timing(accessoryOpacity, {
          toValue: 1,
          duration: 160,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }).start();
      });
    });
  }, [accessoryOpacity, bodyReady, faceOpacity, handsOpacity]);

  useEffect(() => {
    // Reset progressive layers when the equipped look changes so new sheets fade in.
    setShowAccessories(false);
    accessoryOpacity.setValue(0);
    if (bodyReady) {
      setShowAccessories(true);
      Animated.timing(accessoryOpacity, {
        toValue: 1,
        duration: 140,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
    }
  }, [accessoryOpacity, activeLoadout.eye, activeLoadout.head, activeLoadout.outfit, bodyReady]);

  useEffect(() => {
    if (!animated) {
      breath.setValue(0);
      return undefined;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, {
          toValue: 1,
          duration: 1750,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(breath, {
          toValue: 0,
          duration: 1750,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );

    loop.start();
    return () => loop.stop();
  }, [animated, breath]);

  useEffect(() => {
    if (!animated || !showHands) {
      wave.setValue(0);
      return undefined;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(700),
        Animated.timing(wave, {
          toValue: 0,
          duration: 1,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(wave, {
          toValue: 1,
          duration: 1250,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.delay(2800),
      ]),
    );

    loop.start();
    return () => loop.stop();
  }, [animated, showHands, wave]);

  useEffect(() => {
    if (!animated || !showFace) {
      setBlinkFrameIndex(0);
      return undefined;
    }

    let mounted = true;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    function scheduleBlink(delay = 2400 + Math.random() * 1800) {
      timeoutId = setTimeout(() => {
        BLINK_FRAMES.forEach((_frame, index) => {
          setTimeout(() => {
            if (mounted) {
              setBlinkFrameIndex(index);
            }
          }, index * 58);
        });

        if (mounted) {
          scheduleBlink(2900 + Math.random() * 2600);
        }
      }, delay);
    }

    scheduleBlink();
    return () => {
      mounted = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [animated, showFace]);

  const breathingStyle = useMemo(
    () => ({
      transform: [
        {
          translateY: breath.interpolate({
            inputRange: [0, 1],
            outputRange: [0, -1.8],
          }),
        },
        {
          scaleY: breath.interpolate({
            inputRange: [0, 1],
            outputRange: [1, 1.018],
          }),
        },
        {
          scaleX: breath.interpolate({
            inputRange: [0, 1],
            outputRange: [1, 1.006],
          }),
        },
      ],
    }),
    [breath],
  );

  const leftHandWaveStyle = useMemo(() => {
    const pivotX = (0.24 - 0.5) * AVATAR_CANVAS_SIZE;
    const pivotY = (0.63 - 0.5) * AVATAR_CANVAS_SIZE;

    return {
      transform: [
        { translateX: pivotX },
        { translateY: pivotY },
        {
          rotate: wave.interpolate({
            inputRange: [0, 0.2, 0.45, 0.7, 1],
            outputRange: ["0deg", "-34deg", "24deg", "-30deg", "0deg"],
          }),
        },
        { translateX: -pivotX },
        { translateY: -pivotY },
      ],
    };
  }, [wave]);

  const scaledShellStyle = useMemo(
    () => ({
      transform: [{ scale: Math.min(avatarSize.width, avatarSize.height) / AVATAR_CANVAS_SIZE }],
    }),
    [avatarSize.height, avatarSize.width],
  );

  return (
    <View
      style={[styles.container, style]}
      onLayout={(event) => {
        const { height, width } = event.nativeEvent.layout;
        if (width > 0 && height > 0) {
          setAvatarSize((current) =>
            Math.abs(current.width - width) > 0.5 || Math.abs(current.height - height) > 0.5
              ? { height, width }
              : current,
          );
        }
      }}
    >
      <View style={[styles.scaledShell, scaledShellStyle]}>
        <Animated.View style={[styles.avatarStack, breathingStyle]}>
          {showHands ? (
            <Animated.View style={[styles.layer, { opacity: handsOpacity }]}>
              <Image source={MUNI_RIGHT_HAND} style={styles.layer} resizeMode="contain" />
              <Animated.Image source={MUNI_LEFT_HAND} style={[styles.layer, leftHandWaveStyle]} resizeMode="contain" />
            </Animated.View>
          ) : null}

          <Image
            source={MUNI_BODY}
            style={styles.layer}
            resizeMode="contain"
            onLoad={() => setBodyReady(true)}
            onError={() => setBodyReady(true)}
          />

          {showHands ? (
            <Animated.Image
              source={MUNI_FEET}
              style={[styles.layer, styles.feetLayer, { opacity: handsOpacity }]}
              resizeMode="contain"
            />
          ) : null}

          {showFace ? (
            <Animated.Image
              source={BLINK_FRAMES[blinkFrameIndex]}
              style={[styles.layer, styles.faceLayer, isGhostOutfit && styles.ghostFaceLayer, { opacity: faceOpacity }]}
              resizeMode="contain"
            />
          ) : null}

          {showAccessories && equippedOutfitSource ? (
            <Animated.Image
              source={equippedOutfitSource}
              style={[styles.layer, { opacity: accessoryOpacity }]}
              resizeMode="contain"
            />
          ) : null}

          {showAccessories && equippedEyeSource ? (
            <Animated.Image
              source={equippedEyeSource}
              style={[styles.layer, equippedEyeStyle, { opacity: accessoryOpacity }]}
              resizeMode="contain"
            />
          ) : null}

          {showAccessories && equippedHeadSource ? (
            <Animated.Image
              source={equippedHeadSource}
              style={[styles.layer, equippedHeadStyle, { opacity: accessoryOpacity }]}
              resizeMode="contain"
            />
          ) : null}
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 96,
    height: 96,
    position: "relative",
  },
  scaledShell: {
    width: AVATAR_CANVAS_SIZE,
    height: AVATAR_CANVAS_SIZE,
    position: "absolute",
    left: "50%",
    top: "50%",
    marginLeft: -AVATAR_CANVAS_SIZE / 2,
    marginTop: -AVATAR_CANVAS_SIZE / 2,
  },
  avatarStack: {
    width: AVATAR_CANVAS_SIZE,
    height: AVATAR_CANVAS_SIZE,
    position: "relative",
  },
  faceLayer: {
    transform: [{ scale: 0.94 }],
  },
  ghostFaceLayer: {
    transform: [{ translateX: -5 }, { translateY: -8 }, { scale: 0.86 }],
  },
  feetLayer: {
    transform: [{ translateY: -6 }],
  },
  layer: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
  },
});
