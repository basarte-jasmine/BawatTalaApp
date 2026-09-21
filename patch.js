
const fs = require('fs');
let c = fs.readFileSync('mobile-app/app/wellness-tools.tsx', 'utf8');

c = c.replace(
  'id: "fruit-catcher" | "image-puzzle";', 
  'id: "fruit-catcher" | "image-puzzle" | "munis-arrival";'
);

const item = `  {
    id: "munis-arrival",
    title: "Muni's Arrival",
    label: "Flow state",
    description: "Guide the unconscious Muni. Be the gentle current guiding Muni s raft.",
    duration: "Endless",
    image: require("../assets/images/Mini Reset/Muni's Arrival/Muni_LostwRaft.png"),
  },
];`;

c = c.replace('];\n\nexport default function', item + '\n\nexport default function');

c = c.replace(
  /<View style=\{styles\.featuredGameGrid\}>[\s\S]*?onPress=\{.*?\}/,
  '<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.featuredGameGrid}>{FEATURED_GAMES.map((game) => (<Pressable key={game.id} style={({ pressed }) => [styles.featuredGameCard, pressed && styles.miniResetCardPressed]} accessibilityLabel={game.title + ", " + game.duration} onPress={() => router.push("/" + game.id)}>'
);

c = c.replace(/<\/Pressable>\s*\)\)\}\s*<\/View>/, '</Pressable>))}</ScrollView>');
c = c.replace('featuredGameGrid: { flexDirection: "row", gap: 10 },', 'featuredGameGrid: { flexDirection: "row", gap: 10, paddingRight: 14 },');
c = c.replace('featuredGameCard: { flex: 1, overflow: "hidden", borderRadius: 18,', 'featuredGameCard: { width: 220, overflow: "hidden", borderRadius: 18,');

fs.writeFileSync('mobile-app/app/wellness-tools.tsx', c);
console.log("Replaced!");
