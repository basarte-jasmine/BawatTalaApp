import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useRef } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import { useAuthSession } from "../lib/auth-session";

const APP_MAX_WIDTH = 412;

function LaunchBackdrop({ height, width }: { height: number; width: number }) {
  const sceneWidth = Math.min(width, APP_MAX_WIDTH);
  const sceneHeight = Math.max(height, 680);
  const lowerBandTop = sceneHeight - 190;
  const meadowTop = sceneHeight - 126;

  return (
    <Svg
      style={styles.backdropSvg}
      width={sceneWidth}
      height={sceneHeight}
      viewBox={`0 0 ${sceneWidth} ${sceneHeight}`}
    >
      <Defs>
        <LinearGradient id="launchSky" x1="0" x2="0" y1="0" y2="1">
          <Stop offset="0" stopColor="#F8FFF8" />
          <Stop offset="0.52" stopColor="#E8F7EF" />
          <Stop offset="1" stopColor="#FDF8EA" />
        </LinearGradient>
        <LinearGradient id="launchSea" x1="0" x2="1" y1="0" y2="1">
          <Stop offset="0" stopColor="#71D0C7" />
          <Stop offset="0.52" stopColor="#82CE82" />
          <Stop offset="1" stopColor="#F7D77A" />
        </LinearGradient>
      </Defs>
      <Rect width={sceneWidth} height={sceneHeight} fill="url(#launchSky)" />
      <Path
        d={`M0 ${lowerBandTop + 28} C ${sceneWidth * 0.2} ${lowerBandTop - 20}, ${sceneWidth * 0.43} ${
          lowerBandTop + 68
        }, ${sceneWidth * 0.68} ${lowerBandTop + 12} C ${sceneWidth * 0.84} ${lowerBandTop - 22}, ${
          sceneWidth * 0.94
        } ${lowerBandTop + 12}, ${sceneWidth} ${lowerBandTop - 4} L ${sceneWidth} ${sceneHeight} L 0 ${sceneHeight} Z`}
        fill="#D9F0E9"
      />
      <Path
        d={`M0 ${meadowTop + 20} C ${sceneWidth * 0.2} ${meadowTop - 8}, ${sceneWidth * 0.36} ${
          meadowTop + 40
        }, ${sceneWidth * 0.58} ${meadowTop + 18} C ${sceneWidth * 0.82} ${meadowTop - 8}, ${
          sceneWidth * 0.9
        } ${meadowTop + 30}, ${sceneWidth} ${meadowTop + 2} L ${sceneWidth} ${sceneHeight} L 0 ${sceneHeight} Z`}
        fill="url(#launchSea)"
        opacity={0.86}
      />
      <Path
        d={`M28 112 L34 126 L49 132 L34 138 L28 152 L22 138 L7 132 L22 126 Z`}
        fill="#F3C94D"
        opacity={0.38}
      />
      <Path
        d={`M${sceneWidth - 54} 156 L${sceneWidth - 50} 166 L${sceneWidth - 39} 170 L${sceneWidth - 50} 174 L${
          sceneWidth - 54
        } 184 L${sceneWidth - 58} 174 L${sceneWidth - 69} 170 L${sceneWidth - 58} 166 Z`}
        fill="#6FC6B9"
        opacity={0.42}
      />
      <Path
        d={`M${sceneWidth - 96} 78 L${sceneWidth - 92} 86 L${sceneWidth - 84} 90 L${sceneWidth - 92} 94 L${
          sceneWidth - 96
        } 102 L${sceneWidth - 100} 94 L${sceneWidth - 108} 90 L${sceneWidth - 100} 86 Z`}
        fill="#EFA95F"
        opacity={0.36}
      />
    </Svg>
  );
}

