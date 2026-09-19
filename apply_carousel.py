import re

with open('mobile-app/app/journal.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('\r', '')

state_pattern = r'(const \[showFullInsightModal, setShowFullInsightModal\] = useState\(false\);)'
content = re.sub(state_pattern, r'\1\n  const [selectedJournalMode, setSelectedJournalMode] = useState<"muni" | "solo">("muni");', content)

old_reflection = """          <View style={[styles.reflectionCard, compact && styles.reflectionCardCompact]}>
            <View style={styles.reflectionHeader}>
              <Text style={styles.cardEyebrow}>MUNI SUMMARY</Text>
              <Pressable
                style={styles.expandButton}
                onPress={() => setShowFullInsightModal(true)}
                accessibilityLabel="Open full summary"
              >
                <Ionicons name="expand-outline" size={16} color="#586C7F" />
              </Pressable>
            </View>

            <Pressable style={styles.reflectionSnippetWrap} onPress={() => setShowFullInsightModal(true)}>
              <Text style={[styles.reflectionText, compact && styles.reflectionTextCompact]} numberOfLines={compact ? 2 : 3}>
                {insightText}
              </Text>
            </Pressable>

            <View style={[styles.reflectionFooterRow, compact && styles.reflectionFooterRowCompact]}>
              <View style={[styles.companionWrap, compact && styles.companionWrapCompact]}>
                <MuniAvatar style={[styles.companionImage, compact && styles.companionImageCompact]} />
              </View>

              <Text style={[styles.reflectionFootnote, compact && styles.reflectionFootnoteCompact]} numberOfLines={2}>
                Summary by Muni, an AI companion. Muni is not a psychometrician or a substitute for professional care.
              </Text>
            </View>
          </View>"""

new_reflection = """          <View style={[styles.reflectionCard, compact && styles.reflectionCardCompact]}>
            <View style={styles.reflectionLayoutRow}>
              <View style={[styles.companionWrap, compact && styles.companionWrapCompact]}>
                <MuniAvatar style={[styles.companionImage, compact && styles.companionImageCompact]} />
              </View>
              <View style={styles.reflectionContentWrap}>
                <View style={styles.reflectionHeader}>
                  <Text style={styles.cardEyebrow}>MUNI SUMMARY</Text>
                  <Pressable
                    style={styles.expandButton}
                    onPress={() => setShowFullInsightModal(true)}
                    accessibilityLabel="Open full summary"
                  >
                    <Ionicons name="expand-outline" size={16} color="#586C7F" />
                  </Pressable>
                </View>
                
                <Pressable onPress={() => setShowFullInsightModal(true)}>
                  <View style={[styles.bubbleWrap, compact && styles.bubbleWrapCompact]}>
                    <Text style={[styles.reflectionText, compact && styles.reflectionTextCompact]} numberOfLines={compact ? 2 : 3}>
                      {insightText}
                    </Text>
                  </View>
                </Pressable>
                
                <Text style={[styles.reflectionFootnote, compact && styles.reflectionFootnoteCompact]} numberOfLines={2}>
                  Summary by Muni, an AI companion.
                </Text>
              </View>
            </View>
          </View>"""

content = content.replace(old_reflection, new_reflection)

old_bottom = """        <View style={[styles.bottomSection, compact && styles.bottomSectionCompact]}>
          <Text style={styles.cardEyebrow}>WRITE AGAIN</Text>
          <View style={[styles.journalArtWrap, compact && styles.journalArtWrapCompact]}>
            <Image source={BOOK_IMAGE} style={[styles.bookImage, compact && styles.bookImageCompact, veryCompact && styles.bookImageVeryCompact]} resizeMode="contain" />
          </View>

          <Pressable
            style={[styles.addEntryButton, compact && styles.addEntryButtonCompact]}
            onPress={() => router.push("/write-entry?mode=new")}
          >
            <Text style={[styles.addEntryText, compact && styles.addEntryTextCompact]}>Add Entry</Text>
          </Pressable>

          <Pressable
            style={[styles.viewEntriesButton, compact && styles.viewEntriesButtonCompact]}
            onPress={() => router.push("/journal-entries")}
          >
            <Text style={[styles.viewEntriesText, compact && styles.viewEntriesTextCompact]}>View Entries</Text>
          </Pressable>
        </View>"""

new_bottom = """        <View style={[styles.bottomSection, compact && styles.bottomSectionCompact]}>
          <Text style={styles.cardEyebrow}>WRITE AGAIN</Text>
          
          <View style={styles.carouselContainer}>
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
                {selectedJournalMode === "muni" ? (
                  <View style={[styles.bookDecoBig, styles.bookDecoMuniBig]}>
                    <Ionicons name="chatbubbles" size={32} color="#FFFFFF" />
                  </View>
                ) : (
                  <View style={[styles.bookDecoBig, styles.bookDecoSoloBig]}>
                    <Ionicons name="pencil" size={32} color="#FFFFFF" />
                  </View>
                )}
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
          </View>

          <Pressable
            style={[styles.addEntryButton, compact && styles.addEntryButtonCompact]}
            onPress={() => router.push(/write-entry?mode=new-)}
          >
            <Text style={[styles.addEntryText, compact && styles.addEntryTextCompact]}>
              {selectedJournalMode === "muni" ? "Add Guided Entry" : "Add Solo Entry"}
            </Text>
          </Pressable>

          <Pressable
            style={[styles.viewEntriesButton, compact && styles.viewEntriesButtonCompact]}
            onPress={() => router.push("/journal-entries")}
          >
            <Text style={[styles.viewEntriesText, compact && styles.viewEntriesTextCompact]}>View Entries</Text>
          </Pressable>
        </View>"""

content = content.replace(old_bottom, new_bottom)

style_start = content.find('  reflectionCard: {')
style_end = content.find('  modalBackdrop: {')

new_styles = """  reflectionCard: {
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E4EFE0",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    shadowColor: "#5C6570",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
    marginBottom: 10,
    overflow: "hidden" },
  reflectionCardCompact: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
    marginBottom: 8 },
  reflectionLayoutRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    columnGap: 12 },
  reflectionContentWrap: {
    flex: 1 },
  reflectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8 },
  expandButton: {
    width: 28,
    height: 28,
    borderRadius: 999,
    backgroundColor: "#F2F7ED",
    alignItems: "center",
    justifyContent: "center" },
  bubbleWrap: {
    backgroundColor: "#F5F9F1",
    padding: 14,
    borderRadius: 18,
    borderTopLeftRadius: 4,
    marginBottom: 8 },
  bubbleWrapCompact: {
    padding: 10,
    marginBottom: 6 },
  reflectionText: {
    color: "#33485B",
    fontSize: 15,
    lineHeight: 21 },
  reflectionTextCompact: {
    fontSize: 13,
    lineHeight: 18 },
  reflectionFootnote: {
    color: "#8FA088",
    fontSize: 10,
    lineHeight: 14,
    fontFamily: "Outfit-Bold" },
  reflectionFootnoteCompact: {
    fontSize: 9,
    lineHeight: 12 },
  companionWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#EFF7E8",
    alignItems: "center",
    justifyContent: "center" },
  companionWrapCompact: {
    width: 42,
    height: 42,
    borderRadius: 21 },
  companionImage: {
    width: 44,
    height: 44 },
  companionImageCompact: {
    width: 36,
    height: 36 },
  bottomSection: {
    marginTop: 8 },
  bottomSectionCompact: {
    marginTop: 4 },
  carouselContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16 },
  carouselArrow: {
    width: 44,
    height: 80,
    alignItems: "center",
    justifyContent: "center" },
  carouselCenter: {
    alignItems: "center",
    flex: 1 },
  journalArtWrap: {
    position: "relative",
    width: 180,
    height: 180,
    borderRadius: 30,
    backgroundColor: "#F1F8EB",
    borderWidth: 1,
    borderColor: "#E3EFDA",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    shadowColor: "#5C6570",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2 },
  journalArtWrapCompact: {
    width: 150,
    height: 150,
    marginBottom: 8 },
  bookImage: {
    width: 140,
    height: 190 },
  bookImageCompact: {
    width: 120,
    height: 160 },
  bookImageVeryCompact: {
    width: 100,
    height: 140 },
  bookDecoBig: {
    position: "absolute",
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4 },
  bookDecoMuniBig: {
    backgroundColor: "#7BCB45",
    bottom: -10,
    right: -10 },
  bookDecoSoloBig: {
    backgroundColor: "#FFA726",
    bottom: -10,
    left: -10 },
  journalModeInfo: {
    alignItems: "center" },
  journalModeTitle: {
    color: "#34475A",
    fontSize: 20,
    lineHeight: 24,
    fontFamily: "Outfit-Bold",
    marginBottom: 2 },
  journalModeDesc: {
    color: "#6B7B8C",
    fontSize: 14 },
  addEntryButton: {
    height: 46,
    borderRadius: 999,
    backgroundColor: "#7BCB45",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 18,
    marginBottom: 10,
    shadowColor: "#5C6570",
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3 },
  addEntryButtonCompact: {
    height: 42,
    marginBottom: 8 },
  addEntryText: {
    color: "#FFFFFF",
    fontSize: 18,
    lineHeight: 22,
    fontFamily: "Outfit-Bold" },
  addEntryTextCompact: {
    fontSize: 16,
    lineHeight: 20 },
  viewEntriesButton: {
    height: 42,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D9E7D1",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 18,
    shadowColor: "#5C6570",
    shadowOpacity: 0.14,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2 },
  viewEntriesButtonCompact: {
    height: 40 },
  viewEntriesText: {
    color: "#4D6558",
    fontSize: 17,
    lineHeight: 22,
    fontFamily: "Outfit-Bold" },
  viewEntriesTextCompact: {
    fontSize: 15,
    lineHeight: 19 },
"""

content = content[:style_start] + new_styles + content[style_end:]

with open('mobile-app/app/journal.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("SUCCESS")

