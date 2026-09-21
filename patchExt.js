
const fs = require('fs');

// 1. Update fruit-catcher.tsx
let fc = fs.readFileSync('mobile-app/app/fruit-catcher.tsx', 'utf8');
fc = fc.replace(/Basket\.png/g, 'Basket.webp');
fc = fc.replace(/Banana\.png/g, 'Banana.webp');
fc = fc.replace(/Pear\.png/g, 'Pear.webp');
fc = fc.replace(/Orange\.png/g, 'Orange.webp');
fc = fc.replace(/Coconut\.png/g, 'Coconut.webp');
fc = fc.replace(/Coconut_two\.png/g, 'Coconut_two.webp');
fc = fc.replace(/Shell\.png/g, 'Shell.webp');
fc = fc.replace(/Heart\.png/g, 'Heart.webp');
fs.writeFileSync('mobile-app/app/fruit-catcher.tsx', fc);

// 2. Update wellness-tools.tsx cover image
let wt = fs.readFileSync('mobile-app/app/wellness-tools.tsx', 'utf8');
wt = wt.replace(/Fruit Catcher Cover\.jpg/g, 'Fruit Catcher Cover.webp');
wt = wt.replace(/Fruit Catcher Cover\.png/g, 'Fruit Catcher Cover.webp');
fs.writeFileSync('mobile-app/app/wellness-tools.tsx', wt);
console.log('Extensions updated');
