const fs = require('fs');
let content = fs.readFileSync('mobile-app/app/home.tsx', 'utf8');

// Remove showRecentEntriesFilterModal
content = content.replace(/\s*const \[showRecentEntriesFilterModal, setShowRecentEntriesFilterModal\] = useState\(false\);/g, '');

// Remove displayedRecentEntries
content = content.replace(/\s*const displayedRecentEntries =\s*\[.*?\];/s, '');

// Remove recentListHeight
content = content.replace(/\s*const recentListHeight =[\s\S]*?\? 148[\s\S]*?: Math.min\(displayedRecentEntries.length \* 104 \+ 20, compact \? 300 : 372\);/g, '');

// Remove the filter modal entirely
content = content.replace(/\s*<Modal\s+visible=\{showRecentEntriesFilterModal\}[\s\S]*?<\/Modal>/, '');

// Remove recentCard style and onwards if needed (no, just leave the style or let it be).
// Actually, let's remove recentCard styles to keep it clean.
content = content.replace(/\s*recentCard: \{[\s\S]*?borderWidth: 1,\s*borderColor: "#E1EED9" \},/m, '');

fs.writeFileSync('mobile-app/app/home.tsx', content);
console.log("Cleanup done!");

