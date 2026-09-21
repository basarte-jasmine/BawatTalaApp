
const fs = require('fs');
const path = require('path');
const p = path.join('C:', 'Users', 'Tanio', 'BawatTalaApp', 'mobile-app', 'app', 'journal-cover-editor.tsx');
let content = fs.readFileSync(p, 'utf8');

const find = `        const temporaryPreviewUri = Platform.OS !== "web" && coverShotRef.current
          ? await captureRef(coverShotRef.current, { format: "webp", quality: 0.88, result: "tmpfile" })
          : null;
        previewUri = await persistJournalCoverPreview(user.studentNumber, temporaryPreviewUri);`;

const replace = `        if (coverShotRef.current) {
          if (Platform.OS === 'web') {
             previewUri = await captureRef(coverShotRef.current, { format: 'webp', quality: 0.88, result: 'data-uri' });
          } else {
             const temporaryPreviewUri = await captureRef(coverShotRef.current, { format: 'webp', quality: 0.88, result: 'tmpfile' });
             previewUri = await persistJournalCoverPreview(user.studentNumber, temporaryPreviewUri);
          }
        }`;

const noCr = content.replace(/\r/g, '');
const findNoCr = find.replace(/\r/g, '');
if (noCr.includes(findNoCr)) {
    const parts = noCr.split(findNoCr);
    content = parts.join(replace);
} else {
    console.log("NOT FOUND!");
}
fs.writeFileSync(p, content, 'utf8');

