import { router } from "expo-router";
import { Image, Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";

export default function IntroScreen() {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.container}>
        <Image
          source={require("../assets/images/texture.png")}
          style={styles.texture}
          resizeMode="cover"
        />
        <Image
          source={require("../assets/images/textLOGO.png")}
          style={styles.textLogo}
          resizeMode="contain"
        />
        <Text style={styles.note}>you, me, we&apos;ll figure out together.</Text>
        <Pressable style={styles.nextButton} onPress={() => router.push("/auth-choice")}>
          <Text style={styles.nextButtonText}>Next</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#FFF8E9",
  },
  container: {
    flex: 1,
    backgroundColor: "#FFF8E9",
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
  texture: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.5,
  },
  textLogo: {
    width: "84%",
    height: 210,
    marginBottom: 100,
  },
  note: {
    position: "absolute",
    left: 18,
    bottom: 72,
    color: "#d79ca0",
    fontSize: 26,
    maxWidth: 190,
    lineHeight: 32,
  },
  nextButton: {
    position: "absolute",
    bottom: 18,
    alignSelf: "center",
    backgroundColor: "#8f2a2a",
    borderColor: "#6d1f1f",
    borderWidth: 2,
    borderRadius: 10,
    paddingHorizontal: 26,
    paddingVertical: 10,
  },
  nextButtonText: {
    color: "#f7efe2",
    fontSize: 20,
    fontWeight: "700",
  },
});
