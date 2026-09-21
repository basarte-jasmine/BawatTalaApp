
const fs = require('fs');
let c = fs.readFileSync('mobile-app/app/munis-arrival.tsx', 'utf8');

const sIdx = c.indexOf('<View style={styles.hudCenter}><Text style={styles.sleepText}>{Array.from({ length: 3 }).map((_, i) => (i < health ? "Zzz" : "")).join(" / ")}</Text></View>');

if (sIdx > -1) {
  const newHud = `
          <View style={styles.hudCenter}>
            <View style={styles.healthRow}>
              {[1, 2, 3].map((idx) => (
                <View key={idx} style={[styles.zzzBubble, health < idx && styles.zzzBubbleLost]}>
                  <Text style={[styles.zzzText, health < idx && styles.zzzTextLost]}>Zzz</Text>
                </View>
              ))}
            </View>
          </View>`;
  c = c.substring(0, sIdx) + newHud + c.substring(sIdx + 154);
}

const styleIdx = c.indexOf('sleepText: { color: "#4A6273", fontSize: 13, fontFamily: "Outfit-SemiBold", opacity: 0.8 },');

if (styleIdx > -1) {
  const newStyles = `sleepText: { color: "#4A6273", fontSize: 13, fontFamily: "Outfit-SemiBold", opacity: 0.8 },
  healthRow: { flexDirection: "row", gap: 6 },
  zzzBubble: { paddingHorizontal: 10, paddingVertical: 5, backgroundColor: "rgba(255, 255, 255, 0.8)", borderRadius: 12, borderWidth: 1, borderColor: "rgba(255, 255, 255, 1)" },
  zzzBubbleLost: { backgroundColor: "rgba(255, 255, 255, 0.15)", borderColor: "rgba(255, 255, 255, 0.3)" },
  zzzText: { color: "#1A2F45", fontSize: 12, fontFamily: "Outfit-Bold" },
  zzzTextLost: { color: "rgba(26, 47, 69, 0.3)" },`;
  c = c.substring(0, styleIdx) + newStyles + c.substring(styleIdx + 92);
}

fs.writeFileSync('mobile-app/app/munis-arrival.tsx', c);
console.log('Replaced', sIdx > -1, styleIdx > -1);
