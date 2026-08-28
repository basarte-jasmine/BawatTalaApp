import { HomeBottomNav } from "../components/home/HomeBottomNav";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MuniAvatar } from "../components/muni/MuniAvatar";
import { useAuthSession } from "../lib/auth-session";
import {
  areMuniLoadoutsEqual,
  COLLECTION_SECTIONS,
  getMuniCollectionSource,
  getSavedMuniLoadout,
  hydrateMuniWardrobe,
  MuniCollectionOption,
  MuniLoadout,
  purchaseMuniItem,
  saveMuniLoadout,
  TALA_IMAGE,
  useAvailableMuniTala,
  useOwnedMuniItems,
  useSavedMuniLoadout,
} from "../lib/muni-wardrobe";

type AvatarMode = "wardrobe" | "shop";
type PurchaseNotice = {
  itemLabel: string;
  optionId: string;
  sectionId: keyof MuniLoadout;
};

const SECTION_META: Record<keyof MuniLoadout, { icon: string }> = {
  background: { icon: "image-outline" },
  eye: { icon: "eye-outline" },
  head: { icon: "sparkles-outline" },
  outfit: { icon: "shirt-outline" },
};

export default function MuniAvatarScreen() {
  const { user } = useAuthSession();
  const savedItems = useSavedMuniLoadout();
  const ownedItems = useOwnedMuniItems();
  const availableTala = useAvailableMuniTala();
  const [equippedItems, setEquippedItems] = useState<MuniLoadout>(() => getSavedMuniLoadout());
  const [activeMode, setActiveMode] = useState<AvatarMode>("wardrobe");
  const [purchaseNotice, setPurchaseNotice] = useState<PurchaseNotice | null>(null);
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const [pendingLeaveRoute, setPendingLeaveRoute] = useState<string | null>(null);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [isSavingLoadout, setIsSavingLoadout] = useState(false);

  const loadWardrobe = useCallback(async () => {
    if (!user?.studentNumber) {
      return;
    }
    await hydrateMuniWardrobe(user.studentNumber);
  }, [user?.studentNumber]);

  useFocusEffect(
    useCallback(() => {
      void loadWardrobe();
    }, [loadWardrobe]),
  );

  const leaveScreen = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/home");
  };

  const handleBack = () => {
    if (!hasUnsavedChanges) {
      leaveScreen();
      return;
    }
    setPendingLeaveRoute(null);
    setShowUnsavedModal(true);
  };

  const handleConfirmLeave = () => {
    setShowUnsavedModal(false);
    setEquippedItems(savedItems);
    if (pendingLeaveRoute === "/muni-voice") {
      router.push("/muni-voice" as never);
      return;
    }
    if (pendingLeaveRoute) {
      router.replace(pendingLeaveRoute as never);
      return;
    }
    leaveScreen();
  };

  useEffect(() => {
    setEquippedItems(savedItems);
  }, [savedItems]);

  const equippedBackgroundSource = getMuniCollectionSource("background", equippedItems.background);
  const hasUnsavedChanges = !areMuniLoadoutsEqual(equippedItems, savedItems);
  const ownedItemCount = COLLECTION_SECTIONS.reduce((sum, section) => sum + ownedItems[section.id].length, 0);
  const totalItemCount = COLLECTION_SECTIONS.reduce((sum, section) => sum + section.options.length, 0);
  const equippedItemCount = Object.values(equippedItems).filter(Boolean).length;

  const handleSaveLoadout = useCallback(async () => {
    if (!hasUnsavedChanges || isSavingLoadout) {
      return;
    }
    setIsSavingLoadout(true);
    const saved = await saveMuniLoadout(equippedItems);
    setIsSavingLoadout(false);
    if (!saved) {
      setPurchaseError("Your last saved outfit is still on Muni. Please try again.");
      return;
    }
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
  }, [equippedItems, hasUnsavedChanges, isSavingLoadout]);

  const handleEquipItem = useCallback((sectionId: keyof MuniLoadout, optionId: string | null) => {
    setEquippedItems((current) => ({
      ...current,
      [sectionId]: optionId,
    }));
    void Haptics.selectionAsync().catch(() => undefined);
  }, []);

  const handleBuyItem = useCallback(
    async (sectionId: keyof MuniLoadout, option: MuniCollectionOption) => {
      if (availableTala < option.price) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
        setPurchaseError(`You need ${option.price} Tala to unlock ${option.label ?? option.id}.`);
        return;
      }

      const purchased = await purchaseMuniItem(sectionId, option.id);
      if (!purchased) {
        setPurchaseError("The item could not be unlocked. Please try again.");
        return;
      }

      setPurchaseNotice({
        itemLabel: option.label ?? option.id,
        optionId: option.id,
        sectionId,
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    },
    [availableTala],
  );

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <View style={styles.topBar}>
        <Pressable style={styles.backButton} accessibilityLabel="Go back" onPress={handleBack}>
          <Ionicons name="chevron-back" size={26} color="#304456" />
        </Pressable>
        <Text style={styles.topTitle}>Muni Wardrobe</Text>
        <View style={styles.topBarSpacer} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.previewSection}>
          <View style={styles.heroCard}>
            {equippedBackgroundSource ? (
              <Image source={equippedBackgroundSource} style={styles.heroBackgroundImage} resizeMode="cover" />
            ) : null}
            <View style={styles.heroOverlay} />

            <View style={styles.heroTopRow}>
              <View style={styles.talaPill}>
                <Image source={TALA_IMAGE} style={styles.talaIcon} resizeMode="contain" />
                <Text style={styles.talaText}>{availableTala.toLocaleString("en-US")}</Text>
              </View>

              <Pressable
                style={[styles.saveButton, hasUnsavedChanges ? styles.saveButtonActive : styles.saveButtonSaved]}
                accessibilityLabel="Save outfit"
                disabled={!hasUnsavedChanges || isSavingLoadout}
                onPress={() => void handleSaveLoadout()}
              >
                <Ionicons
                  name={hasUnsavedChanges ? "checkmark-circle" : "checkmark-circle-outline"}
                  size={18}
                  color={hasUnsavedChanges ? "#FFFFFF" : "#5E7259"}
                />
                <Text style={[styles.saveButtonText, hasUnsavedChanges && styles.saveButtonTextActive]}>
                  {isSavingLoadout ? "Saving..." : hasUnsavedChanges ? "Save look" : "Saved"}
                </Text>
              </Pressable>
            </View>

            <View style={styles.muniPreviewWrap}>
              <MuniAvatar loadout={equippedItems} style={styles.muniPreviewAvatar} />
            </View>

            <View style={styles.heroStatsRow}>
              <View style={styles.heroStatPill}>
                <Text style={styles.heroStatValue}>{equippedItemCount}/4</Text>
                <Text style={styles.heroStatLabel}>Equipped</Text>
              </View>
              <View style={styles.heroStatPill}>
                <Text style={styles.heroStatValue}>
                  {ownedItemCount}/{totalItemCount}
                </Text>
                <Text style={styles.heroStatLabel}>Owned</Text>
              </View>
            </View>
          </View>

          <View style={styles.collectionHeader}>
            <View style={styles.collectionTitleWrap}>
              <Text style={styles.collectionKicker}>{activeMode === "wardrobe" ? "Wardrobe" : "Shop"}</Text>
              <Text style={styles.collectionTitle}>{activeMode === "wardrobe" ? "Your collection" : "New pieces"}</Text>
            </View>
            <View style={styles.collectionCountPill}>
              <Ionicons
                name={activeMode === "wardrobe" ? "shirt-outline" : "bag-handle-outline"}
                size={15}
                color="#507143"
              />
              <Text style={styles.collectionCountText}>
                {activeMode === "wardrobe" ? `${ownedItemCount} owned` : `${availableTala} Tala`}
              </Text>
            </View>
          </View>

          <View style={styles.modeSwitch}>
            <Pressable
              style={[styles.modeButton, activeMode === "wardrobe" && styles.modeButtonActive]}
              onPress={() => setActiveMode("wardrobe")}
            >
              <Ionicons
                name={activeMode === "wardrobe" ? "shirt" : "shirt-outline"}
                size={17}
                color={activeMode === "wardrobe" ? "#FFFFFF" : "#62746A"}
              />
              <Text style={[styles.modeButtonText, activeMode === "wardrobe" && styles.modeButtonTextActive]}>
                Wardrobe
              </Text>
            </Pressable>
            <Pressable
              style={[styles.modeButton, activeMode === "shop" && styles.modeButtonActive]}
              onPress={() => setActiveMode("shop")}
            >
              <Ionicons
                name={activeMode === "shop" ? "bag-handle" : "bag-handle-outline"}
                size={17}
                color={activeMode === "shop" ? "#FFFFFF" : "#62746A"}
              />
              <Text style={[styles.modeButtonText, activeMode === "shop" && styles.modeButtonTextActive]}>Shop</Text>
            </Pressable>
          </View>
        </View>

        {COLLECTION_SECTIONS.map((section) => {
          const ownedOptions = section.options.filter((option) => ownedItems[section.id].includes(option.id));
          const sectionCount = activeMode === "wardrobe" ? `${ownedOptions.length}/${section.options.length}` : `${section.options.length}`;

          return (
            <View key={section.id} style={styles.sectionBlock}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionTitleRow}>
                  <View style={styles.sectionIconBadge}>
                    <Ionicons name={SECTION_META[section.id].icon as any} size={16} color="#527144" />
                  </View>
                  <Text style={styles.sectionTitle}>{section.label}</Text>
                </View>
                <Text style={styles.sectionCountText}>{sectionCount}</Text>
              </View>

              {activeMode === "wardrobe" ? (
                <View style={styles.optionRow}>
                  <Pressable
                    style={[styles.optionCard, equippedItems[section.id] == null && styles.optionCardSelected]}
                    onPress={() => handleEquipItem(section.id, null)}
                  >
                    <View
                      style={[
                        styles.optionImageWell,
                        section.id === "background" && styles.optionImageWellBackground,
                      ]}
                    >
                      <Ionicons name="remove-circle-outline" size={28} color="#6B7C6A" />
                    </View>
                    <Text
                      style={[
                        styles.optionLabel,
                        equippedItems[section.id] == null && styles.optionLabelSelected,
                      ]}
                    >
                      None
                    </Text>
                    {equippedItems[section.id] == null ? (
                      <View style={styles.checkBadge}>
                        <Ionicons name="checkmark" size={15} color="#FFFFFF" />
                      </View>
                    ) : null}
                  </Pressable>
                  {ownedOptions.map((option) => {
                    const selected = equippedItems[section.id] === option.id;
                    return (
                      <Pressable
                        key={option.id}
                        style={[styles.optionCard, selected && styles.optionCardSelected]}
                        onPress={() => handleEquipItem(section.id, option.id)}
                      >
                        <View
                          style={[
                            styles.optionImageWell,
                            section.id === "background" && styles.optionImageWellBackground,
                          ]}
                        >
                          <Image
                            source={option.source}
                            style={section.id === "background" ? styles.backgroundOptionImage : styles.optionImage}
                            resizeMode={section.id === "background" ? "cover" : "contain"}
                          />
                        </View>
                        <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]} numberOfLines={1}>
                          {option.label ?? option.id}
                        </Text>
                        {selected ? (
                          <View style={styles.checkBadge}>
                            <Ionicons name="checkmark" size={15} color="#FFFFFF" />
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
                            resizeMode={section.id === "background" ? "cover" : "contain"}
                          />
                        </View>
                        <Text style={styles.shopLabel} numberOfLines={2}>
                          {option.label ?? option.id}
                        </Text>

                        {owned ? (
                          <>
                            <View style={[styles.shopStatusChip, selected && styles.shopStatusChipActive]}>
                              <Ionicons
                                name={selected ? "checkmark-circle" : "checkmark-circle-outline"}
                                size={14}
                                color={selected ? "#FFFFFF" : "#5C7257"}
                              />
                              <Text style={[styles.shopStatusText, selected && styles.shopStatusTextActive]}>
                                {selected ? "Equipped" : "Owned"}
                              </Text>
                            </View>
                            <Pressable
                              style={[styles.wearButton, selected && styles.wearButtonSelected]}
                              disabled={selected}
                              onPress={() => handleEquipItem(section.id, option.id)}
                            >
                              <Text style={[styles.wearButtonText, selected && styles.wearButtonTextSelected]}>
                                {selected ? "On Muni" : "Wear"}
                              </Text>
                            </Pressable>
                          </>
                        ) : (
                          <>
                            <View style={styles.priceRow}>
                              <Image source={TALA_IMAGE} style={styles.shopPriceIcon} resizeMode="contain" />
                              <Text style={styles.shopPriceText}>{option.price}</Text>
                            </View>
                            <Pressable
                              style={[styles.buyButton, !canAfford && styles.buyButtonDisabled]}
                              onPress={() => void handleBuyItem(section.id, option)}
                            >
                              <Ionicons name="bag-add-outline" size={14} color={canAfford ? "#FFFFFF" : "#8A9583"} />
                              <Text style={[styles.buyButtonText, !canAfford && styles.buyButtonTextDisabled]}>
                                {canAfford ? "Unlock" : "Need Tala"}
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
          );
        })}
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
              {purchaseNotice ? `${purchaseNotice.itemLabel} is now unlocked and ready in your wardrobe.` : ""}
            </Text>

            <Pressable
              style={styles.unlockButton}
              onPress={() => {
                if (purchaseNotice) {
                  setEquippedItems((current) => ({
                    ...current,
                    [purchaseNotice.sectionId]: purchaseNotice.optionId,
                  }));
                  setActiveMode("wardrobe");
                }
                setPurchaseNotice(null);
              }}
            >
              <Text style={styles.unlockButtonText}>Wear now</Text>
            </Pressable>
            <Pressable style={[styles.unlockButton, styles.unlockSecondaryButton]} onPress={() => setPurchaseNotice(null)}>
              <Text style={[styles.unlockButtonText, styles.unlockSecondaryButtonText]}>Keep shopping</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showUnsavedModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowUnsavedModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Unsaved look</Text>
            <Text style={styles.modalBody}>
              You have unsaved changes to Muni's outfit. Do you want to leave without saving?
            </Text>

            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalSecondaryButton}
                onPress={() => setShowUnsavedModal(false)}
              >
                <Text style={styles.modalSecondaryText}>Stay</Text>
              </Pressable>

              <Pressable
                style={styles.modalDangerButton}
                onPress={handleConfirmLeave}
              >
                <Text style={styles.modalDangerText}>Leave</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={Boolean(purchaseError)}
        transparent
        animationType="fade"
        onRequestClose={() => setPurchaseError(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Notice</Text>
            <Text style={styles.modalBody}>{purchaseError}</Text>
            <Pressable
              style={styles.modalPrimaryButton}
              onPress={() => setPurchaseError(null)}
            >
              <Text style={styles.modalPrimaryText}>OK</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <HomeBottomNav
        activeTab="muni"
        onBeforeLeave={(nextRoute) => {
          if (!hasUnsavedChanges) {
            return true;
          }
          setPendingLeaveRoute(nextRoute);
          setShowUnsavedModal(true);
          return false;
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F5F9F1",
  },
  topBar: {
    height: 56,
    borderBottomWidth: 1,
    borderBottomColor: "#DDE7D7",
    backgroundColor: "#FEFFFC",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    shadowColor: "#5C6570",
    shadowOpacity: 0.1,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 999,
    backgroundColor: "#F1F6EE",
    borderWidth: 1,
    borderColor: "#E0EADC",
    alignItems: "center",
    justifyContent: "center",
  },
  topTitle: {
    color: "#304558",
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "800",
  },
  topBarSpacer: {
    width: 38,
    height: 38,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 116,
  },
  previewSection: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 18,
  },
  heroCard: {
    height: 292,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#D8E6D0",
    backgroundColor: "#DDEFD6",
    position: "relative",
    overflow: "hidden",
    shadowColor: "#677566",
    shadowOpacity: 0.14,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  heroBackgroundImage: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255, 255, 255, 0.16)",
    zIndex: 1,
  },
  heroTopRow: {
    position: "absolute",
    top: 12,
    left: 12,
    right: 12,
    zIndex: 4,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    columnGap: 10,
  },
  talaPill: {
    minWidth: 96,
    height: 38,
    borderRadius: 999,
    backgroundColor: "rgba(255, 251, 205, 0.94)",
    borderWidth: 1,
    borderColor: "rgba(222, 199, 86, 0.6)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    columnGap: 5,
  },
  talaIcon: {
    width: 17,
    height: 17,
  },
  talaText: {
    color: "#465665",
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "800",
  },
  saveButton: {
    minWidth: 104,
    height: 38,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    columnGap: 5,
  },
  saveButtonActive: {
    backgroundColor: "#70C943",
    borderWidth: 1,
    borderColor: "#5CB72F",
    shadowColor: "#5C8B43",
    shadowOpacity: 0.18,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  saveButtonSaved: {
    backgroundColor: "rgba(255, 255, 255, 0.88)",
    borderWidth: 1,
    borderColor: "rgba(218, 231, 212, 0.92)",
  },
  saveButtonText: {
    color: "#5E7259",
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "800",
  },
  saveButtonTextActive: {
    color: "#FFFFFF",
  },
  muniPreviewWrap: {
    position: "absolute",
    left: "50%",
    bottom: 54,
    width: 205,
    height: 205,
    marginLeft: -102.5,
    zIndex: 3,
  },
  muniPreviewAvatar: {
    width: 205,
    height: 205,
  },
  heroStatsRow: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 12,
    zIndex: 4,
    flexDirection: "row",
    columnGap: 8,
  },
  heroStatPill: {
    flex: 1,
    minHeight: 38,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.88)",
    borderWidth: 1,
    borderColor: "rgba(224, 234, 220, 0.9)",
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    columnGap: 6,
  },
  heroStatValue: {
    color: "#304558",
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "900",
  },
  heroStatLabel: {
    color: "#607181",
    fontSize: 12,
    lineHeight: 15,
    fontWeight: "700",
  },
  collectionHeader: {
    marginTop: 18,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    columnGap: 12,
  },
  collectionTitleWrap: {
    flex: 1,
  },
  collectionKicker: {
    color: "#6F845C",
    fontSize: 12,
    lineHeight: 15,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  collectionTitle: {
    marginTop: 2,
    color: "#304558",
    fontSize: 23,
    lineHeight: 29,
    fontWeight: "900",
  },
  collectionCountPill: {
    minHeight: 34,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DDE9D7",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    columnGap: 5,
  },
  collectionCountText: {
    color: "#507143",
    fontSize: 12,
    lineHeight: 15,
    fontWeight: "800",
  },
  modeSwitch: {
    height: 50,
    borderRadius: 18,
    backgroundColor: "#E9F2E4",
    borderWidth: 1,
    borderColor: "#D6E6CF",
    padding: 4,
    flexDirection: "row",
    columnGap: 6,
  },
  modeButton: {
    flex: 1,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    columnGap: 6,
  },
  modeButtonActive: {
    backgroundColor: "#70C943",
    shadowColor: "#5D9742",
    shadowOpacity: 0.16,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  modeButtonText: {
    color: "#62746A",
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "800",
  },
  modeButtonTextActive: {
    color: "#FFFFFF",
  },
  sectionBlock: {
    marginBottom: 18,
    paddingHorizontal: 14,
  },
  sectionHeader: {
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitleRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    columnGap: 8,
  },
  sectionIconBadge: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: "#EAF5E3",
    borderWidth: 1,
    borderColor: "#D7E7CF",
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    color: "#304558",
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "900",
  },
  sectionCountText: {
    color: "#6B7B88",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
  },
  optionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: 10,
    columnGap: 8,
  },
  optionCard: {
    width: "31.4%",
    minHeight: 124,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#DDE8D8",
    backgroundColor: "#FFFFFF",
    position: "relative",
    padding: 7,
    shadowColor: "#71806E",
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  optionCardSelected: {
    borderColor: "#70C943",
    backgroundColor: "#F7FCF3",
  },
  optionImageWell: {
    height: 78,
    borderRadius: 14,
    backgroundColor: "#F4F7F2",
    borderWidth: 1,
    borderColor: "#E4ECE0",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  optionImageWellBackground: {
    backgroundColor: "#DDEFD6",
  },
  optionImage: {
    width: "78%",
    height: "78%",
  },
  backgroundOptionImage: {
    width: "100%",
    height: "100%",
  },
  optionLabel: {
    marginTop: 7,
    color: "#405368",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
    textAlign: "center",
  },
  optionLabelSelected: {
    color: "#2F6F25",
  },
  checkBadge: {
    position: "absolute",
    top: 7,
    right: 7,
    width: 22,
    height: 22,
    borderRadius: 999,
    backgroundColor: "#70C943",
    borderWidth: 1,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  shopGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: 12,
    columnGap: 10,
  },
  shopCard: {
    width: "48%",
    alignSelf: "flex-start",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#DDE8D8",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 12,
    shadowColor: "#71806E",
    shadowOpacity: 0.08,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  shopCardOwned: {
    backgroundColor: "#F7FCF3",
  },
  shopCardSelected: {
    borderColor: "#70C943",
  },
  shopImageWrap: {
    height: 86,
    borderRadius: 15,
    backgroundColor: "#F4F7F2",
    borderWidth: 1,
    borderColor: "#E4ECE0",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    marginBottom: 9,
  },
  shopOptionImage: {
    width: "76%",
    height: "76%",
  },
  shopBackgroundImage: {
    width: "100%",
    height: "100%",
  },
  shopLabel: {
    minHeight: 36,
    color: "#304558",
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "900",
    marginBottom: 8,
  },
  priceRow: {
    minHeight: 28,
    flexDirection: "row",
    alignItems: "center",
    columnGap: 5,
    marginBottom: 8,
  },
  shopPriceIcon: {
    width: 15,
    height: 15,
  },
  shopPriceText: {
    color: "#4F6047",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "900",
  },
  buyButton: {
    minHeight: 34,
    borderRadius: 999,
    backgroundColor: "#70C943",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    columnGap: 5,
    paddingHorizontal: 10,
  },
  buyButtonDisabled: {
    backgroundColor: "#E4ECD9",
  },
  buyButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "900",
  },
  buyButtonTextDisabled: {
    color: "#8A9583",
  },
  shopStatusChip: {
    minHeight: 28,
    borderRadius: 999,
    backgroundColor: "#E8F4DF",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    flexDirection: "row",
    columnGap: 4,
    marginBottom: 8,
  },
  shopStatusChipActive: {
    backgroundColor: "#70C943",
  },
  shopStatusText: {
    color: "#5C7257",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "900",
  },
  shopStatusTextActive: {
    color: "#FFFFFF",
  },
  wearButton: {
    minHeight: 34,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D8E6D0",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  wearButtonSelected: {
    backgroundColor: "#F0F7EA",
    borderColor: "#D8E6D0",
  },
  wearButtonText: {
    color: "#355468",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "900",
  },
  wearButtonTextSelected: {
    color: "#5D7258",
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
    backgroundColor: "#70C943",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  unlockTitle: {
    color: "#33475C",
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "800",
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
    backgroundColor: "#70C943",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  unlockSecondaryButton: {
    backgroundColor: "#EEF4E8",
    marginTop: 8,
  },
  unlockSecondaryButtonText: {
    color: "#4E6748",
  },
  unlockButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "800",
  },
  modalCard: {
    width: "100%",
    maxWidth: 320,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 18,
    shadowColor: "#525C67",
    shadowOpacity: 0.16,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  modalTitle: {
    color: "#34465A",
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 8,
  },
  modalBody: {
    color: "#52606C",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500",
    textAlign: "center",
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: "row",
    columnGap: 10,
  },
  modalSecondaryButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#CDD5C7",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  modalSecondaryText: {
    color: "#566271",
    fontSize: 13,
    fontWeight: "700",
  },
  modalDangerButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: 999,
    backgroundColor: "#DC4C4C",
    alignItems: "center",
    justifyContent: "center",
  },
  modalDangerText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  modalPrimaryButton: {
    marginTop: 8,
    minHeight: 40,
    borderRadius: 999,
    backgroundColor: "#70C943",
    alignItems: "center",
    justifyContent: "center",
  },
  modalPrimaryText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
});
