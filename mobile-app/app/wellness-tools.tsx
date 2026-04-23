import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Image, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { HomeBottomNav } from "../components/home/HomeBottomNav";

type ToolItem = {
  accentColor: string;
  available: boolean;
  description: string;
  id: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  title: string;
};

const WELLNESS_TOOLS: ToolItem[] = [
  {
    accentColor: "#4F8A38",
    available: true,
    id: "breathing",
    label: "Open now",
    title: "Diaphragmatic Breathing",
    icon: "leaf-outline",
    description: "Regulate heart rate and reduce physiological stress responses through breathing patterns.",
  },
  {
    accentColor: "#537C68",
    available: true,
    id: "grounding",
    label: "Open now",
    title: "5-4-3-2-1 Sensory Grounding",
    icon: "eye-outline",
    description: "Interrupt anxiety loops and reconnect with your present surroundings using your senses.",
  },
  {
    accentColor: "#5E7396",
    available: false,
    id: "restructuring",
    label: "Coming soon",
    title: "Cognitive Restructuring Log",
    icon: "document-text-outline",
    description: "Reflect on unhelpful thoughts and gently rewrite them into more balanced perspectives.",
  },
];

const CENTER_LOGO_IMAGE = require("../assets/images/guidancelogo_sample.png");

export default function WellnessToolsScreen() {
  const { width } = useWindowDimensions();
  const frameWidth = Math.min(width - 24, 420);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/home");
  };

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.topBar}>
        <Pressable style={styles.backButton} accessibilityLabel="Go back" onPress={handleBack}>
          <Ionicons name="chevron-back" size={28} color="#37424F" />
        </Pressable>
        <Text style={styles.topTitle}>Wellness Tools</Text>
        <View style={styles.topBarSpacer} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={[styles.contentFrame, { width: frameWidth }]}>
          <View style={styles.heroCard}>
            <View style={styles.heroGlowOne} />
            <View style={styles.heroGlowTwo} />
            <View style={styles.heroBadge}>
              <Ionicons name="sparkles-outline" size={16} color="#4C7E32" />
              <Text style={styles.heroBadgeText}>Wellness Space</Text>
            </View>
            <Image source={CENTER_LOGO_IMAGE} style={styles.centerLogo} resizeMode="contain" />
            <Text style={styles.sectionTitle}>Our wellness tools are here for you.</Text>
            <Text style={styles.sectionDesc}>
              Explore calming, self-guided exercises designed to help you reset, ground yourself, and return with a little more clarity.
            </Text>
          </View>

          <View style={styles.listSection}>
            <Text style={styles.listHeading}>Explore Wellness Interventions</Text>
            <Text style={styles.listSubHeading}>Choose a tool that matches what you need right now.</Text>

            <View style={styles.toolList}>
            {WELLNESS_TOOLS.map((item) => (
              <Pressable
                key={item.id}
                disabled={!item.available}
                style={[styles.toolCard, !item.available && styles.toolCardDisabled]}
                onPress={() => {
                  if (item.id === "breathing") {
                    router.push("/wellness-breathing");
                    return;
                  }

                  if (item.id === "grounding") {
                    router.push("/wellness-grounding");
                  }
                }}
              >
                <View style={styles.toolCardTopRow}>
                  <View style={[styles.toolIconWrap, { backgroundColor: `${item.accentColor}14`, borderColor: `${item.accentColor}24` }]}>
                    <Ionicons name={item.icon} size={20} color={item.accentColor} />
                  </View>
                  <View style={[styles.toolTag, !item.available && styles.toolTagMuted]}>
                    <Text style={[styles.toolTagText, !item.available && styles.toolTagTextMuted]}>{item.label}</Text>
                  </View>
                </View>
                <Text style={styles.toolTitle}>{item.title}</Text>
                <View style={styles.toolRow}>
                  <Text style={styles.toolDesc}>{item.description}</Text>
                  <View style={styles.toolArrowWrap}>
                    <Ionicons name={item.available ? "arrow-forward" : "time-outline"} size={18} color="#4A5966" />
                  </View>
                </View>
              </Pressable>
            ))}
            </View>
          </View>
        </View>
      </ScrollView>

      <HomeBottomNav activeTab="home" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F7FAF6",
  },
  topBar: {
    height: 52,
    borderBottomWidth: 1,
    borderBottomColor: "#E6ECF1",
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
    fontSize: 36 / 2,
    lineHeight: 24,
    fontWeight: "700",
  },
  topBarSpacer: {
    width: 36,
    height: 36,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 12,
    paddingTop: 14,
    paddingBottom: 92,
    alignItems: "center",
  },
  contentFrame: {
    maxWidth: 420,
  },
  heroCard: {
    borderRadius: 28,
    backgroundColor: "#D7F0B7",
    borderWidth: 1,
    borderColor: "#C6E6A4",
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 18,
    overflow: "hidden",
    marginBottom: 14,
  },
  heroGlowOne: {
    position: "absolute",
    top: -28,
    right: -22,
    width: 140,
    height: 140,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.22)",
  },
  heroGlowTwo: {
    position: "absolute",
    left: -22,
    bottom: -48,
    width: 120,
    height: 120,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  heroBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    columnGap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.72)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.88)",
    marginBottom: 10,
  },
  heroBadgeText: {
    color: "#4C7E32",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
  },
  centerLogo: {
    width: "100%",
    maxWidth: 320,
    height: 138,
    alignSelf: "center",
    marginBottom: 8,
  },
  sectionTitle: {
    color: "#2F4156",
    fontSize: 24,
    lineHeight: 29,
    fontWeight: "700",
    marginBottom: 8,
  },
  sectionDesc: {
    color: "#446058",
    fontSize: 14,
    lineHeight: 20,
  },
  listSection: {
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E6EEE7",
    paddingHorizontal: 14,
    paddingTop: 16,
    paddingBottom: 18,
    shadowColor: "#66737E",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  listHeading: {
    color: "#2F4156",
    fontSize: 19,
    lineHeight: 24,
    fontWeight: "700",
    marginBottom: 4,
  },
  listSubHeading: {
    color: "#607181",
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 14,
  },
  toolList: {
    rowGap: 10,
  },
  toolCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#DDE8D6",
    backgroundColor: "#F9FCF7",
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 12,
  },
  toolCardDisabled: {
    opacity: 0.78,
  },
  toolCardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    columnGap: 10,
  },
  toolIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  toolTag: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#EDF8E6",
    borderWidth: 1,
    borderColor: "#D8EEC9",
  },
  toolTagMuted: {
    backgroundColor: "#F4F6F8",
    borderColor: "#E3E7EB",
  },
  toolTagText: {
    color: "#43702A",
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "700",
  },
  toolTagTextMuted: {
    color: "#6E7B87",
  },
  toolTitle: {
    color: "#33495D",
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "700",
    marginBottom: 6,
  },
  toolRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    columnGap: 10,
  },
  toolDesc: {
    flex: 1,
    color: "#5A6C7C",
    fontSize: 13,
    lineHeight: 18,
  },
  toolArrowWrap: {
    width: 28,
    height: 28,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E4EAEE",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
});
