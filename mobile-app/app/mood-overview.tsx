import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  type ImageSourcePropType,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { HomeBottomNav } from "../components/home/HomeBottomNav";
import { MuniAvatar } from "../components/muni/MuniAvatar";
import { useAuthSession } from "../lib/auth-session";
import { fetchMonthlyMoods, type MoodEntryRecord } from "../lib/backend-api";
import { EMOTION_META, EMOTION_ORDER, createEmotionCounts, getEmotionImageSource, normalizeEmotionId } from "../lib/emotions";
import { InformedConsentGate } from "../lib/informed-consent";
import { getManilaTodayParts } from "../lib/manila-date";
import { useOfflineSync } from "../lib/offline-sync";

type MoodStat = {
  color: string;
  count: number;
  id: string;
  image: ImageSourcePropType | null;
  label: string;
};

type CalendarDay = {
  isSelected?: boolean;
  isOutsideMonth?: boolean;
  checkInCount?: number;
  dayNumber: number | null;
  moodId: string | null;
  state: "empty" | "future" | "mood";
};

type MuniReflection = {
  headline: string;
  body: string;
  actionLabel?: string;
  actionRoute?: string;
  actionIcon?: keyof typeof Ionicons.glyphMap;
  tone: "support" | "celebrate" | "gentle" | "neutral";
};

const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];
const MIN_YEAR = 2026;
const MIN_MONTH_INDEX = 0;

function triggerAppleHaptic(style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) {
  try {
    void Haptics.impactAsync(style);
  } catch {}
}

function getMonthName(monthIndex: number) {
  return new Date(2026, monthIndex, 1).toLocaleString("en-US", { month: "long" });
}

function getDayFromMoodDate(value: string) {
  const match = String(value || "").match(/(\d{4})-(\d{2})-(\d{2})/);
  return match ? Number(match[3]) : 0;
}

