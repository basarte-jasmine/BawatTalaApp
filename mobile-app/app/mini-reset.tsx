import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuthSession } from "../lib/auth-session";
import { claimMiniResetReward } from "../lib/backend-api";

type ActivityId = "memory" | "pattern" | "recall" | "words" | "numbers" | "count" | "color";


const ACTIVITY_COPY: Record<ActivityId, { eyebrow: string; title: string; instruction: string }> = {
  memory: { eyebrow: "Mini Reset · about 1 minute", title: "Gentle Pairs", instruction: "Turn over two cards at a time. There is no rush." },
  pattern: { eyebrow: "Mini Reset · about 30 seconds", title: "Notice the Pattern", instruction: "Take a breath and notice the sequence before it fades." },
  recall: { eyebrow: "Mini Reset · about 30 seconds", title: "Visual Recall", instruction: "Notice the three soft tiles. They will hide after a moment." },
  words: { eyebrow: "Mini Reset · about 30 seconds", title: "Unscramble a Word", instruction: "Tap the letters to rebuild a small calming word." },
  numbers: { eyebrow: "Mini Reset · about 20 seconds", title: "Number Flow", instruction: "Notice the flow, then choose the next gentle step." },
  count: { eyebrow: "Mini Reset · about 20 seconds", title: "Calm Count", instruction: "Follow the numbers in order, one steady tap at a time." },
  color: { eyebrow: "Mini Reset · about 20 seconds", title: "Color Focus", instruction: "Let your eyes settle, then find the tile that matches." },
};

const EMOJI_POOL = ["🌱", "☀️", "🪷", "☁️", "🐚", "🐦", "💧", "🌙"];
function generateMemoryCards(level: number) {
  const numPairs = Math.min(3 + Math.floor((level - 1) / 2), 6);
  const shuffledPool = [...EMOJI_POOL].sort(() => Math.random() - 0.5);
  const selected = shuffledPool.slice(0, numPairs);
  const pairs = [...selected, ...selected];
  return pairs.sort(() => Math.random() - 0.5);
}

const SHAPES = ["circle", "triangle", "square"];
function generatePattern(level: number) {
  const length = Math.min(3 + Math.floor(level / 2), 7);
  const seq: string[] = [];
  for (let i = 0; i < length; i++) {
    seq.push(SHAPES[Math.floor(Math.random() * SHAPES.length)]);
  }
  return seq;
}

function generateRecall(level: number) {
  const total = level > 3 ? 9 : 6;
  const numToRecall = Math.min(3 + Math.floor(level / 3), total - 2);
  const tiles = Array.from({ length: total }).map((_, i) => i + 1).sort(() => Math.random() - 0.5);
  return { total, recallTiles: tiles.slice(0, numToRecall) };
}

const WORDS_POOL = ["CALM", "REST", "SOFT", "EASE", "SLOW", "PEACE", "QUIET", "STILL", "GENTLE", "BREATHE"];
function generateWord(level: number) {
  let pool = WORDS_POOL;
  if (level < 3) pool = WORDS_POOL.filter(w => w.length <= 4);
  else if (level < 5) pool = WORDS_POOL.filter(w => w.length <= 5);
  const word = pool[Math.floor(Math.random() * pool.length)] || "CALM";
  const scrambled = word.split("").sort(() => Math.random() - 0.5);
  return { word, scrambled };
}

function generateNumbers(level: number) {
  const step = Math.floor(Math.random() * 3) + 1 + Math.floor(level / 3);
  const start = Math.floor(Math.random() * 10) + 1;
  const prompt = `${start} -> ${start + step} -> ${start + step * 2} -> ?`;
  const answer = start + step * 3;
  let possible = [answer - 1, answer + 1, answer + 2, answer - 2, answer + step];
  possible = [...new Set(possible)].filter(x => x !== answer).sort(() => Math.random() - 0.5);
  const choices = [answer, possible[0], possible[1]].sort(() => Math.random() - 0.5);
  return { prompt, answer, choices };
}

