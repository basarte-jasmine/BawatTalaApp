const fs = require('fs');
let content = fs.readFileSync('mobile-app/app/home.tsx', 'utf8');

content = content.replace(/\s*const displayedRecentEntries =[\s\S]*?;/, '');
content = content.replace(/\s*const \[recentEntriesSort, setRecentEntriesSort\] = useState[\s\S]*?;/, '');

fs.writeFileSync('mobile-app/app/home.tsx', content);

