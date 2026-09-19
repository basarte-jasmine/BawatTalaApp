const fs = require('fs');
let content = fs.readFileSync('mobile-app/app/home.tsx', 'utf8');

content = content.replace(/\s*const \[recentEntries, setRecentEntries\] = useState[\s\S]*?;/, '');
content = content.replace(/\s*type HomeRecentFilter =[\s\S]*?;/, '');
content = content.replace(/\s*setRecentEntries\(recentResult\.entries \|\| \[\]\);/, '');

fs.writeFileSync('mobile-app/app/home.tsx', content);

