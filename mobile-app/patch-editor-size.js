
const fs = require('fs');
const path = require('path');
const p = path.join('C:', 'Users', 'Tanio', 'BawatTalaApp', 'mobile-app', 'app', 'journal-cover-editor.tsx');
let content = fs.readFileSync(p, 'utf8');

// Increase the notebook size dynamically
content = content.replace(
  `const bookWidth = Math.min(width - 48, 300);
  const bookHeight = bookWidth * 1.4;`,
  `const { height } = useWindowDimensions();
  // Make the book take up as much vertical space as possible, but cap the width
  const maxAvailableHeight = height - (showToolbar ? 420 : 180); 
  const calculatedWidth = maxAvailableHeight / 1.4;
  const bookWidth = Math.min(width - 48, Math.max(300, calculatedWidth));
  const bookHeight = bookWidth * 1.4;`
);

// Add missing styles
const newStyles = `
  iconOnlyButton: { width: 32, height: 32, alignItems: "center", justifyContent: "center", borderRadius: 16, backgroundColor: "#EEF3ED" },
  showToolsContainer: { position: "absolute", bottom: 40, left: 0, right: 0, alignItems: "center" },
  showToolsButton: { flexDirection: "row", alignItems: "center", backgroundColor: "#4D6558", paddingHorizontal: 16, paddingVertical: 12, borderRadius: 30, gap: 8, shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 8, elevation: 5 },
  showToolsText: { color: "#FFF8E8", fontFamily: "Outfit-Bold", fontSize: 15 },
`;

content = content.replace(/toolbarContainer: \{/, newStyles + '\n  toolbarContainer: {');

fs.writeFileSync(p, content, 'utf8');

