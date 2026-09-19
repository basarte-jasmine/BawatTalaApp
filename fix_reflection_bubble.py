import re

with open('mobile-app/app/journal.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

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

            <View style={styles.reflectionLayoutRow}>
              <View style={[styles.companionWrap, compact && styles.companionWrapCompact]}>
                <MuniAvatar style={[styles.companionImage, compact && styles.companionImageCompact]} />
              </View>
              
              <View style={styles.reflectionContentWrap}>
                <Pressable onPress={() => setShowFullInsightModal(true)}>
                  <View style={[styles.bubbleWrap, compact && styles.bubbleWrapCompact]}>
                    <Text style={[styles.reflectionText, compact && styles.reflectionTextCompact]} numberOfLines={compact ? 2 : 3}>
                      {insightText}
                    </Text>
                  </View>
                </Pressable>
              </View>
            </View>
            
            <Text style={[styles.reflectionFootnote, compact && styles.reflectionFootnoteCompact]} numberOfLines={2}>
              Summary by Muni, an AI companion. Muni is not a psychometrician or a substitute for professional care.
            </Text>
          </View>"""

content = content.replace(old_reflection, new_reflection)

style_start = content.find('  reflectionCard: {')
style_end = content.find('  bottomSection: {')

if style_start != -1 and style_end != -1:
    new_styles = """  reflectionCard: {
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E4EFE0",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
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
  reflectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10 },
  expandButton: {
    width: 28,
    height: 28,
    borderRadius: 999,
    backgroundColor: "#F2F7ED",
    alignItems: "center",
    justifyContent: "center" },
  reflectionLayoutRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    columnGap: 12,
    marginBottom: 10 },
  reflectionContentWrap: {
    flex: 1 },
  bubbleWrap: {
    backgroundColor: "#F5F9F1",
    padding: 14,
    borderRadius: 18,
    borderTopLeftRadius: 4 },
  bubbleWrapCompact: {
    padding: 10 },
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
    lineHeight: 13,
    fontFamily: "Outfit-Bold" },
  reflectionFootnoteCompact: {
    fontSize: 9,
    lineHeight: 12 },
  companionWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#EFF7E8",
    alignItems: "center",
    justifyContent: "center" },
  companionWrapCompact: {
    width: 40,
    height: 40,
    borderRadius: 20 },
  companionImage: {
    width: 40,
    height: 40 },
  companionImageCompact: {
    width: 34,
    height: 34 },
"""
    content = content[:style_start] + new_styles + content[style_end:]
else:
    print("WARNING: styles not found")

with open('mobile-app/app/journal.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("SUCCESS")

