
const fs = require('fs');
const path = require('path');
const p = path.join('C:', 'Users', 'Tanio', 'BawatTalaApp', 'mobile-app', 'app', 'journal-cover-editor.tsx');
let content = fs.readFileSync(p, 'utf8');

// We will add a few font options. 
// Assuming Outfit fonts are available since the project uses them globally:
// "Outfit", "Outfit-Medium", "Outfit-SemiBold", "Outfit-Bold"

const textElementReplacement = `
  fontFamily: element.fontFamily || "Outfit-Bold",
`;

content = content.replace(
  /fontFamily:\s*"Outfit-Bold",/,
  textElementReplacement
);

fs.writeFileSync(p, content, 'utf8');

