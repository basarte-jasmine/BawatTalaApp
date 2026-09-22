import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuthSession } from "../lib/auth-session";
import { fetchStudentNotifications } from "../lib/backend-api";
import {
    getNotificationDetailTitle,
    getNotificationFallbackRoute,
    getNotificationVisual
} from "../lib/notification-utils";

const TALA_IMAGE = require("../assets/images/Tala_Star.png");
const MUNI_AVATAR = require("../assets/images/MUNI_default.png");

const ACHIEVEMENT_ILLUSTRATIONS: Record<string, any> = {
  "future-bottle": require("../assets/images/Achievements/A Bottle for Tomorrow.webp"),
  "a-gentler-first-step": require("../assets/images/Achievements/A gentler first step.webp"),
  "a-sky-with-many-colors": require("../assets/images/Achievements/A sky with many colors.webp"),
  "a-softer-minute": require("../assets/images/Achievements/A softer minute_.webp"),
  "asked-for-support": require("../assets/images/Achievements/Asked for support_.webp"),
  "dear-muni": require("../assets/images/Achievements/Dear Muni.webp"),
  "library-glow": require("../assets/images/Achievements/Library glow.webp"),
  "message-from-the-tide": require("../assets/images/Achievements/Message from the tide.webp"),
  "small-good-thing": require("../assets/images/Achievements/Small good thing.webp"),
  "star-shopper": require("../assets/images/Achievements/Star shopper.webp"),
  "voice-beneath-the-stars": require("../assets/images/Achievements/Voice beneath the stars.webp"),
};

const ACHIEVEMENT_DESCRIPTIONS: Record<string, string> = {
  "future-bottle": "Send a message toward your future.",
  "a-gentler-first-step": "Book your first peer counselor appointment.",
  "a-sky-with-many-colors": "Log every emotion at least once.",
  "a-softer-minute": "Complete one wellness exercise session.",
  "asked-for-support": "Book your first guidance counselor appointment.",
  "dear-muni": "Send your first journal message to Muni.",
  "library-glow": "Read in the library for 1 hour.",
  "message-from-the-tide": "Open a drifting bottle note.",
  "small-good-thing": "Save a journal entry with a positive tag.",
  "star-shopper": "Spend Tala in the Muni shop for the first time.",
  "voice-beneath-the-stars": "Complete your first Muni voice journal.",
};

const ACHIEVEMENT_STORIES: Record<string, string> = {
  "future-bottle": "You cast your hopes into the sea, trusting the waves to return them when the time is right.",
  "a-gentler-first-step": "Muni knows that reaching out takes real courage. You took the first step toward healing, and this island just got a little warmer because of you.",
  "a-sky-with-many-colors": "Muni has always believed that every feeling paints the sky a different color. You’ve felt them all—and that means you’re truly alive.",
  "a-softer-minute": "Muni noticed you stopped to breathe. In a world that never stops rushing, you chose to be still—and that’s something worth celebrating.",
  "asked-for-support": "Asking for help isn’t weakness—it’s wisdom. Muni is proud of you for trusting someone with your story.",
  "dear-muni": "Muni read your very first message and kept it safe among the stars. Every word you share matters more than you know.",
  "library-glow": "The library’s lanterns always glow brighter when someone reads for a whole hour. Muni saw the light from across the island!",
  "message-from-the-tide": "Muni is always wondering about the things floating in the sea… Well, can you tell Muni what is inside?",
  "small-good-thing": "Muni believes that noticing the good—even the smallest kind—is one of the bravest things a person can do.",
  "star-shopper": "Muni’s shop is full of surprises! You just unlocked your first treasure, and the island is sparkling a little more.",
  "voice-beneath-the-stars": "Your voice echoed across the island tonight. Muni listened to every word and kept it among the constellations.",
};

