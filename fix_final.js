
const fs = require('fs');
let file = fs.readFileSync('C:/Users/Tanio/BawatTalaApp/mobile-app/app/mini-reset.tsx', 'utf8');

file = file.replace('const EMOJI_POOL = ["??", "??", "??", "??", "??", "??", "??", "??"];', 'const EMOJI_POOL = ["🌱", "☀️", "🪷", "☁️", "🐚", "🐦", "💧", "🌙"];');
file = file.replace('const prompt = `${start} ï¿½ ${start + step} ï¿½ ${start + step * 2} ï¿½ ?`;', 'const prompt = `${start} · ${start + step} · ${start + step * 2} · ?`;');
file = file.replace(/Â·/g, '·');
file = file.replace(/ï¿½/g, '·');
file = file.replace(/â€™/g, "'");
file = file.replace(/â€”/g, "—"); // em dash
file = file.replace(/âœ¦/g, "✦");
file = file.replace(/â€¦/g, "…");
file = file.replace(/A gentle match\. Keep going when youâ€™re ready\./g, "A gentle match. Keep going when you're ready.");

fs.writeFileSync('C:/Users/Tanio/BawatTalaApp/mobile-app/app/mini-reset.tsx', file, 'utf8');
console.log("Fixed!");

