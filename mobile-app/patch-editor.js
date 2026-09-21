
const fs = require('fs');
const path = require('path');
const p = path.join('C:', 'Users', 'Tanio', 'BawatTalaApp', 'mobile-app', 'app', 'journal-cover-editor.tsx');
let content = fs.readFileSync(p, 'utf8');

// import useLocalSearchParams
content = content.replace(
  `import { router } from "expo-router";`,
  `import { router, useLocalSearchParams } from "expo-router";`
);

// get mode in component
content = content.replace(
  `export default function JournalCoverEditorScreen() {`,
  `export default function JournalCoverEditorScreen() {
  const { mode = "solo" } = useLocalSearchParams<{ mode: "muni" | "solo" }>();`
);

// update loadJournalCover
content = content.replace(
  `void loadJournalCover(user.studentNumber).then((design) => {`,
  `void loadJournalCover(user.studentNumber, mode).then((design) => {`
);

// update persistJournalCoverPreview
content = content.replace(
  `previewUri = await persistJournalCoverPreview(user.studentNumber, temporaryPreviewUri);`,
  `previewUri = await persistJournalCoverPreview(user.studentNumber, mode, temporaryPreviewUri);`
);

// update saveJournalCover
content = content.replace(
  `await saveJournalCover(user.studentNumber, {`,
  `await saveJournalCover(user.studentNumber, mode, {`
);

fs.writeFileSync(p, content, 'utf8');

