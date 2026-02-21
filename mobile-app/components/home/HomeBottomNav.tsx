import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, View } from "react-native";

export function HomeBottomNav() {
  return (
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
  );
}

const styles = StyleSheet.create({
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
