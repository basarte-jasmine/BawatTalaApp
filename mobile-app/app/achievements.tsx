import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuthSession } from "../lib/auth-session";
import { syncPendingAchievements } from "../lib/backend-api";

const ACHIEVEMENTS = [
  {
    id: "a-gentler-first-step",
    title: "A Gentler First Step",
    desc: "Book your first peer counselor appointment.",
    rewardTala: 10,
    art: require("../assets/images/Achievements/A gentler first step.webp"),
  },
  {
    id: "a-sky-with-many-colors",
    title: "A Sky With Many Colors",
    desc: "Log every emotion at least once.",
    rewardTala: 15,
    art: require("../assets/images/Achievements/A sky with many colors.webp"),
  },
  {
    id: "a-softer-minute",
    title: "A Softer Minute",
    desc: "Complete one wellness exercise session.",
    rewardTala: 10,
    art: require("../assets/images/Achievements/A softer minute_.webp"),
  },
  {
    id: "asked-for-support",
    title: "Asked for Support",
    desc: "Book your first guidance counselor appointment.",
    rewardTala: 15,
    art: require("../assets/images/Achievements/Asked for support_.webp"),
  },
  {
    id: "dear-muni",
    title: "Dear Muni",
    desc: "Send your first journal message to Muni.",
    rewardTala: 10,
    art: require("../assets/images/Achievements/Dear Muni.webp"),
  },
  {
    id: "library-glow",
    title: "Library Glow",
    desc: "Read in the library for 1 hour.",
    rewardTala: 20,
    art: require("../assets/images/Achievements/Library glow.webp"),
  },
  {
    id: "message-from-the-tide",
    title: "Message From the Tide",
    desc: "Open a drifting bottle note.",
    rewardTala: 10,
    art: require("../assets/images/Achievements/Message from the tide.webp"),
  },
  {
    id: "small-good-thing",
    title: "Small Good Thing",
    desc: "Save a journal entry with a positive tag.",
    rewardTala: 10,
    art: require("../assets/images/Achievements/Small good thing.webp"),
  },
  {
    id: "star-shopper",
    title: "Star Shopper",
    desc: "Spend Tala in the Muni shop for the first time.",
    rewardTala: 10,
    art: require("../assets/images/Achievements/Star shopper.webp"),
  },
  {
    id: "voice-beneath-the-stars",
    title: "Voice Beneath the Stars",
    desc: "Complete your first Muni voice journal.",
    rewardTala: 15,
    art: require("../assets/images/Achievements/Voice beneath the stars.webp"),
  }
];

export default function AchievementsScreen() {
  const { user } = useAuthSession();
  const [unlockedIds, setUnlockedIds] = useState<Set<string>>(new Set());
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadUnlocked = useCallback(async () => {
    if (!user?.studentNumber) return;
    try {
      const newUnlocked = new Set<string>();
      for (const ach of ACHIEVEMENTS) {
        const val = await AsyncStorage.getItem(`@bawat-tala/achievement:${ach.id}:${user.studentNumber}`);
        if (val === "true") {
          newUnlocked.add(ach.id);
        }
      }
      setUnlockedIds(newUnlocked);
    } catch {
      // Keep prior unlocked set on read failure.
    }
  }, [user?.studentNumber]);

  useEffect(() => {
    void loadUnlocked();
  }, [loadUnlocked]);

  const handleRefresh = useCallback(async () => {
    if (!user?.studentNumber) return;
    setIsRefreshing(true);
    try {
      await syncPendingAchievements(user.studentNumber);
      await loadUnlocked();
    } finally {
      setIsRefreshing(false);
    }
  }, [loadUnlocked, user?.studentNumber]);

  const unlockedCount = unlockedIds.size;

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.topBar}>
        <Pressable style={styles.back} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={28} color="#37424F" />
        </Pressable>
        <Text style={styles.topTitle}>Achievements</Text>
        <View style={styles.back} />
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={["#73CD44"]}
            tintColor="#73CD44"
          />
        }
      >
        <View style={styles.summary}>
          <View style={styles.medal}>
            <Ionicons name="ribbon" size={26} color="#F5C447" />
          </View>
          <View>
            <Text style={styles.summaryTitle}>
              {unlockedCount > 0
                ? `${unlockedCount} achievement${unlockedCount === 1 ? "" : "s"} unlocked`
                : "Your achievements"}
            </Text>
            <Text style={styles.summaryText}>
              {unlockedCount > 0 ? "Small moments of care count." : "Your milestones will appear here."}
            </Text>
          </View>
        </View>
        <View style={styles.cardList}>
          {ACHIEVEMENTS.map((ach) => {
            const isUnlocked = unlockedIds.has(ach.id);
            return (
              <View key={ach.id} style={[styles.card, !isUnlocked && styles.cardLocked]}>
                {ach.art ? (
                  <Image source={ach.art} style={styles.art} resizeMode="cover" />
                ) : (
                  <View style={styles.artPlaceholder}>
                    <Ionicons name="star" size={24} color="#D1C7AE" />
                  </View>
                )}
                <View style={styles.copy}>
                  <Text style={styles.title}>{ach.title}</Text>
                  <Text style={styles.desc}>{ach.desc}</Text>
                </View>
                <Ionicons
                  name={isUnlocked ? "ribbon" : "lock-closed-outline"}
                  size={23}
                  color={isUnlocked ? "#B08A35" : "#9AA4AC"}
                />
              </View>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F7FAF6" },
  topBar: {
    height: 52,
    backgroundColor: "#FFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E6ECF1",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
  },
  back: { width: 42, height: 42, alignItems: "center", justifyContent: "center" },
  topTitle: { color: "#33475C", fontSize: 18, fontFamily: "Outfit-Bold" },
  content: { padding: 16 },
  summary: {
    borderRadius: 22,
    backgroundColor: "#303B4B",
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    columnGap: 13,
    marginBottom: 14,
  },
  medal: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "#46566A",
    alignItems: "center",
    justifyContent: "center",
  },
  summaryTitle: { color: "#FFF", fontFamily: "Outfit-Bold", fontSize: 17, marginBottom: 3 },
  summaryText: { color: "#D5DEE6", fontSize: 13 },
  card: {
    borderRadius: 22,
    backgroundColor: "#FFFDF8",
    borderWidth: 1,
    borderColor: "#EDE1C7",
    padding: 13,
    flexDirection: "row",
    alignItems: "center",
    columnGap: 12,
  },
  cardLocked: { opacity: 0.68 },
  art: { width: 68, height: 68, borderRadius: 34, borderWidth: 2, borderColor: "#E8E2D5" },
  artPlaceholder: { width: 68, height: 68, borderRadius: 34, backgroundColor: "#F2EFE8", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#E8E2D5" },
  copy: { flex: 1 },
  kicker: {
    color: "#A88743",
    fontSize: 10,
    fontFamily: "Outfit-Bold",
    letterSpacing: 0.6,
    marginBottom: 3,
  },
  title: { color: "#414846", fontSize: 17, fontFamily: "Outfit-Bold", marginBottom: 4 },
  desc: { color: "#717A76", fontSize: 13, lineHeight: 18 },
  reward: { color: "#9C7832", fontSize: 11, lineHeight: 15, fontFamily: "Outfit-Bold", marginTop: 5 },
  cardList: { display: "flex", flexDirection: "column", gap: 14 },
});
