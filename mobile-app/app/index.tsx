import { router } from "expo-router";
import { useEffect, useRef } from "react";
import { Animated, Dimensions, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import { useAuthSession } from "../lib/auth-session";

const TITLE = "Bawat Tala";
const LETTERS = TITLE.split("");
const { width } = Dimensions.get("window");
const RADIUS = Math.min(114, width * 0.31);
const LETTER_STEP = 9.4;
const SPACE_STEP = 5.2;

export default function Index() {
  const { isHydrated, user } = useAuthSession();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const logoRiseAnim = useRef(new Animated.Value(14)).current;
  const logoScaleAnim = useRef(new Animated.Value(0.92)).current;
  const logoFloatAnim = useRef(new Animated.Value(0)).current;
  const hasNavigatedRef = useRef(false);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 700,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(logoRiseAnim, {
        toValue: 0,
        duration: 900,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(logoScaleAnim, {
        toValue: 1,
        friction: 5,
        tension: 55,
        useNativeDriver: true,
      }),
    ]).start();

    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(logoFloatAnim, {
          toValue: -6,
          duration: 1200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(logoFloatAnim, {
          toValue: 0,
          duration: 1200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );

    const floatDelay = setTimeout(() => {
      floatLoop.start();
    }, 500);

    return () => {
      clearTimeout(floatDelay);
      floatLoop.stop();
    };
  }, [fadeAnim, logoFloatAnim, logoRiseAnim, logoScaleAnim]);

  const handlePressAnywhere = () => {
    if (hasNavigatedRef.current || !isHydrated) {
      return;
    }

    hasNavigatedRef.current = true;
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 360,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(logoRiseAnim, {
        toValue: -132,
        duration: 420,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(logoScaleAnim, {
        toValue: 0.24,
        duration: 420,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => {
      router.replace(user ? "/home" : "/login");
    });
  };

  const totalSpan =
    LETTERS.reduce((acc, char) => acc + (char === " " ? SPACE_STEP : LETTER_STEP), 0) - LETTER_STEP;
  let cursor = -totalSpan / 2;

  const titleLetters = LETTERS.map((char, index) => {
    if (char === " ") {
      cursor += SPACE_STEP;
      return null;
    }

    const angle = cursor;
    cursor += LETTER_STEP;
    const radian = (angle * Math.PI) / 180;
    const x = Math.sin(radian) * RADIUS;
    const y = Math.cos(radian) * RADIUS;

    return (
      <Text
        key={`${char}-${index}`}
        style={[
          styles.titleLetter,
          {
            transform: [
              { translateX: x },
              { translateY: -y },
              { rotate: `${angle * 0.32}deg` },
            ],
          },
        ]}
      >
        {char}
      </Text>
    );
  });

  return (
    <Pressable style={styles.container} onPress={handlePressAnywhere}>
      <Animated.View
        style={[
          styles.centerWrap,
          {
            opacity: fadeAnim,
            transform: [{ scale: logoScaleAnim }, { translateY: logoRiseAnim }],
          },
        ]}
      >
        <View style={styles.arcTitleWrap}>{titleLetters}</View>
        <Animated.Image
          source={require("../assets/videos/2.gif")}
          style={[
            styles.logo,
            {
              transform: [{ translateY: logoFloatAnim }],
            },
          ]}
          resizeMode="contain"
        />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
  },
  centerWrap: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    marginTop: -24,
  },
  arcTitleWrap: {
    width: Math.min(290, width * 0.78),
    height: 84,
    marginBottom: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  titleLetter: {
    position: "absolute",
    fontSize: 22,
    lineHeight: 22,
    color: "#20242A",
    letterSpacing: 0.8,
    fontFamily: "Outfit",
  },
  logo: {
    width: Math.min(330, width * 0.78),
    height: Math.min(330, width * 0.78),
  },
});
