
const fs = require('fs');
let c = fs.readFileSync('mobile-app/app/munis-arrival.tsx', 'utf8');

if (!c.includes('showExitPrompt')) {
  c = c.replace('const [health, setHealth] = useState(3);', 'const [health, setHealth] = useState(3);\n  const [showExitPrompt, setShowExitPrompt] = useState(false);');

  const confirmExitStr = `const confirmExit = () => {
    if (gameState === "PLAYING") {
      setShowExitPrompt(true);
      return;
    }
    router.replace("/wellness-tools");
  };`;

  c = c.replace(/const confirmExit = \(\) => \{[\s\S]*?router\.replace\("\/wellness-tools"\);\n  \};/, confirmExitStr);

  const exitOverlayStr = `
      {showExitPrompt && (
        <View style={styles.exitOverlay}>
          <View style={styles.exitCard}>
            <Text style={styles.exitTitle}>Leave game?</Text>
            <Text style={styles.exitText}>Your current progress will be lost.</Text>
            <View style={styles.exitActions}>
              <Pressable style={styles.exitStay} onPress={() => setShowExitPrompt(false)}><Text style={styles.exitStayText}>Stay</Text></Pressable>
              <Pressable style={styles.exitLeave} onPress={() => router.replace("/wellness-tools")}><Text style={styles.exitLeaveText}>Leave</Text></Pressable>
            </View>
          </View>
        </View>
      )}

      <Pressable onPress={confirmExit} style={styles.backButton} accessibilityLabel="Leave Muni's Arrival">
`;

  c = c.replace('<Pressable onPress={confirmExit} style={styles.backButton} accessibilityLabel="Leave Muni\'s Arrival">', exitOverlayStr);

  const exitStyles = `
  exitOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center", zIndex: 10000 },
  exitCard: { backgroundColor: "#FFFFFF", padding: 24, borderRadius: 20, width: "80%", maxWidth: 320, alignItems: "center" },
  exitTitle: { fontSize: 22, fontFamily: "Outfit-Bold", color: "#33475C", marginBottom: 8 },
  exitText: { fontSize: 15, color: "#607181", textAlign: "center", marginBottom: 24 },
  exitActions: { flexDirection: "row", width: "100%", gap: 12 },
  exitStay: { flex: 1, backgroundColor: "#EAEFE8", paddingVertical: 14, borderRadius: 12, alignItems: "center" },
  exitStayText: { color: "#4D6558", fontSize: 16, fontFamily: "Outfit-Bold" },
  exitLeave: { flex: 1, backgroundColor: "#E76F51", paddingVertical: 14, borderRadius: 12, alignItems: "center" },
  exitLeaveText: { color: "#FFFFFF", fontSize: 16, fontFamily: "Outfit-Bold" },
});
`;

  c = c.replace('});', exitStyles);
  fs.writeFileSync('mobile-app/app/munis-arrival.tsx', c);
}
