import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import { useRef, useState } from "react";
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Image } from "expo-image";
import { AppleTopBar } from "../components/ui/AppleTopBar";

type ToolItem = {
  accentColor: string;
  badge: string;
  description: string;
  duration: string;
  icon: keyof typeof Ionicons.glyphMap;
  id: "breathing" | "grounding";
  route: "/wellness-breathing" | "/wellness-grounding";
  title: string;
};

type FeaturedGame = {
  accentColor: string;
  description: string;
  duration: string;
  id: "unscramble-word" | "gentle-pairs" | "image-puzzle" | "muni-match" | "galaxy-fall" | "fruit-catcher";
  image: number;
  label: string;
  title: string;
};

type FilterTab = "all" | "guided" | "games";

const WELLNESS_TOOLS: ToolItem[] = [
  {
    id: "breathing",
    title: "Diaphragmatic Breathing",
    description: "Calm your nervous system with rhythmic breaths.",
    duration: "3 min",
    badge: "Guided",
    icon: "leaf-outline",
    accentColor: "#2E7C1F",
    route: "/wellness-breathing",
  },
  {
    id: "grounding",
    title: "5-4-3-2-1 Grounding",
    description: "Anchor your senses to clear racing thoughts.",
    duration: "5 min",
    badge: "Interactive",
    icon: "eye-outline",
    accentColor: "#0284C7",
    route: "/wellness-grounding",
  },
];

const FEATURED_GAMES: FeaturedGame[] = [
  {
    id: "unscramble-word",
    title: "Unscramble Word",
    label: "Mindful Focus",
    description: "Untangle peaceful words before time fades.",
    duration: "Endless",
    accentColor: "#52B72A",
    image: require("../assets/images/Mini Reset/Unscramble Word/Unscramble Word Cover.webp"),
  },
  {
    id: "gentle-pairs",
    title: "Gentle Pairs",
    label: "Memory Focus",
    description: "Match calm Muni expressions at your pace.",
    duration: "Endless",
    accentColor: "#3B82F6",
    image: require("../assets/images/Mini Reset/Gentle Pairs/Gentle Pairs Cover.webp"),
  },
  {
    id: "image-puzzle",
    title: "Muni's Puzzle",
    label: "Slow Focus",
    description: "Piece together cozy scenes step by step.",
    duration: "2–5 min",
    accentColor: "#8B5CF6",
    image: require("../assets/images/Mini Reset/Puzzle/Muni Puzzle Cover.webp"),
  },
  {
    id: "muni-match",
    title: "Muni Match",
    label: "Color Match",
    description: "Clear color clusters and gather Tala Coins.",
    duration: "1.5 min",
    accentColor: "#EC4899",
    image: require("../assets/images/Mini Reset/Muni Match/cover.webp"),
  },
  {
    id: "galaxy-fall",
    title: "Galaxy Fall",
    label: "Cosmic Drift",
    description: "Glide through the galaxy past meteors.",
    duration: "1 min",
    accentColor: "#6366F1",
    image: require("../assets/images/Mini Reset/Galaxy Fall/cover.webp"),
  },
  {
    id: "fruit-catcher",
    title: "Fruit Catcher",
    label: "Playful Catch",
    description: "Catch orchard fruit while avoiding shells.",
    duration: "Endless",
    accentColor: "#F59E0B",
    image: require("../assets/images/Mini Reset/Fruit Catcher/Fruit Catcher Cover.webp"),
  },
];

function triggerHaptic(style = Haptics.ImpactFeedbackStyle.Light) {
  try {
    void Haptics.impactAsync(style);
  } catch {}
}

function AppleCardPressable({
  onPress,
  children,
  style,
  accessibilityLabel,
}: {
  accessibilityLabel?: string;
  children: React.ReactNode;
  onPress: () => void;
  style?: any;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.965,
      friction: 8,
      tension: 300,
      useNativeDriver: true,
    }).start();
    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      friction: 6,
      tension: 220,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={styles.cardPressableInner}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

