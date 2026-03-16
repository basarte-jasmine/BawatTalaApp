import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";

export default function NotificationViewScreen() {
  const { createdAt, message, timeLabel, title } = useLocalSearchParams<{
    createdAt?: string;
    message?: string;
    timeLabel?: string;
    title?: string;
  }>();

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/notifications");
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
    <SafeAreaView style={styles.screen}>
      <View style={styles.topBar}>
        <Pressable style={styles.backButton} accessibilityLabel="Go back" onPress={handleBack}>
          <Ionicons name="chevron-back" size={28} color="#37424F" />
        </Pressable>
        <Text style={styles.topTitle}>Notification</Text>
        <View style={styles.topBarSpacer} />
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>{title || "Notification"}</Text>
        <Text style={styles.meta}>{formattedCreatedAt}</Text>
        <View style={styles.bodyCard}>
          <Text style={styles.bodyText}>{message || "No details available."}</Text>
        </View>
      </View>
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
  content: {
    paddingHorizontal: 14,
    paddingTop: 18,
  },
  title: {
    color: "#33475B",
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "700",
  },
  meta: {
    marginTop: 6,
    color: "#6B7783",
    fontSize: 14,
    lineHeight: 20,
  },
  bodyCard: {
    marginTop: 18,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 18,
  },
  bodyText: {
    color: "#384A5E",
    fontSize: 18,
    lineHeight: 28,
  },
});
