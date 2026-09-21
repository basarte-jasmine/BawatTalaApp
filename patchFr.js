
const fs = require('fs');
let c = fs.readFileSync('mobile-app/app/fruit-catcher.tsx', 'utf8');

c = c.replace(
  'import { useAuthSession } from "../lib/auth-session";',
  'import { useAuthSession } from "../lib/auth-session";\nimport { getGameScore, saveGameScore } from "../lib/game-scores";'
);

const fruitHookSpot = 'const [showExitPrompt, setShowExitPrompt] = useState(false);';
const fruitLoadHook = `
  const [showExitPrompt, setShowExitPrompt] = useState(false);
  
  const [bestScore, setBestScore] = useState(0);
  const [highestLevel, setHighestLevel] = useState(0);

  useEffect(() => {
    getGameScore("fruit-catcher").then((data) => {
      if (data?.bestScore) setBestScore(data.bestScore);
      if (data?.highestLevel) setHighestLevel(data.highestLevel);
    });
  }, []);
`;
if (c.includes(fruitHookSpot)) {
  c = c.replace(fruitHookSpot, fruitLoadHook);
} else {
  // Try fallback location
  c = c.replace(
    'const stateRef = useRef({ gameState, score, level, hearts, combo });',
    'const stateRef = useRef({ gameState, score, level, hearts, combo });\n' + fruitLoadHook
  );
}

// In handleTimeUp or GAMEOVER set
// Find setGameState('gameover')
c = c.replace(
  /setGameState\(['"]gameover['"]\);/g,
  `setGameState('gameover');
      const curScore = stateRef.current?.score || score;
      const curLevel = stateRef.current?.level || level;
      let newBest = bestScore;
      let newHigh = highestLevel;
      if (curScore > bestScore) { newBest = curScore; setBestScore(curScore); }
      if (curLevel > highestLevel) { newHigh = curLevel; setHighestLevel(curLevel); }
      saveGameScore("fruit-catcher", { bestScore: newBest, highestLevel: newHigh });`
);

// update UI
c = c.replace(
  '<Text style={styles.panelText}>Final Score: {score}</Text>',
  '<Text style={styles.panelText}>Final Score: {score} (Best: {bestScore})</Text>'
);
c = c.replace(
  '<Text style={styles.panelText}>Highest Level: {level}</Text>',
  '<Text style={styles.panelText}>Highest Level: {level} (Best: {highestLevel})</Text>'
);

fs.writeFileSync('mobile-app/app/fruit-catcher.tsx', c);
