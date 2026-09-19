import re

with open('mobile-app/app/journal.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the new reflection layout with the original one
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

content = content.replace(new_reflection, old_reflection)

# Restore the original styles
style_start = content.find('  reflectionCard: {')
style_end = content.find('  bottomSection: {')

if style_start != -1 and style_end != -1:
    old_styles = """  reflectionCard: {
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
"""
    content = content[:style_start] + old_styles + content[style_end:]
else:
    print("WARNING: styles not found")

with open('mobile-app/app/journal.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("SUCCESS!")

