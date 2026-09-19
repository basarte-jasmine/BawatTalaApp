
with open('mobile-app/app/journal.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('\r', '')

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

if old_reflection in content:
    content = content.replace(old_reflection, new_reflection)
else:
    print("WARNING: old reflection not found")

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
          <View style={styles.shelfHeaderRow}>
            <Text style={[styles.shelfTitle, compact && styles.shelfTitleCompact]}>Your Journals</Text>
            <Pressable style={styles.viewAllButton} onPress={() => router.push("/journal-entries")}>
              <Text style={styles.viewAllText}>View All</Text>
              <Ionicons name="chevron-forward" size={16} color="#6B7B8C" />
            </Pressable>
          </View>

          <View style={styles.cabinetBackground}>
            <View style={styles.cabinetInnerShadow} />
            <View style={styles.booksRow}>
              {/* Book 1: Muni Mode */}
              <Pressable style={[styles.shelfBookItem, compact && styles.shelfBookItemCompact]} onPress={() => router.push("/write-entry?mode=new-muni")}>
                <Image source={BOOK_IMAGE} style={styles.bookBaseImage} resizeMode="stretch" />
                <View style={styles.bookCoverContent}>
                  <Text style={styles.bookCoverTitle}>Guided{"\\n"}Journal</Text>
                  <Text style={styles.bookCoverSubtitle}>w/ Muni</Text>
                </View>
                <View style={[styles.bookDeco, styles.bookDecoMuni]}>
                  <Ionicons name="chatbubbles" size={18} color="#FFFFFF" />
                </View>
              </Pressable>

              {/* Book 2: Solo Mode */}
              <Pressable style={[styles.shelfBookItem, compact && styles.shelfBookItemCompact]} onPress={() => router.push("/write-entry?mode=new-solo")}>
                <Image source={BOOK_IMAGE} style={styles.bookBaseImage} resizeMode="stretch" />
                <View style={styles.bookCoverContent}>
                  <Text style={styles.bookCoverTitle}>Solo{"\\n"}Journal</Text>
                  <Text style={styles.bookCoverSubtitle}>Free Write</Text>
                </View>
                <View style={[styles.bookDeco, styles.bookDecoSolo]}>
                  <Ionicons name="pencil" size={18} color="#FFFFFF" />
                </View>
              </Pressable>
            </View>

            {/* Shelf Board */}
            <View style={styles.shelfBoardTop} />
            <View style={styles.shelfBoardFront}>
               <View style={styles.shelfWoodGrain} />
            </View>
            <View style={styles.shelfUnderShadow} />
          </View>
        </View>"""

if old_bottom in content:
    content = content.replace(old_bottom, new_bottom)
else:
    print("WARNING: old bottom not found")

style_start = content.find('  reflectionCard: {')
style_end = content.find('  modalBackdrop: {')

if style_start != -1 and style_end != -1:
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
    marginTop: 4 },
  bottomSectionCompact: {
    marginTop: 2 },
  shelfHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    paddingHorizontal: 4 },
  shelfTitle: {
    color: "#34475A",
    fontSize: 20,
    lineHeight: 26,
    fontFamily: "Outfit-Bold" },
  shelfTitleCompact: {
    fontSize: 18,
    lineHeight: 24 },
  viewAllButton: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 2 },
  viewAllText: {
    color: "#6B7B8C",
    fontSize: 14,
    lineHeight: 18,
    fontFamily: "Outfit-Bold" },
  cabinetBackground: {
    backgroundColor: "#CBA471",
    borderRadius: 16,
    borderWidth: 3,
    borderColor: "#A2794A",
    overflow: "hidden",
    position: "relative",
    marginHorizontal: 2,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4 },
  cabinetInnerShadow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 40,
    backgroundColor: "rgba(0,0,0,0.15)",
    zIndex: 0 },
  booksRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "flex-end",
    paddingHorizontal: 20,
    paddingTop: 30,
    paddingBottom: 0,
    zIndex: 2 },
  shelfBookItem: {
    width: 110,
    height: 154,
    position: "relative",
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 4, height: 2 },
    elevation: 5 },
  shelfBookItemCompact: {
    width: 95,
    height: 133 },
  bookBaseImage: {
    width: "100%",
    height: "100%",
    borderRadius: 4 },
  bookCoverContent: {
    position: "absolute",
    top: 24,
    left: 0,
    right: 0,
    alignItems: "center",
    paddingHorizontal: 12 },
  bookCoverTitle: {
    color: "#3D4E3A",
    fontFamily: "Outfit-Bold",
    fontSize: 15,
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 2 },
  bookCoverSubtitle: {
    color: "#5C7356",
    fontSize: 11,
    fontFamily: "Outfit-Bold",
    textAlign: "center" },
  bookDeco: {
    position: "absolute",
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3 },
  bookDecoMuni: {
    backgroundColor: "#7BCB45",
    bottom: 12,
    right: -8 },
  bookDecoSolo: {
    backgroundColor: "#FFA726",
    bottom: 12,
    right: -8 },
  shelfBoardTop: {
    height: 10,
    backgroundColor: "#E4C59D",
    zIndex: 1 },
  shelfBoardFront: {
    height: 20,
    backgroundColor: "#B88645",
    zIndex: 1,
    overflow: "hidden" },
  shelfWoodGrain: {
    backgroundColor: "rgba(0,0,0,0.05)",
    height: 2,
    width: "100%",
    marginTop: 4 },
  shelfUnderShadow: {
    height: 24,
    backgroundColor: "rgba(0, 0, 0, 0.25)" },
"""
    content = content[:style_start] + new_styles + content[style_end:]
else:
    print("WARNING: styles boundaries not found")

with open('mobile-app/app/journal.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Complete!")

