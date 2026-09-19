import re

with open('mobile-app/app/journal.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

old_modal = """        <Modal
          visible={showFullInsightModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowFullInsightModal(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <View style={styles.modalHeaderCopy}>
                  <Text style={styles.modalEyebrow}>MUNI SUMMARY</Text>
                  <Text style={styles.modalTitle}>{formatLongDate(weekAnchorDate)}</Text>
                </View>

                <View style={styles.modalCompanionWrap}>
                  <MuniAvatar style={styles.modalCompanionImage} />
                </View>
              </View>

              <ScrollView style={styles.modalInsightScroll} contentContainerStyle={styles.modalInsightContent} showsVerticalScrollIndicator={false}>
                <Text style={styles.modalInsightText}>{insightText}</Text>
              </ScrollView>

              <Pressable style={styles.modalCloseButton} onPress={() => setShowFullInsightModal(false)}>
                <Text style={styles.modalCloseButtonText}>Close</Text>
              </Pressable>
            </View>
          </View>
        </Modal>"""

new_modal = """        <Modal
          visible={showFullInsightModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowFullInsightModal(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              
              <View style={styles.modalHeaderRow}>
                <Text style={styles.modalEyebrow}>MUNI SUMMARY</Text>
                <Text style={styles.modalTitle}>{formatLongDate(weekAnchorDate)}</Text>
              </View>

              <View style={styles.modalChatLayout}>
                <View style={styles.modalCompanionWrap}>
                  <MuniAvatar style={styles.modalCompanionImage} />
                </View>
                
                <ScrollView style={styles.modalInsightScroll} contentContainerStyle={styles.modalInsightContent} showsVerticalScrollIndicator={false}>
                  <View style={styles.modalBubbleWrap}>
                    <Text style={styles.modalInsightText}>{insightText}</Text>
                  </View>
                </ScrollView>
              </View>

              <Pressable style={styles.modalCloseButton} onPress={() => setShowFullInsightModal(false)}>
                <Text style={styles.modalCloseButtonText}>Close</Text>
              </Pressable>
            </View>
          </View>
        </Modal>"""

content = content.replace(old_modal, new_modal)

# Update the styles
style_start = content.find('  modalBackdrop: {')
if style_start != -1:
    old_styles = content[style_start:]
    
    new_styles = """  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(21, 27, 24, 0.34)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 22 },
  modalCard: {
    width: "100%",
    maxWidth: 340,
    maxHeight: "76%",
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E0ECD7",
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 16,
    shadowColor: "#525C67",
    shadowOpacity: 0.16,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4 },
  modalHeaderRow: {
    marginBottom: 16,
    alignItems: "center" },
  modalEyebrow: {
    color: "#7B8D74",
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 1,
    fontFamily: "Outfit-Bold",
    marginBottom: 4,
    textAlign: "center" },
  modalTitle: {
    color: "#32465C",
    fontSize: 18,
    lineHeight: 24,
    fontFamily: "Outfit-Bold",
    textAlign: "center" },
  modalChatLayout: {
    flexDirection: "row",
    alignItems: "flex-start",
    columnGap: 12,
    marginBottom: 8 },
  modalCompanionWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#EFF7E8",
    alignItems: "center",
    justifyContent: "center" },
  modalCompanionImage: {
    width: 40,
    height: 40 },
  modalInsightScroll: {
    flex: 1,
    maxHeight: 280 },
  modalInsightContent: {
    paddingBottom: 4 },
  modalBubbleWrap: {
    backgroundColor: "#F5F9F1",
    padding: 14,
    borderRadius: 18,
    borderTopLeftRadius: 4 },
  modalInsightText: {
    color: "#33485B",
    fontSize: 15,
    lineHeight: 22 },
  modalCloseButton: {
    marginTop: 14,
    minHeight: 40,
    borderRadius: 999,
    backgroundColor: "#79C943",
    alignItems: "center",
    justifyContent: "center" },
  modalCloseButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    lineHeight: 18,
    fontFamily: "Outfit-Bold" } });
"""
    content = content[:style_start] + new_styles

with open('mobile-app/app/journal.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated modal!")

