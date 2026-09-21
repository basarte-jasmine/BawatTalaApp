
const fs = require('fs');
const path = require('path');
const p = path.join('C:', 'Users', 'Tanio', 'BawatTalaApp', 'mobile-app', 'app', 'journal-cover-editor.tsx');
let content = fs.readFileSync(p, 'utf8');

const newStyles = `
  fontRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 4 },
  fontButton: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: "#EEF3ED", borderWidth: 1, borderColor: "transparent" },
  fontButtonActive: { borderColor: "#4D6558", backgroundColor: "#E3EBE4" },
  fontButtonText: { color: "#20352B", fontSize: 13 },
  textColorButton: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: "#E6EDE7", shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 },
  textColorButtonActive: { borderColor: "#20352B", transform: [{ scale: 1.1 }] },
});
`;

content = content.replace(/\}\);\s*$/, newStyles);
fs.writeFileSync(p, content, 'utf8');

