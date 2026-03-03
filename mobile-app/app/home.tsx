import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Image, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { HomeBottomNav } from "../components/home/HomeBottomNav";

type MoodItem = {
  color: string;
  emoji: string;
  label: string;
};

type SupportCardItem = {
  backgroundColor: string;
  description: string;
  icon?: string;
  id: string;
  title: string;
};

const MOODS: MoodItem[] = [
  { color: "#FFD616", emoji: "\uD83D\uDE42", label: "Happy" },
  { color: "#97CFDA", emoji: "\uD83D\uDE0C", label: "Calm" },
  { color: "#7EA9D9", emoji: "\uD83D\uDE22", label: "Sad" },
  { color: "#F19137", emoji: "\uD83D\uDE23", label: "Stressed" },
  { color: "#E86686", emoji: "\uD83D\uDE21", label: "Angry" },
  { color: "#B895C8", emoji: "\uD83D\uDE30", label: "Anxious" },
];

const RECENT_ENTRY_PLACEHOLDERS = [
  {
    id: "r1",
    meta: "February 25, 5:30PM",
    preview: "Today I finally noticed the small buds blooming on the plants in our balcony.",
  },
  {
    id: "r2",
    meta: "February 25, 3:00AM",
    preview: "I felt quite overwhelmed with my schoolwork but I managed to finish my work on time.",
  },
  {
    id: "r3",
    meta: "February 24, 1:30PM",
    preview: "Today I finally noticed the small buds blooming on the plants in our balcony.",
  },
  {
    id: "r4",
    meta: "February 23, 5:00PM",
    preview: "Today I finally noticed the small buds blooming on the plants in our balcony.",
  },
  {
    id: "r5",
    meta: "February 22, 10:40PM",
    preview: "Small wins today. I slowed down and gave myself enough rest before tomorrow.",
  },
];

const SUPPORT_CARDS: SupportCardItem[] = [
  {
    id: "support-1",
    title: "Talk to a Peer",
    description: "Connect with a trained student listener today.",
    backgroundColor: "#8DD867",
    icon: "people",
  },
  {
    id: "support-2",
    title: "Guidance\nCounseling",
    description: "Set up a confidential session.",
    backgroundColor: "#3EA760",
    icon: "person",
  },
  {
    id: "support-3",
    title: "Wellness Tools",
    description: "Calm your mind and body with exercises.",
    backgroundColor: "#99DF62",
  },
];

const TALA_IMAGE = require("../assets/images/tala_sample.png");
const PET_IMAGE = require("../assets/images/pet_sample.png");

