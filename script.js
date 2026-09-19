
const fs = require('fs');
const path = require('path');

const filePath = path.join('C:', 'Users', 'Tanio', 'BawatTalaApp', 'mobile-app', 'app', 'mini-reset.tsx');
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(/const PAIRS = \[[^]*?\];\r?\n/, '');
content = content.replace(/const PATTERN = \[[^]*?\] as const;\r?\n/, '');
content = content.replace(/const RECALL_TILES = \[[^]*?\];\r?\n/, '');
content = content.replace(/const WORD = .*?;\r?\n/, '');
content = content.replace(/const SCRAMBLED_WORD = \[[^]*?\];\r?\n/, '');

const GENERATORS = `const EMOJI_POOL = ["??", "??", "??", "??", "??", "??", "??", "??"];
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
  const prompt = \`\${start} · \${start + step} · \${start + step * 2} · ?\`;
  const answer = start + step * 3;
  let possible = [answer - 1, answer + 1, answer + 2, answer - 2, answer + step];
  possible = [...new Set(possible)].filter(x => x !== answer).sort(() => Math.random() - 0.5);
  const choices = [answer, possible[0], possible[1]].sort(() => Math.random() - 0.5);
  return { prompt, answer, choices };
}`;

content = content.replace('function shuffledCards() {', GENERATORS + '\n\nfunction shuffledCards() {');

const stateRegex = /const \[cards, setCards\] = useState\(shuffledCards\);/;
const stateReplace = `const [memoryCards, setMemoryCards] = useState(() => generateMemoryCards(1));
  const [patternSeq, setPatternSeq] = useState(() => generatePattern(1));
  const [recallData, setRecallData] = useState(() => generateRecall(1));
  const [wordData, setWordData] = useState(() => generateWord(1));
  const [numbersData, setNumbersData] = useState(() => generateNumbers(1));
  const [cards, setCards] = useState(memoryCards);`;
content = content.replace(stateRegex, stateReplace);

content = content.replace(
  'if (shape !== PATTERN[next.length - 1])',
  'if (shape !== patternSeq[next.length - 1])'
);
content = content.replace(
  'if (next.length === PATTERN.length)',
  'if (next.length === patternSeq.length)'
);
content = content.replace(
  'if (!RECALL_TILES.includes(tile))',
  'if (!recallData.recallTiles.includes(tile))'
);
content = content.replace(
  'if (next.length === RECALL_TILES.length)',
  'if (next.length === recallData.recallTiles.length)'
);
content = content.replace(
  'if (!WORD.startsWith(attempt))',
  'if (!wordData.word.startsWith(attempt))'
);
content = content.replace(
  'if (attempt === WORD) { void completeRound("CALM. A small word for this moment."); }',
  'if (attempt === wordData.word) { void completeRound(\`\${wordData.word}. A small word for this moment.\`); }'
);
content = content.replace(
  'if (value === 8) { void completeRound("You found the next step. Nicely steady."); return; }',
  'if (value === numbersData.answer) { void completeRound("You found the next step. Nicely steady."); return; }'
);

const resetRegex = /const reset = \(\) => \{[\s\S]*?\n  \};/;
const resetReplace = `const setupLevel = (nextLevel: number) => {
    if (activityId === "memory") { const c = generateMemoryCards(nextLevel); setMemoryCards(c); setCards(c); }
    if (activityId === "pattern") setPatternSeq(generatePattern(nextLevel));
    if (activityId === "recall") setRecallData(generateRecall(nextLevel));
    if (activityId === "words") setWordData(generateWord(nextLevel));
    if (activityId === "numbers") setNumbersData(generateNumbers(nextLevel));
  };

  const reset = () => {
    setComplete(false); setFeedback("A fresh round, at your own pace."); 
    const nextLevel = level + 1;
    setLevel(nextLevel);
    setupLevel(nextLevel);
    setFlipped([]); setMatched([]);
    setShowPattern(true); setPatternInput([]); setShowRecall(true); setRecallInput([]); setWordInput([]); setNumberAnswer(null);
  };`;
content = content.replace(resetRegex, resetReplace);

content = content.replace(
  '<PatternGame show={showPattern} selected={patternInput} onTap={tapPattern} />',
  '<PatternGame show={showPattern} selected={patternInput} onTap={tapPattern} pattern={patternSeq} />'
);

content = content.replace(
  '<RecallGame show={showRecall} selected={recallInput} onTap={tapRecall} />',
  '<RecallGame show={showRecall} selected={recallInput} onTap={tapRecall} recallTiles={recallData.recallTiles} total={recallData.total} />'
);

content = content.replace(
  /\{Array\.from\(\{ length: WORD\.length \}\)\.map\(\(\_, index\) =>/g,
  '{Array.from({ length: wordData.word.length }).map((_, index) =>'
);

content = content.replace(
  /SCRAMBLED_WORD\.map/g,
  'wordData.scrambled.map'
);

content = content.replace(
  '<Text style={styles.gamePrompt}>2 · 4 · 6 · ?</Text>',
  '<Text style={styles.gamePrompt}>{numbersData.prompt}</Text>'
);

content = content.replace(
  /\[7, 8, 9\]\.map\(\(value\) =>/g,
  'numbersData.choices.map((value) =>'
);

content = content.replace(
  'function PatternGame({ show, selected, onTap }: { show: boolean; selected: string[]; onTap: (shape: string) => void }) {',
  'function PatternGame({ show, selected, onTap, pattern }: { show: boolean; selected: string[]; onTap: (shape: string) => void; pattern: string[] }) {'
);

content = content.replace(
  /PATTERN\.length/g,
  'pattern.length'
);

content = content.replace(
  /PATTERN\.map\(\(shape, index\) =>/g,
  'pattern.map((shape, index) =>'
);

content = content.replace(
  'function RecallGame({ show, selected, onTap }: { show: boolean; selected: number[]; onTap: (tile: number) => void }) {',
  'function RecallGame({ show, selected, onTap, recallTiles, total }: { show: boolean; selected: number[]; onTap: (tile: number) => void; recallTiles: number[]; total: number }) {'
);

content = content.replace(
  /RECALL_TILES\.includes\(tile\)/g,
  'recallTiles.includes(tile)'
);

content = content.replace(
  /Array\.from\(\{ length: 6 \}\)/g,
  'Array.from({ length: total })'
);

fs.writeFileSync(filePath, content, 'utf8');
console.log("Done");

