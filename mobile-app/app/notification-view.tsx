import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Dimensions, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuthSession } from "../lib/auth-session";
import { fetchStudentNotifications } from "../lib/backend-api";
import {
  getNotificationDetailTitle,
  getNotificationFallbackRoute,
  getNotificationVisual } from "../lib/notification-utils";

const TALA_IMAGE = require("../assets/images/Tala_Star.png");
const ACHIEVEMENT_BADGE = require("../assets/images/Notification Badge.png");
const MUNI_AVATAR = require("../assets/images/MUNI_default.png");

const ACHIEVEMENT_ILLUSTRATIONS: Record<string, any> = {
  "future-bottle": require("../assets/images/Achievements/A Bottle for Tomorrow.jpg"),
  "a-bottle-for-tomorrow": require("../assets/images/Achievements/A Bottle for Tomorrow.jpg"),
};

const { width: SCREEN_WIDTH } = Dimensions.get("window");

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
  const hasIllustration = Boolean(illustration || localIllustration);

  const { mainBody, triviaText } = (() => {
    const raw = activeMessage || "";
    if (parsedMetadata?.trivia) {
      const triviaFromMeta = String(parsedMetadata.trivia).trim();
      const cleaned = raw.replace(/Munis*trivia[:s]*/i, "").replace(triviaFromMeta, "").trim();
      return { mainBody: cleaned || raw, triviaText: triviaFromMeta };
    }
    const triviaMatch = raw.match(/Munis*trivia[:s]*([sS]+)/i);
    if (triviaMatch) {
      const beforeTrivia = raw.slice(0, triviaMatch.index).trim();
      const trivia = triviaMatch[1].trim();
      return { mainBody: beforeTrivia, triviaText: trivia };
    }
    return { mainBody: raw, triviaText: "" };
  })();

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
            {isAchievement && hasIllustration ? (
              <View style={styles.illustrationCard}>
                <Image
                  source={illustration ? { uri: illustration } : localIllustration}
                  style={styles.illustrationImage}
                  resizeMode="cover"
                />
                <View style={styles.illustrationOverlay}>
                  <Image source={ACHIEVEMENT_BADGE} style={styles.illustrationBadgeOverlay} resizeMode="contain" />
                </View>
              </View>
            ) : null}

            <View style={[styles.headerCard, isAchievement && styles.headerCardAchievement]}>
              {!hasIllustration && isAchievement ? (
                <Image source={ACHIEVEMENT_BADGE} style={styles.headerBadge} resizeMode="contain" />
              ) : !isAchievement ? (
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
            </View>

            <View style={styles.bodyCard}>
              <Text style={styles.bodyText}>{mainBody || (loading ? "Loading..." : "No details available.")}</Text>
            </View>

            {triviaText ? (
              <View style={styles.triviaCard}>
                <View style={styles.triviaHeader}>
                  <Image source={MUNI_AVATAR} style={styles.triviaAvatar} resizeMode="contain" />
                  <Text style={styles.triviaLabel}>Muni Trivia</Text>
                </View>
                <View style={styles.triviaBubble}>
                  <View style={styles.triviaBubbleTail} />
                  <Text style={styles.triviaText}>{triviaText}</Text>
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
    rowGap: 14 },
  illustrationCard: {
    borderRadius: 24,
    overflow: "hidden",
    position: "relative" },
  illustrationImage: {
    width: "100%",
    height: SCREEN_WIDTH * 0.55,
    borderRadius: 24 },
  illustrationOverlay: {
    position: "absolute",
    bottom: 12,
    right: 12,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.9)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3 },
  illustrationBadgeOverlay: {
    width: 30,
    height: 30 },
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
  headerCardAchievement: {
    borderColor: "#E2D8F0",
    backgroundColor: "#FDFBFF" },
  headerBadge: {
    width: 48,
    height: 48,
    marginTop: 2 },
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
  bodyText: {
    color: "#384A5E",
    fontSize: 16,
    lineHeight: 26 },
  triviaCard: {
    paddingTop: 4 },
  triviaHeader: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 8,
    marginBottom: 8,
    paddingHorizontal: 4 },
  triviaAvatar: {
    width: 32,
    height: 32 },
  triviaLabel: {
    color: "#5A7A6A",
    fontSize: 12,
    lineHeight: 16,
    fontFamily: "Outfit-Bold",
    letterSpacing: 0.4,
    textTransform: "uppercase" },
  triviaBubble: {
    backgroundColor: "#F0F8F3",
    borderRadius: 20,
    borderTopLeftRadius: 6,
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: "#D8EDDF",
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
    color: "#4A6858",
    fontSize: 14.5,
    lineHeight: 22,
    fontStyle: "italic" },
});