function generateCount(level: number) {
  const total = Math.min(5 + Math.floor(level / 2), 9);
  return Array.from({ length: total }, (_, index) => index + 1).sort(() => Math.random() - 0.5);
}

const FOCUS_COLORS = ["#8DB6D9", "#E4A18D", "#A9C994", "#C2A5D3"];
function generateColor(level: number) {
  const target = FOCUS_COLORS[Math.floor(Math.random() * FOCUS_COLORS.length)];
  const options = [target, ...FOCUS_COLORS.filter((color) => color !== target).slice(0, Math.min(2 + Math.floor(level / 3), 3))].sort(() => Math.random() - 0.5);
  return { target, options };
}

export default function MiniResetScreen() {
  const { activity } = useLocalSearchParams<{ activity?: ActivityId }>();
  const activityId: ActivityId = activity === "pattern" || activity === "recall" || activity === "words" || activity === "numbers" || activity === "count" || activity === "color" ? activity : "memory";
  const copy = ACTIVITY_COPY[activityId];
  const { user } = useAuthSession();
  const [level, setLevel] = useState(1);
  const [focusPoints, setFocusPoints] = useState(0);
  const [earnedTala, setEarnedTala] = useState(0);
  const [isRewarding, setIsRewarding] = useState(false);
  const [complete, setComplete] = useState(false);
  const [memoryCards, setMemoryCards] = useState(() => generateMemoryCards(1));
  const [patternSeq, setPatternSeq] = useState(() => generatePattern(1));
  const [recallData, setRecallData] = useState(() => generateRecall(1));
  const [wordData, setWordData] = useState(() => generateWord(1));
  const [numbersData, setNumbersData] = useState(() => generateNumbers(1));
  const [countData, setCountData] = useState(() => generateCount(1));
  const [colorData, setColorData] = useState(() => generateColor(1));
  const [cards, setCards] = useState(memoryCards);
  const [flipped, setFlipped] = useState<number[]>([]);
  const [matched, setMatched] = useState<number[]>([]);
  const [showPattern, setShowPattern] = useState(true);
  const [patternInput, setPatternInput] = useState<string[]>([]);
  const [showRecall, setShowRecall] = useState(true);
  const [recallInput, setRecallInput] = useState<number[]>([]);
  const [wordInput, setWordInput] = useState<string[]>([]);
  const [numberAnswer, setNumberAnswer] = useState<number | null>(null);
  const [countInput, setCountInput] = useState<number[]>([]);
  const [colorAnswer, setColorAnswer] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("Small challenge, calm pace.");

  const completeRound = useCallback(async (message: string) => {
    if (complete || isRewarding) return;
    setComplete(true);
    setFocusPoints((current) => current + 10 + level * 2);
    setFeedback(message);
    if (!user?.studentNumber) return;
    setIsRewarding(true);
    const result = await claimMiniResetReward({ activityId, level, roundKey: `${activityId}-${level}-${Date.now()}`, studentNumber: user.studentNumber });
    if (result.ok && result.rewardTala) setEarnedTala((current) => current + (result.rewardTala ?? 0));
    if (result.message) setFeedback(result.message);
    setIsRewarding(false);
  }, [activityId, complete, isRewarding, level, user?.studentNumber]);

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
      void completeRound("You found every pair. Nicely noticed.");
    }
  }, [activityId, allMatched, completeRound]);

  const setupLevel = (nextLevel: number) => {
    if (activityId === "memory") { const c = generateMemoryCards(nextLevel); setMemoryCards(c); setCards(c); }
    if (activityId === "pattern") setPatternSeq(generatePattern(nextLevel));
    if (activityId === "recall") setRecallData(generateRecall(nextLevel));
    if (activityId === "words") setWordData(generateWord(nextLevel));
    if (activityId === "numbers") setNumbersData(generateNumbers(nextLevel));
    if (activityId === "count") setCountData(generateCount(nextLevel));
    if (activityId === "color") setColorData(generateColor(nextLevel));
  };

  const reset = () => {
    setComplete(false); setFeedback("A fresh round, at your own pace."); 
    const nextLevel = level + 1;
    setLevel(nextLevel);
    setupLevel(nextLevel);
    setFlipped([]); setMatched([]);
    setShowPattern(true); setPatternInput([]); setShowRecall(true); setRecallInput([]); setWordInput([]); setNumberAnswer(null); setCountInput([]); setColorAnswer(null);
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
    if (shape !== patternSeq[next.length - 1]) {
      setPatternInput([]); setFeedback("Almost. Notice it once more, at your own pace."); return;
    }
    setPatternInput(next);
    if (next.length === patternSeq.length) { void completeRound("You stayed with the pattern. Well done."); }
  };

  const tapRecall = (tile: number) => {
    if (showRecall || complete || recallInput.includes(tile)) return;
    const next = [...recallInput, tile].sort((a, b) => a - b);
    if (!recallData.recallTiles.includes(tile)) { setRecallInput([]); setFeedback("That’s okay. Take another look when you’re ready."); return; }
    setRecallInput(next);
    if (next.length === recallData.recallTiles.length) { void completeRound("You recalled the arrangement. Nicely focused."); }
  };

  const tapLetter = (letter: string, index: number) => {
    if (complete || wordInput.includes(`${letter}${index}`)) return;
    const next = [...wordInput, `${letter}${index}`];
    const attempt = next.map((entry) => entry[0]).join("");
    if (!wordData.word.startsWith(attempt)) { setWordInput([]); setFeedback("A fresh try can be helpful—there’s no pressure."); return; }
    setWordInput(next);
    if (attempt === wordData.word) { void completeRound(`${wordData.word}. A small word for this moment.`); }
  };

  const tapNumber = (value: number) => {
    if (complete) return;
    setNumberAnswer(value);
    if (value === numbersData.answer) { void completeRound("You found the next step. Nicely steady."); return; }
    setFeedback("Not quite—and that is completely okay. Try another when you feel ready.");
  };

  const tapCount = (value: number) => {
    if (complete || countInput.includes(value)) return;
    const expected = countInput.length + 1;
    if (value !== expected) {
      setCountInput([]);
      setFeedback("That is okay. Return to one steady step at a time.");
      return;
    }
    const next = [...countInput, value];
    setCountInput(next);
    if (next.length === countData.length) void completeRound("You found a steady rhythm. Nicely done.");
  };

  const tapColor = (color: string) => {
    if (complete) return;
    setColorAnswer(color);
    if (color === colorData.target) {
      void completeRound("You found the matching color. Nicely focused.");
      return;
    }
    setFeedback("Not that one. Let your eyes soften and try again.");
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
        <View style={styles.intro}><View style={styles.progressRow}><Text style={styles.eyebrow}>{copy.eyebrow}</Text><Text style={styles.progressText}>Level {level} · {focusPoints} points</Text></View><Text style={styles.heading}>{copy.title}</Text><Text style={styles.instruction}>{copy.instruction}</Text><View style={styles.levelTrack}><View style={[styles.levelFill, { width: `${Math.min(100, 18 + level * 12)}%` }]} /></View>{earnedTala > 0 ? <Text style={styles.talaText}>✦ {earnedTala} Tala earned in this reset</Text> : null}</View>
        <View style={styles.gameCard}>
          <View style={styles.gameStageHeader}><Ionicons name="leaf-outline" size={16} color="#626A86" /><Text style={styles.gameStageText}>{complete ? "Reset complete" : "Stay curious, there is no rush"}</Text></View>
          {activityId === "memory" && <View style={styles.memoryGrid}>{cards.map((card, index) => { const open = flipped.includes(index) || matched.includes(index); return <Pressable key={`${card}-${index}`} onPress={() => tapCard(index)} style={[styles.memoryCard, open && styles.memoryCardOpen]} accessibilityLabel={open ? `Card ${card}` : "Turn over card"}><Text style={styles.memoryCardText}>{open ? card : "✦"}</Text></Pressable>; })}</View>}
          {activityId === "pattern" && <PatternGame show={showPattern} selected={patternInput} onTap={tapPattern} pattern={patternSeq} />}
          {activityId === "recall" && <RecallGame show={showRecall} selected={recallInput} onTap={tapRecall} recallTiles={recallData.recallTiles} total={recallData.total} />}
          {activityId === "words" && <View><View style={styles.wordSlots}>{Array.from({ length: wordData.word.length }).map((_, index) => <View key={index} style={styles.wordSlot}><Text style={styles.wordSlotText}>{selectedLetters[index] ?? ""}</Text></View>)}</View><Text style={styles.wordHint}>A word for a steady moment</Text><View style={styles.letterRow}>{wordData.scrambled.map((letter, index) => <Pressable key={`${letter}-${index}`} onPress={() => tapLetter(letter, index)} style={[styles.letterButton, wordInput.includes(`${letter}${index}`) && styles.letterButtonUsed]}><Text style={styles.letterText}>{letter}</Text></Pressable>)}</View></View>}
          {activityId === "numbers" && <View><Text style={styles.gamePrompt}>{numbersData.prompt}</Text><View style={styles.choiceRow}>{numbersData.choices.map((value) => <Pressable key={value} onPress={() => tapNumber(value)} style={[styles.shapeChoice, numberAnswer === value && styles.numberChoiceSelected]}><Text style={styles.numberChoiceText}>{value}</Text></Pressable>)}</View></View>}
          {activityId === "count" && <View><Text style={styles.gamePrompt}>Tap in order · {countInput.length} of {countData.length}</Text><View style={styles.countGrid}>{countData.map((value) => <Pressable key={value} onPress={() => tapCount(value)} style={[styles.countTile, countInput.includes(value) && styles.countTileSelected]}><Text style={styles.numberChoiceText}>{value}</Text></Pressable>)}</View></View>}
          {activityId === "color" && <View><Text style={styles.gamePrompt}>Find the matching tile</Text><View style={styles.colorTarget}><View style={[styles.colorSwatch, { backgroundColor: colorData.target }]} /><Text style={styles.colorTargetText}>Match this color</Text></View><View style={styles.colorGrid}>{colorData.options.map((color) => <Pressable key={color} onPress={() => tapColor(color)} style={[styles.colorChoice, { backgroundColor: color }, colorAnswer === color && styles.colorChoiceSelected]} accessibilityLabel="Color choice" />)}</View></View>}
        </View>
        <View style={[styles.feedback, complete && styles.feedbackComplete]}><Ionicons name={complete ? "heart-outline" : "leaf-outline"} size={20} color={complete ? "#477A43" : "#626A86"} /><Text style={styles.feedbackText}>{feedback}</Text></View>
        {complete && <View style={styles.completeCard}><Text style={styles.completeTitle}>A little reset, complete.</Text><Text style={styles.completeText}>{isRewarding ? "Adding your Tala…" : "You gave your attention a gentle place to land. Ready for another soft round?"}</Text><Pressable style={styles.tryAnother} onPress={reset} disabled={isRewarding}><Text style={styles.tryAnotherText}>Continue to level {level + 1}</Text><Ionicons name="arrow-forward" size={18} color="#FFFFFF" /></Pressable><Pressable onPress={() => router.replace("/wellness-tools")} style={styles.returnButton}><Text style={styles.returnButtonText}>Choose another mini reset</Text></Pressable></View>}
      </ScrollView>
    </SafeAreaView>
  );
}

