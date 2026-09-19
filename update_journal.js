const fs = require('fs');
let content = fs.readFileSync('mobile-app/app/journal.tsx', 'utf8');

content = content.replace(
`          <View style={[styles.reflectionCard, compact && styles.reflectionCardCompact]}>
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
          </View>`,
`          <View style={[styles.reflectionCard, compact && styles.reflectionCardCompact]}>
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
          </View>`);

content = content.replace(
`        <View style={[styles.bottomSection, compact && styles.bottomSectionCompact]}>
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
        </View>`,
`        <View style={[styles.bottomSection, compact && styles.bottomSectionCompact]}>
          <View style={[styles.actionCard, compact && styles.actionCardCompact]}>
            <View style={styles.actionCardContentRow}>
              <View style={styles.actionCardTextCol}>
                <Text style={[styles.actionCardTitle, compact && styles.actionCardTitleCompact]}>Express Yourself</Text>
                <Text style={[styles.actionCardSubtitle, compact && styles.actionCardSubtitleCompact]}>How are you feeling today?</Text>
              </View>
              <Image source={BOOK_IMAGE} style={[styles.actionBookImage, compact && styles.actionBookImageCompact]} resizeMode="contain" />
            </View>

            <View style={styles.actionButtonsRow}>
              <Pressable
                style={[styles.primaryActionButton, compact && styles.primaryActionButtonCompact]}
                onPress={() => router.push("/write-entry?mode=new")}
              >
                <Ionicons name="pencil" size={compact ? 18 : 20} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={[styles.primaryActionText, compact && styles.primaryActionTextCompact]}>Add Entry</Text>
              </Pressable>

              <Pressable
                style={[styles.secondaryActionButton, compact && styles.secondaryActionButtonCompact]}
                onPress={() => router.push("/journal-entries")}
              >
                <Ionicons name="book-outline" size={compact ? 18 : 20} color="#4D6558" style={{ marginRight: 6 }} />
                <Text style={[styles.secondaryActionText, compact && styles.secondaryActionTextCompact]}>Entries</Text>
              </Pressable>
            </View>
          </View>
        </View>`);

content = content.replace(
`  reflectionCard: {
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
    height: 168,
    overflow: "hidden" },
  reflectionCardCompact: {
    height: 150,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
    marginBottom: 8 },
  reflectionFooterRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    columnGap: 10,
    minHeight: 48,
    marginTop: "auto" },
  reflectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6 },
  expandButton: {
    width: 28,
    height: 28,
    borderRadius: 999,
    backgroundColor: "#F4F8F1",
    alignItems: "center",
    justifyContent: "center" },
  reflectionSnippetWrap: {
    flex: 1,
    overflow: "hidden",
    marginBottom: 8 },
  reflectionFooterRowCompact: {
    columnGap: 8 },
  reflectionText: {
    color: "#33485B",
    fontSize: 15,
    lineHeight: 21,
    marginBottom: 0 },
  reflectionTextCompact: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 8 },
  reflectionFootnote: {
    flex: 1,
    flexShrink: 1,
    color: "#7B858E",
    fontSize: 10,
    lineHeight: 13,
    paddingTop: 2 },
  reflectionFootnoteCompact: {
    fontSize: 9,
    lineHeight: 12,
    paddingTop: 1 },
  companionWrap: {
    width: 54,
    height: 54,
    alignItems: "center",
    justifyContent: "center" },
  companionWrapCompact: {
    width: 44,
    height: 44 },
  companionImage: {
    width: 52,
    height: 52 },
  companionImageCompact: {
    width: 42,
    height: 42 },
  bottomSection: {
    marginTop: 8 },
  bottomSectionCompact: {
    marginTop: 4 },
  journalArtWrap: {
    width: 222,
    height: 222,
    borderRadius: 40,
    backgroundColor: "#F1F8EB",
    borderWidth: 1,
    borderColor: "#E3EFDA",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginTop: 0,
    marginBottom: 16,
    shadowColor: "#5C6570",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2 },
  journalArtWrapCompact: {
    width: 206,
    height: 206,
    marginBottom: 10 },
  bookImage: {
    width: 184,
    height: 244 },
  bookImageCompact: {
    width: 168,
    height: 224 },
  bookImageVeryCompact: {
    width: 146,
    height: 192 },
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
    lineHeight: 19 },`,
`  reflectionCard: {
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
  actionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 18,
    shadowColor: "#5C6570",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
    borderWidth: 1,
    borderColor: "#E4EFE0" },
  actionCardCompact: {
    padding: 14,
    borderRadius: 20 },
  actionCardContentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16 },
  actionCardTextCol: {
    flex: 1,
    paddingRight: 10 },
  actionCardTitle: {
    color: "#34475A",
    fontSize: 22,
    lineHeight: 28,
    fontFamily: "Outfit-Bold",
    marginBottom: 4 },
  actionCardTitleCompact: {
    fontSize: 18,
    lineHeight: 24 },
  actionCardSubtitle: {
    color: "#6B7B8C",
    fontSize: 14,
    lineHeight: 20 },
  actionCardSubtitleCompact: {
    fontSize: 13,
    lineHeight: 18 },
  actionBookImage: {
    width: 90,
    height: 100 },
  actionBookImageCompact: {
    width: 75,
    height: 85 },
  actionButtonsRow: {
    flexDirection: "row",
    gap: 12 },
  primaryActionButton: {
    flex: 1,
    flexDirection: "row",
    height: 46,
    borderRadius: 999,
    backgroundColor: "#7BCB45",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#5C6570",
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3 },
  primaryActionButtonCompact: {
    height: 42 },
  primaryActionText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontFamily: "Outfit-Bold" },
  primaryActionTextCompact: {
    fontSize: 15 },
  secondaryActionButton: {
    flex: 1,
    flexDirection: "row",
    height: 46,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D9E7D1",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#5C6570",
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2 },
  secondaryActionButtonCompact: {
    height: 42 },
  secondaryActionText: {
    color: "#4D6558",
    fontSize: 16,
    fontFamily: "Outfit-Bold" },
  secondaryActionTextCompact: {
    fontSize: 15 },`);

fs.writeFileSync('mobile-app/app/journal.tsx', content);
console.log('Update Complete!');

