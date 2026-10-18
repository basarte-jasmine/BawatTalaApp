import { router, usePathname } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type TabKeyClean = "home" | "journal" | "consult" | "muni" | "none";

type NavItem = {
  iconActive: string;
  iconInactive: string;
  label: string;
  key: TabKeyClean;
  route?: "/home" | "/journal" | "/consult" | "/muni-avatar";
};

const NAV_ITEMS_LEFT: NavItem[] = [
  { key: "home", iconActive: "home", iconInactive: "home-outline", label: "Home", route: "/home" },
  { key: "journal", iconActive: "book", iconInactive: "book-outline", label: "Journal", route: "/journal" },
];

const NAV_ITEMS_RIGHT: NavItem[] = [
  { key: "consult", iconActive: "calendar-clear", iconInactive: "calendar-clear-outline", label: "Consult", route: "/consult" },
  { key: "muni", iconActive: "chatbox-ellipses", iconInactive: "chatbox-ellipses-outline", label: "Muni", route: "/muni-avatar" },
];

const ALL_TABS: NavItem[] = [...NAV_ITEMS_LEFT, ...NAV_ITEMS_RIGHT];

const MICROPHONE_IMAGE = require("../../assets/images/microphone_sample.png");
const MUNI_NAV_ACTIVE_IMAGE = require("../../assets/images/MUNI_Active.png");
const MUNI_NAV_INACTIVE_IMAGE = require("../../assets/images/MUNI_Outline.png");

function triggerAppleHaptic(style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) {
  try {
    void Haptics.impactAsync(style);
  } catch {}
}

type HomeBottomNavProps = {
  activeTab?: TabKeyClean | "profile";
  onBeforeLeave?: (nextRoute: string) => boolean;
  transparent?: boolean;
};

