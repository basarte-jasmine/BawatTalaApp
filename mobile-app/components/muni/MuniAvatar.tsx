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

const MUNI_FEET = require("../../assets/images/Muni/Feet.png");
const MUNI_BODY = require("../../assets/images/Muni/Body.png");
const MUNI_LEFT_HAND = require("../../assets/images/Muni/Left Hand.png");
const MUNI_RIGHT_HAND = require("../../assets/images/Muni/Right Hand.png");
const MUNI_EYES_OPEN = require("../../assets/images/Muni/Eyes Full Open.png");
const MUNI_EYES_HALF = require("../../assets/images/Muni/Eyes Half Open.png");
const MUNI_EYES_CLOSED = require("../../assets/images/Muni/Eyes Closed.png");
const AVATAR_CANVAS_SIZE = 205;

const BLINK_FRAMES: ImageSourcePropType[] = [
  MUNI_EYES_OPEN,
  MUNI_EYES_HALF,
  MUNI_EYES_CLOSED,
  MUNI_EYES_HALF,
  MUNI_EYES_OPEN,
];

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
  const [avatarSize, setAvatarSize] = useState({ height: 96, width: 96 });
  const [blinkFrameIndex, setBlinkFrameIndex] = useState(0);

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
  }, [animated, wave]);

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

  const leftHandWaveStyle = useMemo(
    () => {
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
    },
    [wave],
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
          <Image source={MUNI_RIGHT_HAND} style={styles.layer} resizeMode="contain" />
          <Animated.Image source={MUNI_LEFT_HAND} style={[styles.layer, leftHandWaveStyle]} resizeMode="contain" />
          <Image source={MUNI_BODY} style={styles.layer} resizeMode="contain" />
          <Image source={MUNI_FEET} style={[styles.layer, styles.feetLayer]} resizeMode="contain" />

          <Image
            source={BLINK_FRAMES[blinkFrameIndex]}
            style={[styles.layer, styles.faceLayer, isGhostOutfit && styles.ghostFaceLayer]}
            resizeMode="contain"
          />

          {equippedOutfitSource ? <Image source={equippedOutfitSource} style={styles.layer} resizeMode="contain" /> : null}

          {equippedEyeSource ? (
            <Image source={equippedEyeSource} style={[styles.layer, equippedEyeStyle]} resizeMode="contain" />
          ) : null}

          {equippedHeadSource ? (
            <Image source={equippedHeadSource} style={[styles.layer, equippedHeadStyle]} resizeMode="contain" />
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
