import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
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
  MuniCollectionOption,
  MuniLoadout,
  purchaseMuniItem,
  saveMuniLoadout,
  TALA_IMAGE,
  useOwnedMuniItems,
  useSavedMuniLoadout,
  useSpentMuniTala,
} from "../lib/muni-wardrobe";

type AvatarMode = "wardrobe" | "shop";
type PurchaseNotice = {
  itemLabel: string;
};

export default function MuniAvatarScreen() {
  const { user } = useAuthSession();
  const [totalTala, setTotalTala] = useState(0);
  const savedItems = useSavedMuniLoadout();
  const ownedItems = useOwnedMuniItems();
  const spentTala = useSpentMuniTala();
  const [equippedItems, setEquippedItems] = useState<MuniLoadout>(() => getSavedMuniLoadout());
  const [activeMode, setActiveMode] = useState<AvatarMode>("wardrobe");
  const [purchaseNotice, setPurchaseNotice] = useState<PurchaseNotice | null>(null);

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
  const availableTala = Math.max(0, totalTala - spentTala);

  const handleSaveLoadout = useCallback(() => {
    saveMuniLoadout(equippedItems);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
  }, [equippedItems]);

  const handleEquipItem = useCallback((sectionId: keyof MuniLoadout, optionId: string) => {
    setEquippedItems((current) => ({
      ...current,
      [sectionId]: optionId,
    }));
    void Haptics.selectionAsync().catch(() => undefined);
  }, []);

  const handleBuyItem = useCallback(
    (sectionId: keyof MuniLoadout, option: MuniCollectionOption) => {
      if (availableTala < option.price) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
        return;
      }

      const purchased = purchaseMuniItem(sectionId, option.id);
      if (!purchased) {
        return;
      }

      setPurchaseNotice({
        itemLabel: option.label ?? option.id,
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    },
    [availableTala],
  );

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
            <Text style={styles.talaText}>{availableTala.toLocaleString("en-US")}</Text>
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
          <Text style={styles.collectionBadge}>{activeMode === "wardrobe" ? "Your Wardrobe" : "Muni Shop"}</Text>
        </View>

        <View style={styles.modeSwitchWrap}>
          <View style={styles.modeSwitch}>
            <Pressable
              style={[styles.modeButton, activeMode === "wardrobe" && styles.modeButtonActive]}
              onPress={() => setActiveMode("wardrobe")}
            >
              <Text style={[styles.modeButtonText, activeMode === "wardrobe" && styles.modeButtonTextActive]}>
                Wardrobe
              </Text>
            </Pressable>
            <Pressable
              style={[styles.modeButton, activeMode === "shop" && styles.modeButtonActive]}
              onPress={() => setActiveMode("shop")}
            >
              <Text style={[styles.modeButtonText, activeMode === "shop" && styles.modeButtonTextActive]}>Shop</Text>
            </Pressable>
          </View>
          <Text style={styles.modeHelperText}>
            {activeMode === "wardrobe"
              ? "Equip the pieces you already own."
              : "Use Tala to unlock new looks for Muni."}
          </Text>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {COLLECTION_SECTIONS.map((section) => (
          <View key={section.id} style={styles.sectionBlock}>
            <Text style={styles.sectionTitle}>{section.label}</Text>
            {activeMode === "wardrobe" ? (
              <View style={styles.optionRow}>
                {section.options
                  .filter((option) => ownedItems[section.id].includes(option.id))
                  .map((option) => {
                    const selected = equippedItems[section.id] === option.id;
                    return (
                      <Pressable
                        key={option.id}
                        style={[styles.optionCard, selected && styles.optionCardSelected]}
                        onPress={() => handleEquipItem(section.id, option.id)}
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
            ) : (
              <View style={styles.shopGrid}>
                {section.options.map((option) => {
                  const owned = ownedItems[section.id].includes(option.id);
                  const selected = equippedItems[section.id] === option.id;
                  const canAfford = availableTala >= option.price;
                  return (
                    <View
                      key={option.id}
                      style={[
                        styles.shopCard,
                        owned && styles.shopCardOwned,
                        selected && owned && styles.shopCardSelected,
                      ]}
                    >
                      <View style={styles.shopImageWrap}>
                        <Image
                          source={option.source}
                          style={section.id === "background" ? styles.shopBackgroundImage : styles.shopOptionImage}
                          resizeMode="contain"
                        />
                      </View>
                      <Text style={styles.shopLabel} numberOfLines={2}>
                        {option.label ?? option.id}
                      </Text>
                      {owned ? (
                        <View style={styles.shopOwnedInfo}>
                          <View style={[styles.shopStatusChip, selected && styles.shopStatusChipActive]}>
                            <Text style={[styles.shopStatusText, selected && styles.shopStatusTextActive]}>
                              {selected ? "Equipped" : "Owned"}
                            </Text>
                          </View>
                          <Text style={styles.shopOwnedHint}>
                            {selected ? "Currently on Muni" : "Ready in your wardrobe"}
                          </Text>
                        </View>
                      ) : (
                        <>
                          <View style={styles.priceRow}>
                            <Image source={TALA_IMAGE} style={styles.shopPriceIcon} resizeMode="contain" />
                            <Text style={styles.shopPriceText}>{option.price}</Text>
                          </View>
                          <Pressable
                            style={[styles.buyButton, !canAfford && styles.buyButtonDisabled]}
                            disabled={!canAfford}
                            onPress={() => handleBuyItem(section.id, option)}
                          >
                            <Text style={[styles.buyButtonText, !canAfford && styles.buyButtonTextDisabled]}>
                              {canAfford ? "Buy Now" : "Not enough Tala"}
                            </Text>
                          </Pressable>
                        </>
                      )}
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        ))}
      </ScrollView>

      <Modal
        visible={Boolean(purchaseNotice)}
        transparent
        animationType="fade"
        onRequestClose={() => setPurchaseNotice(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.unlockModalCard}>
            <View style={styles.unlockIconBadge}>
              <Ionicons name="bag-check-outline" size={28} color="#FFFFFF" />
            </View>
            <Text style={styles.unlockTitle}>New item unlocked!</Text>
            <Text style={styles.unlockBody}>
              {purchaseNotice
                ? `${purchaseNotice.itemLabel} is now unlocked and ready in your wardrobe.`
                : ""}
            </Text>

            <Pressable style={styles.unlockButton} onPress={() => setPurchaseNotice(null)}>
              <Text style={styles.unlockButtonText}>Nice</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

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
  modeSwitchWrap: {
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  modeSwitch: {
    height: 48,
    borderRadius: 18,
    backgroundColor: "#EFF5EA",
    borderWidth: 1,
    borderColor: "#D7E7C7",
    padding: 4,
    flexDirection: "row",
    columnGap: 6,
  },
  modeButton: {
    flex: 1,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  modeButtonActive: {
    backgroundColor: "#7CCB58",
    shadowColor: "#74B451",
    shadowOpacity: 0.14,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  modeButtonText: {
    color: "#62746A",
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "700",
  },
  modeButtonTextActive: {
    color: "#FFFFFF",
  },
  modeHelperText: {
    marginTop: 8,
    color: "#6D7E74",
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },
  sectionBlock: {
    marginBottom: 16,
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
  shopGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: 12,
    columnGap: 10,
    paddingHorizontal: 6,
  },
  shopCard: {
    width: "48%",
    alignSelf: "flex-start",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#D7E7C7",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 12,
    shadowColor: "#6C7D6D",
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  shopCardOwned: {
    backgroundColor: "#F7FBF2",
  },
  shopCardSelected: {
    borderColor: "#7CCB58",
  },
  shopImageWrap: {
    height: 72,
    borderRadius: 14,
    backgroundColor: "#F7F7F7",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    marginBottom: 8,
  },
  shopOptionImage: {
    width: "76%",
    height: "76%",
  },
  shopBackgroundImage: {
    width: "180%",
    height: "140%",
  },
  shopLabel: {
    color: "#33475C",
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "700",
    marginBottom: 6,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 4,
    marginBottom: 8,
  },
  shopPriceIcon: {
    width: 14,
    height: 14,
  },
  shopPriceText: {
    color: "#4A5C4B",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
  },
  buyButton: {
    height: 32,
    borderRadius: 999,
    backgroundColor: "#7CCB58",
    alignItems: "center",
    justifyContent: "center",
  },
  buyButtonDisabled: {
    backgroundColor: "#E4ECD9",
  },
  buyButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
  },
  buyButtonTextDisabled: {
    color: "#8A9583",
  },
  shopOwnedInfo: {
    marginTop: 2,
  },
  shopStatusChip: {
    height: 30,
    borderRadius: 999,
    backgroundColor: "#E8F4DF",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 14,
  },
  shopStatusChipActive: {
    backgroundColor: "#7CCB58",
  },
  shopStatusText: {
    color: "#5C7257",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
  },
  shopStatusTextActive: {
    color: "#FFFFFF",
  },
  shopOwnedHint: {
    marginTop: 6,
    color: "#71806F",
    fontSize: 11,
    lineHeight: 15,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(21, 27, 24, 0.34)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 22,
  },
  unlockModalCard: {
    width: "100%",
    maxWidth: 320,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 18,
    alignItems: "center",
    shadowColor: "#525C67",
    shadowOpacity: 0.16,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  unlockIconBadge: {
    width: 58,
    height: 58,
    borderRadius: 999,
    backgroundColor: "#7CCB58",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  unlockTitle: {
    color: "#33475C",
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "700",
    textAlign: "center",
  },
  unlockBody: {
    marginTop: 8,
    color: "#66776B",
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "500",
    textAlign: "center",
  },
  unlockButton: {
    marginTop: 18,
    minWidth: 140,
    minHeight: 42,
    borderRadius: 999,
    backgroundColor: "#7CCB58",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  unlockButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "700",
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
