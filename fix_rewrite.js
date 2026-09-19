const fs = require('fs');
let content = fs.readFileSync('mobile-app/app/journal.tsx', 'utf8');

// Get everything before return (
const returnStart = content.indexOf('  return (\r\n    <SafeAreaView');
let topPart = content.substring(0, content.indexOf('  return ('));

const jsxPart =   return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <JournalLockGate>
        <InformedConsentGate feature="journal">
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.content, compact && styles.contentCompact, veryCompact && styles.contentVeryCompact]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing || isSyncing}
              onRefresh={handleRefreshJournal}
              colors={["#73CD44"]}
              tintColor="#73CD44"
            />
          }
        >
        <View style={[styles.topSection, compact && styles.topSectionCompact]}>
          <View style={[styles.calendarCard, compact && styles.calendarCardCompact]}>
            <Text style={styles.cardEyebrow}>THIS WEEK</Text>
            <View style={[styles.calendarHeader, compact && styles.calendarHeaderCompact]}>
              <Pressable onPress={() => handleMoveWeek(-1)} style={styles.weekArrowButton}>
                <Ionicons name="chevron-back" size={22} color="#3A4A5B" />
              </Pressable>

              <Text style={[styles.calendarTitle, compact && styles.calendarTitleCompact]}>
                {formatLongDate(weekAnchorDate)}
              </Text>

              <Pressable onPress={() => handleMoveWeek(1)} style={styles.weekArrowButton}>
                <Ionicons name="chevron-forward" size={22} color="#3A4A5B" />
              </Pressable>
            </View>

            <View style={styles.calendarRow}>
              {calendarDays.map((day) => (
                <View key={day.id} style={[styles.dayItem, compact && styles.dayItemCompact]}>
                  <Text style={[styles.dayLabel, compact && styles.dayLabelCompact]}>{day.label}</Text>
                  <Pressable
                    onPress={() => handleSelectDay(day.isoDate, day.isFuture)}
                    disabled={day.isFuture}
                    style={[
                      styles.dayCircle,
                      compact && styles.dayCircleCompact,
                      !day.isFuture && styles.dayCircleEmpty,
                      day.hasEntries && styles.dayCircleDone,
                      day.isToday && day.hasEntries && styles.dayCircleActive,
                      day.isFuture && styles.dayCircleFuture,
                      selectedDay?.isoDate === day.isoDate && !day.hasEntries && !day.isFuture && styles.dayCircleSelected,
                      selectedDay?.isoDate === day.isoDate && day.hasEntries && styles.dayCircleSelectedFilled,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayNumber,
                        compact && styles.dayNumberCompact,
                        day.hasEntries && styles.dayNumberDone,
                        day.isToday && day.hasEntries && styles.dayNumberActive,
                        !day.isFuture && !day.hasEntries && styles.dayNumberOutline,
                        day.isFuture && styles.dayNumberFuture,
                        selectedDay?.isoDate === day.isoDate && !day.isFuture && styles.dayNumberSelected,
                      ]}
                    >
                      {day.date}
                    </Text>
                  </Pressable>
                </View>
              ))}
            </View>
          </View>

          <View style={[styles.reflectionCard, compact && styles.reflectionCardCompact]}>
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
          </View>
        </View>

        <View style={[styles.bottomSection, compact && styles.bottomSectionCompact]}>
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
                  <Text style={styles.bookCoverTitle}>Guided{"\\n"}Journal</Text>
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
                  <Text style={styles.bookCoverTitle}>Solo{"\\n"}Journal</Text>
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
        </View>
        </ScrollView>

        <Modal
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
        </Modal>
        </InformedConsentGate>
      </JournalLockGate>

      <HomeBottomNav activeTab="journal" />
    </SafeAreaView>
  );
}
;

const stylesPart = 
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F7FAF4" },
  scroll: {
    flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: 10,
    paddingTop: 12,
    paddingBottom: 158 },
  contentCompact: {
    paddingTop: 8,
    paddingBottom: 148 },
  contentVeryCompact: {
    paddingTop: 6,
    paddingBottom: 138 },
  topSection: {
    flexShrink: 0 },
  topSectionCompact: {
    marginBottom: 2 },
  calendarCard: {
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E4EFE0",
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: "#5C6570",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
    marginBottom: 14 },
  calendarCardCompact: {
    marginBottom: 10,
    paddingVertical: 10 },
  calendarHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10 },
  calendarHeaderCompact: {
    marginBottom: 8 },
  cardEyebrow: {
    color: "#7B8D74",
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 1,
    fontFamily: "Outfit-Bold",
    marginBottom: 8 },
  weekArrowButton: {
    width: 32,
    height: 32,
    borderRadius: 12,
    backgroundColor: "#F2F7ED",
    alignItems: "center",
    justifyContent: "center" },
  calendarTitle: {
    color: "#34475A",
    fontSize: 18,
    lineHeight: 22,
    fontFamily: "Outfit-Bold" },
  calendarTitleCompact: {
    fontSize: 16,
    lineHeight: 20 },
  calendarRow: {
    flexDirection: "row",
    justifyContent: "space-between" },
  dayItem: {
    alignItems: "center",
    rowGap: 6 },
  dayItemCompact: {
    rowGap: 4 },
  dayLabel: {
    color: "#3F4F60",
    fontSize: 15,
    lineHeight: 18,
    fontFamily: "Outfit-Bold" },
  dayLabelCompact: {
    fontSize: 13,
    lineHeight: 16 },
  dayCircle: {
    width: 31,
    height: 31,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center" },
  dayCircleCompact: {
    width: 28,
    height: 28 },
  dayCircleEmpty: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#86C74F" },
  dayCircleDone: {
    backgroundColor: "#AFE77D",
    borderWidth: 1.5,
    borderColor: "#AFE77D" },
  dayCircleActive: {
    backgroundColor: "#3E8F24",
    borderWidth: 1.5,
    borderColor: "#3E8F24" },
  dayCircleFuture: {
    backgroundColor: "#D7DDE2" },
  dayCircleSelected: {
    borderWidth: 2,
    borderColor: "#2F6F25" },
  dayCircleSelectedFilled: {
    borderWidth: 2,
    borderColor: "#285F20" },
  dayNumber: {
    color: "#3F4F60",
    fontSize: 15,
    lineHeight: 18,
    fontFamily: "Outfit-Bold" },
  dayNumberCompact: {
    fontSize: 13,
    lineHeight: 16 },
  dayNumberDone: {
    color: "#476346" },
  dayNumberActive: {
    color: "#FFFFFF" },
  dayNumberOutline: {
    color: "#3E4D5E" },
  dayNumberFuture: {
    color: "#7A8793" },
  dayNumberSelected: {
    fontFamily: "Outfit-Bold" },
  reflectionCard: {
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
  modalBackdrop: {
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
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 12,
    marginBottom: 12 },
  modalHeaderCopy: {
    flex: 1 },
  modalEyebrow: {
    color: "#7B8D74",
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 1,
    fontFamily: "Outfit-Bold",
    marginBottom: 4 },
  modalTitle: {
    color: "#32465C",
    fontSize: 18,
    lineHeight: 24,
    fontFamily: "Outfit-Bold" },
  modalCompanionWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "#EFF7E8",
    borderWidth: 1,
    borderColor: "#D8E9CB",
    alignItems: "center",
    justifyContent: "center" },
  modalCompanionImage: {
    width: 34,
    height: 34 },
  modalInsightScroll: {
    maxHeight: 280 },
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


fs.writeFileSync('mobile-app/app/journal.tsx', topPart + jsxPart + stylesPart);
console.log("Rewrite complete!");

