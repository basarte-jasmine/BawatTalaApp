
const fs = require('fs');
let c = fs.readFileSync('mobile-app/app/wellness-tools.tsx', 'utf8');

const sIdx = c.indexOf('<ScrollView horizontal');
if(sIdx > -1) {
  const eIdx = c.indexOf('>', sIdx);
  c = c.substring(0, sIdx) + '<View style={styles.featuredGameGrid}' + c.substring(eIdx);
}

const endS = c.indexOf('</ScrollView>');
if (endS > -1) {
  c = c.substring(0, endS) + '</View>' + c.substring(endS + 13);
}

c = c.replace('featuredGameGrid: { flexDirection: "row", gap: 10, paddingRight: 14 },', 'featuredGameGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 14, marginTop: 14 },');
c = c.replace('featuredGameCard: { width: 220, overflow: "hidden", borderRadius: 18,', 'featuredGameCard: { width: "48.5%", overflow: "hidden", borderRadius: 18,');

fs.writeFileSync('mobile-app/app/wellness-tools.tsx', c);
