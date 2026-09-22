import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import {  Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { HomeBottomNav } from "../components/home/HomeBottomNav";

type ToolItem = {
  accentColor: string;
  available: boolean;
  description: string;
  id: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  title: string;
};

type MiniResetItem = {
  description: string;
  duration: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  id: "memory" | "pattern" | "recall" | "words" | "numbers" | "count" | "color";
  title: string;
};

type FeaturedGame = {
  description: string;
  duration: string;
  id: "fruit-catcher" | "image-puzzle" | "munis-arrival" | "gentle-pairs" | "unscramble-word";
  image: number;
  label: string;
  title: string;
};

const WELLNESS_TOOLS: ToolItem[] = [
  {
    accentColor: "#4F8A38",
    available: true,
    id: "breathing",
    label: "Open now",
    title: "Diaphragmatic Breathing",
    icon: "leaf-outline",
    description: "Regulate heart rate and reduce physiological stress responses through breathing patterns." },
  {
    accentColor: "#537C68",
    available: true,
    id: "grounding",
    label: "Open now",
    title: "5-4-3-2-1 Sensory Grounding",
    icon: "eye-outline",
    description: "Follow the guided 5-4-3-2-1 video exercise to reconnect with your present surroundings using your senses." },
];

const MINI_RESETS: MiniResetItem[] = [
  
  { id: "pattern", title: "Notice the Pattern", description: "Watch a small sequence, then repeat it.", duration: "~30 sec", icon: "shapes-outline" },
  { id: "recall", title: "Visual Recall", description: "Take a breath and recreate a simple arrangement.", duration: "~30 sec", icon: "eye-outline" },
  { id: "numbers", title: "Number Flow", description: "Notice a gentle number pattern.", duration: "~20 sec", icon: "analytics-outline" },
  { id: "count", title: "Calm Count", description: "Tap the numbers in a steady order.", duration: "~20 sec", icon: "list-outline" },
  { id: "color", title: "Color Focus", description: "Find the one tile that matches.", duration: "~20 sec", icon: "color-palette-outline" },
];

const FEATURED_GAMES: FeaturedGame[] = [
  {
    id: "unscramble-word",
    title: "Unscramble Word",
    label: "Mindful Focus",
    description: "Rebuild calming words before the time fades.",
    duration: "Endless",
    image: require("../assets/images/Mini Reset/Unscramble Word/Unscramble Word Cover.webp")},
  {
    id: "gentle-pairs",
    title: "Gentle Pairs",
    label: "Memory Focus",
    description: "Flip the cards and find the matching Muni moments.",
    duration: "Endless",
    image: require("../assets/images/Mini Reset/Gentle Pairs/Gentle Pairs Cover.webp")},
  {
    id: "image-puzzle",
    title: "Muni's Picture Puzzle",
    label: "Slow focus",
    description: "Rebuild a bright little scene, one piece at a time.",
    duration: "2-5 min",
    image: require("../assets/images/Mini Reset/Puzzle/Muni Puzzle Cover.webp")},
  {
    id: "fruit-catcher",
    title: "Fruit Catcher",
    label: "Playful focus",
    description: "Catch the good things and keep an eye out for shells.",
    duration: "Endless",
    image: require("../assets/images/Mini Reset/Fruit Catcher/Fruit Catcher Cover.webp")},
  {
    id: "munis-arrival",
    title: "Muni's Arrival",
    label: "Flow state",
    description: "Guide the unconscious Muni. Be the gentle current guiding Muni s raft.",
    duration: "Endless",
    image: require("../assets/images/Mini Reset/Muni's Arrival/Muni's Arrival Cover.webp")},
];

export default function WellnessToolsScreen() {
  const { width } = useWindowDimensions();
  const compact = width < 390;

  const handleBack = () => {
    router.replace("/home");
  };

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.topBar}>
        <Pressable style={styles.backButton} accessibilityLabel="Go back" onPress={handleBack}>
          <Ionicons name="chevron-back" size={28} color="#37424F" />
        </Pressable>
        <Text style={styles.topTitle}>Wellness Tools</Text>
        <View style={styles.topBarSpacer} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, compact && styles.scrollContentCompact]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.contentFrame}>
          <View style={[styles.heroCard, compact && styles.heroCardCompact]}>
            <View style={styles.heroOrb} />
            <View style={styles.heroBadge}>
              <Ionicons name="sparkles-outline" size={16} color="#4C7E32" />
              <Text style={styles.heroBadgeText}>Your reset space</Text>
            </View>
            <Text style={[styles.sectionTitle, compact && styles.sectionTitleCompact]}>A softer moment starts here.</Text>
            <Text style={[styles.sectionDesc, compact && styles.sectionDescCompact]}>
              Choose one small practice. There is no right pace—just what feels supportive now.
            </Text>
          </View>

          <View style={[styles.listSection, compact && styles.listSectionCompact]}>
            <Text style={styles.listHeading}>Guided support</Text>
            <Text style={styles.listSubHeading}>Simple practices for a steadier moment.</Text>

            <View style={styles.toolList}>
              {WELLNESS_TOOLS.map((item) => (
                <Pressable
                  key={item.id}
                  disabled={!item.available}
                  style={[styles.toolCard, compact && styles.toolCardCompact, !item.available && styles.toolCardDisabled]}
                  onPress={() => {
                    if (item.id === "breathing") {
                      router.push("/wellness-breathing");
                      return;
                    }

                    if (item.id === "grounding") {
                      router.push("/wellness-grounding");
                    }
                  }}
                >
                  <View style={styles.toolCardTopRow}>
                    <View style={[styles.toolIconWrap, { backgroundColor: `${item.accentColor}14`, borderColor: `${item.accentColor}24` }]}>
                      <Ionicons name={item.icon} size={20} color={item.accentColor} />
                    </View>
                    <View style={styles.toolCopy}><Text style={[styles.toolTitle, compact && styles.toolTitleCompact]}>{item.title}</Text><Text style={styles.toolDesc} numberOfLines={2}>{item.description}</Text></View>
                    <View style={[styles.toolArrowWrap, !item.available && styles.toolArrowMuted]}>
                      <Ionicons name={item.available ? "chevron-forward" : "time-outline"} size={18} color="#4A5966" />
                    </View>
                  </View>
                    <View style={styles.toolMetaRow}>
                      <View style={styles.toolTag}>
                        <Ionicons name="checkmark-circle-outline" size={13} color="#43702A" />
                        <Text style={styles.toolTagText}>{item.available ? "Ready now" : "Coming soon"}</Text>
                      </View>
                      <Text style={styles.toolMetaText}>Self-guided · 2–5 min</Text>
                    </View>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={[styles.featuredSection, compact && styles.featuredSectionCompact]}>
            <View style={styles.sectionHeadingCopy}>
              <View style={styles.sectionKickerRow}>
                <Ionicons name="game-controller-outline" size={15} color="#4F8A38" />
                <Text style={[styles.sectionKicker, styles.featuredKicker]}>FEATURED GAMES</Text>
              </View>
              <Text style={styles.listHeading}>Meet Muni in motion</Text>
              <Text style={styles.listSubHeading}>Bigger ways to reset, play, and stay curious.</Text>
            </View>
            <View style={styles.featuredGameGrid}>{FEATURED_GAMES.map((game) => (<Pressable key={game.id} style={({ pressed }) => [styles.featuredGameCard, pressed && styles.miniResetCardPressed]} accessibilityLabel={game.title + ", " + game.duration} onPress={() => router.push("/" + game.id as any)}>
                  <Image source={game.image} style={[styles.featuredGameImage, compact && styles.featuredGameImageCompact]} contentFit="cover" />
                  <View style={styles.featuredGameBody}>
                    <Text style={styles.featuredGameLabel}>{game.label}</Text>
                    <Text style={styles.featuredGameTitle}>{game.title}</Text>
                    <Text style={styles.featuredGameDescription} numberOfLines={2}>{game.description}</Text>
                    <View style={styles.featuredGameMeta}>
                      <Text style={styles.miniResetMetaText}>{game.duration}</Text>
                      <View style={styles.featuredGameArrow}><Ionicons name="arrow-forward" size={15} color="#FFFFFF" /></View>
                    </View>
                  </View>
                </Pressable>))}</View>
          </View>

          {/* Mini Resets Temporarily Hidden */}
        </View>
      </ScrollView>

      <HomeBottomNav activeTab="none" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F7FAF6" },
  topBar: {
    height: 52,
    borderBottomWidth: 1,
    borderBottomColor: "#E6ECF1",
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    shadowColor: "#777777",
    shadowOpacity: 0.12,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2 },
  backButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center" },
  topTitle: {
    color: "#33475C",
    fontSize: 36 / 2,
    lineHeight: 24,
    fontFamily: "Outfit-Bold" },
  topBarSpacer: {
    width: 36,
    height: 36 },
  scroll: {
    flex: 1 },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 92,
    alignItems: "center" },
  scrollContentCompact: {
    paddingHorizontal: 12 },
  contentFrame: {
    width: "100%",
    maxWidth: 420,
    alignSelf: "center" },
  heroCard: {
    width: "100%",
    borderRadius: 28,
    backgroundColor: "#E2F2D7",
    borderWidth: 1,
    borderColor: "#C6E6A4",
    paddingHorizontal: 18,
    paddingTop: 15,
    paddingBottom: 16,
    overflow: "hidden",
    marginBottom: 14 },
  heroCardCompact: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 16 },
  heroOrb: {
    position: "absolute",
    width: 150,
    height: 150,
    borderRadius: 999,
    right: -54,
    top: -56,
    backgroundColor: "rgba(255,255,255,0.42)"},
  heroGlowOne: {
    position: "absolute",
    top: -28,
    right: -22,
    width: 140,
    height: 140,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.22)" },
  heroGlowTwo: {
    position: "absolute",
    left: -22,
    bottom: -48,
    width: 120,
    height: 120,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.16)" },
  heroBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    columnGap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.72)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.88)",
    marginBottom: 10 },
  heroBadgeText: {
    color: "#4C7E32",
    fontSize: 12,
    lineHeight: 16,
    fontFamily: "Outfit-Bold" },
  centerLogo: {
    width: "100%",
    maxWidth: 320,
    height: 138,
    alignSelf: "center",
    marginBottom: 8 },
  centerLogoCompact: {
    maxWidth: 260,
    height: 118,
    marginBottom: 6 },
  sectionTitle: {
    color: "#2F4156",
    fontSize: 24,
    lineHeight: 29,
    fontFamily: "Outfit-Bold",
    marginBottom: 8 },
  sectionTitleCompact: {
    fontSize: 22,
    lineHeight: 27 },
  sectionDesc: {
    color: "#446058",
    fontSize: 14,
    lineHeight: 20 },
  sectionDescCompact: {
    fontSize: 13,
    lineHeight: 19 },
  featuredSection: {
    width: "100%",
    borderRadius: 24,
    backgroundColor: "#F1F8EC",
    borderWidth: 1,
    borderColor: "#D7EBCB",
    paddingHorizontal: 14,
    paddingTop: 16,
    paddingBottom: 16,
    marginBottom: 14 },
  featuredSectionCompact: {
    paddingHorizontal: 12,
    paddingTop: 14,
    paddingBottom: 14 },
  listSection: {
    width: "100%",
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E6EEE7",
    paddingHorizontal: 14,
    paddingTop: 16,
    paddingBottom: 18,
    shadowColor: "#66737E",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2 },
  listSectionCompact: {
    paddingHorizontal: 12,
    paddingTop: 14,
    paddingBottom: 16 },
  listHeading: {
    color: "#2F4156",
    fontSize: 19,
    lineHeight: 24,
    fontFamily: "Outfit-Bold",
    marginBottom: 4 },
  listSubHeading: {
    color: "#607181",
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 14 },
  toolList: {
    width: "100%",
    rowGap: 10 },
  toolCard: {
    width: "100%",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#DDE8D6",
    backgroundColor: "#F9FCF7",
    paddingHorizontal: 12,
    paddingVertical: 12 },
  toolCardCompact: {
    paddingHorizontal: 11,
    paddingTop: 11,
    paddingBottom: 11 },
  toolCardDisabled: {
    opacity: 0.78 },
  toolCardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 11 },
  toolCopy: { flex: 1 },
  toolMetaRow: { flexDirection: "row", alignItems: "center", columnGap: 9, marginTop: 10, paddingLeft: 53 },
  toolCardTopRowCompact: {
    justifyContent: "flex-start" },
  toolIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center" },
  toolTag: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#EDF8E6",
    borderWidth: 1,
    borderColor: "#D8EEC9" },
  toolTagMuted: {
    backgroundColor: "#F4F6F8",
    borderColor: "#E3E7EB" },
  toolTagText: {
    color: "#43702A",
    fontSize: 11,
    lineHeight: 14,
    fontFamily: "Outfit-Bold" },
  toolTagTextMuted: {
    color: "#6E7B87" },
  toolMetaText: {
    color: "#7A8791",
    fontSize: 11,
    lineHeight: 15,
    fontFamily: "Outfit-SemiBold" },
  toolTitle: {
    color: "#33495D",
    fontSize: 17,
    lineHeight: 22,
    fontFamily: "Outfit-Bold",
    marginBottom: 6 },
  toolTitleCompact: {
    fontSize: 16,
    lineHeight: 21 },
  toolRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    columnGap: 10 },
  toolRowStacked: {
    flexDirection: "column",
    rowGap: 10 },
  toolDesc: {
    flex: 1,
    color: "#5A6C7C",
    fontSize: 13,
    lineHeight: 18 },
  toolArrowWrap: {
    width: 28,
    height: 28,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E4EAEE",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 2 },
  toolArrowMuted: { opacity: 0.6 },
  toolArrowWrapStacked: {
    marginTop: 0,
    alignSelf: "flex-start" },
  miniResetSection: {
    width: "100%",
    borderRadius: 24,
    backgroundColor: "#F9F8FD",
    borderWidth: 1,
    borderColor: "#E6E2F2",
    paddingHorizontal: 14,
    paddingTop: 16,
    paddingBottom: 16,
    marginTop: 14},
  miniResetHeadingRow: { flexDirection: "row", justifyContent: "space-between", columnGap: 12, marginBottom: 14 },
  sectionHeadingCopy: { flex: 1 },
  sectionKickerRow: { flexDirection: "row", alignItems: "center", columnGap: 6, marginBottom: 6 },
  sectionKicker: { color: "#625D8F", fontSize: 10, lineHeight: 13, letterSpacing: 0.8, fontFamily: "Outfit-Bold" },
  featuredKicker: { color: "#4F8A38" },
  miniResetSparkle: { width: 38, height: 38, borderRadius: 14, backgroundColor: "#F0EDFA", alignItems: "center", justifyContent: "center" },
  miniResetGrid: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  miniResetTile: { width: "48.5%", minHeight: 142, borderRadius: 18, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E7E4F0", padding: 12 },
  miniResetTileCompact: { width: "48%", padding: 10 },
  miniResetTileTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  miniResetCard: { width: "100%", minHeight: 64, flexDirection: "row", alignItems: "center", columnGap: 10, borderRadius: 16, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E7E4F0", padding: 11 },
  miniResetCardPressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
  miniResetIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: "#F0EDFA", alignItems: "center", justifyContent: "center" },
  miniResetCopy: { flex: 1 },
  miniResetTitle: { color: "#3E4159", fontFamily: "Outfit-Bold", fontSize: 15, lineHeight: 19, marginBottom: 2 },
  miniResetDescription: { color: "#687084", fontSize: 12, lineHeight: 16 },
  miniResetMeta: { flexDirection: "row", alignItems: "center", columnGap: 2 },
  miniResetMetaText: { color: "#71758B", fontSize: 11, lineHeight: 14, fontFamily: "Outfit-Bold" },
  featuredHeadingRow: { marginTop: 24, marginBottom: 14 },
  featuredGameGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 14, marginTop: 14 },
  featuredGameCard: { width: "48.5%", overflow: "hidden", borderRadius: 18, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#DDE8D6" },
  featuredGameImage: { width: "100%", height: 156, backgroundColor: "#DFF1F5" },
  featuredGameImageCompact: { height: 128 },
  featuredGameBody: { padding: 11 },
  featuredGameLabel: { color: "#4F8A38", fontSize: 10, lineHeight: 13, textTransform: "uppercase", letterSpacing: 0.5, fontFamily: "Outfit-Bold", marginBottom: 4 },
  featuredGameTitle: { color: "#33495D", fontSize: 15, lineHeight: 19, fontFamily: "Outfit-Bold", marginBottom: 4 },
  featuredGameDescription: { color: "#687084", fontSize: 11, lineHeight: 15, minHeight: 30, marginBottom: 9 },
  featuredGameMeta: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  featuredGameArrow: { width: 26, height: 26, borderRadius: 13, backgroundColor: "#5A8D44", alignItems: "center", justifyContent: "center" }});
