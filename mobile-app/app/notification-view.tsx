import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  getNotificationDetailTitle,
  getNotificationFallbackRoute,
  getNotificationVisual,
} from "../lib/notification-utils";

export default function NotificationViewScreen() {
  const { createdAt, kind, message, timeLabel, title } = useLocalSearchParams<{
    createdAt?: string;
    kind?: string;
    message?: string;
    timeLabel?: string;
    title?: string;
  }>();

  const detailTitle = getNotificationDetailTitle(kind);
  const bodyLabel = detailTitle === "Message" ? "Message body" : "Update details";
  const visual = getNotificationVisual(kind || "");

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace(getNotificationFallbackRoute(kind));
  };

  const formattedCreatedAt = createdAt
    ? new Date(createdAt).toLocaleString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })
    : timeLabel || "";

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
        <View style={styles.heroCard}>
          <View style={[styles.heroIconBubble, { backgroundColor: visual.chip }]}>
            <Ionicons name={visual.icon} size={20} color={visual.accent} />
          </View>

          <View style={styles.heroTextWrap}>
            <View style={[styles.kindChip, { backgroundColor: visual.chip }]}>
              <Text style={[styles.kindChipText, { color: visual.accent }]}>{visual.label}</Text>
            </View>
            <Text style={styles.title}>{title || detailTitle}</Text>
            <Text style={styles.meta}>{formattedCreatedAt}</Text>
          </View>
        </View>

        <View style={styles.bodyCard}>
          <Text style={styles.bodyLabel}>{bodyLabel}</Text>
          <Text style={styles.bodyText}>{message || "No details available."}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F7FAF5",
  },
  topBar: {
    minHeight: 58,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#E0E7DD",
    backgroundColor: "rgba(250, 252, 249, 0.98)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  topTitle: {
    color: "#33475C",
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "700",
  },
  topBarSpacer: {
    width: 40,
    height: 40,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 14,
    paddingTop: 18,
    paddingBottom: 28,
    rowGap: 14,
  },
  heroCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#DDE9D8",
    backgroundColor: "#F8FCF7",
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "flex-start",
    columnGap: 12,
  },
  heroIconBubble: {
    width: 44,
    height: 44,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  heroTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  kindChip: {
    minHeight: 24,
    paddingHorizontal: 10,
    borderRadius: 999,
    alignSelf: "flex-start",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  kindChipText: {
    fontSize: 11.5,
    lineHeight: 14,
    fontWeight: "700",
  },
  title: {
    color: "#33475B",
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "700",
  },
  meta: {
    marginTop: 6,
    color: "#6B7783",
    fontSize: 14,
    lineHeight: 20,
  },
  bodyCard: {
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 18,
    borderWidth: 1,
    borderColor: "#E2E9E4",
  },
  bodyLabel: {
    color: "#6A875A",
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  bodyText: {
    color: "#384A5E",
    fontSize: 17,
    lineHeight: 27,
  },
});
