import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";

export default function HomeScreen() {
  const [bookOpen, setBookOpen] = useState(false);
  const bookAnimation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(bookAnimation, {
      toValue: bookOpen ? 1 : 0,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, [bookAnimation, bookOpen]);

  const coverRotation = bookAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "-130deg"],
  });

  const innerPageOpacity = bookAnimation.interpolate({
    inputRange: [0, 0.7, 1],
    outputRange: [0, 0.2, 1],
  });

  return (
    <SafeAreaView style={styles.fullscreen}>
      <View style={styles.homeWrap}>
        <Text style={styles.homeTitle}>Home</Text>
        <Text style={styles.homeSubtitle}>Tap your journal book to open it.</Text>

        <Pressable onPress={() => setBookOpen((prev) => !prev)} style={styles.bookTouchArea}>
          <View style={styles.bookBase}>
            <Animated.View
              style={[
                styles.bookCover,
                { transform: [{ perspective: 1000 }, { rotateY: coverRotation }] },
              ]}
            />
            <Animated.View style={[styles.bookInnerPage, { opacity: innerPageOpacity }]}>
              <Text style={styles.pageText}>Today I feel...</Text>
            </Animated.View>
          </View>
        </Pressable>

        <Text style={styles.bookHint}>{bookOpen ? "Journal opened" : "Journal closed"}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fullscreen: {
    flex: 1,
    backgroundColor: "#e7e3df",
  },
  homeWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  homeTitle: {
    fontSize: 34,
    fontWeight: "800",
    color: "#4a4033",
    marginBottom: 6,
  },
  homeSubtitle: {
    fontSize: 15,
    color: "#6f5a44",
    marginBottom: 26,
  },
  bookTouchArea: {
    padding: 12,
  },
  bookBase: {
    width: 220,
    height: 160,
    backgroundColor: "#efe7d3",
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#cdbda0",
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
  bookCover: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 110,
    backgroundColor: "#8f2a2a",
    borderRightWidth: 2,
    borderRightColor: "#6d1f1f",
  },
  bookInnerPage: {
    width: 150,
    height: 110,
    borderRadius: 8,
    backgroundColor: "#fffef8",
    borderWidth: 1,
    borderColor: "#e8dcc3",
    justifyContent: "center",
    alignItems: "center",
  },
  pageText: {
    color: "#6f5a44",
    fontWeight: "600",
  },
  bookHint: {
    marginTop: 10,
    fontSize: 14,
    fontWeight: "600",
    color: "#8f2a2a",
  },
});
