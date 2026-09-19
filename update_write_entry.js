const fs = require('fs');
let writeContent = fs.readFileSync('mobile-app/app/write-entry.tsx', 'utf8');

writeContent = writeContent.replace(
  /if \(mode === "new"\) \{/,
  'if (mode === "new" || mode === "new-muni" || mode === "new-solo") {'
);

writeContent = writeContent.replace(
  /const createResult = await createJournalSession\(\{\s*aiEnabled: true,/m,
  'const createResult = await createJournalSession({\n          aiEnabled: mode === "new-solo" ? false : true,'
);

fs.writeFileSync('mobile-app/app/write-entry.tsx', writeContent);
console.log("Updated write-entry!");

