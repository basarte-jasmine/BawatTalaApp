
const fs = require('fs');
let c = fs.readFileSync('mobile-app/app/munis-arrival.tsx', 'utf8');

const oldButtonStr = `<Pressable onPress={confirmExit} style={styles.backButton} accessibilityLabel="Leave Muni's Arrival">
          <Ionicons name="chevron-back" size={28} color={COLOR_TEXT} />
        </Pressable>`;

c = c.replace(oldButtonStr, '');

const newButtonStr = `<Pressable onPress={confirmExit} style={styles.backButton} accessibilityLabel="Leave Muni's Arrival">
        <Ionicons name="chevron-back" size={28} color={COLOR_TEXT} />
      </Pressable>
    </SafeAreaView>`;

c = c.replace('</SafeAreaView>', newButtonStr);

c = c.replace(
  'backButton: { position: "absolute", top: 8, left: 8, width: 42, height: 42, alignItems: "center", justifyContent: "center", zIndex: 30 },',
  'backButton: { position: "absolute", top: 16, left: 16, width: 48, height: 48, alignItems: "center", justifyContent: "center", zIndex: 9999, elevation: 9999 },'
);

fs.writeFileSync('mobile-app/app/munis-arrival.tsx', c);
