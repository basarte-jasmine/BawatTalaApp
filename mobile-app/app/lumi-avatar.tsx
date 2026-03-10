import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { HomeBottomNav } from "../components/home/HomeBottomNav";

type CollectionSection = {
  id: string;
  label: string;
  selectedIndexes?: number[];
};

const COLLECTION_SECTIONS: CollectionSection[] = [
  { id: "background", label: "Background", selectedIndexes: [0, 1] },
  { id: "face", label: "Face" },
  { id: "outfit", label: "Outfit" },
];

const TALA_IMAGE = require("../assets/images/tala_sample.png");
const LUMI_IMAGE = require("../assets/images/pet_sample.png");

export default function LumiAvatarScreen() {
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
        <Text style={styles.topTitle}>Avatar</Text>
        <View style={styles.topBarSpacer} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <View style={styles.talaPill}>
            <Image source={TALA_IMAGE} style={styles.talaIcon} resizeMode="contain" />
            <Text style={styles.talaText}>10,000</Text>
          </View>

          <View style={styles.circleBadge} />

          <Image source={LUMI_IMAGE} style={styles.lumiImage} resizeMode="contain" />
        </View>

        <View style={styles.collectionBadgeWrap}>
          <Text style={styles.collectionBadge}>Your Collection</Text>
        </View>

        {COLLECTION_SECTIONS.map((section) => (
          <View key={section.id} style={styles.sectionBlock}>
            <Text style={styles.sectionTitle}>{section.label}</Text>
            <View style={styles.optionRow}>
              {[0, 1, 2, 3].map((index) => {
                const selected = section.selectedIndexes?.includes(index);
                return (
                  <Pressable key={`${section.id}-${index}`} style={[styles.optionCard, selected && styles.optionCardSelected]}>
                    {selected ? (
                      <View style={styles.checkBadge}>
                        <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>

      <HomeBottomNav activeTab="lumi" />
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
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 96,
  },
  heroCard: {
    height: 260,
    backgroundColor: "#B9E19F",
    borderBottomWidth: 3,
    borderBottomColor: "#7B5A4C",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    position: "relative",
  },
  talaPill: {
    position: "absolute",
    top: 8,
    left: 6,
    minWidth: 90,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#F2EB9F",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
    columnGap: 3,
  },
  talaIcon: {
    width: 16,
    height: 16,
  },
  talaText: {
    color: "#445463",
    fontSize: 33 / 2,
    lineHeight: 22,
    fontWeight: "700",
  },
  circleBadge: {
    position: "absolute",
    top: 10,
    right: 8,
    width: 46,
    height: 46,
    borderRadius: 999,
    backgroundColor: "#69C642",
  },
  lumiImage: {
    width: 206,
    height: 206,
    marginTop: 28,
  },
  collectionBadgeWrap: {
    alignItems: "center",
    marginTop: -10,
    marginBottom: 8,
  },
  collectionBadge: {
    minWidth: 132,
    height: 34,
    borderRadius: 8,
    borderWidth: 4,
    borderColor: "#7B5A4C",
    backgroundColor: "#F7F7F7",
    textAlign: "center",
    textAlignVertical: "center",
    color: "#34475A",
    fontSize: 17,
    lineHeight: 34 - 4,
    fontWeight: "700",
    paddingHorizontal: 10,
    overflow: "hidden",
  },
  sectionBlock: {
    marginBottom: 8,
  },
  sectionTitle: {
    color: "#324254",
    fontSize: 32 / 2,
    lineHeight: 22,
    fontWeight: "700",
    marginBottom: 8,
    paddingHorizontal: 6,
  },
  optionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 5,
  },
  optionCard: {
    width: "23.6%",
    aspectRatio: 0.95,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "#4A6C2B",
    backgroundColor: "#F2F2F2",
    position: "relative",
  },
  optionCardSelected: {
    borderColor: "#68AD3B",
  },
  checkBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 21,
    height: 21,
    borderRadius: 999,
    backgroundColor: "#E3C92B",
    alignItems: "center",
    justifyContent: "center",
  },
});
