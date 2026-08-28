import { router, usePathname } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type TabKey = "home" | "journal" | "muni" | "profile" | "none";

type NavItem = {
  iconActive: string;
  iconInactive: string;
  label: string;
  key: TabKey;
  route?: "/home" | "/journal" | "/profile" | "/consult" | "/muni-avatar";
};

const NAV_ITEMS: NavItem[] = [
  { key: "home", iconActive: "home", iconInactive: "home-outline", label: "Home", route: "/home" },
  { key: "journal", iconActive: "book", iconInactive: "book-outline", label: "Journal", route: "/journal" },
  { key: "profile", iconActive: "calendar-clear", iconInactive: "calendar-clear-outline", label: "Consult", route: "/consult" },
  { key: "muni", iconActive: "chatbox-ellipses", iconInactive: "chatbox-ellipses-outline", label: "Muni", route: "/muni-avatar" },
];

const MICROPHONE_IMAGE = require("../../assets/images/microphone_sample.png");
const MUNI_NAV_ACTIVE_IMAGE = require("../../assets/images/MUNI_Active.png");
const MUNI_NAV_INACTIVE_IMAGE = require("../../assets/images/MUNI_Outline.png");

type HomeBottomNavProps = {
  activeTab?: TabKey;
  onBeforeLeave?: (nextRoute: string) => boolean;
  transparent?: boolean;
};

