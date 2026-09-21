
const fs = require('fs');
let c = fs.readFileSync('mobile-app/app/munis-arrival.tsx', 'utf8');

c = c.replace(
  'import { router } from "expo-router";',
  'import { router } from "expo-router";\nimport { getGameScore, saveGameScore } from "../lib/game-scores";'
);

const bestDriftInit = 'const bestDriftRef = useRef(0);';
const loadHook = `
  const bestDriftRef = useRef(0);
  const [, forceUpdate] = useState(0); // Ensure score updates after load

  useEffect(() => {
    getGameScore("munis-arrival").then((data) => {
      if (data?.bestDrift) {
        bestDriftRef.current = data.bestDrift;
        forceUpdate(prev => prev + 1);
      }
    });
  }, []);
`;
c = c.replace(bestDriftInit, loadHook);

c = c.replace(
  'setGameState("GAMEOVER");',
  'setGameState("GAMEOVER");\nsaveGameScore("munis-arrival", { bestDrift: bestDriftRef.current });'
);

fs.writeFileSync('mobile-app/app/munis-arrival.tsx', c);
