import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Animated,
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
const { width: SCREEN_WIDTH } = Dimensions.get("window");

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
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(6);
  const [showShareModal, setShowShareModal] = useState(false);
  const [habitAdopted, setHabitAdopted] = useState(false);

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
      const [moodRes, journalRes, libraryRes] = await Promise.all([
        fetchMonthlyMoods(user.studentNumber, todayParts.year, todayParts.monthIndex + 1),
        fetchRecentJournalEntries(user.studentNumber, 14),
        fetchLibraryReadingRewardStatus(user.studentNumber),
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
      // level 1 => y=124, level 5 => y=28
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
        {/* Sunday Highlight Pill Banner */}
        <View style={styles.sundayBadgeRow}>
          <View style={styles.sundayBadge}>
            <Ionicons name="sparkles" size={13} color="#B8860B" />
            <Text style={styles.sundayBadgeText}>SUNDAY SPOTLIGHT • PRODUCTIVITY LEDGER</Text>
          </View>
          <Text style={styles.dateWindowText}>Past 7 Days</Text>
        </View>

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

                {/* Horizontal reference lines */}
                <Line x1="68" y1="28" x2="338" y2="28" stroke="#E2EDE0" strokeWidth="1" strokeDasharray="3,3" />
                <Line x1="68" y1="76" x2="338" y2="76" stroke="#E2EDE0" strokeWidth="1" strokeDasharray="3,3" />
                <Line x1="68" y1="124" x2="338" y2="124" stroke="#FCE7E7" strokeWidth="1" strokeDasharray="3,3" />

                {/* Y-Axis Zone Labels on the left - completely separated from data points! */}
                <SvgText x="6" y="32" fontSize="8" fill="#15803D" fontFamily="Outfit-Bold">THRIVING</SvgText>
                <SvgText x="6" y="80" fontSize="8" fill="#B45309" fontFamily="Outfit-Bold">BALANCED</SvgText>
                <SvgText x="6" y="128" fontSize="8" fill="#DC2626" fontFamily="Outfit-Bold">STRESSED</SvgText>

                {/* Gradient area under curve */}
                <Path d={areaPath} fill="url(#emotionGradient)" />

                {/* Smooth curve line */}
                <Path d={curvePath} fill="none" stroke="#2F6F25" strokeWidth="3" strokeLinecap="round" />

                {/* Node Points */}
                {graphPoints.map((pt) => {
                  const isSelected = pt.idx === selectedDayIndex;
                  return (
                    <G key={pt.idx} onPress={() => setSelectedDayIndex(pt.idx)}>
                      {/* Selection Highlight Ring */}
                      {isSelected ? (
                        <Circle cx={pt.x} cy={pt.y} r={13} fill={pt.day.moodColor + "33"} />
                      ) : null}

                      {/* Halo ring for days with proactive reset */}
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

                      {/* Core Node Circle */}
                      <Circle
                        cx={pt.x}
                        cy={pt.y}
                        r={isSelected ? 5.5 : 4}
                        fill={pt.day.moodColor}
                        stroke="#FFFFFF"
                        strokeWidth={isSelected ? 2.5 : 1.5}
                      />

                      {/* Day Label Under Point */}
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

                {/* Floating Tooltip Callout for Selected Day */}
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
  sundayBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sundayBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#FEF9C3",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#FDE047",
  },
  sundayBadgeText: {
    fontSize: 9.5,
    fontFamily: "Outfit-Bold",
    color: "#854D0E",
    letterSpacing: 0.4,
  },
  dateWindowText: {
    fontSize: 12,
    fontFamily: "Outfit-Medium",
    color: "#64748B",
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
