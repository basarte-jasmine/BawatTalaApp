
const fs = require('fs');
let c = fs.readFileSync('mobile-app/app/fruit-catcher.tsx', 'utf8');

c = c.replace(
  'topBar: { height: 52, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 4, zIndex: 10 },',
  'topBar: { height: 52, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 4, zIndex: 9999, elevation: 9999 },'
);

fs.writeFileSync('mobile-app/app/fruit-catcher.tsx', c);
