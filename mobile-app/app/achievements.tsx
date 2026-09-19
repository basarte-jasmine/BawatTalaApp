import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuthSession } from "../lib/auth-session";

const BOTTLE_ART = require("../assets/images/Achievements/A Bottle for Tomorrow.jpg");

const ACHIEVEMENTS = [
  {
    id: "future-bottle",
    title: "A Bottle for Tomorrow",
    desc: "Write your first future bottle note.",
    rewardTala: 10,
  },
  {
    id: "seven-little-stars",
    title: "Seven Little Stars",
    desc: "Complete a full 7-day daily check-in cycle.",
    rewardTala: 15,
  },
  {
    id: "a-sky-with-many-colors",
    title: "A Sky With Many Colors",
    desc: "Log every emotion at least once.",
    rewardTala: 15,
  },
  {
    id: "dear-muni",
    title: "Dear Muni",
    desc: "Send your first journal message to Muni.",
    rewardTala: 10,
  },
  {
    id: "ink-on-the-page",
    title: "Ink on the Page",
    desc: "Finish and save your first journal entry.",
    rewardTala: 10,
  },
  {
    id: "quiet-mode",
    title: "Quiet Mode",
    desc: "Save a journal entry with Muni turned off.",
    rewardTala: 10,
  },
  {
    id: "named-what-hurt",
    title: "Named What Hurt",
    desc: "Save a journal entry with at least one concern tag.",
    rewardTala: 10,
  },
  {
    id: "message-from-the-tide",
    title: "Message From the Tide",
    desc: "Open a drifting bottle note.",
    rewardTala: 10,
  },
  {
    id: "library-glow",
    title: "Library Glow",
    desc: "Read in the library for 1 hour.",
    rewardTala: 20,
  },
  {
    id: "star-shopper",
    title: "Star Shopper",
    desc: "Spend Tala in the Muni shop for the first time.",
    rewardTala: 10,
  },
  {
    id: "found-the-right-time",
    title: "Found the Right Time",
    desc: "Choose a counselor, date, and time for a support session.",
    rewardTala: 10,
  }
];

export default function AchievementsScreen() {
  const { user } = useAuthSession();
  const [unlockedIds, setUnlockedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user?.studentNumber) return;
    const checkAchievements = async () => {
      try {
        const bottleValue = await AsyncStorage.getItem(`@bawat-tala/future-bottle:${user.studentNumber}`);
        const newUnlocked = new Set<string>();
        if (bottleValue && bottleValue !== "[]") {
          newUnlocked.add("future-bottle");
        }
        for (const ach of ACHIEVEMENTS) {
          if (ach.id !== "future-bottle") {
            const val = await AsyncStorage.getItem(`@bawat-tala/achievement:${ach.id}:${user.studentNumber}`);
            if (val === "true") {
               newUnlocked.add(ach.id);
            }
          }
        }
        setUnlockedIds(newUnlocked);
      } catch (err) {
        console.error(err);
      }
    };
    checkAchievements();
  }, [user?.studentNumber]);

  const unlockedCount = unlockedIds.size;

  return <SafeAreaView style={styles.screen} edges={["top"]}><View style={styles.topBar}><Pressable style={styles.back} onPress={() => router.back()}><Ionicons name="chevron-back" size={28} color="#37424F" /></Pressable><Text style={styles.topTitle}>Achievements</Text><View style={styles.back} /></View><ScrollView contentContainerStyle={styles.content}><View style={styles.summary}><View style={styles.medal}><Ionicons name="ribbon" size={26} color="#F5C447" /></View><View><Text style={styles.summaryTitle}>{unlockedCount > 0 ? `${unlockedCount} achievement${unlockedCount === 1 ? "" : "s"} unlocked` : "Your achievements"}</Text><Text style={styles.summaryText}>{unlockedCount > 0 ? "Small moments of care count." : "Your milestones will appear here."}</Text></View></View><View style={styles.cardList}>{ACHIEVEMENTS.map((ach) => { const isUnlocked = unlockedIds.has(ach.id); return (<View key={ach.id} style={[styles.card, !isUnlocked && styles.cardLocked]}><Image source={BOTTLE_ART} style={styles.art} resizeMode="cover" /><View style={styles.copy}><Text style={styles.kicker}>{isUnlocked ? "UNLOCKED" : "LOCKED"}</Text><Text style={styles.title}>{ach.title}</Text><Text style={styles.desc}>{ach.desc}</Text><Text style={styles.reward}>+{ach.rewardTala} Tala on unlock</Text></View><Ionicons name={isUnlocked ? "ribbon" : "lock-closed-outline"} size={23} color={isUnlocked ? "#B08A35" : "#9AA4AC"} /></View>); })}</View></ScrollView></SafeAreaView>;
}
const styles = StyleSheet.create({ screen:{flex:1,backgroundColor:"#F7FAF6"},topBar:{height:52,backgroundColor:"#FFF",borderBottomWidth:1,borderBottomColor:"#E6ECF1",flexDirection:"row",alignItems:"center",justifyContent:"space-between",paddingHorizontal:4},back:{width:42,height:42,alignItems:"center",justifyContent:"center"},topTitle:{color:"#33475C",fontSize:18,fontFamily:"Outfit-Bold"},content:{padding:16},summary:{borderRadius:22,backgroundColor:"#303B4B",padding:18,flexDirection:"row",alignItems:"center",columnGap:13,marginBottom:14},medal:{width:48,height:48,borderRadius:16,backgroundColor:"#46566A",alignItems:"center",justifyContent:"center"},summaryTitle:{color:"#FFF",fontFamily:"Outfit-Bold",fontSize:17,marginBottom:3},summaryText:{color:"#D5DEE6",fontSize:13},card:{borderRadius:22,backgroundColor:"#FFFDF8",borderWidth:1,borderColor:"#EDE1C7",padding:13,flexDirection:"row",alignItems:"center",columnGap:12},cardLocked:{opacity:.68},art:{width:72,height:72,borderRadius:17},copy:{flex:1},kicker:{color:"#A88743",fontSize:10,fontFamily:"Outfit-Bold",letterSpacing:.6,marginBottom:3},title:{color:"#414846",fontSize:17,fontFamily:"Outfit-Bold",marginBottom:4},desc:{color:"#717A76",fontSize:13,lineHeight:18},reward:{color:"#9C7832",fontSize:11,lineHeight:15,fontFamily:"Outfit-Bold",marginTop:5}, cardList: { display: "flex", flexDirection: "column", gap: 14 } });
