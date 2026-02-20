import { router } from "expo-router";
import { useEffect, useRef } from "react";
import { Animated, Dimensions, Easing, Pressable, StyleSheet, Text, View } from "react-native";

const TITLE = "Bawat Tala";
const LETTERS = TITLE.split("");
const { width, height } = Dimensions.get("window");
const ARC_RADIUS = Math.min(110, width * 0.3);
const LETTER_STEP = 9.2;
const SPACE_STEP = 5;

export default function IntroScreen() {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const riseAnim = useRef(new Animated.Value(18)).current;
  const bookFloatAnim = useRef(new Animated.Value(0)).current;
  const buttonAnim = useRef(new Animated.Value(0.96)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 700,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(riseAnim, {
        toValue: 0,
        duration: 820,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(buttonAnim, {
        toValue: 1,
        friction: 5,
        tension: 50,
        useNativeDriver: true,
      }),
    ]).start();

    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(bookFloatAnim, {
          toValue: -5,
          duration: 1300,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(bookFloatAnim, {
          toValue: 0,
          duration: 1300,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );

    floatLoop.start();
    return () => {
      floatLoop.stop();
    };
  }, [bookFloatAnim, buttonAnim, fadeAnim, riseAnim]);

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
    const x = Math.sin(radian) * ARC_RADIUS;
    const y = Math.cos(radian) * ARC_RADIUS;

    return (
      <Text
        key={`${char}-${index}`}
        style={[
          styles.titleLetter,
          {
            transform: [
              { translateX: x },
              { translateY: -y },
              { rotate: `${angle * 0.3}deg` },
            ],
          },
        ]}
      >
        {char}
      </Text>
    );
  });

  return (
    <View style={styles.screen}>
      <Animated.View
        style={[
          styles.heroWrap,
          { opacity: fadeAnim, transform: [{ translateY: riseAnim }] },
        ]}
      >
        <View style={styles.arcTitleWrap}>{titleLetters}</View>
        <Animated.Image
          source={require("../assets/images/logo_sampleIMG.png")}
          resizeMode="contain"
          style={[styles.book, { transform: [{ translateY: bookFloatAnim }] }]}
        />
      </Animated.View>

      <Animated.View style={[styles.buttonWrap, { transform: [{ scale: buttonAnim }] }]}>
        <Pressable style={styles.button} onPress={() => router.push("/login")}>
          <Text style={styles.buttonText}>Get Started</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: height * 0.33,
    paddingBottom: 60,
  },
  heroWrap: {
    width: "100%",
    maxWidth: 320,
    alignItems: "center",
    justifyContent: "center",
  },
  arcTitleWrap: {
    width: Math.min(290, width * 0.8),
    height: 80,
    marginBottom: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  titleLetter: {
    position: "absolute",
    fontSize: 22,
    lineHeight: 22,
    color: "#1A1F26",
    letterSpacing: 0.8,
    fontFamily: "Fraunces-Regular",
  },
  book: {
    width: Math.min(330, width * 0.85),
    height: Math.min(165, width * 0.43),
  },
  buttonWrap: {
    width: "100%",
    maxWidth: 320,
    alignItems: "center",
  },
  button: {
    width: 290,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#7A9EBA",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#6F93AF",
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 30 / 2,
    lineHeight: 18,
    fontWeight: "700",
  },
});