function formatDisplayDate(year: number, monthIndex: number, dayNumber: number) {
  return new Date(year, monthIndex, dayNumber).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatCheckInTime(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatMoodSourceLabel(value?: string) {
  return String(value || "").toUpperCase() === "JOURNAL" ? "Journal" : "Check-in";
}

// Smart local rule-based companion reflection (0 AI tokens)
function getMuniEmotionReflection(
  totalCount: number,
  mostCommonId: string | null,
  counts: Record<string, number>,
): MuniReflection {
  if (totalCount === 0) {
    return {
      headline: "Muni is here with you",
      body: "Whenever you feel ready, check in with how your heart feels today. Every little emotion you honor counts.",
      actionLabel: "Check in today",
      actionRoute: "/home?focus=mood",
      actionIcon: "heart-outline",
      tone: "neutral",
    };
  }

  const sadnessCount = counts.sadness ?? 0;
  const anxietyCount = counts.anxiety ?? 0;
  const angerCount = counts.anger ?? 0;
  const guiltCount = counts.guilt ?? 0;
  const disappointmentCount = counts.disappointment ?? 0;
  const embarrassmentCount = counts.embarrassment ?? 0;
  const heavyCount = sadnessCount + anxietyCount + angerCount + guiltCount + disappointmentCount + embarrassmentCount;

  const joyCount = counts.joy ?? 0;
  const excitementCount = counts.excitement ?? 0;
  const contentmentCount = counts.contentment ?? 0;
  const reliefCount = counts.relief ?? 0;
  const brightCount = joyCount + excitementCount + contentmentCount + reliefCount;

  // 1. Sadness is persistent
  if (sadnessCount >= 2 && (mostCommonId === "sadness" || sadnessCount >= totalCount * 0.35)) {
    return {
      headline: "Muni is holding space for you",
      body: `Sadness has shown up ${sadnessCount} times this month. Heavy feelings can get exhausting to carry alone—would you like to share what's on your mind?`,
      actionLabel: "Chat with Muni",
      actionRoute: "/muni-avatar",
      actionIcon: "chatbubble-ellipses-outline",
      tone: "support",
    };
  }

  // 2. Anxiety is persistent
  if (anxietyCount >= 2 && (mostCommonId === "anxiety" || anxietyCount >= totalCount * 0.35)) {
    return {
      headline: "Let's take a slow breath together",
      body: `Muni noticed anxiety showed up ${anxietyCount} times recently. When thoughts feel loud or racing, a gentle 1-minute reset can help you find calm.`,
      actionLabel: "Take a 1-min breath",
      actionRoute: "/wellness-breathing",
      actionIcon: "leaf-outline",
      tone: "support",
    };
  }

  // 3. Anger or frustration
  if (angerCount >= 2 || mostCommonId === "anger") {
    return {
      headline: "It's okay to feel upset",
      body: `Tension and frustration have been present ${angerCount} times. Bottling it up feels heavy—writing it all down in your journal can release that pressure.`,
      actionLabel: "Write in Journal",
      actionRoute: "/journal",
      actionIcon: "create-outline",
      tone: "support",
    };
  }

  // 4. Guilt or Embarrassment
  if ((guiltCount + embarrassmentCount) >= 2 || mostCommonId === "guilt" || mostCommonId === "embarrassment") {
    return {
      headline: "Be kind to yourself today",
      body: "Muni noticed feelings of guilt or embarrassment weighed on you lately. Everyone stumbles—please remember you deserve forgiveness and gentle warmth.",
      actionLabel: "Talk to Muni",
      actionRoute: "/muni-avatar",
      actionIcon: "heart-outline",
      tone: "support",
    };
  }

  // 5. Disappointment
  if (disappointmentCount >= 2 || mostCommonId === "disappointment") {
    return {
      headline: "One tough moment doesn't define you",
      body: "Things might not have turned out as planned lately. Muni is proud of you for showing up anyway. Take things one gentle step at a time.",
      actionLabel: "Take a pause",
      actionRoute: "/wellness-tools",
      actionIcon: "pause-circle-outline",
      tone: "support",
    };
  }

  // 6. Bright emotions leading
  if (brightCount >= heavyCount && brightCount > 0) {
    if (mostCommonId === "joy" || mostCommonId === "excitement") {
      return {
        headline: "Your bright days are glowing ✨",
        body: `Joy has been your most frequent rhythm (${counts[mostCommonId ?? "joy"] ?? joyCount} check-ins)! Savoring and writing down what brought you happiness keeps the glow alive.`,
        actionLabel: "Record in Journal",
        actionRoute: "/journal",
        actionIcon: "sparkles-outline",
        tone: "celebrate",
      };
    }
    return {
      headline: "A peaceful, grounded rhythm 🌿",
      body: "Contentment and relief have anchored your month. Finding peace amidst busy student life is a real strength.",
      actionLabel: "Calm read in Library",
      actionRoute: "/library",
      actionIcon: "book-outline",
      tone: "celebrate",
    };
  }

  // 7. General mixed/resilient flow
  return {
    headline: "You are riding life's waves",
    body: `You've checked in ${totalCount} times across different emotions. Acknowledging all feelings without judgment builds true emotional stamina. Muni is with you!`,
    actionLabel: "View Week's Recap",
    actionRoute: "/weekly-recap",
    actionIcon: "shield-checkmark-outline",
    tone: "gentle",
  };
}

export default function MoodOverviewScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuthSession();
  const { isSyncing, refreshKey, syncNow } = useOfflineSync();
  const [now, setNow] = useState(() => getManilaTodayParts());

  const initialMonth = useMemo(() => {
    const currentYear = now.year;
    const currentMonthIndex = now.monthIndex;

    if (currentYear < MIN_YEAR) {
      return { monthIndex: MIN_MONTH_INDEX, year: MIN_YEAR };
    }

    return { monthIndex: currentMonthIndex, year: currentYear };
  }, [now]);

  const [displayYear, setDisplayYear] = useState(initialMonth.year);
  const [displayMonthIndex, setDisplayMonthIndex] = useState(initialMonth.monthIndex);
  const [monthlyEntries, setMonthlyEntries] = useState<MoodEntryRecord[]>([]);
  const [monthlyCounts, setMonthlyCounts] = useState<Record<string, number>>(() => createEmotionCounts());
  const [mostCommonMoodId, setMostCommonMoodId] = useState<string | null>(null);
  const [totalCheckIns, setTotalCheckIns] = useState(0);
  const [selectedDayNumber, setSelectedDayNumber] = useState(now.day);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showRefreshToast, setShowRefreshToast] = useState(false);

  // Apple Spring animation values
  const backBtnScale = useRef(new Animated.Value(1)).current;
  const refreshBtnScale = useRef(new Animated.Value(1)).current;
  const refreshSpinAnim = useRef(new Animated.Value(0)).current;
  const progressBarAnim = useRef(new Animated.Value(0)).current;
  const progressBarOpacity = useRef(new Animated.Value(0)).current;
  const contentPulseAnim = useRef(new Animated.Value(1)).current;
  const refreshFeedbackAnim = useRef(new Animated.Value(0)).current;
  const prevMonthScale = useRef(new Animated.Value(1)).current;
  const nextMonthScale = useRef(new Animated.Value(1)).current;
  const todayBtnScale = useRef(new Animated.Value(1)).current;
  const reflectionBtnScale = useRef(new Animated.Value(1)).current;
  const dayCardFade = useRef(new Animated.Value(1)).current;
  const dayCardTranslateY = useRef(new Animated.Value(0)).current;

  const handleButtonPressIn = (animValue: Animated.Value, toValue = 0.92) => {
    Animated.spring(animValue, {
      toValue,
      damping: 14,
      stiffness: 320,
      mass: 0.8,
      useNativeDriver: true,
    }).start();
    triggerAppleHaptic(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleButtonPressOut = (animValue: Animated.Value) => {
    Animated.spring(animValue, {
      toValue: 1,
      damping: 12,
      stiffness: 240,
      mass: 0.8,
      useNativeDriver: true,
    }).start();
  };

  const isCurrentlyRefreshing = isRefreshing || isSyncing;

  useEffect(() => {
    if (isCurrentlyRefreshing) {
      // Animate top progress bar
      progressBarOpacity.setValue(1);
      progressBarAnim.setValue(0);
      Animated.timing(progressBarAnim, {
        toValue: 0.85,
        duration: 600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();

      // Content shimmer pulse
      const pulseLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(contentPulseAnim, {
            toValue: 0.65,
            duration: 380,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(contentPulseAnim, {
            toValue: 0.9,
            duration: 380,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      );
      pulseLoop.start();

      const spinLoop = Animated.loop(
        Animated.timing(refreshSpinAnim, {
          toValue: 1,
          duration: 750,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      );
      spinLoop.start();
      return () => {
        spinLoop.stop();
        pulseLoop.stop();
        Animated.timing(refreshSpinAnim, {
          toValue: 0,
          duration: 200,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }).start();
      };
    } else {
      // Complete progress bar to 100% and fade out
      Animated.sequence([
        Animated.timing(progressBarAnim, {
          toValue: 1,
          duration: 160,
          easing: Easing.out(Easing.ease),
          useNativeDriver: false,
        }),
        Animated.timing(progressBarOpacity, {
          toValue: 0,
          duration: 220,
          useNativeDriver: false,
        }),
      ]).start(() => {
        progressBarAnim.setValue(0);
      });

      // Spring content back to 1.0 with Apple bounce
      Animated.spring(contentPulseAnim, {
        toValue: 1,
        damping: 14,
        stiffness: 280,
        mass: 0.8,
        useNativeDriver: true,
      }).start();
    }
  }, [isCurrentlyRefreshing, refreshSpinAnim, progressBarAnim, progressBarOpacity, contentPulseAnim]);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/home");
  };

  const loadMonth = useCallback(async () => {
    if (!user?.studentNumber) {
      setMonthlyEntries([]);
      setMostCommonMoodId(null);
      setTotalCheckIns(0);
      setMonthlyCounts(createEmotionCounts());
      return;
    }

    const result = await fetchMonthlyMoods(user.studentNumber, displayYear, displayMonthIndex + 1);
    if (!result.ok) {
      return;
    }

    setMonthlyEntries(result.entries ?? []);
    setMonthlyCounts({
      ...createEmotionCounts(),
      ...(result.counts ?? {}),
    });
    setMostCommonMoodId(result.mostCommonMoodId ?? null);
    setTotalCheckIns(result.totalCheckIns ?? 0);
  }, [displayMonthIndex, displayYear, user?.studentNumber]);

  useFocusEffect(
    useCallback(() => {
      setNow(getManilaTodayParts());
      void loadMonth();
    }, [loadMonth]),
  );

  useEffect(() => {
    if (!user?.studentNumber) return;
    setNow(getManilaTodayParts());
    void loadMonth();
  }, [loadMonth, refreshKey, user?.studentNumber]);

  const handleRefreshMoods = useCallback(async () => {
    if (isRefreshing || isSyncing) return;
    setIsRefreshing(true);
    triggerAppleHaptic(Haptics.ImpactFeedbackStyle.Medium);
    const startTime = Date.now();
    await syncNow();
    setNow(getManilaTodayParts());
    await loadMonth();
    const elapsed = Date.now() - startTime;
    if (elapsed < 650) {
      await new Promise((resolve) => setTimeout(resolve, 650 - elapsed));
    }
    setIsRefreshing(false);
    triggerAppleHaptic(Haptics.ImpactFeedbackStyle.Light);

    setShowRefreshToast(true);
    Animated.sequence([
      Animated.timing(refreshFeedbackAnim, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.delay(1600),
      Animated.timing(refreshFeedbackAnim, {
        toValue: 0,
        duration: 260,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowRefreshToast(false);
    });
  }, [isRefreshing, isSyncing, loadMonth, syncNow, refreshFeedbackAnim]);

  const moodStats: MoodStat[] = useMemo(
    () =>
      EMOTION_ORDER.map((id) => ({
        id,
        color: EMOTION_META[id].color,
        count: monthlyCounts[id] ?? 0,
        image: getEmotionImageSource(EMOTION_META[id]),
        label: EMOTION_META[id].label,
      })),
    [monthlyCounts],
  );

  const rankedMoodStats = useMemo(
    () => moodStats.filter((item) => item.count > 0).sort((a, b) => b.count - a.count),
    [moodStats],
  );

  const todayMonthKey = `${now.year}-${now.monthIndex}`;
  const viewedMonthKey = `${displayYear}-${displayMonthIndex}`;
  const todayDay = now.day;
  const isFutureMonth =
    displayYear > now.year ||
    (displayYear === now.year && displayMonthIndex > now.monthIndex);

  const entriesByDay = useMemo(() => {
    const map = new Map<number, { count: number; latestMoodId: string }>();
    monthlyEntries.forEach((entry) => {
      const day = getDayFromMoodDate(entry.moodDate);
      if (day) {
        const current = map.get(day);
        map.set(day, {
          count: (current?.count ?? 0) + 1,
          latestMoodId: entry.moodId,
        });
      }
    });
    return map;
  }, [monthlyEntries]);

  useEffect(() => {
    const totalDaysInMonth = new Date(displayYear, displayMonthIndex + 1, 0).getDate();
    const viewedCurrentMonth = viewedMonthKey === todayMonthKey;
    const firstEntryDay = [...entriesByDay.keys()].sort((a, b) => a - b)[0];
    const fallbackDay = viewedCurrentMonth ? todayDay : firstEntryDay ?? 1;
    const maxSelectableDay = viewedCurrentMonth ? Math.min(todayDay, totalDaysInMonth) : totalDaysInMonth;

    if (selectedDayNumber < 1 || selectedDayNumber > maxSelectableDay) {
      setSelectedDayNumber(Math.min(fallbackDay, maxSelectableDay));
    }
  }, [displayMonthIndex, displayYear, entriesByDay, selectedDayNumber, todayDay, todayMonthKey, viewedMonthKey]);

  const selectedDayEntries = useMemo(
    () =>
      monthlyEntries.filter((entry) => getDayFromMoodDate(entry.moodDate) === selectedDayNumber),
    [monthlyEntries, selectedDayNumber],
  );

  const handleSelectDay = (dayNum: number) => {
    if (dayNum === selectedDayNumber) return;
    triggerAppleHaptic(Haptics.ImpactFeedbackStyle.Light);

    // Apple smooth transition
    dayCardFade.setValue(0.3);
    dayCardTranslateY.setValue(6);
    setSelectedDayNumber(dayNum);

    Animated.parallel([
      Animated.timing(dayCardFade, {
        toValue: 1,
        duration: 200,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.spring(dayCardTranslateY, {
        toValue: 0,
        damping: 15,
        stiffness: 280,
        mass: 0.8,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const calendarDays = useMemo(() => {
    const firstDayIndex = new Date(displayYear, displayMonthIndex, 1).getDay();
    const totalDaysInMonth = new Date(displayYear, displayMonthIndex + 1, 0).getDate();
    const days: CalendarDay[] = [];

    for (let index = 0; index < firstDayIndex; index += 1) {
      days.push({ dayNumber: null, moodId: null, state: "empty" });
    }

    for (let dayNumber = 1; dayNumber <= totalDaysInMonth; dayNumber += 1) {
      const dayEntry = entriesByDay.get(dayNumber);
      const moodId = dayEntry?.latestMoodId ?? null;
      const isFutureDay = viewedMonthKey === todayMonthKey && dayNumber > todayDay;
      days.push({
        checkInCount: dayEntry?.count ?? 0,
        dayNumber,
        isSelected: selectedDayNumber === dayNumber,
        isOutsideMonth: false,
        moodId,
        state: moodId ? "mood" : isFutureMonth || isFutureDay ? "future" : "empty",
      });
    }

    const trailingDays = (7 - (days.length % 7)) % 7;
    for (let dayNumber = 1; dayNumber <= trailingDays; dayNumber += 1) {
      days.push({
        dayNumber,
        isOutsideMonth: true,
        moodId: null,
        state: "future",
      });
    }

    return days;
  }, [displayMonthIndex, displayYear, entriesByDay, isFutureMonth, selectedDayNumber, todayDay, todayMonthKey, viewedMonthKey]);

  const canGoPrevious = displayYear > MIN_YEAR || (displayYear === MIN_YEAR && displayMonthIndex > MIN_MONTH_INDEX);

  const goPreviousMonth = () => {
    if (!canGoPrevious) return;
    triggerAppleHaptic(Haptics.ImpactFeedbackStyle.Light);
    if (displayMonthIndex === 0) {
      setDisplayMonthIndex(11);
      setDisplayYear((prev) => prev - 1);
      return;
    }
    setDisplayMonthIndex((prev) => prev - 1);
  };

  const goNextMonth = () => {
    if (isFutureMonth) return;
    triggerAppleHaptic(Haptics.ImpactFeedbackStyle.Light);
    if (displayMonthIndex === 11) {
      setDisplayMonthIndex(0);
      setDisplayYear((prev) => prev + 1);
      return;
    }
    setDisplayMonthIndex((prev) => prev + 1);
  };

  const selectedDayLabel = formatDisplayDate(displayYear, displayMonthIndex, selectedDayNumber);
  const muniReflection = useMemo(
    () => getMuniEmotionReflection(totalCheckIns, mostCommonMoodId, monthlyCounts),
    [totalCheckIns, mostCommonMoodId, monthlyCounts],
  );

  const refreshSpin = refreshSpinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  const navBarHeight = Math.max(insets.top, 14) + 48;

  return (
    <View style={styles.screen}>
      {/* Apple Floating Translucent Blurred Top Bar (Fixed on top, content scrolls underneath & gets blurred) */}
      <BlurView
        intensity={85}
        tint="light"
        style={[
          styles.appleFloatingBar,
          {
            paddingTop: Math.max(insets.top, 12),
            height: navBarHeight,
          },
        ]}
      >
        <Animated.View style={{ transform: [{ scale: backBtnScale }] }}>
          <Pressable
            style={styles.appleCircleButton}
            onPress={handleBack}
            onPressIn={() => handleButtonPressIn(backBtnScale)}
            onPressOut={() => handleButtonPressOut(backBtnScale)}
            accessibilityLabel="Go back"
            accessibilityRole="button"
          >
            <Ionicons name="chevron-back" size={20} color="#0F172A" />
          </Pressable>
        </Animated.View>

        <View style={styles.appleCenterTitleWrap}>
          <Text style={styles.appleCenterTitleText}>Emotion History</Text>
        </View>

        <Animated.View style={{ transform: [{ scale: refreshBtnScale }] }}>
          <Pressable
            style={styles.appleCircleButton}
            onPress={handleRefreshMoods}
            onPressIn={() => handleButtonPressIn(refreshBtnScale)}
            onPressOut={() => handleButtonPressOut(refreshBtnScale)}
            accessibilityLabel="Refresh emotions"
            accessibilityRole="button"
          >
            <Animated.View style={{ transform: [{ rotate: refreshSpin }] }}>
              <Ionicons name="refresh-outline" size={18} color="#0F172A" />
            </Animated.View>
          </Pressable>
        </Animated.View>
      </BlurView>

      {/* Apple Top Viewport Animated Progress Bar */}
      <Animated.View
        style={[
          styles.appleProgressBarTrack,
          {
            top: navBarHeight,
            opacity: progressBarOpacity,
          },
        ]}
        pointerEvents="none"
      >
        <Animated.View
          style={[
            styles.appleProgressBarFill,
            {
              width: progressBarAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ["0%", "100%"],
              }),
            },
          ]}
        />
      </Animated.View>

      {/* Apple Subtle Floating Feedback Toast */}
      {showRefreshToast ? (
        <Animated.View
          style={[
            styles.appleToastWrap,
            {
              top: navBarHeight + 8,
              opacity: refreshFeedbackAnim,
              transform: [
                {
                  translateY: refreshFeedbackAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-8, 0],
                  }),
                },
              ],
            },
          ]}
          pointerEvents="none"
        >
          <View style={styles.appleToastPill}>
            <Ionicons name="checkmark-circle" size={13} color="#27561B" style={{ marginRight: 5 }} />
            <Text style={styles.appleToastText}>Updated just now</Text>
          </View>
        </Animated.View>
      ) : null}

      <InformedConsentGate feature="mood">
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: navBarHeight + 14 },
          ]}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing || isSyncing}
              onRefresh={handleRefreshMoods}
              colors={["#52B72A"]}
              tintColor="#52B72A"
              progressViewOffset={navBarHeight}
            />
          }
        >
          <Animated.View style={{ opacity: contentPulseAnim }}>
          {/* Muni Companion Reflection Card (0 Tokens, Smart Rule-Based Support) */}
          <View style={[
            styles.muniReflectionCard,
            muniReflection.tone === "support" && styles.muniReflectionCardSupport,
            muniReflection.tone === "celebrate" && styles.muniReflectionCardCelebrate,
          ]}>
            <View style={styles.muniCardTopRow}>
              <View style={styles.muniAvatarWrapper}>
                <MuniAvatar style={styles.muniAvatarArt} />
              </View>

              <View style={styles.muniCopyWrapper}>
                <View style={styles.muniKickerRow}>
                  <Ionicons
                    name={muniReflection.tone === "celebrate" ? "sparkles" : "chatbubble-ellipses"}
                    size={11}
                    color="#356E25"
                  />
                  <Text style={styles.muniKickerText}>MUNI&apos;S REFLECTION</Text>
                </View>
                <Text style={styles.muniHeadlineText}>{muniReflection.headline}</Text>
              </View>
            </View>

            <Text style={styles.muniBodyText}>{muniReflection.body}</Text>

            {muniReflection.actionLabel && muniReflection.actionRoute ? (
              <Animated.View style={[{ transform: [{ scale: reflectionBtnScale }] }, { alignSelf: "flex-start", marginTop: 10 }]}>
                <Pressable
                  style={styles.muniActionPill}
                  onPress={() => {
                    if (muniReflection.actionRoute) {
                      router.push(muniReflection.actionRoute as never);
                    }
                  }}
                  onPressIn={() => handleButtonPressIn(reflectionBtnScale, 0.94)}
                  onPressOut={() => handleButtonPressOut(reflectionBtnScale)}
                  accessibilityRole="button"
                  accessibilityLabel={muniReflection.actionLabel}
                >
                  {muniReflection.actionIcon ? (
                    <Ionicons
                      name={muniReflection.actionIcon}
                      size={14}
                      color="#27561B"
                      style={{ marginRight: 5 }}
                    />
                  ) : null}
                  <Text style={styles.muniActionPillText}>{muniReflection.actionLabel}</Text>
                  <Ionicons name="chevron-forward" size={12} color="#27561B" style={{ marginLeft: 4 }} />
                </Pressable>
              </Animated.View>
            ) : null}
          </View>

          {/* Core Feature 1: Apple Interactive Calendar */}
          <View style={styles.calendarCard}>
            <View style={styles.monthHeader}>
              <Animated.View style={{ transform: [{ scale: prevMonthScale }] }}>
                <Pressable
                  onPress={goPreviousMonth}
                  onPressIn={() => canGoPrevious && handleButtonPressIn(prevMonthScale)}
                  onPressOut={() => handleButtonPressOut(prevMonthScale)}
                  disabled={!canGoPrevious}
                  style={[styles.monthArrowButton, !canGoPrevious && styles.monthArrowButtonDisabled]}
                  accessibilityLabel="Previous month"
                >
                  <Ionicons name="chevron-back" size={18} color={canGoPrevious ? "#0F172A" : "#CBD5E1"} />
                </Pressable>
              </Animated.View>

              <View style={styles.monthLabelWrap}>
                <Text style={styles.monthLabel}>
                  {`${getMonthName(displayMonthIndex)} ${displayYear}`}
                </Text>
              </View>

              <View style={styles.monthActions}>
                {viewedMonthKey !== todayMonthKey ? (
                  <Animated.View style={{ transform: [{ scale: todayBtnScale }] }}>
                    <Pressable
                      onPress={() => {
                        triggerAppleHaptic(Haptics.ImpactFeedbackStyle.Light);
                        setDisplayYear(now.year);
                        setDisplayMonthIndex(now.monthIndex);
                        setSelectedDayNumber(now.day);
                      }}
                      onPressIn={() => handleButtonPressIn(todayBtnScale)}
                      onPressOut={() => handleButtonPressOut(todayBtnScale)}
                      style={styles.todayButton}
                      accessibilityRole="button"
                      accessibilityLabel="Go to today"
                    >
                      <Text style={styles.todayButtonText}>Today</Text>
                    </Pressable>
                  </Animated.View>
                ) : null}

                <Animated.View style={{ transform: [{ scale: nextMonthScale }] }}>
                  <Pressable
                    onPress={goNextMonth}
                    onPressIn={() => !isFutureMonth && handleButtonPressIn(nextMonthScale)}
                    onPressOut={() => handleButtonPressOut(nextMonthScale)}
                    disabled={isFutureMonth}
                    style={[styles.monthArrowButton, isFutureMonth && styles.monthArrowButtonDisabled]}
                    accessibilityLabel="Next month"
                  >
                    <Ionicons name="chevron-forward" size={18} color={!isFutureMonth ? "#0F172A" : "#CBD5E1"} />
                  </Pressable>
                </Animated.View>
              </View>
            </View>

            {/* Weekdays */}
            <View style={styles.weekHeaderRow}>
              {WEEKDAY_LABELS.map((day, i) => (
                <Text key={`${day}-${i}`} style={styles.weekdayText}>
                  {day}
                </Text>
              ))}
            </View>

            {/* Days Grid */}
            <View style={styles.calendarGrid}>
              {calendarDays.map((day, index) => {
                const moodMeta = day.moodId ? EMOTION_META[day.moodId] ?? null : null;
                const isToday =
                  !day.isOutsideMonth &&
                  viewedMonthKey === todayMonthKey &&
                  day.dayNumber === todayDay;

                if (day.dayNumber === null) {
                  return <View key={`blank-${index}`} style={styles.dayCellBlank} />;
                }

                const isSelectable = !day.isOutsideMonth && day.state !== "future";
                const isSelected = day.isSelected;

                return (
                  <View key={`${day.dayNumber}-${index}`} style={styles.dayCell}>
                    <Pressable
                      disabled={!isSelectable}
                      onPress={() => day.dayNumber && handleSelectDay(day.dayNumber)}
                      style={[
                        styles.dayCircle,
                        day.isOutsideMonth && styles.dayCircleOutsideMonth,
                        day.state === "future" && styles.dayCircleFuture,
                        day.state === "empty" && styles.dayCircleEmpty,
                        day.state === "mood" && moodMeta && {
                          backgroundColor: `${moodMeta.color}35`,
                          borderColor: moodMeta.color,
                        },
                        isToday && styles.dayCircleToday,
                        isSelected && styles.dayCircleSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayNumber,
                          day.isOutsideMonth && styles.dayNumberOutsideMonth,
                          day.state === "future" && styles.dayNumberFuture,
                          day.state === "mood" && styles.dayNumberMood,
                          isSelected && styles.dayNumberSelected,
                        ]}
                      >
                        {day.dayNumber}
                      </Text>
                      {day.state === "mood" && Number(day.checkInCount || 0) > 1 ? (
                        <View style={[styles.dayCountBadge, moodMeta ? { backgroundColor: moodMeta.color } : null]}>
                          <Text style={styles.dayCountBadgeText}>{day.checkInCount}</Text>
                        </View>
                      ) : null}
                    </Pressable>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Core Feature 2: Selected Day Timeline (Inline — No Modal!) */}
          <Animated.View
            style={[
              styles.dailyCard,
              {
                opacity: dayCardFade,
                transform: [{ translateY: dayCardTranslateY }],
              },
            ]}
          >
            <View style={styles.dailyCardHeader}>
              <View style={styles.dailyCardHeaderLeft}>
                <Ionicons name="calendar-outline" size={16} color="#475569" style={{ marginRight: 6 }} />
                <Text style={styles.dailyCardDateTitle}>{selectedDayLabel}</Text>
              </View>
              <View style={[styles.dailyCardCountPill, selectedDayEntries.length > 0 && styles.dailyCardCountPillActive]}>
                <Text style={[styles.dailyCardCountText, selectedDayEntries.length > 0 && styles.dailyCardCountTextActive]}>
                  {selectedDayEntries.length > 0
                    ? `${selectedDayEntries.length} check-in${selectedDayEntries.length === 1 ? "" : "s"}`
                    : "No check-ins"}
                </Text>
              </View>
            </View>

            {selectedDayEntries.length > 0 ? (
              <View style={styles.timelineList}>
                {selectedDayEntries.map((entry, index) => {
                  const moodMeta = EMOTION_META[entry.moodId] ?? null;
                  const moodImageSource = getEmotionImageSource(moodMeta, false);

                  return (
                    <View
                      key={entry.id ?? `${entry.moodId}-${index}`}
                      style={[
                        styles.timelineItem,
                        index < selectedDayEntries.length - 1 && styles.timelineItemBorder,
                      ]}
                    >
                      <View style={[styles.timelineIconBox, { borderColor: moodMeta?.color ?? "#CBD5E1", backgroundColor: `${moodMeta?.color ?? "#E2E8F0"}18` }]}>
                        {moodImageSource ? (
                          <Image source={moodImageSource} style={styles.timelineEmotionImage} contentFit="contain" />
                        ) : (
                          <View style={[styles.timelineDot, { backgroundColor: moodMeta?.color ?? "#94A3B8" }]} />
                        )}
                      </View>

                      <View style={styles.timelineInfo}>
                        <Text style={styles.timelineMoodLabel}>{moodMeta?.label ?? entry.moodLabel}</Text>
                        <Text style={styles.timelineTimeText}>{formatCheckInTime(entry.createdAt) || "Logged"}</Text>
                      </View>

                      <View style={styles.timelineSourcePill}>
                        <Ionicons
                          name={String(entry.moodSource).toUpperCase() === "JOURNAL" ? "book-outline" : "hand-left-outline"}
                          size={12}
                          color="#475569"
                          style={{ marginRight: 3 }}
                        />
                        <Text style={styles.timelineSourceText}>{formatMoodSourceLabel(entry.moodSource)}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : (
              <View style={styles.emptyDayWrap}>
                <Ionicons name="sparkles-outline" size={20} color="#94A3B8" style={{ marginBottom: 4 }} />
                <Text style={styles.emptyDayText}>No emotions logged on this day.</Text>
                <Text style={styles.emptyDayHint}>Tap any highlighted day on the calendar above to inspect.</Text>
              </View>
            )}
          </Animated.View>

          {/* Core Feature 3: Monthly Breakdown (Unified & Clear) */}
          <View style={styles.monthlyCard}>
            <View style={styles.monthlyCardHeader}>
              <Text style={styles.monthlyCardTitle}>Monthly Breakdown</Text>
              <Text style={styles.monthlyCardSubtitle}>
                {`${totalCheckIns} total check-in${totalCheckIns === 1 ? "" : "s"}`}
              </Text>
            </View>

            {rankedMoodStats.length > 0 ? (
              <View style={styles.barsContainer}>
                {rankedMoodStats.map((item) => {
                  const maxCount = Math.max(rankedMoodStats[0].count, 1);
                  const percentage = Math.round((item.count / totalCheckIns) * 100);
                  const barWidthPercent = Math.max(12, Math.round((item.count / maxCount) * 100));

                  return (
                    <View key={item.id} style={styles.barRow}>
                      <View style={[styles.barIconCircle, { borderColor: item.color, backgroundColor: `${item.color}18` }]}>
                        {item.image ? (
                          <Image source={item.image} style={styles.barEmotionImage} contentFit="contain" />
                        ) : null}
                      </View>

                      <View style={styles.barInfoWrap}>
                        <View style={styles.barLabelRow}>
                          <Text style={styles.barMoodName}>{item.label}</Text>
                          <Text style={styles.barCountLabel}>
                            {`${item.count} (${percentage}%)`}
                          </Text>
                        </View>
                        <View style={styles.barTrack}>
                          <View
                            style={[
                              styles.barFill,
                              {
                                width: `${barWidthPercent}%`,
                                backgroundColor: item.color,
                              },
                            ]}
                          />
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : (
              <View style={styles.noDataWrap}>
                <Text style={styles.noDataText}>No check-ins logged for this month yet.</Text>
              </View>
            )}
          </View>
          </Animated.View>
        </ScrollView>
      </InformedConsentGate>

      <HomeBottomNav activeTab="none" />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },

  // Apple Floating Blurred Navigation Bar (Stays on top, content scrolls underneath and gets blurred)
  appleFloatingBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: "rgba(255, 255, 255, 0.78)",
  },
  appleCircleButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0F172A",
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  appleCenterTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    columnGap: 5,
  },
  appleCenterTitleText: {
    color: "#0F172A",
    fontSize: 16.5,
    lineHeight: 21,
    fontFamily: "Outfit-Bold",
    letterSpacing: -0.3,
  },

  // Apple Viewport Progress Bar
  appleProgressBarTrack: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 2.5,
    zIndex: 110,
    backgroundColor: "rgba(226, 232, 240, 0.4)",
    overflow: "hidden",
  },
  appleProgressBarFill: {
    height: "100%",
    backgroundColor: "#52B72A",
    borderRadius: 999,
  },

  // Apple Toast Pill
  appleToastWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 120,
    alignItems: "center",
    justifyContent: "center",
  },
  appleToastPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.94)",
    borderWidth: 1,
    borderColor: "#D2EAC7",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    shadowColor: "#0F172A",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  appleToastText: {
    color: "#27561B",
    fontSize: 12,
    lineHeight: 15,
    fontFamily: "Outfit-Bold",
  },

  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 14,
    paddingBottom: 110,
  },

  // Muni Companion Reflection Card
  muniReflectionCard: {
    borderRadius: 24,
    backgroundColor: "#F2F9ED",
    borderWidth: 1,
    borderColor: "#D5EBD0",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    marginBottom: 12,
    shadowColor: "#112616",
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  muniReflectionCardSupport: {
    backgroundColor: "#F4F8F4",
    borderColor: "#D2E4D2",
  },
  muniReflectionCardCelebrate: {
    backgroundColor: "#F6FAF0",
    borderColor: "#D5EAD0",
  },
  muniCardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 12,
    marginBottom: 8,
  },
  muniAvatarWrapper: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D5EBD0",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  muniAvatarArt: {
    width: 52,
    height: 52,
  },
  muniCopyWrapper: {
    flex: 1,
  },
  muniKickerRow: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 5,
    marginBottom: 2,
  },
  muniKickerText: {
    color: "#356E25",
    fontSize: 10,
    lineHeight: 13,
    fontFamily: "Outfit-Bold",
    letterSpacing: 0.8,
  },
  muniHeadlineText: {
    color: "#0F172A",
    fontSize: 16,
    lineHeight: 21,
    fontFamily: "Outfit-Bold",
    letterSpacing: -0.2,
  },
  muniBodyText: {
    color: "#334155",
    fontSize: 13.5,
    lineHeight: 19,
    fontFamily: "Outfit",
  },
  muniActionPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CCE5C7",
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 999,
    shadowColor: "#1E3B16",
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  muniActionPillText: {
    color: "#27561B",
    fontSize: 12.5,
    lineHeight: 16,
    fontFamily: "Outfit-Bold",
  },

  // Calendar Card
  calendarCard: {
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 12,
    paddingTop: 14,
    paddingBottom: 14,
    marginBottom: 12,
    shadowColor: "#0F172A",
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  monthHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  monthArrowButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  monthArrowButtonDisabled: {
    opacity: 0.45,
  },
  monthLabelWrap: {
    alignItems: "center",
    flex: 1,
  },
  monthLabel: {
    color: "#0F172A",
    fontSize: 17,
    lineHeight: 22,
    fontFamily: "Outfit-Bold",
    letterSpacing: -0.2,
  },
  monthActions: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 6,
  },
  todayButton: {
    height: 30,
    borderRadius: 999,
    backgroundColor: "#EEF8EB",
    borderWidth: 1,
    borderColor: "#D2EAC7",
    justifyContent: "center",
    paddingHorizontal: 11,
  },
  todayButtonText: {
    color: "#356E25",
    fontSize: 11.5,
    lineHeight: 15,
    fontFamily: "Outfit-Bold",
  },
  weekHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 2,
    marginBottom: 8,
  },
  weekdayText: {
    width: "14.28%",
    textAlign: "center",
    color: "#94A3B8",
    fontSize: 12,
    lineHeight: 16,
    fontFamily: "Outfit-Bold",
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: 7,
  },
  dayCellBlank: {
    width: "14.28%",
    aspectRatio: 1,
  },
  dayCell: {
    width: "14.28%",
    alignItems: "center",
    justifyContent: "center",
  },
  dayCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "transparent",
    position: "relative",
  },
  dayCircleOutsideMonth: {
    opacity: 0.25,
  },
  dayCircleFuture: {
    opacity: 0.35,
  },
  dayCircleEmpty: {
    backgroundColor: "#F8FAFC",
  },
  dayCircleToday: {
    borderWidth: 2,
    borderColor: "#52B72A",
  },
  dayCircleSelected: {
    borderWidth: 2.5,
    borderColor: "#0F172A",
  },
  dayNumber: {
    color: "#334155",
    fontSize: 13.5,
    lineHeight: 17,
    fontFamily: "Outfit-SemiBold",
  },
  dayNumberMood: {
    color: "#0F172A",
    fontFamily: "Outfit-Bold",
  },
  dayNumberFuture: {
    color: "#94A3B8",
  },
  dayNumberOutsideMonth: {
    color: "#CBD5E1",
  },
  dayNumberSelected: {
    color: "#0F172A",
    fontFamily: "Outfit-Bold",
  },
  dayCountBadge: {
    position: "absolute",
    right: -2,
    top: -2,
    minWidth: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#52B72A",
    borderWidth: 1,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 2,
  },
  dayCountBadgeText: {
    color: "#FFFFFF",
    fontSize: 8.5,
    lineHeight: 10,
    fontFamily: "Outfit-Bold",
  },

  // Selected Day Timeline Card
  dailyCard: {
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 14,
    marginBottom: 12,
    shadowColor: "#0F172A",
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  dailyCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  dailyCardHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  dailyCardDateTitle: {
    color: "#0F172A",
    fontSize: 16,
    lineHeight: 21,
    fontFamily: "Outfit-Bold",
  },
  dailyCardCountPill: {
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    borderRadius: 999,
    backgroundColor: "#F1F5F9",
  },
  dailyCardCountPillActive: {
    backgroundColor: "#EEF8EB",
    borderWidth: 1,
    borderColor: "#D2EAC7",
  },
  dailyCardCountText: {
    color: "#64748B",
    fontSize: 11,
    lineHeight: 14,
    fontFamily: "Outfit-SemiBold",
  },
  dailyCardCountTextActive: {
    color: "#356E25",
    fontFamily: "Outfit-Bold",
  },
  timelineList: {
    rowGap: 8,
  },
  timelineItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
  },
  timelineItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "#F8FAFC",
    paddingBottom: 10,
  },
  timelineIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    marginRight: 10,
  },
  timelineEmotionImage: {
    width: 38,
    height: 38,
    borderRadius: 11,
  },
  timelineDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  timelineInfo: {
    flex: 1,
    minWidth: 0,
  },
  timelineMoodLabel: {
    color: "#0F172A",
    fontSize: 15,
    lineHeight: 19,
    fontFamily: "Outfit-Bold",
  },
  timelineTimeText: {
    color: "#64748B",
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
    fontFamily: "Outfit-Medium",
  },
  timelineSourcePill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: "#F1F5F9",
  },
  timelineSourceText: {
    color: "#475569",
    fontSize: 11,
    lineHeight: 14,
    fontFamily: "Outfit-SemiBold",
  },
  emptyDayWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 18,
  },
  emptyDayText: {
    color: "#475569",
    fontSize: 13.5,
    lineHeight: 18,
    fontFamily: "Outfit-SemiBold",
  },
  emptyDayHint: {
    color: "#94A3B8",
    fontSize: 12,
    lineHeight: 16,
    marginTop: 3,
  },

  // Monthly Breakdown Card
  monthlyCard: {
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 14,
    paddingTop: 16,
    paddingBottom: 16,
    marginBottom: 14,
    shadowColor: "#0F172A",
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  monthlyCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  monthlyCardTitle: {
    color: "#0F172A",
    fontSize: 17,
    lineHeight: 22,
    fontFamily: "Outfit-Bold",
    letterSpacing: -0.2,
  },
  monthlyCardSubtitle: {
    color: "#64748B",
    fontSize: 12,
    lineHeight: 16,
    fontFamily: "Outfit-Medium",
  },
  barsContainer: {
    rowGap: 10,
  },
  barRow: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 10,
  },
  barIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  barEmotionImage: {
    width: 28,
    height: 28,
    borderRadius: 9,
  },
  barInfoWrap: {
    flex: 1,
  },
  barLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  barMoodName: {
    color: "#1E293B",
    fontSize: 13,
    lineHeight: 17,
    fontFamily: "Outfit-Bold",
  },
  barCountLabel: {
    color: "#64748B",
    fontSize: 11.5,
    lineHeight: 15,
    fontFamily: "Outfit-SemiBold",
  },
  barTrack: {
    height: 7,
    borderRadius: 999,
    backgroundColor: "#F1F5F9",
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 999,
  },
  noDataWrap: {
    paddingVertical: 14,
    alignItems: "center",
  },
  noDataText: {
    color: "#94A3B8",
    fontSize: 13,
    lineHeight: 18,
  },
});
