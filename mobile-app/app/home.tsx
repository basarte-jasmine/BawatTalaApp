import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState, type ComponentProps } from "react";
import { Animated, Easing, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Defs, Ellipse, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import { HomeBottomNav } from "../components/home/HomeBottomNav";
import { useAuthSession } from "../lib/auth-session";
import {
  claimDailyCheckIn,
  fetchCheckInStatus,
  fetchDailyMood,
  fetchJournalEntriesByDate,
  fetchStudentAppointments,
  fetchStudentNotifications,
  saveDailyMood,
} from "../lib/backend-api";
import { EMOTIONS } from "../lib/emotions";
import { FEATURED_LIBRARY_BOOKS, LIBRARY_BOOKS } from "../lib/library-data";
import { getManilaTodayParts } from "../lib/manila-date";

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

type BottleDeliveryOption = {
  days: number;
  id: string;
  label: string;
};

type ScheduledBottleNote = {
  deliveryDateLabel: string;
  deliveryId: string;
  deliveryLabel: string;
  message: string;
};

type DriftingBottleNote = {
  baseRotate: string;
  delay: number;
  duration: number;
  endOffset: number;
  id: string;
  initialProgress: number;
  message: string;
  opacity: number;
  scale: number;
  sender: string;
  startOffset: number;
  top: number;
};

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

const BOTTLE_DELIVERY_OPTIONS: BottleDeliveryOption[] = [
  { id: "one-week", label: "1 Week", days: 7 },
  { id: "one-month", label: "1 Month", days: 30 },
  { id: "three-months", label: "3 Months", days: 90 },
  { id: "one-year", label: "1 Year", days: 365 },
];

const TALA_IMAGE = require("../assets/images/Tala_Star.png");
const MUNI_IMAGE = require("../assets/images/MUNI_default.png");
const ISLAND_IMAGE = require("../assets/images/island_sample.png");
const BOTTLE_IMAGE = require("../assets/images/bottle_sample.png");

const DRIFTING_BOTTLE_NOTES: DriftingBottleNote[] = [
  {
    baseRotate: "-18deg",
    delay: 0,
    duration: 12800,
    endOffset: -124,
    id: "shore-note-1",
    initialProgress: 0.18,
    opacity: 0.94,
    scale: 1,
    startOffset: 36,
    top: 132,
    sender: "From another shore",
    message: "You do not have to feel ready to begin again. Starting gently is enough.",
  },
  {
    baseRotate: "14deg",
    delay: 2100,
    duration: 15200,
    endOffset: -146,
    id: "shore-note-2",
    initialProgress: 0.61,
    opacity: 0.72,
    scale: 0.86,
    startOffset: 112,
    top: 214,
    sender: "A drifting note",
    message: "I wrote this on a hard day. If you found it, I hope tomorrow feels softer for you.",
  },
  {
    baseRotate: "-28deg",
    delay: 4700,
    duration: 17600,
    endOffset: -96,
    id: "shore-note-3",
    initialProgress: 0.33,
    opacity: 0.58,
    scale: 0.74,
    startOffset: 74,
    top: 312,
    sender: "From a quiet wave",
    message: "Small wins count. I made tea, breathed, and stayed. That became my brave thing today.",
  },
  {
    baseRotate: "22deg",
    delay: 1200,
    duration: 14200,
    endOffset: -138,
    id: "shore-note-4",
    initialProgress: 0.82,
    opacity: 0.88,
    scale: 0.92,
    startOffset: 148,
    top: 166,
    sender: "A note from the tide",
    message: "Rest counted today too. I hope whoever finds this remembers that softness is still strength.",
  },
  {
    baseRotate: "-10deg",
    delay: 3600,
    duration: 16600,
    endOffset: -110,
    id: "shore-note-5",
    initialProgress: 0.49,
    opacity: 0.64,
    scale: 0.8,
    startOffset: 12,
    top: 262,
    sender: "Across the sea",
    message: "You are allowed to outgrow the version of you that only knew how to survive.",
  },
  {
    baseRotate: "28deg",
    delay: 6200,
    duration: 18800,
    endOffset: -154,
    id: "shore-note-6",
    initialProgress: 0.08,
    opacity: 0.5,
    scale: 0.7,
    startOffset: 196,
    top: 388,
    sender: "From another player",
    message: "I wrote this after a long day: I am still here, and that is already something worth keeping.",
  },
];

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
  const libraryCompact = width < 380;
  const frameWidth = Math.min(width, 412);
  const headerHeight = tiny ? 58 : 62;
  const islandSceneHeight = tiny ? 218 : compact ? 238 : 256;
  const waterSceneHeight = Math.max(520, Math.round(height * 0.95));
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
  const [bottomNavTransparent, setBottomNavTransparent] = useState(false);
  const [showConsultOverlay, setShowConsultOverlay] = useState(false);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [showBottleModal, setShowBottleModal] = useState(false);
  const [selectedDriftingBottle, setSelectedDriftingBottle] = useState<DriftingBottleNote | null>(null);
  const [bottleDraft, setBottleDraft] = useState("");
  const [selectedBottleDeliveryId, setSelectedBottleDeliveryId] = useState(BOTTLE_DELIVERY_OPTIONS[1].id);
  const [scheduledBottleNote, setScheduledBottleNote] = useState<ScheduledBottleNote | null>(null);
  const [waterZoneStartY, setWaterZoneStartY] = useState<number | null>(null);
  const [quoteIndex, setQuoteIndex] = useState(0);
  const [upcomingAppointment, setUpcomingAppointment] = useState<Awaited<ReturnType<typeof fetchStudentAppointments>>["upcomingAppointment"]>(null);
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false);
  const headerSwitchOn = tiny ? 188 : compact ? 208 : 236;
  const headerSwitchOff = tiny ? 154 : compact ? 174 : 202;
  const idleValues = useRef(EMOTIONS.map(() => new Animated.Value(0))).current;
  const pressScales = useRef(EMOTIONS.map(() => new Animated.Value(1))).current;
  const waveDrift = useRef(new Animated.Value(0)).current;
  const welcomeOpacity = useRef(new Animated.Value(0)).current;
  const welcomeScale = useRef(new Animated.Value(0.92)).current;
  const welcomeTranslateY = useRef(new Animated.Value(22)).current;
  const welcomeStarMotion = useRef(new Animated.Value(0)).current;
  const welcomeHandledRef = useRef(false);
  const scrollOffsetYRef = useRef(0);
  const quoteOpacity = useRef(new Animated.Value(1)).current;
  const quoteTranslateY = useRef(new Animated.Value(0)).current;
  const quoteScale = useRef(new Animated.Value(1)).current;
  const quoteAuraDrift = useRef(new Animated.Value(0)).current;
  const quoteAuraPulse = useRef(new Animated.Value(0)).current;
  const driftingBottleProgressRef = useRef<Animated.Value[]>([]);
  while (driftingBottleProgressRef.current.length < DRIFTING_BOTTLE_NOTES.length) {
    driftingBottleProgressRef.current.push(new Animated.Value(0));
  }
  if (driftingBottleProgressRef.current.length > DRIFTING_BOTTLE_NOTES.length) {
    driftingBottleProgressRef.current = driftingBottleProgressRef.current.slice(0, DRIFTING_BOTTLE_NOTES.length);
  }
  const driftingBottleProgress = driftingBottleProgressRef.current;
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
    const loops = driftingBottleProgress.map((value, index) => {
      const note = DRIFTING_BOTTLE_NOTES[index];
      value.setValue(note.initialProgress);
      const loop = Animated.loop(
        Animated.sequence([
          Animated.delay(note.delay),
          Animated.timing(value, {
            toValue: 1,
            duration: note.duration,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: 0,
            duration: 0,
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
  }, [driftingBottleProgress]);

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

    const result = await fetchJournalEntriesByDate(user.studentNumber, getManilaTodayParts().isoDate);
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
    scrollOffsetYRef.current = offsetY;
    setHasScrolled((currentHasScrolled) => {
      if (currentHasScrolled) return offsetY > headerSwitchOff;
      return offsetY > headerSwitchOn;
    });

    setBottomNavTransparent(
      waterZoneStartY !== null && offsetY + height - 64 >= waterZoneStartY,
    );
  };

  const handleWaterSceneLayout = (sceneTopY: number) => {
    const nextWaterZoneStartY = sceneTopY + islandSceneHeight;
    setWaterZoneStartY(nextWaterZoneStartY);
    setBottomNavTransparent(scrollOffsetYRef.current + height - 64 >= nextWaterZoneStartY);
  };

  const closeConsultOverlay = () => {
    setShowConsultOverlay(false);
    router.replace("/home");
  };

  const handleDismissWelcomeModal = () => {
    setShowWelcomeModal(false);
  };

  const getBottleDeliveryDateLabel = (days: number) => {
    const deliveryDate = new Date();
    deliveryDate.setDate(deliveryDate.getDate() + days);
    return deliveryDate.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  const openBottleModal = () => {
    if (scheduledBottleNote) {
      setBottleDraft(scheduledBottleNote.message);
      setSelectedBottleDeliveryId(scheduledBottleNote.deliveryId);
    }
    setShowBottleModal(true);
  };

  const closeBottleModal = () => {
    setShowBottleModal(false);
    setBottleDraft("");
    setSelectedBottleDeliveryId(BOTTLE_DELIVERY_OPTIONS[1].id);
  };

  const handleSaveBottleNote = () => {
    const trimmedMessage = bottleDraft.trim();
    const selectedOption = BOTTLE_DELIVERY_OPTIONS.find((option) => option.id === selectedBottleDeliveryId);

    if (!trimmedMessage || !selectedOption) {
      return;
    }

    setScheduledBottleNote({
      message: trimmedMessage,
      deliveryId: selectedOption.id,
      deliveryLabel: selectedOption.label,
      deliveryDateLabel: getBottleDeliveryDateLabel(selectedOption.days),
    });
    closeBottleModal();
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

  const handleOpenLibrary = () => {
    router.push("/library");
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
  const seaWaveTranslate = waveDrift.interpolate({
    inputRange: [0, 1],
    outputRange: [-44, 44],
  });
  const seaWaveTranslateReverse = waveDrift.interpolate({
    inputRange: [0, 1],
    outputRange: [28, -28],
  });
  const driftingBottleBob = waveDrift.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, -10, 0],
  });
  const driftingBottleBobReverse = waveDrift.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 8, 0],
  });
  const driftingBottleTilt = waveDrift.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ["-4deg", "3deg", "-4deg"],
  });
  const driftingBottleTiltReverse = waveDrift.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ["3deg", "-3deg", "3deg"],
  });
  const driftingBottleTravelDistance = frameWidth + 168;
  const selectedBottleDeliveryOption =
    BOTTLE_DELIVERY_OPTIONS.find((option) => option.id === selectedBottleDeliveryId) ?? BOTTLE_DELIVERY_OPTIONS[1];
  const bottleDraftLength = bottleDraft.trim().length;
  const isBottleDraftReady = bottleDraftLength > 0;

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
              <Path d="M-12,146 C56,104 118,104 188,136 C256,168 330,170 424,122 L424,260 L-12,260 Z" fill="rgba(121, 198, 130, 0.12)" />
              <Path d="M-6,92 C58,70 126,116 190,92 C262,66 326,48 420,76" stroke="rgba(255,255,255,0.14)" strokeWidth={20} fill="none" />
              <Path d="M-20,166 C52,146 126,150 202,172 C286,196 344,196 432,160" stroke="rgba(255,255,255,0.12)" strokeWidth={10} fill="none" />
              <Path d="M18,122 C72,138 124,118 178,132 C232,146 282,168 342,156" stroke="rgba(121, 198, 130, 0.2)" strokeWidth={3} fill="none" />
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
              <Text style={styles.sectionEyebrow}>Emotions</Text>
              <Text style={styles.moodHeading}>What emotions are showing up today?</Text>
              <Text style={styles.moodSubHeading}>Track your emotions to notice patterns</Text>
            </View>
          </View>

          <View style={styles.moodRow}>
            {EMOTIONS.map((mood, index) => (
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
                    {mood.image ? (
                      <Image source={mood.image} style={styles.moodIcon} resizeMode="contain" />
                    ) : (
                      <View style={styles.moodIconPlaceholder} />
                    )}
                  </Animated.View>
                </Pressable>
                <Text style={[styles.moodLabel, selectedMoodId === mood.id && styles.moodLabelActive]} numberOfLines={2}>
                  {mood.label}
                </Text>
              </View>
            ))}
          </View>

          <Pressable style={styles.moodHistoryButton} onPress={() => router.push("/mood-overview")}>
            <Text style={styles.moodHistoryButtonText}>Emotion History</Text>
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
              <Text style={styles.recentTitle}>Today&apos;s Entries</Text>
              <Text style={styles.recentSubtitle}>Everything you wrote today appears here.</Text>
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
          </View>
        </View>

        <View style={styles.libraryCard}>
          <View style={styles.surfaceGlow} />
          <View style={styles.libraryAuraOne} />
          <View style={styles.libraryAuraTwo} />
          <View style={[styles.libraryHeroRow, libraryCompact && styles.libraryHeroRowStacked]}>
            <View style={[styles.libraryHeroTextWrap, libraryCompact && styles.libraryHeroTextWrapStacked]}>
              <Text style={styles.sectionEyebrow}>Reading Room</Text>
              <Text style={[styles.libraryTitle, libraryCompact && styles.libraryTitleCompact]}>Slip into the library when you want something quieter.</Text>
              <Text style={[styles.librarySubtitle, libraryCompact && styles.librarySubtitleCompact]}>
                Short, calming reads with a page-by-page reader that feels closer to opening a real book.
              </Text>
            </View>

            <View style={[styles.libraryShelfScene, libraryCompact && styles.libraryShelfSceneStacked]}>
              <View style={styles.libraryShelfLine} />
              <View style={[styles.librarySpine, styles.librarySpineTall, { backgroundColor: "#D9B983" }]} />
              <View style={[styles.librarySpine, styles.librarySpineMid, { backgroundColor: "#A8C79F" }]} />
              <View style={[styles.librarySpine, styles.librarySpineShort, { backgroundColor: "#D4A5A5" }]} />
            </View>
          </View>

          <View style={styles.libraryMetaRow}>
            <View style={styles.libraryMetaPill}>
              <Ionicons name="book-outline" size={15} color="#4A7A33" />
              <Text style={styles.libraryMetaPillText}>{`${LIBRARY_BOOKS.length} books waiting`}</Text>
            </View>
          </View>

          <View style={[styles.libraryShelfRow, libraryCompact && styles.libraryShelfRowStacked]}>
            {FEATURED_LIBRARY_BOOKS.slice(0, 2).map((book) => (
              <Pressable
                key={book.id}
                style={[styles.libraryBookChip, libraryCompact && styles.libraryBookChipStacked, { borderLeftColor: book.accentColor }]}
                onPress={handleOpenLibrary}
              >
                <Text style={styles.libraryBookChipCategory}>{book.category}</Text>
                <Text style={styles.libraryBookChipTitle} numberOfLines={2}>{book.title}</Text>
                <Text style={styles.libraryBookChipMeta}>{`${book.estimatedMinutes} min read`}</Text>
              </Pressable>
            ))}
          </View>

          <Pressable style={styles.libraryPrimaryButton} onPress={handleOpenLibrary}>
            <Text style={styles.libraryPrimaryButtonText}>Open Library</Text>
            <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
          </Pressable>
        </View>

        <View
          style={styles.futureBottleScene}
          onLayout={(event) => handleWaterSceneLayout(event.nativeEvent.layout.y)}
        >
          <View style={styles.futureBottleScenePressable}>
            <View style={[styles.futureBottleSceneSky, { minHeight: islandSceneHeight }]}>
              <View style={styles.futureBottleSkyFill} />
              <View style={styles.futureBottleSkyBlobOne} />
              <View style={styles.futureBottleSkyBlobTwo} />
              <View style={styles.futureBottleTopGlow} />
              <Svg width="100%" height="100%" viewBox="0 0 412 112" preserveAspectRatio="none" style={styles.futureBottleSceneTopBlend}>
                <Defs>
                  <LinearGradient id="shoreTopBlend" x1="0%" y1="0%" x2="0%" y2="100%">
                    <Stop offset="0%" stopColor="#F7FAF6" stopOpacity={1} />
                    <Stop offset="78%" stopColor="#F7FAF6" stopOpacity={0.22} />
                    <Stop offset="100%" stopColor="#F7FAF6" stopOpacity={0} />
                  </LinearGradient>
                </Defs>
                <Path d="M0,0 H412 V16 C348,42 266,16 188,34 C108,52 44,48 0,28 Z" fill="#F7FAF6" />
                <Path d="M0,0 H412 V74 C344,104 264,70 182,82 C104,94 38,92 0,80 Z" fill="url(#shoreTopBlend)" />
              </Svg>

              <View style={styles.futureBottleInfoCard}>
                <Text style={[styles.sectionEyebrow, styles.futureBottleEyebrow]}>Future Self</Text>
                <Text style={styles.futureBottleInfoTitle}>Message in a Bottle</Text>
                <Text style={styles.futureBottleInfoSubtitle}>
                  Leave a note for later and let it drift back to you.
                </Text>
              </View>
            </View>

            <Pressable
              style={[styles.futureBottleIslandButton, { top: islandSceneHeight - 66 }]}
              onPress={openBottleModal}
              accessibilityLabel="Open future self message"
            >
              <Image source={ISLAND_IMAGE} style={styles.futureBottleIslandArt} resizeMode="contain" />
            </Pressable>
            
            {scheduledBottleNote ? <View style={[styles.futureBottleNoteGlow, { top: islandSceneHeight + 8 }]} /> : null}

            <View style={[styles.futureBottleWaterScene, { minHeight: waterSceneHeight }]}>
              <Svg width="100%" height="100%" viewBox="0 0 412 620" preserveAspectRatio="none" style={styles.futureBottleWaterGradient}>
                <Defs>
                  <LinearGradient id="shoreWater" x1="0%" y1="0%" x2="0%" y2="100%">
                    <Stop offset="0%" stopColor="#6DD1D9" />
                    <Stop offset="34%" stopColor="#55B9C6" />
                    <Stop offset="100%" stopColor="#377FA8" />
                  </LinearGradient>
                </Defs>
                <Rect x="0" y="0" width="412" height="620" fill="url(#shoreWater)" />
                <Ellipse cx="70" cy="112" rx="96" ry="38" fill="rgba(202, 248, 250, 0.16)" />
                <Ellipse cx="314" cy="208" rx="132" ry="48" fill="rgba(205, 248, 251, 0.12)" />
                <Ellipse cx="216" cy="436" rx="198" ry="78" fill="rgba(124, 214, 227, 0.12)" />
              </Svg>

              <Animated.View style={[styles.futureBottleWaterWaveFill, { transform: [{ translateX: seaWaveTranslate }] }]}>
                <Svg width="100%" height="104" viewBox="0 0 412 104" preserveAspectRatio="none">
                  <Path
                    d="M0,42 C44,8 102,66 164,38 C226,10 288,8 348,28 C372,36 392,44 412,38 L412,104 L0,104 Z"
                    fill="rgba(227, 252, 255, 0.32)"
                  />
                </Svg>
              </Animated.View>

              <Animated.View style={[styles.futureBottleWaterWaveLine, { transform: [{ translateX: seaWaveTranslateReverse }] }]}>
                <Svg width="100%" height="70" viewBox="0 0 412 70" preserveAspectRatio="none">
                  <Path
                    d="M0,30 C54,6 118,48 188,24 C256,2 324,12 412,32"
                    stroke="rgba(239,255,255,0.72)"
                    strokeWidth={4}
                    fill="none"
                  />
                </Svg>
              </Animated.View>

              <Animated.View style={[styles.futureBottleWaterWaveSoft, { transform: [{ translateX: seaWaveTranslate }] }]}>
                <Svg width="100%" height="90" viewBox="0 0 412 90" preserveAspectRatio="none">
                  <Path
                    d="M0,40 C78,62 128,12 198,34 C272,56 336,60 412,40"
                    stroke="rgba(255,255,255,0.22)"
                    strokeWidth={12}
                    fill="none"
                  />
                </Svg>
              </Animated.View>

              {DRIFTING_BOTTLE_NOTES.map((note, index) => (
                <Animated.View
                  key={note.id}
                  style={[
                    styles.driftingBottleWrap,
                    {
                      top: note.top,
                      opacity: note.opacity,
                      transform: [
                        {
                          translateX: driftingBottleProgress[index].interpolate({
                            inputRange: [0, 1],
                            outputRange: [driftingBottleTravelDistance + note.startOffset, note.endOffset],
                          }),
                        },
                        { rotate: note.baseRotate },
                        { scale: note.scale },
                      ],
                    },
                  ]}
                >
                  <Animated.View
                    style={{
                      transform: [
                        { translateY: index % 2 === 0 ? driftingBottleBob : driftingBottleBobReverse },
                        { rotate: index % 2 === 0 ? driftingBottleTilt : driftingBottleTiltReverse },
                      ],
                    }}
                  >
                    <Pressable
                      style={styles.driftingBottleButton}
                      onPress={() => setSelectedDriftingBottle(note)}
                      accessibilityLabel={`Open drifting letter: ${note.sender}`}
                    >
                      <Image source={BOTTLE_IMAGE} style={styles.driftingBottleImage} resizeMode="contain" />
                    </Pressable>
                  </Animated.View>
                </Animated.View>
              ))}
            </View>
          </View>
        </View>

      </ScrollView>

      <Modal
        visible={Boolean(selectedDriftingBottle)}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedDriftingBottle(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.driftingBottleModalCard}>
            <View style={styles.driftingBottleModalHeader}>
              <View style={styles.driftingBottleModalTitleWrap}>
                <Text style={styles.driftingBottleModalEyebrow}>Shared letter</Text>
                <Text style={styles.driftingBottleModalTitle}>
                  {selectedDriftingBottle?.sender ?? "From another shore"}
                </Text>
              </View>

              <Pressable
                style={styles.bottleModalCloseButton}
                onPress={() => setSelectedDriftingBottle(null)}
                accessibilityLabel="Close drifting letter"
              >
                <Ionicons name="close" size={18} color="#52606C" />
              </Pressable>
            </View>

            <View style={styles.driftingBottleModalBody}>
              <Image source={BOTTLE_IMAGE} style={styles.driftingBottleModalImage} resizeMode="contain" />
              <Text style={styles.driftingBottleModalMessage}>
                {selectedDriftingBottle?.message ?? ""}
              </Text>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showBottleModal}
        transparent
        animationType="fade"
        onRequestClose={closeBottleModal}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.bottleModalCard}>
            <View style={styles.bottleModalHeader}>
              <View style={styles.bottleModalTextWrap}>
                <Text style={styles.bottleModalEyebrow}>For future you</Text>
                <Text style={styles.bottleModalTitle}>Set your bottle message</Text>
                <Text style={styles.bottleModalDescription}>
                  Write a note and choose when it should return to you.
                </Text>
              </View>

              <Pressable style={styles.bottleModalCloseButton} onPress={closeBottleModal} accessibilityLabel="Close bottle note">
                <Ionicons name="close" size={18} color="#52606C" />
              </Pressable>
            </View>

            <View style={styles.bottleInputCard}>
              <TextInput
                multiline
                maxLength={240}
                placeholder="Write something your future self may need to hear..."
                placeholderTextColor="#8DA0AF"
                style={styles.bottleInput}
                textAlignVertical="top"
                value={bottleDraft}
                onChangeText={setBottleDraft}
              />
              <Text style={styles.bottleCharacterCount}>{bottleDraftLength}/240</Text>
            </View>

            <Text style={styles.bottleOptionLabel}>When should it arrive?</Text>
            <View style={styles.bottleOptionGrid}>
              {BOTTLE_DELIVERY_OPTIONS.map((option) => (
                <Pressable
                  key={option.id}
                  style={[
                    styles.bottleOptionChip,
                    selectedBottleDeliveryId === option.id && styles.bottleOptionChipActive,
                  ]}
                  onPress={() => setSelectedBottleDeliveryId(option.id)}
                >
                  <Text
                    style={[
                      styles.bottleOptionChipText,
                      selectedBottleDeliveryId === option.id && styles.bottleOptionChipTextActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.bottleArrivalCard}>
              <Ionicons name="calendar-outline" size={16} color="#486151" />
              <Text style={styles.bottleArrivalCardText}>
                Arrives around <Text style={styles.bottleArrivalCardTextStrong}>{getBottleDeliveryDateLabel(selectedBottleDeliveryOption.days)}</Text>
              </Text>
            </View>

            <View style={styles.modalActions}>
              <Pressable style={styles.modalSecondaryButton} onPress={closeBottleModal}>
                <Text style={styles.modalSecondaryText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.modalPrimaryButton,
                  !isBottleDraftReady && styles.futureBottlePrimaryButtonDisabled,
                ]}
                onPress={handleSaveBottleNote}
                disabled={!isBottleDraftReady}
              >
                <Text style={styles.modalPrimaryText}>Set Delivery</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

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
            <Text style={styles.modalBody}>Save this as your emotion for today?</Text>

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

            <Text style={styles.consultOverlayTitle}>
              {String(upcomingAppointment?.status || "").toUpperCase() === "PENDING" ? "Appointment Request Sent!" : "Appointment Confirmed!"}
            </Text>
            <Text style={styles.consultOverlaySubtitle}>
              {upcomingAppointment
                ? String(upcomingAppointment.status || "").toUpperCase() === "PENDING"
                  ? `Your request with ${upcomingAppointment.counselor.fullName} is waiting for counselor confirmation`
                  : `Your session with ${upcomingAppointment.counselor.fullName} is scheduled`
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
              {String(upcomingAppointment?.status || "").toUpperCase() === "PENDING"
                ? "Your counselor has 24 hours to confirm, decline, or reschedule this request."
                : "A confirmation has been sent. Please arrive 5 minutes early."}
            </Text>

            <Pressable style={styles.consultOverlayButton} onPress={closeConsultOverlay}>
              <Text style={styles.consultOverlayButtonText}>Done</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <HomeBottomNav activeTab="home" transparent={bottomNavTransparent} />
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
    paddingBottom: 0,
  },
  quoteHero: {
    backgroundColor: "#B6DBA0",
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
    width: "100%",
    maxWidth: 336,
    paddingHorizontal: 16,
    paddingVertical: 16,
    zIndex: 2,
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
    color: "#31455A",
    fontSize: 20,
    lineHeight: 30,
    fontWeight: "700",
    maxWidth: 312,
    textShadowColor: "rgba(255,255,255,0.44)",
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
    flexWrap: "wrap",
    rowGap: 10,
    marginBottom: 10,
  },
  moodItem: {
    alignItems: "center",
    paddingHorizontal: 2,
    width: "20%",
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
  moodIconPlaceholder: {
    width: 42,
    height: 42,
  },
  moodLabel: {
    color: "#4A4A4A",
    fontSize: 13,
    lineHeight: 16,
    minHeight: 32,
    textAlign: "center",
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
  libraryCard: {
    borderRadius: 24,
    backgroundColor: "#FFF9F0",
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 14,
    marginBottom: 12,
    shadowColor: "#66737E",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
    borderWidth: 1,
    borderColor: "#EEE3D2",
    overflow: "hidden",
  },
  libraryAuraOne: {
    position: "absolute",
    top: -36,
    right: -14,
    width: 126,
    height: 126,
    borderRadius: 999,
    backgroundColor: "rgba(231, 214, 184, 0.34)",
  },
  libraryAuraTwo: {
    position: "absolute",
    left: -24,
    bottom: -46,
    width: 118,
    height: 118,
    borderRadius: 999,
    backgroundColor: "rgba(181, 213, 197, 0.22)",
  },
  libraryHeroRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    columnGap: 12,
    marginBottom: 12,
  },
  libraryHeroRowStacked: {
    flexDirection: "column",
  },
  libraryHeroTextWrap: {
    flex: 1,
    paddingRight: 4,
  },
  libraryHeroTextWrapStacked: {
    paddingRight: 0,
  },
  libraryTitle: {
    color: "#304558",
    fontSize: 18,
    lineHeight: 23,
    fontWeight: "700",
    marginBottom: 4,
  },
  libraryTitleCompact: {
    fontSize: 16,
    lineHeight: 21,
  },
  librarySubtitle: {
    color: "#6B7280",
    fontSize: 13,
    lineHeight: 18,
  },
  librarySubtitleCompact: {
    fontSize: 12,
    lineHeight: 17,
  },
  libraryShelfScene: {
    width: 86,
    height: 102,
    alignItems: "center",
    justifyContent: "center",
  },
  libraryShelfSceneStacked: {
    alignSelf: "center",
    marginTop: 4,
  },
  libraryShelfLine: {
    position: "absolute",
    bottom: 16,
    left: 6,
    right: 6,
    height: 8,
    borderRadius: 999,
    backgroundColor: "#D8C7AE",
  },
  librarySpine: {
    position: "absolute",
    bottom: 24,
    width: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(85, 90, 76, 0.12)",
  },
  librarySpineTall: {
    left: 14,
    height: 62,
  },
  librarySpineMid: {
    left: 34,
    height: 52,
  },
  librarySpineShort: {
    left: 55,
    height: 44,
  },
  libraryMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 12,
  },
  libraryMetaPill: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.76)",
    borderWidth: 1,
    borderColor: "#E8DCC8",
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  libraryMetaPillText: {
    color: "#5C675B",
    fontSize: 12,
    lineHeight: 15,
    fontWeight: "700",
  },
  libraryShelfRow: {
    flexDirection: "row",
    columnGap: 8,
    marginBottom: 12,
  },
  libraryShelfRowStacked: {
    flexDirection: "column",
    rowGap: 8,
  },
  libraryBookChip: {
    flex: 1,
    minHeight: 118,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.82)",
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 12,
    borderWidth: 1,
    borderColor: "#EEE2D2",
    borderLeftWidth: 6,
  },
  libraryBookChipStacked: {
    width: "100%",
    flex: 0,
  },
  libraryBookChipCategory: {
    color: "#6F845C",
    fontSize: 10,
    lineHeight: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  libraryBookChipTitle: {
    color: "#304558",
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "700",
    marginBottom: 6,
  },
  libraryBookChipMeta: {
    color: "#7A7F73",
    fontSize: 11,
    lineHeight: 14,
    marginTop: "auto",
  },
  libraryPrimaryButton: {
    minHeight: 44,
    borderRadius: 999,
    backgroundColor: "#70C943",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    columnGap: 8,
    shadowColor: "#5C6570",
    shadowOpacity: 0.16,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  libraryPrimaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    lineHeight: 20,
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
    paddingBottom: 8,
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
  futureBottleScene: {
    marginHorizontal: -12,
    marginTop: 10,
    overflow: "hidden",
  },
  futureBottleScenePressable: {
    overflow: "hidden",
    paddingTop: 0,
  },
  futureBottleSceneSky: {
    position: "relative",
    overflow: "hidden",
    backgroundColor: "#C8F0E8",
  },
  futureBottleSceneTopBlend: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
    top: 0,
    height: 112,
  },
  futureBottleCard: {
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    marginBottom: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E6EEE7",
    shadowColor: "#66737E",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  futureBottleHero: {
    position: "relative",
    justifyContent: "space-between",
    overflow: "hidden",
    backgroundColor: "#C8F0E8",
  },
  futureBottleSkyFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#C8F0E8",
  },
  futureBottleSkyBlobOne: {
    position: "absolute",
    width: 208,
    height: 208,
    borderRadius: 999,
    backgroundColor: "rgba(241, 255, 210, 0.42)",
    top: -84,
    right: -12,
  },
  futureBottleSkyBlobTwo: {
    position: "absolute",
    width: 168,
    height: 168,
    borderRadius: 999,
    backgroundColor: "rgba(143, 226, 209, 0.34)",
    top: 16,
    right: 46,
  },
  futureBottleIslandButton: {
    position: "absolute",
    alignSelf: "center",
    zIndex: 4,
    width: 256,
    height: 140,
  },
  futureBottleIslandArt: {
    width: "100%",
    height: "100%",
  },
  futureBottleTopGlow: {
    position: "absolute",
    top: -36,
    right: -22,
    width: 168,
    height: 168,
    borderRadius: 999,
    backgroundColor: "rgba(248, 255, 196, 0.55)",
  },
  futureBottleInfoCard: {
    marginTop: 28,
    marginLeft: 16,
    width: 204,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.58)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.56)",
    paddingHorizontal: 14,
    paddingVertical: 12,
    zIndex: 2,
  },
  futureBottleEyebrow: {
    color: "#5A7D53",
  },
  futureBottleInfoTitle: {
    color: "#2F4257",
    fontSize: 18,
    lineHeight: 23,
    fontWeight: "700",
    marginBottom: 2,
  },
  futureBottleInfoSubtitle: {
    color: "#5A6C7B",
    fontSize: 13,
    lineHeight: 18,
  },
  futureBottleNoteGlow: {
    position: "absolute",
    alignSelf: "center",
    width: 164,
    height: 42,
    borderRadius: 999,
    backgroundColor: "rgba(255, 250, 182, 0.28)",
    zIndex: 3,
  },
  futureBottleWaterScene: {
    position: "relative",
    overflow: "hidden",
    backgroundColor: "#5CBCCB",
    marginTop: -2,
  },
  futureBottleWaterGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  futureBottleWaterWaveFill: {
    position: "absolute",
    left: -52,
    right: -52,
    top: 6,
    height: 104,
  },
  futureBottleWaterWaveLine: {
    position: "absolute",
    left: -44,
    right: -44,
    top: 14,
    height: 70,
  },
  futureBottleWaterWaveSoft: {
    position: "absolute",
    left: -40,
    right: -40,
    top: 46,
    height: 90,
  },
  driftingBottleWrap: {
    position: "absolute",
    left: -78,
    zIndex: 5,
  },
  driftingBottleButton: {
    alignItems: "center",
    justifyContent: "center",
  },
  driftingBottleImage: {
    width: 62,
    height: 62,
  },
  driftingBottleModalCard: {
    width: "100%",
    maxWidth: 340,
    borderRadius: 24,
    backgroundColor: "#FFFDF6",
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 16,
    shadowColor: "#4F5963",
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  driftingBottleModalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    columnGap: 10,
    marginBottom: 14,
  },
  driftingBottleModalTitleWrap: {
    flex: 1,
  },
  driftingBottleModalEyebrow: {
    color: "#78916A",
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  driftingBottleModalTitle: {
    color: "#304558",
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "700",
  },
  driftingBottleModalBody: {
    borderRadius: 20,
    backgroundColor: "#FBFCF8",
    borderWidth: 1,
    borderColor: "#E7ECE2",
    paddingHorizontal: 16,
    paddingVertical: 16,
    alignItems: "center",
  },
  driftingBottleModalImage: {
    width: 74,
    height: 74,
    marginBottom: 10,
  },
  driftingBottleModalMessage: {
    color: "#344B5E",
    fontSize: 15,
    lineHeight: 23,
    textAlign: "center",
  },
  futureBottleBody: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 16,
  },
  futureBottleEmptyState: {
    rowGap: 14,
  },
  futureBottleEmptyCopy: {
    rowGap: 4,
  },
  futureBottleEmptyTitle: {
    color: "#304558",
    fontSize: 18,
    lineHeight: 23,
    fontWeight: "700",
  },
  futureBottleEmptyBody: {
    color: "#5D7080",
    fontSize: 14,
    lineHeight: 20,
  },
  futureBottlePrimaryButton: {
    minHeight: 44,
    borderRadius: 999,
    backgroundColor: "#70C943",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    columnGap: 8,
    shadowColor: "#5C6570",
    shadowOpacity: 0.16,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  futureBottlePrimaryButtonDisabled: {
    backgroundColor: "#A8C99C",
  },
  futureBottlePrimaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "700",
  },
  futureBottlePreviewCard: {
    borderRadius: 18,
    backgroundColor: "#F8FBF6",
    borderWidth: 1,
    borderColor: "#DCE9D9",
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 12,
  },
  futureBottlePreviewHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    columnGap: 12,
    marginBottom: 10,
  },
  futureBottlePreviewTextWrap: {
    flex: 1,
  },
  futureBottlePreviewEyebrow: {
    color: "#6F845C",
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  futureBottlePreviewDate: {
    color: "#304558",
    fontSize: 18,
    lineHeight: 23,
    fontWeight: "700",
  },
  futureBottleDeliveryPill: {
    borderRadius: 999,
    backgroundColor: "#EDF6E7",
    borderWidth: 1,
    borderColor: "#D7E9CF",
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    columnGap: 5,
  },
  futureBottleDeliveryPillText: {
    color: "#5A7A50",
    fontSize: 12,
    lineHeight: 15,
    fontWeight: "700",
  },
  futureBottlePreviewMessage: {
    color: "#2F4257",
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 12,
  },
  futureBottlePreviewFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    columnGap: 12,
  },
  futureBottlePreviewHint: {
    flex: 1,
    color: "#6B7B88",
    fontSize: 12,
    lineHeight: 16,
  },
  futureBottleEditButton: {
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D5E0E7",
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    columnGap: 6,
  },
  futureBottleEditButtonText: {
    color: "#355468",
    fontSize: 12,
    lineHeight: 15,
    fontWeight: "700",
  },
  memorySeaCard: {
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    marginBottom: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E6EEE7",
    shadowColor: "#66737E",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  memorySeaHero: {
    minHeight: 194,
    overflow: "hidden",
    backgroundColor: "#D7F3EE",
    position: "relative",
  },
  memorySeaHeroGlow: {
    position: "absolute",
    top: -34,
    right: -18,
    width: 164,
    height: 164,
    borderRadius: 999,
    backgroundColor: "rgba(248,255,197,0.58)",
  },
  memorySeaHeroGlowTwo: {
    position: "absolute",
    top: 26,
    right: 58,
    width: 148,
    height: 148,
    borderRadius: 999,
    backgroundColor: "rgba(115, 213, 203, 0.18)",
  },
  memorySeaWaterBand: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "37%",
    backgroundColor: "#66C5CB",
  },
  memorySeaWaveLine: {
    position: "absolute",
    left: -8,
    right: -8,
    bottom: 68,
    height: 28,
    borderRadius: 999,
    backgroundColor: "rgba(198, 247, 241, 0.26)",
  },
  memorySeaHeroTextWrap: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingRight: 88,
    maxWidth: 272,
    zIndex: 2,
  },
  memorySeaEyebrow: {
    color: "#5B7B59",
  },
  memorySeaTitle: {
    color: "#304558",
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "700",
    marginBottom: 6,
  },
  memorySeaSubtitle: {
    color: "#4E6778",
    fontSize: 13,
    lineHeight: 18,
    maxWidth: 210,
  },
  memorySeaBody: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 14,
  },
  memorySeaComingSoonCard: {
    borderRadius: 16,
    backgroundColor: "#F5FBFF",
    borderWidth: 1,
    borderColor: "#DCEAF0",
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    columnGap: 8,
  },
  memorySeaComingSoonText: {
    color: "#365368",
    fontSize: 15,
    lineHeight: 19,
    fontWeight: "700",
  },
  bottleModalCard: {
    width: "100%",
    maxWidth: 356,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 16,
    shadowColor: "#4F5963",
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  bottleModalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    columnGap: 10,
    marginBottom: 16,
  },
  bottleModalTextWrap: {
    flex: 1,
  },
  bottleModalEyebrow: {
    color: "#6D8758",
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  bottleModalTitle: {
    color: "#304558",
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "700",
    marginBottom: 4,
  },
  bottleModalDescription: {
    color: "#607181",
    fontSize: 14,
    lineHeight: 19,
  },
  bottleModalCloseButton: {
    width: 34,
    height: 34,
    borderRadius: 999,
    backgroundColor: "#F5F7F4",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E2E8E0",
  },
  bottleInputCard: {
    borderRadius: 18,
    backgroundColor: "#FBFCF8",
    borderWidth: 1,
    borderColor: "#DEE7D8",
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
    marginBottom: 14,
  },
  bottleInput: {
    minHeight: 118,
    color: "#314456",
    fontSize: 15,
    lineHeight: 22,
  },
  bottleCharacterCount: {
    alignSelf: "flex-end",
    color: "#91A0AB",
    fontSize: 11,
    lineHeight: 14,
    marginTop: 8,
  },
  bottleOptionLabel: {
    color: "#304558",
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "700",
    marginBottom: 10,
  },
  bottleOptionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 14,
  },
  bottleOptionChip: {
    minWidth: 72,
    borderRadius: 999,
    backgroundColor: "#F6F8F5",
    borderWidth: 1,
    borderColor: "#D6E1D0",
    paddingHorizontal: 12,
    paddingVertical: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  bottleOptionChipActive: {
    backgroundColor: "#E9F7DD",
    borderColor: "#89C95F",
  },
  bottleOptionChipText: {
    color: "#5E6F7E",
    fontSize: 13,
    lineHeight: 16,
    fontWeight: "600",
  },
  bottleOptionChipTextActive: {
    color: "#2F6F25",
    fontWeight: "700",
  },
  bottleArrivalCard: {
    borderRadius: 16,
    backgroundColor: "#F3FAEF",
    borderWidth: 1,
    borderColor: "#D4E8CB",
    paddingHorizontal: 12,
    paddingVertical: 11,
    flexDirection: "row",
    alignItems: "center",
    columnGap: 8,
    marginBottom: 16,
  },
  bottleArrivalCardText: {
    flex: 1,
    color: "#4F6473",
    fontSize: 13,
    lineHeight: 18,
  },
  bottleArrivalCardTextStrong: {
    color: "#355368",
    fontWeight: "700",
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
