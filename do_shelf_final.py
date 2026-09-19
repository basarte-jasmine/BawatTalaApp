
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
    print("WARNING: reflection not replaced")

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

          <View style={styles.shelfContainer}>
            {/* Shelf Book 1 */}
            <Pressable style={styles.shelfBookItem} onPress={() => router.push("/write-entry?mode=new-muni")}>
              <View style={[styles.bookWrapper, compact && styles.bookWrapperCompact]}>
                <Image source={BOOK_IMAGE} style={[styles.bookBaseImage, compact && styles.bookBaseImageCompact]} resizeMode="contain" />
                <View style={[styles.bookDeco, styles.bookDecoMuni]}>
                  <Ionicons name="chatbubbles" size={20} color="#FFFFFF" />
                </View>
              </View>
              <Text style={styles.bookLabel}>Guided Journal</Text>
              <Text style={styles.bookSubLabel}>With Muni</Text>
            </Pressable>

            {/* Shelf Book 2 */}
            <Pressable style={styles.shelfBookItem} onPress={() => router.push("/write-entry?mode=new-solo")}>
              <View style={[styles.bookWrapper, compact && styles.bookWrapperCompact]}>
                <Image source={BOOK_IMAGE} style={[styles.bookBaseImage, compact && styles.bookBaseImageCompact]} resizeMode="contain" />
                <View style={[styles.bookDeco, styles.bookDecoSolo]}>
                  <Ionicons name="pencil" size={20} color="#FFFFFF" />
                </View>
              </View>
              <Text style={styles.bookLabel}>Solo Journal</Text>
              <Text style={styles.bookSubLabel}>Free write</Text>
            </Pressable>
          </View>
          <View style={styles.shelfBoard} />
        </View>"""

if old_bottom in content:
    content = content.replace(old_bottom, new_bottom)
else:
    print("WARNING: bottom not replaced")

# Replace styles
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
    marginTop: 4 },
  bottomSectionCompact: {
    marginTop: 2 },
  shelfHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
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
  shelfContainer: {
    flexDirection: "row",
    justifyContent: "space-evenly",
    alignItems: "flex-end",
    paddingHorizontal: 10,
    zIndex: 2,
    marginBottom: -4 },
  shelfBookItem: {
    alignItems: "center",
    width: "45%" },
  bookWrapper: {
    position: "relative",
    width: 120,
    height: 140,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8 },
  bookWrapperCompact: {
    width: 100,
    height: 120 },
  bookBaseImage: {
    width: "100%",
    height: "100%" },
  bookBaseImageCompact: {
    width: "90%",
    height: "90%" },
  bookDeco: {
    position: "absolute",
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3 },
  bookDecoMuni: {
    backgroundColor: "#7BCB45",
    bottom: 15,
    right: 5 },
  bookDecoSolo: {
    backgroundColor: "#FFA726",
    bottom: 15,
    left: 5 },
  bookLabel: {
    color: "#34475A",
    fontSize: 15,
    fontFamily: "Outfit-Bold",
    marginBottom: 2 },
  bookSubLabel: {
    color: "#7B8D74",
    fontSize: 12 },
  shelfBoard: {
    height: 16,
    backgroundColor: "#E2E8DF",
    borderRadius: 8,
    borderBottomWidth: 4,
    borderBottomColor: "#C9D4C4",
    marginHorizontal: 4,
    shadowColor: "#5C6570",
    shadowOpacity: 0.15,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    zIndex: 1,
    marginBottom: 10 },
"""

content = content[:style_start] + new_styles + content[style_end:]

with open('mobile-app/app/journal.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("SUCCESS!")

