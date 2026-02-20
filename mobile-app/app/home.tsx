import { Ionicons } from "@expo/vector-icons";
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";

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

        <View style={styles.quillCard}>
          <Text style={styles.quillTitle}>Ready to write today&apos;s chapter?{"\n"}Your journal is waiting.</Text>
          <View style={styles.featherWrap}>
            <View style={styles.featherShadow} />
            <View style={styles.featherPlaceholder}>
              <Ionicons name="leaf-outline" size={42} color="#7E6A4A" />
            </View>
          </View>
          <Pressable style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Pick Up the Quill</Text>
          </Pressable>
        </View>

        <View style={styles.entryCard}>
          <Text style={styles.entryMeta}>03 February 2026 · 9:00pm</Text>
          <Text style={styles.entryQuote}>
            &quot;Today, I did not do anything yet I feel so tired and Janice kept bugging me about the new game and
            a bug commit about the new area.&quot;
          </Text>
          <Pressable style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>View Full Entry</Text>
          </Pressable>

          <View style={styles.reflectionCard}>
            <Text style={styles.reflectionLabel}>AI-Generated Reflection</Text>
            <Text style={styles.reflectionText}>
              &quot;You&apos;ve mentioned feeling TIRED and DRAINED at least 4 times in this entry. You also noted a
              conflict with JANICE A.K.M regarding your ideas.&quot;
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Start Peer-Counseling</Text>
        <View style={styles.placeholderCard}>
          <View style={styles.placeholderInner} />
        </View>
        <Pressable style={styles.exploreButton}>
          <Text style={styles.primaryButtonText}>Explore</Text>
        </Pressable>

        <Text style={styles.sectionTitle}>Weekly Summary</Text>
        <View style={styles.placeholderCard} />
      </ScrollView>

      <View style={styles.bottomNav}>
        <Pressable style={styles.navItem}>
          <Ionicons name="home-outline" size={19} color="#6E6E6E" />
        </Pressable>
        <Pressable style={styles.navItem}>
          <Ionicons name="book-outline" size={19} color="#6E6E6E" />
        </Pressable>

        <View style={styles.centerNavWrap}>
          <Pressable style={styles.centerNavButton}>
            <Ionicons name="sparkles-outline" size={19} color="#4F4F4F" />
          </Pressable>
        </View>

        <Pressable style={styles.navItem}>
          <Ionicons name="chatbox-ellipses-outline" size={19} color="#6E6E6E" />
        </Pressable>
        <Pressable style={styles.navItem}>
          <Ionicons name="person-outline" size={19} color="#6E6E6E" />
        </Pressable>
      </View>
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
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#D7D7D7",
    backgroundColor: "#F7F7F7",
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 12,
    marginBottom: 10,
    shadowColor: "#A0A0A0",
    shadowOpacity: 0.25,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
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
    borderRadius: 999,
    backgroundColor: "#7A9EBA",
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#5E7D95",
    shadowOpacity: 0.34,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  entryCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#D7D7D7",
    backgroundColor: "#F7F7F7",
    padding: 10,
    marginBottom: 10,
    shadowColor: "#A0A0A0",
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
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
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#D7D7D7",
    backgroundColor: "#F7F7F7",
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
    borderRadius: 999,
    backgroundColor: "#7A9EBA",
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
    shadowColor: "#5E7D95",
    shadowOpacity: 0.34,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  bottomNav: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 58,
    borderTopWidth: 1,
    borderTopColor: "#E1E1E1",
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: 6,
  },
  navItem: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  centerNavWrap: {
    marginTop: -18,
  },
  centerNavButton: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: "#E2E6EA",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#D2D6DB",
  },
});
