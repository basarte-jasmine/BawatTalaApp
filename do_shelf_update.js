const fs = require('fs');
let content = fs.readFileSync('mobile-app/app/journal.tsx', 'utf8');
content = content.replace(/\r\n/g, '\n');

const oldBottom = `<View style={[styles.bottomSection, compact && styles.bottomSectionCompact]}>
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
        </View>`;

const newBottom = `<View style={[styles.bottomSection, compact && styles.bottomSectionCompact]}>
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
        </View>`;

if (content.includes(oldBottom)) {
  content = content.replace(oldBottom, newBottom);
  console.log("Replaced Bottom!");
} else {
  console.log("Could not find Bottom");
}

const styleStart = content.indexOf('  actionCard: {');
const styleEnd = content.indexOf('  modalBackdrop: {');
if (styleStart !== -1 && styleEnd !== -1) {
    const newStyles = `  shelfHeaderRow: {
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
`;
    content = content.substring(0, styleStart) + newStyles + content.substring(styleEnd);
    console.log("Replaced Styles!");
} else {
    console.log("Could not find Styles boundaries");
}

fs.writeFileSync('mobile-app/app/journal.tsx', content);

