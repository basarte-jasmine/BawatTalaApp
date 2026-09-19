const fs = require('fs');
let content = fs.readFileSync('mobile-app/app/home.tsx', 'utf8');

// Remove loadRecentEntries definition
const loadRecentMatch = content.match(/\s*const loadRecentEntries = useCallback\(async \(\) => \{[\s\S]*?\}, \[user\?\.studentNumber\]\);/);
if (loadRecentMatch) {
    content = content.replace(loadRecentMatch[0], '');
}

// Also wait, it might end differently if it uses other dependencies. Let's just regex broadly.
// Look for const loadRecentEntries = useCallback... up to the end of that useCallback.
content = content.replace(/\s*const loadRecentEntries = useCallback\(async \(\) => \{[\s\S]*?setRecentEntries\([\s\S]*?\}\);/g, '');

// Wait, the setRecentEntries block is:
/*
    setRecentEntries(
      (result.entries ?? []).map((entry) => ({
        createdAt: entry.createdAt,
        id: entry.id,
        meta: new Date(entry.createdAt).toLocaleString("en-US", {
          month: "long",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        }),
        preview: String(entry.content || "").replace(/\n/g, " ").trim(),
      }))
    );
  }, [user?.studentNumber]);
*/
content = content.replace(/\s*const loadRecentEntries = useCallback\(async \(\) => \{[\s\S]*?\}, \[user\?\.studentNumber\]\);/g, '');

// Remove loadRecentEntries(), from loadHomeData
content = content.replace(/\s*loadRecentEntries\(\),/g, '');

// Remove loadRecentEntries from dependencies
content = content.replace(/, loadRecentEntries/g, '');

fs.writeFileSync('mobile-app/app/home.tsx', content);

