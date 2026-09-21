
const fs = require('fs');
const path = require('path');
const p = path.join('C:', 'Users', 'Tanio', 'BawatTalaApp', 'mobile-app', 'app', 'journal-cover-editor.tsx');
let content = fs.readFileSync(p, 'utf8');

content = content.replace(
  /\}, \[user\?\.studentNumber\]\);/,
  `}, [user?.studentNumber, mode]);`
);

fs.writeFileSync(p, content, 'utf8');

