const fs = require('fs');
let content = fs.readFileSync('mobile-app/app/home.tsx', 'utf8');

content = content.replace(/\s*type RecentEntryCard = \{[\s\S]*?\};/m, '');

fs.writeFileSync('mobile-app/app/home.tsx', content);

