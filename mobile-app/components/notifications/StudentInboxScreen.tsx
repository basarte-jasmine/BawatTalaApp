import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { router, type Href } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";
import { ConfirmationModal } from "../ui/ConfirmationModal";
import { useAuthSession } from "../../lib/auth-session";
import {
  AppNotification,
  deleteStudentNotification,
  fetchStudentNotifications,
  markAllStudentNotificationsRead,
  markStudentNotificationRead,
  StudentNotificationCategory,
} from "../../lib/backend-api";
import { getNotificationVisual, isAdminMessageNotification } from "../../lib/notification-utils";

type StudentInboxScreenProps = {
  variant: "messages" | "notifications";
};

const TALA_IMAGE = require("../../assets/images/Tala_Star.png");
const inboxCache = new Map<string, AppNotification[]>();
const NOTIFICATION_FILTERS: { key: StudentNotificationCategory; label: string }[] = [
  { key: "notifications", label: "All" },
  { key: "guidance", label: "Guidance" },
  { key: "peer", label: "Peer" },
];

function getStringMetadataValue(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}

function getNotificationRoute(item: AppNotification): Href | "" {
  const metadata = item.metadata || {};
  const kind = String(item.kind || "").toUpperCase();
  const route = getStringMetadataValue(metadata, "route");
  const appointmentId = getStringMetadataValue(metadata, "appointmentId");
  const entryId = getStringMetadataValue(metadata, "entryId");
  const supportType = getStringMetadataValue(metadata, "supportType").toUpperCase();

  if (appointmentId || kind.includes("APPOINTMENT")) {
    return {
      pathname: "/home",
      params: {
        appointmentId,
        consultConfirmed: "1",
        appointmentNoticeTitle: item.title || "",
      },
    };
  }
  if (entryId || route === "/journal-entry-view") {
    return entryId
      ? { pathname: "/journal-entry-view", params: { entryId } }
      : "/journal-entries";
  }
  if (route === "/journal" || kind.includes("JOURNAL") || kind.includes("ENTRY")) {
    return "/journal-entries";
  }
  if (route === "/messages" || kind.includes("ADMIN_MESSAGE")) {
    return "";
  }
  if (route === "/consult") {
    return supportType === "PEER"
      ? { pathname: "/consult", params: { track: "peer", skipIntro: "1" } }
      : { pathname: "/consult", params: { track: "professional", skipIntro: "1" } };
  }
  return "";
}

