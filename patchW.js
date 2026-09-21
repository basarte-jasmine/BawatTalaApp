
const fs = require('fs');
let c = fs.readFileSync('mobile-app/app/munis-arrival.tsx', 'utf8');
c = c.replace('</View>w>\n          <View style={styles.hudRight}', '</View>\n          <View style={styles.hudRight}');
fs.writeFileSync('mobile-app/app/munis-arrival.tsx', c);