export function HomeBottomNav({ activeTab, onBeforeLeave, transparent = false }: HomeBottomNavProps) {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const derivedActiveTab: TabKey | undefined =
    activeTab === "none"
      ? undefined
      : activeTab ??
        (pathname.startsWith("/journal")
          ? "journal"
          : pathname.startsWith("/muni-avatar") || pathname.startsWith("/muni-voice")
            ? "muni"
          : pathname.startsWith("/consult")
            ? "profile"
          : pathname === "/home"
            ? "home"
            : undefined);

  const onTabPress = (item: NavItem) => {
    if (!item.route || pathname === item.route) return;
    if (onBeforeLeave && !onBeforeLeave(item.route)) return;
    router.replace(item.route);
  };

  const handleMicPress = () => {
    if (pathname === "/muni-voice") {
      return;
    }
    if (onBeforeLeave && !onBeforeLeave("/muni-voice")) return;
    router.push("/muni-voice" as never);
  };

  const renderTab = (item: NavItem) => {
    const isActive = item.key === derivedActiveTab;
    return (
      <Pressable
        key={item.key}
        style={[
          styles.navItem,
          isActive && styles.navItemActive,
          transparent && isActive && styles.navItemActiveTransparent,
        ]}
        accessibilityRole="button"
        accessibilityState={{ selected: isActive }}
        hitSlop={8}
        onPress={() => onTabPress(item)}
      >
        <View
          style={[
            styles.navIconBubble,
            isActive ? styles.navIconBubbleActive : styles.navIconBubbleInactive,
            transparent && !isActive && styles.navIconBubbleInactiveTransparent,
          ]}
        >
          {item.key === "muni" ? (
            <Image
              source={isActive ? MUNI_NAV_ACTIVE_IMAGE : MUNI_NAV_INACTIVE_IMAGE}
              style={styles.navMuniImage}
              resizeMode="contain"
            />
          ) : (
            <Ionicons
              name={(isActive ? item.iconActive : item.iconInactive) as any}
              size={19}
              color={isActive ? "#3F7A28" : "#66737F"}
            />
          )}
        </View>
        <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>{item.label}</Text>
      </Pressable>
    );
  };

  return (
    <View pointerEvents="box-none" style={[styles.bottomNav, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      <View style={[styles.navShell, transparent && styles.navShellTransparent]}>
        <View style={styles.navGlowOne} />
        <View style={styles.navGlowTwo} />
        <View style={styles.navGrid}>
          <View style={styles.navSideGroup}>
            {renderTab(NAV_ITEMS[0])}
            {renderTab(NAV_ITEMS[1])}
          </View>

          <View style={styles.centerSlot} />

          <View style={styles.navSideGroup}>
            {renderTab(NAV_ITEMS[2])}
            {renderTab(NAV_ITEMS[3])}
          </View>
        </View>
      </View>

      <View pointerEvents="box-none" style={styles.centerActionWrap}>
        <Pressable
          style={[
            styles.centerActionButton,
            derivedActiveTab === "muni" && styles.centerActionButtonActive,
            transparent && styles.centerActionButtonTransparent,
          ]}
          accessibilityLabel="Start Muni voice"
          accessibilityRole="button"
          accessibilityState={{ selected: derivedActiveTab === "muni" }}
          hitSlop={8}
          onPress={handleMicPress}
        >
          <View style={styles.centerActionInnerRing} />
          <Image source={MICROPHONE_IMAGE} style={styles.centerMicImage} resizeMode="contain" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bottomNav: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 40,
    paddingHorizontal: 12,
  },
  navShell: {
    minHeight: 76,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "#DDE9D3",
    backgroundColor: "rgba(255,255,255,0.96)",
    paddingHorizontal: 8,
    paddingVertical: 8,
    justifyContent: "center",
    shadowColor: "#73806D",
    shadowOpacity: 0.16,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 12,
    overflow: "hidden",
  },
  navShellTransparent: {
    backgroundColor: "rgba(247,250,246,0.76)",
    borderColor: "rgba(221,233,211,0.72)",
    shadowOpacity: 0.08,
  },
  navGlowOne: {
    position: "absolute",
    top: -34,
    right: 26,
    width: 104,
    height: 104,
    borderRadius: 999,
    backgroundColor: "rgba(212, 243, 181, 0.28)",
  },
  navGlowTwo: {
    position: "absolute",
    left: -16,
    bottom: -34,
    width: 86,
    height: 86,
    borderRadius: 999,
    backgroundColor: "rgba(204, 231, 218, 0.22)",
  },
  navGrid: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    columnGap: 6,
  },
  navSideGroup: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    columnGap: 6,
  },
  navItem: {
    flex: 1,
    minHeight: 58,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    paddingVertical: 6,
  },
  navItemActive: {
    backgroundColor: "rgba(242, 249, 236, 0.96)",
    borderWidth: 1,
    borderColor: "#D8E8CB",
  },
  navItemActiveTransparent: {
    backgroundColor: "rgba(255,255,255,0.82)",
  },
  navIconBubble: {
    width: 34,
    height: 34,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  navIconBubbleActive: {
    backgroundColor: "#EAF5DE",
    borderWidth: 1,
    borderColor: "#D7E7CB",
  },
  navIconBubbleInactive: {
    backgroundColor: "rgba(255,255,255,0.58)",
  },
  navIconBubbleInactiveTransparent: {
    backgroundColor: "rgba(255,255,255,0.28)",
  },
  navMuniImage: {
    width: 28,
    height: 28,
  },
  navLabel: {
    color: "#6A7681",
    fontSize: 11.5,
    lineHeight: 14,
    fontWeight: "600",
  },
  navLabelActive: {
    color: "#386C2A",
    fontWeight: "700",
  },
  centerSlot: {
    width: 76,
  },
  centerActionWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    top: -18,
    alignItems: "center",
  },
  centerActionButton: {
    width: 68,
    height: 68,
    borderRadius: 999,
    backgroundColor: "#AEE17E",
    borderWidth: 1,
    borderColor: "#90C96A",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#6D7F69",
    shadowOpacity: 0.24,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  centerActionButtonActive: {
    backgroundColor: "#9CDA68",
    borderColor: "#78BE49",
  },
  centerActionButtonTransparent: {
    backgroundColor: "rgba(174,225,126,0.94)",
  },
  centerActionInnerRing: {
    position: "absolute",
    width: 48,
    height: 48,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.28)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.38)",
  },
  centerMicImage: {
    width: 32,
    height: 32,
  },
});