export function StudentInboxScreen({ variant }: StudentInboxScreenProps) {
  const { user } = useAuthSession();
  const [notificationFilter, setNotificationFilter] = useState<StudentNotificationCategory>("notifications");
  const requestCategory = variant === "messages" ? "messages" : notificationFilter;
  const cacheKey = user?.studentNumber ? `${user.studentNumber}:${requestCategory}` : "";
  const cachedItems = cacheKey ? inboxCache.get(cacheKey) : undefined;
  const [items, setItems] = useState<AppNotification[]>(() => cachedItems ?? []);
  const [loading, setLoading] = useState(() => !cachedItems);
  const [pendingDeleteNotificationId, setPendingDeleteNotificationId] = useState<string | null>(null);

  const isMessageInbox = variant === "messages";
  const summaryAccent = isMessageInbox ? "#4F7D63" : "#4B7F34";
  const summaryChip = isMessageInbox ? "#E6F4EA" : "#EAF7DD";
  const summarySurface = isMessageInbox ? "#F4FBF6" : "#F6FFF0";
  const emptyIcon = isMessageInbox ? "mail-open-outline" : "notifications-off-outline";
  const summaryIcon = isMessageInbox ? "mail-unread-outline" : "notifications";
  const topTitle = isMessageInbox ? "Messages" : "Notifications";
  const emptyTitle = isMessageInbox ? "No messages yet" : "No notifications yet";
  const emptyText = isMessageInbox
    ? "Messages from admins or counselors will appear here."
    : "Appointments, journal updates, and support alerts will appear here.";
  const summaryBody = isMessageInbox
    ? "Notes from admins and support staff land here. Tap any card to open the full message."
    : "Appointments, journal updates, and support alerts land here. Tap any card to open it.";

  const visibleItems = useMemo(
    () =>
      items.filter((item) =>
        isMessageInbox ? isAdminMessageNotification(item) : !isAdminMessageNotification(item),
      ),
    [isMessageInbox, items],
  );
  const unreadCount = useMemo(() => visibleItems.filter((item) => !item.isRead).length, [visibleItems]);

  useEffect(() => {
    const nextCachedItems = cacheKey ? inboxCache.get(cacheKey) : undefined;
    setItems(nextCachedItems ?? []);
    setLoading(!nextCachedItems);
  }, [cacheKey]);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/home");
  };

  const loadNotifications = useCallback(async () => {
    if (!user?.studentNumber) {
      setItems([]);
      setLoading(false);
      return;
    }

    const hasCachedItems = cacheKey ? inboxCache.has(cacheKey) : false;
    setLoading(!hasCachedItems);
    try {
      const result = await fetchStudentNotifications(user.studentNumber, requestCategory);
      if (!result.ok) {
        return;
      }
      const nextItems = Array.isArray(result.notifications) ? result.notifications : [];
      if (cacheKey) {
        inboxCache.set(cacheKey, nextItems);
      }
      setItems(nextItems);
    } finally {
      setLoading(false);
    }
  }, [cacheKey, requestCategory, user?.studentNumber]);

  useFocusEffect(
    useCallback(() => {
      void loadNotifications();
    }, [loadNotifications]),
  );

  const handleMarkAllAsRead = async () => {
    if (!user?.studentNumber) return;

    const unreadItems = visibleItems.filter((item) => !item.isRead);
    if (!unreadItems.length) {
      return;
    }

    const result = await markAllStudentNotificationsRead(user.studentNumber, requestCategory);
    if (!result.ok) {
      return;
    }

    setItems((current) => {
      const nextItems = current.map((item) => (visibleItems.some((entry) => entry.id === item.id) ? { ...item, isRead: true } : item));
      if (cacheKey) {
        inboxCache.set(cacheKey, nextItems);
      }
      return nextItems;
    });
  };

  const handleOpenNotification = async (item: AppNotification) => {
    if (!user?.studentNumber) return;
    if (!item.isRead) {
      const result = await markStudentNotificationRead(user.studentNumber, item.id);
      if (result.ok) {
        setItems((current) => {
          const nextItems = current.map((entry) => (entry.id === item.id ? { ...entry, isRead: true } : entry));
          if (cacheKey) {
            inboxCache.set(cacheKey, nextItems);
          }
          return nextItems;
        });
      }
    }

    const targetRoute = getNotificationRoute(item);
    if (targetRoute) {
      router.push(targetRoute);
      return;
    }

    router.push({
      pathname: "/notification-view",
      params: {
        createdAt: item.createdAt,
        kind: item.kind,
        message: item.message,
        timeLabel: item.timeLabel,
        title: item.title,
      },
    });
  };

  const handleConfirmDelete = async () => {
    if (!user?.studentNumber || !pendingDeleteNotificationId) return;
    const result = await deleteStudentNotification(user.studentNumber, pendingDeleteNotificationId);
    if (result.ok) {
      setItems((current) => {
        const nextItems = current.filter((item) => item.id !== pendingDeleteNotificationId);
        if (cacheKey) {
          inboxCache.set(cacheKey, nextItems);
        }
        return nextItems;
      });
    }
    setPendingDeleteNotificationId(null);
  };

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.topBar}>
        <Pressable style={styles.backButton} accessibilityLabel="Go back" onPress={handleBack}>
          <Ionicons name="chevron-back" size={28} color="#34424F" />
        </Pressable>
        <Text style={styles.topTitle}>{topTitle}</Text>
        <View style={styles.topBarSpacer} />
      </View>

      <View style={styles.summaryWrap}>
        <View
          style={[
            styles.summaryCard,
            { backgroundColor: summarySurface, borderColor: summaryChip },
          ]}
        >
          <View style={[styles.summaryIconBubble, { backgroundColor: "#FFFFFF" }]}>
            <Ionicons name={summaryIcon} size={20} color={summaryAccent} />
          </View>

          <View style={styles.summaryTextWrap}>
            <Text style={styles.summaryTitle}>
              {unreadCount
                ? `${unreadCount} unread ${unreadCount === 1 ? (isMessageInbox ? "message" : "update") : isMessageInbox ? "messages" : "updates"}`
                : isMessageInbox
                  ? "Your inbox is quiet"
                  : "You're all caught up"}
            </Text>
            <Text style={styles.summaryBody}>{summaryBody}</Text>
          </View>
        </View>

        {!isMessageInbox ? (
          <View style={styles.filterRow}>
            {NOTIFICATION_FILTERS.map((filter) => {
              const isActive = notificationFilter === filter.key;
              return (
                <Pressable
                  key={filter.key}
                  style={[styles.filterButton, isActive && styles.filterButtonActive]}
                  onPress={() => setNotificationFilter(filter.key)}
                >
                  <Text style={[styles.filterButtonText, isActive && styles.filterButtonTextActive]}>{filter.label}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        <View style={styles.dayRow}>
          <Text style={styles.dayLabel}>{isMessageInbox ? "Admin inbox" : "Recent"}</Text>
          <Pressable
            style={[styles.markAsReadButton, unreadCount === 0 && styles.markAsReadButtonDisabled]}
            onPress={() => void handleMarkAllAsRead()}
            disabled={unreadCount === 0}
          >
            <Ionicons name="checkbox-outline" size={15} color={unreadCount === 0 ? "#9CA6AE" : summaryAccent} />
            <Text style={[styles.markAsReadText, unreadCount === 0 && styles.markAsReadTextDisabled, unreadCount > 0 && { color: summaryAccent }]}>
              Mark All as Read
            </Text>
          </Pressable>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color="#6FAE46" />
        </View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {visibleItems.length ? (
            visibleItems.map((item) => {
              const visual = getNotificationVisual(item.kind);

              return (
                <Swipeable
                  key={item.id}
                  overshootRight={false}
                  renderRightActions={() => (
                    <Pressable style={styles.deleteSwipeAction} onPress={() => setPendingDeleteNotificationId(item.id)}>
                      <Ionicons name="trash-outline" size={18} color="#FFFFFF" />
                      <Text style={styles.deleteSwipeText}>Delete</Text>
                    </Pressable>
                  )}
                >
                  <Pressable
                    style={[
                      styles.itemCard,
                      {
                        borderColor: item.isRead ? "#E6EAF0" : visual.chip,
                        backgroundColor: item.isRead ? "#FFFFFF" : visual.surface,
                      },
                      item.isRead && styles.itemCardRead,
                    ]}
                    onPress={() => void handleOpenNotification(item)}
                  >
                    <View style={styles.itemRow}>
                      <View style={[styles.itemIconWrap, { backgroundColor: visual.chip }]}>
                        {visual.usesTalaLogo ? (
                          <Image source={TALA_IMAGE} style={styles.itemTalaIcon} resizeMode="contain" />
                        ) : (
                          <Ionicons name={visual.icon} size={18} color={visual.accent} />
                        )}
                      </View>

                      <View style={styles.itemTextWrap}>
                        <View style={styles.itemTopRow}>
                          <Text style={[styles.itemTitle, item.isRead && styles.itemTextRead]} numberOfLines={2}>
                            {item.title}
                          </Text>
                          <View style={styles.itemTimePill}>
                            <Text style={styles.itemTime}>{item.timeLabel}</Text>
                          </View>
                        </View>

                        <View style={styles.itemMetaRow}>
                          <View style={[styles.itemKindChip, { backgroundColor: visual.chip }]}>
                            <Text style={[styles.itemKindText, { color: visual.accent }]}>{visual.label}</Text>
                          </View>
                          {!item.isRead ? <View style={[styles.itemUnreadDot, { backgroundColor: visual.accent }]} /> : null}
                        </View>

                        <Text style={[styles.itemMessage, item.isRead && styles.itemTextRead]} numberOfLines={3}>
                          {item.message}
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                </Swipeable>
              );
            })
          ) : (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIconBubble}>
                <Ionicons name={emptyIcon} size={24} color="#7AA85C" />
              </View>
              <Text style={styles.emptyTitle}>{emptyTitle}</Text>
              <Text style={styles.emptyText}>{emptyText}</Text>
            </View>
          )}
        </ScrollView>
      )}

      <ConfirmationModal
        visible={Boolean(pendingDeleteNotificationId)}
        message={isMessageInbox ? "Delete this message?" : "Delete this notification?"}
        cancelLabel="Cancel"
        confirmLabel="Delete"
        confirmTone="danger"
        onCancel={() => setPendingDeleteNotificationId(null)}
        onConfirm={() => void handleConfirmDelete()}
      />
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
  summaryWrap: {
    paddingHorizontal: 12,
    paddingTop: 14,
    paddingBottom: 8,
  },
  summaryCard: {
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    columnGap: 12,
    shadowColor: "#6B7B69",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  summaryIconBubble: {
    width: 44,
    height: 44,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryTextWrap: {
    flex: 1,
  },
  summaryTitle: {
    color: "#2F4656",
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "700",
    marginBottom: 2,
  },
  summaryBody: {
    color: "#55706B",
    fontSize: 13,
    lineHeight: 18,
  },
  dayRow: {
    marginTop: 12,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    columnGap: 10,
  },
  filterRow: {
    marginTop: 12,
    flexDirection: "row",
    columnGap: 8,
  },
  filterButton: {
    minHeight: 34,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#DDE9D5",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  filterButtonActive: {
    borderColor: "#6FAE46",
    backgroundColor: "#EAF7DD",
  },
  filterButtonText: {
    color: "#65746C",
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "700",
  },
  filterButtonTextActive: {
    color: "#4B7F34",
  },
  dayLabel: {
    color: "#324254",
    fontSize: 16.5,
    lineHeight: 22,
    fontWeight: "700",
    flexShrink: 1,
  },
  markAsReadButton: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 4,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DDE9D5",
  },
  markAsReadButtonDisabled: {
    backgroundColor: "#F5F7F8",
    borderColor: "#E4E8EB",
  },
  markAsReadText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
  },
  markAsReadTextDisabled: {
    color: "#9CA6AE",
  },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 12,
    paddingBottom: 28,
    rowGap: 10,
  },
  itemCard: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    shadowColor: "#6B7781",
    shadowOpacity: 0.08,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  itemCardRead: {
    shadowOpacity: 0.04,
  },
  deleteSwipeAction: {
    width: 92,
    borderRadius: 20,
    backgroundColor: "#D85B5B",
    alignItems: "center",
    justifyContent: "center",
    rowGap: 4,
    marginLeft: 10,
  },
  deleteSwipeText: {
    color: "#FFFFFF",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    columnGap: 12,
  },
  itemIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  itemTalaIcon: {
    width: 25,
    height: 25,
  },
  itemTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  itemTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    columnGap: 8,
    rowGap: 6,
    flexWrap: "wrap",
    marginBottom: 6,
  },
  itemTimePill: {
    minHeight: 24,
    borderRadius: 999,
    paddingHorizontal: 8,
    backgroundColor: "#F4F7F8",
    alignItems: "center",
    justifyContent: "center",
  },
  itemTime: {
    color: "#5F6C74",
    fontSize: 11.5,
    lineHeight: 14,
    fontWeight: "700",
  },
  itemTitle: {
    color: "#33475B",
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "700",
    flexGrow: 1,
    flexShrink: 1,
  },
  itemMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 8,
    marginBottom: 6,
    flexWrap: "wrap",
  },
  itemKindChip: {
    minHeight: 22,
    paddingHorizontal: 8,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  itemKindText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "700",
  },
  itemUnreadDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  itemMessage: {
    color: "#384A5E",
    fontSize: 14,
    lineHeight: 20,
  },
  itemTextRead: {
    color: "#647280",
  },
  emptyCard: {
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 18,
    paddingVertical: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E6ECF0",
  },
  emptyIconBubble: {
    width: 54,
    height: 54,
    borderRadius: 999,
    backgroundColor: "#F0F8E8",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  emptyTitle: {
    color: "#324254",
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "700",
    marginBottom: 4,
  },
  emptyText: {
    color: "#647280",
    fontSize: 14,
    lineHeight: 19,
    textAlign: "center",
  },
});
