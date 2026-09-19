import re

with open('mobile-app/app/journal.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the bottomSection
bottom_pattern = re.compile(r'<View style={\[styles.bottomSection.*?</View>\s*</View>', re.DOTALL)

new_bottom = """<View style={[styles.bottomSection, compact && styles.bottomSectionCompact]}>
          <View style={styles.shelfHeaderRow}>
            <Text style={[styles.shelfTitle, compact && styles.shelfTitleCompact]}>Your Journals</Text>
            <Pressable style={styles.viewAllButton} onPress={() => router.push("/journal-entries")}>
              <Text style={styles.viewAllText}>View All</Text>
              <Ionicons name="chevron-forward" size={16} color="#6B7B8C" />
            </Pressable>
          </View>

          <View style={styles.libraryCabinet}>
            {/* The Books resting on the shelf */}
            <View style={styles.booksRow}>
              <Pressable style={styles.shelfBookItem} onPress={() => router.push("/write-entry?mode=new-muni")}>
                <Image source={BOOK_IMAGE} style={styles.bookBaseImage} resizeMode="contain" />
                <View style={[styles.bookDeco, styles.bookDecoMuni]}>
                  <Ionicons name="chatbubbles" size={20} color="#FFFFFF" />
                </View>
              </Pressable>

              <Pressable style={styles.shelfBookItem} onPress={() => router.push("/write-entry?mode=new-solo")}>
                <Image source={BOOK_IMAGE} style={styles.bookBaseImage} resizeMode="contain" />
                <View style={[styles.bookDeco, styles.bookDecoSolo]}>
                  <Ionicons name="pencil" size={20} color="#FFFFFF" />
                </View>
              </Pressable>
            </View>

            {/* The physical shelf */}
            <View style={styles.physicalShelfTop} />
            <View style={styles.physicalShelfFront} />
            <View style={styles.physicalShelfShadow} />

            {/* Labels acting as plaques on the next shelf level down */}
            <View style={styles.shelfLabelsRow}>
              <View style={styles.shelfLabelPlaque}>
                <Text style={styles.bookLabel}>Guided Journal</Text>
                <Text style={styles.bookSubLabel}>With Muni</Text>
              </View>
              <View style={styles.shelfLabelPlaque}>
                <Text style={styles.bookLabel}>Solo Journal</Text>
                <Text style={styles.bookSubLabel}>Free write</Text>
              </View>
            </View>
          </View>
        </View>"""

content = bottom_pattern.sub(new_bottom, content, count=1)

# Replace Styles
style_start_idx = content.find('  shelfHeaderRow: {')
style_end_idx = content.find('  modalBackdrop: {')

if style_start_idx != -1 and style_end_idx != -1:
    new_styles = """  shelfHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
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
  libraryCabinet: {
    backgroundColor: "#F0E8D9",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#DED3C1",
    marginTop: 4,
    marginBottom: 10,
    overflow: "hidden" },
  booksRow: {
    flexDirection: "row",
    justifyContent: "space-evenly",
    alignItems: "flex-end",
    paddingTop: 30,
    paddingBottom: 0,
    zIndex: 2,
    paddingHorizontal: 20 },
  shelfBookItem: {
    width: 120,
    height: 140,
    position: "relative",
    alignItems: "center",
    justifyContent: "flex-end" },
  bookBaseImage: {
    width: "100%",
    height: "100%" },
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
    right: 0 },
  bookDecoSolo: {
    backgroundColor: "#FFA726",
    bottom: 15,
    left: 0 },
  physicalShelfTop: {
    height: 12,
    backgroundColor: "#E2D3B8",
    zIndex: 1 },
  physicalShelfFront: {
    height: 18,
    backgroundColor: "#CCA87C",
    zIndex: 1 },
  physicalShelfShadow: {
    height: 14,
    backgroundColor: "rgba(0,0,0,0.06)" },
  shelfLabelsRow: {
    flexDirection: "row",
    justifyContent: "space-evenly",
    paddingVertical: 14,
    paddingHorizontal: 10 },
  shelfLabelPlaque: {
    alignItems: "center",
    width: "42%",
    backgroundColor: "rgba(255,255,255,0.45)",
    borderRadius: 8,
    paddingVertical: 6 },
  bookLabel: {
    color: "#4A3F33",
    fontSize: 14,
    fontFamily: "Outfit-Bold",
    marginBottom: 2 },
  bookSubLabel: {
    color: "#8C7C6B",
    fontSize: 12 },
"""
    content = content[:style_start_idx] + new_styles + content[style_end_idx:]

with open('mobile-app/app/journal.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