export default function Index() {
  const { isHydrated, user } = useAuthSession();
  const { height, width } = useWindowDimensions();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const logoRiseAnim = useRef(new Animated.Value(14)).current;
  const logoScaleAnim = useRef(new Animated.Value(0.94)).current;
  const logoFloatAnim = useRef(new Animated.Value(0)).current;
  const hasNavigatedRef = useRef(false);

  const compact = height < 720;
  const logoSize = compact ? 152 : 178;
  const frameWidth = Math.min(width, APP_MAX_WIDTH);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 620,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(logoRiseAnim, {
        toValue: 0,
        duration: 840,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(logoScaleAnim, {
        toValue: 1,
        friction: 7,
        tension: 52,
        useNativeDriver: true,
      }),
    ]).start();

    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(logoFloatAnim, {
          toValue: -5,
          duration: 1500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(logoFloatAnim, {
          toValue: 0,
          duration: 1500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );

    const floatDelay = setTimeout(() => {
      floatLoop.start();
    }, 540);

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
        duration: 320,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(logoRiseAnim, {
        toValue: -84,
        duration: 380,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(logoScaleAnim, {
        toValue: 0.72,
        duration: 380,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => {
      router.replace(user ? "/home" : "/login");
    });
  };

  return (
    <Pressable
      accessibilityLabel="Start Bawat Tala"
      accessibilityRole="button"
      accessibilityState={{ disabled: !isHydrated }}
      disabled={!isHydrated}
      onPress={handlePressAnywhere}
      style={styles.container}
    >
      <LaunchBackdrop height={height} width={frameWidth} />
      <SafeAreaView style={styles.safeArea}>
        <Animated.View
          style={[
            styles.content,
            compact && styles.contentCompact,
            {
              opacity: fadeAnim,
              transform: [{ scale: logoScaleAnim }, { translateY: logoRiseAnim }],
            },
          ]}
        >
          <View style={styles.brandCopy}>
            <Text style={styles.title}>Bawat Tala</Text>
            <Text style={styles.subtitle}>A softer space for your thoughts.</Text>
          </View>

          <View style={[styles.logoStage, { minHeight: logoSize + 34 }]}>
            <View style={[styles.logoShelf, { width: logoSize + 48, height: logoSize + 28 }]} />
            <Animated.Image
              source={require("../assets/videos/2.gif")}
              style={[
                styles.logo,
                {
                  width: logoSize,
                  height: logoSize,
                  transform: [{ translateY: logoFloatAnim }],
                },
              ]}
              resizeMode="contain"
            />
          </View>

          <View style={[styles.ctaButton, !isHydrated && styles.ctaButtonDisabled]}>
            <Text style={styles.ctaText}>Begin</Text>
            <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
          </View>
        </Animated.View>
      </SafeAreaView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FFF8",
  },
  backdropSvg: {
    ...StyleSheet.absoluteFillObject,
    pointerEvents: "none",
  },
  safeArea: {
    flex: 1,
    justifyContent: "center",
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    paddingBottom: 42,
    paddingTop: 32,
  },
  contentCompact: {
    paddingBottom: 24,
    paddingTop: 22,
  },
  brandCopy: {
    alignItems: "center",
    marginBottom: 26,
    maxWidth: 310,
  },
  title: {
    color: "#213A35",
    fontSize: 38,
    lineHeight: 44,
    fontWeight: "800",
    textAlign: "center",
  },
  subtitle: {
    color: "#56706A",
    fontSize: 16,
    lineHeight: 22,
    marginTop: 6,
    textAlign: "center",
  },
  logoStage: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 30,
  },
  logoShelf: {
    position: "absolute",
    bottom: 4,
    borderRadius: 999,
    backgroundColor: "rgba(255, 255, 255, 0.58)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.74)",
    shadowColor: "#5C8F7D",
    shadowOpacity: 0.16,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    elevation: 3,
  },
  logo: {
    shadowColor: "#365E48",
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 7 },
  },
  ctaButton: {
    minWidth: 152,
    height: 48,
    borderRadius: 999,
    backgroundColor: "#2D7D5A",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    columnGap: 8,
    shadowColor: "#1F5744",
    shadowOpacity: 0.22,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  ctaButtonDisabled: {
    opacity: 0.72,
  },
  ctaText: {
    color: "#FFFFFF",
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "800",
  },
});
