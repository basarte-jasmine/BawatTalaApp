
const fs = require('fs');
let c = fs.readFileSync('mobile-app/app/gentle-pairs.tsx', 'utf8');

c = c.replace(
  'const TEMP_COVER = ASSETS[3];',
  'const TEMP_COVER = require("../assets/images/Mini Reset/Gentle Pairs/Gentle Pairs Cover.webp");'
);

fs.writeFileSync('mobile-app/app/gentle-pairs.tsx', c);
