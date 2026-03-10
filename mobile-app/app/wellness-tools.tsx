import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { HomeBottomNav } from "../components/home/HomeBottomNav";

type ToolItem = {
  description: string;
  id: string;
  title: string;
};

const WELLNESS_TOOLS: ToolItem[] = [
  {
    id: "breathing",
    title: "Diaphragmatic Breathing",
    description: "Regulate heart rate and reduce physiological stress responses through breathing patterns.",
  },
  {
    id: "grounding",
    title: "5-4-3-2-1 Sensory Grounding",
    description: "Interrupt anxiety loops and reconnect with your present surroundings using your senses.",
  },
  {
    id: "restructuring",
    title: "Cognitive Restructuring Log",
    description: "Regulate heart rate and reduce physiological stress responses through breathing patterns.",
  },
  {
    id: "breathing-2",
    title: "Diaphragmatic Breathing",
    description: "Regulate heart rate and reduce physiological stress responses through breathing patterns.",
  },
];

const CENTER_LOGO_IMAGE = require("../assets/images/guidancelogo_sample.png");

export default function WellnessToolsScreen() {
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
        <View style={styles.heroArea}>
          <Image source={CENTER_LOGO_IMAGE} style={styles.centerLogo} resizeMode="contain" />
        </View>

        <View style={styles.contentBlock}>
          <Text style={styles.sectionTitle}>Our Wellness Tools are here for you.</Text>
          <Text style={styles.sectionDesc}>
            Access self-guided interventions designed to regulate, improve cognitive focus, and restore balance.
          </Text>

          <Text style={styles.listHeading}>Explore Wellness Interventions</Text>

          <View style={styles.toolList}>
            {WELLNESS_TOOLS.map((item) => (
              <Pressable
                key={item.id}
                style={styles.toolCard}
                onPress={() => {
                  if (item.title === "Diaphragmatic Breathing") {
                    router.push("/wellness-breathing");
                  }
                }}
              >
                <Text style={styles.toolTitle}>{item.title}</Text>
                <View style={styles.toolRow}>
                  <Text style={styles.toolDesc}>{item.description}</Text>
                  <Ionicons name="chevron-forward" size={20} color="#4A5966" />
                </View>
              </Pressable>
            ))}
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
    paddingBottom: 90,
  },
  heroArea: {
    backgroundColor: "#B9E19F",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 184,
    paddingHorizontal: 18,
    paddingVertical: 18,
    borderBottomRightRadius: 24,
  },
  centerLogo: {
    width: "88%",
    maxWidth: 316,
    height: 132,
  },
  contentBlock: {
    marginTop: -12,
    borderTopLeftRadius: 24,
    backgroundColor: "#ECECEC",
    paddingTop: 20,
    paddingHorizontal: 12,
  },
  sectionTitle: {
    color: "#2F4156",
    fontSize: 34 / 2,
    lineHeight: 24,
    fontWeight: "700",
    marginBottom: 10,
  },
  sectionDesc: {
    color: "#33475C",
    fontSize: 16,
    lineHeight: 23,
    marginBottom: 18,
  },
  listHeading: {
    color: "#2F4156",
    fontSize: 36 / 2,
    lineHeight: 24,
    fontWeight: "700",
    marginBottom: 10,
  },
  toolList: {
    rowGap: 8,
  },
  toolCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#B8DFAB",
    backgroundColor: "#C9EEB8",
    paddingHorizontal: 10,
    paddingTop: 5,
    paddingBottom: 7,
  },
  toolTitle: {
    color: "#33495D",
    fontSize: 33 / 2,
    lineHeight: 23,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 3,
  },
  toolRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    columnGap: 8,
  },
  toolDesc: {
    flex: 1,
    color: "#31485B",
    fontSize: 15,
    lineHeight: 21,
  },
});
