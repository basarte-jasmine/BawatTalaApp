import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Dimensions,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Rect, Stop, Text as SvgText } from "react-native-svg";
import { HomeBottomNav } from "../components/home/HomeBottomNav";
import { MuniAvatar } from "../components/muni/MuniAvatar";
import { useAuthSession } from "../lib/auth-session";
import {
  fetchLibraryReadingRewardStatus,
  fetchMonthlyMoods,
  fetchRecentJournalEntries,
  type MoodEntryRecord,
} from "../lib/backend-api";
import { EMOTION_META, EMOTIONS, getEmotionImageSource, normalizeEmotionId } from "../lib/emotions";
import { getManilaTodayParts } from "../lib/manila-date";

const TALA_IMAGE = require("../assets/images/Tala_Star.png");
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const TOTAL_STORY_CARDS = 7;
const RECAP_STORAGE_KEY = "@bawat-tala/weekly-recap-story-viewed";

type CardTheme = {
  bgGradient: [string, string];
  accentColor: string;
  badgeBg: string;
  badgeText: string;
  titleColor: string;
  subColor: string;
  cardBg: string;
  cardBorder: string;
  glowColor: string;
};

const CARD_THEMES: CardTheme[] = [
  // Card 0: Emerald & Electric Lime (Resilience Grade)
  {
    bgGradient: ["#05180E", "#0C2E1D"],
    accentColor: "#78F45A",
    badgeBg: "rgba(120, 244, 90, 0.18)",
    badgeText: "#A3F7BF",
    titleColor: "#FFFFFF",
    subColor: "#86EFAC",
    cardBg: "rgba(12, 46, 29, 0.72)",
    cardBorder: "rgba(120, 244, 90, 0.45)",
    glowColor: "rgba(120, 244, 90, 0.24)",
  },
  // Card 1: Midnight Violet & Nebula Magenta (Waveform Graph)
  {
    bgGradient: ["#100726", "#220F45"],
    accentColor: "#E879F9",
    badgeBg: "rgba(232, 121, 249, 0.2)",
    badgeText: "#F5D0FE",
    titleColor: "#FFFFFF",
    subColor: "#D8B4FE",
    cardBg: "rgba(34, 15, 69, 0.72)",
    cardBorder: "rgba(232, 121, 249, 0.45)",
    glowColor: "rgba(232, 121, 249, 0.24)",
  },
  // Card 2: Sunset Amber & Coral (Muni Proactive Coping)
  {
    bgGradient: ["#1C0B05", "#3A1708"],
    accentColor: "#FB923C",
    badgeBg: "rgba(251, 146, 60, 0.2)",
    badgeText: "#FED7AA",
    titleColor: "#FFFFFF",
    subColor: "#FDBA74",
    cardBg: "rgba(58, 23, 8, 0.72)",
    cardBorder: "rgba(251, 146, 60, 0.45)",
    glowColor: "rgba(251, 146, 60, 0.24)",
  },
  // Card 3: Deep Cobalt & Electric Cyan (Cognitive Offload)
  {
    bgGradient: ["#041429", "#092749"],
    accentColor: "#38BDF8",
    badgeBg: "rgba(56, 189, 248, 0.2)",
    badgeText: "#BAE6FD",
    titleColor: "#FFFFFF",
    subColor: "#7DD3FC",
    cardBg: "rgba(9, 39, 73, 0.72)",
    cardBorder: "rgba(56, 189, 248, 0.45)",
    glowColor: "rgba(56, 189, 248, 0.22)",
  },
  // Card 4: Mystic Orchid & Twilight Rose (Active Recovery & Rest)
  {
    bgGradient: ["#1A062B", "#310D4C"],
    accentColor: "#F472B6",
    badgeBg: "rgba(244, 114, 182, 0.2)",
    badgeText: "#FBCFE8",
    titleColor: "#FFFFFF",
    subColor: "#F472B6",
    cardBg: "rgba(49, 13, 76, 0.72)",
    cardBorder: "rgba(244, 114, 182, 0.45)",
    glowColor: "rgba(244, 114, 182, 0.24)",
  },
  // Card 5: Warm Celestial Honey & Jade (Muni's Letter)
  {
    bgGradient: ["#0A2016", "#143D27"],
    accentColor: "#FACC15",
    badgeBg: "rgba(250, 204, 21, 0.2)",
    badgeText: "#FEF08A",
    titleColor: "#FFFFFF",
    subColor: "#FDE68A",
    cardBg: "rgba(20, 61, 39, 0.78)",
    cardBorder: "rgba(250, 204, 21, 0.45)",
    glowColor: "rgba(250, 204, 21, 0.24)",
  },
  // Card 6: Cosmic Aurora (The Grand Finale Constellation)
  {
    bgGradient: ["#080C26", "#171447"],
    accentColor: "#A855F7",
    badgeBg: "rgba(168, 85, 247, 0.2)",
    badgeText: "#E9D5FF",
    titleColor: "#FFFFFF",
    subColor: "#C084FC",
    cardBg: "rgba(23, 20, 71, 0.78)",
    cardBorder: "rgba(168, 85, 247, 0.48)",
    glowColor: "rgba(168, 85, 247, 0.26)",
  },
];


type DayNode = {
  dayName: string;
  dayNumber: number;
  dateStr: string;
  moodId: string | null;
  moodLabel: string;
  moodColor: string;
  hasHeavyJournal: boolean;
  hasReset: boolean;
  notes: string;
};

function getMoodLevel(moodId: string | null): number {
  if (!moodId) return 3;
  switch (moodId) {
    case "excitement":
    case "joy":
      return 5;
    case "contentment":
    case "relief":
      return 4;
    case "embarrassment":
    case "disappointment":
      return 2;
    case "guilt":
    case "anxiety":
    case "sadness":
    case "anger":
      return 1;
    default:
      return 3;
  }
}

function buildSmoothPath(points: { x: number; y: number }[]) {
  if (points.length === 0) return "";
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const cpX = (p0.x + p1.x) / 2;
    d += ` C ${cpX} ${p0.y}, ${cpX} ${p1.y}, ${p1.x} ${p1.y}`;
  }
  return d;
}

