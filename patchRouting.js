
const fs = require('fs');
let c = fs.readFileSync('mobile-app/app/wellness-tools.tsx', 'utf8');

c = c.replace(
  'onPress={() => router.push(game.id === "munis-arrival" ? "/munis-arrival" : game.id === "fruit-catcher" ? "/fruit-catcher" : "/image-puzzle")}',
  'onPress={() => router.push("/" + game.id as any)}'
);

c = c.replace(
  'require("../assets/images/Mini Reset/Gentle Pairs/Muni_Thinking.webp")',
  'require("../assets/images/Mini Reset/Gentle Pairs/Gentle Pairs Cover.webp")'
);

fs.writeFileSync('mobile-app/app/wellness-tools.tsx', c);
