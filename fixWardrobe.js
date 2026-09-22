
const fs = require('fs');
let content = fs.readFileSync('./mobile-app/lib/muni-wardrobe.ts', 'utf8');

content = content.replace(
  /head: "beanie",[\s\S]*?eye: "cinema-glasses",[\s\S]*?outfit: "spooky-ghost",/,
  'head: null,\n  eye: null,\n  outfit: null,'
);

content = content.replace(
  '{ id: "beanie", label: "Beanie", price: 0, starter: true, source: require("../assets/images/Muni Customization/Head/Beanie.webp") }',
  '{ id: "beanie", label: "Beanie", price: 90, source: require("../assets/images/Muni Customization/Head/Beanie.webp") }'
);

content = content.replace(
  '{ id: "cinema-glasses", label: "Cinema Glasses", price: 0, starter: true, source: require("../assets/images/Muni Customization/Eyes/Cinema_Glasses.webp") }',
  '{ id: "cinema-glasses", label: "Cinema Glasses", price: 110, source: require("../assets/images/Muni Customization/Eyes/Cinema_Glasses.webp") }'
);

content = content.replace(
  '{ id: "spooky-ghost", label: "Spooky Ghost", price: 0, starter: true, source: require("../assets/images/Muni Customization/Outfit/Spooky_Ghost_Sheet.webp") }',
  '{ id: "spooky-ghost", label: "Spooky Ghost", price: 160, source: require("../assets/images/Muni Customization/Outfit/Spooky_Ghost_Sheet.webp") }'
);

fs.writeFileSync('./mobile-app/lib/muni-wardrobe.ts', content);

