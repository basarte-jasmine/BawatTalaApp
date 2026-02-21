import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { HomeBottomNav } from "../components/home/HomeBottomNav";
import { HomeCard } from "../components/home/HomeCard";
import { AppPrimaryButton } from "../components/ui/AppPrimaryButton";

export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.topRow}>
          <Text style={styles.helloText}>
            Hello,{"\n"}
            <Text style={styles.helloUser}>User</Text>
          </Text>
          <Pressable style={styles.bellButton}>
            <Ionicons name="notifications-outline" size={19} color="#222222" />
          </Pressable>
        </View>

        <HomeCard style={styles.quillCard}>
          <Text style={styles.quillTitle}>Ready to write today&apos;s chapter?{"\n"}Your journal is waiting.</Text>
          <View style={styles.featherWrap}>
            <View style={styles.featherShadow} />
            <View style={styles.featherPlaceholder}>
              <Ionicons name="leaf-outline" size={42} color="#7E6A4A" />
            </View>
          </View>
          <AppPrimaryButton
            label="Pick Up the Quill"
            containerStyle={styles.primaryButton}
            labelStyle={styles.primaryButtonText}
          />
        </HomeCard>

        <HomeCard style={styles.entryCard}>
          <Text style={styles.entryMeta}>03 February 2026 · 9:00pm</Text>
          <Text style={styles.entryQuote}>
            &quot;Today, I did not do anything yet I feel so tired and Janice kept bugging me about the new game and
            a bug commit about the new area.&quot;
          </Text>
          <AppPrimaryButton
            label="View Full Entry"
            containerStyle={styles.primaryButton}
            labelStyle={styles.primaryButtonText}
          />

          <View style={styles.reflectionCard}>
            <Text style={styles.reflectionLabel}>AI-Generated Reflection</Text>
            <Text style={styles.reflectionText}>
              &quot;You&apos;ve mentioned feeling TIRED and DRAINED at least 4 times in this entry. You also noted a
              conflict with JANICE A.K.M regarding your ideas.&quot;
            </Text>
          </View>
        </HomeCard>

        <Text style={styles.sectionTitle}>Start Peer-Counseling</Text>
        <HomeCard style={styles.placeholderCard}>
          <View style={styles.placeholderInner} />
        </HomeCard>
        <AppPrimaryButton label="Explore" containerStyle={styles.exploreButton} labelStyle={styles.primaryButtonText} />

        <Text style={styles.sectionTitle}>Weekly Summary</Text>
        <HomeCard style={styles.placeholderCard} />
      </ScrollView>

      <HomeBottomNav />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  scrollContent: {
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 96,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  helloText: {
    color: "#1A1A1A",
    fontSize: 18 / 2,
    lineHeight: 22,
  },
  helloUser: {
    fontSize: 38 / 2,
    fontWeight: "700",
    color: "#111111",
    fontFamily: "Fraunces-Regular",
  },
  bellButton: {
    padding: 4,
  },
  quillCard: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 12,
    marginBottom: 10,
    shadowOpacity: 0.25,
    shadowRadius: 5,
  },
  quillTitle: {
    textAlign: "center",
    color: "#111111",
    fontSize: 15,
    lineHeight: 20,
    marginBottom: 6,
    fontFamily: "Fraunces-Regular",
  },
  featherWrap: {
    height: 86,
    alignItems: "center",
    justifyContent: "center",
  },
  featherShadow: {
    position: "absolute",
    width: 88,
    height: 24,
    borderRadius: 999,
    backgroundColor: "#D6D6D6",
    transform: [{ rotate: "-16deg" }],
  },
  featherPlaceholder: {
    width: 74,
    height: 74,
    borderRadius: 999,
    backgroundColor: "#ECECEC",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#CFCFCF",
  },
  primaryButton: {
    width: 140,
    height: 28,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  entryCard: {
    padding: 10,
    marginBottom: 10,
  },
  entryMeta: {
    color: "#3D3D3D",
    fontSize: 11,
    marginBottom: 8,
    fontWeight: "600",
  },
  entryQuote: {
    color: "#2E2E2E",
    fontSize: 10,
    lineHeight: 15,
    marginBottom: 9,
  },
  reflectionCard: {
    marginTop: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#CED5DB",
    backgroundColor: "#EAF1F6",
    padding: 8,
  },
  reflectionLabel: {
    color: "#28333D",
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 6,
  },
  reflectionText: {
    color: "#1F2A33",
    fontSize: 10,
    lineHeight: 15,
  },
  sectionTitle: {
    color: "#323232",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 6,
  },
  placeholderCard: {
    minHeight: 80,
    marginBottom: 10,
    overflow: "hidden",
  },
  placeholderInner: {
    flex: 1,
    margin: 8,
    borderRadius: 8,
    borderStyle: "dashed",
    borderWidth: 1,
    borderColor: "#C9CFD5",
    backgroundColor: "#F1F4F7",
  },
  exploreButton: {
    width: 80,
    height: 28,
    marginBottom: 10,
  },
});
