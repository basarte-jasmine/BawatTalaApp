import { router } from "expo-router";
import { Image } from "expo-image";
import { useEffect } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import { MuniAvatar } from "../components/muni/MuniAvatar";
import { useAuthSession } from "../lib/auth-session";

const APP_MAX_WIDTH = 412;

function ZenSanctuaryBackdrop({
  width,
  height,
  domeY,
}: {
  width: number;
  height: number;
  domeY: number;
}) {
  const sceneWidth = Math.min(width && width > 0 ? width : APP_MAX_WIDTH, APP_MAX_WIDTH);
  const sceneHeight = Math.max(height && height > 0 ? height : 760, 680);

  return (
    <Svg
      width={sceneWidth}
      height={sceneHeight}
      style={StyleSheet.absoluteFillObject}
      viewBox={"0 0 " + sceneWidth + " " + sceneHeight}
    >
      <Defs>
        <LinearGradient id="zenLivelySky" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#5EBFA4" />
          <Stop offset="0.42" stopColor="#7CD49F" />
          <Stop offset="0.82" stopColor="#C8E8B6" />
          <Stop offset="1" stopColor="#FCE3A1" />
        </LinearGradient>
        <LinearGradient id="softWave" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="rgba(255, 255, 255, 0.08)" />
          <Stop offset="0.5" stopColor="rgba(255, 255, 255, 0.22)" />
          <Stop offset="1" stopColor="rgba(255, 255, 255, 0.06)" />
        </LinearGradient>
      </Defs>

      {/* Sky Base */}
      <Rect width={sceneWidth} height={sceneHeight} fill="url(#zenLivelySky)" />

      {/* Flowing Organic Swirl Waves */}
      <Path
        d={"M -20 180 C " + (sceneWidth * 0.3) + " 80, " + (sceneWidth * 0.6) + " 240, " + (sceneWidth + 40) + " 140 L " + (sceneWidth + 40) + " " + sceneHeight + " L -20 " + sceneHeight + " Z"}
        fill="url(#softWave)"
      />
      <Path
        d={"M -40 280 C " + (sceneWidth * 0.35) + " 180, " + (sceneWidth * 0.7) + " 310, " + (sceneWidth + 40) + " 220 L " + (sceneWidth + 40) + " " + sceneHeight + " L -40 " + sceneHeight + " Z"}
        fill="rgba(255, 255, 255, 0.12)"
      />

      {/* Zen Spiral Swirl Contour (Pic 2 motif in bright white) */}
      <Path
        d={"M " + (sceneWidth * 0.14) + " 260 C " + (sceneWidth * 0.02) + " 220, " + (sceneWidth * 0.08) + " 160, " + (sceneWidth * 0.28) + " 165 C " + (sceneWidth * 0.44) + " 170, " + (sceneWidth * 0.45) + " 230, " + (sceneWidth * 0.32) + " 245 C " + (sceneWidth * 0.22) + " 255, " + (sceneWidth * 0.18) + " 235, " + (sceneWidth * 0.25) + " 215 C " + (sceneWidth * 0.3) + " 200, " + (sceneWidth * 0.38) + " 205, " + (sceneWidth * 0.35) + " 220"}
        stroke="rgba(255, 255, 255, 0.35)"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />

      {/* Floating Tala Sparkles */}
      <Path
        d={"M " + (sceneWidth * 0.82) + " 65 L " + (sceneWidth * 0.835) + " 73 L " + (sceneWidth * 0.86) + " 75 L " + (sceneWidth * 0.835) + " 77 L " + (sceneWidth * 0.82) + " 85 L " + (sceneWidth * 0.805) + " 77 L " + (sceneWidth * 0.78) + " 75 L " + (sceneWidth * 0.805) + " 73 Z"}
        fill="#F59E0B"
        opacity="0.7"
      />
      <Path
        d={"M " + (sceneWidth * 0.18) + " 115 L " + (sceneWidth * 0.19) + " 120 L " + (sceneWidth * 0.21) + " 121 L " + (sceneWidth * 0.19) + " 122 L " + (sceneWidth * 0.18) + " 127 L " + (sceneWidth * 0.17) + " 122 L " + (sceneWidth * 0.15) + " 121 L " + (sceneWidth * 0.17) + " 120 Z"}
        fill="#FFFFFF"
        opacity="0.8"
      />

      {/* White Sanctuary Arched Mound */}
      <Path
        d={"M -10 " + domeY + " C " + (sceneWidth * 0.24) + " " + (domeY - 72) + ", " + (sceneWidth * 0.76) + " " + (domeY - 72) + ", " + (sceneWidth + 10) + " " + domeY + " L " + (sceneWidth + 10) + " " + sceneHeight + " L -10 " + sceneHeight + " Z"}
        fill="#FFFFFF"
      />

      {/* Botanical Garden Flowers around character base */}
      {/* Left Red Flower */}
      <G>
        <Path d={"M " + (sceneWidth * 0.18) + " " + (domeY + 32) + " Q " + (sceneWidth * 0.17) + " " + (domeY + 12) + " " + (sceneWidth * 0.19) + " " + (domeY - 6)} stroke="#2D7D5A" strokeWidth="2.5" fill="none" />
        <Path d={"M " + (sceneWidth * 0.18) + " " + (domeY + 14) + " Q " + (sceneWidth * 0.14) + " " + (domeY + 10) + " " + (sceneWidth * 0.15) + " " + (domeY + 6)} stroke="#2D7D5A" strokeWidth="2" fill="none" />
        <Circle cx={sceneWidth * 0.19} cy={domeY - 6} r={11} fill="#EF4444" />
        <Circle cx={sceneWidth * 0.19} cy={domeY - 6} r={5} fill="#FCD34D" />
      </G>

      {/* Left Coral Blossom */}
      <G>
        <Path d={"M " + (sceneWidth * 0.28) + " " + (domeY + 28) + " Q " + (sceneWidth * 0.29) + " " + (domeY + 14) + " " + (sceneWidth * 0.28) + " " + (domeY + 2)} stroke="#2D7D5A" strokeWidth="2" fill="none" />
        <Circle cx={sceneWidth * 0.28} cy={domeY + 2} r={8} fill="#F87171" />
        <Circle cx={sceneWidth * 0.28} cy={domeY + 2} r={3.5} fill="#FFFBEB" />
      </G>

      {/* Right Coral Tulip Flower */}
      <G>
        <Path d={"M " + (sceneWidth * 0.74) + " " + (domeY + 30) + " Q " + (sceneWidth * 0.73) + " " + (domeY + 10) + " " + (sceneWidth * 0.75) + " " + (domeY - 8)} stroke="#2D7D5A" strokeWidth="2.5" fill="none" />
        <Path d={"M " + (sceneWidth * 0.74) + " " + (domeY + 16) + " Q " + (sceneWidth * 0.78) + " " + (domeY + 12) + " " + (sceneWidth * 0.78) + " " + (domeY + 6)} stroke="#2D7D5A" strokeWidth="2" fill="none" />
        <Ellipse cx={sceneWidth * 0.75} cy={domeY - 8} rx={8.5} ry={11} fill="#F97316" />
        <Circle cx={sceneWidth * 0.75} cy={domeY - 14} r={4.5} fill="#FDE68A" />
      </G>

      {/* Right Blossom Flower */}
      <G>
        <Path d={"M " + (sceneWidth * 0.83) + " " + (domeY + 34) + " Q " + (sceneWidth * 0.84) + " " + (domeY + 18) + " " + (sceneWidth * 0.83) + " " + (domeY + 6)} stroke="#2D7D5A" strokeWidth="2" fill="none" />
        <Circle cx={sceneWidth * 0.83} cy={domeY + 6} r={7.5} fill="#FB7185" />
        <Circle cx={sceneWidth * 0.83} cy={domeY + 6} r={3} fill="#FEF3C7" />
      </G>

      {/* Fresh Grass Sprigs */}
      <Path d={"M " + (sceneWidth * 0.22) + " " + (domeY + 26) + " L " + (sceneWidth * 0.21) + " " + (domeY + 16)} stroke="#34D399" strokeWidth="2" strokeLinecap="round" />
      <Path d={"M " + (sceneWidth * 0.23) + " " + (domeY + 26) + " L " + (sceneWidth * 0.24) + " " + (domeY + 15)} stroke="#34D399" strokeWidth="2" strokeLinecap="round" />
      <Path d={"M " + (sceneWidth * 0.79) + " " + (domeY + 26) + " L " + (sceneWidth * 0.8) + " " + (domeY + 16)} stroke="#34D399" strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}

function AppLoadingScreen({ compact }: { compact: boolean }) {
  return (
    <View style={styles.loadingScreen}>
      <View style={[styles.loadingGlow, compact && styles.loadingGlowCompact]} />
      <View style={styles.loadingMuniWrap}>
        <MuniAvatar animated={false} style={[styles.loadingMuni, compact && styles.loadingMuniCompact]} />
      </View>
      <Text style={styles.loadingTitle}>Bawat Tala</Text>
      <Text style={styles.loadingSubtitle}>Preparing your gentle space</Text>
      <ActivityIndicator size="small" color="#2D7D5A" style={styles.loadingIndicator} />
    </View>
  );
}

export default function Index() {
  const { isHydrated, user } = useAuthSession();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const frameWidth = Math.min(width && width > 0 ? width : APP_MAX_WIDTH, APP_MAX_WIDTH);
  const isCompact = height > 0 && height < 720;
  const isNarrow = width > 0 && width < 360;
  const domeY = height * (isCompact ? 0.46 : 0.52);
  const visualScale = Math.min(1, Math.max(0.82, frameWidth / 390));

  useEffect(() => {
    if (isHydrated && user) {
      router.replace("/home");
    }
  }, [isHydrated, user]);

  if (!isHydrated) {
    return <AppLoadingScreen compact={isCompact} />;
  }

  return (
    <View style={styles.screen}>
      <ZenSanctuaryBackdrop width={frameWidth} height={height} domeY={domeY} />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContainer,
          {
            paddingTop: Math.max(insets.top + 8, 16),
            paddingBottom: Math.max(insets.bottom + 12, 24),
          },
        ]}
        bounces={false}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Header Typography */}
        <View
          style={[
            styles.topHeader,
            isCompact && styles.topHeaderCompact,
            { paddingHorizontal: Math.max(20, 26 * visualScale) },
          ]}
        >
          <Text style={[styles.welcomeTo, isCompact && styles.welcomeToCompact]}>Welcome To,</Text>
          <Text style={[styles.brandTitle, isCompact && styles.brandTitleCompact]}>Bawat Tala</Text>
          <Text style={[styles.tagline, isCompact && styles.taglineCompact]}>A softer space for your thoughts.</Text>
        </View>

        {/* Center Muni Character on the White Mound Crest */}
        <View style={[styles.characterStage, isCompact && styles.characterStageCompact]}>
          <Image
            source={require("../assets/images/MUNI_default.png")}
            style={[
              styles.muniImage,
              isCompact && styles.muniImageCompact,
              {
                width: (isCompact ? 156 : 204) * visualScale,
                height: (isCompact ? 156 : 204) * visualScale,
              },
            ]}
            contentFit="contain"
          />
        </View>

        {/* Bottom Sanctuary White Area with Actions */}
        <View style={[styles.bottomCard, isNarrow && styles.bottomCardNarrow]}>
          <Text style={[styles.welcomePrompt, isCompact && styles.welcomePromptCompact]}>
            Start your reflection journey and find your daily calm.
          </Text>

          <View style={[styles.buttonRow, isNarrow && styles.buttonRowNarrow]}>
            <Pressable
              style={styles.loginButton}
              onPress={() => router.push("/login")}
              accessibilityRole="button"
              accessibilityLabel="Login"
            >
              <Text style={styles.loginButtonText}>Login</Text>
            </Pressable>

            <Pressable
              style={styles.registerButton}
              onPress={() => router.push("/register")}
              accessibilityRole="button"
              accessibilityLabel="Register"
            >
              <Text style={styles.registerButtonText}>Register</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    width: "100%",
    maxWidth: APP_MAX_WIDTH,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: "#F7FAF4",
  },
  loadingGlow: {
    position: "absolute",
    width: 310,
    height: 310,
    borderRadius: 155,
    backgroundColor: "#E4F4D8",
    opacity: 0.72,
  },
  loadingGlowCompact: {
    width: 250,
    height: 250,
    borderRadius: 125,
  },
  loadingMuniWrap: {
    width: 154,
    height: 154,
    borderRadius: 52,
    backgroundColor: "#EAF8DF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#2D7D5A",
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  loadingMuni: {
    width: 142,
    height: 142,
  },
  loadingMuniCompact: {
    width: 118,
    height: 118,
  },
  loadingTitle: {
    marginTop: 24,
    color: "#18362B",
    fontFamily: "Outfit-Bold",
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.2,
  },
  loadingSubtitle: {
    marginTop: 4,
    color: "#527365",
    fontFamily: "Outfit-Medium",
    fontSize: 14,
    lineHeight: 20,
  },
  loadingIndicator: {
    marginTop: 22,
  },
  screen: {
    flex: 1,
    backgroundColor: "#5EBFA4",
    alignItems: "center",
  },
  scrollContainer: {
    flexGrow: 1,
    width: "100%",
    maxWidth: APP_MAX_WIDTH,
    justifyContent: "space-between",
  },
  topHeader: {
    paddingHorizontal: 26,
    paddingTop: 16,
    alignItems: "flex-start",
  },
  topHeaderCompact: {
    paddingTop: 8,
    paddingHorizontal: 20,
  },
  welcomeTo: {
    fontFamily: "Outfit-Medium",
    fontSize: 22,
    lineHeight: 28,
    color: "#18362B",
  },
  welcomeToCompact: {
    fontSize: 19,
    lineHeight: 24,
  },
  brandTitle: {
    fontFamily: "Outfit-Bold",
    fontSize: 34,
    lineHeight: 40,
    color: "#112E24",
    letterSpacing: -0.4,
    marginTop: 2,
  },
  brandTitleCompact: {
    fontSize: 28,
    lineHeight: 34,
  },
  tagline: {
    fontFamily: "Outfit",
    fontSize: 14,
    lineHeight: 20,
    color: "#2C5446",
    marginTop: 4,
  },
  taglineCompact: {
    fontSize: 12.5,
    lineHeight: 17,
  },
  characterStage: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 26,
    marginBottom: 6,
  },
  characterStageCompact: {
    marginTop: 14,
    marginBottom: 2,
  },
  muniImage: {
    width: 204,
    height: 204,
  },
  muniImageCompact: {
    width: 156,
    height: 156,
  },
  bottomCard: {
    paddingHorizontal: 24,
    alignItems: "center",
  },
  bottomCardNarrow: {
    paddingHorizontal: 16,
  },
  welcomePrompt: {
    fontFamily: "Outfit",
    fontSize: 13.5,
    lineHeight: 20,
    color: "#4B5563",
    textAlign: "center",
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  welcomePromptCompact: {
    fontSize: 12.5,
    lineHeight: 17,
    marginBottom: 14,
  },
  buttonRow: {
    flexDirection: "row",
    columnGap: 12,
    width: "100%",
  },
  buttonRowNarrow: {
    columnGap: 8,
  },
  loginButton: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#2D7D5A",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#1B523A",
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  loginButtonText: {
    fontFamily: "Outfit-Bold",
    fontSize: 16,
    color: "#FFFFFF",
    letterSpacing: 0.1,
  },
  registerButton: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#2D7D5A",
    alignItems: "center",
    justifyContent: "center",
  },
  registerButtonText: {
    fontFamily: "Outfit-Bold",
    fontSize: 16,
    color: "#2D7D5A",
    letterSpacing: 0.1,
  },
});
