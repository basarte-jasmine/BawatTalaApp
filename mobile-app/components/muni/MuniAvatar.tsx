import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, ImageSourcePropType, StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { Image } from "expo-image";
import {
  getEyeAccessoryStyle,
  getHeadAccessoryStyle,
  getOutfitAccessoryStyle,
  getMuniCollectionSource,
  MuniLoadout,
  useSavedMuniLoadout,
} from "../../lib/muni-wardrobe";

type MuniAvatarProps = {
  animated?: boolean;
  loadout?: MuniLoadout;
  style?: StyleProp<ViewStyle>;
  waving?: boolean;
};

// Safe underscore filenames - spaced names can fail Metro asset resolution in release APKs.
const MUNI_FEET = require("../../assets/images/Muni/Feet.webp");
const MUNI_BODY = require("../../assets/images/Muni/Body.webp");
const MUNI_RIGHT_HAND = require("../../assets/images/Muni/Right_Hand.png");
const MUNI_ARM_1 = require("../../assets/images/Muni/Arm1.webp");
const MUNI_ARM_2 = require("../../assets/images/Muni/Arm2.webp");
const MUNI_ARM_3 = require("../../assets/images/Muni/Arm3.webp");
const MUNI_EYES_OPEN = require("../../assets/images/Muni/Eyes_Full_Open.webp");
const MUNI_EYES_HALF = require("../../assets/images/Muni/Eyes_Half_Open.webp");
const MUNI_EYES_CLOSED = require("../../assets/images/Muni/Eyes_Closed.webp");
const AVATAR_CANVAS_SIZE = 205;

const BLINK_FRAMES: ImageSourcePropType[] = [
  MUNI_EYES_OPEN,
  MUNI_EYES_HALF,
  MUNI_EYES_CLOSED,
  MUNI_EYES_HALF,
  MUNI_EYES_OPEN,
];

const WAVE_SEQUENCE: ImageSourcePropType[] = [
  MUNI_ARM_1,
  MUNI_ARM_2,
  MUNI_ARM_3,
  MUNI_ARM_2,
  MUNI_ARM_3,
  MUNI_ARM_2,
  MUNI_ARM_1,
];

const CRITICAL_BODY_SOURCES: ImageSourcePropType[] = [
  MUNI_BODY,
  MUNI_FEET,
  MUNI_RIGHT_HAND,
  MUNI_ARM_1,
  MUNI_ARM_2,
  MUNI_ARM_3,
  MUNI_EYES_OPEN,
];

let criticalPreloadStarted = false;

function preloadCriticalBodyParts() {
  if (criticalPreloadStarted) return;
  criticalPreloadStarted = true;
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

export function MuniAvatar({ animated = true, loadout, style, waving = false }: MuniAvatarProps) {
  const savedLoadout = useSavedMuniLoadout();
  const activeLoadout = loadout ?? savedLoadout;
  const equippedOutfitSource = getMuniCollectionSource("outfit", activeLoadout.outfit);
  const equippedEyeSource = getMuniCollectionSource("eye", activeLoadout.eye);
  const equippedHeadSource = getMuniCollectionSource("head", activeLoadout.head);
  const equippedOutfitStyle = getOutfitAccessoryStyle(activeLoadout.outfit);
  const equippedEyeStyle = getEyeAccessoryStyle(activeLoadout.eye);
  const equippedHeadStyle = getHeadAccessoryStyle(activeLoadout.head);
  const isGhostOutfit = activeLoadout.outfit === "spooky-ghost";
  const breath = useRef(new Animated.Value(0)).current;
  const [avatarSize, setAvatarSize] = useState({ height: 96, width: 96 });
  const [blinkFrameIndex, setBlinkFrameIndex] = useState(0);
  const [currentArmSource, setCurrentArmSource] = useState<ImageSourcePropType>(MUNI_ARM_1);

  useEffect(() => {
    preloadCriticalBodyParts();
  }, []);

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
    if (!animated) {
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
  }, [animated]);

  useEffect(() => {
    if (!animated) {
      setCurrentArmSource(MUNI_ARM_1);
      return undefined;
    }

    let mounted = true;
    let waveTimeout: ReturnType<typeof setTimeout> | null = null;

    function triggerWave() {
      WAVE_SEQUENCE.forEach((frame, idx) => {
        setTimeout(() => {
          if (mounted) {
            setCurrentArmSource(frame);
          }
        }, idx * 110);
      });

      setTimeout(() => {
        if (mounted) {
          setCurrentArmSource(MUNI_ARM_1);
        }
      }, WAVE_SEQUENCE.length * 110);
    }

    function scheduleWave(delay = 4000 + Math.random() * 3000) {
      waveTimeout = setTimeout(() => {
        triggerWave();
        if (mounted) {
          scheduleWave(6000 + Math.random() * 4000);
        }
      }, delay);
    }

    if (waving) {
      const waveInterval = setInterval(() => {
        if (mounted) triggerWave();
      }, WAVE_SEQUENCE.length * 110 + 350);
      triggerWave();
      return () => {
        mounted = false;
        clearInterval(waveInterval);
      };
    }

    scheduleWave();
    return () => {
      mounted = false;
      if (waveTimeout) clearTimeout(waveTimeout);
    };
  }, [animated, waving]);

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
          {/* Both hands: Right Hand on left side, animated waving Arm on right side */} 
          <Image
            source={MUNI_RIGHT_HAND}
            style={styles.layer}
            contentFit="contain"
            cachePolicy="memory-disk"
            priority="high"
          />
          <Image
            source={currentArmSource}
            style={[styles.layer, styles.wavingArmLayer]}
            contentFit="contain"
            cachePolicy="memory-disk"
            priority="high"
          />

          <Image
            source={MUNI_FEET}
            style={[styles.layer, styles.feetLayer]}
            contentFit="contain"
            cachePolicy="memory-disk"
            priority="high"
          />

          <Image
            source={MUNI_BODY}
            style={styles.layer}
            contentFit="contain"
            cachePolicy="memory-disk"
            priority="high"
          />

          <Image
            source={BLINK_FRAMES[blinkFrameIndex]}
            style={[styles.layer, styles.faceLayer, isGhostOutfit && styles.ghostFaceLayer]}
            contentFit="contain"
            cachePolicy="memory-disk"
            priority="high"
          />

          {equippedOutfitSource ? (
            <Image
              source={equippedOutfitSource}
              style={[styles.layer, equippedOutfitStyle]}
              contentFit="contain"
              cachePolicy="memory-disk"
            />
          ) : null}

          {equippedEyeSource ? (
            <Image
              source={equippedEyeSource}
              style={[styles.layer, equippedEyeStyle]}
              contentFit="contain"
              cachePolicy="memory-disk"
            />
          ) : null}

          {equippedHeadSource ? (
            <Image
              source={equippedHeadSource}
              style={[styles.layer, equippedHeadStyle]}
              contentFit="contain"
              cachePolicy="memory-disk"
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
  wavingArmLayer: {
    transform: [{ translateX: 14 }, { scale: 1.12 }],
  },
  faceLayer: {
    transform: [{ translateX: -2.5 }, { translateY: 2.5 }, { scale: 0.84 }],
  },
  ghostFaceLayer: {
    transform: [{ translateX: -4 }, { translateY: -6 }, { scale: 0.8 }],
  },
  feetLayer: {
    transform: [{ translateY: -7 }, { translateX: -3.5 }],
  },
  layer: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
  },
});
