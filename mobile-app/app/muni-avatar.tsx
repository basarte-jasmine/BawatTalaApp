import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { HomeBottomNav } from "../components/home/HomeBottomNav";
import { MuniAvatar } from "../components/muni/MuniAvatar";
import { unlockAchievement } from "../lib/achievements";
import { startBgmTrack, SOUND_ASSETS } from "../lib/sound-effects";
import { useAuthSession } from "../lib/auth-session";
import {
  areMuniLoadoutsEqual,
  COLLECTION_SECTIONS,
  DEFAULT_MUNI_LOADOUT,
  getMuniCollectionOption,
  getMuniCollectionSource,
  getSavedMuniLoadout,
  hydrateMuniWardrobe,
  MuniCollectionOption,
  MuniCollectionSectionId,
  MuniLoadout,
  purchaseMuniItem,
  purchaseMuniItemsBatch,
  saveMuniLoadout,
  TALA_IMAGE,
  useAvailableMuniTala,
  useOwnedMuniItems,
  useSavedMuniLoadout,
} from "../lib/muni-wardrobe";

type PurchaseNotice = {
  itemLabel: string;
  optionId: string;
  sectionId: MuniCollectionSectionId;
};

type CartItem = {
  checked: boolean;
  option: MuniCollectionOption;
  sectionId: MuniCollectionSectionId;
};

type TabMeta = {
  id: MuniCollectionSectionId;
  label: string;
  iconActive: keyof typeof Ionicons.glyphMap;
  iconInactive: keyof typeof Ionicons.glyphMap;
};

const CATEGORY_TABS: TabMeta[] = [
  { id: "outfit", label: "Outfit", iconActive: "shirt", iconInactive: "shirt-outline" },
  { id: "head", label: "Head", iconActive: "sparkles", iconInactive: "sparkles-outline" },
  { id: "eye", label: "Eyes", iconActive: "glasses", iconInactive: "glasses-outline" },
  { id: "background", label: "Room", iconActive: "images", iconInactive: "images-outline" },
];

const DEFAULT_BG_SOURCE = require("../assets/images/Background/Garden.webp");
const WARDROBE_BGM_VOLUME = 0.28;