function PatternGame({ show, selected, onTap, pattern }: { show: boolean; selected: string[]; onTap: (shape: string) => void; pattern: string[] }) {
  const icons: Record<string, "ellipse" | "triangle" | "square"> = { circle: "ellipse", triangle: "triangle", square: "square" };
  const choices = ["circle", "triangle", "square"];
  return <View><Text style={styles.gamePrompt}>{show ? "Notice the pattern" : `Repeat it · ${selected.length} of ${pattern.length}`}</Text>{show ? <View style={styles.sequenceRow}>{pattern.map((shape, index) => <Ionicons key={index} name={icons[shape]} size={35} color={["#7DA4C6", "#C88B81", "#87A982"][index % 3]} />)}</View> : <View style={styles.choiceRow}>{choices.map((shape) => <Pressable key={shape} onPress={() => onTap(shape)} style={styles.shapeChoice}><Ionicons name={icons[shape]} size={36} color="#617C90" /></Pressable>)}</View>}</View>;
}

function RecallGame({ show, selected, onTap, recallTiles, total }: { show: boolean; selected: number[]; onTap: (tile: number) => void; recallTiles: number[]; total: number }) {
  return <View><Text style={styles.gamePrompt}>{show ? "Notice the highlighted tiles" : `Tap the three you remember · ${selected.length} found`}</Text><View style={styles.recallGrid}>{Array.from({ length: total }).map((_, index) => { const tile = index + 1; const highlighted = show ? recallTiles.includes(tile) : selected.includes(tile); return <Pressable key={tile} onPress={() => onTap(tile)} style={[styles.recallTile, highlighted && styles.recallTileHighlighted]}><Text style={styles.recallTileText}>{show ? (highlighted ? "✦" : "") : ""}</Text></Pressable>; })}</View></View>;
}

