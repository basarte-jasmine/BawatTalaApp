
const fs = require('fs');
const path = require('path');
const p = path.join('C:', 'Users', 'Tanio', 'BawatTalaApp', 'mobile-app', 'app', 'journal.tsx');
let content = fs.readFileSync(p, 'utf8');

// Update loadJournalCover to use selectedJournalMode
content = content.replace(
  `void loadJournalCover(user.studentNumber).then((design) => {`,
  `void loadJournalCover(user.studentNumber, selectedJournalMode).then((design) => {`
);

// Add selectedJournalMode to useFocusEffect dependency array
content = content.replace(
  `}, [user?.studentNumber]),`,
  `}, [user?.studentNumber, selectedJournalMode]),`
);

// Update router.push to include mode parameter
content = content.replace(
  `onPress={() => router.push("/journal-cover-editor")}`,
  `onPress={() => router.push({ pathname: "/journal-cover-editor", params: { mode: selectedJournalMode } })}`
);

fs.writeFileSync(p, content, 'utf8');

