import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { HomeBottomNav } from "../components/home/HomeBottomNav";
import { useAuthSession } from "../lib/auth-session";
import { fetchCheckInStatus } from "../lib/backend-api";
import {
  areMuniLoadoutsEqual,
  COLLECTION_SECTIONS,
  getEyeAccessoryStyle,
  getHeadAccessoryStyle,
  getMuniCollectionSource,
  getSavedMuniLoadout,
  MUNI_IMAGE,
  MuniLoadout,
  saveMuniLoadout,
  TALA_IMAGE,
  useSavedMuniLoadout,
} from "../lib/muni-wardrobe";

export default function MuniAvatarScreen() {
  const { user } = useAuthSession();
  const [totalTala, setTotalTala] = useState(0);
  const savedItems = useSavedMuniLoadout();
  const [equippedItems, setEquippedItems] = useState<MuniLoadout>(() => getSavedMuniLoadout());

  const loadTotalTala = useCallback(async () => {
    if (!user?.studentNumber) {
      setTotalTala(0);
      return;
    }

    const result = await fetchCheckInStatus(user.studentNumber);
    if (result.ok) {
      setTotalTala(result.totalTala ?? 0);
    }
  }, [user?.studentNumber]);

  useFocusEffect(
    useCallback(() => {
      void loadTotalTala();
    }, [loadTotalTala]),
  );

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/home");
  };

  useEffect(() => {
    setEquippedItems(savedItems);
  }, [savedItems]);

  const equippedBackgroundSource = getMuniCollectionSource("background", equippedItems.background);
  const equippedHeadSource = getMuniCollectionSource("head", equippedItems.head);
  const equippedEyeSource = getMuniCollectionSource("eye", equippedItems.eye);
  const equippedOutfitSource = getMuniCollectionSource("outfit", equippedItems.outfit);
  const equippedHeadStyle = getHeadAccessoryStyle(equippedItems.head);
  const equippedEyeStyle = getEyeAccessoryStyle(equippedItems.eye);
  const hasUnsavedChanges = !areMuniLoadoutsEqual(equippedItems, savedItems);

  const handleSaveLoadout = useCallback(() => {
    saveMuniLoadout(equippedItems);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
  }, [equippedItems]);
  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.topBar}>
        <Pressable style={styles.backButton} accessibilityLabel="Go back" onPress={handleBack}>
          <Ionicons name="chevron-back" size={28} color="#37424F" />
        </Pressable>
        <Text style={styles.topTitle}>Avatar</Text>
        <View style={styles.topBarSpacer} />
      </View>

      <View style={styles.previewSection}>
        <View style={styles.heroCard}>
          {equippedBackgroundSource ? (
            <View style={styles.heroBackgroundFrame}>
              <Image source={equippedBackgroundSource} style={styles.heroBackgroundImage} resizeMode="cover" />
            </View>
          ) : null}
          <View style={styles.heroOverlay} />

          <View style={styles.talaPill}>
            <Image source={TALA_IMAGE} style={styles.talaIcon} resizeMode="contain" />
            <Text style={styles.talaText}>{totalTala.toLocaleString("en-US")}</Text>
          </View>

          <Pressable
            style={[styles.circleBadge, hasUnsavedChanges && styles.circleBadgeActive]}
            accessibilityLabel="Save outfit"
            onPress={handleSaveLoadout}
          >
            <Ionicons name="checkmark" size={24} color="#FFFFFF" />
          </Pressable>

          <View style={styles.muniPreviewWrap}>
            <Image source={MUNI_IMAGE} style={styles.muniBaseImage} resizeMode="contain" />
            {equippedOutfitSource ? (
              <Image source={equippedOutfitSource} style={styles.muniAccessoryImage} resizeMode="contain" />
            ) : null}
            {equippedEyeSource ? (
              <Image
                source={equippedEyeSource}
                style={[styles.muniAccessoryImage, equippedEyeStyle]}
                resizeMode="contain"
              />
            ) : null}
            {equippedHeadSource ? (
              <Image
                source={equippedHeadSource}
                style={[styles.muniAccessoryImage, equippedHeadStyle]}
                resizeMode="contain"
              />
            ) : null}
          </View>
        </View>

        <View style={styles.collectionBadgeWrap}>
          <Text style={styles.collectionBadge}>Your Collection</Text>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {COLLECTION_SECTIONS.map((section) => (
          <View key={section.id} style={styles.sectionBlock}>
            <Text style={styles.sectionTitle}>{section.label}</Text>
            <View style={styles.optionRow}>
              {section.options.map((option) => {
                const selected = equippedItems[section.id] === option.id;
                return (
                  <Pressable
                    key={option.id}
                    style={[styles.optionCard, selected && styles.optionCardSelected]}
                    onPress={() =>
                      setEquippedItems((current) => ({
                        ...current,
                        [section.id]: option.id,
                      } as MuniLoadout))
                    }
                  >
                    <Image
                      source={option.source}
                      style={section.id === "background" ? styles.backgroundOptionImage : styles.optionImage}
                      resizeMode="contain"
                    />
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

      <HomeBottomNav activeTab="muni" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#FFFFFF",
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
    shadowColor: "#5C6570",
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
  previewSection: {
    backgroundColor: "#FFFFFF",
  },
  heroCard: {
    height: 260,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 3,
    borderBottomColor: "#7B5A4C",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    position: "relative",
    overflow: "hidden",
  },
  heroBackgroundFrame: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 0,
    overflow: "hidden",
  },
  heroBackgroundImage: {
    width: "100%",
    height: "100%",
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    zIndex: 1,
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
    backgroundColor: "#7CCB58",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 3,
  },
  circleBadgeActive: {
    backgroundColor: "#69C642",
  },
  muniPreviewWrap: {
    width: 180,
    height: 180,
    marginTop: 28,
    position: "relative",
    alignSelf: "center",
    zIndex: 2,
  },
  muniBaseImage: {
    position: "absolute",
    top: 0,
    left: 0,
    width: 180,
    height: 180,
    zIndex: 2,
  },
  muniAccessoryImage: {
    position: "absolute",
    top: 0,
    left: 0,
    width: 180,
    height: 180,
    zIndex: 3,
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
    flexWrap: "wrap",
    rowGap: 10,
    columnGap: 8,
    paddingHorizontal: 5,
  },
  optionCard: {
    width: "23%",
    aspectRatio: 0.95,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "#4A6C2B",
    backgroundColor: "#F2F2F2",
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  optionCardSelected: {
    borderColor: "#68AD3B",
  },
  optionImage: {
    width: "76%",
    height: "76%",
  },
  backgroundOptionImage: {
    width: "200%",
    height: "150%",
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
