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
  getNotificationVisual } from "../lib/notification-utils";

const TALA_IMAGE = require("../assets/images/Tala_Star.png");
const ACHIEVEMENT_BADGE = require("../assets/images/Notification Badge.png");

export default function NotificationViewScreen() {
  const { id, createdAt, kind, message, timeLabel, title } = useLocalSearchParams<{
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
          const found = res.notifications.find((n) => n.id === id);          if (found) {
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
  const bodyLabel = detailTitle === "Message" ? "Message body" : "Update details";
  const visual = getNotificationVisual(activeKind || "");
  const illustration = loadedItem?.metadata?.illustration || loadedItem?.metadata?.imageUrl || loadedItem?.metadata?.image;

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
        ) : (        <View style={styles.heroCard}>
          {illustration ? (
            <Image source={{ uri: illustration }} style={styles.heroIllustration} resizeMode="contain" />
          ) : visual.isAchievement ? (
            <Image source={ACHIEVEMENT_BADGE} style={styles.heroIllustrationBadge} resizeMode="contain" />
          ) : (
            <View style={[styles.heroIconBubble, { backgroundColor: visual.chip }]}>
              {visual.usesTalaLogo ? (
                <Image source={TALA_IMAGE} style={styles.heroTalaIcon} resizeMode="contain" />
              ) : (
                <Ionicons name={visual.icon} size={20} color={visual.accent} />
              )}
            </View>
          )}

          <View style={styles.heroTextWrap}>
            <View style={[styles.kindChip, { backgroundColor: visual.chip }]}>
              <Text style={[styles.kindChipText, { color: visual.accent }]}>{visual.label}</Text>
            </View>
            <Text style={styles.title}>{activeTitle || detailTitle}</Text>
            <Text style={styles.meta}>{formattedCreatedAt}</Text>
          </View>
        </View>
        )}

        <View style={styles.bodyCard}>
          <Text style={styles.bodyLabel}>{bodyLabel}</Text>
          <Text style={styles.bodyText}>{activeMessage || (loading ? "Loading..." : "No details available.")}</Text>
        </View>
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
    paddingHorizontal: 14,
    paddingTop: 18,
    paddingBottom: 28,
    rowGap: 14 },
  heroCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#DDE9D8",
    backgroundColor: "#F8FCF7",
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "flex-start",
    columnGap: 12 },
  heroIllustration: {
    width: 60,
    height: 60,
    borderRadius: 12,
    marginTop: 2 },
  heroIconBubble: {
    width: 44,
    height: 44,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2 },
  heroAchievementIcon: {
    width: 60,
    height: 60,
    marginTop: -8,
    marginLeft: -4 },
  heroIllustrationBadge: {
    width: 50,
    height: 50,
    marginTop: -2 },
  heroTalaIcon: {
    width: 27,
    height: 27 },
  heroTextWrap: {
    flex: 1,
    minWidth: 0 },
  kindChip: {
    minHeight: 24,
    paddingHorizontal: 10,
    borderRadius: 999,
    alignSelf: "flex-start",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10 },
  kindChipText: {
    fontSize: 11.5,
    lineHeight: 14,
    fontFamily: "Outfit-Bold" },
  title: {
    color: "#33475B",
    fontSize: 22,
    lineHeight: 28,
    fontFamily: "Outfit-Bold" },
  meta: {
    marginTop: 6,
    color: "#6B7783",
    fontSize: 14,
    lineHeight: 20 },
  bodyCard: {
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 18,
    borderWidth: 1,
    borderColor: "#E2E9E4" },
  bodyLabel: {
    color: "#6A875A",
    fontSize: 11,
    lineHeight: 15,
    fontFamily: "Outfit-Bold",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 8 },
  bodyText: {
    color: "#384A5E",
    fontSize: 17,
    lineHeight: 27 } });
