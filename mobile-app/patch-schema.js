
const fs = require('fs');
const path = require('path');
const p = path.join('C:', 'Users', 'Tanio', 'BawatTalaApp', 'mobile-app', 'lib', 'journal-cover.ts');
let content = fs.readFileSync(p, 'utf8');

if (!content.includes('fontFamily?: string;')) {
  content = content.replace(
    /color\?: string;/,
    `color?: string;\n  fontFamily?: string;`
  );
  fs.writeFileSync(p, content, 'utf8');
}