export default function HomeScreen() {
  const { height } = useWindowDimensions();
  const compact = height < 760;
  const tiny = height < 680;
  const [selectedMood, setSelectedMood] = useState("Happy");
  const [hasScrolled, setHasScrolled] = useState(false);
  const headerSwitchOn = 120;
  const headerSwitchOff = 120;
  const idleValues = useRef(MOODS.map(() => new Animated.Value(0))).current;
  const pressScales = useRef(MOODS.map(() => new Animated.Value(1))).current;
  const waveDrift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loops = idleValues.map((value, index) => {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.delay(index * 120),
          Animated.timing(value, {
            toValue: 1,
            duration: 1150,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: 0,
            duration: 1150,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
      );
      loop.start();
      return loop;
    });

    return () => {
      loops.forEach((loop) => loop.stop());
    };
  }, [idleValues]);

  useEffect(() => {
    const driftLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(waveDrift, {
          toValue: 1,
          duration: 3600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(waveDrift, {
          toValue: 0,
          duration: 3600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );

    driftLoop.start();

    return () => {
      driftLoop.stop();
    };
  }, [waveDrift]);

  const handleMoodPressIn = (index: number) => {
    Animated.spring(pressScales[index], {
      toValue: 0.9,
      useNativeDriver: true,
      speed: 30,
      bounciness: 8,
    }).start();
  };

  const handleMoodPressOut = (index: number) => {
    Animated.spring(pressScales[index], {
      toValue: 1,
      useNativeDriver: true,
      speed: 20,
      bounciness: 10,
    }).start();
  };

  const handleHomeScroll = (offsetY: number) => {
    setHasScrolled((currentHasScrolled) => {
      if (currentHasScrolled) return offsetY > headerSwitchOff;
      return offsetY > headerSwitchOn;
    });
  };

  const waveTranslateX = waveDrift.interpolate({
    inputRange: [0, 1],
    outputRange: [-22, 22],
  });
  const waveTranslateXReverse = waveDrift.interpolate({
    inputRange: [0, 1],
    outputRange: [16, -16],
  });

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={[styles.stickyHeader, hasScrolled ? styles.stickyHeaderScrolled : styles.stickyHeaderTop]}>
        <Pressable
          style={styles.headerLeft}
          accessibilityLabel="Open profile"
          onPress={() => router.push("/profile")}
        >
          <View style={[styles.avatarCircle, hasScrolled ? styles.avatarCircleScrolled : styles.avatarCircleTop]}>
            <Ionicons name="person-outline" size={18} color="#5D5D5D" />
          </View>
          <Text style={[styles.greetingText, hasScrolled ? styles.greetingTextScrolled : styles.greetingTextTop]}>
            Hello, <Text style={[styles.userText, hasScrolled ? styles.userTextScrolled : styles.userTextTop]}>User</Text>
          </Text>
        </Pressable>

        <Pressable
          style={styles.calendarButton}
          accessibilityLabel="Open calendar"
          onPress={() => router.push("/calendar-checkin")}
        >
          <Ionicons name="calendar-outline" size={22} color={hasScrolled ? "#2D3034" : "#2E4A39"} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.contentScroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={(event) => handleHomeScroll(event.nativeEvent.contentOffset.y)}
      >
        <View style={[styles.quoteHero, compact && styles.quoteHeroCompact, tiny && styles.quoteHeroTiny]}>
          <View style={styles.quoteHeroBody}>
            <Text style={styles.quoteText}>It&apos;s okay to not have it all figured out.</Text>
          </View>

          <View style={styles.quoteWaveBase} pointerEvents="none" />

          <Animated.View
            style={[styles.quoteWaveWrap, { transform: [{ translateX: waveTranslateX }] }]}
            pointerEvents="none"
          >
            <Svg width="100%" height="96" viewBox="0 0 412 96" preserveAspectRatio="none">
              <Path
                d="M0,66 C68,94 132,8 198,26 C278,46 336,92 412,62 L412,96 L0,96 Z"
                fill="#ECECEC"
              />
            </Svg>
          </Animated.View>
          <Animated.View
            style={[styles.quoteWaveShadeWrap, { transform: [{ translateX: waveTranslateXReverse }] }]}
            pointerEvents="none"
          >
            <Svg width="100%" height="54" viewBox="0 0 412 54" preserveAspectRatio="none">
              <Path
                d="M0,39 C74,54 134,2 198,12 C280,24 338,52 412,36"
                stroke="#9AD96A"
                strokeWidth={14}
                strokeOpacity={0.3}
                fill="none"
              />
            </Svg>
          </Animated.View>
          <Animated.View
            style={[styles.quoteWaveLineWrap, { transform: [{ translateX: waveTranslateX }] }]}
            pointerEvents="none"
          >
            <Svg width="100%" height="52" viewBox="0 0 412 52" preserveAspectRatio="none">
              <Path d="M0,36 C74,51 134,1 198,11 C280,24 338,50 412,35" stroke="#8CD858" strokeWidth={5} fill="none" />
            </Svg>
          </Animated.View>
        </View>

        <View style={styles.quickRow}>
          <View style={[styles.quickCard, styles.quickCardLeft]}>
            <Image source={TALA_IMAGE} style={styles.quickArtTala} resizeMode="contain" />
            <Text style={styles.quickTitle}>Daily Tala</Text>
            <Text style={styles.quickDescription}>Keep going and gather your tala!</Text>
            <Pressable style={styles.quickButton}>
              <Text style={styles.quickButtonText}>Check in</Text>
            </Pressable>
          </View>

          <View style={styles.quickCard}>
            <Image source={PET_IMAGE} style={styles.quickArtPet} resizeMode="contain" />
            <Text style={styles.quickTitle}>Express yourself!</Text>
            <Text style={styles.quickDescription}>Level up your look! Tap to style your Diwa.</Text>
            <Pressable style={styles.quickButton}>
              <Text style={styles.quickButtonText}>Style my Diwa</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.moodCard}>
          <Text style={styles.moodHeading}>Mood Check:</Text>
          <Text style={styles.moodSubHeading}>Your feelings matter. What&apos;s showing up?</Text>

          <View style={styles.moodRow}>
            {MOODS.map((mood, index) => (
              <View key={mood.label} style={styles.moodItem}>
                <Pressable
                  onPress={() => setSelectedMood(mood.label)}
                  onPressIn={() => handleMoodPressIn(index)}
                  onPressOut={() => handleMoodPressOut(index)}
                >
                  <Animated.View
                    style={[
                      styles.moodFace,
                      { backgroundColor: mood.color },
                      selectedMood === mood.label && styles.moodFaceActive,
                      {
                        transform: [
                          {
                            translateY: idleValues[index].interpolate({
                              inputRange: [0, 1],
                              outputRange: [0, -4],
                            }),
                          },
                          { scale: pressScales[index] },
                        ],
                      },
                    ]}
                  >
                    <Text style={styles.moodEmoji}>{mood.emoji}</Text>
                  </Animated.View>
                </Pressable>
                <Text style={[styles.moodLabel, selectedMood === mood.label && styles.moodLabelActive]}>
                  {mood.label}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.recentCard}>
          <View style={styles.recentHeader}>
            <Text style={styles.recentTitle}>Recent Entries</Text>
            <Ionicons name="list" size={22} color="#3F4A56" />
          </View>

          <View style={styles.recentListWrap}>
            <ScrollView
              style={styles.recentList}
              contentContainerStyle={styles.recentListContent}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled
            >
              {RECENT_ENTRY_PLACEHOLDERS.map((entry) => (
                <Pressable key={entry.id} style={styles.entryItem}>
                  <View style={styles.entryIconWrap}>
                    <Text style={styles.entryIcon}>{"\uD83D\uDCD6"}</Text>
                  </View>

                  <View style={styles.entryTextWrap}>
                    <Text style={styles.entryMeta}>{entry.meta}</Text>
                    <Text style={styles.entryPreview} numberOfLines={2}>
                      {entry.preview}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </ScrollView>

            <Pressable
              style={styles.addEntryButton}
              accessibilityLabel="Add entry"
              onPress={() => router.push("/journal")}
            >
              <Ionicons name="add" size={30} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>

        <View style={styles.supportRow}>
          {SUPPORT_CARDS.map((card) => (
            <Pressable key={card.id} style={[styles.supportCard, { backgroundColor: card.backgroundColor }]}>
              <View style={styles.supportIconCircle}>
                {card.icon ? <Ionicons name={card.icon as any} size={24} color="#5B6162" /> : null}
              </View>

              <Text style={styles.supportTitle}>{card.title}</Text>
              <Text style={styles.supportDescription}>{card.description}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <HomeBottomNav activeTab="home" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#ECECEC",
  },
  stickyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    zIndex: 20,
  },
  stickyHeaderTop: {
    backgroundColor: "#B4D89A",
    borderBottomWidth: 0,
  },
  stickyHeaderScrolled: {
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E2E2",
  },
  contentScroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 10,
    paddingTop: 0,
    paddingBottom: 112,
  },
  quoteHero: {
    backgroundColor: "#B4D89A",
    paddingTop: 10,
    paddingHorizontal: 16,
    paddingBottom: 66,
    position: "relative",
    overflow: "hidden",
    marginHorizontal: -10,
    marginBottom: 10,
  },
  quoteHeroCompact: {
    paddingBottom: 60,
  },
  quoteHeroTiny: {
    paddingBottom: 54,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 10,
  },
  avatarCircle: {
    width: 28,
    height: 28,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  avatarCircleTop: {
    borderColor: "#5E9550",
  },
  avatarCircleScrolled: {
    borderColor: "#5E9550",
  },
  greetingText: {
    fontSize: 33 / 2,
    lineHeight: 24,
    fontFamily: "Outfit",
  },
  greetingTextTop: {
    color: "#1E2F1F",
  },
  greetingTextScrolled: {
    color: "#1F1F1F",
  },
  userText: {
    fontFamily: "Outfit",
    fontWeight: "700",
  },
  userTextTop: {
    color: "#2E5722",
  },
  userTextScrolled: {
    color: "#2E5722",
  },
  calendarButton: {
    padding: 6,
    marginRight: 2,
    marginTop: 2,
  },
  quoteHeroBody: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 112,
    paddingHorizontal: 24,
  },
  quoteWaveBase: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 40,
    backgroundColor: "#ECECEC",
  },
  quoteWaveWrap: {
    position: "absolute",
    left: -48,
    right: -48,
    bottom: 0,
    height: 96,
  },
  quoteWaveShadeWrap: {
    position: "absolute",
    left: -48,
    right: -48,
    bottom: 20,
    height: 54,
  },
  quoteWaveLineWrap: {
    position: "absolute",
    left: -48,
    right: -48,
    bottom: 20,
    height: 52,
  },
  quoteText: {
    textAlign: "center",
    color: "#2F4257",
    fontSize: 33 / 2,
    lineHeight: 23,
    fontWeight: "700",
    maxWidth: 290,
  },
  quickRow: {
    width: "100%",
    flexDirection: "row",
    columnGap: 6,
    marginBottom: 12,
  },
  quickCard: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#A9C98F",
    backgroundColor: "#C5E7D6",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingTop: 12,
    paddingBottom: 10,
  },
  quickCardLeft: {
    backgroundColor: "#BFDCCD",
  },
  quickArtTala: {
    width: 76,
    height: 76,
    marginBottom: 2,
    marginTop: -4,
  },
  quickArtPet: {
    width: 82,
    height: 82,
    marginBottom: -4,
    marginTop: -8,
  },
  quickTitle: {
    textAlign: "center",
    color: "#1D1D1D",
    fontSize: 33 / 2,
    lineHeight: 20,
    fontWeight: "700",
    marginTop: 3,
    marginBottom: 3,
  },
  quickDescription: {
    textAlign: "center",
    color: "#3D3D3D",
    fontSize: 12 / 2 * 2,
    lineHeight: 17,
    marginBottom: 9,
  },
  quickButton: {
    height: 24,
    minWidth: 122,
    borderRadius: 999,
    backgroundColor: "#70C33E",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  quickButtonText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },
  moodCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#BFBFBF",
    backgroundColor: "#F6F6F6",
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 10,
    shadowColor: "#888888",
    shadowOpacity: 0.16,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    marginBottom: 10,
  },
  moodHeading: {
    color: "#2F3946",
    fontSize: 33 / 2,
    lineHeight: 20,
    fontWeight: "700",
    marginBottom: 2,
  },
  moodSubHeading: {
    color: "#353535",
    fontSize: 31 / 2,
    lineHeight: 23,
    marginBottom: 8,
  },
  moodRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  moodItem: {
    alignItems: "center",
  },
  moodFace: {
    width: 46,
    height: 46,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 3,
  },
  moodFaceActive: {
    borderWidth: 2,
    borderColor: "#2F6F25",
  },
  moodEmoji: {
    fontSize: 27,
    lineHeight: 30,
  },
  moodLabel: {
    color: "#4A4A4A",
    fontSize: 13,
    lineHeight: 16,
  },
  moodLabelActive: {
    color: "#2F6F25",
    fontWeight: "700",
  },
  recentCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#C8CCCE",
    backgroundColor: "#F4F5F4",
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 10,
    shadowColor: "#888888",
    shadowOpacity: 0.12,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
    marginBottom: 10,
  },
  recentHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  recentTitle: {
    color: "#324254",
    fontSize: 37 / 2,
    lineHeight: 24,
    fontWeight: "700",
  },
  recentListWrap: {
    position: "relative",
    height: 454,
  },
  recentList: {
    flex: 1,
  },
  recentListContent: {
    paddingBottom: 76,
    rowGap: 10,
  },
  entryItem: {
    borderRadius: 9,
    backgroundColor: "#DFECD9",
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 14,
    columnGap: 12,
  },
  entryIconWrap: {
    width: 68,
    height: 68,
    borderRadius: 999,
    backgroundColor: "#EDEFEA",
    alignItems: "center",
    justifyContent: "center",
  },
  entryIcon: {
    fontSize: 34,
    lineHeight: 36,
  },
  entryTextWrap: {
    flex: 1,
    paddingTop: 8,
  },
  entryMeta: {
    color: "#34465A",
    fontSize: 35 / 2,
    lineHeight: 24,
    fontWeight: "700",
    marginBottom: 4,
  },
  entryPreview: {
    color: "#2F3F52",
    fontSize: 33 / 2,
    lineHeight: 22,
  },
  addEntryButton: {
    position: "absolute",
    right: 10,
    bottom: 10,
    width: 56,
    height: 56,
    borderRadius: 999,
    backgroundColor: "#74B255",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#5E5E5E",
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  supportRow: {
    flexDirection: "row",
    columnGap: 7,
  },
  supportCard: {
    flex: 1,
    borderRadius: 12,
    minHeight: 138,
    paddingHorizontal: 6,
    paddingTop: 8,
    paddingBottom: 8,
  },
  supportIconCircle: {
    width: 54,
    height: 54,
    borderRadius: 999,
    backgroundColor: "#EDEFEF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  supportTitle: {
    color: "#FFFFFF",
    fontSize: 27 / 2,
    lineHeight: 18,
    fontWeight: "700",
    marginBottom: 6,
    minHeight: 36,
  },
  supportDescription: {
    color: "#E8F7E5",
    fontSize: 11,
    lineHeight: 14,
  },
});
