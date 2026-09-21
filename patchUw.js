
const fs = require('fs');
let c = fs.readFileSync('mobile-app/app/unscramble-word.tsx', 'utf8');

c = c.replace(
  'import { router } from "expo-router";',
  'import { router } from "expo-router";\nimport { getGameScore, saveGameScore } from "../lib/game-scores";'
);

const hookSpot = 'const timerRef = useRef<NodeJS.Timeout | null>(null);';
const loadHook = `
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  const bestScoreRef = useRef(0);
  const bestLevelRef = useRef(0);
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    getGameScore("unscramble-word").then((data) => {
      if (data?.bestScore) bestScoreRef.current = data.bestScore;
      if (data?.bestLevel) bestLevelRef.current = data.bestLevel;
      forceUpdate(p => p + 1);
    });
  }, []);
`;
c = c.replace(hookSpot, loadHook);

c = c.replace(
  'setGameState("GAMEOVER");',
  'setGameState("GAMEOVER");\n            if (score > bestScoreRef.current) { bestScoreRef.current = score; }\n            if (level > bestLevelRef.current) { bestLevelRef.current = level; }\n            saveGameScore("unscramble-word", { bestScore: bestScoreRef.current, bestLevel: bestLevelRef.current });'
);

// We should display the best stats on the GAMEOVER screen.
c = c.replace(
  '<View style={styles.statRow}><Text style={styles.statLabel}>Score</Text><Text style={styles.statValue}>{score}</Text></View>',
  '<View style={styles.statRow}><Text style={styles.statLabel}>Score (Best: {bestScoreRef.current})</Text><Text style={styles.statValue}>{score}</Text></View>'
);
c = c.replace(
  '<View style={styles.statRow}><Text style={styles.statLabel}>Words Rebuilt</Text><Text style={styles.statValue}>{level - 1}</Text></View>',
  '<View style={styles.statRow}><Text style={styles.statLabel}>Words Rebuilt (Best: {bestLevelRef.current - 1})</Text><Text style={styles.statValue}>{level - 1}</Text></View>'
);

fs.writeFileSync('mobile-app/app/unscramble-word.tsx', c);
