
const fs = require('fs');
let c = fs.readFileSync('mobile-app/app/image-puzzle.tsx', 'utf8');

c = c.replace(
  'import { useAuthSession } from "../lib/auth-session";',
  'import { useAuthSession } from "../lib/auth-session";\nimport { getGameScore, saveGameScore } from "../lib/game-scores";'
);

const pzLoadHook = `
  const bestScoreRef = useRef(0);
  const bestLevelRef = useRef(0);
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    getGameScore("image-puzzle").then((data) => {
      if (data?.bestScore) bestScoreRef.current = data.bestScore;
      if (data?.bestLevel) bestLevelRef.current = data.bestLevel;
      forceUpdate(p => p + 1);
    });
  }, []);
`;

c = c.replace(
  'const stateRef = useRef({ gameState, timeLeft, level, combo, hearts, score });',
  'const stateRef = useRef({ gameState, timeLeft, level, combo, hearts, score });\n' + pzLoadHook
);

c = c.replace(
  /setGameState\(['"]GAMEOVER['"]\);/g,
  `setGameState('GAMEOVER');
      const curScore = stateRef.current?.score || score;
      const curLevel = stateRef.current?.level || level;
      if (curScore > bestScoreRef.current) bestScoreRef.current = curScore;
      if (curLevel > bestLevelRef.current) bestLevelRef.current = curLevel;
      saveGameScore("image-puzzle", { bestScore: bestScoreRef.current, bestLevel: bestLevelRef.current });`
);

// update UI
c = c.replace(
  '<View style={styles.statRow}><Text style={styles.statLabel}>Score</Text><Text style={styles.statValue}>{score}</Text></View>',
  '<View style={styles.statRow}><Text style={styles.statLabel}>Score (Best: {bestScoreRef.current})</Text><Text style={styles.statValue}>{score}</Text></View>'
);
c = c.replace(
  '<View style={styles.statRow}><Text style={styles.statLabel}>Levels Cleared</Text><Text style={styles.statValue}>{level - 1}</Text></View>',
  '<View style={styles.statRow}><Text style={styles.statLabel}>Levels (Best: {Math.max(0, bestLevelRef.current - 1)})</Text><Text style={styles.statValue}>{level - 1}</Text></View>'
);

fs.writeFileSync('mobile-app/app/image-puzzle.tsx', c);
