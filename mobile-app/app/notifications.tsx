import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";
import { ConfirmationModal } from "../components/ui/ConfirmationModal";
import { useAuthSession } from "../lib/auth-session";
import {
  AppNotification,
  deleteStudentNotification,
  fetchStudentNotifications,
  markAllStudentNotificationsRead,
  markStudentNotificationRead,
} from "../lib/backend-api";

function getNotificationVisual(kind: string) {
  const normalized = String(kind || "").toLowerCase();

  if (normalized.includes("appointment") || normalized.includes("schedule")) {
    return {
      accent: "#6FCB43",
      chip: "#E9F8DD",
      icon: "calendar-clear-outline" as const,
      label: "Appointment",
      surface: "#F6FFF0",
    };
  }

  if (normalized.includes("journal") || normalized.includes("entry")) {
    return {
      accent: "#6D95C8",
      chip: "#E9F1FD",
      icon: "book-outline" as const,
      label: "Journal",
      surface: "#F7FBFF",
    };
  }

  if (normalized.includes("flag") || normalized.includes("safety")) {
    return {
      accent: "#F19137",
      chip: "#FFF1E1",
      icon: "warning-outline" as const,
      label: "Safety",
      surface: "#FFF9F3",
    };
  }

  return {
    accent: "#7D89D8",
    chip: "#F0EEFF",
    icon: "notifications-outline" as const,
    label: "Update",
    surface: "#FBFAFF",
  };
}

export default function NotificationsScreen() {
  const { user } = useAuthSession();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingDeleteNotificationId, setPendingDeleteNotificationId] = useState<string | null>(null);
  const unreadCount = useMemo(() => items.filter((item) => !item.isRead).length, [items]);

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

    setLoading(true);
    const result = await fetchStudentNotifications(user.studentNumber);
    setItems(Array.isArray(result.notifications) ? result.notifications : []);
    setLoading(false);
  }, [user?.studentNumber]);

  useFocusEffect(
    useCallback(() => {
      void loadNotifications();
    }, [loadNotifications]),
  );

  const handleMarkAllAsRead = async () => {
    if (!user?.studentNumber) return;
    const result = await markAllStudentNotificationsRead(user.studentNumber);
    if (result.ok) {
      setItems((current) => current.map((item) => ({ ...item, isRead: true })));
    }
  };

  const handleOpenNotification = async (item: AppNotification) => {
    if (!user?.studentNumber) return;
    if (!item.isRead) {
      const result = await markStudentNotificationRead(user.studentNumber, item.id);
      if (result.ok) {
        setItems((current) => current.map((entry) => (entry.id === item.id ? { ...entry, isRead: true } : entry)));
      }
    }
    router.push({
      pathname: "/notification-view",
      params: {
        createdAt: item.createdAt,
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
      setItems((current) => current.filter((item) => item.id !== pendingDeleteNotificationId));
    }
    setPendingDeleteNotificationId(null);
  };

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.topBar}>
        <Pressable style={styles.backButton} accessibilityLabel="Go back" onPress={handleBack}>
          <Ionicons name="chevron-back" size={28} color="#37424F" />
        </Pressable>
        <Text style={styles.topTitle}>Notifications</Text>
        <View style={styles.topBarSpacer} />
      </View>

      <View style={styles.summaryWrap}>
        <View style={styles.summaryCard}>
          <View style={styles.summaryIconBubble}>
            <Ionicons name="notifications" size={20} color="#4B7F34" />
          </View>

          <View style={styles.summaryTextWrap}>
            <Text style={styles.summaryTitle}>{unreadCount ? `${unreadCount} unread ${unreadCount === 1 ? "update" : "updates"}` : "You're all caught up"}</Text>
            <Text style={styles.summaryBody}>
              Tap a card to open it. Swipe left on any notification if you want to delete it.
            </Text>
          </View>
        </View>

        <View style={styles.dayRow}>
          <Text style={styles.dayLabel}>Recent</Text>
          <Pressable
            style={[styles.markAsReadButton, unreadCount === 0 && styles.markAsReadButtonDisabled]}
            onPress={() => void handleMarkAllAsRead()}
            disabled={unreadCount === 0}
          >
            <Ionicons name="checkbox-outline" size={15} color={unreadCount === 0 ? "#9CA6AE" : "#497134"} />
            <Text style={[styles.markAsReadText, unreadCount === 0 && styles.markAsReadTextDisabled]}>Mark All as Read</Text>
          </Pressable>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color="#6FAE46" />
        </View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {items.length ? (
            items.map((item) => {
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
                    { borderColor: item.isRead ? "#E6EAF0" : visual.chip, backgroundColor: item.isRead ? "#FFFFFF" : visual.surface },
                    item.isRead && styles.itemCardRead,
                  ]}
                  onPress={() => void handleOpenNotification(item)}
                >
                  <View style={styles.itemRow}>
                    <View style={[styles.itemIconWrap, { backgroundColor: visual.chip }]}>
                      <Ionicons name={visual.icon} size={18} color={visual.accent} />
                    </View>

                    <View style={styles.itemTextWrap}>
                      <View style={styles.itemTopRow}>
                        <Text style={[styles.itemTitle, item.isRead && styles.itemTextRead]} numberOfLines={1}>
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

                      <Text style={[styles.itemMessage, item.isRead && styles.itemTextRead]} numberOfLines={2}>
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
                <Ionicons name="notifications-off-outline" size={24} color="#7AA85C" />
              </View>
              <Text style={styles.emptyTitle}>No notifications yet</Text>
              <Text style={styles.emptyText}>No notifications yet.</Text>
            </View>
          )}
        </ScrollView>
      )}

      <ConfirmationModal
        visible={Boolean(pendingDeleteNotificationId)}
        message="Delete this notification?"
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
    height: 52,
    borderBottomWidth: 1,
    borderBottomColor: "#D3D5D7",
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    shadowColor: "#777777",
    shadowOpacity: 0.12,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  backButton: {
    width: 36,
    height: 36,
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
    width: 36,
    height: 36,
  },
  summaryWrap: {
    paddingHorizontal: 10,
    paddingTop: 14,
    paddingBottom: 8,
  },
  summaryCard: {
    borderRadius: 18,
    backgroundColor: "#EAF7DD",
    borderWidth: 1,
    borderColor: "#D9EDCA",
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    columnGap: 12,
    shadowColor: "#6B7B69",
    shadowOpacity: 0.1,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  summaryIconBubble: {
    width: 42,
    height: 42,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
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
  },
  dayLabel: {
    color: "#324254",
    fontSize: 16.5,
    lineHeight: 22,
    fontWeight: "700",
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
    color: "#497134",
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
    paddingHorizontal: 10,
    paddingBottom: 24,
    rowGap: 10,
  },
  itemCard: {
    borderRadius: 18,
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
    borderRadius: 18,
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
  itemTextWrap: {
    flex: 1,
  },
  itemTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    columnGap: 8,
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
    flex: 1,
  },
  itemMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 8,
    marginBottom: 6,
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
    borderRadius: 18,
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
