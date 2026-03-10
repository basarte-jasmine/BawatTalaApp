import { router, usePathname } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

type TabKey = "home" | "journal" | "lumi" | "profile";

type NavItem = {
  iconActive: string;
  iconInactive: string;
  label: string;
  key: TabKey;
  route?: "/home" | "/journal" | "/profile" | "/consult" | "/lumi-avatar";
};

const NAV_ITEMS: NavItem[] = [
  { key: "home", iconActive: "home", iconInactive: "home-outline", label: "Home", route: "/home" },
  { key: "journal", iconActive: "book", iconInactive: "book-outline", label: "Journal", route: "/journal" },
  { key: "profile", iconActive: "people", iconInactive: "people-outline", label: "Consult", route: "/consult" },
  { key: "lumi", iconActive: "chatbox-ellipses", iconInactive: "chatbox-ellipses-outline", label: "Lumi", route: "/lumi-avatar" },
];

const MICROPHONE_IMAGE = require("../../assets/images/microphone_sample.png");

type HomeBottomNavProps = {
  activeTab?: TabKey;
};

export function HomeBottomNav({ activeTab }: HomeBottomNavProps) {
  const pathname = usePathname();
  const derivedActiveTab: TabKey =
    activeTab ??
    (pathname.startsWith("/journal")
      ? "journal"
      : pathname.startsWith("/lumi-avatar")
        ? "lumi"
      : pathname.startsWith("/consult")
        ? "profile"
      : pathname.startsWith("/home")
        ? "home"
        : "home");

  const onTabPress = (item: NavItem) => {
    if (!item.route || pathname === item.route) return;
    router.replace(item.route);
  };

  const renderTab = (item: NavItem) => {
    const isActive = item.key === derivedActiveTab;
    return (
      <Pressable key={item.key} style={styles.navItem} onPress={() => onTabPress(item)}>
        <Ionicons name={(isActive ? item.iconActive : item.iconInactive) as any} size={21} color={isActive ? "#5AA33E" : "#444444"} />
        <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>{item.label}</Text>
      </Pressable>
    );
  };

  return (
    <View style={styles.bottomNav}>
      <View style={styles.navGrid}>
        {renderTab(NAV_ITEMS[0])}
        {renderTab(NAV_ITEMS[1])}

        <View style={styles.centerSlot} />

        {renderTab(NAV_ITEMS[2])}
        {renderTab(NAV_ITEMS[3])}
      </View>

      <View style={styles.centerNavWrap} pointerEvents="box-none">
        <Pressable style={styles.centerNavButton}>
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
    height: 64,
    borderTopWidth: 1,
    borderTopColor: "#BDE19D",
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    paddingHorizontal: 8,
    elevation: 8,
  },
  navGrid: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  navItem: {
    width: 66,
    height: 48,
    alignItems: "center",
    justifyContent: "flex-end",
    rowGap: 1,
  },
  navLabel: {
    color: "#4A4A4A",
    fontSize: 11,
    lineHeight: 13,
  },
  navLabelActive: {
    color: "#2F6F25",
    fontWeight: "700",
  },
  centerSlot: {
    width: 70,
    height: 48,
  },
  centerNavWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    top: -30,
    alignItems: "center",
  },
  centerNavButton: {
    width: 52,
    height: 52,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#94D268",
    backgroundColor: "#B6E98E",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#6B6B6B",
    shadowOpacity: 0.24,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  centerMicImage: {
    width: 28,
    height: 28,
  },
});
