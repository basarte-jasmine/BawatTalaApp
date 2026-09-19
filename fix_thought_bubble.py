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

              <View style={styles.modalThoughtLayout}>
                <View style={styles.modalThoughtBubble}>
                  <ScrollView style={styles.modalInsightScroll} contentContainerStyle={styles.modalInsightContent} showsVerticalScrollIndicator={false}>
                    <Text style={styles.modalInsightText}>{insightText}</Text>
                  </ScrollView>
                </View>

                <View style={styles.modalThoughtFooter}>
                  <View style={styles.thoughtDotsColumn}>
                    <View style={styles.thoughtDotLarge} />
                    <View style={styles.thoughtDotMedium} />
                    <View style={styles.thoughtDotSmall} />
                  </View>
                  <View style={styles.modalCompanionWrap}>
                    <MuniAvatar style={styles.modalCompanionImage} />
                  </View>
                </View>
              </View>

              <Pressable style={styles.modalCloseButton} onPress={() => setShowFullInsightModal(false)}>
                <Text style={styles.modalCloseButtonText}>Close</Text>
              </Pressable>
            </View>
          </View>
        </Modal>"""

content = content.replace(old_modal, new_modal)

style_start = content.find('  modalBackdrop: {')
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
    borderRadius: 28,
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
  modalThoughtLayout: {
    alignItems: "flex-end",
    marginBottom: 8 },
  modalThoughtBubble: {
    backgroundColor: "#F5F9F1",
    padding: 16,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#E2ECD8",
    width: "100%" },
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
    borderWidth: 1,
    borderColor: "#E2ECD8",
    marginBottom: 4,
    marginLeft: -16 },
  thoughtDotMedium: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: "#F5F9F1",
    borderWidth: 1,
    borderColor: "#E2ECD8",
    marginBottom: 4,
    marginLeft: -4 },
  thoughtDotSmall: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "#F5F9F1",
    borderWidth: 1,
    borderColor: "#E2ECD8",
    marginBottom: 4,
    marginLeft: 8 },
  modalCompanionWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#EFF7E8",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#D8E9CB" },
  modalCompanionImage: {
    width: 36,
    height: 36 },
  modalInsightScroll: {
    flex: 1,
    maxHeight: 250 },
  modalInsightContent: {
    paddingBottom: 4 },
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

