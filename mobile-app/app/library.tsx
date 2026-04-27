import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { HomeBottomNav } from "../components/home/HomeBottomNav";
import { useAuthSession } from "../lib/auth-session";
import {
  downloadLibraryBook,
  fetchLibraryBooks,
  rateLibraryBook,
  saveLibraryBookProgress,
  type LibraryBookProgress,
  type LibraryBookRecord,
} from "../lib/backend-api";
import {
  downloadEpubToLibrary,
  localFileExists,
  readEpubPagesFromFile,
  type EpubReaderPage as ReaderPage,
} from "../lib/epub-reader";

const BOOK_COVER_IMAGE = require("../assets/images/book_sample.png");
const STAR_VALUES = [1, 2, 3, 4, 5];

type StoredEpubFiles = Record<string, { downloadedAt?: string | null; uri: string }>;

function getStoredEpubFilesKey(studentNumber?: string) {
  return `bawat_tala_library_epubs:${studentNumber || "guest"}`;
}

async function getStoredEpubFiles(studentNumber?: string): Promise<StoredEpubFiles> {
  const storedValue = await AsyncStorage.getItem(getStoredEpubFilesKey(studentNumber));
  if (!storedValue) return {};

  try {
    const parsed = JSON.parse(storedValue);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function saveStoredEpubFile(studentNumber: string | undefined, bookId: string, uri: string, downloadedAt?: string | null) {
  const storedFiles = await getStoredEpubFiles(studentNumber);
  storedFiles[bookId] = { downloadedAt: downloadedAt ?? new Date().toISOString(), uri };
  await AsyncStorage.setItem(getStoredEpubFilesKey(studentNumber), JSON.stringify(storedFiles));
}

function isEpubBook(book: LibraryBookRecord) {
  return Boolean(book.downloadableEpub);
}

function buildFallbackReaderPages(book: LibraryBookRecord): ReaderPage[] {
  const detailLines = [
    book.author ? `Author: ${book.author}` : "",
    book.publisher ? `Publisher: ${book.publisher}` : "",
    book.publishedDate ? `Published: ${book.publishedDate}` : "",
    book.pageCount ? `Length: ${book.pageCount} pages` : "",
    book.downloadableEpub || book.downloadablePdf
      ? `Formats: ${[book.downloadableEpub ? "EPUB" : "", book.downloadablePdf ? "PDF" : ""].filter(Boolean).join(", ")}`
      : "Reader access depends on the configured library catalog.",
  ].filter(Boolean);

  return [
    {
      eyebrow: book.category,
      title: book.title,
      paragraphs: [book.blurb || "A mental-health and wellbeing read from the library catalog."],
    },
    {
      eyebrow: "Book Details",
      title: "About this book",
      paragraphs: detailLines.length ? detailLines : ["The library catalog did not provide extra details for this title."],
    },
    {
      eyebrow: "Reading Access",
      title: "Continue in the reader",
      paragraphs: [
        "This EPUB could not be fully parsed, but your download is saved on this device. Try another EPUB result if the text does not appear correctly.",
      ],
    },
  ];
}

export default function LibraryScreen() {
  const { user } = useAuthSession();
  const { width } = useWindowDimensions();
  const compact = width < 390;
  const narrow = width < 360;
  const [books, setBooks] = useState<LibraryBookRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const [readerPageIndex, setReaderPageIndex] = useState(0);
  const [readerPages, setReaderPages] = useState<ReaderPage[]>([]);
  const [isReaderLoading, setIsReaderLoading] = useState(false);
  const [readerErrorMessage, setReaderErrorMessage] = useState("");
  const [ratingErrorMessage, setRatingErrorMessage] = useState("");
  const [searchDraft, setSearchDraft] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [activeDownloadBookId, setActiveDownloadBookId] = useState<string | null>(null);
  const [libraryActionMessage, setLibraryActionMessage] = useState("");
  const [libraryActionTone, setLibraryActionTone] = useState<"error" | "success">("success");

  const selectedBook = useMemo(
    () => books.find((book) => book.id === selectedBookId) ?? null,
    [books, selectedBookId],
  );
  const downloadedCount = books.filter((book) => book.localEpubUri).length;
  const waitingCount = books.filter((book) => isEpubBook(book) && !book.localEpubUri).length;

  const currentPage = readerPages[readerPageIndex] ?? null;
  const canGoPreviousPage = readerPageIndex > 0;
  const canGoNextPage = readerPageIndex < readerPages.length - 1;
  const selectedBookRating = selectedBook?.progress?.rating ?? 0;

  const mergeLocalEpubFiles = useCallback(async (incomingBooks: LibraryBookRecord[]) => {
    const storedFiles = await getStoredEpubFiles(user?.studentNumber);
    const existingEntries = await Promise.all(
      Object.entries(storedFiles).map(async ([bookId, file]) => ({
        bookId,
        file,
        exists: await localFileExists(file.uri).catch(() => false),
      })),
    );
    const existingFiles = new Map(existingEntries.filter((entry) => entry.exists).map((entry) => [entry.bookId, entry.file]));

    return incomingBooks.map((book) => {
      const localFile = existingFiles.get(book.id);
      if (!localFile) return book;

      return {
        ...book,
        downloaded: true,
        downloadedAt: book.downloadedAt ?? localFile.downloadedAt ?? null,
        localEpubUri: localFile.uri,
        readerLink: "",
        shelfLabel: "Downloaded",
      };
    });
  }, [user?.studentNumber]);

  const updateBookDownload = useCallback((
    bookId: string,
    download: { downloadedAt?: string | null; downloadUrl?: string } | null | undefined,
    localEpubUri: string,
  ) => {
    setBooks((current) =>
      current.map((book) => (
        book.id === bookId
          ? {
              ...book,
              downloaded: true,
              downloadedAt: download?.downloadedAt ?? book.downloadedAt ?? new Date().toISOString(),
              downloadUrl: download?.downloadUrl ?? book.downloadUrl ?? "",
              localEpubUri,
              readerLink: "",
              shelfLabel: "Downloaded",
            }
          : book
      )),
    );
  }, []);

  const updateBookProgress = useCallback((bookId: string, progress: LibraryBookProgress | null | undefined) => {
    if (!progress) return;
    setBooks((current) =>
      current.map((book) => (
        book.id === bookId
          ? {
              ...book,
              progress,
              rewardLabel: progress.rating ? `${progress.rating}/5 stars` : book.rewardLabel,
            }
          : book
      )),
    );
  }, []);

  const loadBooks = useCallback(async (queryOverride = submittedQuery) => {
    setIsLoading(true);
    setErrorMessage("");
    setLibraryActionMessage("");
    try {
      const result = await fetchLibraryBooks(user?.studentNumber, queryOverride);
      if (result.ok) {
        const mergedBooks = await mergeLocalEpubFiles(result.books ?? []);
        setBooks(mergedBooks);
      } else {
        setBooks([]);
        setErrorMessage(result.message ?? "Unable to load the library right now.");
      }
    } catch {
      setBooks([]);
      setErrorMessage("Unable to reach the library right now.");
    }
    setIsLoading(false);
  }, [mergeLocalEpubFiles, submittedQuery, user?.studentNumber]);

  useFocusEffect(
    useCallback(() => {
      void loadBooks();
    }, [loadBooks]),
  );

  const persistProgress = useCallback(
    async (book: LibraryBookRecord, currentPage: number, totalPages: number, status: "STARTED" | "FINISHED" = "STARTED") => {
      if (!user?.studentNumber) return;
      try {
        const result = await saveLibraryBookProgress({
          authors: book.author,
          bookId: book.id,
          bookTitle: book.title,
          currentPage,
          status,
          studentNumber: user.studentNumber,
          totalPages,
        });
        if (result.ok) {
          updateBookProgress(book.id, result.progress);
        }
      } catch {
        // Progress is best-effort; the reader should stay usable offline or during brief API failures.
      }
    },
    [updateBookProgress, user?.studentNumber],
  );

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/home");
  };

  const handleSearchSubmit = () => {
    const nextQuery = searchDraft.trim();
    setSubmittedQuery(nextQuery);
    if (nextQuery === submittedQuery) {
      void loadBooks(nextQuery);
    }
  };

  const handleClearSearch = () => {
    setSearchDraft("");
    setSubmittedQuery("");
    if (submittedQuery) {
      void loadBooks("");
    }
  };

  const handleDownloadBook = async (book: LibraryBookRecord) => {
    if (!user?.studentNumber) {
      setLibraryActionTone("error");
      setLibraryActionMessage("Log in first to download a book.");
      return;
    }
    if (!isEpubBook(book)) {
      setLibraryActionTone("error");
      setLibraryActionMessage("Only EPUB books can be read inside the app right now.");
      return;
    }

    setActiveDownloadBookId(book.id);
    setLibraryActionMessage("");
    try {
      const result = await downloadLibraryBook({
        authors: book.author,
        bookId: book.id,
        bookTitle: book.title,
        downloadUrl: book.downloadUrl,
        provider: book.provider,
        readerLink: book.readerLink,
        sourceId: book.sourceId,
        sourceReaderLink: book.sourceReaderLink,
        studentNumber: user.studentNumber,
      });

      if (!result.ok) {
        setLibraryActionTone("error");
        setLibraryActionMessage(result.message ?? "Unable to download this book.");
        return;
      }

      if (!result.download?.downloadUrl) {
        setLibraryActionTone("error");
        setLibraryActionMessage("The download service did not return an EPUB file link.");
        return;
      }

      const localEpubUri = await downloadEpubToLibrary(book.id, result.download.downloadUrl);
      await saveStoredEpubFile(user.studentNumber, book.id, localEpubUri, result.download.downloadedAt);

      updateBookDownload(book.id, result.download, localEpubUri);
      setLibraryActionTone("success");
      setLibraryActionMessage("EPUB downloaded. Reader mode is now unlocked.");
    } catch {
      setLibraryActionTone("error");
      setLibraryActionMessage("Unable to download and save this EPUB.");
    } finally {
      setActiveDownloadBookId(null);
    }
  };

  const handleOpenBook = async (bookId: string) => {
    const book = books.find((item) => item.id === bookId);
    if (!book) return;
    if (!isEpubBook(book)) {
      setLibraryActionTone("error");
      setLibraryActionMessage("Only EPUB books can be read inside the app right now.");
      return;
    }
    if (!book.localEpubUri) {
      setLibraryActionTone("error");
      setLibraryActionMessage("Download this EPUB to this device before opening the reader.");
      return;
    }

    setSelectedBookId(bookId);
    setReaderPages([]);
    setReaderPageIndex(0);
    setIsReaderLoading(true);
    setReaderErrorMessage("");
    setRatingErrorMessage("");
    try {
      const pages = await readEpubPagesFromFile(book.localEpubUri, book.title);
      const savedPage = book.progress?.currentPage ?? 0;
      const nextPage = Math.min(Math.max(savedPage, 0), Math.max(pages.length - 1, 0));
      setReaderPages(pages);
      setReaderPageIndex(nextPage);
      void persistProgress(book, nextPage, pages.length, book.progress?.status === "FINISHED" ? "FINISHED" : "STARTED");
    } catch {
      const fallbackPages = buildFallbackReaderPages(book);
      setReaderPages(fallbackPages);
      setReaderErrorMessage("This EPUB downloaded, but its text could not be fully extracted.");
    } finally {
      setIsReaderLoading(false);
    }
  };

  const handleCloseBook = () => {
    setSelectedBookId(null);
    setReaderPageIndex(0);
    setReaderPages([]);
    setReaderErrorMessage("");
    setIsReaderLoading(false);
    setRatingErrorMessage("");
  };

  const handleReaderPageChange = (nextPage: number) => {
    const boundedPage = Math.min(Math.max(nextPage, 0), Math.max(readerPages.length - 1, 0));
    setReaderPageIndex(boundedPage);
    if (selectedBook) {
      void persistProgress(
        selectedBook,
        boundedPage,
        readerPages.length,
        selectedBook.progress?.status === "FINISHED" ? "FINISHED" : "STARTED",
      );
    }
  };

  const handleFinishBook = () => {
    if (selectedBook) {
      void persistProgress(selectedBook, Math.max(readerPages.length - 1, 0), readerPages.length, "FINISHED");
    }
    handleCloseBook();
  };

  const handleRateBook = async (rating: number) => {
    if (!selectedBook || !user?.studentNumber) {
      setRatingErrorMessage("Log in first to save a rating.");
      return;
    }
    setRatingErrorMessage("");
    try {
      const result = await rateLibraryBook({
        authors: selectedBook.author,
        bookId: selectedBook.id,
        bookTitle: selectedBook.title,
        currentPage: readerPageIndex,
        rating,
        status: selectedBook.progress?.status === "FINISHED" ? "FINISHED" : "STARTED",
        studentNumber: user.studentNumber,
        totalPages: readerPages.length || 1,
      });
      if (result.ok) {
        updateBookProgress(selectedBook.id, result.progress);
      } else {
        setRatingErrorMessage(result.message ?? "Unable to save rating.");
      }
    } catch {
      setRatingErrorMessage("Unable to reach the library rating service.");
    }
  };

  const renderBookCard = (book: LibraryBookRecord) => {
    const isFinished = book.progress?.status === "FINISHED";
    const progressPercent = book.progress?.percent ?? 0;
    const supportsInAppReader = isEpubBook(book);
    const isDownloaded = Boolean(book.localEpubUri);
    const isDownloading = activeDownloadBookId === book.id;

    return (
      <Pressable key={book.id} style={[styles.bookCard, compact && styles.bookCardCompact]} onPress={() => void handleOpenBook(book.id)}>
        <View style={[styles.bookSpine, { backgroundColor: book.accentColor }]} />

        <View style={styles.bookCardTopRow}>
          <View style={styles.bookTag}>
            <Text style={styles.bookTagText}>{book.shelfLabel}</Text>
          </View>
          <Text style={[styles.bookStatusText, isFinished && styles.bookStatusTextDone, (!isDownloaded || !supportsInAppReader) && styles.bookStatusTextLocked]}>
            {isFinished ? "Finished" : isDownloaded ? "Ready to read" : supportsInAppReader ? "Download EPUB" : "EPUB only"}
          </Text>
        </View>

        <View style={[styles.bookCardBody, compact && styles.bookCardBodyStacked]}>
          <View
            style={[
              styles.bookCoverWrap,
              compact && styles.bookCoverWrapCompact,
              compact && styles.bookCoverWrapStacked,
              { backgroundColor: book.accentColor },
            ]}
          >
            <Image
              source={book.coverImageUrl ? { uri: book.coverImageUrl } : BOOK_COVER_IMAGE}
              style={styles.bookCoverImage}
              resizeMode="contain"
            />
          </View>

          <View style={styles.bookInfoWrap}>
            <Text style={styles.bookCategory}>{book.category}</Text>
            <Text style={[styles.bookTitle, compact && styles.bookTitleCompact]}>{book.title}</Text>
            <Text style={styles.bookAuthor}>{book.author}</Text>
            <Text style={styles.bookBlurb}>{book.blurb}</Text>

            <View style={styles.bookMetaRow}>
              <View style={styles.bookMetaPill}>
                <Ionicons name="time-outline" size={14} color="#6D675A" />
                <Text style={styles.bookMetaText}>{`${book.estimatedMinutes} min read`}</Text>
              </View>
              <View style={styles.bookMetaPill}>
                <Ionicons name="sparkles-outline" size={14} color="#6D675A" />
                <Text style={styles.bookMetaText}>{book.rewardLabel}</Text>
              </View>
              <View style={styles.bookMetaPill}>
                <Ionicons name={isDownloaded ? "cloud-done-outline" : "cloud-download-outline"} size={14} color="#6D675A" />
                <Text style={styles.bookMetaText}>{isDownloaded ? "Saved on device" : supportsInAppReader ? "EPUB" : "Unsupported format"}</Text>
              </View>
              {progressPercent > 0 ? (
                <View style={styles.bookMetaPill}>
                  <Ionicons name="bookmark-outline" size={14} color="#6D675A" />
                  <Text style={styles.bookMetaText}>{`${progressPercent}%`}</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.bookActionRow}>
              {isDownloaded ? (
                <Pressable style={styles.bookReadButton} onPress={() => void handleOpenBook(book.id)}>
                  <Ionicons name="book-outline" size={15} color="#FFFFFF" />
                  <Text style={styles.bookReadButtonText}>Read</Text>
                </Pressable>
              ) : (
                <Pressable
                  style={[styles.bookDownloadButton, (isDownloading || !supportsInAppReader) && styles.bookActionButtonDisabled]}
                  disabled={isDownloading || !supportsInAppReader}
                  onPress={() => void handleDownloadBook(book)}
                >
                  {isDownloading ? (
                    <ActivityIndicator size="small" color="#4D6243" />
                  ) : (
                    <Ionicons name="download-outline" size={15} color="#4D6243" />
                  )}
                  <Text style={styles.bookDownloadButtonText}>
                    {isDownloading ? "Downloading" : supportsInAppReader ? "Download EPUB" : "EPUB only"}
                  </Text>
                </Pressable>
              )}
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

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, compact && styles.scrollContentCompact]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.contentFrame}>
          <View style={[styles.heroCard, compact && styles.heroCardCompact]}>
            <View style={styles.heroGlowOne} />
            <View style={styles.heroGlowTwo} />

            <View style={[styles.heroHeaderRow, compact && styles.heroHeaderRowStacked]}>
              <View style={styles.heroTextWrap}>
                <Text style={styles.heroBadge}>Reading Room</Text>
                <Text style={[styles.heroTitle, compact && styles.heroTitleCompact]}>A warmer shelf for slow, comforting reading.</Text>
                <Text style={[styles.heroBody, compact && styles.heroBodyCompact]}>
                  Search EPUB books, save them to this device, and read them directly inside Bawat Tala.
                </Text>
              </View>

              <View style={[styles.heroBooksCluster, compact && styles.heroBooksClusterStacked]}>
                <View style={[styles.heroBookSpine, styles.heroBookSpineOne]} />
                <View style={[styles.heroBookSpine, styles.heroBookSpineTwo]} />
                <View style={[styles.heroBookSpine, styles.heroBookSpineThree]} />
              </View>
            </View>

            <View style={[styles.heroStatsRow, compact && styles.heroStatsRowWrap]}>
              <View style={[styles.heroStatPill, compact && styles.heroStatPillCompact]}>
                <Text style={styles.heroStatValue}>{books.length}</Text>
                <Text style={styles.heroStatLabel}>Books on shelf</Text>
              </View>
              <View style={[styles.heroStatPill, compact && styles.heroStatPillCompact]}>
                <Text style={styles.heroStatValue}>{downloadedCount}</Text>
                <Text style={styles.heroStatLabel}>Downloaded</Text>
              </View>
              <View style={[styles.heroStatPill, compact && styles.heroStatPillCompact]}>
                <Text style={styles.heroStatValue}>{waitingCount}</Text>
                <Text style={styles.heroStatLabel}>Need download</Text>
              </View>
            </View>
          </View>

          <View style={[styles.introCard, compact && styles.introCardCompact]}>
            <Text style={styles.introEyebrow}>Settle In</Text>
            <Text style={styles.introTitle}>Browse the shelf, then step into reader mode.</Text>
            <Text style={styles.introBody}>
              EPUB downloads stay in the app library on this device. Progress and ratings are still saved to your account.
            </Text>
          </View>

          <View style={[styles.searchCard, compact && styles.searchCardCompact]}>
            <View style={styles.searchInputWrap}>
              <Ionicons name="search-outline" size={18} color="#746B5E" />
              <TextInput
                value={searchDraft}
                onChangeText={setSearchDraft}
                onSubmitEditing={handleSearchSubmit}
                placeholder="Search title, author, ISBN"
                placeholderTextColor="#9A9184"
                returnKeyType="search"
                style={styles.searchInput}
              />
              {searchDraft.length ? (
                <Pressable style={styles.searchIconButton} accessibilityLabel="Clear search" onPress={handleClearSearch}>
                  <Ionicons name="close" size={17} color="#746B5E" />
                </Pressable>
              ) : null}
            </View>
            <Pressable style={styles.searchButton} onPress={handleSearchSubmit}>
              <Ionicons name="search" size={15} color="#FFFFFF" />
              <Text style={styles.searchButtonText}>Search</Text>
            </Pressable>
          </View>

          {!!libraryActionMessage && (
            <Text style={[styles.libraryActionMessage, libraryActionTone === "error" && styles.libraryActionMessageError]}>
              {libraryActionMessage}
            </Text>
          )}

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{submittedQuery ? "Search Results" : "Featured Shelf"}</Text>
            <Text style={styles.sectionSubTitle}>
              {submittedQuery ? `Showing EPUB matches for "${submittedQuery}".` : "Download an EPUB before reader mode opens."}
            </Text>
          </View>

          {isLoading ? (
            <View style={styles.loadingCard}>
              <ActivityIndicator color="#70C943" />
              <Text style={styles.loadingText}>Loading books...</Text>
            </View>
          ) : errorMessage ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>Library is unavailable</Text>
              <Text style={styles.emptyText}>{errorMessage}</Text>
              <Pressable style={styles.retryButton} onPress={() => void loadBooks()}>
                <Text style={styles.retryButtonText}>Try Again</Text>
              </Pressable>
            </View>
          ) : (
            books.length ? (
              <View style={styles.bookList}>
                {books.map(renderBookCard)}
              </View>
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No books found</Text>
                <Text style={styles.emptyText}>Try again in a moment. The configured catalog may be returning fewer results right now.</Text>
              </View>
            )
          )}
        </View>
      </ScrollView>

      <Modal visible={Boolean(selectedBook)} animationType="slide" onRequestClose={handleCloseBook}>
        <SafeAreaView style={styles.readerScreen}>
          <View style={styles.readerAuraOne} />
          <View style={styles.readerAuraTwo} />

          <View style={[styles.readerTopBar, compact && styles.readerTopBarCompact, narrow && styles.readerTopBarStacked]}>
            <Pressable style={styles.readerTopButton} accessibilityLabel="Close reader" onPress={handleCloseBook}>
              <Ionicons name="chevron-back" size={22} color="#534D43" />
            </Pressable>

            <View style={[styles.readerTopTextWrap, compact && styles.readerTopTextWrapCompact]}>
              <Text style={styles.readerTopEyebrow}>{selectedBook?.category ?? "Library"}</Text>
              <Text style={[styles.readerTopTitle, compact && styles.readerTopTitleCompact]} numberOfLines={1}>
                {selectedBook?.title ?? ""}
              </Text>
            </View>

            <View style={[styles.readerPageBadge, narrow && styles.readerPageBadgeStacked]}>
              <Text style={styles.readerPageBadgeText}>
                {isReaderLoading ? "..." : readerPages.length > 0 ? `${readerPageIndex + 1}/${readerPages.length}` : "0/0"}
              </Text>
            </View>
          </View>

          <View style={[styles.readerBookShell, compact && styles.readerBookShellCompact]}>
            <View style={[styles.readerSpineShadow, compact && styles.readerSpineShadowCompact]} />
            <View style={[styles.readerPageCard, compact && styles.readerPageCardCompact]}>
              <View style={[styles.readerPageInner, compact && styles.readerPageInnerCompact]}>
                {isReaderLoading ? (
                  <View style={styles.readerLoadingWrap}>
                    <ActivityIndicator color="#70C943" />
                    <Text style={styles.readerLoadingText}>Opening EPUB...</Text>
                  </View>
                ) : (
                  <>
                    {!!readerErrorMessage && <Text style={styles.readerInlineErrorText}>{readerErrorMessage}</Text>}
                    <Text style={styles.readerPageEyebrow}>{currentPage?.eyebrow ?? ""}</Text>
                    <Text style={[styles.readerPageTitle, compact && styles.readerPageTitleCompact]}>{currentPage?.title ?? ""}</Text>

                    <ScrollView style={styles.readerPageScroll} showsVerticalScrollIndicator={false}>
                      {currentPage?.paragraphs.map((paragraph, index) => (
                        <Text key={`${currentPage.title}-${index}`} style={[styles.readerPageBody, compact && styles.readerPageBodyCompact]}>
                          {paragraph}
                        </Text>
                      ))}
                    </ScrollView>

                    <Text style={styles.readerPageNumber}>
                      {readerPages.length > 0 ? `Page ${readerPageIndex + 1}` : ""}
                    </Text>
                  </>
                )}
              </View>
            </View>
          </View>

          <View style={styles.readerUtilityRow}>
            <View style={styles.ratingWrap}>
              <Text style={styles.ratingLabel}>Rate this book</Text>
              <View style={styles.ratingStars}>
                {STAR_VALUES.map((star) => (
                  <Pressable key={star} style={styles.ratingStarButton} onPress={() => void handleRateBook(star)}>
                    <Ionicons
                      name={star <= selectedBookRating ? "star" : "star-outline"}
                      size={20}
                      color={star <= selectedBookRating ? "#D7A52F" : "#A79D8B"}
                    />
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
          {!!ratingErrorMessage && <Text style={styles.ratingErrorText}>{ratingErrorMessage}</Text>}

          <View style={[styles.readerFooter, compact && styles.readerFooterStacked]}>
            <Pressable
              style={[styles.readerNavButton, compact && styles.readerFooterButtonFull, (!canGoPreviousPage || isReaderLoading) && styles.readerNavButtonDisabled]}
              disabled={!canGoPreviousPage || isReaderLoading}
              onPress={() => handleReaderPageChange(readerPageIndex - 1)}
            >
              <Ionicons name="arrow-back" size={16} color={canGoPreviousPage && !isReaderLoading ? "#524B42" : "#B1A796"} />
              <Text style={[styles.readerNavButtonText, (!canGoPreviousPage || isReaderLoading) && styles.readerNavButtonTextDisabled]}>Previous</Text>
            </Pressable>

            <Pressable
              style={[styles.readerPrimaryButton, compact && styles.readerFooterButtonFull, isReaderLoading && styles.readerPrimaryButtonDisabled]}
              disabled={isReaderLoading}
              onPress={() => {
                if (canGoNextPage) {
                  handleReaderPageChange(readerPageIndex + 1);
                  return;
                }

                handleFinishBook();
              }}
            >
              <Text style={styles.readerPrimaryButtonText}>
                {isReaderLoading ? "Opening" : canGoNextPage ? "Next page" : selectedBook?.progress?.status === "FINISHED" ? "Close book" : "Finish book"}
              </Text>
              <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
            </Pressable>
          </View>
        </SafeAreaView>
      </Modal>

      <HomeBottomNav activeTab="home" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F7F1E8",
  },
  topBar: {
    height: 52,
    borderBottomWidth: 1,
    borderBottomColor: "#E7DDD0",
    backgroundColor: "#FFFDF8",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    shadowColor: "#8C8272",
    shadowOpacity: 0.08,
    shadowRadius: 4,
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
    color: "#37475C",
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
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 92,
    alignItems: "center",
  },
  scrollContentCompact: {
    paddingHorizontal: 12,
  },
  contentFrame: {
    width: "100%",
    maxWidth: 420,
    alignSelf: "center",
  },
  heroCard: {
    width: "100%",
    borderRadius: 30,
    backgroundColor: "#EFE2CB",
    borderWidth: 1,
    borderColor: "#E2D1B7",
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 18,
    overflow: "hidden",
    marginBottom: 14,
  },
  heroCardCompact: {
    paddingHorizontal: 14,
    paddingTop: 16,
    paddingBottom: 16,
  },
  heroGlowOne: {
    position: "absolute",
    top: -34,
    right: -18,
    width: 162,
    height: 162,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.24)",
  },
  heroGlowTwo: {
    position: "absolute",
    left: -28,
    bottom: -54,
    width: 132,
    height: 132,
    borderRadius: 999,
    backgroundColor: "rgba(197, 220, 197, 0.24)",
  },
  heroHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    columnGap: 12,
    rowGap: 10,
  },
  heroHeaderRowStacked: {
    flexDirection: "column",
  },
  heroTextWrap: {
    flex: 1,
    paddingRight: 4,
  },
  heroBooksCluster: {
    width: 80,
    height: 102,
    justifyContent: "flex-end",
    alignItems: "center",
    alignSelf: "flex-end",
    marginTop: 2,
  },
  heroBooksClusterStacked: {
    alignSelf: "center",
    marginTop: 8,
  },
  heroBookSpine: {
    position: "absolute",
    bottom: 8,
    width: 20,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "rgba(82, 71, 54, 0.08)",
  },
  heroBookSpineOne: {
    left: 8,
    height: 66,
    backgroundColor: "#D8B07C",
  },
  heroBookSpineTwo: {
    left: 30,
    height: 56,
    backgroundColor: "#9EBE95",
  },
  heroBookSpineThree: {
    left: 52,
    height: 46,
    backgroundColor: "#D9A6A0",
  },
  heroBadge: {
    alignSelf: "flex-start",
    color: "#6F624F",
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  heroTitle: {
    color: "#35485B",
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "700",
    maxWidth: 280,
    marginBottom: 8,
  },
  heroTitleCompact: {
    fontSize: 24,
    lineHeight: 30,
    maxWidth: "100%",
  },
  heroBody: {
    color: "#665F54",
    fontSize: 14,
    lineHeight: 20,
    maxWidth: 286,
  },
  heroBodyCompact: {
    maxWidth: "100%",
  },
  heroStatsRow: {
    flexDirection: "row",
    columnGap: 8,
    marginTop: 16,
  },
  heroStatsRowWrap: {
    flexWrap: "wrap",
    rowGap: 8,
    justifyContent: "space-between",
  },
  heroStatPill: {
    flex: 1,
    minWidth: 92,
    borderRadius: 18,
    backgroundColor: "rgba(255,249,242,0.76)",
    borderWidth: 1,
    borderColor: "rgba(228, 214, 195, 0.88)",
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  heroStatPillCompact: {
    minWidth: "48%",
  },
  heroStatValue: {
    color: "#394B5A",
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "700",
    marginBottom: 2,
  },
  heroStatLabel: {
    color: "#776D61",
    fontSize: 11,
    lineHeight: 14,
  },
  introCard: {
    width: "100%",
    borderRadius: 24,
    backgroundColor: "#FFFDF8",
    borderWidth: 1,
    borderColor: "#E7DDD0",
    paddingHorizontal: 15,
    paddingTop: 14,
    paddingBottom: 14,
    marginBottom: 14,
    shadowColor: "#8A7E6F",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  introCardCompact: {
    paddingHorizontal: 13,
    paddingTop: 13,
    paddingBottom: 13,
  },
  introEyebrow: {
    color: "#7D715F",
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  introTitle: {
    color: "#35485B",
    fontSize: 18,
    lineHeight: 23,
    fontWeight: "700",
    marginBottom: 6,
  },
  introBody: {
    color: "#6A645A",
    fontSize: 13,
    lineHeight: 19,
  },
  searchCard: {
    width: "100%",
    borderRadius: 22,
    backgroundColor: "#FFFDF8",
    borderWidth: 1,
    borderColor: "#E7DDD0",
    padding: 10,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    columnGap: 8,
  },
  searchCardCompact: {
    flexDirection: "column",
    alignItems: "stretch",
    rowGap: 8,
  },
  searchInputWrap: {
    flex: 1,
    minHeight: 44,
    borderRadius: 16,
    backgroundColor: "#F7F2E8",
    borderWidth: 1,
    borderColor: "#E9DED0",
    flexDirection: "row",
    alignItems: "center",
    columnGap: 8,
    paddingLeft: 12,
    paddingRight: 6,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    color: "#4B453C",
    fontSize: 14,
    lineHeight: 19,
    paddingVertical: 8,
  },
  searchIconButton: {
    width: 32,
    height: 32,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  searchButton: {
    minHeight: 44,
    borderRadius: 16,
    backgroundColor: "#70C943",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    columnGap: 6,
    paddingHorizontal: 14,
  },
  searchButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
  },
  libraryActionMessage: {
    color: "#4F7E3E",
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700",
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  libraryActionMessageError: {
    color: "#9B4B3D",
  },
  sectionHeader: {
    width: "100%",
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  sectionTitle: {
    color: "#35485B",
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "700",
    marginBottom: 2,
  },
  sectionSubTitle: {
    color: "#726A5E",
    fontSize: 13,
    lineHeight: 18,
  },
  bookList: {
    width: "100%",
    rowGap: 12,
  },
  loadingCard: {
    width: "100%",
    borderRadius: 20,
    backgroundColor: "#FFFDF8",
    borderWidth: 1,
    borderColor: "#E7DDD0",
    paddingHorizontal: 18,
    paddingVertical: 24,
    alignItems: "center",
    rowGap: 10,
  },
  loadingText: {
    color: "#6A645A",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },
  emptyCard: {
    width: "100%",
    borderRadius: 20,
    backgroundColor: "#FFFDF8",
    borderWidth: 1,
    borderColor: "#E7DDD0",
    paddingHorizontal: 18,
    paddingVertical: 22,
    alignItems: "center",
  },
  emptyTitle: {
    color: "#35485B",
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "700",
    marginBottom: 6,
    textAlign: "center",
  },
  emptyText: {
    color: "#665F54",
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
  },
  retryButton: {
    marginTop: 14,
    minHeight: 40,
    borderRadius: 999,
    backgroundColor: "#70C943",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  retryButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
  },
  bookCard: {
    width: "100%",
    borderRadius: 24,
    backgroundColor: "#FFFDF8",
    borderWidth: 1,
    borderColor: "#E7DDD0",
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 14,
    overflow: "hidden",
    shadowColor: "#8A7E6F",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  bookCardCompact: {
    paddingHorizontal: 12,
    paddingTop: 13,
    paddingBottom: 13,
  },
  bookSpine: {
    position: "absolute",
    top: 14,
    bottom: 14,
    left: 0,
    width: 10,
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
  },
  bookCardTopRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    columnGap: 8,
    rowGap: 6,
    marginBottom: 12,
    marginLeft: 4,
  },
  bookTag: {
    borderRadius: 999,
    backgroundColor: "#F7F2E8",
    borderWidth: 1,
    borderColor: "#E9DED0",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  bookTagText: {
    color: "#746B5E",
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "700",
  },
  bookStatusText: {
    color: "#5C655B",
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "700",
  },
  bookStatusTextDone: {
    color: "#5C8A4A",
  },
  bookStatusTextLocked: {
    color: "#9A6B42",
  },
  bookCardBody: {
    flexDirection: "row",
    alignItems: "flex-start",
    columnGap: 12,
  },
  bookCardBodyStacked: {
    flexDirection: "column",
    rowGap: 8,
  },
  bookCoverWrap: {
    width: 92,
    height: 118,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    padding: 10,
  },
  bookCoverWrapCompact: {
    width: 100,
    height: 108,
    borderRadius: 20,
  },
  bookCoverWrapStacked: {
    alignSelf: "center",
    marginBottom: 2,
  },
  bookCoverImage: {
    width: 64,
    height: 82,
  },
  bookInfoWrap: {
    flex: 1,
    minWidth: 0,
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
    color: "#35485B",
    fontSize: 19,
    lineHeight: 24,
    fontWeight: "700",
    marginBottom: 2,
  },
  bookTitleCompact: {
    fontSize: 18,
    lineHeight: 23,
  },
  bookAuthor: {
    color: "#81776A",
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 7,
  },
  bookBlurb: {
    color: "#5D564D",
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
    backgroundColor: "#F7F2E8",
    borderWidth: 1,
    borderColor: "#E9DED0",
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  bookMetaText: {
    color: "#6D675A",
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "600",
  },
  bookActionRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 12,
  },
  bookReadButton: {
    minHeight: 38,
    borderRadius: 999,
    backgroundColor: "#70C943",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    columnGap: 6,
    paddingHorizontal: 15,
  },
  bookReadButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
  },
  bookDownloadButton: {
    minHeight: 38,
    borderRadius: 999,
    backgroundColor: "#E9F4DE",
    borderWidth: 1,
    borderColor: "#CAE3B5",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    columnGap: 6,
    paddingHorizontal: 15,
  },
  bookActionButtonDisabled: {
    opacity: 0.68,
  },
  bookDownloadButtonText: {
    color: "#4D6243",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
  },
  readerScreen: {
    flex: 1,
    backgroundColor: "#EDE3D3",
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 20,
  },
  readerAuraOne: {
    position: "absolute",
    top: -34,
    right: -18,
    width: 188,
    height: 188,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.26)",
  },
  readerAuraTwo: {
    position: "absolute",
    left: -36,
    bottom: 120,
    width: 164,
    height: 164,
    borderRadius: 999,
    backgroundColor: "rgba(193, 213, 191, 0.28)",
  },
  readerTopBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    columnGap: 10,
    marginBottom: 14,
  },
  readerTopBarCompact: {
    columnGap: 8,
  },
  readerTopBarStacked: {
    flexDirection: "column",
    alignItems: "stretch",
    rowGap: 10,
  },
  readerTopButton: {
    width: 38,
    height: 38,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.55)",
    borderWidth: 1,
    borderColor: "rgba(219, 203, 180, 0.9)",
    alignItems: "center",
    justifyContent: "center",
  },
  readerTopTextWrap: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    paddingHorizontal: 6,
  },
  readerTopTextWrapCompact: {
    paddingHorizontal: 2,
  },
  readerTopEyebrow: {
    color: "#7B6F5F",
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  readerTopTitle: {
    color: "#4A4439",
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "700",
  },
  readerTopTitleCompact: {
    fontSize: 14,
    lineHeight: 18,
  },
  readerPageBadge: {
    minWidth: 48,
    height: 38,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.55)",
    borderWidth: 1,
    borderColor: "rgba(219, 203, 180, 0.9)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    alignSelf: "center",
  },
  readerPageBadgeStacked: {
    alignSelf: "flex-start",
  },
  readerPageBadgeText: {
    color: "#61584A",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
  },
  readerBookShell: {
    flex: 1,
    position: "relative",
    marginBottom: 14,
    width: "100%",
  },
  readerBookShellCompact: {
    marginBottom: 12,
  },
  readerSpineShadow: {
    position: "absolute",
    top: 22,
    bottom: 22,
    left: 2,
    width: 24,
    borderTopLeftRadius: 22,
    borderBottomLeftRadius: 22,
    backgroundColor: "#D1BEA3",
  },
  readerSpineShadowCompact: {
    top: 16,
    bottom: 16,
    width: 20,
  },
  readerPageCard: {
    flex: 1,
    borderRadius: 30,
    backgroundColor: "#FFF9EF",
    borderWidth: 1,
    borderColor: "#E1D3BE",
    shadowColor: "#7D6D5A",
    shadowOpacity: 0.14,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 5,
    marginLeft: 12,
    alignSelf: "stretch",
  },
  readerPageCardCompact: {
    marginLeft: 8,
  },
  readerPageInner: {
    flex: 1,
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 18,
  },
  readerPageInnerCompact: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 14,
  },
  readerLoadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    rowGap: 10,
  },
  readerLoadingText: {
    color: "#6A645A",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
  },
  readerInlineErrorText: {
    color: "#9B4B3D",
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700",
    marginBottom: 10,
  },
  readerPageEyebrow: {
    color: "#877B68",
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  readerPageTitle: {
    color: "#4E4539",
    fontFamily: "serif",
    fontSize: 30,
    lineHeight: 36,
    marginBottom: 18,
  },
  readerPageTitleCompact: {
    fontSize: 24,
    lineHeight: 30,
    marginBottom: 14,
  },
  readerPageScroll: {
    flex: 1,
  },
  readerPageBody: {
    color: "#534B41",
    fontFamily: "serif",
    fontSize: 18,
    lineHeight: 31,
    marginBottom: 16,
  },
  readerPageBodyCompact: {
    fontSize: 16,
    lineHeight: 27,
    marginBottom: 14,
  },
  readerPageNumber: {
    alignSelf: "center",
    color: "#9A8C78",
    fontSize: 12,
    lineHeight: 16,
    marginTop: 8,
  },
  readerUtilityRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    columnGap: 10,
    rowGap: 8,
    marginBottom: 10,
    flexWrap: "wrap",
  },
  ratingWrap: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 8,
    flexShrink: 1,
  },
  ratingLabel: {
    color: "#665D50",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
  },
  ratingStars: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 2,
  },
  ratingStarButton: {
    width: 26,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  openReaderButton: {
    minHeight: 34,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.62)",
    borderWidth: 1,
    borderColor: "#DECDB7",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    columnGap: 6,
    paddingHorizontal: 12,
  },
  openReaderText: {
    color: "#524B42",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
  },
  ratingErrorText: {
    color: "#B85C5C",
    fontSize: 12,
    lineHeight: 16,
    textAlign: "center",
    marginBottom: 8,
  },
  readerFooter: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 10,
  },
  readerFooterStacked: {
    flexDirection: "column-reverse",
    alignItems: "stretch",
    rowGap: 8,
  },
  readerFooterButtonFull: {
    width: "100%",
  },
  readerNavButton: {
    minWidth: 0,
    minHeight: 46,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.62)",
    borderWidth: 1,
    borderColor: "#DECDB7",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    columnGap: 8,
    paddingHorizontal: 14,
  },
  readerNavButtonDisabled: {
    backgroundColor: "rgba(247, 239, 227, 0.6)",
  },
  readerNavButtonText: {
    color: "#524B42",
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "700",
  },
  readerNavButtonTextDisabled: {
    color: "#B1A796",
  },
  readerPrimaryButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 999,
    backgroundColor: "#70C943",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    columnGap: 8,
    paddingHorizontal: 16,
  },
  readerPrimaryButtonDisabled: {
    opacity: 0.68,
  },
  readerPrimaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "700",
  },
});
