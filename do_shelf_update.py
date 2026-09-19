import re

with open('mobile-app/app/journal.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the bottom section
bottom_pattern = re.compile(r'<View style={\[styles.bottomSection.*?</View>\s*</View>', re.DOTALL)

new_bottom = """<View style={[styles.bottomSection, compact && styles.bottomSectionCompact]}>
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
                  <Text style={styles.bookCoverTitle}>Guided{"\n"}Journal</Text>
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
                  <Text style={styles.bookCoverTitle}>Solo{"\n"}Journal</Text>
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

content = bottom_pattern.sub(new_bottom, content, count=1)

# Replace Styles
style_start_idx = content.find('  shelfHeaderRow: {')
style_end_idx = content.find('  modalBackdrop: {')

if style_start_idx != -1 and style_end_idx != -1:
    new_styles = """  shelfHeaderRow: {
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
    content = content[:style_start_idx] + new_styles + content[style_end_idx:]
    
with open('mobile-app/app/journal.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated successfully via python!")