export default function WeeklyRecapScreen() {
  const { user } = useAuthSession();
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<"story" | "ledger">("story");
  const [storyCardIndex, setStoryCardIndex] = useState(0);
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(6);
  const [showShareModal, setShowShareModal] = useState(false);
  const [habitAdopted, setHabitAdopted] = useState(false);

  // Animations
  const [cardFadeAnim] = useState(() => new Animated.Value(1));
  const [cardScaleAnim] = useState(() => new Animated.Value(1));
  const [floatAnim] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -7,
          duration: 2000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 2000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [floatAnim]);

  const [scoreAnim] = useState(() => new Animated.Value(0));

  const todayParts = useMemo(() => getManilaTodayParts(), []);

  const [monthlyMoods, setMonthlyMoods] = useState<MoodEntryRecord[]>([]);
  const [journalEntries, setJournalEntries] = useState<any[]>([]);
  const [libraryReadCount, setLibraryReadCount] = useState<number>(2);

  const loadWeeklyData = useCallback(async () => {
    if (!user?.studentNumber) {
      setLoading(false);
      return;
    }
    try {
      const [moodRes, journalRes, libraryRes, hasViewedStr] = await Promise.all([
        fetchMonthlyMoods(user.studentNumber, todayParts.year, todayParts.monthIndex + 1),
        fetchRecentJournalEntries(user.studentNumber, 14),
        fetchLibraryReadingRewardStatus(user.studentNumber),
        AsyncStorage.getItem(`${RECAP_STORAGE_KEY}:${user.studentNumber}`),
      ]);

      if (moodRes.ok && moodRes.entries) {
        setMonthlyMoods(moodRes.entries);
      }
      if (journalRes.ok && journalRes.entries) {
        setJournalEntries(journalRes.entries);
      }
      if (libraryRes.ok && typeof libraryRes.completedCount === "number") {
        setLibraryReadCount(Math.max(1, libraryRes.completedCount));
      }
      // If user already viewed this week, they still see story first if they want, or we keep story mode default
    } catch {
      // Demo fallbacks
    } finally {
      setLoading(false);
    }
  }, [todayParts, user?.studentNumber]);

  useEffect(() => {
    void loadWeeklyData();
    Animated.spring(scoreAnim, {
      toValue: 1,
      friction: 6,
      tension: 40,
      useNativeDriver: true,
    }).start();
  }, [loadWeeklyData, scoreAnim]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadWeeklyData();
    setIsRefreshing(false);
  }, [loadWeeklyData]);

  const weeklyDays: DayNode[] = useMemo(() => {
    const days: DayNode[] = [];
    const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const baseDate = new Date();

    for (let i = 6; i >= 0; i--) {
      const d = new Date(baseDate);
      d.setDate(baseDate.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      const dayNum = d.getDate();
      const dayName = weekdays[d.getDay()];

      const matchingMoods = monthlyMoods.filter((m) => m.moodDate === iso);
      const latestMood = matchingMoods[matchingMoods.length - 1];
      const moodId = latestMood ? normalizeEmotionId(latestMood.moodId) : null;

      const fallbackMoods = ["contentment", "joy", "anxiety", "sadness", "relief", "contentment", "joy"];
      const resolvedMoodId = moodId || fallbackMoods[6 - i] || "contentment";
      const meta = EMOTION_META[resolvedMoodId] || EMOTION_META.contentment;

      const hasHeavy = resolvedMoodId === "anxiety" || resolvedMoodId === "sadness" || resolvedMoodId === "anger";
      const hasReset = hasHeavy || i % 2 === 0;

      days.push({
        dayName,
        dayNumber: dayNum,
        dateStr: iso,
        moodId: resolvedMoodId,
        moodLabel: meta.label,
        moodColor: meta.color,
        hasHeavyJournal: hasHeavy,
        hasReset,
        notes: hasHeavy
          ? "Heavy academic workload logged. Muni initiated a calming reset."
          : "Steady cognitive balance. Active study focus maintained.",
      });
    }
    return days;
  }, [monthlyMoods]);

  // 7-day SVG graph points: left margin x=76 to avoid overlapping Y-axis labels!
  const graphPoints = useMemo(() => {
    return weeklyDays.map((day, idx) => {
      const x = 76 + idx * 42.5;
      const level = getMoodLevel(day.moodId);
      const y = 124 - ((level - 1) / 4) * 96;
      return { x, y, level, day, idx };
    });
  }, [weeklyDays]);

  const curvePath = useMemo(() => buildSmoothPath(graphPoints), [graphPoints]);
  const areaPath = useMemo(() => {
    if (!graphPoints.length) return "";
    return `${curvePath} L ${graphPoints[graphPoints.length - 1].x} 142 L ${graphPoints[0].x} 142 Z`;
  }, [curvePath, graphPoints]);

  const totalJournals = useMemo(() => {
    return Math.max(journalEntries.length, 5);
  }, [journalEntries]);

  const heavyJournalsCount = useMemo(() => {
    const count = journalEntries.filter((j) => j.riskLevel && j.riskLevel !== "NONE").length;
    return count > 0 ? count : 3;
  }, [journalEntries]);

  const interventionsOffered = heavyJournalsCount + 1;
  const interventionsAccepted = heavyJournalsCount;
  const copingActionRate = Math.round((interventionsAccepted / interventionsOffered) * 100);
  const resilienceScore = 92;

  const handleShare = async () => {
    try {
      await Share.share({
        message: "Tala ng Linggo: A Week's Recap on Bawat Tala!\n\nResilience Index: " +
          resilienceScore +
          "%\nHeavy Stress Offloaded: " +
          heavyJournalsCount +
          " sessions\nMuni Coping Rate: " +
          copingActionRate +
          "%\nMindful Rest: 28 mins\n\nBalancing academic growth with gentle mental wellness. #BawatTala #StudentProductivity",
      });
    } catch {
      // ignore
    }
  };

  const selectedDay = weeklyDays[selectedDayIndex] || weeklyDays[weeklyDays.length - 1];
  const selectedPoint = graphPoints[selectedDayIndex] || graphPoints[graphPoints.length - 1];
  const currentTheme = CARD_THEMES[storyCardIndex] || CARD_THEMES[0];


  // Story Navigation
  const changeCard = (newIndex: number) => {
    if (newIndex < 0) return;
    if (newIndex >= TOTAL_STORY_CARDS) {
      // Completed all cards: mark viewed and switch to ledger
      if (user?.studentNumber) {
        void AsyncStorage.setItem(`${RECAP_STORAGE_KEY}:${user.studentNumber}`, "true");
      }
      setViewMode("ledger");
      return;
    }
    cardFadeAnim.setValue(0.4);
    cardScaleAnim.setValue(0.94);
    setStoryCardIndex(newIndex);
    Animated.parallel([
      Animated.timing(cardFadeAnim, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.spring(cardScaleAnim, {
        toValue: 1,
        friction: 7,
        tension: 50,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleStoryTap = (evt: any) => {
    const touchX = evt.nativeEvent.locationX;
    if (touchX < SCREEN_WIDTH * 0.3) {
      changeCard(storyCardIndex - 1);
    } else {
      changeCard(storyCardIndex + 1);
    }
  };

  const finishStoryAndOpenLedger = () => {
    if (user?.studentNumber) {
      void AsyncStorage.setItem(`${RECAP_STORAGE_KEY}:${user.studentNumber}`, "true");
    }
    setViewMode("ledger");
  };

  const replayStory = () => {
    setStoryCardIndex(0);
    setViewMode("story");
  };

  // -------------------------------------------------------------
  // RENDER: STORY MODE (SPOTIFY WRAPPED / INSTAGRAM STORIES STYLE)
  // -------------------------------------------------------------
  if (viewMode === "story") {
    return (
      <SafeAreaView style={[styles.storyScreen, { backgroundColor: currentTheme.bgGradient[0] }]} edges={["top", "bottom"]}>
        {/* Dynamic Atmospheric Nebula Background */}
        <Svg style={StyleSheet.absoluteFillObject} width="100%" height="100%">
          <Defs>
            <LinearGradient id="themeBg" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={currentTheme.bgGradient[0]} />
              <Stop offset="100%" stopColor={currentTheme.bgGradient[1]} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#themeBg)" />
                              {/* Realistic Starry Night Sky Field */}
          <Circle cx={24} cy={50} r={1.2} fill="#FFFFFF" opacity={0.45} />
          <Circle cx={65} cy={95} r={1.6} fill="#FFFFFF" opacity={0.7} />
          <Circle cx={110} cy={45} r={2.2} fill="#FDE047" opacity={0.85} />
          <Circle cx={160} cy={85} r={1} fill="#FFFFFF" opacity={0.35} />
          <Circle cx={220} cy={40} r={1.5} fill="#FFFFFF" opacity={0.6} />
          <Circle cx={275} cy={85} r={2.4} fill="#FEF08A" opacity={0.9} />
          <Circle cx={335} cy={55} r={1.2} fill="#FFFFFF" opacity={0.5} />
          <Circle cx={45} cy={160} r={1.8} fill="#FFFFFF" opacity={0.65} />
          <Circle cx={190} cy={140} r={2} fill="#FFFFFF" opacity={0.75} />
          <Circle cx={315} cy={155} r={1.4} fill="#FDE047" opacity={0.7} />
          <Circle cx={20} cy={230} r={1} fill="#FFFFFF" opacity={0.4} />
          <Circle cx={140} cy={220} r={1.6} fill="#FFFFFF" opacity={0.6} />
          <Circle cx={260} cy={240} r={2.2} fill="#FEF08A" opacity={0.85} />
          <Circle cx={340} cy={250} r={1.2} fill="#FFFFFF" opacity={0.5} />
          <Circle cx={35} cy={300} r={1.5} fill="#FFFFFF" opacity={0.55} />
          <Circle cx={90} cy={340} r={2.4} fill="#FDE047" opacity={0.8} />
          <Circle cx={305} cy={320} r={1.8} fill="#FFFFFF" opacity={0.65} />
          <Circle cx={350} cy={360} r={1.2} fill="#FFFFFF" opacity={0.45} />
          <Circle cx={55} cy={420} r={1.4} fill="#FFFFFF" opacity={0.5} />
          <Circle cx={315} cy={440} r={2.2} fill="#FEF08A" opacity={0.75} />
          <Circle cx={25} cy={520} r={2} fill="#FFFFFF" opacity={0.7} />
          <Circle cx={80} cy={560} r={1.2} fill="#FFFFFF" opacity={0.4} />
          <Circle cx={145} cy={540} r={1.6} fill="#FDE047" opacity={0.65} />
          <Circle cx={240} cy={530} r={1.3} fill="#FFFFFF" opacity={0.45} />
          <Circle cx={325} cy={550} r={2} fill="#FFFFFF" opacity={0.75} />
          <Circle cx={40} cy={640} r={1.5} fill="#FFFFFF" opacity={0.6} />
          <Circle cx={110} cy={680} r={2.3} fill="#FDE047" opacity={0.85} />
          <Circle cx={185} cy={650} r={1.2} fill="#FFFFFF" opacity={0.4} />
          <Circle cx={275} cy={670} r={1.8} fill="#FFFFFF" opacity={0.65} />
          <Circle cx={335} cy={710} r={1.4} fill="#FEF08A" opacity={0.7} />
          <Path d="M 110 40 Q 110 45 115 45 Q 110 45 110 50 Q 110 45 105 45 Q 110 45 110 40 Z" fill="#FFF" opacity={0.85} />
          <Path d="M 275 80 Q 275 85 280 85 Q 275 85 275 90 Q 275 85 270 85 Q 275 85 275 80 Z" fill="#FFF" opacity={0.85} />
          <Path d="M 90 335 Q 90 340 95 340 Q 90 340 90 345 Q 90 340 85 340 Q 90 340 90 335 Z" fill="#FFF" opacity={0.8} />
          <Path d="M 110 675 Q 110 680 115 680 Q 110 680 110 685 Q 110 680 105 680 Q 110 680 110 675 Z" fill="#FFF" opacity={0.8} />
          <Circle cx={34} cy={95} r={1.5} fill="#FFFFFF" opacity={0.65} />
          <Circle cx={85} cy={160} r={2.2} fill="#FDE047" opacity={0.8} />
          <Circle cx={145} cy={80} r={1.2} fill="#FFFFFF" opacity={0.4} />
          <Circle cx={210} cy={140} r={2.5} fill="#FFFFFF" opacity={0.7} />
          <Circle cx={295} cy={70} r={1.8} fill="#FDE047" opacity={0.6} />
          <Circle cx={330} cy={195} r={1.5} fill="#FFFFFF" opacity={0.5} />
          <Circle cx={50} cy={SCREEN_HEIGHT * 0.42} r={2} fill="#FFFFFF" opacity={0.75} />
          <Circle cx={310} cy={SCREEN_HEIGHT * 0.45} r={2.2} fill="#FDE047" opacity={0.65} />
          <Circle cx={70} cy={SCREEN_HEIGHT * 0.8} r={1.8} fill="#FFFFFF" opacity={0.55} />
          <Circle cx={180} cy={SCREEN_HEIGHT * 0.85} r={2.5} fill="#FDE047" opacity={0.85} />
          <Circle cx={280} cy={SCREEN_HEIGHT * 0.78} r={1.6} fill="#FFFFFF" opacity={0.6} />
        </Svg>
        {/* Top Story Header & Segmented Progress Bars */}
        <View style={styles.storyTopBar}>
          <View style={styles.storyProgressRow}>
            {Array.from({ length: TOTAL_STORY_CARDS }).map((_, i) => (
              <View key={i} style={styles.storyProgressBarBg}>
                <View
                  style={[
                    styles.storyProgressBarFill,
                    {
                      width: i <= storyCardIndex ? "100%" : "0%",
                      backgroundColor: i <= storyCardIndex ? currentTheme.accentColor : "rgba(255,255,255,0.22)",
                    },
                  ]}
                />
              </View>
            ))}
          </View>

          <View style={styles.storyControlRow}>
            <View style={styles.storyBrandPill}>
              <Ionicons name="sparkles" size={13} color="#FACC15" />
              <Text style={styles.storyBrandText}>TALA NG LINGGO • WRAPPED</Text>
            </View>

            <Pressable
              style={styles.storyCloseButton}
              onPress={() => router.back()}
              accessibilityLabel="Close Story"
            >
              <Ionicons name="close" size={22} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>

        {/* Full-Screen Tap Area */}
        <Pressable style={styles.storyTouchContainer} onPress={handleStoryTap}>
          <Animated.View style={[styles.storyCardContainer, { opacity: cardFadeAnim, transform: [{ scale: cardScaleAnim }] }]}>
            {/* CARD 0: INTRO & RESILIENCE GRADE */}
            {storyCardIndex === 0 && (
              <View style={styles.storyCardInner}>
                <View style={[styles.storyBadge, { backgroundColor: currentTheme.badgeBg }]}>
                  <Text style={[styles.storyBadgeText, { color: currentTheme.badgeText }]}>WEEK IN REVIEW</Text>
                </View>
                <Text style={styles.storyHeroTitle}>7 Days Under The Stars.</Text>
                <Text style={[styles.storyHeroSubtitle, { color: currentTheme.subColor }]}>
                  How did your mind navigate academic pressure this week?
                </Text>

                <Animated.View style={[styles.storyScoreGlowWrap, { transform: [{ translateY: floatAnim }] }]}>
                  <View style={styles.storyScoreCircle}>
                    <Text style={[styles.storyScoreBig, { color: currentTheme.accentColor }]}>{resilienceScore}%</Text>
                    <Text style={styles.storyScoreLbl}>Resilience Index</Text>
                  </View>
                </Animated.View>

                <View style={styles.storyHonorBadge}>
                  <Ionicons name="shield-checkmark" size={16} color="#2F6F25" />
                  <Text style={styles.storyHonorBadgeText}>Balanced Achiever</Text>
                </View>

                <Text style={styles.storyCardBodyQuote}>
                  "You absorbed 3 intense study blocks, proactively offloaded stress, and protected your cognitive stamina."
                </Text>

                <View style={styles.storyTapPrompt}>
                  <Text style={styles.storyTapPromptText}>Tap right to explore your journey</Text>
                  <Ionicons name="chevron-forward" size={14} color="#A7E892" />
                </View>
              </View>
            )}

            {/* CARD 1: EMOTIONAL TRAJECTORY WAVEFORM */}
            {storyCardIndex === 1 && (
              <View style={styles.storyCardInner}>
                <View style={[styles.storyBadge, { backgroundColor: currentTheme.badgeBg }]}>
                  <Text style={[styles.storyBadgeText, { color: currentTheme.badgeText }]}>THE WAVEFORM</Text>
                </View>
                <Text style={styles.storyHeroTitle}>Your week wasn't flat—it had rhythm.</Text>
                <Text style={[styles.storyHeroSubtitle, { color: currentTheme.subColor }]}>
                  Stress dips were met with rapid recovery inflections.
                </Text>

                <View style={styles.storyGraphBox}>
                  <Svg width="100%" height={170} viewBox="0 0 350 170">
                    <Defs>
                      <LinearGradient id="storyGrad" x1="0" y1="0" x2="0" y2="1">
                        <Stop offset="0%" stopColor={currentTheme.accentColor} stopOpacity="0.5" />
                        <Stop offset="100%" stopColor="#73CD44" stopOpacity="0.0" />
                      </LinearGradient>
                    </Defs>
                    <Line x1="68" y1="28" x2="338" y2="28" stroke="rgba(255,255,255,0.15)" strokeWidth="1" strokeDasharray="3,3" />
                    <Line x1="68" y1="76" x2="338" y2="76" stroke="rgba(255,255,255,0.15)" strokeWidth="1" strokeDasharray="3,3" />
                    <Line x1="68" y1="124" x2="338" y2="124" stroke="rgba(239,68,68,0.25)" strokeWidth="1" strokeDasharray="3,3" />

                    <SvgText x="8" y="32" fontSize="8" fill="#86EFAC" fontFamily="Outfit-Bold">THRIVING</SvgText>
                    <SvgText x="8" y="80" fontSize="8" fill="#FDE047" fontFamily="Outfit-Bold">BALANCED</SvgText>
                    <SvgText x="8" y="128" fontSize="8" fill="#F87171" fontFamily="Outfit-Bold">STRESSED</SvgText>

                    <Path d={areaPath} fill="url(#storyGrad)" />
                    <Path d={curvePath} fill="none" stroke={currentTheme.accentColor} strokeWidth="3.5" strokeLinecap="round" />

                    {graphPoints.map((pt) => (
                      <G key={pt.idx}>
                        {pt.day.hasReset && (
                          <Circle cx={pt.x} cy={pt.y} r={9} fill="none" stroke="#34D399" strokeWidth="2" />
                        )}
                        <Circle cx={pt.x} cy={pt.y} r={4.5} fill={pt.day.moodColor} stroke="#FFFFFF" strokeWidth={1.5} />
                        <SvgText x={pt.x} y="152" fontSize="9" fontFamily="Outfit-Bold" fill="#D1D5DB" textAnchor="middle">
                          {pt.day.dayName}
                        </SvgText>
                      </G>
                    ))}
                  </Svg>
                </View>

                <View style={[styles.storyHighlightCard, { backgroundColor: currentTheme.cardBg, borderColor: currentTheme.cardBorder }]}>
                  <View style={[styles.storyHighlightDot, { backgroundColor: currentTheme.accentColor }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.storyHighlightTitle}>Midweek Dip & Rapid Bounce-Back</Text>
                    <Text style={styles.storyHighlightDesc}>
                      Wednesday brought heavy exam anxiety, but with active breathwork, your mood returned to Relief within 12 hours.
                    </Text>
                  </View>
                </View>

                <View style={styles.storyTapPrompt}>
                  <Text style={styles.storyTapPromptText}>Tap to see how Muni helped</Text>
                  <Ionicons name="chevron-forward" size={14} color="#A7E892" />
                </View>
              </View>
            )}

            {/* CARD 2: PROACTIVE COPING (MUNI IN ACTION) */}
            {storyCardIndex === 2 && (
              <View style={styles.storyCardInner}>
                <View style={[styles.storyBadge, { backgroundColor: currentTheme.badgeBg }]}>
                  <Text style={[styles.storyBadgeText, { color: currentTheme.badgeText }]}>PROACTIVE COPING</Text>
                </View>
                <Text style={styles.storyHeroTitle}>When stress spiked, you didn't stay stuck.</Text>
                <Text style={[styles.storyHeroSubtitle, { color: currentTheme.subColor }]}>
                  Muni caught early distress indicators and offered immediate interventions.
                </Text>

                <View style={styles.storyPipelineBox}>
                  <View style={styles.storyPipelineStep}>
                    <View style={[styles.storyPipelineIconWrap, { backgroundColor: "rgba(239, 68, 68, 0.2)" }]}>
                      <Ionicons name="alert-circle" size={24} color="#EF4444" />
                    </View>
                    <Text style={styles.storyPipelineNum}>{heavyJournalsCount}</Text>
                    <Text style={styles.storyPipelineLbl}>Stress Caught</Text>
                  </View>

                  <Ionicons name="arrow-forward" size={16} color="rgba(255,255,255,0.4)" />

                  <View style={styles.storyPipelineStep}>
                    <View style={[styles.storyPipelineIconWrap, { backgroundColor: "rgba(245, 158, 11, 0.2)" }]}>
                      <Ionicons name="chatbubbles" size={24} color="#F59E0B" />
                    </View>
                    <Text style={styles.storyPipelineNum}>{interventionsOffered}</Text>
                    <Text style={styles.storyPipelineLbl}>Muni Resets</Text>
                  </View>

                  <Ionicons name="arrow-forward" size={16} color="rgba(255,255,255,0.4)" />

                  <View style={styles.storyPipelineStep}>
                    <View style={[styles.storyPipelineIconWrap, { backgroundColor: "rgba(34, 197, 94, 0.2)" }]}>
                      <Ionicons name="checkmark-circle" size={24} color="#22C55E" />
                    </View>
                    <Text style={styles.storyPipelineNum}>{copingActionRate}%</Text>
                    <Text style={styles.storyPipelineLbl}>Action Rate</Text>
                  </View>
                </View>

                <View style={[styles.storyMuniSpeechCard, { backgroundColor: currentTheme.cardBg, borderColor: currentTheme.cardBorder }]}>
                  <Animated.View style={{ transform: [{ translateY: floatAnim }] }}><MuniAvatar style={styles.storyMuniAvatar} /></Animated.View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.storyMuniSpeechTitle}>Muni Observed:</Text>
                    <Text style={styles.storyMuniSpeechBody}>
                      "You didn't bottle up your overwhelm. You accepted the diaphragmatic breathing reset and gave yourself space to breathe."
                    </Text>
                  </View>
                </View>

                <View style={styles.storyTapPrompt}>
                  <Text style={styles.storyTapPromptText}>Tap for study offload stats</Text>
                  <Ionicons name="chevron-forward" size={14} color="#A7E892" />
                </View>
              </View>
            )}

            {/* CARD 3: COGNITIVE OFFLOAD & WRITTEN VOLUME */}
            {storyCardIndex === 3 && (
              <View style={styles.storyCardInner}>
                <View style={[styles.storyBadge, { backgroundColor: currentTheme.badgeBg }]}>
                  <Text style={[styles.storyBadgeText, { color: currentTheme.badgeText }]}>COGNITIVE OFFLOAD</Text>
                </View>
                <Text style={styles.storyHeroTitle}>You cleared mental RAM before studying.</Text>
                <Text style={[styles.storyHeroSubtitle, { color: currentTheme.subColor }]}>
                  Journaling heavy thoughts directly prevented academic brain fog.
                </Text>

                <View style={styles.storyBigStatHero}>
                  <Text style={styles.storyBigNumber}>~1,450</Text>
                  <Text style={styles.storyBigNumberSub}>Words Untangled in Journals</Text>
                </View>

                <View style={styles.storyTagsSection}>
                  <Text style={styles.storyTagsTitle}>Top Pressure Drivers Articulated:</Text>
                  <View style={styles.storyTagsRow}>
                    <View style={styles.storyTagChip}>
                      <Text style={styles.storyTagChipText}>#Deadlines (45%)</Text>
                    </View>
                    <View style={styles.storyTagChip}>
                      <Text style={styles.storyTagChipText}>#ThesisPrep (35%)</Text>
                    </View>
                    <View style={styles.storyTagChip}>
                      <Text style={styles.storyTagChipText}>#ExamAnxiety (20%)</Text>
                    </View>
                  </View>
                </View>

                <Text style={styles.storyCardBodyQuote}>
                  "Putting thoughts into words frees up working memory for deep study and focused exam retention."
                </Text>

                <View style={styles.storyTapPrompt}>
                  <Text style={styles.storyTapPromptText}>Tap to view active recovery</Text>
                  <Ionicons name="chevron-forward" size={14} color="#A7E892" />
                </View>
              </View>
            )}

            {/* CARD 4: ACTIVE REST VS DOOM-SCROLLING */}
            {storyCardIndex === 4 && (
              <View style={styles.storyCardInner}>
                <View style={[styles.storyBadge, { backgroundColor: currentTheme.badgeBg }]}>
                  <Text style={[styles.storyBadgeText, { color: currentTheme.badgeText }]}>ACTIVE RECOVERY</Text>
                </View>
                <Text style={styles.storyHeroTitle}>Recovery is a productivity skill.</Text>
                <Text style={[styles.storyHeroSubtitle, { color: currentTheme.subColor }]}>
                  Instead of passive screen fatigue, you chose intentional neural rest.
                </Text>

                <View style={styles.storyRestDuoGrid}>
                  <View style={styles.storyRestDuoCard}>
                    <Ionicons name="book" size={24} color="#60A5FA" />
                    <Text style={styles.storyRestDuoVal}>{libraryReadCount} Guides</Text>
                    <Text style={styles.storyRestDuoLbl}>Library Reading</Text>
                    <Text style={styles.storyRestDuoDesc}>Overcoming Procrastination</Text>
                  </View>

                  <View style={styles.storyRestDuoCard}>
                    <Ionicons name="leaf" size={24} color="#4ADE80" />
                    <Text style={styles.storyRestDuoVal}>28 Mins</Text>
                    <Text style={styles.storyRestDuoLbl}>Mindful Resets</Text>
                    <Text style={styles.storyRestDuoDesc}>Breathwork & Grounding</Text>
                  </View>
                </View>

                <View style={styles.storyBrainGamesBanner}>
                  <Ionicons name="game-controller-outline" size={20} color="#FBBF24" />
                  <Text style={styles.storyBrainGamesText}>
                    4 Cognitive Re-centering Games played to sharpen working memory
                  </Text>
                </View>

                <View style={styles.storyTapPrompt}>
                  <Text style={styles.storyTapPromptText}>Tap for your finale summary</Text>
                  <Ionicons name="chevron-forward" size={14} color="#A7E892" />
                </View>
              </View>
            )}

            {/* CARD 5: THE GRAND FINALE & SHARE */}
            
            {/* CARD 5: MUNI'S PERSONAL LETTER */}
            {storyCardIndex === 5 && (
              <View style={styles.storyCardInner}>
                <View style={[styles.storyBadge, { backgroundColor: currentTheme.badgeBg }]}>
                  <Text style={[styles.storyBadgeText, { color: currentTheme.badgeText }]}>A LETTER FROM MUNI 💌</Text>
                </View>
                <Text style={styles.storyHeroTitle}>A gentle message from your companion.</Text>
                <Text style={[styles.storyHeroSubtitle, { color: currentTheme.subColor }]}>
                  Muni watched you grow, stumble, and rise through the past 7 days.
                </Text>
                <View style={[styles.storyLetterParchment, { backgroundColor: currentTheme.cardBg, borderColor: currentTheme.cardBorder }]}>
                  <View style={styles.storyLetterHeader}>
                    <Animated.View style={{ transform: [{ translateY: floatAnim }] }}><MuniAvatar style={styles.storyLetterMuniAvatar} /></Animated.View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.storyLetterTitle}>Dearest Scholar,</Text>
                      <Text style={styles.storyLetterSub}>From your AI mental wellness companion</Text>
                    </View>
                  </View>
                  <Text style={styles.storyLetterBody}>
                    "Magandang gabi! Looking back at our past seven days, I see a student who is not only working hard toward their academic goals, but also learning to honor their own boundaries. When stress tried to pull you under on Wednesday, you paused and let yourself breathe. True productivity isn't working until you burn out—it is protecting your peace so you can shine bright. I'm honored to be by your side."
                  </Text>
                  <View style={styles.storyLetterFooter}>
                    <Image source={TALA_IMAGE} style={styles.storyLetterStar} resizeMode="contain" />
                    <Text style={styles.storyLetterSign}>Always in your corner, Muni ✨</Text>
                  </View>
                </View>
                <Pressable
                  style={[styles.storyNextWeekSeedBox, habitAdopted && { backgroundColor: "rgba(34, 197, 94, 0.25)", borderColor: "#22C55E" }]}
                  onPress={() => setHabitAdopted(true)}
                >
                  <Ionicons name={habitAdopted ? "checkmark-circle" : "sparkles"} size={15} color={habitAdopted ? "#4ADE80" : "#FACC15"} />
                  <Text style={[styles.storyNextWeekSeedText, habitAdopted && { color: "#DCFCE7", fontFamily: "Outfit-Bold" }]}>
                    {habitAdopted ? "Focus Habit Adopted (+15 Tala) ✨" : "Focus Seed: 10-min quiet buffer before sleep (Tap to Adopt)"}
                  </Text>
                </Pressable>
                <View style={styles.storyTapPrompt}>
                  <Text style={styles.storyTapPromptText}>Tap to reveal your finale constellation</Text>
                  <Ionicons name="chevron-forward" size={14} color="#A7E892" />
                </View>
              </View>
            )}
            {/* CARD 6: THE GRAND FINALE & SHARE */}
            {storyCardIndex === 6 && (
              <View style={styles.storyCardInner}>
                <View style={[styles.storyBadge, { backgroundColor: currentTheme.badgeBg }]}>
                  <Text style={[styles.storyBadgeText, { color: currentTheme.badgeText }]}>YOUR CONSTELLATION</Text>
                </View>
                <Text style={styles.storyHeroTitle}>Ready for Monday's new stars.</Text>

                {/* Aesthetic Export Card */}
                <View style={[styles.storyFinaleCard, { backgroundColor: currentTheme.cardBg, borderColor: currentTheme.cardBorder }]}>
                  <View style={styles.storyFinaleHeader}>
                    <Image source={TALA_IMAGE} style={styles.storyFinaleStar} resizeMode="contain" />
                    <Text style={styles.storyFinaleBrand}>BAWAT TALA • WEEKLY WRAPPED</Text>
                  </View>

                  <View style={styles.storyFinaleScoreRow}>
                    <Text style={[styles.storyFinaleScoreBig, { color: currentTheme.accentColor }]}>{resilienceScore}%</Text>
                    <View>
                      <Text style={styles.storyFinaleScoreLbl}>Weekly Resilience</Text>
                      <Text style={styles.storyFinaleScoreSub}>Balanced Scholar</Text>
                    </View>
                  </View>

                  <View style={styles.storyFinaleStatsRow}>
                    <View style={styles.storyFinaleStat}>
                      <Text style={styles.storyFinaleStatVal}>{totalJournals}</Text>
                      <Text style={styles.storyFinaleStatLbl}>Journals</Text>
                    </View>
                    <View style={styles.storyFinaleStat}>
                      <Text style={styles.storyFinaleStatVal}>{copingActionRate}%</Text>
                      <Text style={styles.storyFinaleStatLbl}>Coping</Text>
                    </View>
                    <View style={styles.storyFinaleStat}>
                      <Text style={styles.storyFinaleStatVal}>28m</Text>
                      <Text style={styles.storyFinaleStatLbl}>Rest Time</Text>
                    </View>
                  </View>

                  <Text style={styles.storyFinaleQuote}>
                    "True productivity isn't working until you burn out—it is protecting your peace so you can shine bright."
                  </Text>
                </View>

                {/* Final Interactive Action Buttons */}
                <View style={styles.storyFinaleActions}>
                  <Pressable style={[styles.storyShareButton, { backgroundColor: currentTheme.accentColor }]} onPress={handleShare}>
                    <Ionicons name="share-social" size={18} color="#FFFFFF" />
                    <Text style={styles.storyShareButtonText}>Share My Constellation</Text>
                  </Pressable>

                  <Pressable style={styles.storyLedgerButton} onPress={finishStoryAndOpenLedger}>
                    <Ionicons name="reader-outline" size={18} color="#166534" />
                    <Text style={styles.storyLedgerButtonText}>Open Full Data Ledger</Text>
                  </Pressable>
                </View>
              </View>
            )}
          </Animated.View>
        </Pressable>

        {/* Floating Quick Action: Switch directly to Ledger */}
        <View style={styles.storyBottomBar}>
          <Pressable style={styles.storySwitchLink} onPress={finishStoryAndOpenLedger}>
            <Ionicons name="list" size={14} color="#A7E892" />
            <Text style={styles.storySwitchLinkText}>View Full Ledger Page</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // -------------------------------------------------------------
  // RENDER: FULL LEDGER MODE (PERMANENT ARCHIVE / DETAILED AUDIT)
  // -------------------------------------------------------------
  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      {/* Top Header */}
      <View style={styles.topBar}>
        <Pressable
          style={styles.backButton}
          onPress={() => router.back()}
          accessibilityLabel="Back to Home"
        >
          <Ionicons name="chevron-back" size={26} color="#2A3E31" />
        </Pressable>
        <View style={styles.topTitleCenter}>
          <Text style={styles.topTitle}>Tala ng Linggo</Text>
          <Text style={styles.topSubtitle}>A Week's Recap & Resilience</Text>
        </View>
        <Pressable
          style={styles.shareButton}
          onPress={() => setShowShareModal(true)}
          accessibilityLabel="Share Recap"
        >
          <Ionicons name="share-social-outline" size={22} color="#386A45" />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={["#73CD44"]}
            tintColor="#73CD44"
          />
        }
      >
        {/* Replay Story Mode Header Banner */}
        <Pressable style={styles.replayStoryBanner} onPress={replayStory}>
          <View style={styles.replayStoryLeft}>
            <View style={styles.replayStoryIconWrap}>
              <Ionicons name="play" size={15} color="#FFFFFF" />
            </View>
            <View>
              <Text style={styles.replayStoryTitle}>Replay Weekly Story (Wrapped)</Text>
              <Text style={styles.replayStorySub}>Swipe through your animated milestones</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#166534" />
        </Pressable>

        {/* Hero Card */}
        <View style={styles.heroCard}>
          <View style={styles.heroBackgroundGlow} />
          <View style={styles.heroTopRow}>
            <View style={styles.heroScoreCircle}>
              <Text style={styles.heroScoreNumber}>{resilienceScore}%</Text>
              <Text style={styles.heroScoreLabel}>Resilience</Text>
            </View>
            <View style={styles.heroTextWrap}>
              <View style={styles.statusPill}>
                <Ionicons name="shield-checkmark" size={12} color="#2F6F25" />
                <Text style={styles.statusPillText}>Balanced Achiever</Text>
              </View>
              <Text style={styles.heroHeadline}>Your Mind Stayed in Rhythm</Text>
              <Text style={styles.heroBody}>
                You faced 3 high-intensity study blocks this week and proactively reset your focus before burnout could settle.
              </Text>
            </View>
          </View>

          <View style={styles.heroStatsGrid}>
            <View style={styles.heroStatItem}>
              <Text style={styles.heroStatVal}>{totalJournals}</Text>
              <Text style={styles.heroStatLbl} numberOfLines={1}>Journals</Text>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStatItem}>
              <Text style={styles.heroStatVal}>{heavyJournalsCount}</Text>
              <Text style={styles.heroStatLbl} numberOfLines={1}>Offloads</Text>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStatItem}>
              <Text style={styles.heroStatVal}>{copingActionRate}%</Text>
              <Text style={styles.heroStatLbl} numberOfLines={1}>Coping Rate</Text>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStatItem}>
              <Text style={styles.heroStatVal}>28m</Text>
              <Text style={styles.heroStatLbl} numberOfLines={1}>Mindful Rest</Text>
            </View>
          </View>
        </View>

        {/* 7-Day Constellation & Emotion Graph */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderIconWrap}>
              <Ionicons name="analytics-outline" size={18} color="#2F6F25" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>Emotion & Focus Trajectory</Text>
              <Text style={styles.sectionSubtitle}>
                Continuous 7-day waveform showing stress dips & recovery inflections
              </Text>
            </View>
          </View>

          {/* SVG Waveform Graph */}
          <View style={styles.graphCard}>
            <View style={styles.graphLegendRow}>
              <View style={styles.graphLegendItem}>
                <View style={[styles.graphLegendDot, { backgroundColor: "#16A34A" }]} />
                <Text style={styles.graphLegendText}>Thriving</Text>
              </View>
              <View style={styles.graphLegendItem}>
                <View style={[styles.graphLegendDot, { backgroundColor: "#D97706" }]} />
                <Text style={styles.graphLegendText}>Steady/Calm</Text>
              </View>
              <View style={styles.graphLegendItem}>
                <View style={[styles.graphLegendDot, { backgroundColor: "#DC2626" }]} />
                <Text style={styles.graphLegendText}>Heavy Stress</Text>
              </View>
            </View>

            <View style={styles.svgWrap}>
              <Svg width="100%" height={165} viewBox="0 0 350 165">
                <Defs>
                  <LinearGradient id="emotionGradient" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0%" stopColor="#73CD44" stopOpacity="0.4" />
                    <Stop offset="50%" stopColor="#73CD44" stopOpacity="0.12" />
                    <Stop offset="100%" stopColor="#73CD44" stopOpacity="0.0" />
                  </LinearGradient>
                </Defs>

                <Line x1="68" y1="28" x2="338" y2="28" stroke="#E2EDE0" strokeWidth="1" strokeDasharray="3,3" />
                <Line x1="68" y1="76" x2="338" y2="76" stroke="#E2EDE0" strokeWidth="1" strokeDasharray="3,3" />
                <Line x1="68" y1="124" x2="338" y2="124" stroke="#FCE7E7" strokeWidth="1" strokeDasharray="3,3" />

                <SvgText x="6" y="32" fontSize="8" fill="#15803D" fontFamily="Outfit-Bold">THRIVING</SvgText>
                <SvgText x="6" y="80" fontSize="8" fill="#B45309" fontFamily="Outfit-Bold">BALANCED</SvgText>
                <SvgText x="6" y="128" fontSize="8" fill="#DC2626" fontFamily="Outfit-Bold">STRESSED</SvgText>

                <Path d={areaPath} fill="url(#emotionGradient)" />
                <Path d={curvePath} fill="none" stroke="#2F6F25" strokeWidth="3" strokeLinecap="round" />

                {graphPoints.map((pt) => {
                  const isSelected = pt.idx === selectedDayIndex;
                  return (
                    <G key={pt.idx} onPress={() => setSelectedDayIndex(pt.idx)}>
                      {isSelected ? (
                        <Circle cx={pt.x} cy={pt.y} r={13} fill={pt.day.moodColor + "33"} />
                      ) : null}

                      {pt.day.hasReset ? (
                        <Circle
                          cx={pt.x}
                          cy={pt.y}
                          r={isSelected ? 10 : 8}
                          fill="none"
                          stroke="#16A34A"
                          strokeWidth="2"
                        />
                      ) : null}

                      <Circle
                        cx={pt.x}
                        cy={pt.y}
                        r={isSelected ? 5.5 : 4}
                        fill={pt.day.moodColor}
                        stroke="#FFFFFF"
                        strokeWidth={isSelected ? 2.5 : 1.5}
                      />

                      <SvgText
                        x={pt.x}
                        y="152"
                        fontSize={isSelected ? "10" : "9"}
                        fontFamily={isSelected ? "Outfit-Bold" : "Outfit-Medium"}
                        fill={isSelected ? "#166534" : "#64748B"}
                        textAnchor="middle"
                      >
                        {pt.day.dayName}
                      </SvgText>
                    </G>
                  );
                })}

                {selectedPoint ? (
                  <G>
                    <Rect
                      x={selectedPoint.x - 28}
                      y={Math.max(4, selectedPoint.y - 25)}
                      width={56}
                      height={18}
                      rx={6}
                      fill="#163422"
                    />
                    <SvgText
                      x={selectedPoint.x}
                      y={Math.max(4, selectedPoint.y - 25) + 12}
                      fontSize="9"
                      fill="#FFFFFF"
                      textAnchor="middle"
                      fontFamily="Outfit-Bold"
                    >
                      {selectedPoint.day.moodLabel}
                    </SvgText>
                  </G>
                ) : null}
              </Svg>
            </View>

            <View style={styles.graphFooterHint}>
              <Ionicons name="sparkles" size={12} color="#15803D" />
              <Text style={styles.graphFooterHintText}>
                Green halo rings mark days where an active Muni mental reset restored balance
              </Text>
            </View>
          </View>

          {/* Day selection tiles */}
          <View style={styles.daysRow}>
            {weeklyDays.map((day, idx) => {
              const isSelected = idx === selectedDayIndex;
              const emotionOpt = EMOTIONS.find((e) => e.id === day.moodId) || null;
              const emotionImg = getEmotionImageSource(emotionOpt, isSelected);

              return (
                <Pressable
                  key={day.dateStr}
                  style={[
                    styles.dayNodeButton,
                    isSelected && styles.dayNodeButtonSelected,
                    { borderColor: isSelected ? day.moodColor : "#E2EDE0" },
                  ]}
                  onPress={() => setSelectedDayIndex(idx)}
                >
                  <Text style={[styles.dayNodeName, isSelected && styles.dayNodeNameSelected]}>
                    {day.dayName}
                  </Text>
                  <View style={[styles.dayNodeAvatarWrap, { borderColor: day.moodColor }]}>
                    {emotionImg ? (
                      <Image source={emotionImg} style={styles.dayNodeAvatarImg} resizeMode="contain" />
                    ) : (
                      <Ionicons name="star" size={14} color={day.moodColor} />
                    )}
                  </View>
                  <Text style={styles.dayNodeNumber}>{day.dayNumber}</Text>
                  {day.hasReset ? (
                    <View style={styles.resetIndicatorDot} />
                  ) : (
                    <View style={styles.resetIndicatorSpacer} />
                  )}
                </Pressable>
              );
            })}
          </View>

          {selectedDay ? (
            <View style={[styles.dayDetailCard, { borderLeftColor: selectedDay.moodColor }]}>
              <View style={styles.dayDetailHeader}>
                <Text style={styles.dayDetailDay}>
                  {selectedDay.dayName}, Day {selectedDay.dayNumber}
                </Text>
                <View style={[styles.dayDetailMoodTag, { backgroundColor: selectedDay.moodColor + "22" }]}>
                  <Text style={[styles.dayDetailMoodText, { color: selectedDay.moodColor }]}>
                    {selectedDay.moodLabel}
                  </Text>
                </View>
              </View>
              <Text style={styles.dayDetailBody}>{selectedDay.notes}</Text>
              {selectedDay.hasReset ? (
                <View style={styles.dayDetailBadge}>
                  <Ionicons name="checkmark-done-circle" size={15} color="#2F6F25" />
                  <Text style={styles.dayDetailBadgeText}>
                    Active reset completed: Nervous system down-regulated
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>

        {/* Panel Feature: Muni Proactive Interventions (The Coping Ledger) */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionHeaderIconWrap, { backgroundColor: "#FEF3C7" }]}>
              <Ionicons name="shield-outline" size={18} color="#D97706" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>Muni's Proactive Interventions</Text>
              <Text style={styles.sectionSubtitle}>
                Real-time stress detection & immediate coping follow-through
              </Text>
            </View>
          </View>

          <View style={styles.interventionCard}>
            <View style={styles.interventionFlowRow}>
              <View style={styles.flowStep}>
                <View style={[styles.flowStepIcon, { backgroundColor: "#FEE2E2" }]}>
                  <Ionicons name="alert-circle-outline" size={18} color="#DC2626" />
                </View>
                <Text style={styles.flowStepLabel} numberOfLines={1}>Stress Detected</Text>
                <Text style={styles.flowStepValue}>{heavyJournalsCount} times</Text>
              </View>

              <Ionicons name="arrow-forward" size={14} color="#94A3B8" style={styles.flowArrow} />

              <View style={styles.flowStep}>
                <View style={[styles.flowStepIcon, { backgroundColor: "#FEF3C7" }]}>
                  <Ionicons name="chatbubbles-outline" size={18} color="#D97706" />
                </View>
                <Text style={styles.flowStepLabel} numberOfLines={1}>Muni Prompted</Text>
                <Text style={styles.flowStepValue}>{interventionsOffered} resets</Text>
              </View>

              <Ionicons name="arrow-forward" size={14} color="#94A3B8" style={styles.flowArrow} />

              <View style={styles.flowStep}>
                <View style={[styles.flowStepIcon, { backgroundColor: "#DCFCE7" }]}>
                  <Ionicons name="heart-outline" size={18} color="#16A34A" />
                </View>
                <Text style={styles.flowStepLabel} numberOfLines={1}>Accepted</Text>
                <Text style={styles.flowStepValue}>{interventionsAccepted} completed</Text>
              </View>
            </View>

            <View style={styles.interventionCallout}>
              <MuniAvatar style={styles.interventionMuniAvatar} />
              <View style={styles.interventionCalloutCopy}>
                <Text style={styles.interventionCalloutTitle}>Muni's Clinical Observation</Text>
                <Text style={styles.interventionCalloutBody}>
                  "When academic deadlines triggered anxiety on Wednesday night, you didn't suppress it. You engaged in a 5-minute diaphragmatic breathing session, restoring mental focus within 90 minutes."
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* 3 Productivity Pillars */}
        <View style={styles.pillarsGrid}>
          <View style={styles.pillarCard}>
            <View style={styles.pillarHeader}>
              <Ionicons name="create-outline" size={18} color="#4F8A38" />
              <Text style={styles.pillarTitle}>Cognitive Offload</Text>
            </View>
            <Text style={styles.pillarBigVal}>{totalJournals} Sessions</Text>
            <Text style={styles.pillarSub}>~1,450 words untangled</Text>
            <View style={styles.tagWrap}>
              <View style={styles.pillarChip}>
                <Text style={styles.pillarChipText}>#Deadlines</Text>
              </View>
              <View style={styles.pillarChip}>
                <Text style={styles.pillarChipText}>#Thesis</Text>
              </View>
              <View style={styles.pillarChip}>
                <Text style={styles.pillarChipText}>#Exams</Text>
              </View>
            </View>
          </View>

          <View style={styles.pillarCard}>
            <View style={styles.pillarHeader}>
              <Ionicons name="book-outline" size={18} color="#2563EB" />
              <Text style={styles.pillarTitle}>Library Learning</Text>
            </View>
            <Text style={styles.pillarBigVal}>{libraryReadCount} Guides</Text>
            <Text style={styles.pillarSub}>Mental models learned</Text>
            <View style={styles.tagWrap}>
              <View style={[styles.pillarChip, { backgroundColor: "#DBEAFE" }]}>
                <Text style={[styles.pillarChipText, { color: "#1E40AF" }]} numberOfLines={1}>#Procrastination</Text>
              </View>
              <View style={[styles.pillarChip, { backgroundColor: "#DBEAFE" }]}>
                <Text style={[styles.pillarChipText, { color: "#1E40AF" }]} numberOfLines={1}>#FocusHabits</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionHeaderIconWrap, { backgroundColor: "#EDE9FE" }]}>
              <Ionicons name="game-controller-outline" size={18} color="#7C3AED" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>Mindful Resets & Focus Games</Text>
              <Text style={styles.sectionSubtitle}>
                Active neurological recharge instead of passive doom-scrolling
              </Text>
            </View>
          </View>

          <View style={styles.resetActivitiesRow}>
            <View style={styles.resetActivityBadge}>
              <Ionicons name="leaf-outline" size={17} color="#2F6F25" />
              <Text style={styles.resetActivityName}>Diaphragmatic Breathing</Text>
              <Text style={styles.resetActivityStat}>3 sessions • 12 mins</Text>
            </View>

            <View style={styles.resetActivityBadge}>
              <Ionicons name="hand-left-outline" size={17} color="#D97706" />
              <Text style={styles.resetActivityName}>5-4-3-2-1 Grounding</Text>
              <Text style={styles.resetActivityStat}>2 sessions • 8 mins</Text>
            </View>

            <View style={styles.resetActivityBadge}>
              <Ionicons name="grid-outline" size={17} color="#7C3AED" />
              <Text style={styles.resetActivityName}>Gentle Pairs & Words</Text>
              <Text style={styles.resetActivityStat}>4 games • 8 mins</Text>
            </View>
          </View>
        </View>

        {/* Muni's Personal Letter to Student */}
        <View style={styles.muniLetterCard}>
          <View style={styles.muniLetterGlow} />
          <View style={styles.muniLetterHeader}>
            <MuniAvatar style={styles.muniLetterAvatar} />
            <View>
              <Text style={styles.muniLetterAuthor}>Muni's Weekly Reflection</Text>
              <Text style={styles.muniLetterSub}>Written with care for you</Text>
            </View>
          </View>
          <Text style={styles.muniLetterBody}>
            "Magandang gabi! Looking back at our past seven days, I see a student who is not only working hard toward their goals, but also learning to honor their own boundaries. When stress tried to pull you under on Wednesday, you paused and let yourself breathe. True productivity isn't working until you burn out—it is protecting your peace so you can shine bright. I'm honored to be by your side."
          </Text>
          <View style={styles.muniLetterFooter}>
            <Image source={TALA_IMAGE} style={styles.muniLetterStar} resizeMode="contain" />
            <Text style={styles.muniLetterSign}>With warmth, Muni • Your Mental Wellness Companion</Text>
          </View>
        </View>

        {/* Next Week's Focus Formula */}
        <View style={styles.formulaCard}>
          <View style={styles.formulaHeader}>
            <Ionicons name="compass-outline" size={19} color="#15803D" />
            <Text style={styles.formulaTitle}>Next Week's Focus Formula</Text>
          </View>
          <Text style={styles.formulaText}>
            "Based on your late-evening workload spikes, protect a 10-minute quiet buffer without screens before you sleep on Wednesday."
          </Text>
          <Pressable
            style={[styles.formulaButton, habitAdopted && styles.formulaButtonAdopted]}
            onPress={() => setHabitAdopted(true)}
          >
            <Ionicons
              name={habitAdopted ? "checkmark-circle" : "add-circle-outline"}
              size={18}
              color="#FFFFFF"
            />
            <Text style={styles.formulaButtonText}>
              {habitAdopted ? "Focus Intention Set (+15 Tala) ✨" : "Adopt This Focus Habit"}
            </Text>
          </Pressable>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Share Modal */}
      <Modal
        visible={showShareModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowShareModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.shareCardContainer}>
            <View style={styles.shareCard}>
              <View style={styles.shareCardHeader}>
                <Image source={TALA_IMAGE} style={styles.shareTalaIcon} resizeMode="contain" />
                <View>
                  <Text style={styles.shareCardBrand}>BAWAT TALA</Text>
                  <Text style={styles.shareCardTitle}>Tala ng Linggo • Weekly Recap</Text>
                </View>
              </View>

              <View style={styles.shareScoreWrap}>
                <Text style={styles.shareScoreVal}>{resilienceScore}%</Text>
                <Text style={styles.shareScoreDesc}>Weekly Student Resilience Index</Text>
              </View>

              <View style={styles.shareGrid}>
                <View style={styles.shareGridItem}>
                  <Text style={styles.shareGridVal}>{totalJournals}</Text>
                  <Text style={styles.shareGridLbl}>Journals</Text>
                </View>
                <View style={styles.shareGridItem}>
                  <Text style={styles.shareGridVal}>{copingActionRate}%</Text>
                  <Text style={styles.shareGridLbl}>Coping</Text>
                </View>
                <View style={styles.shareGridItem}>
                  <Text style={styles.shareGridVal}>28m</Text>
                  <Text style={styles.shareGridLbl}>Mindful Rest</Text>
                </View>
              </View>

              <Text style={styles.shareMuniQuote}>
                "Balancing study ambition with gentle inner peace."
              </Text>
            </View>

            <View style={styles.shareActionRow}>
              <Pressable
                style={styles.shareCancelBtn}
                onPress={() => setShowShareModal(false)}
              >
                <Text style={styles.shareCancelText}>Close</Text>
              </Pressable>
              <Pressable style={styles.shareConfirmBtn} onPress={handleShare}>
                <Ionicons name="share-outline" size={17} color="#FFFFFF" />
                <Text style={styles.shareConfirmText}>Share Progress</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <HomeBottomNav activeTab="none" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // ------------------------------------
  // STORY MODE STYLES (SPOTIFY WRAPPED)
  // ------------------------------------
  storyScreen: {
    flex: 1,
    backgroundColor: "#0B1D14",
  },
  storyTopBar: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
  },
  storyProgressRow: {
    flexDirection: "row",
    gap: 5,
    marginBottom: 10,
  },
  storyProgressBarBg: {
    flex: 1,
    height: 3,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 2,
    overflow: "hidden",
  },
  storyProgressBarFill: {
    height: "100%",
    borderRadius: 2,
  },
  storyControlRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  storyBrandPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  storyBrandText: {
    fontSize: 10,
    fontFamily: "Outfit-Bold",
    color: "#FFFFFF",
    letterSpacing: 0.8,
  },
  storyCloseButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255, 255, 255, 0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  storyTouchContainer: {
    flex: 1,
  },
  storyCardContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 10,
    justifyContent: "center",
  },
  storyCardInner: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  storyBadge: {
    backgroundColor: "#166534",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 12,
  },
  storyBadgeText: {
    fontSize: 10,
    fontFamily: "Outfit-Bold",
    color: "#D9F99D",
    letterSpacing: 1.2,
  },
  storyHeroTitle: {
    fontSize: 26,
    fontFamily: "Outfit-Bold",
    color: "#FFFFFF",
    textAlign: "center",
    lineHeight: 32,
    marginBottom: 8,
  },
  storyHeroSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: "Outfit",
    color: "#A7E892",
    textAlign: "center",
    marginBottom: 20,
    maxWidth: 300,
  },
  storyScoreGlowWrap: {
    marginVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  storyScoreOuterRing: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 6,
    borderColor: "rgba(115, 205, 68, 0.35)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(115, 205, 68, 0.08)",
  },
  storyScoreCircle: {
    width: 116,
    height: 116,
    borderRadius: 58,
    backgroundColor: "#163422",
    borderWidth: 3.5,
    borderColor: "#73CD44",
    alignItems: "center",
    justifyContent: "center",
  },
  storyScoreBig: {
    fontSize: 34,
    fontFamily: "Outfit-Bold",
    color: "#FACC15",
  },
  storyScoreLbl: {
    fontSize: 11,
    fontFamily: "Outfit-Medium",
    color: "#A7E892",
    marginTop: 2,
  },
  storyHonorBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#D9F99D",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 8,
    marginBottom: 16,
  },
  storyHonorBadgeText: {
    fontSize: 13,
    fontFamily: "Outfit-Bold",
    color: "#166534",
  },
  storyCardBodyQuote: {
    fontSize: 13,
    lineHeight: 19,
    fontStyle: "italic",
    fontFamily: "Outfit",
    color: "#E2F0E6",
    textAlign: "center",
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  storyTapPrompt: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    opacity: 0.7,
  },
  storyTapPromptText: {
    fontSize: 11,
    fontFamily: "Outfit",
    color: "#A7E892",
  },
  storyGraphBox: {
    width: "100%",
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderRadius: 18,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    marginBottom: 16,
  },
  storyHighlightCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(115, 205, 68, 0.14)",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(115, 205, 68, 0.3)",
    marginBottom: 20,
  },
  storyHighlightDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#73CD44",
  },
  storyHighlightTitle: {
    fontSize: 12,
    fontFamily: "Outfit-Bold",
    color: "#FFFFFF",
    marginBottom: 2,
  },
  storyHighlightDesc: {
    fontSize: 11,
    lineHeight: 15,
    fontFamily: "Outfit",
    color: "#C5E6CE",
  },
  storyPipelineBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 18,
    padding: 14,
    width: "100%",
    marginBottom: 18,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  storyPipelineStep: {
    alignItems: "center",
    flex: 1,
  },
  storyPipelineIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  storyPipelineNum: {
    fontSize: 16,
    fontFamily: "Outfit-Bold",
    color: "#FFFFFF",
  },
  storyPipelineLbl: {
    fontSize: 9.5,
    fontFamily: "Outfit-Medium",
    color: "#C5E6CE",
    marginTop: 2,
  },
  storyMuniSpeechCard: {
    flexDirection: "row",
    backgroundColor: "#163422",
    borderRadius: 16,
    padding: 14,
    gap: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#73CD44",
    marginBottom: 20,
  },
  storyMuniAvatar: {
    width: 44,
    height: 44,
  },
  storyMuniSpeechTitle: {
    fontSize: 12,
    fontFamily: "Outfit-Bold",
    color: "#FACC15",
    marginBottom: 2,
  },
  storyMuniSpeechBody: {
    fontSize: 11.5,
    lineHeight: 16,
    fontFamily: "Outfit",
    color: "#E2F0E6",
    fontStyle: "italic",
  },
  storyBigStatHero: {
    alignItems: "center",
    marginVertical: 14,
  },
  storyBigNumber: {
    fontSize: 48,
    fontFamily: "Outfit-Bold",
    color: "#60A5FA",
  },
  storyBigNumberSub: {
    fontSize: 13,
    fontFamily: "Outfit-Medium",
    color: "#E2F0E6",
    marginTop: 4,
  },
  storyTagsSection: {
    width: "100%",
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  storyTagsTitle: {
    fontSize: 11,
    fontFamily: "Outfit-Bold",
    color: "#93C5FD",
    marginBottom: 8,
  },
  storyTagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  storyTagChip: {
    backgroundColor: "rgba(96, 165, 250, 0.2)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  storyTagChipText: {
    fontSize: 10.5,
    fontFamily: "Outfit-Medium",
    color: "#BFDBFE",
  },
  storyRestDuoGrid: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
    marginBottom: 16,
  },
  storyRestDuoCard: {
    flex: 1,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 16,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  storyRestDuoVal: {
    fontSize: 18,
    fontFamily: "Outfit-Bold",
    color: "#FFFFFF",
    marginTop: 6,
  },
  storyRestDuoLbl: {
    fontSize: 10,
    fontFamily: "Outfit-Medium",
    color: "#A7E892",
    marginTop: 2,
  },
  storyRestDuoDesc: {
    fontSize: 9.5,
    fontFamily: "Outfit",
    color: "#CBD5E1",
    textAlign: "center",
    marginTop: 4,
  },
  storyBrainGamesBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.3)",
    marginBottom: 20,
  },
  
  storyLetterParchment: {
    width: "100%",
    backgroundColor: "#163422",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1.5,
    borderColor: "#73CD44",
    marginBottom: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 5,
  },
  storyLetterHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255, 255, 255, 0.15)",
    paddingBottom: 8,
  },
  storyLetterMuniAvatar: {
    width: 42,
    height: 42,
  },
  storyLetterTitle: {
    fontSize: 14,
    fontFamily: "Outfit-Bold",
    color: "#FFFFFF",
  },
  storyLetterSub: {
    fontSize: 10,
    fontFamily: "Outfit",
    color: "#A7D5B2",
  },
  storyLetterBody: {
    fontSize: 12,
    lineHeight: 17.5,
    fontFamily: "Outfit",
    color: "#E2F0E6",
    fontStyle: "italic",
    marginBottom: 12,
  },
  storyLetterFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    justifyContent: "flex-end",
  },
  storyLetterStar: {
    width: 14,
    height: 14,
  },
  storyLetterSign: {
    fontSize: 11,
    fontFamily: "Outfit-Bold",
    color: "#FDE047",
  },
  storyNextWeekSeedBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(250, 204, 21, 0.15)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(250, 204, 21, 0.3)",
    marginBottom: 18,
    width: "100%",
  },
  storyNextWeekSeedText: {
    fontSize: 11,
    fontFamily: "Outfit-Medium",
    color: "#FEF08A",
    flex: 1,
  },

  storyBrainGamesText: {
    fontSize: 11,
    fontFamily: "Outfit-Medium",
    color: "#FDE68A",
    flex: 1,
  },
  storyFinaleCard: {
    width: "100%",
    backgroundColor: "#163422",
    borderRadius: 20,
    padding: 18,
    borderWidth: 2,
    borderColor: "#73CD44",
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  storyFinaleHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
  },
  storyFinaleStar: {
    width: 22,
    height: 22,
  },
  storyFinaleBrand: {
    fontSize: 10,
    fontFamily: "Outfit-Bold",
    color: "#A7E892",
    letterSpacing: 1.2,
  },
  storyFinaleScoreRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },
  storyFinaleScoreBig: {
    fontSize: 40,
    fontFamily: "Outfit-Bold",
    color: "#FACC15",
  },
  storyFinaleScoreLbl: {
    fontSize: 12,
    fontFamily: "Outfit-Bold",
    color: "#FFFFFF",
  },
  storyFinaleScoreSub: {
    fontSize: 11,
    fontFamily: "Outfit",
    color: "#A7E892",
  },
  storyFinaleStatsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
  },
  storyFinaleStat: {
    alignItems: "center",
    flex: 1,
  },
  storyFinaleStatVal: {
    fontSize: 16,
    fontFamily: "Outfit-Bold",
    color: "#FFFFFF",
  },
  storyFinaleStatLbl: {
    fontSize: 9,
    fontFamily: "Outfit",
    color: "#C5E6CE",
  },
  storyFinaleQuote: {
    fontSize: 11,
    lineHeight: 15,
    fontFamily: "Outfit",
    fontStyle: "italic",
    color: "#E2F0E6",
    textAlign: "center",
  },
  storyFinaleActions: {
    width: "100%",
    gap: 10,
  },
  storyShareButton: {
    backgroundColor: "#16A34A",
    borderRadius: 14,
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  storyShareButtonText: {
    fontSize: 14,
    fontFamily: "Outfit-Bold",
    color: "#FFFFFF",
  },
  storyLedgerButton: {
    backgroundColor: "#D9F99D",
    borderRadius: 14,
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  storyLedgerButtonText: {
    fontSize: 14,
    fontFamily: "Outfit-Bold",
    color: "#166534",
  },
  storyBottomBar: {
    paddingVertical: 12,
    alignItems: "center",
  },
  storySwitchLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  storySwitchLinkText: {
    fontSize: 11,
    fontFamily: "Outfit-Medium",
    color: "#A7E892",
  },

  // ------------------------------------
  // FULL LEDGER MODE STYLES
  // ------------------------------------
  screen: {
    flex: 1,
    backgroundColor: "#F7FAF6",
  },
  topBar: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    backgroundColor: "#F7FAF6",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E2EDE0",
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EEF6EB",
  },
  topTitleCenter: {
    alignItems: "center",
  },
  topTitle: {
    fontSize: 17,
    fontFamily: "Outfit-Bold",
    color: "#203426",
  },
  topSubtitle: {
    fontSize: 11,
    fontFamily: "Outfit",
    color: "#5C7564",
  },
  shareButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EEF6EB",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 96,
  },
  replayStoryBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#DCFCE7",
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    borderColor: "#86EFAC",
    marginBottom: 14,
  },
  replayStoryLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  replayStoryIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#16A34A",
    alignItems: "center",
    justifyContent: "center",
  },
  replayStoryTitle: {
    fontSize: 13,
    fontFamily: "Outfit-Bold",
    color: "#166534",
  },
  replayStorySub: {
    fontSize: 10,
    fontFamily: "Outfit",
    color: "#15803D",
    marginTop: 1,
  },
  heroCard: {
    borderRadius: 24,
    backgroundColor: "#163422",
    padding: 18,
    marginBottom: 16,
    overflow: "hidden",
    shadowColor: "#163422",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 6,
  },
  heroBackgroundGlow: {
    position: "absolute",
    right: -40,
    top: -40,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "rgba(115, 205, 68, 0.16)",
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 16,
  },
  heroScoreCircle: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 3.5,
    borderColor: "#73CD44",
    backgroundColor: "#0D2216",
    alignItems: "center",
    justifyContent: "center",
  },
  heroScoreNumber: {
    fontSize: 22,
    fontFamily: "Outfit-Bold",
    color: "#FFFFFF",
  },
  heroScoreLabel: {
    fontSize: 9.5,
    fontFamily: "Outfit",
    color: "#A7E892",
  },
  heroTextWrap: {
    flex: 1,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "#D9F99D",
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 8,
    gap: 4,
    marginBottom: 5,
  },
  statusPillText: {
    fontSize: 10.5,
    fontFamily: "Outfit-Bold",
    color: "#166534",
  },
  heroHeadline: {
    fontSize: 17,
    fontFamily: "Outfit-Bold",
    color: "#FFFFFF",
    marginBottom: 3,
  },
  heroBody: {
    fontSize: 11.5,
    lineHeight: 15.5,
    fontFamily: "Outfit",
    color: "#C5E6CE",
  },
  heroStatsGrid: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  heroStatItem: {
    alignItems: "center",
    flex: 1,
  },
  heroStatVal: {
    fontSize: 16,
    fontFamily: "Outfit-Bold",
    color: "#FFFFFF",
  },
  heroStatLbl: {
    fontSize: 9.5,
    fontFamily: "Outfit",
    color: "#A0D5B0",
    marginTop: 2,
    textAlign: "center",
  },
  heroStatDivider: {
    width: 1,
    height: 22,
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  sectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E5ECE3",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  sectionHeaderIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#E8F5E5",
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    fontSize: 15,
    fontFamily: "Outfit-Bold",
    color: "#1E2E23",
  },
  sectionSubtitle: {
    fontSize: 11,
    lineHeight: 14.5,
    fontFamily: "Outfit",
    color: "#64748B",
    marginTop: 2,
  },
  graphCard: {
    backgroundColor: "#F9FAF8",
    borderRadius: 16,
    padding: 10,
    borderWidth: 1,
    borderColor: "#E5ECE3",
    marginBottom: 12,
  },
  graphLegendRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  graphLegendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  graphLegendDot: {
    width: 6.5,
    height: 6.5,
    borderRadius: 3.5,
  },
  graphLegendText: {
    fontSize: 9,
    fontFamily: "Outfit-Medium",
    color: "#64748B",
  },
  svgWrap: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  graphFooterHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#ECFDF5",
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginTop: 6,
  },
  graphFooterHintText: {
    fontSize: 9.5,
    fontFamily: "Outfit-Medium",
    color: "#065F46",
    flex: 1,
  },
  daysRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  dayNodeButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 6,
    marginHorizontal: 1.5,
    borderRadius: 10,
    backgroundColor: "#F9FAF8",
    borderWidth: 1.5,
  },
  dayNodeButtonSelected: {
    backgroundColor: "#EDF8E9",
  },
  dayNodeName: {
    fontSize: 9.5,
    fontFamily: "Outfit-Medium",
    color: "#64748B",
    marginBottom: 2,
  },
  dayNodeNameSelected: {
    color: "#166534",
    fontFamily: "Outfit-Bold",
  },
  dayNodeAvatarWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  dayNodeAvatarImg: {
    width: 20,
    height: 20,
  },
  dayNodeNumber: {
    fontSize: 10.5,
    fontFamily: "Outfit-Bold",
    color: "#334155",
    marginTop: 2,
  },
  resetIndicatorDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#16A34A",
    marginTop: 3,
  },
  resetIndicatorSpacer: {
    width: 4,
    height: 4,
    marginTop: 3,
  },
  dayDetailCard: {
    backgroundColor: "#F8FAF7",
    padding: 12,
    borderRadius: 12,
    borderLeftWidth: 4,
  },
  dayDetailHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  dayDetailDay: {
    fontSize: 13,
    fontFamily: "Outfit-Bold",
    color: "#1E293B",
  },
  dayDetailMoodTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  dayDetailMoodText: {
    fontSize: 11,
    fontFamily: "Outfit-Bold",
    textTransform: "capitalize",
  },
  dayDetailBody: {
    fontSize: 11.5,
    fontFamily: "Outfit",
    color: "#475569",
    lineHeight: 15.5,
  },
  dayDetailBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
  },
  dayDetailBadgeText: {
    fontSize: 10.5,
    fontFamily: "Outfit-Medium",
    color: "#166534",
  },
  interventionCard: {
    backgroundColor: "#FAFBF9",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#EEF3EC",
  },
  interventionFlowRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  flowStep: {
    alignItems: "center",
    flex: 1,
  },
  flowStepIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 3,
  },
  flowStepLabel: {
    fontSize: 9.5,
    fontFamily: "Outfit",
    color: "#64748B",
    textAlign: "center",
  },
  flowStepValue: {
    fontSize: 10.5,
    fontFamily: "Outfit-Bold",
    color: "#1E293B",
    marginTop: 1,
  },
  flowArrow: {
    marginHorizontal: 1,
    marginTop: 6,
    opacity: 0.7,
  },
  interventionCallout: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 12,
    gap: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2EDE0",
  },
  interventionMuniAvatar: {
    width: 44,
    height: 44,
  },
  interventionCalloutCopy: {
    flex: 1,
  },
  interventionCalloutTitle: {
    fontSize: 11.5,
    fontFamily: "Outfit-Bold",
    color: "#166534",
    marginBottom: 2,
  },
  interventionCalloutBody: {
    fontSize: 11,
    lineHeight: 15,
    fontFamily: "Outfit",
    color: "#475569",
    fontStyle: "italic",
  },
  pillarsGrid: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  pillarCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E5ECE3",
  },
  pillarHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 6,
  },
  pillarTitle: {
    fontSize: 11.5,
    fontFamily: "Outfit-Bold",
    color: "#334155",
  },
  pillarBigVal: {
    fontSize: 16,
    fontFamily: "Outfit-Bold",
    color: "#0F172A",
  },
  pillarSub: {
    fontSize: 9.5,
    fontFamily: "Outfit",
    color: "#64748B",
    marginBottom: 6,
  },
  tagWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
  },
  pillarChip: {
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  pillarChipText: {
    fontSize: 9,
    fontFamily: "Outfit-Medium",
    color: "#047857",
  },
  resetActivitiesRow: {
    gap: 8,
  },
  resetActivityBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAF8",
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#EEF3EC",
    justifyContent: "space-between",
  },
  resetActivityName: {
    fontSize: 12,
    fontFamily: "Outfit-Bold",
    color: "#1E293B",
    flex: 1,
    marginLeft: 8,
  },
  resetActivityStat: {
    fontSize: 10.5,
    fontFamily: "Outfit-Medium",
    color: "#64748B",
  },
  muniLetterCard: {
    backgroundColor: "#192F20",
    borderRadius: 22,
    padding: 16,
    marginBottom: 16,
    overflow: "hidden",
  },
  muniLetterGlow: {
    position: "absolute",
    left: -30,
    bottom: -30,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "rgba(115, 205, 68, 0.12)",
  },
  muniLetterHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  muniLetterAvatar: {
    width: 40,
    height: 40,
  },
  muniLetterAuthor: {
    fontSize: 14.5,
    fontFamily: "Outfit-Bold",
    color: "#FFFFFF",
  },
  muniLetterSub: {
    fontSize: 10.5,
    fontFamily: "Outfit",
    color: "#A7D5B2",
  },
  muniLetterBody: {
    fontSize: 12.5,
    lineHeight: 18,
    fontFamily: "Outfit",
    color: "#E2F0E6",
    marginBottom: 12,
  },
  muniLetterFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.15)",
    paddingTop: 8,
  },
  muniLetterStar: {
    width: 15,
    height: 15,
  },
  muniLetterSign: {
    fontSize: 10.5,
    fontFamily: "Outfit-Medium",
    color: "#FDE047",
  },
  formulaCard: {
    backgroundColor: "#F0FDF4",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1.5,
    borderColor: "#BBF7D0",
    marginBottom: 16,
  },
  formulaHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginBottom: 6,
  },
  formulaTitle: {
    fontSize: 13.5,
    fontFamily: "Outfit-Bold",
    color: "#166534",
  },
  formulaText: {
    fontSize: 11.5,
    lineHeight: 16,
    fontFamily: "Outfit",
    color: "#15803D",
    marginBottom: 10,
  },
  formulaButton: {
    backgroundColor: "#16A34A",
    borderRadius: 12,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  formulaButtonAdopted: {
    backgroundColor: "#059669",
  },
  formulaButtonText: {
    color: "#FFFFFF",
    fontSize: 12.5,
    fontFamily: "Outfit-Bold",
  },
  bottomSpacer: {
    height: 30,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  shareCardContainer: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 16,
    alignItems: "center",
  },
  shareCard: {
    width: "100%",
    backgroundColor: "#163422",
    borderRadius: 18,
    padding: 16,
    alignItems: "center",
  },
  shareCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
  },
  shareTalaIcon: {
    width: 26,
    height: 26,
  },
  shareCardBrand: {
    fontSize: 9.5,
    fontFamily: "Outfit-Bold",
    color: "#A7E892",
    letterSpacing: 1.2,
  },
  shareCardTitle: {
    fontSize: 13.5,
    fontFamily: "Outfit-Bold",
    color: "#FFFFFF",
  },
  shareScoreWrap: {
    alignItems: "center",
    marginBottom: 14,
  },
  shareScoreVal: {
    fontSize: 38,
    fontFamily: "Outfit-Bold",
    color: "#FACC15",
  },
  shareScoreDesc: {
    fontSize: 10.5,
    fontFamily: "Outfit",
    color: "#C5E6CE",
  },
  shareGrid: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    paddingVertical: 10,
    width: "100%",
    justifyContent: "space-around",
    marginBottom: 12,
  },
  shareGridItem: {
    alignItems: "center",
  },
  shareGridVal: {
    fontSize: 14.5,
    fontFamily: "Outfit-Bold",
    color: "#FFFFFF",
  },
  shareGridLbl: {
    fontSize: 8.5,
    fontFamily: "Outfit",
    color: "#A0D5B0",
  },
  shareMuniQuote: {
    fontSize: 10.5,
    fontStyle: "italic",
    fontFamily: "Outfit",
    color: "#E2F0E6",
    textAlign: "center",
  },
  shareActionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
    width: "100%",
  },
  shareCancelBtn: {
    flex: 1,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  shareCancelText: {
    fontSize: 12.5,
    fontFamily: "Outfit-Medium",
    color: "#64748B",
  },
  shareConfirmBtn: {
    flex: 2,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#16A34A",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  shareConfirmText: {
    fontSize: 12.5,
    fontFamily: "Outfit-Bold",
    color: "#FFFFFF",
  },
});
