const fs = require('fs');
const path = require('path');

const filePath = path.join('C:', 'Users', 'Tanio', 'BawatTalaApp', 'mobile-app', 'app', 'achievements.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const ACHIEVEMENTS_ARRAY = const ACHIEVEMENTS = [
  {
    id: "future-bottle",
    title: "A Bottle for Tomorrow",
    desc: "Write your first future bottle note.",
  },
  {
    id: "seven-little-stars",
    title: "Seven Little Stars",
    desc: "Complete a full 7-day daily check-in cycle.",
  },
  {
    id: "a-sky-with-many-colors",
    title: "A Sky With Many Colors",
    desc: "Log every emotion at least once.",
  },
  {
    id: "dear-muni",
    title: "Dear Muni",
    desc: "Send your first journal message to Muni.",
  },
  {
    id: "ink-on-the-page",
    title: "Ink on the Page",
    desc: "Finish and save your first journal entry.",
  },
  {
    id: "quiet-mode",
    title: "Quiet Mode",
    desc: "Save a journal entry with Muni turned off.",
  },
  {
    id: "named-what-hurt",
    title: "Named What Hurt",
    desc: "Save a journal entry with at least one concern tag.",
  },
  {
    id: "message-from-the-tide",
    title: "Message From the Tide",
    desc: "Open a drifting bottle note.",
  },
  {
    id: "library-glow",
    title: "Library Glow",
    desc: "Read in the library for 1 hour.",
  }
];;

content = content.replace(
  'const BOTTLE_ART = require("../assets/images/Achievements/A Bottle for Tomorrow.jpg");',
  'const BOTTLE_ART = require("../assets/images/Achievements/A Bottle for Tomorrow.jpg");\n\n' + ACHIEVEMENTS_ARRAY
);

content = content.replace(
  'const [unlocked, setUnlocked] = useState(false);\n  useEffect(() => { if (user?.studentNumber) void AsyncStorage.getItem(\@bawat-tala/future-bottle:\).then((value) => setUnlocked(Boolean(value && value !== "[]"))); }, [user?.studentNumber]);',
  const [unlockedIds, setUnlockedIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!user?.studentNumber) return;
    const checkAchievements = async () => {
      try {
        const bottleValue = await AsyncStorage.getItem(\@bawat-tala/future-bottle:\);
        const newUnlocked = new Set<string>();
        if (bottleValue && bottleValue !== "[]") newUnlocked.add("future-bottle");
        for (const ach of ACHIEVEMENTS) {
          if (ach.id !== "future-bottle") {
            const val = await AsyncStorage.getItem(\@bawat-tala/achievement::\);
            if (val === "true") newUnlocked.add(ach.id);
          }
        }
        setUnlockedIds(newUnlocked);
      } catch (err) { console.error(err); }
    };
    checkAchievements();
  }, [user?.studentNumber]);
  const unlockedCount = unlockedIds.size;
);

content = content.replace(
  '{unlocked ? "1 achievement unlocked" : "Your achievements"}',
  '{unlockedCount > 0 ? \${unlockedCount} achievement unlocked\ : "Your achievements"}'
);

content = content.replace(
  '{unlocked ? "Small moments of care count." : "Your milestones will appear here."}',
  '{unlockedCount > 0 ? "Small moments of care count." : "Your milestones will appear here."}'
);

const oldCard = '<View style={[styles.card, !unlocked && styles.cardLocked]}><Image source={BOTTLE_ART} style={styles.art} resizeMode="cover" /><View style={styles.copy}><Text style={styles.kicker}>{unlocked ? "UNLOCKED" : "LOCKED"}</Text><Text style={styles.title}>A Bottle for Tomorrow</Text><Text style={styles.desc}>Write your first future bottle note.</Text></View><Ionicons name={unlocked ? "ribbon" : "lock-closed-outline"} size={23} color={unlocked ? "#B08A35" : "#9AA4AC"} /></View>';

const newCardList = '<View style={styles.cardList}>{ACHIEVEMENTS.map((ach) => { const isUnlocked = unlockedIds.has(ach.id); return (<View key={ach.id} style={[styles.card, !isUnlocked && styles.cardLocked]}><Image source={BOTTLE_ART} style={styles.art} resizeMode="cover" /><View style={styles.copy}><Text style={styles.kicker}>{isUnlocked ? "UNLOCKED" : "LOCKED"}</Text><Text style={styles.title}>{ach.title}</Text><Text style={styles.desc}>{ach.desc}</Text></View><Ionicons name={isUnlocked ? "ribbon" : "lock-closed-outline"} size={23} color={isUnlocked ? "#B08A35" : "#9AA4AC"} /></View>); })}</View>';

content = content.replace(oldCard, newCardList);

content = content.replace(
  'desc:{color:"#717A76",fontSize:13,lineHeight:18} });',
  'desc:{color:"#717A76",fontSize:13,lineHeight:18}, cardList: { display: "flex", flexDirection: "column", gap: 14 } });'
);

fs.writeFileSync(filePath, content, 'utf8');
