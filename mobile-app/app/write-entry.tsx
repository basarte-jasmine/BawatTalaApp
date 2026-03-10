import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type EntryLine = {
  id: string;
  side: "left" | "right";
  text: string;
  withSpeaker?: boolean;
};

const LUMI_IMAGE = require("../assets/images/pet_sample.png");
const NOTEBOOK_RINGS = Array.from({ length: 12 }, (_, index) => index);
const PAPER_RULES = Array.from({ length: 24 }, (_, index) => index);

const ENTRY_LINES: EntryLine[] = [
  { id: "q1", side: "left", text: "Hello, Jasmine!\nHow was your day?", withSpeaker: true },
  { id: "a1", side: "right", text: "I feel really anxious today. I do not even know why exactly." },
  {
    id: "q2",
    side: "left",
    text: "Lets slow down together. What is the first thing you notice in your body when you say \"I feel anxious\"?",
    withSpeaker: true,
  },
  { id: "a2", side: "right", text: "My chest feels tight, and my thoughts are racing." },
  {
    id: "q3",
    side: "left",
    text: "Thank you for noticing that. If your racing thoughts had a main theme, what would they be about?",
    withSpeaker: true,
  },
  { id: "a3", side: "right", text: "I feel really anxious today. Can you help me?" },
  { id: "q4", side: "left", text: "Interested in a private check-in with a counselor?", withSpeaker: true },
  { id: "a4", side: "right", text: "Yes, please." },
];

export default function WriteEntryScreen() {
  const closeToJournal = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/journal");
  };

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.content}>
        <View style={styles.pageWrap}>
          <View style={styles.notebookShell}>
            <View style={styles.spineColumn}>
              {NOTEBOOK_RINGS.map((ring) => (
                <View key={`ring-${ring}`} style={[styles.ringItem, { top: 16 + ring * 44 }]}>
                  <View style={styles.ringHole} />
                  <View style={styles.ringArc} />
                </View>
              ))}
            </View>

            <View style={styles.paperCard}>
              <View style={styles.ruleLayer} pointerEvents="none">
                {PAPER_RULES.map((line) => (
                  <View key={`rule-${line}`} style={[styles.ruleLine, { top: 52 + line * 26 }]} />
                ))}
              </View>

              <View style={styles.marginLine} />

              <Text style={styles.dateText}>TODAY, FEB 03 2026 9:00AM</Text>

              <ScrollView
                style={styles.conversationScroll}
                contentContainerStyle={styles.conversationContent}
                showsVerticalScrollIndicator={false}
              >
                {ENTRY_LINES.map((line) =>
                  line.side === "left" ? (
                    <View key={line.id} style={styles.leftMessageRow}>
                      <Text style={styles.leftMessageText}>{line.text}</Text>
                      {line.withSpeaker ? (
                        <Ionicons name="volume-high" size={13} color="#1C2430" style={styles.speakerIcon} />
                      ) : null}
                    </View>
                  ) : (
                    <View key={line.id} style={styles.rightMessageRow}>
                      <Text style={styles.rightMessageText}>{line.text}</Text>
                    </View>
                  ),
                )}
              </ScrollView>

              <View style={styles.footnoteWrap}>
                <Text style={styles.footnoteText}>
                  This journal feature is powered by Lumi, your virtual companion. Bawat Tala is not a substitute for
                  professional mental health care.
                </Text>

                <View style={styles.lumiBadge}>
                  <Image source={LUMI_IMAGE} style={styles.lumiBadgeImage} resizeMode="contain" />
                </View>
              </View>
            </View>
          </View>
        </View>

        <Pressable style={styles.finishButton} onPress={() => router.replace("/journal-entries")}>
          <Text style={styles.finishButtonText}>Finish Entry</Text>
        </Pressable>

        <Pressable style={styles.exitButton} onPress={closeToJournal}>
          <Text style={styles.exitButtonText}>Exit</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#ECECEC",
  },
  content: {
    flex: 1,
    paddingTop: 8,
    paddingHorizontal: 10,
    paddingBottom: 18,
  },
  pageWrap: {
    flex: 1,
    minHeight: 440,
    marginBottom: 12,
    borderRadius: 24,
    overflow: "hidden",
  },
  notebookShell: {
    flex: 1,
    backgroundColor: "#73C94D",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#6AB847",
    padding: 5,
    flexDirection: "row",
  },
  spineColumn: {
    width: 30,
    borderTopLeftRadius: 20,
    borderBottomLeftRadius: 20,
    backgroundColor: "#CDEAB2",
    position: "relative",
  },
  ringItem: {
    position: "absolute",
    left: 1,
    width: 32,
    height: 20,
    justifyContent: "center",
  },
  ringHole: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: "#EAEAEA",
    marginLeft: 3,
  },
  ringArc: {
    position: "absolute",
    left: 8,
    width: 22,
    height: 16,
    borderWidth: 3,
    borderRightWidth: 0,
    borderColor: "#8E989F",
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
  },
  paperCard: {
    flex: 1,
    backgroundColor: "#FAFCF8",
    borderRadius: 18,
    borderTopLeftRadius: 8,
    paddingTop: 14,
    paddingHorizontal: 14,
    paddingBottom: 10,
    position: "relative",
  },
  ruleLayer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 58,
  },
  ruleLine: {
    position: "absolute",
    left: 10,
    right: 10,
    height: 1,
    backgroundColor: "#DAE8D8",
  },
  marginLine: {
    position: "absolute",
    top: 46,
    bottom: 58,
    left: 30,
    width: 1,
    backgroundColor: "#E7BFC2",
  },
  dateText: {
    color: "#586B63",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
    letterSpacing: 0.2,
    marginBottom: 10,
    marginLeft: 22,
  },
  conversationScroll: {
    flex: 1,
  },
  conversationContent: {
    paddingBottom: 16,
    paddingTop: 4,
    rowGap: 8,
  },
  leftMessageRow: {
    maxWidth: "84%",
    alignSelf: "flex-start",
    paddingLeft: 22,
  },
  leftMessageText: {
    color: "#2D3B4D",
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "700",
  },
  speakerIcon: {
    marginTop: 2,
    marginLeft: 2,
  },
  rightMessageRow: {
    maxWidth: "78%",
    alignSelf: "flex-end",
  },
  rightMessageText: {
    color: "#2D3B4D",
    fontSize: 15,
    lineHeight: 21,
    textAlign: "right",
    fontWeight: "500",
  },
  footnoteWrap: {
    minHeight: 38,
    justifyContent: "center",
    paddingRight: 38,
    marginTop: 2,
  },
  footnoteText: {
    color: "#334256",
    fontSize: 10,
    lineHeight: 12,
    textAlign: "center",
  },
  lumiBadge: {
    position: "absolute",
    right: 1,
    bottom: 1,
    width: 32,
    height: 32,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: "#4B8F33",
    backgroundColor: "#C2EDAA",
    alignItems: "center",
    justifyContent: "center",
  },
  lumiBadgeImage: {
    width: 24,
    height: 24,
  },
  finishButton: {
    height: 44,
    borderRadius: 999,
    backgroundColor: "#73CB47",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 12,
    marginBottom: 8,
    shadowColor: "#6D6D6D",
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  finishButtonText: {
    color: "#FFFFFF",
    fontSize: 17,
    lineHeight: 24,
    fontWeight: "700",
  },
  exitButton: {
    height: 40,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#AEB3B9",
    backgroundColor: "#ECECEC",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 12,
  },
  exitButtonText: {
    color: "#314257",
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "700",
  },
});
