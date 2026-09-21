
const fs = require('fs');
let c = fs.readFileSync('mobile-app/app/gentle-pairs.tsx', 'utf8');

c = c.replace(
  'import { router } from "expo-router";',
  'import { router } from "expo-router";\nimport { getGameScore, saveGameScore } from "../lib/game-scores";'
);

const hookSpot = 'const [showExitPrompt, setShowExitPrompt] = useState(false);';
const loadHook = `
  const [showExitPrompt, setShowExitPrompt] = useState(false);
  
  const bestScoreRef = useRef(0);
  const bestRoundRef = useRef(0);
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    getGameScore("gentle-pairs").then((data) => {
      if (data?.bestScore) bestScoreRef.current = data.bestScore;
      if (data?.bestRound) bestRoundRef.current = data.bestRound;
      forceUpdate(p => p + 1);
    });
  }, []);
`;
c = c.replace(hookSpot, loadHook);

c = c.replace(
  'setGameState("GAMEOVER");',
  'setGameState("GAMEOVER");\n          if (score > bestScoreRef.current) bestScoreRef.current = score;\n          if (round > bestRoundRef.current) bestRoundRef.current = round;\n          saveGameScore("gentle-pairs", { bestScore: bestScoreRef.current, bestRound: bestRoundRef.current });'
);

// We should display the best stats on the GAMEOVER screen.
c = c.replace(
  '<View style={styles.statRow}><Text style={styles.statLabel}>Score</Text><Text style={styles.statValue}>{score}</Text></View>',
  '<View style={styles.statRow}><Text style={styles.statLabel}>Score (Best: {bestScoreRef.current})</Text><Text style={styles.statValue}>{score}</Text></View>'
);
c = c.replace(
  '<View style={styles.statRow}><Text style={styles.statLabel}>Rounds cleared</Text><Text style={styles.statValue}>{Math.max(0, round - 1)}</Text></View>',
  '<View style={styles.statRow}><Text style={styles.statLabel}>Rounds (Best: {Math.max(0, bestRoundRef.current - 1)})</Text><Text style={styles.statValue}>{Math.max(0, round - 1)}</Text></View>'
);

fs.writeFileSync('mobile-app/app/gentle-pairs.tsx', c);
