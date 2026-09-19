const fs = require('fs');
let content = fs.readFileSync('mobile-app/app/home.tsx', 'utf8');

content = content.replace(/\s*fetchJournalEntriesByDate,/g, '');

fs.writeFileSync('mobile-app/app/home.tsx', content);