const ACHIEVEMENT_TRIVIA: Record<string, string> = {
  "future-bottle": "Muni says the island keeps every hopeful message until the right tide carries it onward.",
  "a-gentler-first-step": "Muni once heard that the bravest explorers are the ones who ask for a guide.",
  "a-sky-with-many-colors": "Muni believes emotions are signals from the sky, not storms to be hidden.",
  "a-softer-minute": "Muni once timed a cloud drifting by—it took exactly four breaths. Try it!",
  "asked-for-support": "On Muni’s island, asking for directions is how every great adventure begins.",
  "dear-muni": "Muni keeps every letter in a special shell—the ocean carries the words, but the feeling stays.",
  "library-glow": "Muni has read 347 books—but only counts the ones that made the lanterns flicker.",
  "message-from-the-tide": "Muni says the tide delivers only the messages the sea thinks you need to hear.",
  "small-good-thing": "Muni collects small good things in a jar by the lighthouse. The jar is almost full!",
  "star-shopper": "Muni’s favorite item in the shop is the one that hasn’t been discovered yet.",
  "voice-beneath-the-stars": "Muni’s favorite sound on the island is someone finally saying what they feel.",
};

export default function NotificationViewScreen() {
  const { id, createdAt, kind, message, timeLabel, title, metadata: metadataParam } = useLocalSearchParams<{
    id?: string;
    createdAt?: string;
    kind?: string;
    message?: string;
    timeLabel?: string;
    title?: string;
    metadata?: any;
  }>();
  const { user } = useAuthSession();
  const [loadedItem, setLoadedItem] = useState<{
    createdAt?: string;
    kind?: string;
    message?: string;
    timeLabel?: string;
    title?: string;
    metadata?: any;
  } | null>(null);
  const [loading, setLoading] = useState(!message && Boolean(id));

  useEffect(() => {
    if (message || !id || !user?.studentNumber) return;
    let isMounted = true;
    async function loadNotification() {
      try {
        setLoading(true);
        const res = await fetchStudentNotifications(user?.studentNumber || "");
        if (!isMounted) return;
        if (res.ok && Array.isArray(res.notifications)) {
          const found = res.notifications.find((n) => n.id === id);
          if (found) {
            setLoadedItem({
              createdAt: found.createdAt,
              kind: found.kind,
              message: found.message,
              timeLabel: found.timeLabel,
              title: found.title,
              metadata: found.metadata,
            });
          }
        }
      } catch {} finally {
        if (isMounted) setLoading(false);
      }
    }
    void loadNotification();
    return () => { isMounted = false; };
  }, [id, message, user?.studentNumber]);

  const activeKind = loadedItem?.kind || kind;
  const activeTitle = loadedItem?.title || title;
  const activeMessage = loadedItem?.message || message;
  const activeCreatedAt = loadedItem?.createdAt || createdAt;
  const activeTimeLabel = loadedItem?.timeLabel || timeLabel;

  const detailTitle = getNotificationDetailTitle(activeKind);
  const visual = getNotificationVisual(activeKind || "");

  const parsedMetadata = (() => {
    if (loadedItem?.metadata) return loadedItem.metadata;
    if (!metadataParam) return {};
    try { return JSON.parse(metadataParam as string); } catch { return {}; }
  })();

  const isAchievement = visual.isAchievement === true;
  const achievementId = parsedMetadata?.achievementId || parsedMetadata?.achievementKey || "";
  const illustration = parsedMetadata?.illustration || parsedMetadata?.imageUrl || parsedMetadata?.image;
  const localIllustration = achievementId ? ACHIEVEMENT_ILLUSTRATIONS[achievementId] : null;
  const achievementTitle = String(parsedMetadata?.achievementTitle || activeTitle || detailTitle)
    .replace(/\s+unlocked!?\s*$/i, "")
    .trim();
  const achievementDescription = ACHIEVEMENT_DESCRIPTIONS[achievementId] || "A small moment worth celebrating.";
  const achievementStory = ACHIEVEMENT_STORIES[achievementId] || "Muni is always noticing little stories hidden around the island. This one is yours to keep.";

  const { mainBody, triviaText } = (() => {
    const raw = activeMessage || "";
    if (parsedMetadata?.trivia) {
      const triviaFromMeta = String(parsedMetadata.trivia).trim();
      const cleaned = raw.replace(/Muni\s+trivia\s*:?\s*/i, "").replace(triviaFromMeta, "").trim();
      return { mainBody: cleaned || raw, triviaText: triviaFromMeta };
    }
    const triviaMatch = raw.match(/Muni\s+trivia\s*:?\s*([\s\S]+)/i);
    if (triviaMatch) {
      const beforeTrivia = raw.slice(0, triviaMatch.index).trim();
      const trivia = triviaMatch[1].trim();
      return { mainBody: beforeTrivia, triviaText: trivia };
    }
    return { mainBody: raw, triviaText: "" };
  })();

  const finalTriviaText = triviaText || (isAchievement ? ACHIEVEMENT_TRIVIA[achievementId] : "") || "";

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace(getNotificationFallbackRoute(activeKind));
  };

  const formattedCreatedAt = activeCreatedAt
    ? new Date(activeCreatedAt).toLocaleString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true })
    : activeTimeLabel || "";

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.topBar}>
        <Pressable style={styles.backButton} accessibilityLabel="Go back" onPress={handleBack}>
          <Ionicons name="chevron-back" size={28} color="#34424F" />
        </Pressable>
        <Text style={styles.topTitle}>{detailTitle}</Text>
        <View style={styles.topBarSpacer} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={{ paddingVertical: 40, alignItems: "center" }}>
            <ActivityIndicator size="small" color="#229365" />
          </View>
        ) : (
          <>
            {isAchievement ? (
              <View style={styles.achievementCard}>
                <View style={styles.achievementArtWrap}>
                  <Image
                    source={illustration ? { uri: illustration } : localIllustration || TALA_IMAGE}
                    style={styles.achievementArt}
                    resizeMode={localIllustration || illustration ? "cover" : "contain"}
                  />
                </View>
                <View style={styles.achievementCopy}>
                  <Text style={styles.achievementTitle}>{achievementTitle}</Text>
                  <Text style={styles.achievementDescription}>{achievementDescription}</Text>
                </View>
              </View>
            ) : null}

            {!isAchievement ? <View style={styles.headerCard}>
              {!isAchievement ? (
                <View style={[styles.headerIconBubble, { backgroundColor: visual.chip }]}>
                  {visual.usesTalaLogo ? (
                    <Image source={TALA_IMAGE} style={styles.headerTalaIcon} resizeMode="contain" />
                  ) : (
                    <Ionicons name={visual.icon} size={22} color={visual.accent} />
                  )}
                </View>
              ) : null}

              <View style={styles.headerTextWrap}>
                <View style={[styles.kindChip, { backgroundColor: visual.chip }]}>
                  <Text style={[styles.kindChipText, { color: visual.accent }]}>{visual.label}</Text>
                </View>
                <Text style={styles.headerTitle}>{activeTitle || detailTitle}</Text>
                <Text style={styles.headerMeta}>{formattedCreatedAt}</Text>
              </View>
            </View> : null}

            {isAchievement ? (
              <View style={styles.achievementStoryCard}>
                <Text style={styles.achievementStoryText}>{achievementStory}</Text>
              </View>
            ) : null}

            {isAchievement && parsedMetadata?.rewardTala ? (
              <View style={[styles.bodyCard, styles.achievementRewardCard, { flexDirection: "row", alignItems: "center", columnGap: 12 }]}>
                <Image source={TALA_IMAGE} style={{ width: 28, height: 28 }} resizeMode="contain" />
                <Text style={[styles.bodyText, { flex: 1, fontFamily: "Outfit-Bold", color: "#9B7E3F" }]}>
                  You earned {parsedMetadata.rewardTala} Tala!
                </Text>
              </View>
            ) : null}

            {!isAchievement ? (
              <View style={[styles.bodyCard, isAchievement && styles.achievementRewardCard]}>
                <Text style={styles.bodyText}>{mainBody || (loading ? "Loading..." : "No details available.")}</Text>
              </View>
            ) : null}

            {finalTriviaText ? (
              <View style={styles.triviaCard}>
                <View style={styles.triviaIdentity}>
                  <Image source={MUNI_AVATAR} style={styles.triviaAvatar} resizeMode="contain" />
                  <Text style={styles.triviaLabel}>Muni Trivia</Text>
                </View>
                <View style={styles.triviaBubble}>
                  <View style={styles.triviaBubbleTail} />
                  <Text style={styles.triviaText}>{finalTriviaText}</Text>
                </View>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F7FAF5" },
  topBar: {
    minHeight: 58,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#E0E7DD",
    backgroundColor: "rgba(250, 252, 249, 0.98)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between" },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center" },
  topTitle: {
    color: "#33475C",
    fontSize: 18,
    lineHeight: 24,
    fontFamily: "Outfit-Bold" },
  topBarSpacer: {
    width: 40,
    height: 40 },
  scroll: {
    flex: 1 },
  content: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 32,
    rowGap: 16 },
  achievementCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#E2D8F0",
    backgroundColor: "#FDFBFF",
    padding: 13,
    flexDirection: "row",
    alignItems: "center",
    columnGap: 12 },
  achievementArtWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "#EAE5D9",
    backgroundColor: "#ECEBE6" },
  achievementArt: {
    width: "100%",
    height: "100%" },
  achievementCopy: {
    flex: 1 },
  achievementTitle: {
    color: "#304558",
    fontSize: 18,
    lineHeight: 23,
    fontFamily: "Outfit-Bold",
    marginBottom: 4 },
  achievementDescription: {
    color: "#717A76",
    fontSize: 13,
    lineHeight: 18 },
  achievementStoryCard: {
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  achievementStoryText: {
    color: "#465866",
    fontSize: 16,
    lineHeight: 25,
    textAlign: "center",
    fontFamily: "Outfit-Medium",
  },
  headerCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#DDE9D8",
    backgroundColor: "#F8FCF7",
    paddingHorizontal: 18,
    paddingVertical: 18,
    flexDirection: "row",
    alignItems: "flex-start",
    columnGap: 14 },
  headerIconBubble: {
    width: 46,
    height: 46,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2 },
  headerTalaIcon: {
    width: 27,
    height: 27 },
  headerTextWrap: {
    flex: 1,
    minWidth: 0 },
  kindChip: {
    minHeight: 24,
    paddingHorizontal: 10,
    borderRadius: 999,
    alignSelf: "flex-start",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8 },
  kindChipText: {
    fontSize: 11.5,
    lineHeight: 14,
    fontFamily: "Outfit-Bold" },
  headerTitle: {
    color: "#33475B",
    fontSize: 22,
    lineHeight: 28,
    fontFamily: "Outfit-Bold" },
  headerMeta: {
    marginTop: 6,
    color: "#6B7783",
    fontSize: 13,
    lineHeight: 18 },
  bodyCard: {
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 18,
    paddingVertical: 18,
    borderWidth: 1,
    borderColor: "#E2E9E4" },
  achievementRewardCard: {
    backgroundColor: "#FFFDF8",
    borderColor: "#E9E1CE",
    paddingVertical: 16 },
  bodyText: {
    color: "#384A5E",
    fontSize: 16,
    lineHeight: 26 },
  triviaCard: {
    paddingTop: 0,
    paddingHorizontal: 2 },
  triviaIdentity: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 8,
    marginBottom: 7,
    paddingLeft: 4 },
  triviaAvatar: {
    width: 38,
    height: 38,
    marginTop: 4 },
  triviaLabel: {
    color: "#5A7A6A",
    fontSize: 12,
    lineHeight: 16,
    fontFamily: "Outfit-Bold",
    letterSpacing: 0.4,
    textTransform: "uppercase" },
  triviaBubble: {
    backgroundColor: "#EDF8F3",
    borderRadius: 22,
    borderTopLeftRadius: 8,
    paddingHorizontal: 18,
    paddingVertical: 17,
    borderWidth: 1,
    borderColor: "#D2EBDD",
    position: "relative" },
  triviaBubbleTail: {
    position: "absolute",
    top: -7,
    left: 18,
    width: 0,
    height: 0,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderBottomWidth: 7,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderBottomColor: "#D8EDDF" },
  triviaText: {
    color: "#416556",
    fontSize: 14.5,
    lineHeight: 22,
    fontStyle: "italic" },
});