export default function WellnessToolsScreen() {
  const { mood } = useLocalSearchParams<{ mood?: string }>();
  const { width } = useWindowDimensions();
  const compact = width < 390;

  const [activeTab, setActiveTab] = useState<FilterTab>("all");

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/home");
    }
  };

  const showGuided = activeTab === "all" || activeTab === "guided";
  const showGames = activeTab === "all" || activeTab === "games";

  return (
    <View style={styles.screen}>
      <AppleTopBar
        title="Wellness Tools"
        subtitle="Resets & Mini-games"
        onBack={handleBack}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, compact && styles.scrollContentCompact]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.contentFrame}>
          {/* Direct Hero Card */}
          <View style={[styles.heroCard, compact && styles.heroCardCompact]}>
            <View style={styles.heroOrb} />
            <View style={styles.heroBadge}>
              <Ionicons name="sparkles" size={13} color="#3E7525" />
              <Text style={styles.heroBadgeText}>QUICK RESETS</Text>
            </View>
            <Text style={[styles.heroTitle, compact && styles.heroTitleCompact]}>
              Take a Breather
            </Text>
            <Text style={[styles.heroSubtitle, compact && styles.heroSubtitleCompact]}>
              Guided pauses and playful mini-games to help you recharge anytime.
            </Text>
          </View>

          {/* Cozy Weather Inset (if present) */}
          {mood === "cozy" ? (
            <AppleCardPressable
              onPress={() => router.push("/wellness-breathing")}
              accessibilityLabel="Rainy day reset: Try diaphragmatic breathing"
              style={styles.cozyCardWrap}
            >
              <View style={styles.cozyCard}>
                <View style={styles.cozyIconWrap}>
                  <Ionicons name="rainy" size={20} color="#27616C" />
                </View>
                <View style={styles.cozyCopy}>
                  <Text style={styles.cozyTitle}>Cozy Weather Reset 🌧️</Text>
                  <Text style={styles.cozySubtitle}>
                    Try a 3-minute breathing pause to unwind.
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={17} color="#537A83" />
              </View>
            </AppleCardPressable>
          ) : null}

          {/* Apple Filter Pills */}
          <View style={styles.filterRow}>
            {(
              [
                { id: "all", label: "All", count: 8 },
                { id: "guided", label: "Guided", count: 2 },
                { id: "games", label: "Games", count: 6 },
              ] as const
            ).map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <Pressable
                  key={tab.id}
                  style={[styles.filterPill, isActive && styles.filterPillActive]}
                  onPress={() => {
                    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
                    setActiveTab(tab.id);
                  }}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: isActive }}
                >
                  <Text style={[styles.filterPillText, isActive && styles.filterPillTextActive]}>
                    {tab.label}
                  </Text>
                  <View style={[styles.filterCountBadge, isActive && styles.filterCountBadgeActive]}>
                    <Text
                      style={[
                        styles.filterCountText,
                        isActive && styles.filterCountTextActive,
                      ]}
                    >
                      {tab.count}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          {/* Guided Practices Section */}
          {showGuided ? (
            <View style={styles.sectionWrap}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Guided Exercises</Text>
                <Text style={styles.sectionCount}>2 ready</Text>
              </View>

              <View style={styles.guidedList}>
                {WELLNESS_TOOLS.map((item) => (
                  <AppleCardPressable
                    key={item.id}
                    onPress={() => router.push(item.route)}
                    accessibilityLabel={item.title + ", " + item.duration}
                    style={styles.guidedCardWrap}
                  >
                    <View style={styles.guidedCard}>
                      <View
                        style={[
                          styles.guidedIconWrap,
                          {
                            backgroundColor: item.accentColor + "14",
                            borderColor: item.accentColor + "24",
                          },
                        ]}
                      >
                        <Ionicons name={item.icon} size={22} color={item.accentColor} />
                      </View>

                      <View style={styles.guidedCopy}>
                        <Text style={styles.guidedTitle}>{item.title}</Text>
                        <Text style={styles.guidedDesc} numberOfLines={2}>
                          {item.description}
                        </Text>
                        <View style={styles.guidedMetaRow}>
                          <View style={styles.metaChip}>
                            <Ionicons name="time-outline" size={11} color="#52705C" />
                            <Text style={styles.metaChipText}>{item.duration}</Text>
                          </View>
                          <View style={styles.metaChip}>
                            <Ionicons name="sparkles-outline" size={11} color="#52705C" />
                            <Text style={styles.metaChipText}>{item.badge}</Text>
                          </View>
                        </View>
                      </View>

                      <View style={styles.guidedArrowWrap}>
                        <Ionicons name="chevron-forward" size={17} color="#64748B" />
                      </View>
                    </View>
                  </AppleCardPressable>
                ))}
              </View>
            </View>
          ) : null}

          {/* Mindful Mini-Games Section */}
          {showGames ? (
            <View style={styles.sectionWrap}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Mindful Mini-Games</Text>
                <Text style={styles.sectionCount}>6 available</Text>
              </View>

              <View style={styles.gamesGrid}>
                {FEATURED_GAMES.map((game) => (
                  <AppleCardPressable
                    key={game.id}
                    onPress={() => router.push("/" + (game.id as any))}
                    accessibilityLabel={game.title + ", " + game.duration}
                    style={styles.gameCardWrap}
                  >
                    <View style={styles.gameCard}>
                      <Image
                        source={game.image}
                        style={[styles.gameImage, compact && styles.gameImageCompact]}
                        contentFit="cover"
                        transition={180}
                        cachePolicy="memory-disk"
                      />
                      <View style={styles.gameBody}>
                        <Text style={styles.gameLabel}>{game.label}</Text>
                        <Text style={styles.gameTitle} numberOfLines={1}>
                          {game.title}
                        </Text>
                        <Text style={styles.gameDesc} numberOfLines={2}>
                          {game.description}
                        </Text>
                        <View style={styles.gameFooter}>
                          <View style={styles.gameDurationChip}>
                            <Ionicons name="time-outline" size={11} color="#64748B" />
                            <Text style={styles.gameDurationText}>{game.duration}</Text>
                          </View>
                          <View style={styles.gamePlayButton}>
                            <Ionicons name="play" size={12} color="#FFFFFF" style={{ marginLeft: 1 }} />
                          </View>
                        </View>
                      </View>
                    </View>
                  </AppleCardPressable>
                ))}
              </View>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F8FAF7",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 84,
    paddingBottom: 48,
    alignItems: "center",
  },
  scrollContentCompact: {
    paddingHorizontal: 12,
    paddingTop: 80,
    paddingBottom: 44,
  },
  contentFrame: {
    width: "100%",
    maxWidth: 420,
    alignSelf: "center",
  },
  cardPressableInner: {
    width: "100%",
  },

  /* Hero Card */
  heroCard: {
    width: "100%",
    borderRadius: 24,
    backgroundColor: "#E8F5E1",
    borderWidth: 1,
    borderColor: "#D2EBC7",
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 18,
    overflow: "hidden",
    marginBottom: 14,
    shadowColor: "#2F5222",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  heroCardCompact: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 16,
  },
  heroOrb: {
    position: "absolute",
    width: 140,
    height: 140,
    borderRadius: 70,
    right: -40,
    top: -40,
    backgroundColor: "rgba(255, 255, 255, 0.45)",
  },
  heroBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    columnGap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "rgba(255, 255, 255, 0.8)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.95)",
    marginBottom: 9,
  },
  heroBadgeText: {
    color: "#3E7525",
    fontSize: 10.5,
    letterSpacing: 0.8,
    fontFamily: "Outfit-Bold",
  },
  heroTitle: {
    color: "#1E293B",
    fontSize: 22,
    lineHeight: 27,
    fontFamily: "Outfit-Bold",
    letterSpacing: -0.3,
    marginBottom: 6,
  },
  heroTitleCompact: {
    fontSize: 20,
    lineHeight: 25,
  },
  heroSubtitle: {
    color: "#4A6150",
    fontSize: 13.5,
    lineHeight: 19,
    fontFamily: "Outfit-Regular",
  },
  heroSubtitleCompact: {
    fontSize: 12.5,
    lineHeight: 18,
  },

  /* Cozy Weather Banner */
  cozyCardWrap: {
    width: "100%",
    marginBottom: 14,
  },
  cozyCard: {
    width: "100%",
    borderRadius: 18,
    backgroundColor: "#EDF6F8",
    borderWidth: 1,
    borderColor: "#D3E7EC",
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    columnGap: 12,
  },
  cozyIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#DEEFF2",
    alignItems: "center",
    justifyContent: "center",
  },
  cozyCopy: {
    flex: 1,
  },
  cozyTitle: {
    color: "#1D3F47",
    fontSize: 13.5,
    fontFamily: "Outfit-Bold",
    marginBottom: 2,
  },
  cozySubtitle: {
    color: "#4A7079",
    fontSize: 12,
    lineHeight: 16,
    fontFamily: "Outfit-Regular",
  },

  /* Filter Tabs */
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 8,
    marginBottom: 16,
  },
  filterPill: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 6,
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "#EDF2EB",
    borderWidth: 1,
    borderColor: "#DEE6DC",
  },
  filterPillActive: {
    backgroundColor: "#52B72A",
    borderColor: "#449E22",
    shadowColor: "#52B72A",
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  filterPillText: {
    color: "#526354",
    fontSize: 12.5,
    fontFamily: "Outfit-Bold",
  },
  filterPillTextActive: {
    color: "#FFFFFF",
  },
  filterCountBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "rgba(0, 0, 0, 0.06)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  filterCountBadgeActive: {
    backgroundColor: "rgba(255, 255, 255, 0.28)",
  },
  filterCountText: {
    color: "#526354",
    fontSize: 10.5,
    fontFamily: "Outfit-Bold",
  },
  filterCountTextActive: {
    color: "#FFFFFF",
  },

  /* Sections */
  sectionWrap: {
    width: "100%",
    marginBottom: 18,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  sectionTitle: {
    color: "#1E293B",
    fontSize: 17,
    fontFamily: "Outfit-Bold",
    letterSpacing: -0.2,
  },
  sectionCount: {
    color: "#7E8E7F",
    fontSize: 12,
    fontFamily: "Outfit-Medium",
  },

  /* Guided Exercise Cards */
  guidedList: {
    width: "100%",
    rowGap: 10,
  },
  guidedCardWrap: {
    width: "100%",
  },
  guidedCard: {
    width: "100%",
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E6ECE4",
    padding: 13,
    flexDirection: "row",
    alignItems: "center",
    columnGap: 12,
    shadowColor: "#0F172A",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  guidedIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  guidedCopy: {
    flex: 1,
  },
  guidedTitle: {
    color: "#1E293B",
    fontSize: 15.5,
    fontFamily: "Outfit-Bold",
    marginBottom: 3,
  },
  guidedDesc: {
    color: "#64748B",
    fontSize: 12.5,
    lineHeight: 16.5,
    fontFamily: "Outfit-Regular",
    marginBottom: 7,
  },
  guidedMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 6,
  },
  metaChip: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 999,
    backgroundColor: "#F1F6EF",
    borderWidth: 1,
    borderColor: "#E2EBE0",
  },
  metaChipText: {
    color: "#4B6654",
    fontSize: 11,
    fontFamily: "Outfit-Medium",
  },
  guidedArrowWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F8FAF8",
    borderWidth: 1,
    borderColor: "#E8EEE6",
    alignItems: "center",
    justifyContent: "center",
  },

  /* Mini-games 2-Column Grid */
  gamesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 12,
  },
  gameCardWrap: {
    width: "48.5%",
  },
  gameCard: {
    width: "100%",
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E6ECE4",
    overflow: "hidden",
    shadowColor: "#0F172A",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  gameImage: {
    width: "100%",
    height: 122,
    backgroundColor: "#EAF2F4",
  },
  gameImageCompact: {
    height: 108,
  },
  gameBody: {
    padding: 10,
  },
  gameLabel: {
    color: "#52B72A",
    fontSize: 9.5,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    fontFamily: "Outfit-Bold",
    marginBottom: 3,
  },
  gameTitle: {
    color: "#1E293B",
    fontSize: 14,
    fontFamily: "Outfit-Bold",
    marginBottom: 3,
  },
  gameDesc: {
    color: "#64748B",
    fontSize: 11.5,
    lineHeight: 15,
    minHeight: 30,
    fontFamily: "Outfit-Regular",
    marginBottom: 8,
  },
  gameFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  gameDurationChip: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 3.5,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "#F1F5F9",
  },
  gameDurationText: {
    color: "#64748B",
    fontSize: 10.5,
    fontFamily: "Outfit-Medium",
  },
  gamePlayButton: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#52B72A",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#52B72A",
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
});
