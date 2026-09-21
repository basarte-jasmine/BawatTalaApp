
const fs = require('fs');
let c = fs.readFileSync('mobile-app/app/wellness-tools.tsx', 'utf8');

c = c.replace(/\s*\{ id: "words", title: "Unscramble a Word"[^\}]+\},?/g, '');

const newGame = `  {
    id: "unscramble-word",
    title: "Unscramble Word",
    label: "Mindful Focus",
    description: "Rebuild calming words before the time fades.",
    duration: "Endless",
    image: require("../assets/images/Mini Reset/Unscramble Word/Unscramble Word Cover.webp"),
  },
`;

if (!c.includes('id: "unscramble-word"')) {
  c = c.replace('id: "fruit-catcher" | "image-puzzle" | "munis-arrival" | "gentle-pairs";', 'id: "fruit-catcher" | "image-puzzle" | "munis-arrival" | "gentle-pairs" | "unscramble-word";');
  c = c.replace('const FEATURED_GAMES: FeaturedGame[] = [\n', 'const FEATURED_GAMES: FeaturedGame[] = [\n' + newGame);
}

fs.writeFileSync('mobile-app/app/wellness-tools.tsx', c);
console.log('Patched');
