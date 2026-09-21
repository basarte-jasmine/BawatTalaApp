
const fs = require('fs');
const path = require('path');
const p = path.join('C:', 'Users', 'Tanio', 'BawatTalaApp', 'mobile-app', 'lib', 'journal-cover.ts');
let content = fs.readFileSync(p, 'utf8');

content = content.replace(
  `function getJournalCoverKey(studentNumber: string) {
  return \`\${STORAGE_PREFIX}\${studentNumber}\`;
}`,
  `function getJournalCoverKey(studentNumber: string, mode: "muni" | "solo" = "solo") {
  return \`\${STORAGE_PREFIX}\${studentNumber}:\${mode}\`;
}`
);

content = content.replace(
  `export async function loadJournalCover(studentNumber: string): Promise<JournalCoverDesign | null> {`,
  `export async function loadJournalCover(studentNumber: string, mode: "muni" | "solo" = "solo"): Promise<JournalCoverDesign | null> {`
);

content = content.replace(
  `const storedValue = await AsyncStorage.getItem(getJournalCoverKey(studentNumber));`,
  `const storedValue = await AsyncStorage.getItem(getJournalCoverKey(studentNumber, mode));`
);

content = content.replace(
  `export async function persistJournalCoverPreview(studentNumber: string, previewUri: string | null): Promise<string | null> {`,
  `export async function persistJournalCoverPreview(studentNumber: string, mode: "muni" | "solo", previewUri: string | null): Promise<string | null> {`
);

content = content.replace(
  `const destination = \`\${directory}\${encodeURIComponent(studentNumber)}.webp\`;`,
  `const destination = \`\${directory}\${encodeURIComponent(studentNumber)}_\${mode}.webp\`;`
);

content = content.replace(
  `export async function saveJournalCover(
  studentNumber: string,
  design: Omit<JournalCoverDesign, "updatedAt">,
): Promise<JournalCoverDesign> {`,
  `export async function saveJournalCover(
  studentNumber: string,
  mode: "muni" | "solo",
  design: Omit<JournalCoverDesign, "updatedAt">,
): Promise<JournalCoverDesign> {`
);

content = content.replace(
  `await AsyncStorage.setItem(getJournalCoverKey(studentNumber), JSON.stringify(savedDesign));`,
  `await AsyncStorage.setItem(getJournalCoverKey(studentNumber, mode), JSON.stringify(savedDesign));`
);

fs.writeFileSync(p, content, 'utf8');