export default function MuniAvatarScreen() {
  const { user } = useAuthSession();
  const savedItems = useSavedMuniLoadout();
  const ownedItems = useOwnedMuniItems();
  const availableTala = useAvailableMuniTala();

  const [equippedItems, setEquippedItems] = useState<MuniLoadout>(() => getSavedMuniLoadout());
  const [activeTab, setActiveTab] = useState<MuniCollectionSectionId>("outfit");
  const [purchaseNotice, setPurchaseNotice] = useState<PurchaseNotice | null>(null);
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const [showUnlockTriedModal, setShowUnlockTriedModal] = useState(false);
  const [pendingLeaveRoute, setPendingLeaveRoute] = useState<string | null>(null);
  const [userHasInteracted, setUserHasInteracted] = useState(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [saveSuccessNotice, setSaveSuccessNotice] = useState<string | null>(null);
  const [isSavingLoadout, setIsSavingLoadout] = useState(false);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [showCartModal, setShowCartModal] = useState(false);
  const [singleBuyPrompt, setSingleBuyPrompt] = useState<{
    sectionId: MuniCollectionSectionId;
    option: MuniCollectionOption;
  } | null>(null);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isWardrobeLoading, setIsWardrobeLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isBgmMuted, setIsBgmMuted] = useState(false);
  const bgmRef = useRef<ReturnType<typeof startBgmTrack> | null>(null);

  const loadWardrobe = useCallback(async () => {
    if (!user?.studentNumber) {
      setIsWardrobeLoading(false);
      return;
    }
    setIsWardrobeLoading(true);
    try {
      await hydrateMuniWardrobe(user.studentNumber);
    } finally {
      setIsWardrobeLoading(false);
    }
  }, [user?.studentNumber]);

  useFocusEffect(
    useCallback(() => {
      void loadWardrobe();
    }, [loadWardrobe]),
  );

  useEffect(() => {
    if (!userHasInteracted) {
      setEquippedItems(savedItems);
    }
  }, [savedItems, userHasInteracted]);

  // Auto-sync tried-on unowned items into cart
  useEffect(() => {
    const triedOnList: CartItem[] = [];
    (Object.keys(equippedItems) as MuniCollectionSectionId[]).forEach((sectionId) => {
      const optionId = equippedItems[sectionId];
      if (optionId && !ownedItems[sectionId]?.includes(optionId)) {
        const option = getMuniCollectionOption(sectionId, optionId);
        if (option) {
          triedOnList.push({ checked: true, option, sectionId });
        }
      }
    });

    setCartItems(triedOnList);
  }, [equippedItems, ownedItems]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await loadWardrobe();
    } finally {
      setIsRefreshing(false);
    }
  }, [loadWardrobe]);

  const leaveScreen = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/home");
  };

  // Looping Wardrobe BGM
  useEffect(() => {
    const bgm = startBgmTrack(SOUND_ASSETS.wardrobeBgm, WARDROBE_BGM_VOLUME);
    bgmRef.current = bgm;
    return () => {
      bgmRef.current = null;
      bgm.stop();
    };
  }, []);

  const toggleBgmMuted = useCallback(() => {
    setIsBgmMuted((current) => {
      const nextMuted = !current;
      // Mute the existing loop instead of stopping/restarting it, so the track
      // keeps its position when sound comes back.
      bgmRef.current?.setVolume(nextMuted ? 0 : WARDROBE_BGM_VOLUME);
      return nextMuted;
    });
  }, []);

  const hasUnsavedChanges = !areMuniLoadoutsEqual(equippedItems, savedItems);

  // Unowned items currently equipped (tried on)
  const unownedEquippedItems = useMemo(() => {
    const list: Array<{ sectionId: MuniCollectionSectionId; option: MuniCollectionOption }> = [];
    (Object.keys(equippedItems) as MuniCollectionSectionId[]).forEach((sectionId) => {
      const optionId = equippedItems[sectionId];
      if (optionId && !ownedItems[sectionId]?.includes(optionId)) {
        const option = getMuniCollectionOption(sectionId, optionId);
        if (option) {
          list.push({ sectionId, option });
        }
      }
    });
    return list;
  }, [equippedItems, ownedItems]);

  const unownedEquippedTotal = useMemo(
    () => unownedEquippedItems.reduce((sum, item) => sum + item.option.price, 0),
    [unownedEquippedItems],
  );

  // Unowned item currently previewed in the active tab (if any)
  const activeTabUnownedItem = useMemo(() => {
    const currentOptionId = equippedItems[activeTab];
    if (currentOptionId && !ownedItems[activeTab]?.includes(currentOptionId)) {
      return getMuniCollectionOption(activeTab, currentOptionId);
    }
    return null;
  }, [activeTab, equippedItems, ownedItems]);

  const handleConfirmLeave = () => {
    setShowUnsavedModal(false);
    setUserHasInteracted(false);
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

  // Stage Background
  const equippedBackgroundSource =
    getMuniCollectionSource("background", equippedItems.background) ?? DEFAULT_BG_SOURCE;

  // Equip / Preview an item
  const handleSelectItem = useCallback((sectionId: MuniCollectionSectionId, optionId: string | null) => {
    setUserHasInteracted(true);
    setEquippedItems((current) => ({
      ...current,
      [sectionId]: optionId,
    }));
    void Haptics.selectionAsync().catch(() => undefined);
  }, []);

  // Reset Look
  const handleResetLook = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    setUserHasInteracted(true);
    if (!areMuniLoadoutsEqual(equippedItems, savedItems)) {
      // Revert back to saved look
      setEquippedItems(savedItems);
      setSaveSuccessNotice("Reverted to saved look");
      setTimeout(() => setSaveSuccessNotice(null), 2200);
    } else {
      // If already at saved look, revert accessories to classic Muni
      setEquippedItems({
        background: savedItems.background || DEFAULT_MUNI_LOADOUT.background,
        head: null,
        eye: null,
        outfit: null,
      });
      setSaveSuccessNotice("Reset to default Muni");
      setTimeout(() => setSaveSuccessNotice(null), 2200);
    }
  }, [equippedItems, savedItems]);

  // Save Look
  const handleSaveLook = useCallback(async () => {
    // If trying on unowned items, prompt user to unlock them first
    if (unownedEquippedItems.length > 0) {
      setShowUnlockTriedModal(true);
      return;
    }

    if (!hasUnsavedChanges) {
      setSaveSuccessNotice("Look is already saved!");
      setTimeout(() => setSaveSuccessNotice(null), 2000);
      return;
    }

    if (isSavingLoadout) return;

    setIsSavingLoadout(true);
    const saved = await saveMuniLoadout(equippedItems);
    setIsSavingLoadout(false);

    if (!saved) {
      setPurchaseError("Could not save outfit. Please check your connection.");
      return;
    }

    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    setSaveSuccessNotice("Look saved!");
    setTimeout(() => setSaveSuccessNotice(null), 2200);
    setUserHasInteracted(false);
  }, [equippedItems, hasUnsavedChanges, isSavingLoadout, unownedEquippedItems]);

  // Cart logic
  const selectedCartItems = useMemo(() => cartItems.filter((item) => item.checked), [cartItems]);
  const cartTotal = useMemo(
    () => selectedCartItems.reduce((sum, item) => sum + item.option.price, 0),
    [selectedCartItems],
  );
  const selectedCartCount = selectedCartItems.length;
  const canAffordCart = availableTala >= cartTotal;

  const toggleCartChecked = useCallback((sectionId: MuniCollectionSectionId, optionId: string) => {
    setCartItems((prev) =>
      prev.map((item) =>
        item.sectionId === sectionId && item.option.id === optionId
          ? { ...item, checked: !item.checked }
          : item,
      ),
    );
    void Haptics.selectionAsync().catch(() => undefined);
  }, []);

  // Purchase Single Item (Immediate Unlock & Equip & Save)
  const handleBuySingleItem = useCallback(
    async (sectionId: MuniCollectionSectionId, option: MuniCollectionOption) => {
      if (isPurchasing) return;
      if (availableTala < option.price) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
        setPurchaseError(
          "You need " + option.price + " Tala to unlock " + (option.label ?? option.id) + ", but you have " + availableTala + " Tala.",
        );
        return;
      }

      setIsPurchasing(true);
      const purchased = await purchaseMuniItem(sectionId, option.id, true);
      setIsPurchasing(false);
      setSingleBuyPrompt(null);

      if (!purchased) {
        setPurchaseError("The item could not be unlocked. Please try again.");
        return;
      }

      // Remove from cart if present
      setCartItems((prev) => prev.filter((i) => !(i.sectionId === sectionId && i.option.id === option.id)));

      // Keep it equipped & saved
      setEquippedItems((current) => ({
        ...current,
        [sectionId]: option.id,
      }));

      setPurchaseNotice({
        itemLabel: option.label ?? option.id,
        optionId: option.id,
        sectionId,
      });

      await unlockAchievement("star-shopper", user?.studentNumber);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    },
    [availableTala, isPurchasing, user?.studentNumber],
  );

  // Unlock all currently tried-on unowned items
  const handleUnlockAllTried = useCallback(async () => {
    if (unownedEquippedItems.length === 0 || isPurchasing) return;
    if (availableTala < unownedEquippedTotal) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
      setPurchaseError(
        "You need " + unownedEquippedTotal + " Tala to unlock these items, but you have " + availableTala + " Tala.",
      );
      return;
    }

    setIsPurchasing(true);
    const batch = unownedEquippedItems.map((item) => ({
      sectionId: item.sectionId,
      optionId: item.option.id,
    }));
    const purchased = await purchaseMuniItemsBatch(batch, true);
    setIsPurchasing(false);
    setShowUnlockTriedModal(false);

    if (!purchased) {
      setPurchaseError("Could not complete the purchase. Please try again.");
      return;
    }

    // Clear cart items that were bought
    setCartItems((prev) =>
      prev.filter(
        (ci) => !unownedEquippedItems.some((ui) => ui.sectionId === ci.sectionId && ui.option.id === ci.option.id),
      ),
    );

    // Save current equipped look now that all items are owned
    await saveMuniLoadout(equippedItems);

    setPurchaseNotice({
      itemLabel: unownedEquippedItems.length + " items unlocked & saved",
      optionId: unownedEquippedItems[0].option.id,
      sectionId: unownedEquippedItems[0].sectionId,
    });

    await unlockAchievement("star-shopper", user?.studentNumber);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
  }, [availableTala, equippedItems, isPurchasing, unownedEquippedItems, unownedEquippedTotal, user?.studentNumber]);

  // Checkout Shopping Cart
  const handleBuyCart = useCallback(async () => {
    if (selectedCartCount === 0 || isPurchasing) return;
    if (!canAffordCart) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
      setPurchaseError(
        "Not enough Tala. You need " + cartTotal + " Tala, but you only have " + availableTala + " Tala.",
      );
      return;
    }

    setIsPurchasing(true);
    const batchItems = selectedCartItems.map((item) => ({
      sectionId: item.sectionId,
      optionId: item.option.id,
    }));
    const purchased = await purchaseMuniItemsBatch(batchItems, true);
    setIsPurchasing(false);
    setShowCartModal(false);

    if (!purchased) {
      setPurchaseError("Could not complete the purchase. Please try again.");
      return;
    }

    // Equip bought items into current look
    setEquippedItems((current) => {
      const next = { ...current };
      batchItems.forEach((i) => {
        next[i.sectionId] = i.optionId;
      });
      return next;
    });

    setCartItems([]);
    setPurchaseNotice({
      itemLabel: selectedCartCount + " item" + (selectedCartCount > 1 ? "s" : "") + " unlocked",
      optionId: batchItems[0].optionId,
      sectionId: batchItems[0].sectionId,
    });

    await unlockAchievement("star-shopper", user?.studentNumber);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
  }, [availableTala, canAffordCart, cartTotal, isPurchasing, selectedCartCount, selectedCartItems, user?.studentNumber]);

  // Active category options
  const activeSection = useMemo(
    () => COLLECTION_SECTIONS.find((s) => s.id === activeTab) ?? COLLECTION_SECTIONS[0],
    [activeTab],
  );

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      {/* Upper Stage: Room, Character, Rug, Floating Controls */}
      <View style={styles.stageContainer}>
        {/* Full Scene Background */}
        <Image source={equippedBackgroundSource} style={styles.stageBackgroundImage} contentFit="cover" />
        <View style={styles.stageWarmVignette} />

        {/* Top Header Bar */}
        <View style={styles.stageTopBar}>
          {/* Tala Balance Pill moved to top left */}
          <View style={styles.talaPill}>
            <Image source={TALA_IMAGE} style={styles.talaIcon} contentFit="contain" />
            <Text style={styles.talaText}>{availableTala.toLocaleString("en-US")}</Text>
          </View>

          {/* Top Right Controls: BGM Speaker & Cart */}
          <View style={styles.stageTopBarRight}>
            <Pressable
              style={styles.roundSoundButton}
              accessibilityRole="button"
              accessibilityLabel={isBgmMuted ? "Unmute background sound" : "Mute background sound"}
              onPress={toggleBgmMuted}
              hitSlop={8}
            >
              <Ionicons
                name={isBgmMuted ? "volume-mute" : "volume-high"}
                size={20}
                color={isBgmMuted ? "#8F9D93" : "#384E3F"}
              />
            </Pressable>

            <Pressable
              style={styles.roundCartButton}
              accessibilityLabel="Shopping Cart"
              onPress={() => setShowCartModal(true)}
            >
              <Ionicons name="cart" size={20} color="#384E3F" />
              {cartItems.length > 0 ? (
                <View style={styles.cartBadge}>
                  <Text style={styles.cartBadgeText}>{cartItems.length}</Text>
                </View>
              ) : null}
            </Pressable>
          </View>
        </View>

        {/* Character Stage with Circular Floor Rug */}
        <View style={styles.stageMuniWrap}>
          {/* Circular Stage Rug underneath Muni (matching reference) */}
          {/* Muni Companion Avatar */}
          <MuniAvatar loadout={equippedItems} style={styles.stageMuniAvatar} />
        </View>

        {/* Floating Stage Controls (Reset on Left, Save on Right) */}
        <View style={styles.stageBottomFloatingRow}>
          {/* Remove / Reset Button */}
          <Pressable
            style={styles.removeButtonWrap}
            accessibilityLabel="Remove outfit"
            onPress={handleResetLook}
          >
            <View style={styles.roundResetButton}>
              <Ionicons name="trash" size={22} color="#D94E4E" />
            </View>
            <Text style={styles.removeButtonText}>Remove</Text>
          </Pressable>

          {/* Unsaved / Tried Indicator Pill (if any) */}
          {unownedEquippedItems.length > 0 ? (
            <Pressable
              style={styles.tryOnPill}
              onPress={() => setShowUnlockTriedModal(true)}
              accessibilityLabel="Unlock tried items"
            >
              <Ionicons name="sparkles" size={13} color="#FFFFFF" />
              <Text style={styles.tryOnPillText}>
                Trying on {unownedEquippedItems.length} unowned • {unownedEquippedTotal} Tala
              </Text>
            </Pressable>
          ) : isWardrobeLoading ? (
            <View style={styles.loadingPill}>
              <ActivityIndicator size="small" color="#527A45" />
              <Text style={styles.loadingPillText}>Syncing wardrobe...</Text>
            </View>
          ) : saveSuccessNotice ? (
            <View style={styles.noticeToastPill}>
              <Ionicons name="checkmark-circle" size={14} color="#2A6F32" />
              <Text style={styles.noticeToastText}>{saveSuccessNotice}</Text>
            </View>
          ) : null}

          {/* Save Button (Floppy disk icon with 'Save' matching reference) */}
          <Pressable
            style={[
              styles.saveFloppyButton,
              hasUnsavedChanges || unownedEquippedItems.length > 0
                ? styles.saveFloppyButtonActive
                : styles.saveFloppyButtonIdle,
            ]}
            accessibilityLabel="Save outfit"
            disabled={isSavingLoadout}
            onPress={() => void handleSaveLook()}
          >
            <View
              style={[
                styles.saveFloppyIconWrap,
                (hasUnsavedChanges || unownedEquippedItems.length > 0)
                  ? styles.saveFloppyIconWrapActive
                  : styles.saveFloppyIconWrapIdle,
              ]}
            >
              <Ionicons
                name={hasUnsavedChanges ? "save" : "save-outline"}
                size={22}
                color={hasUnsavedChanges || unownedEquippedItems.length > 0 ? "#1B4D24" : "#4A634E"}
              />
            </View>
            <Text
              style={[
                styles.saveFloppyText,
                (hasUnsavedChanges || unownedEquippedItems.length > 0) && styles.saveFloppyTextActive,
              ]}
            >
              {isSavingLoadout ? "Saving..." : "Save"}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Category Tabs Bar (Divider matching reference image) */}
      <View style={styles.categoryTabsBar}>
        {CATEGORY_TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <Pressable
              key={tab.id}
              style={[styles.categoryTabItem, isActive ? styles.categoryTabItemActive : styles.categoryTabItemInactive]}
              onPress={() => {
                setActiveTab(tab.id);
                void Haptics.selectionAsync().catch(() => undefined);
              }}
            >
              {tab.id === "head" ? (
                <MaterialCommunityIcons
                  name="hat-fedora"
                  size={21}
                  color={isActive ? "#3D6636" : "#7E907B"}
                />
              ) : (
                <Ionicons
                  name={isActive ? tab.iconActive : tab.iconInactive}
                  size={20}
                  color={isActive ? "#3D6636" : "#7E907B"}
                />
              )}
              {isActive ? <Text style={styles.categoryTabLabelActive}>{tab.label}</Text> : null}
            </Pressable>
          );
        })}
      </View>

      {/* Bottom Choices Drawer: Grid of Clothes / Accessories / Rooms */}
      <View style={styles.drawerContainer}>
        <ScrollView
          style={styles.drawerScroll}
          contentContainerStyle={styles.drawerScrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              colors={["#73CD44"]}
              tintColor="#73CD44"
            />
          }
        >
          <View style={styles.itemsGrid}>
            {/* 'None' / Default Tile for Head, Eye, Outfit */}
            {activeTab !== "background" ? (
              <Pressable
                style={[
                  styles.itemCard,
                  equippedItems[activeTab] === null && styles.itemCardEquipped,
                ]}
                onPress={() => handleSelectItem(activeTab, null)}
              >
                <View style={styles.itemImageWell}>
                  <Ionicons name="close-circle-outline" size={28} color="#7D927E" />
                </View>
                <Text style={styles.itemCardLabel} numberOfLines={1}>
                  None
                </Text>
                {equippedItems[activeTab] === null && (
                  <View style={styles.equippedBadge}>
                    <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                  </View>
                )}
              </Pressable>
            ) : null}

            {/* List all items in the active category */}
            {activeSection.options.map((option) => {
              const isOwned = ownedItems[activeTab]?.includes(option.id);
              const isEquipped = equippedItems[activeTab] === option.id;
              const isTriedOn = !isOwned && isEquipped;

              return (
                <Pressable
                  key={option.id}
                  style={[
                    styles.itemCard,
                    isEquipped && isOwned && styles.itemCardEquipped,
                    isTriedOn && styles.itemCardTryingOn,
                  ]}
                  onPress={() => handleSelectItem(activeTab, option.id)}
                >
                  <View
                    style={[
                      styles.itemImageWell,
                      activeTab === "background" && styles.itemImageWellBackground,
                    ]}
                  >
                    <Image
                      source={option.source}
                      style={activeTab === "background" ? styles.bgOptionImage : styles.clothingOptionImage}
                      contentFit={activeTab === "background" ? "cover" : "contain"}
                    />
                  </View>

                  <Text style={styles.itemCardLabel} numberOfLines={1}>
                    {option.label ?? option.id}
                  </Text>

                  {/* Price pill if not owned */}
                  {!isOwned ? (
                    <View style={styles.itemPricePill}>
                      <Image source={TALA_IMAGE} style={styles.itemPriceIcon} contentFit="contain" />
                      <Text style={styles.itemPriceText}>{option.price}</Text>
                    </View>
                  ) : null}

                  {/* Equipped Checkmark Badge */}
                  {isEquipped && isOwned && (
                    <View style={styles.equippedBadge}>
                      <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                    </View>
                  )}

                  {/* Trying On Badge */}
                  {isTriedOn && (
                    <View style={styles.tryingOnBadge}>
                      <Text style={styles.tryingOnBadgeText}>TRYING</Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        </ScrollView>

        {/* Try-On / Instant Buy Floating Bar (When unowned item is previewed in active tab) */}
        {activeTabUnownedItem ? (
          <View style={styles.tryOnActionBar}>
            <View style={styles.tryOnItemInfo}>
              <Image
                source={activeTabUnownedItem.source}
                style={styles.tryOnThumb}
                contentFit={activeTab === "background" ? "cover" : "contain"}
              />
              <View style={styles.tryOnTextWrap}>
                <Text style={styles.tryOnTitle} numberOfLines={1}>
                  {activeTabUnownedItem.label ?? activeTabUnownedItem.id}
                </Text>
                <View style={styles.tryOnPriceRow}>
                  <Image source={TALA_IMAGE} style={styles.tryOnPriceIcon} contentFit="contain" />
                  <Text style={styles.tryOnPriceValue}>{activeTabUnownedItem.price} Tala</Text>
                </View>
              </View>
            </View>

            <View style={styles.tryOnButtonsRow}>
              {/* Bag button to view everything currently on */}
              <Pressable
                style={styles.tryOnCartButton}
                onPress={() => setShowCartModal(true)}
              >
                <Ionicons name="cart-outline" size={18} color="#456149" />
                {cartItems.length > 0 ? (
                  <View style={styles.cartBadge}>
                    <Text style={styles.cartBadgeText}>{cartItems.length}</Text>
                  </View>
                ) : null}
              </Pressable>

              {/* Instant Unlock & Keep button */}
              <Pressable
                style={styles.tryOnBuyButton}
                onPress={() => setSingleBuyPrompt({ sectionId: activeTab, option: activeTabUnownedItem })}
              >
                <Ionicons name="sparkles" size={15} color="#FFFFFF" />
                <Text style={styles.tryOnBuyButtonText}>Unlock & Keep</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>

      {/* Confirmation Modal: Single Item Purchase */}
      <Modal visible={Boolean(singleBuyPrompt)} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.confirmItemPreview}>
              {singleBuyPrompt?.option.source ? (
                <Image
                  source={singleBuyPrompt.option.source}
                  style={
                    singleBuyPrompt.sectionId === "background"
                      ? styles.confirmBackgroundPreview
                      : styles.confirmImagePreview
                  }
                  contentFit={singleBuyPrompt.sectionId === "background" ? "cover" : "contain"}
                />
              ) : null}
            </View>

            <Text style={styles.modalTitle}>
              Unlock {singleBuyPrompt?.option.label ?? singleBuyPrompt?.option.id}?
            </Text>
            <View style={styles.confirmPriceRow}>
              <Image source={TALA_IMAGE} style={styles.confirmPriceIcon} contentFit="contain" />
              <Text style={styles.confirmPriceValue}>{singleBuyPrompt?.option.price} Tala</Text>
            </View>
            <Text style={styles.confirmBalanceHint}>
              Your balance: {availableTala.toLocaleString("en-US")} Tala
            </Text>

            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalSecondaryButton}
                disabled={isPurchasing}
                onPress={() => setSingleBuyPrompt(null)}
              >
                <Text style={styles.modalSecondaryText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={styles.modalPrimaryButton}
                disabled={isPurchasing}
                onPress={() => {
                  if (singleBuyPrompt) {
                    void handleBuySingleItem(singleBuyPrompt.sectionId, singleBuyPrompt.option);
                  }
                }}
              >
                {isPurchasing ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalPrimaryText}>Confirm Unlock</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal: Unlock All Tried-On Items when Saving */}
      <Modal visible={showUnlockTriedModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Unlock Your Look?</Text>
            <Text style={styles.modalBody}>
              You are trying on {unownedEquippedItems.length} new piece
              {unownedEquippedItems.length > 1 ? "s" : ""}. Unlock them to save this look!
            </Text>

            <ScrollView style={styles.unlockListScroll} showsVerticalScrollIndicator={false}>
              {unownedEquippedItems.map(({ sectionId, option }) => (
                <View key={option.id} style={styles.unlockListItem}>
                  <Image
                    source={option.source}
                    style={styles.unlockItemThumb}
                    contentFit={sectionId === "background" ? "cover" : "contain"}
                  />
                  <Text style={styles.unlockItemName} numberOfLines={1}>
                    {option.label ?? option.id}
                  </Text>
                  <View style={styles.unlockItemPriceWrap}>
                    <Image source={TALA_IMAGE} style={styles.unlockItemPriceIcon} contentFit="contain" />
                    <Text style={styles.unlockItemPriceText}>{option.price}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>

            <View style={styles.unlockTotalRow}>
              <Text style={styles.unlockTotalLabel}>Total:</Text>
              <View style={styles.confirmPriceRow}>
                <Image source={TALA_IMAGE} style={styles.confirmPriceIcon} contentFit="contain" />
                <Text style={styles.confirmPriceValue}>{unownedEquippedTotal} Tala</Text>
              </View>
            </View>
            <Text style={styles.confirmBalanceHint}>
              Your balance: {availableTala.toLocaleString("en-US")} Tala
            </Text>

            <View style={styles.modalColumnActions}>
              <Pressable
                style={[
                  styles.modalPrimaryButtonFull,
                  availableTala < unownedEquippedTotal && styles.buttonDisabled,
                ]}
                disabled={isPurchasing || availableTala < unownedEquippedTotal}
                onPress={() => void handleUnlockAllTried()}
              >
                {isPurchasing ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalPrimaryText}>
                    {availableTala >= unownedEquippedTotal ? "Unlock & Save Outfit" : "Not Enough Tala"}
                  </Text>
                )}
              </Pressable>

              <Pressable
                style={styles.modalSecondaryButtonFull}
                disabled={isPurchasing}
                onPress={() => {
                  setShowUnlockTriedModal(false);
                  // Strip unowned items and save only owned ones
                  const ownedLook = { ...equippedItems };
                  unownedEquippedItems.forEach((i) => {
                    ownedLook[i.sectionId] = savedItems[i.sectionId];
                  });
                  setEquippedItems(ownedLook);
                  void saveMuniLoadout(ownedLook);
                }}
              >
                <Text style={styles.modalSecondaryText}>Revert Unowned & Save</Text>
              </Pressable>

              <Pressable
                style={styles.modalTextButton}
                disabled={isPurchasing}
                onPress={() => setShowUnlockTriedModal(false)}
              >
                <Text style={styles.modalTextButtonLabel}>Keep Trying On</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Cart Modal */}
      <Modal visible={showCartModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, styles.cartModalCard]}>
            <View style={styles.cartHeaderRow}>
              <View style={styles.cartHeaderTitleWrap}>
                <Ionicons name="cart" size={20} color="#345239" />
                <Text style={styles.cartModalTitle}>Shopping Bag</Text>
                <View style={styles.cartItemCountBadge}>
                  <Text style={styles.cartItemCountBadgeText}>{cartItems.length}</Text>
                </View>
              </View>
              <Pressable style={styles.cartCloseButton} onPress={() => setShowCartModal(false)}>
                <Ionicons name="close" size={22} color="#5D6C62" />
              </Pressable>
            </View>

            {cartItems.length === 0 ? (
              <View style={styles.cartEmptyState}>
                <Ionicons name="bag-handle-outline" size={44} color="#A7BAA8" />
                <Text style={styles.cartEmptyTitle}>Your bag is empty</Text>
                <Text style={styles.cartEmptySubtitle}>
                  Tap any item in the wardrobe to try it on and add it to your bag!
                </Text>
              </View>
            ) : (
              <>
                <ScrollView style={styles.cartList} showsVerticalScrollIndicator={false}>
                  {cartItems.map((item) => (
                    <View
                      key={item.option.id}
                      style={[styles.cartItemRow, !item.checked && styles.cartItemRowUnchecked]}
                    >
                      <Pressable
                        style={item.checked ? styles.cartItemCheckboxButton : styles.cartItemCheckboxButtonOff}
                        onPress={() => toggleCartChecked(item.sectionId, item.option.id)}
                      >
                        {item.checked ? <Ionicons name="checkmark" size={16} color="#3E7D32" /> : null}
                      </Pressable>
                      <Image
                        source={item.option.source}
                        style={
                          item.sectionId === "background"
                            ? styles.cartItemImageBackground
                            : styles.cartItemImage
                        }
                        contentFit={item.sectionId === "background" ? "cover" : "contain"}
                      />
                      <View style={styles.cartItemInfo}>
                        <Text style={styles.cartItemName}>{item.option.label ?? item.option.id}</Text>
                        <Text style={styles.cartItemSection}>{item.sectionId}</Text>
                      </View>
                      <View style={styles.cartItemPriceWrap}>
                        <Image source={TALA_IMAGE} style={styles.cartTalaIcon} contentFit="contain" />
                        <Text style={styles.cartItemPriceText}>{item.option.price}</Text>
                      </View>
                      <Pressable
                        style={styles.cartItemRemoveButton}
                        onPress={() => {
                          setEquippedItems((current) => ({
                            ...current,
                            [item.sectionId]: savedItems[item.sectionId],
                          }));
                        }}
                      >
                        <Ionicons name="trash-outline" size={18} color="#96A699" />
                      </Pressable>
                    </View>
                  ))}
                </ScrollView>

                <View style={styles.cartFooter}>
                  <View style={styles.cartTotalRow}>
                    <Text style={styles.cartTotalLabel}>Total ({selectedCartCount} items):</Text>
                    <View style={styles.cartTotalPriceWrap}>
                      <Image source={TALA_IMAGE} style={styles.cartTotalTalaIcon} contentFit="contain" />
                      <Text style={styles.cartTotalPriceText}>{cartTotal}</Text>
                    </View>
                  </View>
                  <Text style={styles.cartBalanceText}>
                    Your Tala: {availableTala.toLocaleString("en-US")}
                  </Text>

                  <View style={styles.cartActions}>
                    <Pressable
                      style={styles.cartClearButton}
                      onPress={() => setEquippedItems(savedItems)}
                      disabled={isPurchasing}
                    >
                      <Text style={styles.cartClearButtonText}>Clear</Text>
                    </Pressable>
                    <Pressable
                      style={[
                        styles.cartCheckoutButton,
                        (!canAffordCart || selectedCartCount === 0) && styles.buttonDisabled,
                      ]}
                      onPress={() => void handleBuyCart()}
                      disabled={isPurchasing || !canAffordCart || selectedCartCount === 0}
                    >
                      {isPurchasing ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text style={styles.cartCheckoutButtonText}>Unlock Items</Text>
                      )}
                    </Pressable>
                  </View>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Success Modal */}
      <Modal visible={Boolean(purchaseNotice)} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.unlockModalCard}>
            <View style={styles.unlockIconBadge}>
              <Ionicons name="sparkles" size={28} color="#FFFFFF" />
            </View>
            <Text style={styles.unlockTitle}>New Item Unlocked!</Text>
            <Text style={styles.unlockBody}>
              {purchaseNotice?.itemLabel} is now part of your permanent collection and has been saved to Muni.
            </Text>
            <Pressable style={styles.unlockButton} onPress={() => setPurchaseNotice(null)}>
              <Text style={styles.unlockButtonText}>Awesome!</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Error Modal */}
      <Modal visible={Boolean(purchaseError)} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Notice</Text>
            <Text style={styles.modalBody}>{purchaseError}</Text>
            <Pressable style={styles.modalNoticeButton} onPress={() => setPurchaseError(null)}>
              <Text style={styles.modalPrimaryText}>Got it</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Unsaved Changes Confirmation Modal */}
      <Modal visible={showUnsavedModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Unsaved Look</Text>
            <Text style={styles.modalBody}>
              You have tried on new pieces that haven't been saved yet. Would you like to leave anyway?
            </Text>
            <View style={styles.modalActions}>
              <Pressable style={styles.modalSecondaryButton} onPress={() => setShowUnsavedModal(false)}>
                <Text style={styles.modalSecondaryText}>Stay</Text>
              </Pressable>
              <Pressable style={styles.modalDangerButton} onPress={handleConfirmLeave}>
                <Text style={styles.modalDangerText}>Leave</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      {/* Standard App Bottom Nav */}
      <HomeBottomNav
        activeTab="muni"
        onBeforeLeave={(nextRoute) => {
          const isDirty = userHasInteracted || !areMuniLoadoutsEqual(equippedItems, savedItems) || unownedEquippedItems.length > 0;
          if (!isDirty) {
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
    backgroundColor: "#F7FAF5",
  },

  // Upper Stage Section
  stageContainer: {
    height: "46%",
    minHeight: 280,
    maxHeight: 380,
    position: "relative",
    overflow: "hidden",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.06)",
  },
  stageBackgroundImage: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
  stageWarmVignette: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  stageTopBar: {
    position: "absolute",
    top: 10,
    left: 14,
    right: 14,
    zIndex: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  talaPill: {
    height: 38,
    borderRadius: 999,
    backgroundColor: "rgba(255, 252, 224, 0.96)",
    borderWidth: 1.5,
    borderColor: "rgba(224, 196, 74, 0.7)",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    columnGap: 6,
    shadowColor: "#615220",
    shadowOpacity: 0.1,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  talaIcon: {
    width: 18,
    height: 18,
  },
  talaText: {
    color: "#3F4F3F",
    fontSize: 16,
    lineHeight: 20,
    fontFamily: "Outfit-Bold",
  },
  stageTopBarRight: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 8,
  },
  roundSoundButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(255, 255, 255, 0.94)",
    borderWidth: 1.5,
    borderColor: "#E5ECE0",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#2F3E34",
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  roundCartButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(255, 255, 255, 0.94)",
    borderWidth: 1.5,
    borderColor: "#E5ECE0",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    shadowColor: "#2F3E34",
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  cartBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    minWidth: 19,
    height: 19,
    borderRadius: 9.5,
    backgroundColor: "#70C943",
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  cartBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontFamily: "Outfit-Bold",
  },

  // Muni Character & Floor Rug (matching reference)
  stageMuniWrap: {
    position: "absolute",
    left: "50%",
    bottom: 22,
    width: 210,
    height: 210,
    marginLeft: -105,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 5,
  },
  stageMuniAvatar: {
    width: 210,
    height: 210,
  },

  // Floating Controls at Bottom of Stage
  stageBottomFloatingRow: {
    position: "absolute",
    bottom: 8,
    left: 14,
    right: 14,
    zIndex: 10,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  removeButtonWrap: {
    minWidth: 54,
    alignItems: "center",
    justifyContent: "center",
  },
  roundResetButton: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.94)",
    borderWidth: 1.5,
    borderColor: "#F7B8B8",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#803030",
    shadowOpacity: 0.16,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  removeButtonText: {
    marginTop: 3,
    fontSize: 12,
    fontFamily: "Outfit-Bold",
    color: "#B33939",
    textShadowColor: "rgba(255, 255, 255, 0.85)",
    textShadowRadius: 3,
  },
  tryOnPill: {
    backgroundColor: "#2C753A",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    flexDirection: "row",
    alignItems: "center",
    columnGap: 5,
    shadowColor: "#17441F",
    shadowOpacity: 0.16,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
    marginBottom: 4,
  },
  tryOnPillText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontFamily: "Outfit-Bold",
  },
  loadingPill: {
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    flexDirection: "row",
    alignItems: "center",
    columnGap: 6,
    marginBottom: 4,
  },
  loadingPillText: {
    color: "#466249",
    fontSize: 11,
    fontFamily: "Outfit-Medium",
  },
  noticeToastPill: {
    backgroundColor: "#EAF7E8",
    borderColor: "#B4DEB1",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    columnGap: 5,
    marginBottom: 4,
  },
  noticeToastText: {
    color: "#27622E",
    fontSize: 12,
    fontFamily: "Outfit-Bold",
  },

  // Save Floppy Button (Floppy disk icon with 'Save' matching reference)
  saveFloppyButton: {
    minWidth: 54,
    alignItems: "center",
    justifyContent: "center",
  },
  saveFloppyIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#2F5036",
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  saveFloppyIconWrapActive: {
    backgroundColor: "#8BE05F",
    borderWidth: 1.5,
    borderColor: "#66C237",
  },
  saveFloppyIconWrapIdle: {
    backgroundColor: "rgba(255, 255, 255, 0.92)",
    borderWidth: 1.5,
    borderColor: "#D2E0CD",
  },
  saveFloppyButtonActive: {
    opacity: 1,
  },
  saveFloppyButtonIdle: {
    opacity: 0.85,
  },
  saveFloppyText: {
    marginTop: 3,
    fontSize: 12,
    fontFamily: "Outfit-Bold",
    color: "#46614A",
    textShadowColor: "rgba(255,255,255,0.85)",
    textShadowRadius: 3,
  },
  saveFloppyTextActive: {
    color: "#1B4D24",
  },

  // Horizontal Category Tabs Bar (Divider matching reference image)
  categoryTabsBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 10,
    backgroundColor: "#F1F5EE",
    borderTopWidth: 1,
    borderTopColor: "#DEE8DA",
  },
  categoryTabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 7,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    marginHorizontal: 3,
  },
  categoryTabItemActive: {
    backgroundColor: "#FFFFFF",
    paddingVertical: 10,
    marginBottom: -1,
    borderTopWidth: 2,
    borderLeftWidth: 1.5,
    borderRightWidth: 1.5,
    borderColor: "#D3E2CD",
    shadowColor: "#39523C",
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: -2 },
    elevation: 2,
  },
  categoryTabItemInactive: {
    backgroundColor: "#E2ECE0",
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: "#D5E2D2",
  },
  categoryTabLabelActive: {
    marginTop: 2,
    fontSize: 11,
    fontFamily: "Outfit-Bold",
    color: "#2C5625",
  },

  // Bottom Drawer: Grid of Clothes / Accessories / Rooms
  drawerContainer: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    position: "relative",
  },
  drawerScroll: {
    flex: 1,
  },
  drawerScrollContent: {
    paddingHorizontal: 8,
    paddingTop: 10,
    paddingBottom: 90,
  },
  itemsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: 8,
    columnGap: 6,
  },
  itemCard: {
    width: "23.3%",
    minHeight: 96,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "#DEE7DC",
    backgroundColor: "#F8FAF6",
    alignItems: "center",
    padding: 5,
    position: "relative",
    shadowColor: "#4B5B4D",
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1.5 },
    elevation: 1,
  },
  itemCardEquipped: {
    borderColor: "#70C943",
    borderWidth: 2,
    backgroundColor: "#F3FAEE",
  },
  itemCardTryingOn: {
    borderColor: "#E59E27",
    borderWidth: 2,
    backgroundColor: "#FFFDF6",
  },
  itemImageWell: {
    width: "100%",
    height: 54,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  itemImageWellBackground: {
    backgroundColor: "#DEEFE0",
  },
  clothingOptionImage: {
    width: "82%",
    height: "82%",
  },
  bgOptionImage: {
    width: "100%",
    height: "100%",
  },
  itemCardLabel: {
    marginTop: 4,
    fontSize: 10,
    fontFamily: "Outfit-Bold",
    color: "#3F5243",
    textAlign: "center",
  },
  itemPricePill: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 2,
    backgroundColor: "#FFF9DB",
    borderWidth: 1,
    borderColor: "#ECD87A",
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 1,
    marginTop: 2,
  },
  itemPriceIcon: {
    width: 9,
    height: 9,
  },
  itemPriceText: {
    fontSize: 9,
    fontFamily: "Outfit-Bold",
    color: "#6D5519",
  },
  equippedBadge: {
    position: "absolute",
    top: 3,
    right: 3,
    width: 17,
    height: 17,
    borderRadius: 8.5,
    backgroundColor: "#70C943",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#FFFFFF",
  },
  tryingOnBadge: {
    position: "absolute",
    top: 3,
    right: 3,
    backgroundColor: "#E59E27",
    borderRadius: 5,
    paddingHorizontal: 3,
    paddingVertical: 1,
  },
  tryingOnBadgeText: {
    fontSize: 7,
    fontFamily: "Outfit-Bold",
    color: "#FFFFFF",
  },

  // Try-On Action Bar (Appears above bottom nav when previewing unowned item)
  tryOnActionBar: {
    position: "absolute",
    bottom: 4,
    left: 8,
    right: 8,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#CCE2C5",
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#2F5036",
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
    zIndex: 20,
  },
  tryOnItemInfo: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 8,
    flex: 1,
  },
  tryOnThumb: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "#F2F6F0",
  },
  tryOnTextWrap: {
    flex: 1,
  },
  tryOnTitle: {
    fontSize: 13,
    fontFamily: "Outfit-Bold",
    color: "#2C4331",
  },
  tryOnPriceRow: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 4,
    marginTop: 2,
  },
  tryOnPriceIcon: {
    width: 13,
    height: 13,
  },
  tryOnPriceValue: {
    fontSize: 12,
    fontFamily: "Outfit-Bold",
    color: "#4F7049",
  },
  tryOnButtonsRow: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 6,
  },
  tryOnCartButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "#EEF4EC",
    borderWidth: 1,
    borderColor: "#D2E2CF",
    alignItems: "center",
    justifyContent: "center",
  },
  tryOnBuyButton: {
    height: 36,
    borderRadius: 999,
    backgroundColor: "#70C943",
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    columnGap: 5,
    shadowColor: "#4B8529",
    shadowOpacity: 0.22,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  tryOnBuyButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontFamily: "Outfit-Bold",
  },

  // Modals Styling
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(18, 28, 21, 0.45)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 22,
  },
  modalCard: {
    width: "100%",
    maxWidth: 330,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 20,
    shadowColor: "#2F4435",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontFamily: "Outfit-Bold",
    color: "#2C4032",
    textAlign: "center",
    marginBottom: 8,
  },
  modalBody: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: "Outfit-Medium",
    color: "#5C6F61",
    textAlign: "center",
    marginBottom: 16,
  },
  confirmItemPreview: {
    width: 76,
    height: 76,
    borderRadius: 16,
    backgroundColor: "#F2F7F0",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 10,
    overflow: "hidden",
  },
  confirmImagePreview: {
    width: 60,
    height: 60,
  },
  confirmBackgroundPreview: {
    width: 76,
    height: 76,
  },
  confirmPriceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    columnGap: 5,
    marginBottom: 4,
  },
  confirmPriceIcon: {
    width: 17,
    height: 17,
  },
  confirmPriceValue: {
    fontSize: 16,
    fontFamily: "Outfit-Bold",
    color: "#356B3A",
  },
  confirmBalanceHint: {
    fontSize: 12,
    fontFamily: "Outfit-Medium",
    color: "#778B7C",
    textAlign: "center",
    marginBottom: 14,
  },
  modalActions: {
    flexDirection: "row",
    columnGap: 10,
    marginTop: 8,
  },
  modalSecondaryButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: "#D2E0CE",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  modalSecondaryText: {
    color: "#506954",
    fontSize: 13,
    fontFamily: "Outfit-Bold",
  },
  modalPrimaryButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 999,
    backgroundColor: "#70C943",
    alignItems: "center",
    justifyContent: "center",
  },
  modalPrimaryText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontFamily: "Outfit-Bold",
  },
  modalDangerButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 999,
    backgroundColor: "#DC4C4C",
    alignItems: "center",
    justifyContent: "center",
  },
  modalDangerText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontFamily: "Outfit-Bold",
  },
  modalNoticeButton: {
    width: "100%",
    minHeight: 42,
    borderRadius: 999,
    backgroundColor: "#70C943",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  buttonDisabled: {
    backgroundColor: "#BDD7B7",
  },

  // Unlock list modal
  unlockListScroll: {
    maxHeight: 180,
    width: "100%",
    marginBottom: 10,
  },
  unlockListItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F4ED",
  },
  unlockItemThumb: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "#F2F6EF",
  },
  unlockItemName: {
    flex: 1,
    marginLeft: 10,
    fontSize: 13,
    fontFamily: "Outfit-Bold",
    color: "#304635",
  },
  unlockItemPriceWrap: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 4,
  },
  unlockItemPriceIcon: {
    width: 13,
    height: 13,
  },
  unlockItemPriceText: {
    fontSize: 13,
    fontFamily: "Outfit-Bold",
    color: "#3D6F39",
  },
  unlockTotalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: "#E2ECE0",
  },
  unlockTotalLabel: {
    fontSize: 14,
    fontFamily: "Outfit-Bold",
    color: "#304635",
  },
  modalColumnActions: {
    width: "100%",
    rowGap: 8,
  },
  modalPrimaryButtonFull: {
    width: "100%",
    minHeight: 42,
    borderRadius: 999,
    backgroundColor: "#70C943",
    alignItems: "center",
    justifyContent: "center",
  },
  modalSecondaryButtonFull: {
    width: "100%",
    minHeight: 40,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: "#D2E0CE",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  modalTextButton: {
    paddingVertical: 6,
    alignItems: "center",
  },
  modalTextButtonLabel: {
    fontSize: 12,
    fontFamily: "Outfit-Medium",
    color: "#728776",
  },

  // Cart Modal Specifics
  cartModalCard: {
    maxHeight: "82%",
  },
  cartHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#EEF4EB",
    paddingBottom: 10,
  },
  cartHeaderTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 8,
  },
  cartModalTitle: {
    fontSize: 17,
    fontFamily: "Outfit-Bold",
    color: "#2C4332",
  },
  cartItemCountBadge: {
    backgroundColor: "#E7F4E3",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  cartItemCountBadgeText: {
    fontSize: 11,
    fontFamily: "Outfit-Bold",
    color: "#356E32",
  },
  cartCloseButton: {
    padding: 4,
  },
  cartEmptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 28,
  },
  cartEmptyTitle: {
    fontSize: 16,
    fontFamily: "Outfit-Bold",
    color: "#3F5349",
    marginTop: 10,
  },
  cartEmptySubtitle: {
    fontSize: 13,
    fontFamily: "Outfit-Medium",
    color: "#7A8C82",
    textAlign: "center",
    marginTop: 4,
    paddingHorizontal: 16,
  },
  cartList: {
    maxHeight: 240,
    width: "100%",
  },
  cartItemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: "#F4F7F2",
  },
  cartItemRowUnchecked: {
    opacity: 0.5,
  },
  cartItemCheckboxButton: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: "#E4F3E0",
    borderWidth: 1.5,
    borderColor: "#70C943",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  cartItemCheckboxButtonOff: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: "#F2F5F1",
    borderWidth: 1.5,
    borderColor: "#D3DED1",
    marginRight: 8,
  },
  cartItemImage: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: "#F7FAF5",
  },
  cartItemImageBackground: {
    width: 38,
    height: 38,
    borderRadius: 8,
  },
  cartItemInfo: {
    flex: 1,
    marginLeft: 8,
  },
  cartItemName: {
    fontSize: 13,
    fontFamily: "Outfit-Bold",
    color: "#2C4032",
  },
  cartItemSection: {
    fontSize: 11,
    fontFamily: "Outfit-Medium",
    color: "#7E9082",
    textTransform: "capitalize",
    marginTop: 1,
  },
  cartItemPriceWrap: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 4,
    marginRight: 8,
  },
  cartTalaIcon: {
    width: 14,
    height: 14,
  },
  cartItemPriceText: {
    fontSize: 13,
    fontFamily: "Outfit-Bold",
    color: "#376939",
  },
  cartItemRemoveButton: {
    padding: 6,
  },
  cartFooter: {
    width: "100%",
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#EEF4EB",
    paddingTop: 10,
  },
  cartTotalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  cartTotalLabel: {
    fontSize: 14,
    fontFamily: "Outfit-Bold",
    color: "#334937",
  },
  cartTotalPriceWrap: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 5,
  },
  cartTotalTalaIcon: {
    width: 16,
    height: 16,
  },
  cartTotalPriceText: {
    fontSize: 16,
    fontFamily: "Outfit-Bold",
    color: "#2E6E34",
  },
  cartBalanceText: {
    fontSize: 11,
    fontFamily: "Outfit-Medium",
    color: "#7C9081",
    textAlign: "right",
    marginBottom: 10,
  },
  cartActions: {
    flexDirection: "row",
    columnGap: 10,
  },
  cartClearButton: {
    minHeight: 40,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: "#D2DDD3",
    alignItems: "center",
    justifyContent: "center",
  },
  cartClearButtonText: {
    color: "#677E6D",
    fontSize: 13,
    fontFamily: "Outfit-Bold",
  },
  cartCheckoutButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: 999,
    backgroundColor: "#70C943",
    alignItems: "center",
    justifyContent: "center",
  },
  cartCheckoutButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontFamily: "Outfit-Bold",
  },

  // Success modal
  unlockModalCard: {
    width: "100%",
    maxWidth: 310,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 20,
    alignItems: "center",
  },
  unlockIconBadge: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "#70C943",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  unlockTitle: {
    color: "#2C4032",
    fontSize: 20,
    lineHeight: 26,
    fontFamily: "Outfit-Bold",
    textAlign: "center",
  },
  unlockBody: {
    marginTop: 8,
    color: "#5C6F61",
    fontSize: 14,
    lineHeight: 20,
    fontFamily: "Outfit-Medium",
    textAlign: "center",
  },
  unlockButton: {
    marginTop: 16,
    minWidth: 140,
    minHeight: 40,
    borderRadius: 999,
    backgroundColor: "#70C943",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  unlockButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontFamily: "Outfit-Bold",
  },
});
