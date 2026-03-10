import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type NotificationItem = {
  id: string;
  message: string;
  time: string;
  title: string;
};

const NOTIFICATIONS: NotificationItem[] = [
  {
    id: "n1",
    title: "Data Safety",
    message: "Don't lose your memories.",
    time: "2m",
  },
  {
    id: "n2",
    title: "You're 80% there!",
    message: "Finish setting up your account.",
    time: "2m",
  },
  {
    id: "n3",
    title: "Lock your journal",
    message: "Setup a Passcode to keep your ...",
    time: "2m",
  },
  {
    id: "n4",
    title: "Welcome, Jasmine Mae!",
    message: "Thank you for choosing our app...",
    time: "2m",
  },
];

export default function NotificationsScreen() {
  const [readIds, setReadIds] = useState<string[]>([]);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/home");
  };

  const handleMarkAllAsRead = () => {
    setReadIds(NOTIFICATIONS.map((item) => item.id));
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
        <Text style={styles.dayLabel}>Today</Text>
        <Pressable style={styles.markAsReadButton} onPress={handleMarkAllAsRead}>
          <Ionicons name="checkbox-outline" size={15} color="#49555F" />
          <Text style={styles.markAsReadText}>Mark All as Read</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {NOTIFICATIONS.map((item) => {
          const isRead = readIds.includes(item.id);
          return (
            <Pressable
              key={item.id}
              style={[styles.itemCard, isRead && styles.itemCardRead]}
              onPress={() => setReadIds((current) => (current.includes(item.id) ? current : [...current, item.id]))}
            >
            <Text style={styles.itemTime}>{item.time}</Text>
            <Text style={[styles.itemTitle, isRead && styles.itemTextRead]}>{item.title}</Text>
            <Text style={[styles.itemMessage, isRead && styles.itemTextRead]}>{item.message}</Text>
          </Pressable>
          );
        })}
      </ScrollView>
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
    borderColor: "#E2E0EB",
    backgroundColor: "#EFEDF8",
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 9,
    position: "relative",
  },
  itemCardRead: {
    backgroundColor: "#F6F5FA",
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
    fontSize: 34 / 2,
    lineHeight: 23,
    fontWeight: "700",
    paddingRight: 28,
    marginBottom: 2,
  },
  itemMessage: {
    color: "#384A5E",
    fontSize: 16.5,
    lineHeight: 22,
    paddingRight: 30,
  },
  itemTextRead: {
    color: "#647280",
  },
});
