import re

with open('mobile-app/app/journal.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the carousel area
old_carousel = """          <View style={styles.carouselContainer}>
            <Pressable 
              onPress={() => setSelectedJournalMode("muni")} 
              style={styles.carouselArrow}
              disabled={selectedJournalMode === "muni"}
            >
              <Ionicons name="chevron-back" size={28} color={selectedJournalMode === "solo" ? "#3A4A5B" : "transparent"} />
            </Pressable>

            <View style={styles.carouselCenter}>
              <View style={[styles.journalArtWrap, compact && styles.journalArtWrapCompact]}>
                <Image source={BOOK_IMAGE} style={[styles.bookImage, compact && styles.bookImageCompact, veryCompact && styles.bookImageVeryCompact]} resizeMode="contain" />
              </View>
              
              <View style={styles.journalModeInfo}>
                <Text style={styles.journalModeTitle}>{selectedJournalMode === "muni" ? "Guided Journal" : "Solo Journal"}</Text>
                <Text style={styles.journalModeDesc}>{selectedJournalMode === "muni" ? "Reflect with Muni" : "Free write your thoughts"}</Text>
              </View>
            </View>

            <Pressable 
              onPress={() => setSelectedJournalMode("solo")} 
              style={styles.carouselArrow}
              disabled={selectedJournalMode === "solo"}
            >
              <Ionicons name="chevron-forward" size={28} color={selectedJournalMode === "muni" ? "#3A4A5B" : "transparent"} />
            </Pressable>
          </View>"""

new_carousel = """          <View style={styles.carouselSection}>
            <View style={styles.carouselContainer}>
              <Pressable 
                onPress={() => setSelectedJournalMode("muni")} 
                style={styles.carouselArrow}
                disabled={selectedJournalMode === "muni"}
              >
                <Ionicons name="chevron-back" size={26} color={selectedJournalMode === "solo" ? "#4D6558" : "transparent"} />
              </Pressable>

              <View style={[styles.journalArtWrap, compact && styles.journalArtWrapCompact]}>
                <Image source={BOOK_IMAGE} style={[styles.bookImage, compact && styles.bookImageCompact, veryCompact && styles.bookImageVeryCompact]} resizeMode="contain" />
              </View>

              <Pressable 
                onPress={() => setSelectedJournalMode("solo")} 
                style={styles.carouselArrow}
                disabled={selectedJournalMode === "solo"}
              >
                <Ionicons name="chevron-forward" size={26} color={selectedJournalMode === "muni" ? "#4D6558" : "transparent"} />
              </Pressable>
            </View>

            <View style={styles.journalModeInfo}>
              <Text style={styles.journalModeTitle}>{selectedJournalMode === "muni" ? "Guided Journal" : "Solo Journal"}</Text>
              <Text style={styles.journalModeDesc}>{selectedJournalMode === "muni" ? "Reflect with Muni" : "Free write your thoughts"}</Text>
            </View>
          </View>"""

if old_carousel in content:
    content = content.replace(old_carousel, new_carousel)
else:
    print("WARNING: old_carousel not found")

# Fix styles
styles_replacements = [
    ('  carouselContainer: {\n    flexDirection: "row",\n    alignItems: "center",\n    justifyContent: "space-between",\n    marginBottom: 16 },',
     '  carouselSection: {\n    marginBottom: 16 },\n  carouselContainer: {\n    flexDirection: "row",\n    alignItems: "center",\n    justifyContent: "center",\n    marginBottom: 4 },'),
    ('  carouselArrow: {\n    width: 44,\n    height: 80,\n    alignItems: "center",\n    justifyContent: "center" },',
     '  carouselArrow: {\n    width: 50,\n    height: 100,\n    alignItems: "center",\n    justifyContent: "center" },'),
    ('  bookImage: {\n    width: 140,\n    height: 190 },',
     '  bookImage: {\n    width: 200,\n    height: 250,\n    shadowColor: "#5C6570",\n    shadowOpacity: 0.12,\n    shadowRadius: 10,\n    shadowOffset: { width: 0, height: 4 } },'),
    ('  bookImageCompact: {\n    width: 120,\n    height: 160 },',
     '  bookImageCompact: {\n    width: 160,\n    height: 210 },'),
    ('  bookImageVeryCompact: {\n    width: 100,\n    height: 140 },',
     '  bookImageVeryCompact: {\n    width: 130,\n    height: 170 },'),
    ('  journalModeTitle: {\n    color: "#34475A",\n    fontSize: 20,\n    lineHeight: 24,\n    fontFamily: "Outfit-Bold",\n    marginBottom: 2 },',
     '  journalModeTitle: {\n    color: "#34475A",\n    fontSize: 16,\n    lineHeight: 20,\n    fontFamily: "Outfit-Bold",\n    marginBottom: 2 },'),
    ('  journalModeDesc: {\n    color: "#6B7B8C",\n    fontSize: 14 },',
     '  journalModeDesc: {\n    color: "#7B8D74",\n    fontSize: 13 },'),
    ('  journalArtWrap: {\n    alignItems: "center",\n    justifyContent: "center",\n    marginBottom: 8 },',
     '  journalArtWrap: {\n    alignItems: "center",\n    justifyContent: "center",\n    marginHorizontal: 10 },')
]

for old_s, new_s in styles_replacements:
    if old_s in content:
        content = content.replace(old_s, new_s)
    else:
        print(f"WARNING: style not found: {old_s[:30]}...")

with open('mobile-app/app/journal.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

