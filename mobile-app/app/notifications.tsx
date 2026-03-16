import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import { useCallback, useState } from "react";
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

export default function NotificationsScreen() {
  const { user } = useAuthSession();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingDeleteNotificationId, setPendingDeleteNotificationId] = useState<string | null>(null);

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

      <View style={styles.dayRow}>
        <Text style={styles.dayLabel}>Recent</Text>
        <Pressable style={styles.markAsReadButton} onPress={() => void handleMarkAllAsRead()}>
          <Ionicons name="checkbox-outline" size={15} color="#49555F" />
          <Text style={styles.markAsReadText}>Mark All as Read</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color="#6FAE46" />
        </View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {items.length ? (
            items.map((item) => (
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
                  style={[styles.itemCard, item.isRead && styles.itemCardRead]}
                  onPress={() => void handleOpenNotification(item)}
                >
                  <Text style={styles.itemTime}>{item.timeLabel}</Text>
                  <Text style={[styles.itemTitle, item.isRead && styles.itemTextRead]}>{item.title}</Text>
                  <Text style={[styles.itemMessage, item.isRead && styles.itemTextRead]}>{item.message}</Text>
                </Pressable>
              </Swipeable>
            ))
          ) : (
            <View style={styles.emptyCard}>
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
    backgroundColor: "#ECECEC",
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
  dayRow: {
    marginTop: 14,
    marginBottom: 8,
    paddingHorizontal: 4,
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
    columnGap: 2,
    paddingVertical: 2,
    paddingHorizontal: 2,
  },
  markAsReadText: {
    color: "#52606A",
    fontSize: 15,
    lineHeight: 20,
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
    paddingHorizontal: 4,
    paddingBottom: 24,
    rowGap: 6,
  },
  itemCard: {
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#D5E7C8",
    backgroundColor: "#EAF6E0",
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 9,
    position: "relative",
  },
  itemCardRead: {
    backgroundColor: "#F6F5FA",
    borderColor: "#E2E0EB",
  },
  deleteSwipeAction: {
    width: 92,
    borderRadius: 8,
    backgroundColor: "#D85B5B",
    alignItems: "center",
    justifyContent: "center",
    rowGap: 4,
    marginLeft: 8,
  },
  deleteSwipeText: {
    color: "#FFFFFF",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
  },
  itemTime: {
    position: "absolute",
    top: 8,
    right: 8,
    color: "#5F6C74",
    fontSize: 14,
    lineHeight: 19,
  },
  itemTitle: {
    color: "#33475B",
    fontSize: 17,
    lineHeight: 23,
    fontWeight: "700",
    paddingRight: 100,
    marginBottom: 2,
  },
  itemMessage: {
    color: "#384A5E",
    fontSize: 16.5,
    lineHeight: 22,
    paddingRight: 24,
  },
  itemTextRead: {
    color: "#647280",
  },
  emptyCard: {
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    padding: 18,
    alignItems: "center",
  },
  emptyText: {
    color: "#647280",
    fontSize: 15,
    lineHeight: 20,
  },
});
