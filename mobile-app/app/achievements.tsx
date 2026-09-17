import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuthSession } from "../lib/auth-session";

const BOTTLE_ART = require("../assets/images/Achievements/A Bottle for Tomorrow.jpg");

export default function AchievementsScreen() {
  const { user } = useAuthSession();
  const [unlocked, setUnlocked] = useState(false);
  useEffect(() => { if (user?.studentNumber) void AsyncStorage.getItem(`@bawat-tala/future-bottle:${user.studentNumber}`).then((value) => setUnlocked(Boolean(value && value !== "[]"))); }, [user?.studentNumber]);
  return <SafeAreaView style={styles.screen} edges={["top"]}><View style={styles.topBar}><Pressable style={styles.back} onPress={() => router.back()}><Ionicons name="chevron-back" size={28} color="#37424F" /></Pressable><Text style={styles.topTitle}>Achievements</Text><View style={styles.back} /></View><ScrollView contentContainerStyle={styles.content}><View style={styles.summary}><View style={styles.medal}><Ionicons name="ribbon" size={26} color="#F5C447" /></View><View><Text style={styles.summaryTitle}>{unlocked ? "1 achievement unlocked" : "Your achievements"}</Text><Text style={styles.summaryText}>{unlocked ? "Small moments of care count." : "Your milestones will appear here."}</Text></View></View><View style={[styles.card, !unlocked && styles.cardLocked]}><Image source={BOTTLE_ART} style={styles.art} resizeMode="cover" /><View style={styles.copy}><Text style={styles.kicker}>{unlocked ? "UNLOCKED" : "LOCKED"}</Text><Text style={styles.title}>A Bottle for Tomorrow</Text><Text style={styles.desc}>Write your first future bottle note.</Text></View><Ionicons name={unlocked ? "ribbon" : "lock-closed-outline"} size={23} color={unlocked ? "#B08A35" : "#9AA4AC"} /></View></ScrollView></SafeAreaView>;
}
const styles = StyleSheet.create({ screen:{flex:1,backgroundColor:"#F7FAF6"},topBar:{height:52,backgroundColor:"#FFF",borderBottomWidth:1,borderBottomColor:"#E6ECF1",flexDirection:"row",alignItems:"center",justifyContent:"space-between",paddingHorizontal:4},back:{width:42,height:42,alignItems:"center",justifyContent:"center"},topTitle:{color:"#33475C",fontSize:18,fontFamily:"Outfit-Bold"},content:{padding:16},summary:{borderRadius:22,backgroundColor:"#303B4B",padding:18,flexDirection:"row",alignItems:"center",columnGap:13,marginBottom:14},medal:{width:48,height:48,borderRadius:16,backgroundColor:"#46566A",alignItems:"center",justifyContent:"center"},summaryTitle:{color:"#FFF",fontFamily:"Outfit-Bold",fontSize:17,marginBottom:3},summaryText:{color:"#D5DEE6",fontSize:13},card:{borderRadius:22,backgroundColor:"#FFFDF8",borderWidth:1,borderColor:"#EDE1C7",padding:13,flexDirection:"row",alignItems:"center",columnGap:12},cardLocked:{opacity:.68},art:{width:72,height:72,borderRadius:17},copy:{flex:1},kicker:{color:"#A88743",fontSize:10,fontFamily:"Outfit-Bold",letterSpacing:.6,marginBottom:3},title:{color:"#414846",fontSize:17,fontFamily:"Outfit-Bold",marginBottom:4},desc:{color:"#717A76",fontSize:13,lineHeight:18} });