const styles = StyleSheet.create({
  levelTrack: { height: 6, borderRadius: 999, backgroundColor: "rgba(98,97,138,0.16)", overflow: "hidden", marginTop: 13 },
  levelFill: { height: "100%", borderRadius: 999, backgroundColor: "#7471A3" },
  gameStageHeader: { flexDirection: "row", alignItems: "center", justifyContent: "center", columnGap: 6, marginBottom: 18 },
  gameStageText: { color: "#7B8193", fontSize: 11, lineHeight: 15, fontFamily: "Outfit-SemiBold" },
  countGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 10 },
  countTile: { width: 58, height: 58, borderRadius: 17, backgroundColor: "#F1F4F6", borderWidth: 1, borderColor: "#DEE5EA", alignItems: "center", justifyContent: "center" },
  countTileSelected: { backgroundColor: "#E8F3E3", borderColor: "#A9D494" },
  colorTarget: { alignItems: "center", marginBottom: 18 },
  colorSwatch: { width: 58, height: 58, borderRadius: 19, borderWidth: 4, borderColor: "#FFFFFF", shadowColor: "#5E6872", shadowOpacity: 0.16, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  colorTargetText: { color: "#7B8193", fontSize: 12, lineHeight: 16, marginTop: 7, fontFamily: "Outfit-SemiBold" },
  colorGrid: { flexDirection: "row", justifyContent: "center", gap: 12 },
  colorChoice: { width: 62, height: 62, borderRadius: 19, borderWidth: 4, borderColor: "#FFFFFF" },
  colorChoiceSelected: { borderColor: "#4F6F60", transform: [{ scale: 0.92 }] },
  screen: { flex: 1, backgroundColor: "#F7FAF6" }, topBar: { height: 52, backgroundColor: "#FFFFFF", borderBottomWidth: 1, borderBottomColor: "#E6ECF1", flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 4 }, backButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center" }, topTitle: { color: "#33475C", fontSize: 18, fontFamily: "Outfit-Bold" }, content: { alignItems: "center", padding: 16, paddingBottom: 42 }, intro: { width: "100%", maxWidth: 420, backgroundColor: "#E8E6F6", borderRadius: 24, padding: 18, marginBottom: 14 }, progressRow: { flexDirection: "row", justifyContent: "space-between", columnGap: 8 }, progressText: { color: "#62618A", fontFamily: "Outfit-Bold", fontSize: 12 }, talaText: { color: "#6D5C31", fontFamily: "Outfit-Bold", fontSize: 12, marginTop: 10 }, eyebrow: { color: "#62618A", fontFamily: "Outfit-Bold", fontSize: 12, marginBottom: 8 }, heading: { color: "#384055", fontFamily: "Outfit-Bold", fontSize: 26, lineHeight: 32, marginBottom: 7 }, instruction: { color: "#5D6678", fontSize: 14, lineHeight: 20 }, gameCard: { width: "100%", maxWidth: 420, minHeight: 260, backgroundColor: "#FFFFFF", borderRadius: 24, borderWidth: 1, borderColor: "#E5E9E4", padding: 18, justifyContent: "center", shadowColor: "#66737E", shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2 }, memoryGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 12 }, memoryCard: { width: "29%", aspectRatio: 1, backgroundColor: "#E6EEF5", borderRadius: 18, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#D7E2EC" }, memoryCardOpen: { backgroundColor: "#FCF9EA", borderColor: "#EEE1A8" }, memoryCardText: { fontSize: 29, color: "#728BA0" }, gamePrompt: { color: "#536274", textAlign: "center", fontSize: 14, lineHeight: 20, marginBottom: 22, fontFamily: "Outfit-Bold" }, sequenceRow: { minHeight: 70, flexDirection: "row", justifyContent: "center", alignItems: "center", columnGap: 20 }, choiceRow: { flexDirection: "row", justifyContent: "center", columnGap: 14 }, shapeChoice: { width: 70, height: 70, borderRadius: 20, borderWidth: 1, borderColor: "#DCE7E7", backgroundColor: "#F6FAF9", alignItems: "center", justifyContent: "center" }, numberChoiceSelected: { borderColor: "#91B08D", backgroundColor: "#EEF7E9" }, numberChoiceText: { color: "#4C6577", fontSize: 25, fontFamily: "Outfit-Bold" }, recallGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 12 }, recallTile: { width: "28%", aspectRatio: 1, borderRadius: 16, backgroundColor: "#EEF2F4", borderWidth: 1, borderColor: "#DDE5E8", alignItems: "center", justifyContent: "center" }, recallTileHighlighted: { backgroundColor: "#BFD8C2", borderColor: "#95BE9A" }, recallTileText: { color: "#49744C", fontSize: 24 }, wordSlots: { flexDirection: "row", justifyContent: "center", columnGap: 10, marginBottom: 12 }, wordSlot: { width: 42, height: 48, borderBottomWidth: 2, borderBottomColor: "#9AA6B0", alignItems: "center", justifyContent: "center" }, wordSlotText: { color: "#405065", fontSize: 24, fontFamily: "Outfit-Bold" }, wordHint: { color: "#738091", textAlign: "center", fontSize: 13, marginBottom: 22 }, letterRow: { flexDirection: "row", justifyContent: "center", columnGap: 9 }, letterButton: { width: 52, height: 52, borderRadius: 16, backgroundColor: "#E9E6F6", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#DAD5EC" }, letterButtonUsed: { opacity: 0.35 }, letterText: { color: "#4A496E", fontSize: 21, fontFamily: "Outfit-Bold" }, feedback: { width: "100%", maxWidth: 420, flexDirection: "row", alignItems: "center", columnGap: 10, borderRadius: 16, backgroundColor: "#F0F2F6", padding: 13, marginTop: 14 }, feedbackComplete: { backgroundColor: "#E7F3E4" }, feedbackText: { flex: 1, color: "#586474", fontSize: 13, lineHeight: 18 }, completeCard: { width: "100%", maxWidth: 420, borderRadius: 22, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E4ECE0", padding: 17, marginTop: 14, alignItems: "center" }, completeTitle: { color: "#3D5945", fontFamily: "Outfit-Bold", fontSize: 19, marginBottom: 5 }, completeText: { color: "#657568", fontSize: 13, textAlign: "center", lineHeight: 18, marginBottom: 15 }, tryAnother: { flexDirection: "row", alignItems: "center", columnGap: 7, backgroundColor: "#557E4C", paddingHorizontal: 17, paddingVertical: 11, borderRadius: 999 }, tryAnotherText: { color: "#FFFFFF", fontFamily: "Outfit-Bold", fontSize: 14 }, returnButton: { paddingTop: 15 }, returnButtonText: { color: "#596987", fontFamily: "Outfit-Bold", fontSize: 13 },
});
