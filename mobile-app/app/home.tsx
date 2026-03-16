import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Easing, Image, ImageSourcePropType, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
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
  backgroundColor: string;
  description: string;
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
    id: "support-1",
    title: "Quick Journal",
    description: "Write your entry for today",
    backgroundColor: "#B1DEB3",
  },
  {
    id: "support-2",
    title: "Wellness Tools",
    description: "Calm your mind and body with exercises.",
    backgroundColor: "#BDE0AA",
  },
  {
    id: "support-3",
    title: "Talk to Peer",
    description: "Connect with a trained student listener today.",
    backgroundColor: "#BDE0AA",
  },
  {
    id: "support-4",
    title: "Counseling",
    description: "Set up a private and safe session with guidance counselors.",
    backgroundColor: "#B1DEB3",
  },
];

const TALA_IMAGE = require("../assets/images/Tala_Star.png");
const MUNI_IMAGE = require("../assets/images/MUNI_default.png");

export default function HomeScreen() {
  const { user } = useAuthSession();
  const { height, width } = useWindowDimensions();
  const { consultConfirmed, appointmentId } = useLocalSearchParams<{ consultConfirmed?: string; appointmentId?: string }>();
  const compact = height < 760;
  const tiny = height < 680;
  const frameWidth = Math.min(width, 412);
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
  const [upcomingAppointment, setUpcomingAppointment] = useState<Awaited<ReturnType<typeof fetchStudentAppointments>>["upcomingAppointment"]>(null);
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false);
  const headerSwitchOn = 120;
  const headerSwitchOff = 120;
  const idleValues = useRef(MOODS.map(() => new Animated.Value(0))).current;
  const pressScales = useRef(MOODS.map(() => new Animated.Value(1))).current;
  const waveDrift = useRef(new Animated.Value(0)).current;

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
    if (consultConfirmed === "1") {
      setShowConsultOverlay(true);
    }
  }, [consultConfirmed]);

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
          <View style={styles.quoteHeroBody}>
            <Text style={styles.quoteText}>It&apos;s okay to not have it all figured out.</Text>
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
          <View style={styles.moodHeaderRow}>
            <Image source={MUNI_IMAGE} style={styles.moodPetArt} resizeMode="contain" />
            <View style={styles.moodHeaderTextWrap}>
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
          <View style={styles.supportGrid}>
            {SUPPORT_CARDS.map((card) => (
              <Pressable
                key={card.id}
                style={[styles.supportCard, { backgroundColor: card.backgroundColor }]}
                onPress={() => {
                  if (card.title === "Wellness Tools") {
                    router.push("/wellness-tools");
                    return;
                  }
                  if (card.title === "Quick Journal") {
                    router.push("/write-entry?mode=new");
                  }
                }}
              >
                <Image source={MUNI_IMAGE} style={styles.supportPetIcon} resizeMode="contain" />
                <Text style={styles.supportTitle}>{card.title}</Text>
                <Text style={styles.supportDescription}>{card.description}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.recentCard}>
          <View style={styles.recentHeader}>
            <Text style={styles.recentTitle}>Recent Entries</Text>
            <Pressable onPress={() => setShowRecentEntriesFilterModal(true)} accessibilityLabel="Sort today's entries">
              <Ionicons name="list" size={22} color="#3F4A56" />
            </Pressable>
          </View>

          <View style={styles.recentListWrap}>
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
    backgroundColor: "#FFFFFF",
  },
  stickyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    zIndex: 20,
  },
  stickyHeaderTop: {
    backgroundColor: "#B4D89A",
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
    paddingHorizontal: 10,
    paddingTop: 0,
    paddingBottom: 112,
  },
  quoteHero: {
    backgroundColor: "#B4D89A",
    paddingTop: 10,
    paddingHorizontal: 16,
    paddingBottom: 66,
    position: "relative",
    overflow: "hidden",
    marginHorizontal: -10,
    marginBottom: 10,
  },
  quoteHeroCompact: {
    paddingBottom: 60,
  },
  quoteHeroTiny: {
    paddingBottom: 54,
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
    minHeight: 112,
    paddingHorizontal: 24,
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
    fontSize: 33 / 2,
    lineHeight: 23,
    fontWeight: "700",
    maxWidth: 290,
  },
  moodCard: {
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 12,
    shadowColor: "#525C67",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
    marginBottom: 10,
  },
  moodHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
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
    marginBottom: 2,
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
    marginHorizontal: "20%",
    shadowColor: "#6D6D6D",
    shadowOpacity: 0.18,
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
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 14,
    shadowColor: "#525C67",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
    marginBottom: 10,
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
    backgroundColor: "#E4E180",
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
    backgroundColor: "#BFE5CB",
    borderColor: "#A7CDB5",
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
    shadowColor: "#5C6570",
    shadowOpacity: 0.2,
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
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 10,
    shadowColor: "#525C67",
    shadowOpacity: 0.16,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
    marginBottom: 10,
  },
  recentHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  recentTitle: {
    color: "#324254",
    fontSize: 37 / 2,
    lineHeight: 24,
    fontWeight: "700",
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
    borderRadius: 9,
    backgroundColor: "#F0FFE9",
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 14,
    columnGap: 12,
  },
  entryIconWrap: {
    width: 68,
    height: 68,
    borderRadius: 999,
    backgroundColor: "#EDEFEA",
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
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 10,
    paddingVertical: 10,
    marginBottom: 10,
    shadowColor: "#525C67",
    shadowOpacity: 0.16,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  supportGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 10,
  },
  supportCard: {
    width: "48.5%",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#A9CEA2",
    minHeight: 182,
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 8,
  },
  supportPetIcon: {
    width: 58,
    height: 58,
    marginBottom: 8,
    marginLeft: -3,
  },
  supportTitle: {
    color: "#2A3A2C",
    fontSize: 36 / 2,
    lineHeight: 25,
    fontWeight: "700",
    marginBottom: 2,
  },
  supportDescription: {
    color: "#2F4531",
    fontSize: 14,
    lineHeight: 24,
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
