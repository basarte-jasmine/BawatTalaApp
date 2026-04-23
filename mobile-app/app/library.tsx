import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { HomeBottomNav } from "../components/home/HomeBottomNav";
import { LIBRARY_BOOKS, type LibraryBook } from "../lib/library-data";

export default function LibraryScreen() {
  const { width } = useWindowDimensions();
  const frameWidth = Math.min(width - 24, 420);
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const [finishedBookIds, setFinishedBookIds] = useState<string[]>([]);

  const selectedBook = useMemo(
    () => LIBRARY_BOOKS.find((book) => book.id === selectedBookId) ?? null,
    [selectedBookId],
  );
  const finishedCount = finishedBookIds.length;
  const readyCount = LIBRARY_BOOKS.length - finishedCount;

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/home");
  };

  const handleOpenBook = (bookId: string) => {
    setSelectedBookId(bookId);
  };

  const handleCloseBook = () => {
    setSelectedBookId(null);
  };

  const handleMarkFinished = (bookId: string) => {
    setFinishedBookIds((current) => (current.includes(bookId) ? current : [...current, bookId]));
  };

  const renderBookCard = (book: LibraryBook) => {
    const isFinished = finishedBookIds.includes(book.id);

    return (
      <Pressable key={book.id} style={styles.bookCard} onPress={() => handleOpenBook(book.id)}>
        <View style={[styles.bookAccentGlow, { backgroundColor: `${book.accentColor}AA` }]} />
        <View style={styles.bookCardTopRow}>
          <View style={[styles.bookTag, { backgroundColor: `${book.accentColor}4D`, borderColor: `${book.accentColor}80` }]}>
            <Text style={styles.bookTagText}>{book.shelfLabel}</Text>
          </View>
          <View style={[styles.bookStatusPill, isFinished && styles.bookStatusPillDone]}>
            <Text style={[styles.bookStatusText, isFinished && styles.bookStatusTextDone]}>
              {isFinished ? "Finished" : "Read now"}
            </Text>
          </View>
        </View>

        <View style={styles.bookCardBody}>
          <View style={[styles.bookCoverWrap, { backgroundColor: book.accentColor }]}>
            {book.coverImage ? <Image source={book.coverImage} style={styles.bookCoverImage} resizeMode="contain" /> : null}
          </View>

          <View style={styles.bookInfoWrap}>
            <Text style={styles.bookCategory}>{book.category}</Text>
            <Text style={styles.bookTitle}>{book.title}</Text>
            <Text style={styles.bookAuthor}>{book.author}</Text>
            <Text style={styles.bookBlurb}>{book.blurb}</Text>

            <View style={styles.bookMetaRow}>
              <View style={styles.bookMetaPill}>
                <Ionicons name="time-outline" size={14} color="#5C6D7A" />
                <Text style={styles.bookMetaText}>{`${book.estimatedMinutes} min`}</Text>
              </View>
              <View style={styles.bookMetaPill}>
                <Ionicons name="sparkles-outline" size={14} color="#5C6D7A" />
                <Text style={styles.bookMetaText}>{book.rewardLabel}</Text>
              </View>
            </View>
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.topBar}>
        <Pressable style={styles.backButton} accessibilityLabel="Go back" onPress={handleBack}>
          <Ionicons name="chevron-back" size={28} color="#37424F" />
        </Pressable>
        <Text style={styles.topTitle}>Pocket Library</Text>
        <View style={styles.topBarSpacer} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={[styles.contentFrame, { width: frameWidth }]}>
          <View style={styles.heroCard}>
            <View style={styles.heroGlowOne} />
            <View style={styles.heroGlowTwo} />
            <View style={styles.heroBadge}>
              <Ionicons name="library-outline" size={15} color="#4B7C33" />
              <Text style={styles.heroBadgeText}>Library Quest</Text>
            </View>

            <Text style={styles.heroTitle}>Read gentle books whenever you need a softer corner.</Text>
            <Text style={styles.heroBody}>
              This space is built like a pocket shelf: short, calming reads that can help you breathe, reflect, and reset between heavy moments.
            </Text>

            <View style={styles.heroStatsRow}>
              <View style={styles.heroStatPill}>
                <Text style={styles.heroStatValue}>{LIBRARY_BOOKS.length}</Text>
                <Text style={styles.heroStatLabel}>Books ready</Text>
              </View>
              <View style={styles.heroStatPill}>
                <Text style={styles.heroStatValue}>{finishedCount}</Text>
                <Text style={styles.heroStatLabel}>Finished</Text>
              </View>
              <View style={styles.heroStatPill}>
                <Text style={styles.heroStatValue}>{readyCount}</Text>
                <Text style={styles.heroStatLabel}>Still to explore</Text>
              </View>
            </View>
          </View>

          <View style={styles.questCard}>
            <View style={styles.questHeader}>
              <View style={styles.questHeaderTextWrap}>
                <Text style={styles.questEyebrow}>Reading Path</Text>
                <Text style={styles.questTitle}>Browse, read, and collect quiet wins.</Text>
              </View>
              <View style={styles.questBadge}>
                <Ionicons name="star-outline" size={16} color="#6D7A3A" />
              </View>
            </View>

            <View style={styles.questSteps}>
              <View style={styles.questStep}>
                <Text style={styles.questStepNumber}>1</Text>
                <Text style={styles.questStepText}>Pick a shelf that matches what you need.</Text>
              </View>
              <View style={styles.questStep}>
                <Text style={styles.questStepNumber}>2</Text>
                <Text style={styles.questStepText}>Read a short chapter at your own pace.</Text>
              </View>
              <View style={styles.questStep}>
                <Text style={styles.questStepNumber}>3</Text>
                <Text style={styles.questStepText}>Mark it finished when the read helped you land.</Text>
              </View>
            </View>
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Featured Shelf</Text>
            <Text style={styles.sectionSubTitle}>Tap any book to open the in-app reader.</Text>
          </View>

          <View style={styles.bookList}>
            {LIBRARY_BOOKS.map(renderBookCard)}
          </View>
        </View>
      </ScrollView>

      <Modal visible={Boolean(selectedBook)} transparent animationType="fade" onRequestClose={handleCloseBook}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderTextWrap}>
                <Text style={styles.modalEyebrow}>{selectedBook?.category ?? "Library"}</Text>
                <Text style={styles.modalTitle}>{selectedBook?.title ?? ""}</Text>
                <Text style={styles.modalAuthor}>{selectedBook?.author ?? ""}</Text>
              </View>

              <Pressable style={styles.modalCloseButton} accessibilityLabel="Close reader" onPress={handleCloseBook}>
                <Ionicons name="close" size={20} color="#495A68" />
              </Pressable>
            </View>

            <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalScrollContent} showsVerticalScrollIndicator={false}>
              {selectedBook?.chapters.map((chapter) => (
                <View key={chapter.title} style={styles.chapterCard}>
                  <Text style={styles.chapterTitle}>{chapter.title}</Text>
                  {chapter.body.map((paragraph, index) => (
                    <Text key={`${chapter.title}-${index}`} style={styles.chapterBody}>
                      {paragraph}
                    </Text>
                  ))}
                </View>
              ))}
            </ScrollView>

            <View style={styles.modalFooter}>
              <View style={styles.modalRewardPill}>
                <Ionicons name="sparkles-outline" size={15} color="#6C7C39" />
                <Text style={styles.modalRewardText}>{selectedBook?.rewardLabel ?? "Shelf reward"}</Text>
              </View>

              <Pressable
                style={styles.modalPrimaryButton}
                onPress={() => {
                  if (selectedBook) {
                    handleMarkFinished(selectedBook.id);
                  }
                  handleCloseBook();
                }}
              >
                <Text style={styles.modalPrimaryButtonText}>
                  {selectedBook && finishedBookIds.includes(selectedBook.id) ? "Close book" : "Mark as finished"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <HomeBottomNav activeTab="home" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F7FAF6",
  },
  topBar: {
    height: 52,
    borderBottomWidth: 1,
    borderBottomColor: "#E6ECF1",
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    shadowColor: "#777777",
    shadowOpacity: 0.12,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  topTitle: {
    color: "#33475C",
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "700",
  },
  topBarSpacer: {
    width: 36,
    height: 36,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 12,
    paddingTop: 14,
    paddingBottom: 92,
    alignItems: "center",
  },
  contentFrame: {
    maxWidth: 420,
  },
  heroCard: {
    borderRadius: 28,
    backgroundColor: "#DDF2B8",
    borderWidth: 1,
    borderColor: "#C6E6A4",
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 18,
    overflow: "hidden",
    marginBottom: 14,
  },
  heroGlowOne: {
    position: "absolute",
    top: -32,
    right: -18,
    width: 154,
    height: 154,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  heroGlowTwo: {
    position: "absolute",
    left: -26,
    bottom: -54,
    width: 124,
    height: 124,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  heroBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    columnGap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.7)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.9)",
    marginBottom: 12,
  },
  heroBadgeText: {
    color: "#476B35",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
  },
  heroTitle: {
    color: "#2F4257",
    fontSize: 25,
    lineHeight: 31,
    fontWeight: "700",
    maxWidth: 300,
    marginBottom: 8,
  },
  heroBody: {
    color: "#4E6778",
    fontSize: 14,
    lineHeight: 20,
    maxWidth: 316,
  },
  heroStatsRow: {
    flexDirection: "row",
    columnGap: 8,
    marginTop: 16,
  },
  heroStatPill: {
    flex: 1,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.68)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.84)",
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  heroStatValue: {
    color: "#304558",
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "700",
    marginBottom: 2,
  },
  heroStatLabel: {
    color: "#60707E",
    fontSize: 11,
    lineHeight: 14,
  },
  questCard: {
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E4EBDD",
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 14,
    marginBottom: 14,
    shadowColor: "#66737E",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  questHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    columnGap: 10,
    marginBottom: 12,
  },
  questHeaderTextWrap: {
    flex: 1,
  },
  questEyebrow: {
    color: "#6B8456",
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  questTitle: {
    color: "#304558",
    fontSize: 18,
    lineHeight: 23,
    fontWeight: "700",
  },
  questBadge: {
    width: 36,
    height: 36,
    borderRadius: 14,
    backgroundColor: "#F5F9EB",
    borderWidth: 1,
    borderColor: "#E2E8D5",
    alignItems: "center",
    justifyContent: "center",
  },
  questSteps: {
    rowGap: 9,
  },
  questStep: {
    flexDirection: "row",
    alignItems: "flex-start",
    columnGap: 10,
  },
  questStepNumber: {
    width: 24,
    height: 24,
    borderRadius: 999,
    backgroundColor: "#EAF5DA",
    color: "#4A7A33",
    textAlign: "center",
    fontSize: 12,
    lineHeight: 24,
    fontWeight: "700",
  },
  questStepText: {
    flex: 1,
    color: "#566B7B",
    fontSize: 13,
    lineHeight: 18,
    paddingTop: 2,
  },
  sectionHeader: {
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  sectionTitle: {
    color: "#304558",
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "700",
    marginBottom: 2,
  },
  sectionSubTitle: {
    color: "#607181",
    fontSize: 13,
    lineHeight: 18,
  },
  bookList: {
    rowGap: 12,
  },
  bookCard: {
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E4EBDD",
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 14,
    overflow: "hidden",
    shadowColor: "#66737E",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  bookAccentGlow: {
    position: "absolute",
    top: -24,
    right: -14,
    width: 104,
    height: 104,
    borderRadius: 999,
    opacity: 0.24,
  },
  bookCardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    columnGap: 8,
    marginBottom: 12,
  },
  bookTag: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  bookTagText: {
    color: "#426272",
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "700",
  },
  bookStatusPill: {
    borderRadius: 999,
    backgroundColor: "#F3F7FA",
    borderWidth: 1,
    borderColor: "#DFE6EC",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  bookStatusPillDone: {
    backgroundColor: "#EDF7E4",
    borderColor: "#CBE3BC",
  },
  bookStatusText: {
    color: "#4E6778",
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "700",
  },
  bookStatusTextDone: {
    color: "#507D33",
  },
  bookCardBody: {
    flexDirection: "row",
    alignItems: "flex-start",
    columnGap: 12,
  },
  bookCoverWrap: {
    width: 90,
    height: 116,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    padding: 10,
  },
  bookCoverImage: {
    width: 64,
    height: 82,
  },
  bookInfoWrap: {
    flex: 1,
    paddingTop: 2,
  },
  bookCategory: {
    color: "#6F845C",
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  bookTitle: {
    color: "#304558",
    fontSize: 19,
    lineHeight: 24,
    fontWeight: "700",
    marginBottom: 2,
  },
  bookAuthor: {
    color: "#6A7782",
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 7,
  },
  bookBlurb: {
    color: "#42586B",
    fontSize: 13,
    lineHeight: 19,
  },
  bookMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  bookMetaPill: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 5,
    borderRadius: 999,
    backgroundColor: "#F4F8FB",
    borderWidth: 1,
    borderColor: "#E1E8EE",
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  bookMetaText: {
    color: "#5C6D7A",
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "600",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(18, 24, 30, 0.34)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 26,
  },
  modalCard: {
    width: "100%",
    maxWidth: 360,
    maxHeight: "92%",
    borderRadius: 28,
    backgroundColor: "#FFFDF7",
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 16,
    shadowColor: "#46515D",
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    columnGap: 10,
    marginBottom: 14,
  },
  modalHeaderTextWrap: {
    flex: 1,
  },
  modalEyebrow: {
    color: "#6D845C",
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  modalTitle: {
    color: "#304558",
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "700",
    marginBottom: 2,
  },
  modalAuthor: {
    color: "#61717F",
    fontSize: 13,
    lineHeight: 18,
  },
  modalCloseButton: {
    width: 34,
    height: 34,
    borderRadius: 999,
    backgroundColor: "#F7F8F3",
    borderWidth: 1,
    borderColor: "#E2E6DB",
    alignItems: "center",
    justifyContent: "center",
  },
  modalScroll: {
    flexGrow: 0,
  },
  modalScrollContent: {
    rowGap: 10,
    paddingBottom: 8,
  },
  chapterCard: {
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#ECEADF",
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  chapterTitle: {
    color: "#31475A",
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "700",
    marginBottom: 8,
  },
  chapterBody: {
    color: "#4A5E71",
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 8,
  },
  modalFooter: {
    marginTop: 14,
    rowGap: 10,
  },
  modalRewardPill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    columnGap: 6,
    borderRadius: 999,
    backgroundColor: "#F3F6E7",
    borderWidth: 1,
    borderColor: "#DEE7C6",
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  modalRewardText: {
    color: "#5F6F3E",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
  },
  modalPrimaryButton: {
    minHeight: 46,
    borderRadius: 999,
    backgroundColor: "#70C943",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  modalPrimaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "700",
  },
});
