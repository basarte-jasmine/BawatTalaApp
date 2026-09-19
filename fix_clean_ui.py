import re

with open('mobile-app/app/journal.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace Inline Reflection Card
old_inline = """          <View style={[styles.reflectionCard, compact && styles.reflectionCardCompact]}>
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

new_inline = """          <View style={[styles.reflectionCard, compact && styles.reflectionCardCompact]}>
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
            
            <Text style={[styles.reflectionFootnote, compact && styles.reflectionFootnoteCompact]} numberOfLines={2}>
              Summary by Muni, an AI companion. Muni is not a psychometrician or a substitute for professional care.
            </Text>
          </View>"""

content = content.replace(old_inline, new_inline)

# Add missing style for inline reflectionSnippetWrap if it's missing
if 'reflectionSnippetWrap:' not in content:
    idx = content.find('  reflectionText: {')
    content = content[:idx] + '  reflectionSnippetWrap: {\n    flex: 1,\n    overflow: "hidden",\n    marginBottom: 8 },\n' + content[idx:]

# Replace Modal Styles
# Find modalBackdrop block
style_start = content.find('  modalBackdrop: {')
if style_start != -1:
    new_styles = """  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(12, 18, 15, 0.8)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 22 },
  modalCard: {
    width: "100%",
    maxWidth: 340,
    maxHeight: "85%",
    backgroundColor: "transparent",
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 0 },
  modalHeaderRow: {
    marginBottom: 24,
    alignItems: "center" },
  modalEyebrow: {
    color: "#C2D2B8",
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 2,
    fontFamily: "Outfit-Bold",
    marginBottom: 4,
    textAlign: "center" },
  modalTitle: {
    color: "#FFFFFF",
    fontSize: 22,
    lineHeight: 28,
    fontFamily: "Outfit-Bold",
    textAlign: "center" },
  modalThoughtLayout: {
    alignItems: "flex-end",
    marginBottom: 16 },
  modalThoughtBubble: {
    backgroundColor: "#F5F9F1",
    padding: 18,
    borderRadius: 24,
    width: "100%",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4 },
  modalThoughtFooter: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 6,
    marginRight: 10 },
  thoughtDotsColumn: {
    alignItems: "center",
    marginRight: 8,
    marginTop: -4 },
  thoughtDotLarge: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#F5F9F1",
    marginBottom: 4,
    marginLeft: -16 },
  thoughtDotMedium: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: "#F5F9F1",
    marginBottom: 4,
    marginLeft: -4 },
  thoughtDotSmall: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "#F5F9F1",
    marginBottom: 4,
    marginLeft: 8 },
  modalCompanionWrap: {
    width: 60,
    height: 60,
    alignItems: "center",
    justifyContent: "center" },
  modalCompanionImage: {
    width: 60,
    height: 60 },
  modalInsightScroll: {
    flex: 1,
    maxHeight: 300 },
  modalInsightContent: {
    paddingBottom: 4 },
  modalInsightText: {
    color: "#33485B",
    fontSize: 16,
    lineHeight: 24 },
  modalCloseButton: {
    marginTop: 8,
    minHeight: 46,
    borderRadius: 999,
    backgroundColor: "#79C943",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4 },
  modalCloseButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    lineHeight: 20,
    fontFamily: "Outfit-Bold" } });
"""
    content = content[:style_start] + new_styles

with open('mobile-app/app/journal.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated successfully!")

