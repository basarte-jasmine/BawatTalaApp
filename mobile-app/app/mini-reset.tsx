import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type ActivityId = "memory" | "pattern" | "recall" | "words";

const PAIRS = ["🌿", "🌿", "☀️", "☀️", "🪷", "🪷"];
const PATTERN = ["circle", "triangle", "square", "circle"] as const;
const RECALL_TILES = [1, 3, 5];
const WORD = "CALM";
const SCRAMBLED_WORD = ["L", "A", "M", "C"];

const ACTIVITY_COPY: Record<ActivityId, { eyebrow: string; title: string; instruction: string }> = {
  memory: { eyebrow: "Mini Reset · about 1 minute", title: "Gentle Pairs", instruction: "Turn over two cards at a time. There is no rush." },
  pattern: { eyebrow: "Mini Reset · about 30 seconds", title: "Notice the Pattern", instruction: "Take a breath and notice the sequence before it fades." },
  recall: { eyebrow: "Mini Reset · about 30 seconds", title: "Visual Recall", instruction: "Notice the three soft tiles. They will hide after a moment." },
  words: { eyebrow: "Mini Reset · about 30 seconds", title: "Unscramble a Word", instruction: "Tap the letters to rebuild a small calming word." },
};

function shuffledCards() {
  return [...PAIRS].sort(() => Math.random() - 0.5);
}

export default function MiniResetScreen() {
  const { activity } = useLocalSearchParams<{ activity?: ActivityId }>();
  const activityId: ActivityId = activity === "pattern" || activity === "recall" || activity === "words" ? activity : "memory";
  const copy = ACTIVITY_COPY[activityId];
  const [complete, setComplete] = useState(false);
  const [cards, setCards] = useState(shuffledCards);
  const [flipped, setFlipped] = useState<number[]>([]);
  const [matched, setMatched] = useState<number[]>([]);
  const [showPattern, setShowPattern] = useState(true);
  const [patternInput, setPatternInput] = useState<string[]>([]);
  const [showRecall, setShowRecall] = useState(true);
  const [recallInput, setRecallInput] = useState<number[]>([]);
  const [wordInput, setWordInput] = useState<string[]>([]);
  const [feedback, setFeedback] = useState("Small challenge, calm pace.");

  useEffect(() => {
    if (activityId !== "pattern") return;
    const timer = setTimeout(() => setShowPattern(false), 2200);
    return () => clearTimeout(timer);
  }, [activityId]);

  useEffect(() => {
    if (activityId !== "recall") return;
    const timer = setTimeout(() => setShowRecall(false), 3000);
    return () => clearTimeout(timer);
  }, [activityId]);

  const allMatched = matched.length === cards.length;
  useEffect(() => {
    if (activityId === "memory" && allMatched) {
      setComplete(true);
      setFeedback("You found every pair. Nicely noticed.");
    }
  }, [activityId, allMatched]);

  const reset = () => {
    setComplete(false); setFeedback("Small challenge, calm pace.");
    setCards(shuffledCards()); setFlipped([]); setMatched([]);
    setShowPattern(true); setPatternInput([]); setShowRecall(true); setRecallInput([]); setWordInput([]);
  };

  useEffect(() => {
    if (activityId !== "pattern" && activityId !== "recall") return;
    const timer = setTimeout(() => {
      if (activityId === "pattern") setShowPattern(false);
      if (activityId === "recall") setShowRecall(false);
    }, activityId === "recall" ? 3000 : 2200);
    return () => clearTimeout(timer);
  }, [activityId, complete]);

  const tapCard = (index: number) => {
    if (flipped.length === 2 || flipped.includes(index) || matched.includes(index) || complete) return;
    const next = [...flipped, index];
    setFlipped(next);
    if (next.length === 2) {
      if (cards[next[0]] === cards[next[1]]) {
        setMatched((current) => [...current, ...next]);
        setFlipped([]);
        setFeedback("A gentle match. Keep going when you’re ready.");
      } else {
        setFeedback("Not that pair—take a moment and try another.");
        setTimeout(() => setFlipped([]), 650);
      }
    }
  };

  const tapPattern = (shape: string) => {
    if (showPattern || complete) return;
    const next = [...patternInput, shape];
    if (shape !== PATTERN[next.length - 1]) {
      setPatternInput([]); setFeedback("Almost. Notice it once more, at your own pace."); return;
    }
    setPatternInput(next);
    if (next.length === PATTERN.length) { setComplete(true); setFeedback("You stayed with the pattern. Well done."); }
  };

  const tapRecall = (tile: number) => {
    if (showRecall || complete || recallInput.includes(tile)) return;
    const next = [...recallInput, tile].sort((a, b) => a - b);
    if (!RECALL_TILES.includes(tile)) { setRecallInput([]); setFeedback("That’s okay. Take another look when you’re ready."); return; }
    setRecallInput(next);
    if (next.length === RECALL_TILES.length) { setComplete(true); setFeedback("You recalled the arrangement. Nicely focused."); }
  };

  const tapLetter = (letter: string, index: number) => {
    if (complete || wordInput.includes(`${letter}${index}`)) return;
    const next = [...wordInput, `${letter}${index}`];
    const attempt = next.map((entry) => entry[0]).join("");
    if (!WORD.startsWith(attempt)) { setWordInput([]); setFeedback("A fresh try can be helpful—there’s no pressure."); return; }
    setWordInput(next);
    if (attempt === WORD) { setComplete(true); setFeedback("CALM. A small word for this moment."); }
  };

  const selectedLetters = useMemo(() => wordInput.map((entry) => entry[0]), [wordInput]);

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.topBar}>
        <Pressable style={styles.backButton} accessibilityLabel="Back to Wellness Tools" onPress={() => router.replace("/wellness-tools")}>
          <Ionicons name="chevron-back" size={28} color="#37424F" />
        </Pressable>
        <Text style={styles.topTitle}>Mini Reset</Text><View style={styles.backButton} />
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.intro}><Text style={styles.eyebrow}>{copy.eyebrow}</Text><Text style={styles.heading}>{copy.title}</Text><Text style={styles.instruction}>{copy.instruction}</Text></View>
        <View style={styles.gameCard}>
          {activityId === "memory" && <View style={styles.memoryGrid}>{cards.map((card, index) => { const open = flipped.includes(index) || matched.includes(index); return <Pressable key={`${card}-${index}`} onPress={() => tapCard(index)} style={[styles.memoryCard, open && styles.memoryCardOpen]} accessibilityLabel={open ? `Card ${card}` : "Turn over card"}><Text style={styles.memoryCardText}>{open ? card : "✦"}</Text></Pressable>; })}</View>}
          {activityId === "pattern" && <PatternGame show={showPattern} selected={patternInput} onTap={tapPattern} />}
          {activityId === "recall" && <RecallGame show={showRecall} selected={recallInput} onTap={tapRecall} />}
          {activityId === "words" && <View><View style={styles.wordSlots}>{Array.from({ length: WORD.length }).map((_, index) => <View key={index} style={styles.wordSlot}><Text style={styles.wordSlotText}>{selectedLetters[index] ?? ""}</Text></View>)}</View><Text style={styles.wordHint}>A word for a steady moment</Text><View style={styles.letterRow}>{SCRAMBLED_WORD.map((letter, index) => <Pressable key={`${letter}-${index}`} onPress={() => tapLetter(letter, index)} style={[styles.letterButton, wordInput.includes(`${letter}${index}`) && styles.letterButtonUsed]}><Text style={styles.letterText}>{letter}</Text></Pressable>)}</View></View>}
        </View>
        <View style={[styles.feedback, complete && styles.feedbackComplete]}><Ionicons name={complete ? "heart-outline" : "leaf-outline"} size={20} color={complete ? "#477A43" : "#626A86"} /><Text style={styles.feedbackText}>{feedback}</Text></View>
        {complete && <View style={styles.completeCard}><Text style={styles.completeTitle}>A little reset, complete.</Text><Text style={styles.completeText}>You gave your attention a gentle place to land.</Text><Pressable style={styles.tryAnother} onPress={reset}><Text style={styles.tryAnotherText}>Try again</Text><Ionicons name="refresh-outline" size={18} color="#FFFFFF" /></Pressable><Pressable onPress={() => router.replace("/wellness-tools")} style={styles.returnButton}><Text style={styles.returnButtonText}>Choose another mini reset</Text></Pressable></View>}
      </ScrollView>
    </SafeAreaView>
  );
}

