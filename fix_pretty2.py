import re

with open('mobile-app/app/journal.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

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

content = content.replace(old_carousel, new_carousel)

with open('mobile-app/app/journal.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

