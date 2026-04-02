import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState, type ComponentProps } from "react";
import { Animated, Easing, Image, ImageSourcePropType, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Defs, Ellipse, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import { HomeBottomNav } from "../components/home/HomeBottomNav";
import { useAuthSession } from "../lib/auth-session";
import {
  claimDailyCheckIn,
  fetchCheckInStatus,
  fetchDailyMood,
  fetchRecentJournalEntries,
  fetchStudentAppointments,
  fetchStudentNotifications,
  saveDailyMood,
} from "../lib/backend-api";
import { getManilaTodayParts } from "../lib/manila-date";

type MoodItem = {
  color: string;
  id: string;
  image: ImageSourcePropType;
  label: string;
};

type DailyCheckinReward = {
  id: string;
  state: "active" | "done" | "locked";
  value: string;
};

type SupportCardItem = {
  accentColor: string;
  backgroundColor: string;
  description: string;
  icon: ComponentProps<typeof Ionicons>["name"];
  id: string;
  title: string;
};

const MOODS: MoodItem[] = [
  { color: "#FFD616", id: "happy", image: require("../assets/images/Moods/happy.gif"), label: "Happy" },
  { color: "#97CFDA", id: "calm", image: require("../assets/images/Moods/calm.gif"), label: "Calm" },
  { color: "#7EA9D9", id: "sad", image: require("../assets/images/Moods/sad.gif"), label: "Sad" },
  { color: "#F19137", id: "stressed", image: require("../assets/images/Moods/stressed.gif"), label: "Stressed" },
  { color: "#E86686", id: "angry", image: require("../assets/images/Moods/angry.gif"), label: "Angry" },
  { color: "#B895C8", id: "anxious", image: require("../assets/images/Moods/anxious.gif"), label: "Anxious" },
];

const DAILY_CHECKIN_REWARDS: DailyCheckinReward[] = [
  { id: "r10", value: "+10", state: "locked" },
  { id: "r20", value: "+20", state: "locked" },
  { id: "r30", value: "+30", state: "locked" },
  { id: "r50", value: "+50", state: "locked" },
  { id: "r70", value: "+70", state: "locked" },
  { id: "r100", value: "+100", state: "locked" },
  { id: "r150", value: "+150", state: "locked" },
];

type RecentEntryCard = {
  createdAt: string;
  id: string;
  meta: string;
  preview: string;
};

type HomeRecentFilter = "newest" | "oldest";

const SUPPORT_CARDS: SupportCardItem[] = [
  {
    accentColor: "#4B8C35",
    id: "support-1",
    title: "Quick Journal",
    description: "Write your entry for today",
    icon: "create-outline",
    backgroundColor: "#B1DEB3",
  },
  {
    accentColor: "#5A8A36",
    id: "support-2",
    title: "Wellness Tools",
    description: "Calm your mind and body with exercises.",
    icon: "leaf-outline",
    backgroundColor: "#BDE0AA",
  },
  {
    accentColor: "#4C7C64",
    id: "support-3",
    title: "Talk to Peer",
    description: "Connect with a trained student listener today.",
    icon: "people-outline",
    backgroundColor: "#BDE0AA",
  },
  {
    accentColor: "#4E6F88",
    id: "support-4",
    title: "Counseling",
    description: "Set up a private and safe session with guidance counselors.",
    icon: "chatbubbles-outline",
    backgroundColor: "#B1DEB3",
  },
];

const HOME_QUOTES = [
  "It's okay to not have it all figured out.",
  "You do not need to rush your healing to deserve peace.",
  "Small steps still count, especially on heavy days.",
  "You are allowed to rest and begin again gently.",
  "Even quiet progress is still progress worth honoring.",
];

const TALA_IMAGE = require("../assets/images/Tala_Star.png");
const MUNI_IMAGE = require("../assets/images/MUNI_default.png");

export default function HomeScreen() {
  const { user } = useAuthSession();
  const { height, width } = useWindowDimensions();
  const { consultConfirmed, appointmentId, welcome } = useLocalSearchParams<{
    consultConfirmed?: string;
    appointmentId?: string;
    welcome?: string;
  }>();
  const compact = height < 760;
  const tiny = height < 680;
  const frameWidth = Math.min(width, 412);
  const headerHeight = tiny ? 58 : 62;
  const rewardGap = 4;
  const rewardTileWidth = Math.floor((frameWidth - 44 - rewardGap * 6) / 7);
  const rewardTileHeight = rewardTileWidth + 30;
  const rewardTileIconSize = Math.max(24, Math.floor(rewardTileWidth * 0.7));
  const rewardTileLabelSize = rewardTileWidth <= 41 ? 26 / 2 : 30 / 2;
  const [checkInRewards, setCheckInRewards] = useState<DailyCheckinReward[]>(DAILY_CHECKIN_REWARDS);
  const [hasCheckedInToday, setHasCheckedInToday] = useState(false);
  const [isClaimingCheckIn, setIsClaimingCheckIn] = useState(false);
  const [showCheckInResultModal, setShowCheckInResultModal] = useState(false);
  const [checkInResultMessage, setCheckInResultMessage] = useState("");
  const [totalTala, setTotalTala] = useState(0);
  const [selectedMoodId, setSelectedMoodId] = useState<string | null>(null);
  const [pendingMoodId, setPendingMoodId] = useState<string | null>(null);
  const [showMoodConfirmModal, setShowMoodConfirmModal] = useState(false);
  const [recentEntries, setRecentEntries] = useState<RecentEntryCard[]>([]);
  const [recentEntriesSort, setRecentEntriesSort] = useState<HomeRecentFilter>("newest");
  const [showRecentEntriesFilterModal, setShowRecentEntriesFilterModal] = useState(false);
  const [hasScrolled, setHasScrolled] = useState(false);
  const [showConsultOverlay, setShowConsultOverlay] = useState(false);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [quoteIndex, setQuoteIndex] = useState(0);
  const [upcomingAppointment, setUpcomingAppointment] = useState<Awaited<ReturnType<typeof fetchStudentAppointments>>["upcomingAppointment"]>(null);
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false);
  const headerSwitchOn = tiny ? 188 : compact ? 208 : 236;
  const headerSwitchOff = tiny ? 154 : compact ? 174 : 202;
  const idleValues = useRef(MOODS.map(() => new Animated.Value(0))).current;
  const pressScales = useRef(MOODS.map(() => new Animated.Value(1))).current;
  const waveDrift = useRef(new Animated.Value(0)).current;
  const welcomeOpacity = useRef(new Animated.Value(0)).current;
  const welcomeScale = useRef(new Animated.Value(0.92)).current;
  const welcomeTranslateY = useRef(new Animated.Value(22)).current;
  const welcomeStarMotion = useRef(new Animated.Value(0)).current;
  const welcomeHandledRef = useRef(false);
  const quoteOpacity = useRef(new Animated.Value(1)).current;
  const quoteTranslateY = useRef(new Animated.Value(0)).current;
  const quoteScale = useRef(new Animated.Value(1)).current;
  const quoteAuraDrift = useRef(new Animated.Value(0)).current;
  const quoteAuraPulse = useRef(new Animated.Value(0)).current;
  const supportShortcuts = SUPPORT_CARDS.filter((card) => card.id !== "support-1");

  useEffect(() => {
    const loops = idleValues.map((value, index) => {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.delay(index * 120),
          Animated.timing(value, {
            toValue: 1,
            duration: 1150,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: 0,
            duration: 1150,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
      );
      loop.start();
      return loop;
    });

    return () => {
      loops.forEach((loop) => loop.stop());
    };
  }, [idleValues]);

  useEffect(() => {
    const driftLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(waveDrift, {
          toValue: 1,
          duration: 3600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(waveDrift, {
          toValue: 0,
          duration: 3600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );

    driftLoop.start();

    return () => {
      driftLoop.stop();
    };
  }, [waveDrift]);

  useEffect(() => {
    const driftLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(quoteAuraDrift, {
          toValue: 1,
          duration: 5600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(quoteAuraDrift, {
          toValue: 0,
          duration: 5600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(quoteAuraPulse, {
          toValue: 1,
          duration: 3200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(quoteAuraPulse, {
          toValue: 0,
          duration: 3200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );

    driftLoop.start();
    pulseLoop.start();

    return () => {
      driftLoop.stop();
      pulseLoop.stop();
    };
  }, [quoteAuraDrift, quoteAuraPulse]);

  useEffect(() => {
    if (HOME_QUOTES.length <= 1) {
      return;
    }

    const cycleQuote = () => {
      Animated.parallel([
        Animated.timing(quoteOpacity, {
          toValue: 0,
          duration: 240,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(quoteTranslateY, {
          toValue: -14,
          duration: 240,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(quoteScale, {
          toValue: 0.97,
          duration: 240,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start(() => {
        setQuoteIndex((prev) => (prev + 1) % HOME_QUOTES.length);
        quoteOpacity.setValue(0);
        quoteTranslateY.setValue(18);
        quoteScale.setValue(0.96);

        Animated.parallel([
          Animated.timing(quoteOpacity, {
            toValue: 1,
            duration: 320,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.spring(quoteTranslateY, {
            toValue: 0,
            useNativeDriver: true,
            speed: 15,
            bounciness: 8,
          }),
          Animated.spring(quoteScale, {
            toValue: 1,
            useNativeDriver: true,
            speed: 16,
            bounciness: 7,
          }),
        ]).start();
      });
    };

    const interval = setInterval(cycleQuote, 5600);

    return () => {
      clearInterval(interval);
    };
  }, [quoteOpacity, quoteScale, quoteTranslateY]);

  useEffect(() => {
    if (consultConfirmed === "1") {
      setShowConsultOverlay(true);
    }
  }, [consultConfirmed]);

  const clearWelcomeParam = useCallback(() => {
    if (consultConfirmed === "1" || appointmentId) {
      const params: { appointmentId?: string; consultConfirmed?: string } = {};
      if (consultConfirmed === "1") {
        params.consultConfirmed = "1";
      }
      if (appointmentId) {
        params.appointmentId = appointmentId;
      }
      router.replace({ pathname: "/home", params });
      return;
    }

    router.replace("/home");
  }, [appointmentId, consultConfirmed]);

  useEffect(() => {
    if (welcome === "1" && !welcomeHandledRef.current) {
      welcomeHandledRef.current = true;
      setShowWelcomeModal(true);
      clearWelcomeParam();
      return;
    }

    if (welcome !== "1") {
      welcomeHandledRef.current = false;
    }
  }, [clearWelcomeParam, welcome]);

  useEffect(() => {
    if (!showWelcomeModal) {
      return;
    }

    welcomeOpacity.setValue(0);
    welcomeScale.setValue(0.92);
    welcomeTranslateY.setValue(22);
    welcomeStarMotion.setValue(0);

    const introAnimation = Animated.parallel([
      Animated.timing(welcomeOpacity, {
        toValue: 1,
        duration: 240,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.spring(welcomeScale, {
        toValue: 1,
        useNativeDriver: true,
        speed: 14,
        bounciness: 8,
      }),
      Animated.timing(welcomeTranslateY, {
        toValue: 0,
        duration: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);

    const starLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(welcomeStarMotion, {
          toValue: 1,
          duration: 1250,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(welcomeStarMotion, {
          toValue: 0,
          duration: 1250,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );

    introAnimation.start();
    starLoop.start();

    return () => {
      introAnimation.stop();
      starLoop.stop();
    };
  }, [showWelcomeModal, welcomeOpacity, welcomeScale, welcomeStarMotion, welcomeTranslateY]);

  const loadTodayMood = useCallback(async () => {
    if (!user?.studentNumber) {
      setSelectedMoodId(null);
      return;
    }

    const result = await fetchDailyMood(user.studentNumber, getManilaTodayParts().isoDate);
    if (result.ok) {
      setSelectedMoodId(result.entry?.moodId ?? null);
    }
  }, [user?.studentNumber]);

  const buildCheckInRewards = useCallback((completedDays: number, activeDay: number, todayCheckedIn: boolean) => {
    setCheckInRewards(
      DAILY_CHECKIN_REWARDS.map((reward, index) => {
        const day = index + 1;
        if (day <= completedDays) {
          return { ...reward, state: "done" };
        }
        if (!todayCheckedIn && day === activeDay) {
          return { ...reward, state: "active" };
        }
        return { ...reward, state: "locked" };
      }),
    );
  }, []);

  const loadCheckInStatus = useCallback(async () => {
    if (!user?.studentNumber) {
      setTotalTala(0);
      setCheckInRewards(DAILY_CHECKIN_REWARDS);
      return;
    }

    const result = await fetchCheckInStatus(user.studentNumber);
    if (!result.ok) {
      return;
    }

    setTotalTala(result.totalTala ?? 0);
    setHasCheckedInToday(Boolean(result.todayCheckedIn));
    buildCheckInRewards(
      result.completedDays ?? 0,
      result.activeDay ?? 1,
      Boolean(result.todayCheckedIn),
    );
  }, [buildCheckInRewards, user?.studentNumber]);

  const loadRecentEntries = useCallback(async () => {
    if (!user?.studentNumber) {
      setRecentEntries([]);
      return;
    }

    const result = await fetchRecentJournalEntries(user.studentNumber, 1);
    if (!result.ok) {
      setRecentEntries([]);
      return;
    }

    setRecentEntries(
      (result.entries ?? []).map((entry) => ({
        createdAt: entry.createdAt,
        id: entry.id,
        meta: new Date(entry.createdAt).toLocaleString("en-US", {
          month: "long",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        }),
        preview: entry.preview || entry.summary || entry.title || "Journal entry",
      })),
    );
  }, [user?.studentNumber]);

  const loadUpcomingAppointment = useCallback(async () => {
    if (!user?.studentNumber) {
      setUpcomingAppointment(null);
      return;
    }

    const result = await fetchStudentAppointments(user.studentNumber);
    if (!result.ok) {
      setUpcomingAppointment(null);
      return;
    }

    const appointments = Array.isArray(result.appointments) ? result.appointments : [];
    const matchedAppointment =
      appointmentId && appointments.length ? appointments.find((item) => item.id === appointmentId) || null : null;
    setUpcomingAppointment(matchedAppointment || result.upcomingAppointment || null);
  }, [appointmentId, user?.studentNumber]);

  const loadNotifications = useCallback(async () => {
    if (!user?.studentNumber) {
      setHasUnreadNotifications(false);
      return;
    }

    const result = await fetchStudentNotifications(user.studentNumber);
    if (!result.ok) {
      setHasUnreadNotifications(false);
      return;
    }

    setHasUnreadNotifications((result.unreadCount ?? 0) > 0);
  }, [user?.studentNumber]);

  const displayedRecentEntries =
    recentEntriesSort === "newest" ? recentEntries : [...recentEntries].reverse();
  const recentListHeight =
    displayedRecentEntries.length === 0
      ? 148
      : Math.min(displayedRecentEntries.length * 104 + 20, compact ? 300 : 372);

  useFocusEffect(
    useCallback(() => {
      void loadTodayMood();
      void loadCheckInStatus();
      void loadRecentEntries();
      void loadUpcomingAppointment();
      void loadNotifications();
    }, [loadCheckInStatus, loadNotifications, loadRecentEntries, loadTodayMood, loadUpcomingAppointment]),
  );

  const isMoodLocked = Boolean(selectedMoodId);

  const handleMoodSelect = (moodId: string) => {
    if (!user?.studentNumber || isMoodLocked) {
      return;
    }

    setPendingMoodId(moodId);
    setShowMoodConfirmModal(true);
  };

  const handleConfirmMood = async () => {
    if (!user?.studentNumber || !pendingMoodId) {
      setShowMoodConfirmModal(false);
      setPendingMoodId(null);
      return;
    }

    const result = await saveDailyMood(user.studentNumber, pendingMoodId, getManilaTodayParts().isoDate);
    if (result.ok) {
      setSelectedMoodId(result.entry?.moodId ?? pendingMoodId);
    } else {
      void loadTodayMood();
    }

    setShowMoodConfirmModal(false);
    setPendingMoodId(null);
  };

  const handleCancelMoodConfirm = () => {
    setShowMoodConfirmModal(false);
    setPendingMoodId(null);
  };

  const handleMoodPressIn = (index: number) => {
    Animated.spring(pressScales[index], {
      toValue: 0.9,
      useNativeDriver: true,
      speed: 30,
      bounciness: 8,
    }).start();
  };

  const handleMoodPressOut = (index: number) => {
    Animated.spring(pressScales[index], {
      toValue: 1,
      useNativeDriver: true,
      speed: 20,
      bounciness: 10,
    }).start();
  };

  const handleHomeScroll = (offsetY: number) => {
    setHasScrolled((currentHasScrolled) => {
      if (currentHasScrolled) return offsetY > headerSwitchOff;
      return offsetY > headerSwitchOn;
    });
  };

  const closeConsultOverlay = () => {
    setShowConsultOverlay(false);
    router.replace("/home");
  };

  const handleDismissWelcomeModal = () => {
    setShowWelcomeModal(false);
  };

  const handleSupportCardPress = (cardId: string) => {
    if (cardId === "support-1") {
      router.push("/write-entry?mode=new");
      return;
    }
    if (cardId === "support-2") {
      router.push("/wellness-tools");
      return;
    }
    if (cardId === "support-3" || cardId === "support-4") {
      router.push("/consult");
    }
  };

  const handleCheckInToday = async () => {
    if (!user?.studentNumber || isClaimingCheckIn) {
      return;
    }

    setIsClaimingCheckIn(true);
    const result = await claimDailyCheckIn(user.studentNumber);
    setIsClaimingCheckIn(false);

    if (!result.ok) {
      setCheckInResultMessage(result.message ?? "Unable to claim daily check-in.");
      setShowCheckInResultModal(true);
      void loadCheckInStatus();
      return;
    }

    setTotalTala(result.totalTala ?? 0);
    setHasCheckedInToday(Boolean(result.todayCheckedIn));
    buildCheckInRewards(
      result.completedDays ?? 0,
      result.activeDay ?? 1,
      Boolean(result.todayCheckedIn),
    );

    const bonusMessage =
      (result.bonusReward ?? 0) > 0 ? ` Bonus reward: +${result.bonusReward} Tala.` : "";
    setCheckInResultMessage(`You earned +${result.totalReward ?? result.todayReward ?? 0} Tala today.${bonusMessage}`);
    setShowCheckInResultModal(true);
  };

  const waveTranslateX = waveDrift.interpolate({
    inputRange: [0, 1],
    outputRange: [-22, 22],
  });
  const waveTranslateXReverse = waveDrift.interpolate({
    inputRange: [0, 1],
    outputRange: [16, -16],
  });
  const welcomeBigTranslateY = welcomeStarMotion.interpolate({
    inputRange: [0, 1],
    outputRange: [6, -8],
  });
  const welcomeBigScale = welcomeStarMotion.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.97, 1.05, 1],
  });
  const welcomeSmallTranslateY = welcomeStarMotion.interpolate({
    inputRange: [0, 1],
    outputRange: [-4, 5],
  });
  const welcomeSmallScale = welcomeStarMotion.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.95, 1.06, 1],
  });
  const quoteAuraOneX = quoteAuraDrift.interpolate({
    inputRange: [0, 1],
    outputRange: [-34, 26],
  });
  const quoteAuraOneY = quoteAuraPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -10],
  });
  const quoteAuraOneScale = quoteAuraPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.12],
  });
  const quoteAuraTwoX = quoteAuraDrift.interpolate({
    inputRange: [0, 1],
    outputRange: [20, -28],
  });
  const quoteAuraTwoY = quoteAuraPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 12],
  });
  const quoteAuraTwoScale = quoteAuraPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1.04, 0.94],
  });
  const quoteTextShadowDrift = quoteAuraDrift.interpolate({
    inputRange: [0, 1],
    outputRange: [-3, 3],
  });

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={[styles.stickyHeader, hasScrolled ? styles.stickyHeaderScrolled : styles.stickyHeaderTop]}>
        <Pressable
          style={styles.headerLeft}
          accessibilityLabel="Open profile"
          onPress={() => router.push("/profile")}
        >
          <View style={[styles.avatarCircle, hasScrolled ? styles.avatarCircleScrolled : styles.avatarCircleTop]}>
            <Ionicons name="person-outline" size={18} color="#5D5D5D" />
          </View>
          <Text style={[styles.greetingText, hasScrolled ? styles.greetingTextScrolled : styles.greetingTextTop]}>
            Hello, <Text style={[styles.userText, hasScrolled ? styles.userTextScrolled : styles.userTextTop]}>{user?.firstName || "User"}</Text>
          </Text>
        </Pressable>

        <Pressable
          style={styles.headerActionButton}
          accessibilityLabel="Open notifications"
          onPress={() => router.push("/notifications")}
        >
          <Ionicons name="notifications-outline" size={22} color={hasScrolled ? "#2D3034" : "#2E4A39"} />
          {hasUnreadNotifications ? <View style={styles.notificationDot} /> : null}
        </Pressable>
      </View>

      <ScrollView
        style={styles.contentScroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={(event) => handleHomeScroll(event.nativeEvent.contentOffset.y)}
      >
        <View style={[styles.quoteHero, compact && styles.quoteHeroCompact, tiny && styles.quoteHeroTiny]}>
          <View style={styles.quoteHeroAtmosphere} pointerEvents="none">
            <Svg width="100%" height="100%" viewBox="0 0 412 260" preserveAspectRatio="none" style={styles.quoteHeroGradient}>
              <Defs>
                <LinearGradient id="quoteBg" x1="0%" y1="0%" x2="100%" y2="100%">
                  <Stop offset="0%" stopColor="#D8F6AF" />
                  <Stop offset="32%" stopColor="#C8EEA7" />
                  <Stop offset="68%" stopColor="#AAD991" />
                  <Stop offset="100%" stopColor="#87C8A1" />
                </LinearGradient>
                <LinearGradient id="quoteShine" x1="0%" y1="0%" x2="100%" y2="0%">
                  <Stop offset="0%" stopColor="rgba(255,255,255,0)" />
                  <Stop offset="52%" stopColor="rgba(255,255,255,0.34)" />
                  <Stop offset="100%" stopColor="rgba(255,255,255,0)" />
                </LinearGradient>
              </Defs>
              <Rect x="0" y="0" width="412" height="260" fill="url(#quoteBg)" />
              <Path d="M0,56 C66,18 118,90 188,58 C270,22 332,8 412,40 L412,0 L0,0 Z" fill="rgba(255,255,255,0.18)" />
              <Rect x="-40" y="26" width="492" height="70" fill="url(#quoteShine)" opacity={0.42} transform="rotate(-7 206 61)" />
            </Svg>

            <Animated.View
              style={[
                styles.quoteAuraBlob,
                styles.quoteAuraBlobOne,
                { transform: [{ translateX: quoteAuraOneX }, { translateY: quoteAuraOneY }, { scale: quoteAuraOneScale }] },
              ]}
            >
              <Svg width="100%" height="100%" viewBox="0 0 230 230">
                <Defs>
                  <LinearGradient id="auraOne" x1="0%" y1="0%" x2="100%" y2="100%">
                    <Stop offset="0%" stopColor="rgba(255,255,255,0.58)" />
                    <Stop offset="100%" stopColor="rgba(255,255,255,0)" />
                  </LinearGradient>
                </Defs>
                <Ellipse cx="115" cy="115" rx="115" ry="92" fill="url(#auraOne)" />
              </Svg>
            </Animated.View>

            <Animated.View
              style={[
                styles.quoteAuraBlob,
                styles.quoteAuraBlobTwo,
                { transform: [{ translateX: quoteAuraTwoX }, { translateY: quoteAuraTwoY }, { scale: quoteAuraTwoScale }] },
              ]}
            >
              <Svg width="100%" height="100%" viewBox="0 0 250 250">
                <Defs>
                  <LinearGradient id="auraTwo" x1="0%" y1="0%" x2="100%" y2="100%">
                    <Stop offset="0%" stopColor="rgba(255,247,187,0.58)" />
                    <Stop offset="100%" stopColor="rgba(255,255,255,0)" />
                  </LinearGradient>
                </Defs>
                <Ellipse cx="125" cy="125" rx="118" ry="100" fill="url(#auraTwo)" />
              </Svg>
            </Animated.View>
          </View>

          <View style={styles.quoteHeroBody}>
            <View style={{ height: headerHeight }} />
            <Animated.View
              style={[
                styles.quoteTextWrap,
                {
                opacity: quoteOpacity,
                transform: [{ translateY: quoteTranslateY }, { translateX: quoteTextShadowDrift }, { scale: quoteScale }],
                },
              ]}
            >
              <Text style={styles.quoteText}>{HOME_QUOTES[quoteIndex]}</Text>
            </Animated.View>
          </View>

          <View style={styles.quoteWaveBase} pointerEvents="none" />

          <Animated.View
            style={[styles.quoteWaveWrap, { transform: [{ translateX: waveTranslateX }] }]}
            pointerEvents="none"
          >
            <Svg width="100%" height="96" viewBox="0 0 412 96" preserveAspectRatio="none">
              <Path
                d="M0,66 C68,94 132,8 198,26 C278,46 336,92 412,62 L412,96 L0,96 Z"
                fill="#FFFFFF"
              />
            </Svg>
          </Animated.View>
          <Animated.View
            style={[styles.quoteWaveShadeWrap, { transform: [{ translateX: waveTranslateXReverse }] }]}
            pointerEvents="none"
          >
            <Svg width="100%" height="54" viewBox="0 0 412 54" preserveAspectRatio="none">
              <Path
                d="M0,39 C74,54 134,2 198,12 C280,24 338,52 412,36"
                stroke="#9AD96A"
                strokeWidth={14}
                strokeOpacity={0.3}
                fill="none"
              />
            </Svg>
          </Animated.View>
          <Animated.View
            style={[styles.quoteWaveLineWrap, { transform: [{ translateX: waveTranslateX }] }]}
            pointerEvents="none"
          >
            <Svg width="100%" height="52" viewBox="0 0 412 52" preserveAspectRatio="none">
              <Path d="M0,36 C74,51 134,1 198,11 C280,24 338,50 412,35" stroke="#8CD858" strokeWidth={5} fill="none" />
            </Svg>
          </Animated.View>
        </View>

        <View style={styles.moodCard}>
          <View style={styles.surfaceGlow} />
          <View style={styles.moodHeaderRow}>
            <Image source={MUNI_IMAGE} style={styles.moodPetArt} resizeMode="contain" />
            <View style={styles.moodHeaderTextWrap}>
              <Text style={styles.sectionEyebrow}>Mood Check</Text>
              <Text style={styles.moodHeading}>How are you feeling?</Text>
              <Text style={styles.moodSubHeading}>Track your mood to understand patterns</Text>
            </View>
          </View>

          <View style={styles.moodRow}>
            {MOODS.map((mood, index) => (
              <View key={mood.label} style={styles.moodItem}>
                <Pressable
                  disabled={isMoodLocked && selectedMoodId !== mood.id}
                  onPress={() => handleMoodSelect(mood.id)}
                  onPressIn={() => handleMoodPressIn(index)}
                  onPressOut={() => handleMoodPressOut(index)}
                  style={isMoodLocked && selectedMoodId !== mood.id ? styles.moodButtonDisabled : undefined}
                >
                  <Animated.View
                    style={[
                      styles.moodFace,
                      selectedMoodId === mood.id && styles.moodFaceActive,
                      {
                        transform: [
                          {
                            translateY: idleValues[index].interpolate({
                              inputRange: [0, 1],
                              outputRange: [0, -4],
                            }),
                          },
                          { scale: pressScales[index] },
                        ],
                      },
                    ]}
                  >
                    <Image source={mood.image} style={styles.moodIcon} resizeMode="contain" />
                  </Animated.View>
                </Pressable>
                <Text style={[styles.moodLabel, selectedMoodId === mood.id && styles.moodLabelActive]} numberOfLines={1}>
                  {mood.label}
                </Text>
              </View>
            ))}
          </View>

          <Pressable style={styles.moodHistoryButton} onPress={() => router.push("/mood-overview")}>
            <Text style={styles.moodHistoryButtonText}>View Mood History</Text>
          </Pressable>
        </View>

        <View style={styles.dailyCheckinCard}>
          <View style={styles.surfaceGlow} />
          <View style={styles.dailyCheckinHeader}>
            <Text style={styles.dailyCheckinTitle}>Daily Check-in</Text>
            <View style={styles.dailyTalaPill}>
              <Image source={TALA_IMAGE} style={styles.dailyTalaPillIcon} resizeMode="contain" />
              <Text style={styles.dailyTalaPillText}>{totalTala.toLocaleString("en-US")}</Text>
            </View>
          </View>

          <View style={styles.dailyRewardsRow}>
            {checkInRewards.map((reward, index) => (
              <View
                key={reward.id}
                style={[
                  styles.dailyRewardBox,
                  { width: rewardTileWidth, height: rewardTileHeight },
                  reward.state === "done" && styles.dailyRewardBoxDone,
                  reward.state === "active" && styles.dailyRewardBoxActive,
                  reward.state === "locked" && styles.dailyRewardBoxLocked,
                ]}
              >
                {reward.state === "done" ? (
                  <View
                    style={[
                      styles.dailyRewardDoneCircle,
                      {
                        width: rewardTileIconSize,
                        height: rewardTileIconSize,
                        borderRadius: rewardTileIconSize / 2,
                      },
                    ]}
                  >
                    <Ionicons name="checkmark" size={20} color="#FFFFFF" />
                  </View>
                ) : (
                  <Image
                    source={TALA_IMAGE}
                    style={[styles.dailyRewardTalaIcon, { width: rewardTileIconSize, height: rewardTileIconSize }]}
                    resizeMode="contain"
                  />
                )}
                <Text
                  style={[
                    styles.dailyRewardValue,
                    { fontSize: rewardTileLabelSize, lineHeight: rewardTileLabelSize + 4 },
                    reward.state === "done" && styles.dailyRewardValueDone,
                    reward.state === "active" && styles.dailyRewardValueActive,
                    reward.state === "locked" && styles.dailyRewardValueLocked,
                  ]}
                >
                  {reward.value}
                </Text>
                <Text
                  style={[
                    styles.dailyRewardDayLabel,
                    reward.state === "done" && styles.dailyRewardDayLabelDone,
                  ]}
                >
                  {`Day ${index + 1}`}
                </Text>
              </View>
            ))}
          </View>

          <Pressable
            disabled={isClaimingCheckIn || hasCheckedInToday}
            style={[
              styles.dailyCheckinButton,
              (isClaimingCheckIn || hasCheckedInToday) && styles.dailyCheckinButtonDisabled,
            ]}
            onPress={() => {
              void handleCheckInToday();
            }}
          >
            <Text style={styles.dailyCheckinButtonText}>
              {isClaimingCheckIn ? "Checking in..." : hasCheckedInToday ? "Checked in today" : "Check-in today"}
            </Text>
          </Pressable>
        </View>

        <View style={styles.supportWrapCard}>
          <View style={styles.supportHeader}>
            <Text style={styles.sectionEyebrow}>Support Space</Text>
            <Text style={styles.supportSectionTitle}>Choose what would help most today</Text>
            <Text style={styles.supportSectionBody}>Quick paths for journaling, calming down, or reaching support.</Text>
          </View>
          <View style={styles.supportList}>
            {supportShortcuts.map((card) => (
              <Pressable
                key={card.id}
                style={styles.supportListCard}
                onPress={() => handleSupportCardPress(card.id)}
              >
                <View style={[styles.supportListIconWrap, { backgroundColor: card.backgroundColor, borderColor: `${card.accentColor}22` }]}>
                  <Ionicons name={card.icon} size={20} color={card.accentColor} />
                </View>
                <View style={styles.supportListTextWrap}>
                  <Text style={styles.supportListTitle}>{card.title}</Text>
                  <Text style={styles.supportListDescription}>{card.description}</Text>
                </View>
                <View style={styles.supportListArrow}>
                  <Ionicons name="chevron-forward" size={18} color="#4B5F4C" />
                </View>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.recentCard}>
          <View style={styles.recentHeader}>
            <View style={styles.recentHeaderTextWrap}>
              <Text style={styles.sectionEyebrow}>Journal</Text>
              <Text style={styles.recentTitle}>Recent Entries</Text>
              <Text style={styles.recentSubtitle}>A quick look at the moments you captured most recently.</Text>
            </View>
            <Pressable style={styles.recentFilterButton} onPress={() => setShowRecentEntriesFilterModal(true)} accessibilityLabel="Sort today's entries">
              <Ionicons name="funnel-outline" size={16} color="#3F4A56" />
            </Pressable>
          </View>

          <View style={[styles.recentListWrap, { height: recentListHeight }]}>
            <ScrollView
              style={styles.recentList}
              contentContainerStyle={styles.recentListContent}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled
            >
              {displayedRecentEntries.length > 0 ? (
                displayedRecentEntries.map((entry) => (
                  <Pressable key={entry.id} style={styles.entryItem} onPress={() => router.push(`/journal-entry-view?entryId=${entry.id}`)}>
                    <View style={styles.entryIconWrap}>
                      <Text style={styles.entryIcon}>{"\uD83D\uDCD6"}</Text>
                    </View>

                    <View style={styles.entryTextWrap}>
                      <Text style={styles.entryMeta}>{entry.meta}</Text>
                      <Text style={styles.entryPreview} numberOfLines={2}>
                        {entry.preview}
                      </Text>
                    </View>
                  </Pressable>
                ))
              ) : (
                <View style={styles.entryItem}>
                  <View style={styles.entryIconWrap}>
                    <Text style={styles.entryIcon}>{"\uD83D\uDCD6"}</Text>
                  </View>

                  <View style={styles.entryTextWrap}>
                    <Text style={styles.entryMeta}>No entries for today</Text>
                    <Text style={styles.entryPreview} numberOfLines={2}>
                      Today&apos;s journal entries will appear here.
                    </Text>
                  </View>
                </View>
              )}
            </ScrollView>

            <Pressable
              style={styles.addEntryButton}
              accessibilityLabel="Add entry"
              onPress={() => router.push("/write-entry?mode=new")}
            >
              <Ionicons name="add" size={30} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>

      </ScrollView>

      <Modal
        visible={showWelcomeModal}
        transparent
        animationType="none"
        onRequestClose={handleDismissWelcomeModal}
      >
        <View style={styles.welcomeBackdrop}>
          <Animated.View
            style={[
              styles.welcomeCard,
              {
                opacity: welcomeOpacity,
                transform: [{ translateY: welcomeTranslateY }, { scale: welcomeScale }],
              },
            ]}
          >
            <Text style={styles.welcomeTitle}>
              The talas are always here{"\n"}when you are ready.{"\n"}Welcome back.
            </Text>

            <View style={styles.welcomeArtWrap}>
              <Animated.Image
                source={TALA_IMAGE}
                resizeMode="contain"
                style={[
                  styles.welcomeTalaLarge,
                  {
                    transform: [{ translateY: welcomeBigTranslateY }, { scale: welcomeBigScale }],
                  },
                ]}
              />
              <Animated.Image
                source={TALA_IMAGE}
                resizeMode="contain"
                style={[
                  styles.welcomeTalaSmall,
                  {
                    transform: [{ translateY: welcomeSmallTranslateY }, { scale: welcomeSmallScale }],
                  },
                ]}
              />
            </View>

            <Pressable style={styles.welcomeButton} onPress={handleDismissWelcomeModal}>
              <Text style={styles.welcomeButtonText}>Continue</Text>
            </Pressable>
          </Animated.View>
        </View>
      </Modal>

      <Modal
        visible={showCheckInResultModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCheckInResultModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalBody}>{checkInResultMessage}</Text>

            <View style={styles.modalActions}>
              <Pressable style={styles.modalPrimaryButtonSingle} onPress={() => setShowCheckInResultModal(false)}>
                <Text style={styles.modalPrimaryText}>OK</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showMoodConfirmModal}
        transparent
        animationType="fade"
        onRequestClose={handleCancelMoodConfirm}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalBody}>Save this as your mood for today?</Text>

            <View style={styles.modalActions}>
              <Pressable style={styles.modalSecondaryButton} onPress={handleCancelMoodConfirm}>
                <Text style={styles.modalSecondaryText}>Cancel</Text>
              </Pressable>

              <Pressable
                style={styles.modalPrimaryButton}
                onPress={() => {
                  void handleConfirmMood();
                }}
              >
                <Text style={styles.modalPrimaryText}>Confirm</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showRecentEntriesFilterModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRecentEntriesFilterModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalBody}>Sort today&apos;s entries</Text>

            <View style={styles.filterModalList}>
              <Pressable
                style={[
                  styles.filterModalOption,
                  recentEntriesSort === "newest" && styles.filterModalOptionActive,
                ]}
                onPress={() => {
                  setRecentEntriesSort("newest");
                  setShowRecentEntriesFilterModal(false);
                }}
              >
                <Text
                  style={[
                    styles.filterModalOptionText,
                    recentEntriesSort === "newest" && styles.filterModalOptionTextActive,
                  ]}
                >
                  Newest First
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.filterModalOption,
                  recentEntriesSort === "oldest" && styles.filterModalOptionActive,
                ]}
                onPress={() => {
                  setRecentEntriesSort("oldest");
                  setShowRecentEntriesFilterModal(false);
                }}
              >
                <Text
                  style={[
                    styles.filterModalOptionText,
                    recentEntriesSort === "oldest" && styles.filterModalOptionTextActive,
                  ]}
                >
                  Oldest First
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {showConsultOverlay ? (
        <View style={styles.consultOverlay} pointerEvents="box-none">
          <View style={styles.consultOverlayBackdrop} />

          <View style={styles.consultOverlayCard}>
            {upcomingAppointment?.counselor?.pictureUrl ? (
              <Image source={{ uri: upcomingAppointment.counselor.pictureUrl }} style={styles.consultAvatarImage} />
            ) : (
              <View style={styles.consultAvatarPlaceholder} />
            )}

            <Text style={styles.consultOverlayTitle}>Appointment Confirmed!</Text>
            <Text style={styles.consultOverlaySubtitle}>
              {upcomingAppointment
                ? `Your session with ${upcomingAppointment.counselor.fullName} is scheduled`
                : "Your counseling session is scheduled"}
            </Text>

            <View style={styles.consultInfoCard}>
              <Text style={styles.consultInfoText}>
                <Text style={styles.consultInfoLabel}>Date:</Text>{" "}
                {upcomingAppointment?.appointmentDateLabel || "Pending schedule"}
              </Text>
              <Text style={styles.consultInfoText}>
                <Text style={styles.consultInfoLabel}>Time:</Text> {upcomingAppointment?.slotLabel || "--"}
              </Text>
              <Text style={styles.consultInfoText}>
                <Text style={styles.consultInfoLabel}>Concern:</Text> {upcomingAppointment?.concern || "--"}
              </Text>
              <Text style={styles.consultInfoText}>
                <Text style={styles.consultInfoLabel}>Counselor:</Text>{" "}
                {upcomingAppointment?.counselor?.fullName || "Guidance Counselor"}
              </Text>
            </View>

            <Text style={styles.consultOverlayFootnote}>
              A confirmation has been sent. Please arrive 5 minutes early.
            </Text>

            <Pressable style={styles.consultOverlayButton} onPress={closeConsultOverlay}>
              <Text style={styles.consultOverlayButtonText}>Done</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <HomeBottomNav activeTab="home" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F7FAF6",
  },
  stickyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    zIndex: 20,
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
  },
  stickyHeaderTop: {
    backgroundColor: "transparent",
    borderBottomWidth: 0,
  },
  stickyHeaderScrolled: {
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E2E2",
  },
  contentScroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 12,
    paddingTop: 0,
    paddingBottom: 120,
  },
  quoteHero: {
    backgroundColor: "#B4D89A",
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 104,
    position: "relative",
    overflow: "hidden",
    marginHorizontal: -12,
    marginBottom: 14,
  },
  sectionEyebrow: {
    color: "#6E875A",
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  surfaceGlow: {
    position: "absolute",
    top: -26,
    right: -18,
    width: 120,
    height: 120,
    borderRadius: 999,
    backgroundColor: "rgba(210, 243, 178, 0.34)",
  },
  quoteHeroCompact: {
    paddingBottom: 92,
  },
  quoteHeroTiny: {
    paddingBottom: 80,
  },
  quoteHeroAtmosphere: {
    ...StyleSheet.absoluteFillObject,
  },
  quoteHeroGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 10,
  },
  avatarCircle: {
    width: 28,
    height: 28,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  avatarCircleTop: {
    borderColor: "#5E9550",
  },
  avatarCircleScrolled: {
    borderColor: "#5E9550",
  },
  greetingText: {
    fontSize: 33 / 2,
    lineHeight: 24,
    fontFamily: "Outfit",
  },
  greetingTextTop: {
    color: "#1E2F1F",
  },
  greetingTextScrolled: {
    color: "#1F1F1F",
  },
  userText: {
    fontFamily: "Outfit",
    fontWeight: "700",
  },
  userTextTop: {
    color: "#2E5722",
  },
  userTextScrolled: {
    color: "#2E5722",
  },
  headerActionButton: {
    padding: 6,
    marginRight: 2,
    marginTop: 2,
    position: "relative",
  },
  notificationDot: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 9,
    height: 9,
    borderRadius: 999,
    backgroundColor: "#F44343",
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
  },
  quoteHeroBody: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 212,
    paddingHorizontal: 24,
    zIndex: 2,
  },
  quoteTextWrap: {
    minHeight: 112,
    alignItems: "center",
    justifyContent: "center",
  },
  quoteWaveBase: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 40,
    backgroundColor: "#FFFFFF",
  },
  quoteWaveWrap: {
    position: "absolute",
    left: -48,
    right: -48,
    bottom: 0,
    height: 96,
  },
  quoteWaveShadeWrap: {
    position: "absolute",
    left: -48,
    right: -48,
    bottom: 20,
    height: 54,
  },
  quoteWaveLineWrap: {
    position: "absolute",
    left: -48,
    right: -48,
    bottom: 20,
    height: 52,
  },
  quoteText: {
    textAlign: "center",
    color: "#2F4257",
    fontSize: 20,
    lineHeight: 30,
    fontWeight: "700",
    maxWidth: 312,
    textShadowColor: "rgba(255,255,255,0.34)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 10,
  },
  quoteAuraBlob: {
    position: "absolute",
    opacity: 0.88,
  },
  quoteAuraBlobOne: {
    width: 232,
    height: 210,
    top: 20,
    left: -26,
  },
  quoteAuraBlobTwo: {
    width: 248,
    height: 224,
    top: 8,
    right: -38,
  },
  moodCard: {
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 14,
    shadowColor: "#66737E",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E6EEE7",
    overflow: "hidden",
  },
  moodHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  moodPetArt: {
    width: 86,
    height: 86,
    marginLeft: -8,
    marginRight: 4,
  },
  moodHeaderTextWrap: {
    flex: 1,
    paddingRight: 4,
  },
  moodHeading: {
    color: "#2F3946",
    fontSize: 43 / 2,
    lineHeight: 28,
    fontWeight: "700",
    marginBottom: 3,
  },
  moodSubHeading: {
    color: "#374A5D",
    fontSize: 36 / 2,
    lineHeight: 24,
  },
  moodRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  moodItem: {
    alignItems: "center",
    flex: 1,
  },
  moodButtonDisabled: {
    opacity: 0.42,
  },
  moodFace: {
    width: 54,
    height: 54,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
    borderWidth: 1,
    borderColor: "#A6B3BC",
  },
  moodFaceActive: {
    borderWidth: 2,
    borderColor: "#2F6F25",
  },
  moodIcon: {
    width: 42,
    height: 42,
  },
  moodLabel: {
    color: "#4A4A4A",
    fontSize: 15,
    lineHeight: 18,
  },
  moodLabelActive: {
    color: "#2F6F25",
    fontWeight: "700",
  },
  moodHistoryButton: {
    height: 40,
    borderRadius: 999,
    backgroundColor: "#70C943",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: "18%",
    shadowColor: "#6D6D6D",
    shadowOpacity: 0.16,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  moodHistoryButtonText: {
    color: "#FFFFFF",
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "700",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(21, 27, 24, 0.34)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 22,
  },
  welcomeBackdrop: {
    flex: 1,
    backgroundColor: "rgba(17, 22, 19, 0.38)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingBottom: 48,
  },
  welcomeCard: {
    width: "100%",
    maxWidth: 350,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 18,
    paddingTop: 26,
    paddingBottom: 24,
    alignItems: "center",
    shadowColor: "#48535B",
    shadowOpacity: 0.22,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  welcomeTitle: {
    color: "#1E1E1E",
    fontSize: 22,
    lineHeight: 31,
    fontFamily: "Outfit",
    fontWeight: "700",
    textAlign: "center",
  },
  welcomeArtWrap: {
    width: 228,
    height: 206,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    marginBottom: 16,
  },
  welcomeTalaLarge: {
    width: 168,
    height: 168,
  },
  welcomeTalaSmall: {
    width: 74,
    height: 74,
    position: "absolute",
    top: 20,
    right: 24,
  },
  welcomeButton: {
    width: "100%",
    minHeight: 46,
    borderRadius: 999,
    backgroundColor: "#70C943",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#60704F",
    shadowOpacity: 0.18,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  welcomeButtonText: {
    color: "#FFFFFF",
    fontSize: 19,
    lineHeight: 24,
    fontWeight: "700",
  },
  modalCard: {
    width: "100%",
    maxWidth: 320,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 16,
    shadowColor: "#525C67",
    shadowOpacity: 0.16,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  modalBody: {
    color: "#52606C",
    fontSize: 17,
    lineHeight: 24,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: "row",
    columnGap: 10,
  },
  modalSecondaryButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#CDD5C7",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  modalSecondaryText: {
    color: "#566271",
    fontSize: 13,
    fontWeight: "700",
  },
  modalPrimaryButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: 999,
    backgroundColor: "#79C943",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#60704F",
    shadowOpacity: 0.18,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  modalPrimaryButtonSingle: {
    flex: 1,
    minHeight: 40,
    borderRadius: 999,
    backgroundColor: "#79C943",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#60704F",
    shadowOpacity: 0.18,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  modalPrimaryText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  filterModalList: {
    rowGap: 8,
  },
  filterModalOption: {
    minHeight: 40,
    borderRadius: 12,
    backgroundColor: "#F6F8F5",
    alignItems: "center",
    justifyContent: "center",
  },
  filterModalOptionActive: {
    backgroundColor: "#DFF3CF",
  },
  filterModalOptionText: {
    color: "#566271",
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "600",
  },
  filterModalOptionTextActive: {
    color: "#2F6F25",
    fontWeight: "700",
  },
  dailyCheckinCard: {
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 14,
    shadowColor: "#66737E",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E6EEE7",
    overflow: "hidden",
  },
  dailyCheckinHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  dailyCheckinTitle: {
    color: "#34465A",
    fontSize: 25 / 2 * 2,
    lineHeight: 32,
    fontWeight: "700",
  },
  dailyTalaPill: {
    minWidth: 124,
    height: 40,
    borderRadius: 999,
    backgroundColor: "#FFF4A7",
    borderWidth: 1,
    borderColor: "#F1E595",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  dailyTalaPillIcon: {
    width: 18,
    height: 18,
    marginRight: 4,
  },
  dailyTalaPillText: {
    color: "#A58E26",
    fontSize: 21 / 2 * 2,
    lineHeight: 26,
    fontWeight: "700",
  },
  dailyRewardsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    columnGap: 4,
    marginBottom: 10,
  },
  dailyRewardBox: {
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "space-between",
    flexShrink: 0,
    borderWidth: 1,
    paddingTop: 8,
    paddingBottom: 6,
  },
  dailyRewardBoxDone: {
    backgroundColor: "#EEF1ED",
    borderColor: "transparent",
  },
  dailyRewardBoxActive: {
    backgroundColor: "#FFFFFF",
    borderColor: "#1F2328",
  },
  dailyRewardBoxLocked: {
    backgroundColor: "#FFFFFF",
    borderColor: "#A6B3BC",
  },
  dailyRewardDoneCircle: {
    backgroundColor: "#A1C4B3",
    alignItems: "center",
    justifyContent: "center",
  },
  dailyRewardTalaIcon: {
    marginTop: 2,
  },
  dailyRewardValue: {
    fontSize: 30 / 2,
    lineHeight: 20,
    fontWeight: "700",
  },
  dailyRewardValueDone: {
    color: "#BAC1C1",
  },
  dailyRewardValueActive: {
    color: "#1E1E1E",
  },
  dailyRewardValueLocked: {
    color: "#2E503C",
  },
  dailyRewardDayLabel: {
    color: "#526373",
    fontSize: 8,
    lineHeight: 10,
    fontWeight: "600",
  },
  dailyRewardDayLabelDone: {
    color: "#A0A8AA",
  },
  dailyCheckinButton: {
    height: 44,
    borderRadius: 999,
    backgroundColor: "#70C943",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: "16%",
    marginTop: 2,
    shadowColor: "#5C6570",
    shadowOpacity: 0.16,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  dailyCheckinButtonDisabled: {
    backgroundColor: "#A8C99C",
  },
  dailyCheckinButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "700",
  },
  recentCard: {
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 10,
    shadowColor: "#66737E",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E6EEE7",
  },
  recentHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  recentHeaderTextWrap: {
    flex: 1,
    paddingRight: 12,
  },
  recentTitle: {
    color: "#324254",
    fontSize: 37 / 2,
    lineHeight: 24,
    fontWeight: "700",
  },
  recentSubtitle: {
    color: "#607181",
    fontSize: 13,
    lineHeight: 18,
    marginTop: 3,
  },
  recentFilterButton: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: "#F5F8FB",
    borderWidth: 1,
    borderColor: "#E0E7EE",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  recentListWrap: {
    position: "relative",
    height: 454,
  },
  recentList: {
    flex: 1,
  },
  recentListContent: {
    paddingBottom: 76,
    rowGap: 10,
  },
  entryItem: {
    borderRadius: 14,
    backgroundColor: "#F6FFF0",
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 14,
    columnGap: 12,
    borderWidth: 1,
    borderColor: "#E1EED9",
  },
  entryIconWrap: {
    width: 68,
    height: 68,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5EBE0",
    alignItems: "center",
    justifyContent: "center",
  },
  entryIcon: {
    fontSize: 34,
    lineHeight: 36,
  },
  entryTextWrap: {
    flex: 1,
    paddingTop: 8,
  },
  entryMeta: {
    color: "#34465A",
    fontSize: 35 / 2,
    lineHeight: 24,
    fontWeight: "700",
    marginBottom: 4,
  },
  entryPreview: {
    color: "#2F3F52",
    fontSize: 33 / 2,
    lineHeight: 22,
  },
  addEntryButton: {
    position: "absolute",
    right: 10,
    bottom: 10,
    width: 56,
    height: 56,
    borderRadius: 999,
    backgroundColor: "#74B255",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#5C6570",
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  supportWrapCard: {
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 12,
    shadowColor: "#66737E",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
    borderWidth: 1,
    borderColor: "#E6EEE7",
  },
  supportHeader: {
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  supportSectionTitle: {
    color: "#304558",
    fontSize: 19,
    lineHeight: 24,
    fontWeight: "700",
    marginBottom: 3,
  },
  supportSectionBody: {
    color: "#607181",
    fontSize: 13,
    lineHeight: 18,
  },
  supportList: {
    rowGap: 10,
  },
  supportListCard: {
    minHeight: 76,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#D6E6CE",
    backgroundColor: "#F8FBF5",
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    columnGap: 12,
  },
  supportListIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  supportListTextWrap: {
    flex: 1,
  },
  supportListTitle: {
    color: "#2F4257",
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "700",
    marginBottom: 2,
  },
  supportListDescription: {
    color: "#506271",
    fontSize: 14,
    lineHeight: 18,
  },
  supportListArrow: {
    width: 28,
    height: 28,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.88)",
    alignItems: "center",
    justifyContent: "center",
  },
  consultOverlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 120,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingBottom: 64,
  },
  consultOverlayBackdrop: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "rgba(26, 30, 34, 0.28)",
  },
  consultOverlayCard: {
    width: "100%",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#D3D4D4",
    backgroundColor: "#F5F5F5",
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 14,
    shadowColor: "#5C6570",
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
    alignItems: "center",
  },
  consultAvatarPlaceholder: {
    width: 88,
    height: 88,
    borderRadius: 999,
    backgroundColor: "#D0D2D3",
    marginBottom: 12,
  },
  consultAvatarImage: {
    width: 88,
    height: 88,
    borderRadius: 999,
    marginBottom: 12,
    backgroundColor: "#D0D2D3",
  },
  consultOverlayTitle: {
    color: "#32475B",
    fontSize: 44 / 2,
    lineHeight: 30,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 4,
  },
  consultOverlaySubtitle: {
    color: "#3D5165",
    fontSize: 15,
    lineHeight: 20,
    textAlign: "center",
    marginBottom: 10,
  },
  consultInfoCard: {
    width: "100%",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#B5D8A7",
    backgroundColor: "#CDE6C3",
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
  },
  consultInfoText: {
    color: "#2F4356",
    fontSize: 15 / 1.02,
    lineHeight: 22,
  },
  consultInfoLabel: {
    fontWeight: "700",
  },
  consultOverlayFootnote: {
    color: "#68737E",
    fontSize: 12,
    lineHeight: 16,
    textAlign: "center",
    marginBottom: 10,
  },
  consultOverlayButton: {
    width: "92%",
    height: 44,
    borderRadius: 999,
    backgroundColor: "#70C943",
    alignItems: "center",
    justifyContent: "center",
  },
  consultOverlayButtonText: {
    color: "#FFFFFF",
    fontSize: 33 / 2,
    lineHeight: 22,
    fontWeight: "700",
  },
});