function PatternGame({ show, selected, onTap }: { show: boolean; selected: string[]; onTap: (shape: string) => void }) {
  const icons: Record<string, "ellipse" | "triangle" | "square"> = { circle: "ellipse", triangle: "triangle", square: "square" };
  const choices = ["circle", "triangle", "square"];
  return <View><Text style={styles.gamePrompt}>{show ? "Notice the pattern" : `Repeat it · ${selected.length} of ${PATTERN.length}`}</Text>{show ? <View style={styles.sequenceRow}>{PATTERN.map((shape, index) => <Ionicons key={index} name={icons[shape]} size={35} color={["#7DA4C6", "#C88B81", "#87A982"][index % 3]} />)}</View> : <View style={styles.choiceRow}>{choices.map((shape) => <Pressable key={shape} onPress={() => onTap(shape)} style={styles.shapeChoice}><Ionicons name={icons[shape]} size={36} color="#617C90" /></Pressable>)}</View>}</View>;
}

function RecallGame({ show, selected, onTap }: { show: boolean; selected: number[]; onTap: (tile: number) => void }) {
  return <View><Text style={styles.gamePrompt}>{show ? "Notice the highlighted tiles" : `Tap the three you remember · ${selected.length} found`}</Text><View style={styles.recallGrid}>{Array.from({ length: 6 }).map((_, index) => { const tile = index + 1; const highlighted = show ? RECALL_TILES.includes(tile) : selected.includes(tile); return <Pressable key={tile} onPress={() => onTap(tile)} style={[styles.recallTile, highlighted && styles.recallTileHighlighted]}><Text style={styles.recallTileText}>{show ? (highlighted ? "✦" : "") : ""}</Text></Pressable>; })}</View></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F7FAF6" }, topBar: { height: 52, backgroundColor: "#FFFFFF", borderBottomWidth: 1, borderBottomColor: "#E6ECF1", flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 4 }, backButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center" }, topTitle: { color: "#33475C", fontSize: 18, fontFamily: "Outfit-Bold" }, content: { alignItems: "center", padding: 16, paddingBottom: 42 }, intro: { width: "100%", maxWidth: 420, backgroundColor: "#E8E6F6", borderRadius: 24, padding: 18, marginBottom: 14 }, eyebrow: { color: "#62618A", fontFamily: "Outfit-Bold", fontSize: 12, marginBottom: 8 }, heading: { color: "#384055", fontFamily: "Outfit-Bold", fontSize: 26, lineHeight: 32, marginBottom: 7 }, instruction: { color: "#5D6678", fontSize: 14, lineHeight: 20 }, gameCard: { width: "100%", maxWidth: 420, minHeight: 260, backgroundColor: "#FFFFFF", borderRadius: 24, borderWidth: 1, borderColor: "#E5E9E4", padding: 18, justifyContent: "center", shadowColor: "#66737E", shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2 }, memoryGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 12 }, memoryCard: { width: "29%", aspectRatio: 1, backgroundColor: "#E6EEF5", borderRadius: 18, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#D7E2EC" }, memoryCardOpen: { backgroundColor: "#FCF9EA", borderColor: "#EEE1A8" }, memoryCardText: { fontSize: 29, color: "#728BA0" }, gamePrompt: { color: "#536274", textAlign: "center", fontSize: 14, lineHeight: 20, marginBottom: 22, fontFamily: "Outfit-Bold" }, sequenceRow: { minHeight: 70, flexDirection: "row", justifyContent: "center", alignItems: "center", columnGap: 20 }, choiceRow: { flexDirection: "row", justifyContent: "center", columnGap: 14 }, shapeChoice: { width: 70, height: 70, borderRadius: 20, borderWidth: 1, borderColor: "#DCE7E7", backgroundColor: "#F6FAF9", alignItems: "center", justifyContent: "center" }, recallGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 12 }, recallTile: { width: "28%", aspectRatio: 1, borderRadius: 16, backgroundColor: "#EEF2F4", borderWidth: 1, borderColor: "#DDE5E8", alignItems: "center", justifyContent: "center" }, recallTileHighlighted: { backgroundColor: "#BFD8C2", borderColor: "#95BE9A" }, recallTileText: { color: "#49744C", fontSize: 24 }, wordSlots: { flexDirection: "row", justifyContent: "center", columnGap: 10, marginBottom: 12 }, wordSlot: { width: 42, height: 48, borderBottomWidth: 2, borderBottomColor: "#9AA6B0", alignItems: "center", justifyContent: "center" }, wordSlotText: { color: "#405065", fontSize: 24, fontFamily: "Outfit-Bold" }, wordHint: { color: "#738091", textAlign: "center", fontSize: 13, marginBottom: 22 }, letterRow: { flexDirection: "row", justifyContent: "center", columnGap: 9 }, letterButton: { width: 52, height: 52, borderRadius: 16, backgroundColor: "#E9E6F6", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#DAD5EC" }, letterButtonUsed: { opacity: 0.35 }, letterText: { color: "#4A496E", fontSize: 21, fontFamily: "Outfit-Bold" }, feedback: { width: "100%", maxWidth: 420, flexDirection: "row", alignItems: "center", columnGap: 10, borderRadius: 16, backgroundColor: "#F0F2F6", padding: 13, marginTop: 14 }, feedbackComplete: { backgroundColor: "#E7F3E4" }, feedbackText: { flex: 1, color: "#586474", fontSize: 13, lineHeight: 18 }, completeCard: { width: "100%", maxWidth: 420, borderRadius: 22, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E4ECE0", padding: 17, marginTop: 14, alignItems: "center" }, completeTitle: { color: "#3D5945", fontFamily: "Outfit-Bold", fontSize: 19, marginBottom: 5 }, completeText: { color: "#657568", fontSize: 13, textAlign: "center", lineHeight: 18, marginBottom: 15 }, tryAnother: { flexDirection: "row", alignItems: "center", columnGap: 7, backgroundColor: "#557E4C", paddingHorizontal: 17, paddingVertical: 11, borderRadius: 999 }, tryAnotherText: { color: "#FFFFFF", fontFamily: "Outfit-Bold", fontSize: 14 }, returnButton: { paddingTop: 15 }, returnButtonText: { color: "#596987", fontFamily: "Outfit-Bold", fontSize: 13 },
});
