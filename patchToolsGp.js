
const fs = require('fs');
let c = fs.readFileSync('mobile-app/app/wellness-tools.tsx', 'utf8');

// 1. Remove from MINI_RESETS
c = c.replace(
  '{ id: "memory", title: "Gentle Pairs", description: "Flip and find three calm matches.", duration: "~1 min", icon: "grid-outline" },',
  ''
);

// 2. Add to FEATURED_GAMES
const newGame = `  {
    id: "gentle-pairs",
    title: "Gentle Pairs",
    label: "Memory Focus",
    description: "Flip the cards and find the matching Muni moments.",
    duration: "Endless",
    image: require("../assets/images/Mini Reset/Gentle Pairs/Muni_Thinking.webp"),
  },
`;

c = c.replace('id: "fruit-catcher" | "image-puzzle" | "munis-arrival";', 'id: "fruit-catcher" | "image-puzzle" | "munis-arrival" | "gentle-pairs";');

c = c.replace('const FEATURED_GAMES: FeaturedGame[] = [\n', 'const FEATURED_GAMES: FeaturedGame[] = [\n' + newGame);

fs.writeFileSync('mobile-app/app/wellness-tools.tsx', c);