export function HomeBottomNav({ activeTab, onBeforeLeave, transparent = false }: HomeBottomNavProps) {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const normalizedActiveTab = activeTab === "profile" ? "consult" : activeTab;
  const isVoicePage = pathname.startsWith("/muni-voice");
  const derivedActiveTab: TabKeyClean | undefined =
    activeTab === "none"
      ? undefined
      : normalizedActiveTab ??
        (pathname.startsWith("/journal")
          ? "journal"
          : pathname.startsWith("/muni-avatar")
            ? "muni"
          : pathname.startsWith("/consult")
            ? "consult"
          : pathname === "/home"
            ? "home"
            : undefined);

  // Apple Spring animation values
  const tabScales = useRef(ALL_TABS.map(() => new Animated.Value(1))).current;
  const tabLiftAnims = useRef(ALL_TABS.map(() => new Animated.Value(0))).current;
  const tabPopAnims = useRef(ALL_TABS.map(() => new Animated.Value(1))).current;
  const micBtnScale = useRef(new Animated.Value(1)).current;
  const micPulseAnim = useRef(new Animated.Value(0)).current;

  // Center microphone breathing pulse
  useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(micPulseAnim, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(micPulseAnim, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    pulseLoop.start();
    return () => pulseLoop.stop();
  }, [micPulseAnim]);

  // Tab Switch: Icon Spring Leap & Scale Pop
  useEffect(() => {
    const activeIndex = ALL_TABS.findIndex((item) => item.key === derivedActiveTab);
    if (activeIndex >= 0) {
      Animated.sequence([
        Animated.timing(tabLiftAnims[activeIndex], {
          toValue: -5,
          duration: 150,
          easing: Easing.out(Easing.back(1.8)),
          useNativeDriver: true,
        }),
        Animated.spring(tabLiftAnims[activeIndex], {
          toValue: 0,
          damping: 12,
          stiffness: 260,
          mass: 0.7,
          useNativeDriver: true,
        }),
      ]).start();

      Animated.sequence([
        Animated.timing(tabPopAnims[activeIndex], {
          toValue: 1.15,
          duration: 150,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.spring(tabPopAnims[activeIndex], {
          toValue: 1,
          damping: 10,
          stiffness: 240,
          mass: 0.7,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [derivedActiveTab, tabLiftAnims, tabPopAnims]);

  const handleTabPressIn = (index: number) => {
    Animated.spring(tabScales[index], {
      toValue: 0.88,
      damping: 14,
      stiffness: 340,
      mass: 0.8,
      useNativeDriver: true,
    }).start();
    triggerAppleHaptic(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleTabPressOut = (index: number) => {
    Animated.spring(tabScales[index], {
      toValue: 1,
      damping: 12,
      stiffness: 240,
      mass: 0.8,
      useNativeDriver: true,
    }).start();
  };

  const handleMicPressIn = () => {
    Animated.spring(micBtnScale, {
      toValue: 0.86,
      damping: 14,
      stiffness: 340,
      mass: 0.8,
      useNativeDriver: true,
    }).start();
    triggerAppleHaptic(Haptics.ImpactFeedbackStyle.Medium);
  };

  const handleMicPressOut = () => {
    Animated.spring(micBtnScale, {
      toValue: 1,
      damping: 12,
      stiffness: 240,
      mass: 0.8,
      useNativeDriver: true,
    }).start();
  };

  const onTabPress = (item: NavItem) => {
    if (!item.route || pathname === item.route) return;
    if (onBeforeLeave && !onBeforeLeave(item.route)) return;
    router.replace(item.route);
  };

  const handleMicPress = () => {
    if (pathname === "/muni-voice") return;
    if (onBeforeLeave && !onBeforeLeave("/muni-voice")) return;
    router.push("/muni-voice" as never);
  };

  const renderTab = (item: NavItem, globalIndex: number) => {
    const isActive = item.key === derivedActiveTab;
    return (
      <View
        key={item.key}
        style={styles.tabSlot}
      >
        <Animated.View style={[{ width: "100%" }, { transform: [{ scale: tabScales[globalIndex] }] }]}>
          <Pressable
            style={styles.tabPressable}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            hitSlop={8}
            onPress={() => onTabPress(item)}
            onPressIn={() => handleTabPressIn(globalIndex)}
            onPressOut={() => handleTabPressOut(globalIndex)}
          >
            <Animated.View
              style={[
                styles.tabIconBox,
                {
                  transform: [
                    { translateY: tabLiftAnims[globalIndex] },
                    { scale: tabPopAnims[globalIndex] },
                  ],
                },
              ]}
            >
              {item.key === "muni" ? (
                <Image
                  source={isActive ? MUNI_NAV_ACTIVE_IMAGE : MUNI_NAV_INACTIVE_IMAGE}
                  style={styles.tabMuniArt}
                  resizeMode="contain"
                />
              ) : (
                <Ionicons
                  name={(isActive ? item.iconActive : item.iconInactive) as any}
                  size={21}
                  color={isActive ? "#1B5E14" : "#64748B"}
                />
              )}
            </Animated.View>
            <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>{item.label}</Text>
            {isActive ? <View style={styles.tabActiveIndicatorDot} /> : <View style={styles.tabInactiveDotPlaceholder} />}
          </Pressable>
        </Animated.View>
      </View>
    );
  };

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.bottomNavContainer,
        { paddingBottom: Math.max(insets.bottom, 8) + 4 },
      ]}
    >
      {/* Apple Dynamic Floating Glass Island Pill */}
      <BlurView
        intensity={92}
        tint="light"
        style={[styles.glassIsland, transparent && styles.glassIslandTransparent]}
      >
        <View style={styles.islandContentRow}>
          <View style={styles.tabWing}>
            {renderTab(NAV_ITEMS_LEFT[0], 0)}
            {renderTab(NAV_ITEMS_LEFT[1], 1)}
          </View>

          {/* Center Apple Voice Orb Slot */}
          <View style={styles.centerOrbSlot}>
            <Animated.View
              style={[
                styles.centerVoiceAura,
                {
                  transform: [
                    {
                      scale: micPulseAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 1.2],
                      }),
                    },
                  ],
                  opacity: micPulseAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.36, 0.1],
                  }),
                },
              ]}
              pointerEvents="none"
            />

            <Animated.View style={{ transform: [{ scale: micBtnScale }] }}>
              <Pressable
                style={[
                  styles.centerVoiceButton,
                  isVoicePage && styles.centerVoiceButtonActive,
                ]}
                accessibilityLabel="Start Muni Voice Companion"
                accessibilityRole="button"
                accessibilityState={{ selected: isVoicePage }}
                hitSlop={8}
                onPress={handleMicPress}
                onPressIn={handleMicPressIn}
                onPressOut={handleMicPressOut}
              >
                <View style={styles.centerVoiceGlassHighlight} />
                <Image
                  source={MICROPHONE_IMAGE}
                  style={styles.centerVoiceIcon}
                  resizeMode="contain"
                />
              </Pressable>
            </Animated.View>
          </View>

          <View style={styles.tabWing}>
            {renderTab(NAV_ITEMS_RIGHT[0], 2)}
            {renderTab(NAV_ITEMS_RIGHT[1], 3)}
          </View>
        </View>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  bottomNavContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 50,
    alignItems: "center",
    paddingHorizontal: 14,
  },
  glassIsland: {
    width: "100%",
    maxWidth: 392,
    height: 64,
    borderRadius: 999,
    borderWidth: 1.2,
    borderColor: "rgba(255, 255, 255, 0.8)",
    backgroundColor: "rgba(255, 255, 255, 0.72)",
    shadowColor: "#0D2112",
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
    overflow: "hidden",
    justifyContent: "center",
  },
  glassIslandTransparent: {
    backgroundColor: "rgba(247, 250, 246, 0.68)",
    borderColor: "rgba(255, 255, 255, 0.6)",
    shadowOpacity: 0.06,
  },
  islandContentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 6,
    height: "100%",
  },
  tabWing: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
  },
  tabSlot: {
    flex: 1,
    height: 54,
    alignItems: "center",
    justifyContent: "center",
  },
  tabPressable: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
  },
  tabIconBox: {
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  tabMuniArt: {
    width: 26,
    height: 26,
  },
  tabLabel: {
    color: "#64748B",
    fontSize: 10,
    lineHeight: 12,
    fontFamily: "Outfit-Medium",
    letterSpacing: -0.1,
  },
  tabLabelActive: {
    color: "#164E24",
    fontFamily: "Outfit-Bold",
  },
  tabActiveIndicatorDot: {
    width: 3.5,
    height: 3.5,
    borderRadius: 2,
    backgroundColor: "#2E7C1F",
    marginTop: 2,
  },
  tabInactiveDotPlaceholder: {
    height: 3.5,
    marginTop: 2,
  },
  centerOrbSlot: {
    width: 58,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 2,
  },
  centerVoiceAura: {
    position: "absolute",
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#52B72A",
  },
  centerVoiceButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#48B722",
    borderWidth: 1.5,
    borderColor: "#6DE344",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#1E4714",
    shadowOpacity: 0.28,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  centerVoiceButtonActive: {
    backgroundColor: "#3A9B1A",
    borderColor: "#57C42E" },
  centerVoiceGlassHighlight: {
    position: "absolute",
    top: 2,
    width: 38,
    height: 20,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.28)",
  },
  centerVoiceIcon: {
    width: 25,
    height: 25,
  },
});

