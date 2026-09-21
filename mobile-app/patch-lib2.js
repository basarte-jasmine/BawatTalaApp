
const fs = require('fs');
const path = require('path');
const p = path.join('C:', 'Users', 'Tanio', 'BawatTalaApp', 'mobile-app', 'lib', 'journal-cover.ts');
let content = fs.readFileSync(p, 'utf8');

content = content.replace(
  /function getJournalCoverKey\(studentNumber: string\) \{\s+return \`\\\$\{STORAGE_PREFIX\}\\\$\{studentNumber\}\`;\s+\}/,
  `function getJournalCoverKey(studentNumber: string, mode: "muni" | "solo" = "solo") {
  return \`\${STORAGE_PREFIX}\${studentNumber}:\${mode}\`;
}`
);

content = content.replace(
  /export async function saveJournalCover\([\s\S]*?\) \{/,
  `export async function saveJournalCover(
  studentNumber: string,
  mode: "muni" | "solo",
  design: Omit<JournalCoverDesign, "updatedAt">,
) {`
);

fs.writeFileSync(p, content, 'utf8');

