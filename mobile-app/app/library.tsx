import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, Linking, Modal, Pressable, ScrollView,
  RefreshControl, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, G } from "react-native-svg";
import { AppleTopBar } from "../components/ui/AppleTopBar";
import { useAuthSession } from "../lib/auth-session";
import {
  claimLibraryReadingReward,
  downloadLibraryBook,
  fetchLibraryBooks,
  fetchLibraryMyShelf,
  fetchLibraryReadingRewardStatus,
  rateLibraryBook,
  removeLibraryBookFromShelf,
  saveLibraryBookProgress,
  type LibraryBookProgress,
  type LibraryBookRecord,
  type ReadingAchievementReward } from "../lib/backend-api";
import { BUILT_IN_LIBRARY_BOOK_IDS, BUILT_IN_LIBRARY_BOOKS } from "../lib/builtin-library-books";
import { getPaginationPageNumbers, paginateBooks } from "../lib/library-filter";
import { LIBRARY_MATCHA, matchaAccentFor, titleInitial } from "../lib/library-theme";
import {
  deleteCachedEpubFile,
  downloadEpubToLibrary,
  localFileExists,
  readEpubCoverUriFromFile,
  readEpubPagesFromFile,
  resolveBundledEpubUri,
  type EpubReaderPage as ReaderPage } from "../lib/epub-reader";

const TALA_IMAGE = require("../assets/images/Tala_Star.png");
const STAR_VALUES = [1, 2, 3, 4, 5];
const READING_REWARD_RING_RADIUS = 16;
const READING_REWARD_RING_SIZE = 42;
const READING_REWARD_RING_STROKE = 3;
const READING_REWARD_RING_CIRCUMFERENCE = 2 * Math.PI * READING_REWARD_RING_RADIUS;
const READING_ACHIEVEMENT_FALLBACKS: ReadingAchievementReward[] = [
  {
    key: "read_5_minutes",
    seconds: 5 * 60,
    rewardTala: 20,
    title: "Steady Reader",
    description: "Read for 5 minutes",
    durationLabel: "5 minutes" },
  {
    key: "read_15_minutes",
    seconds: 15 * 60,
    rewardTala: 35,
    title: "Quiet Chapter",
    description: "Read for 15 minutes",
    durationLabel: "15 minutes" },
  {
    key: "read_30_minutes",
    seconds: 30 * 60,
    rewardTala: 50,
    title: "Deep Reader",
    description: "Read for 30 minutes",
    durationLabel: "30 minutes" },
  {
    key: "read_1_hour",
    seconds: 60 * 60,
    rewardTala: 80,
    title: "Library Glow",
    description: "Read for 1 hour",
    durationLabel: "1 hour" },
];
const FIRST_READING_ACHIEVEMENT = READING_ACHIEVEMENT_FALLBACKS[0];

function formatReadingGoal(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 60 * 60) return `${Math.round(seconds / 60)}m`;
  return `${Math.round(seconds / 3600)}h`;
}

function getFallbackAchievementAfter(currentKey: string) {
  const index = READING_ACHIEVEMENT_FALLBACKS.findIndex((achievement) => achievement.key === currentKey);
  return index >= 0 ? READING_ACHIEVEMENT_FALLBACKS[index + 1] ?? null : FIRST_READING_ACHIEVEMENT;
}

type ShelfTab = "featured" | "my";

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

async function removeStoredEpubFile(studentNumber: string | undefined, bookId: string) {
  const storedFiles = await getStoredEpubFiles(studentNumber);
  const storedFile = storedFiles[bookId];
  if (storedFile?.uri) {
    await deleteCachedEpubFile(storedFile.uri).catch(() => undefined);
  }
  delete storedFiles[bookId];
  await AsyncStorage.setItem(getStoredEpubFilesKey(studentNumber), JSON.stringify(storedFiles));
}

function isEpubBook(book: LibraryBookRecord) {
  return Boolean(book.downloadableEpub || book.supportsInAppReader);
}

function isBookReadyInApp(book: LibraryBookRecord) {
  return Boolean(book.localEpubUri || book.bundledEpubAsset || book.downloaded);
}

function isBuiltInBook(book: LibraryBookRecord) {
  return book.provider === "builtin" || book.id.startsWith("builtin-");
}

function getExternalReaderUrl(book: LibraryBookRecord) {
  return book.externalReaderLink || book.sourceReaderLink || book.previewLink || book.infoLink || "";
}

/** Prefer FS catalog keys. borrowable != downloadableEpub; openLibraryBorrow = OL lendable. */
function isFsPreviewOnly(book: LibraryBookRecord) {
  if (book.previewOnly === true) return true;
  if (book.borrowStatus === "preview_only") return true;
  if (book.actionLabel === "Preview only") return true;
  return book.accessType === "preview" || book.accessType === "catalog";
}

/** In-app free EPUB download (FS borrowStatus downloadable / downloadableEpub). */
function canDownloadEpubInApp(book: LibraryBookRecord) {
  if (isBookReadyInApp(book) || isBuiltInBook(book)) return false;
  if (book.borrowStatus === "downloadable") return true;
  if (book.borrowStatus === "open_library_borrow" || book.borrowStatus === "preview_only" || book.borrowStatus === "unavailable") {
    return false;
  }
  if (book.actionLabel === "Download EPUB") return true;
  if (book.actionLabel === "Borrow on Open Library" || book.actionLabel === "Preview only" || book.actionLabel === "Not borrowable") {
    return false;
  }
  if (typeof book.downloadableEpub === "boolean") return book.downloadableEpub;
  return Boolean(book.supportsInAppReader && book.downloadableEpub !== false);
}

/** Open Library lendable borrow (e.g. 7 Habits) â€” opens OL, not in-app EPUB. */
function isOpenLibraryBorrow(book: LibraryBookRecord) {
  if (isBookReadyInApp(book) || isBuiltInBook(book) || canDownloadEpubInApp(book)) return false;
  if (book.openLibraryBorrow === true) return true;
  if (book.borrowStatus === "open_library_borrow") return true;
  if (book.actionLabel === "Borrow on Open Library") return Boolean(getExternalReaderUrl(book));
  if (book.actionLabel === "Download EPUB" || book.actionLabel === "Preview only" || book.actionLabel === "Not borrowable") {
    return false;
  }
  if (isFsPreviewOnly(book) || book.borrowStatus === "unavailable") return false;
  return false;
}

/** Broad borrowable flag from FS (in-app EPUB OR OL lendable). */
function isFsBorrowable(book: LibraryBookRecord) {
  if (isBookReadyInApp(book) || isBuiltInBook(book)) return true;
  if (canDownloadEpubInApp(book) || isOpenLibraryBorrow(book)) return true;
  if (typeof book.borrowable === "boolean") return book.borrowable;
  if (book.borrowStatus === "downloadable" || book.borrowStatus === "open_library_borrow" || book.borrowStatus === "borrowable") {
    return true;
  }
  if (book.borrowStatus === "preview_only" || book.borrowStatus === "unavailable") return false;
  if (book.actionLabel === "Download EPUB" || book.actionLabel === "Borrow on Open Library") return true;
  if (book.actionLabel === "Preview only" || book.actionLabel === "Not borrowable") return false;
  return false;
}

function getBookActionLabel(book: LibraryBookRecord) {
  if (isBookReadyInApp(book) || isBuiltInBook(book)) return "Read";
  const fsLabel = String(book.actionLabel || "").trim();
  if (
    fsLabel === "Download EPUB" ||
    fsLabel === "Borrow on Open Library" ||
    fsLabel === "Preview only" ||
    fsLabel === "Not borrowable"
  ) {
    return fsLabel;
  }
  if (book.borrowStatus === "downloadable" || canDownloadEpubInApp(book)) return "Download EPUB";
  if (book.borrowStatus === "open_library_borrow" || isOpenLibraryBorrow(book)) return "Borrow on Open Library";
  if (book.borrowStatus === "preview_only" || isFsPreviewOnly(book)) return "Preview only";
  if (book.borrowStatus === "unavailable") return "Not borrowable";
  if (book.borrowStatusLabel) return book.borrowStatusLabel;
  if (!isFsBorrowable(book)) return "Preview only";
  return getExternalReaderUrl(book) ? "Borrow on Open Library" : "Preview only";
}

function isPreviewOrCatalogOnly(book: LibraryBookRecord) {
  return isFsPreviewOnly(book) || getBookActionLabel(book) === "Preview only";
}

function isNotBorrowable(book: LibraryBookRecord) {
  if (isBookReadyInApp(book) || isBuiltInBook(book)) return false;
  if (canDownloadEpubInApp(book) || isOpenLibraryBorrow(book)) return false;
  if (book.actionLabel === "Not borrowable" || book.borrowStatus === "unavailable") return true;
  return !isFsBorrowable(book);
}

function getAccessHelperText(book: LibraryBookRecord) {
  if (isBookReadyInApp(book)) return "";
  if (canDownloadEpubInApp(book) || book.actionLabel === "Download EPUB" || book.borrowStatus === "downloadable") {
    return "Free EPUB - save it to read offline in Bawat Tala.";
  }
  if (isOpenLibraryBorrow(book) || book.actionLabel === "Borrow on Open Library" || book.borrowStatus === "open_library_borrow") {
    return "";
  }
  if (book.borrowStatusLabel && isFsPreviewOnly(book)) {
    return `${book.borrowStatusLabel} - preview/catalog only, not downloadable in-app.`;
  }
  if (isFsPreviewOnly(book) || book.actionLabel === "Preview only") {
    return "Catalog preview only - this title is not downloadable in Bawat Tala.";
  }
  if (book.borrowStatus === "unavailable" || book.actionLabel === "Not borrowable") {
    return "Not borrowable - no in-app EPUB or Open Library borrow is available.";
  }
  if (getExternalReaderUrl(book)) return "Opens on Open Library in your browser.";
  return "This title cannot be borrowed or downloaded right now.";
}

function getProgressRewardLabel(book: LibraryBookRecord, progress: LibraryBookProgress | null | undefined) {
  if (progress?.rating) return `${progress.rating}/5 stars`;
  return book.rewardLabel || "Rate after reading";
}

function applyProgressToBook(book: LibraryBookRecord, progress: LibraryBookProgress | null | undefined) {
  if (!progress) return book;
  return {
    ...book,
    progress,
    rewardLabel: getProgressRewardLabel(book, progress) };
}

function buildBuiltInShelfBooks(
  progressByBookId: Record<string, LibraryBookProgress | null> = {},
  coverUrlsByBookId: Record<string, string> = {},
) {
  return BUILT_IN_LIBRARY_BOOKS.map((book) =>
    applyProgressToBook(
      {
        ...book,
        coverImageUrl: coverUrlsByBookId[book.id] || book.coverImageUrl },
      progressByBookId[book.id],
    ),
  );
}

function filterBooksByQuery(books: LibraryBookRecord[], query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return books;

  return books.filter((book) =>
    [book.title, book.author, book.category, book.shelfLabel]
      .some((value) => String(value || "").toLowerCase().includes(normalizedQuery)),
  );
}

function normalizeBookIdentity(value: string | undefined) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function getBookIdentityKeys(book: LibraryBookRecord) {
  return [
    book.id ? `id:${book.id}` : "",
    book.sourceId ? `source:${book.sourceId}` : "",
    book.title ? `title:${normalizeBookIdentity(book.title)}:${normalizeBookIdentity(book.author)}` : "",
  ].filter(Boolean);
}

function findShelfMatch(shelfBooks: LibraryBookRecord[], book: LibraryBookRecord) {
  const keys = new Set(getBookIdentityKeys(book));
  return shelfBooks.find((shelfBook) => getBookIdentityKeys(shelfBook).some((key) => keys.has(key))) ?? null;
}

function sortBooksByMostRecent(books: LibraryBookRecord[]): LibraryBookRecord[] {
  return [...books].sort((a, b) => {
    const timeA = new Date(a.progress?.updatedAt || a.progress?.lastOpenedAt || 0).getTime();
    const timeB = new Date(b.progress?.updatedAt || b.progress?.lastOpenedAt || 0).getTime();
    if (timeA !== timeB) {
      return timeB - timeA;
    }
    const pageA = a.progress?.currentPage || 0;
    const pageB = b.progress?.currentPage || 0;
    if (pageA !== pageB) {
      return pageB - pageA;
    }
    return 0;
  });
}

function dedupeLibraryBooks(books: LibraryBookRecord[]) {
  const seen = new Set<string>();
  const uniqueBooks: LibraryBookRecord[] = [];

  books.forEach((book) => {
    const keys = getBookIdentityKeys(book);
    const duplicate = keys.some((key) => seen.has(key));
    if (duplicate) return;

    keys.forEach((key) => seen.add(key));
    uniqueBooks.push(book);
  });

  return uniqueBooks;
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
      paragraphs: [book.blurb || "A mental-health and wellbeing read from the library catalog."] },
    {
      eyebrow: "Book Details",
      title: "About this book",
      paragraphs: detailLines.length ? detailLines : ["The library catalog did not provide extra details for this title."] },
    {
      eyebrow: "Reading Access",
      title: "Continue in the reader",
      paragraphs: [
        "This EPUB could not be fully parsed, but your download is saved in the app. Try another EPUB result if the text does not appear correctly.",
      ] },
  ];
}

const LIBRARY_SEARCH_MAX_LENGTH = 120;

function AppleBookCard({
  children,
  onPress,
  compact,
}: {
  children: React.ReactNode;
  onPress: () => void;
  compact: boolean;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.985,
      friction: 8,
      tension: 300,
      useNativeDriver: true,
    }).start();
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      friction: 6,
      tension: 220,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View style={[{ transform: [{ scale }] }, styles.bookCardWrap]}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[styles.bookCard, compact && styles.bookCardCompact]}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

export default function LibraryScreen() {
  const { user } = useAuthSession();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const compact = width < 390;
  const narrow = width < 360;
  const [books, setBooks] = useState<LibraryBookRecord[]>([]);
  const [myShelfBooks, setMyShelfBooks] = useState<LibraryBookRecord[]>(() => buildBuiltInShelfBooks());
  const [builtInCoverUrls, setBuiltInCoverUrls] = useState<Record<string, string>>({});
  const [activeShelf, setActiveShelf] = useState<ShelfTab>("featured");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isMyShelfLoading, setIsMyShelfLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [myShelfErrorMessage, setMyShelfErrorMessage] = useState("");
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const [readerPageIndex, setReaderPageIndex] = useState(0);
  const [readerTheme, setReaderTheme] = useState<"warm" | "clean" | "night">("warm");
  const [readerFontSize, setReaderFontSize] = useState<number>(18);
  const pageTurnAnim = useRef(new Animated.Value(1)).current;
  const [readerPages, setReaderPages] = useState<ReaderPage[]>([]);
  const [isReaderLoading, setIsReaderLoading] = useState(false);
  const [readerErrorMessage, setReaderErrorMessage] = useState("");
  const [ratingErrorMessage, setRatingErrorMessage] = useState("");
  const [showReaderExitModal, setShowReaderExitModal] = useState(false);
  const [readingRewardSeconds, setReadingRewardSeconds] = useState(0);
  const [nextReadingAchievement, setNextReadingAchievement] = useState<ReadingAchievementReward | null>(FIRST_READING_ACHIEVEMENT);
  const [claimedReadingAchievement, setClaimedReadingAchievement] = useState<ReadingAchievementReward | null>(null);
  const [isClaimingReadingReward, setIsClaimingReadingReward] = useState(false);
  const [showReadingRewardModal, setShowReadingRewardModal] = useState(false);
  const [readingRewardMessage, setReadingRewardMessage] = useState("");
  const [bookPendingRemoval, setBookPendingRemoval] = useState<LibraryBookRecord | null>(null);
  const [isRemovingBook, setIsRemovingBook] = useState(false);
  const [shelfTabsWidth, setShelfTabsWidth] = useState(0);
  const slideAnim = useRef(new Animated.Value(activeShelf === "featured" ? 0 : 1)).current;
  const tabWidth = shelfTabsWidth > 0 ? (shelfTabsWidth - 8) / 2 : 0;
  const [featuredPage, setFeaturedPage] = useState(1);
  const [searchDraft, setSearchDraft] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [activeDownloadBookId, setActiveDownloadBookId] = useState<string | null>(null);
  const [libraryActionMessage, setLibraryActionMessage] = useState("");
  const [libraryActionTone, setLibraryActionTone] = useState<"error" | "success">("success");
  const readingRewardClaimRef = useRef(false);
  const readerScrollRef = useRef<ScrollView>(null);

  const allKnownBooks = useMemo(() => [...myShelfBooks, ...books], [books, myShelfBooks]);
  const selectedBook = useMemo(
    () => allKnownBooks.find((book) => book.id === selectedBookId) ?? null,
    [allKnownBooks, selectedBookId],
  );
  const featuredBooks = useMemo(() => dedupeLibraryBooks(books), [books]);
  const paginatedFeatured = useMemo(() => {
    return paginateBooks(featuredBooks, featuredPage, 10);
  }, [featuredBooks, featuredPage]);

  const displayedBooks = useMemo(() => {
    if (activeShelf === "my") {
      const filtered = filterBooksByQuery(myShelfBooks, submittedQuery);
      return sortBooksByMostRecent(filtered);
    }
    return paginatedFeatured.items;
  }, [activeShelf, myShelfBooks, submittedQuery, paginatedFeatured.items]);
  const displayedIsLoading = activeShelf === "my" ? isMyShelfLoading : isLoading;
  const displayedErrorMessage = activeShelf === "my" ? (myShelfBooks.length ? "" : myShelfErrorMessage) : errorMessage;
  const downloadedCount = myShelfBooks.length;
  const onlineCount = books.filter((book) => !isEpubBook(book) && getExternalReaderUrl(book)).length;
  const readingRewardTargetSeconds = nextReadingAchievement?.seconds ?? 0;
  const readingRewardProgress = readingRewardTargetSeconds > 0 ? Math.min(readingRewardSeconds / readingRewardTargetSeconds, 1) : 0;
  const readingRewardStrokeOffset = READING_REWARD_RING_CIRCUMFERENCE * (1 - readingRewardProgress);
  const readingRewardGoalLabel = nextReadingAchievement ? formatReadingGoal(nextReadingAchievement.seconds) : "";
  const readingRewardLeaveProgressLabel =
    nextReadingAchievement && readingRewardTargetSeconds > 0
      ? `${Math.min(readingRewardSeconds, readingRewardTargetSeconds)}s of ${nextReadingAchievement.durationLabel}`
      : "your current reading progress";
  const readingRewardLeaveMessage = nextReadingAchievement
    ? `If you leave now, ${readingRewardLeaveProgressLabel} will stop and will not count toward "${nextReadingAchievement.title}". Keep reading to finish this achievement.`
    : "If you leave now, your current reading progress will stop.";

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
        exists: await localFileExists(file.uri).catch(() => false) })),
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
        shelfLabel: "Downloaded" };
    });
  }, [user?.studentNumber]);

  const updateBookDownload = useCallback((
    bookId: string,
    download: { downloadedAt?: string | null; downloadUrl?: string } | null | undefined,
    localEpubUri: string,
  ) => {
    const applyDownload = (current: LibraryBookRecord[]) =>
      current.map((book) => (
        book.id === bookId
          ? {
              ...book,
              downloaded: true,
              downloadedAt: download?.downloadedAt ?? book.downloadedAt ?? new Date().toISOString(),
              downloadUrl: download?.downloadUrl ?? book.downloadUrl ?? "",
              localEpubUri,
              readerLink: "",
              shelfLabel: "Downloaded" }
          : book
      ));

    setBooks(applyDownload);
    setMyShelfBooks(applyDownload);
  }, []);

  const updateBookLocalUri = useCallback((bookId: string, localEpubUri: string) => {
    const applyLocalUri = (current: LibraryBookRecord[]) =>
      current.map((book) => (
        book.id === bookId
          ? {
              ...book,
              downloaded: true,
              localEpubUri }
          : book
      ));

    setBooks(applyLocalUri);
    setMyShelfBooks(applyLocalUri);
  }, []);

  const updateBookCover = useCallback((bookId: string, coverImageUrl: string) => {
    if (!coverImageUrl) return;
    const applyCover = (current: LibraryBookRecord[]) =>
      current.map((book) => (
        book.id === bookId ? { ...book, coverImageUrl } : book
      ));

    setBooks(applyCover);
    setMyShelfBooks(applyCover);
  }, []);

  const updateBookProgress = useCallback((bookId: string, progress: LibraryBookProgress | null | undefined) => {
    if (!progress) return;
    const applyProgress = (current: LibraryBookRecord[]) =>
      current.map((book) => (
        book.id === bookId ? applyProgressToBook(book, progress) : book
      ));

    setBooks(applyProgress);
    setMyShelfBooks(applyProgress);
  }, []);

  const loadBooks = useCallback(async (queryOverride = "") => {
    setIsLoading(true);
    setErrorMessage("");
    setLibraryActionMessage("");
    try {
      const result = await fetchLibraryBooks(queryOverride);
      if (result.ok) {
        const mergedBooks = await mergeLocalEpubFiles(result.books ?? []);
        setBooks(dedupeLibraryBooks(mergedBooks));
      } else {
        // Keep last successful catalog so a slow/flake Open Library response
        // does not flash "unreachable" after books already loaded.
        setBooks((prev) => {
          if (prev.length > 0) {
            setLibraryActionMessage(result.message ?? "Catalog refresh failed. Showing your last loaded books.");
            return prev;
          }
          setErrorMessage(result.message ?? "Unable to load the library right now.");
          return [];
        });
      }
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : "Unable to reach the library right now.";
      setBooks((prev) => {
        if (prev.length > 0) {
          setLibraryActionMessage(message);
          return prev;
        }
        setErrorMessage(message);
        return [];
      });
    }
    setIsLoading(false);
  }, [mergeLocalEpubFiles, user?.studentNumber]);

  const loadMyShelf = useCallback(async () => {
    setIsMyShelfLoading(true);
    setMyShelfErrorMessage("");
    try {
      if (!user?.studentNumber) {
        setMyShelfBooks(buildBuiltInShelfBooks({}, builtInCoverUrls));
        return;
      }

      const result = await fetchLibraryMyShelf(user.studentNumber, BUILT_IN_LIBRARY_BOOK_IDS);
      if (!result.ok) {
        setMyShelfBooks(buildBuiltInShelfBooks({}, builtInCoverUrls));
        setMyShelfErrorMessage(result.message ?? "Unable to load your shelf right now.");
        return;
      }

      const downloadedBooks = await mergeLocalEpubFiles(result.books ?? []);
      const allShelf = dedupeLibraryBooks([
        ...downloadedBooks,
        ...buildBuiltInShelfBooks(result.progressByBookId ?? {}, builtInCoverUrls),
      ]);
      setMyShelfBooks(sortBooksByMostRecent(allShelf));
    } catch {
      setMyShelfBooks(buildBuiltInShelfBooks({}, builtInCoverUrls));
      setMyShelfErrorMessage("Unable to reach your shelf right now.");
    } finally {
      setIsMyShelfLoading(false);
    }
  }, [builtInCoverUrls, mergeLocalEpubFiles, user?.studentNumber]);

  useFocusEffect(
    useCallback(() => {
      if (activeShelf === "featured") {
        void loadBooks(submittedQuery);
      }
      void loadMyShelf();
    }, [activeShelf, loadBooks, loadMyShelf, submittedQuery]),
  );

  useEffect(() => {
    let cancelled = false;

    BUILT_IN_LIBRARY_BOOKS.forEach((book) => {
      if (!book.bundledEpubAsset || book.coverImageUrl) return;

      void resolveBundledEpubUri(book.bundledEpubAsset)
        .then((epubUri) => readEpubCoverUriFromFile(epubUri, book.id))
        .then((coverUri) => {
          if (!cancelled && coverUri) {
            setBuiltInCoverUrls((current) => (
              current[book.id] ? current : { ...current, [book.id]: coverUri }
            ));
            updateBookCover(book.id, coverUri);
          }
        })
        .catch(() => undefined);
    });

    return () => {
      cancelled = true;
    };
  }, [updateBookCover]);

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
          totalPages });
        if (result.ok) {
          updateBookProgress(book.id, result.progress);
        }
      } catch {
        // Progress is best-effort; the reader should stay usable offline or during brief API failures.
      }
    },
    [updateBookProgress, user?.studentNumber],
  );

  const loadReadingRewardStatus = useCallback(async () => {
    if (!user?.studentNumber) {
      setNextReadingAchievement(FIRST_READING_ACHIEVEMENT);
      return;
    }

    try {
      const result = await fetchLibraryReadingRewardStatus(user.studentNumber);
      if (result.ok) {
        setNextReadingAchievement(result.nextAchievement ?? null);
      }
    } catch {
      setNextReadingAchievement((current) => current ?? FIRST_READING_ACHIEVEMENT);
    }
  }, [user?.studentNumber]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      if (activeShelf === "featured") {
        await loadBooks(submittedQuery);
      }
      await loadMyShelf();
      await loadReadingRewardStatus();
    } finally {
      setIsRefreshing(false);
    }
  }, [activeShelf, loadBooks, loadMyShelf, loadReadingRewardStatus, submittedQuery]);


  useEffect(() => {
    void loadReadingRewardStatus();
  }, [loadReadingRewardStatus]);

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
    setFeaturedPage(1);
    if (activeShelf === "featured") {
      void loadBooks(nextQuery);
    }
  };

  const handleClearSearch = () => {
    setSearchDraft("");
    setSubmittedQuery("");
    setFeaturedPage(1);
    if (activeShelf === "featured" && submittedQuery) {
      void loadBooks("");
    }
  };

  const handleShelfTabChange = (nextShelf: ShelfTab) => {
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    setActiveShelf(nextShelf);
    Animated.spring(slideAnim, {
      toValue: nextShelf === "featured" ? 0 : 1,
      damping: 22,
      stiffness: 280,
      mass: 0.8,
      useNativeDriver: true,
    }).start();
    setFeaturedPage(1);
    setSearchDraft("");
    setSubmittedQuery("");
    setLibraryActionMessage("");
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
    const shelfMatch = findShelfMatch(myShelfBooks, book);
    if (shelfMatch) {
      setLibraryActionTone("success");
      setLibraryActionMessage("This book is already in My Shelf.");
      setActiveShelf("my");
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
        studentNumber: user.studentNumber });

      if (!result.ok) {
        setLibraryActionTone("error");
        setLibraryActionMessage(result.message ?? "Unable to download this book.");
        return;
      }

      if (result.alreadyDownloaded) {
        setLibraryActionTone("success");
        setLibraryActionMessage(result.message ?? "This book is already in My Shelf.");
        void loadBooks(submittedQuery);
        void loadMyShelf();
        return;
      }

      if (!result.download?.downloadUrl) {
        setLibraryActionTone("error");
        setLibraryActionMessage("The download service did not return an EPUB file link.");
        return;
      }

      const downloadedBookId = result.download.bookId || book.id;
      const localEpubUri = await downloadEpubToLibrary(downloadedBookId, result.download.downloadUrl);
      await saveStoredEpubFile(user.studentNumber, downloadedBookId, localEpubUri, result.download.downloadedAt);

      updateBookDownload(downloadedBookId, result.download, localEpubUri);
      void loadBooks(submittedQuery);
      void loadMyShelf();
      setLibraryActionTone("success");
      setLibraryActionMessage("EPUB downloaded. Reader mode is now unlocked.");
    } catch (error) {
      setLibraryActionTone("error");
      setLibraryActionMessage(error instanceof Error && error.message ? error.message : "Unable to download and save this EPUB.");
    } finally {
      setActiveDownloadBookId(null);
    }
  };

  const handleOpenExternalBook = async (book: LibraryBookRecord) => {
    const url = getExternalReaderUrl(book);
    if (!url) {
      setLibraryActionTone("error");
      setLibraryActionMessage("Open Library did not provide a reader link for this title.");
      return;
    }

    setLibraryActionTone("success");
    setLibraryActionMessage("Opening Open Library...");
    try {
      await Linking.openURL(url);
    } catch {
      setLibraryActionTone("error");
      setLibraryActionMessage("Unable to open this Open Library link.");
    }
  };

  const handlePrimaryBookAction = async (book: LibraryBookRecord) => {
    if (isBookReadyInApp(book)) {
      await handleOpenBook(book.id);
      return;
    }
    // In-app EPUB download only when FS marks downloadableEpub / Download EPUB
    if (canDownloadEpubInApp(book) || book.actionLabel === "Download EPUB") {
      await handleDownloadBook(book);
      return;
    }
    // Borrow on Open Library = external active CTA (borrowable â‰  downloadableEpub)
    if (isOpenLibraryBorrow(book) || book.actionLabel === "Borrow on Open Library") {
      if (getExternalReaderUrl(book)) {
        await handleOpenExternalBook(book);
        return;
      }
      setLibraryActionTone("error");
      setLibraryActionMessage(getAccessHelperText(book));
      return;
    }
    if (isPreviewOrCatalogOnly(book) || isNotBorrowable(book)) {
      setLibraryActionTone("error");
      setLibraryActionMessage(getAccessHelperText(book));
      return;
    }
    if (getExternalReaderUrl(book)) {
      await handleOpenExternalBook(book);
      return;
    }
    setLibraryActionTone("error");
    setLibraryActionMessage(getAccessHelperText(book));
  };

  const handleOpenBook = async (bookId: string) => {
    const book = allKnownBooks.find((item) => item.id === bookId);
    if (!book) return;
    if (!isEpubBook(book)) {
      await handleOpenExternalBook(book);
      return;
    }
    if (!isBookReadyInApp(book)) {
      setLibraryActionTone("error");
      setLibraryActionMessage("Save this EPUB in the app before opening the reader.");
      return;
    }

    const nowIso = new Date().toISOString();
    updateBookProgress(book.id, {
      bookId: book.id,
      currentPage: book.progress?.currentPage ?? 0,
      totalPages: book.progress?.totalPages ?? 1,
      status: book.progress?.status ?? "STARTED",
      rating: book.progress?.rating,
      percent: book.progress?.percent ?? 0,
      lastOpenedAt: nowIso,
      updatedAt: nowIso,
    });

    setSelectedBookId(bookId);
    setReaderPages([]);
    setReaderPageIndex(0);
    setIsReaderLoading(true);
    setReaderErrorMessage("");
    setRatingErrorMessage("");
    setReadingRewardSeconds(0);
    setClaimedReadingAchievement(null);
    setShowReaderExitModal(false);
    void loadReadingRewardStatus();
    try {
      const epubUri = book.localEpubUri || (
        book.bundledEpubAsset
          ? await resolveBundledEpubUri(book.bundledEpubAsset)
          : book.downloaded && book.downloadUrl
            ? await downloadEpubToLibrary(book.id, book.downloadUrl)
            : ""
      );
      if (!epubUri) {
        throw new Error("This EPUB file could not be opened.");
      }
      if (!book.localEpubUri) {
        updateBookLocalUri(book.id, epubUri);
        if (!book.bundledEpubAsset && user?.studentNumber) {
          await saveStoredEpubFile(user.studentNumber, book.id, epubUri, book.downloadedAt);
        }
      }

      const pages = await readEpubPagesFromFile(epubUri, book.title);
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

  const closeReaderImmediately = () => {
    setSelectedBookId(null);
    setReaderPageIndex(0);
    setReaderPages([]);
    setReaderErrorMessage("");
    setIsReaderLoading(false);
    setRatingErrorMessage("");
    setReadingRewardSeconds(0);
    setClaimedReadingAchievement(null);
    setShowReadingRewardModal(false);
    setShowReaderExitModal(false);
  };

  const handleCloseBook = () => {
    if (
      readingRewardTargetSeconds > 0 &&
      readingRewardSeconds > 0 &&
      readingRewardSeconds < readingRewardTargetSeconds &&
      !showReadingRewardModal
    ) {
      setShowReaderExitModal(true);
      return;
    }

    closeReaderImmediately();
  };

  const handleReaderPageChange = (nextPage: number) => {
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    const boundedPage = Math.min(Math.max(nextPage, 0), Math.max(readerPages.length - 1, 0));

    Animated.sequence([
      Animated.timing(pageTurnAnim, { toValue: 0.35, duration: 75, useNativeDriver: true }),
      Animated.timing(pageTurnAnim, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start();

    setReaderPageIndex(boundedPage);
    readerScrollRef.current?.scrollTo({ y: 0, animated: false });
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
    closeReaderImmediately();
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
        totalPages: readerPages.length || 1 });
      if (result.ok) {
        updateBookProgress(selectedBook.id, result.progress);
      } else {
        setRatingErrorMessage(result.message ?? "Unable to save rating.");
      }
    } catch {
      setRatingErrorMessage("Unable to reach the library rating service.");
    }
  };

  const handleConfirmRemoveBook = async () => {
    if (!bookPendingRemoval || !user?.studentNumber || isBuiltInBook(bookPendingRemoval)) {
      setBookPendingRemoval(null);
      return;
    }

    const removalBook = bookPendingRemoval;
    setIsRemovingBook(true);
    setLibraryActionMessage("");
    try {
      const result = await removeLibraryBookFromShelf(user.studentNumber, removalBook.id);
      if (!result.ok) {
        setLibraryActionTone("error");
        setLibraryActionMessage(result.message ?? "Unable to remove this book.");
        return;
      }

      await removeStoredEpubFile(user.studentNumber, removalBook.id);
      setBooks((current) =>
        current.map((book) => (
          book.id === removalBook.id
            ? {
                ...book,
                downloaded: false,
                downloadedAt: null,
                localEpubUri: undefined,
                readerLink: book.downloadUrl || book.readerLink,
                shelfLabel: book.shelfLabel === "Downloaded" ? "Free full EPUB" : book.shelfLabel }
            : book
        )),
      );
      setMyShelfBooks((current) => current.filter((book) => book.id !== removalBook.id));
      setLibraryActionTone("success");
      setLibraryActionMessage(result.message ?? "Book removed from My Shelf.");
      setBookPendingRemoval(null);
      void loadBooks(submittedQuery);
      void loadMyShelf();
    } catch {
      setLibraryActionTone("error");
      setLibraryActionMessage("Unable to remove this book right now.");
    } finally {
      setIsRemovingBook(false);
    }
  };

  const claimReadingReward = useCallback(async () => {
    if (readingRewardClaimRef.current || !selectedBook || !nextReadingAchievement) return;

    readingRewardClaimRef.current = true;
    setIsClaimingReadingReward(true);
    try {
      if (!user?.studentNumber) {
        setReadingRewardSeconds(0);
        return;
      }

      const result = await claimLibraryReadingReward({
        achievementKey: nextReadingAchievement.key,
        bookId: selectedBook.id,
        bookTitle: selectedBook.title,
        readingSeconds: nextReadingAchievement.seconds,
        studentNumber: user.studentNumber });

      if (result.ok) {
        const claimedAchievement = result.achievement ?? nextReadingAchievement;
        setClaimedReadingAchievement(claimedAchievement);
        setNextReadingAchievement(
          result.nextAchievement === undefined
            ? getFallbackAchievementAfter(claimedAchievement.key)
            : result.nextAchievement,
        );
        setReadingRewardMessage(result.message ?? `${claimedAchievement.title} unlocked. You earned +${claimedAchievement.rewardTala} Tala.`);
        setShowReadingRewardModal(true);
      } else if (result.nextAchievement !== undefined) {
        setNextReadingAchievement(result.nextAchievement ?? null);
      }
      setReadingRewardSeconds(0);
    } catch {
      setReadingRewardSeconds(0);
    } finally {
      setIsClaimingReadingReward(false);
      readingRewardClaimRef.current = false;
    }
  }, [nextReadingAchievement, selectedBook, user?.studentNumber]);

  useEffect(() => {
    if (!selectedBook || !readingRewardTargetSeconds || isReaderLoading || !readerPages.length || showReadingRewardModal) {
      return undefined;
    }

    const timer = setInterval(() => {
      setReadingRewardSeconds((current) => Math.min(current + 1, readingRewardTargetSeconds));
    }, 1000);

    return () => clearInterval(timer);
  }, [isReaderLoading, readerPages.length, readingRewardTargetSeconds, selectedBook, showReadingRewardModal]);

  useEffect(() => {
    if (!readingRewardTargetSeconds || readingRewardSeconds < readingRewardTargetSeconds || isClaimingReadingReward) {
      return;
    }

    void claimReadingReward();
  }, [claimReadingReward, isClaimingReadingReward, readingRewardSeconds, readingRewardTargetSeconds]);

  const renderBookCard = (book: LibraryBookRecord) => {
    const progressPercent = book.progress?.percent ?? 0;
    const supportsInAppReader = isEpubBook(book);
    const isDownloaded = isBookReadyInApp(book);
    const isDownloading = activeDownloadBookId === book.id;
    const externalReaderUrl = getExternalReaderUrl(book);
    const actionLabel = getBookActionLabel(book);
    const accessIconName = (
      isDownloaded
        ? "cloud-done-outline"
        : supportsInAppReader
          ? "cloud-download-outline"
          : book.accessType === "waitlist"
            ? "hourglass-outline"
            : book.accessType === "preview"
              ? "eye-outline"
              : "open-outline"
    ) as keyof typeof Ionicons.glyphMap;

    return (
      <AppleBookCard key={book.id} compact={compact} onPress={() => void handlePrimaryBookAction(book)}>
        <View style={styles.bookCardTopRow}>
          <View style={styles.bookTag}>
            <Text style={styles.bookTagText}>{book.shelfLabel}</Text>
          </View>
        </View>

        <View style={[styles.bookCardBody, compact && styles.bookCardBodyStacked]}>
          <View
            style={[
              styles.bookCoverWrap,
              compact && styles.bookCoverWrapCompact,
              compact && styles.bookCoverWrapStacked,
              { backgroundColor: matchaAccentFor(book.id || book.title, 0) },
            ]}
          >
            {book.coverImageUrl ? (
              <Image
                source={{ uri: book.coverImageUrl }}
                style={styles.bookCoverImage}
                contentFit="cover"
                cachePolicy="memory-disk"
                transition={150}
              />
            ) : (
              <View style={styles.bookCoverPlaceholder}>
                <Text style={styles.bookCoverInitial}>{titleInitial(book.title)}</Text>
                <Text style={styles.bookCoverPlaceholderLabel} numberOfLines={2}>{book.title}</Text>
              </View>
            )}
          </View>

          <View style={styles.bookInfoWrap}>
            <Text style={styles.bookCategory}>{book.category}</Text>
            <Text style={[styles.bookTitle, compact && styles.bookTitleCompact]}>{book.title}</Text>
            <Text style={styles.bookAuthor}>{book.author}</Text>
            <Text style={styles.bookBlurb} numberOfLines={2}>{book.blurb}</Text>

            <View style={styles.bookMetaRow}>
              <View style={styles.bookMetaPill}>
                <Ionicons name="time-outline" size={14} color="#5C655B" />
                <Text style={styles.bookMetaText}>{`${book.estimatedMinutes} min read`}</Text>
              </View>
              <View style={styles.bookMetaPill}>
                <Ionicons name="star-outline" size={14} color="#5C655B" />
                <Text style={styles.bookMetaText}>{book.rewardLabel}</Text>
              </View>
              <View style={styles.bookMetaPill}>
                <Ionicons name={accessIconName} size={14} color="#5C655B" />
                <Text style={styles.bookMetaText}>{book.provider === "builtin" ? "Ready in app" : isDownloaded ? "Saved in app" : canDownloadEpubInApp(book) || actionLabel === "Download EPUB" ? "Free EPUB" : isOpenLibraryBorrow(book) || actionLabel === "Borrow on Open Library" ? "Open Library" : isPreviewOrCatalogOnly(book) ? "Preview only" : book.accessLabel || actionLabel || "Open online"}</Text>
              </View>
              {isDownloaded || progressPercent > 0 ? (
                <View style={styles.bookMetaPill}>
                  <Ionicons name="bookmark-outline" size={14} color="#5C655B" />
                  <Text style={styles.bookMetaText}>{`${progressPercent}%`}</Text>
                </View>
              ) : null}
            </View>

            {getAccessHelperText(book) ? (
              <Text style={styles.bookAccessHelper}>{getAccessHelperText(book)}</Text>
            ) : null}

            <View style={styles.bookActionRow}>
              {isDownloaded ? (
                <>
                  {activeShelf === "my" && !isBuiltInBook(book) ? (
                    <Pressable style={styles.bookRemoveButton} onPress={() => setBookPendingRemoval(book)}>
                      <Ionicons name="trash-outline" size={15} color={LIBRARY_MATCHA.danger} />
                      <Text style={styles.bookRemoveButtonText}>Remove</Text>
                    </Pressable>
                  ) : null}
                  <Pressable style={styles.bookReadButton} onPress={() => void handleOpenBook(book.id)}>
                    <Ionicons name="book-outline" size={15} color="#FFFFFF" />
                    <Text style={styles.bookReadButtonText}>Read</Text>
                  </Pressable>
                </>
              ) : canDownloadEpubInApp(book) || actionLabel === "Download EPUB" ? (
                <Pressable
                  style={[styles.bookDownloadButton, isDownloading && styles.bookActionButtonDisabled]}
                  disabled={isDownloading}
                  onPress={() => void handleDownloadBook(book)}
                >
                  {isDownloading ? (
                    <ActivityIndicator size="small" color={LIBRARY_MATCHA.primaryDark} />
                  ) : (
                    <Ionicons name="download-outline" size={15} color={LIBRARY_MATCHA.primaryDark} />
                  )}
                  <Text style={styles.bookDownloadButtonText}>
                    {isDownloading ? "Downloading" : "Download EPUB"}
                  </Text>
                </Pressable>
              ) : isOpenLibraryBorrow(book) || actionLabel === "Borrow on Open Library" ? (
                <Pressable style={styles.bookExternalButton} onPress={() => void handleOpenExternalBook(book)}>
                  <Ionicons name="open-outline" size={15} color="#FFFFFF" />
                  <Text style={styles.bookExternalButtonText}>{actionLabel || "Borrow on Open Library"}</Text>
                </Pressable>
              ) : isPreviewOrCatalogOnly(book) || isNotBorrowable(book) ? (
                <View style={styles.bookDisabledCta}>
                  <Ionicons
                    name={isPreviewOrCatalogOnly(book) ? "eye-outline" : "close-circle-outline"}
                    size={15}
                    color={LIBRARY_MATCHA.textSoft}
                  />
                  <Text style={styles.bookDisabledCtaText}>{actionLabel}</Text>
                </View>
              ) : externalReaderUrl ? (
                <Pressable style={styles.bookExternalButton} onPress={() => void handleOpenExternalBook(book)}>
                  <Ionicons name="open-outline" size={15} color="#FFFFFF" />
                  <Text style={styles.bookExternalButtonText}>{actionLabel || "Borrow on Open Library"}</Text>
                </Pressable>
              ) : (
                <View style={styles.bookDisabledCta}>
                  <Ionicons name="alert-circle-outline" size={15} color={LIBRARY_MATCHA.textSoft} />
                  <Text style={styles.bookDisabledCtaText}>{actionLabel || "Preview only"}</Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </AppleBookCard>
    );
  };

  return (
    <View style={styles.screen}>
      <AppleTopBar title="Pocket Library" onBack={handleBack} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, compact && styles.scrollContentCompact]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={["#73CD44"]}
            tintColor="#73CD44"
          />
        }
      >
        <View style={styles.contentFrame}>
          <View style={[styles.searchCard, compact && styles.searchCardCompact]}>
            <View style={styles.searchInputWrap}>
              <Ionicons name="search-outline" size={18} color="#5C655B" />
              <TextInput
                value={searchDraft}
                onChangeText={setSearchDraft}
                onSubmitEditing={handleSearchSubmit}
                placeholder={activeShelf === "my" ? "Search your shelf" : "Search title, author, ISBN"}
                placeholderTextColor="#6F845C"
                returnKeyType="search"
                maxLength={LIBRARY_SEARCH_MAX_LENGTH}
                style={styles.searchInput}
              />
              {searchDraft.length ? (
                <Pressable style={styles.searchIconButton} accessibilityLabel="Clear search" onPress={handleClearSearch}>
                  <Ionicons name="close" size={17} color="#5C655B" />
                </Pressable>
              ) : null}
            </View>
            <Text style={styles.searchCharCount}>
              {searchDraft.length}/{LIBRARY_SEARCH_MAX_LENGTH}
            </Text>
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
            <Text style={styles.sectionTitle}>
              {activeShelf === "my" ? "My Shelf" : submittedQuery ? "Search Results" : "Featured Shelf"}
            </Text>
            <Text style={styles.sectionSubTitle}>
              {activeShelf === "my"
                ? "Saved books and reading progress."
                : submittedQuery
                  ? `Showing Open Library matches for "${submittedQuery}".`
                  : "Free offline EPUBs and books to read anytime."}
            </Text>
          </View>

          {displayedIsLoading ? (
            <View style={styles.loadingCard}>
              <ActivityIndicator color="#70C943" />
              <Text style={styles.loadingText}>Loading books...</Text>
            </View>
          ) : displayedErrorMessage ? (
            <View style={styles.emptyCard}>
              <Ionicons name="cloud-offline-outline" size={28} color={LIBRARY_MATCHA.primaryDark} style={{ marginBottom: 8 }} />
              <Text style={styles.emptyTitle}>Library is unavailable</Text>
              <Text style={styles.emptyText}>{displayedErrorMessage || "We could not reach the catalog. Check your connection and try again."}</Text>
              <Pressable style={styles.retryButton} onPress={() => activeShelf === "my" ? void loadMyShelf() : void loadBooks()}>
                <Text style={styles.retryButtonText}>Try Again</Text>
              </Pressable>
            </View>
          ) : (
            displayedBooks.length ? (
              <View style={styles.bookList}>
                {displayedBooks.map(renderBookCard)}

                {activeShelf === "featured" && paginatedFeatured.totalPages > 1 ? (
                  <View style={styles.paginationRow}>
                    <Pressable
                      style={[styles.paginationArrowButton, featuredPage <= 1 && styles.paginationArrowButtonDisabled]}
                      disabled={featuredPage <= 1}
                      accessibilityLabel="Previous page"
                      onPress={() => setFeaturedPage((prev) => Math.max(1, prev - 1))}
                    >
                      <Ionicons
                        name="chevron-back"
                        size={16}
                        color={featuredPage <= 1 ? "#A8C49A" : "#35485B"}
                      />
                    </Pressable>

                    <View style={styles.paginationNumbersRow}>
                      {getPaginationPageNumbers(paginatedFeatured.currentPage, paginatedFeatured.totalPages).map((item, idx) => {
                        if (item === "...") {
                          return (
                            <View key={`dots-${idx}`} style={styles.paginationDotsWrap}>
                              <Text style={styles.paginationDotsText}>...</Text>
                            </View>
                          );
                        }

                        const isCurrent = item === paginatedFeatured.currentPage;
                        return (
                          <Pressable
                            key={item}
                            style={[styles.paginationNumberBox, isCurrent && styles.paginationNumberBoxActive]}
                            onPress={() => setFeaturedPage(item)}
                          >
                            <Text style={[styles.paginationNumberText, isCurrent && styles.paginationNumberTextActive]}>
                              {item}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>

                    <Pressable
                      style={[styles.paginationArrowButton, featuredPage >= paginatedFeatured.totalPages && styles.paginationArrowButtonDisabled]}
                      disabled={featuredPage >= paginatedFeatured.totalPages}
                      accessibilityLabel="Next page"
                      onPress={() => setFeaturedPage((prev) => Math.min(paginatedFeatured.totalPages, prev + 1))}
                    >
                      <Ionicons
                        name="chevron-forward"
                        size={16}
                        color={featuredPage >= paginatedFeatured.totalPages ? "#A8C49A" : "#35485B"}
                      />
                    </Pressable>
                  </View>
                ) : null}
              </View>
            ) : (
              <View style={styles.emptyCard}>
                <Ionicons name="search-outline" size={28} color={LIBRARY_MATCHA.primaryDark} style={{ marginBottom: 8 }} />
                <Text style={styles.emptyTitle}>{submittedQuery ? "No matches" : "Shelf is empty"}</Text>
                <Text style={styles.emptyText}>
                  {activeShelf === "my"
                    ? (submittedQuery
                        ? `Nothing on your shelf matches â€œ${submittedQuery}â€. Clear search or download a free EPUB from Featured.`
                        : "Your shelf keeps books you're reading and saved EPUBs. Add books from Featured to get started.")
                    : (submittedQuery
                        ? `No results for â€œ${submittedQuery}â€. Try a simpler title, author, or ISBN.`
                        : "The featured shelf has no books right now. Tap Try Again in a moment, or search by title.")}
                </Text>
              </View>
            )
          )}
        </View>
      </ScrollView>



      <Modal visible={Boolean(selectedBook)} animationType="slide" onRequestClose={handleCloseBook}>
        {(() => {
          const activeColors =
            readerTheme === "night"
              ? {
                  screenBg: "#0B0F19",
                  cardBg: "#131B2E",
                  borderColor: "#1E293B",
                  textColor: "#E2E8F0",
                  titleColor: "#F8FAFC",
                  eyebrowColor: "#94A3B8",
                  pageNumberColor: "#64748B",
                  controlBg: "#1E293B",
                  controlBorder: "#334155",
                  controlText: "#F8FAFC",
                  topBarBg: "rgba(11, 15, 25, 0.94)",
                }
              : readerTheme === "clean"
              ? {
                  screenBg: "#F8FAFC",
                  cardBg: "#FFFFFF",
                  borderColor: "#E2E8F0",
                  textColor: "#0F172A",
                  titleColor: "#0F172A",
                  eyebrowColor: "#64748B",
                  pageNumberColor: "#94A3B8",
                  controlBg: "#FFFFFF",
                  controlBorder: "#E2E8F0",
                  controlText: "#334155",
                  topBarBg: "rgba(248, 250, 252, 0.94)",
                }
              : {
                  screenBg: "#FBF8F1",
                  cardBg: "#FFFFFF",
                  borderColor: "#EDE2D0",
                  textColor: "#292524",
                  titleColor: "#1C1917",
                  eyebrowColor: "#78716C",
                  pageNumberColor: "#A8A29E",
                  controlBg: "#FFFFFF",
                  controlBorder: "#EDE2D0",
                  controlText: "#44403C",
                  topBarBg: "rgba(251, 248, 241, 0.94)",
                };

          const bookProgressRatio =
            readerPages.length > 0 ? (readerPageIndex + 1) / readerPages.length : 0;
          const bookProgressPercent = Math.round(bookProgressRatio * 100);

          return (
            <SafeAreaView style={[styles.readerScreen, { backgroundColor: activeColors.screenBg }]}>
              {/* Apple Floating Header */}
              <View style={[styles.readerHeader, { backgroundColor: activeColors.topBarBg, borderBottomColor: activeColors.borderColor }]}>
                <View style={styles.readerHeaderTopRow}>
                  <Pressable
                    style={[styles.readerCloseCircle, { backgroundColor: activeColors.controlBg, borderColor: activeColors.borderColor }]}
                    accessibilityLabel="Close reader"
                    onPress={handleCloseBook}
                  >
                    <Ionicons name="close" size={20} color={activeColors.controlText} />
                  </Pressable>

                  <View style={styles.readerHeaderCenter}>
                    <Text style={[styles.readerHeaderCategory, { color: activeColors.eyebrowColor }]}>
                      {selectedBook?.category ?? "Library"}
                    </Text>
                    <Text
                      style={[styles.readerHeaderBookTitle, { color: activeColors.titleColor }]}
                      numberOfLines={1}
                    >
                      {selectedBook?.title ?? ""}
                    </Text>
                  </View>

                  {/* Header Actions: Font Size, Theme, and Page Badge */}
                  <View style={styles.readerHeaderActions}>
                    {/* Theme Toggle Button */}
                    <Pressable
                      style={[styles.readerThemeButton, { backgroundColor: activeColors.controlBg, borderColor: activeColors.borderColor }]}
                      onPress={() => {
                        try {
                          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        } catch {}
                        setReaderTheme((curr) => (curr === "warm" ? "clean" : curr === "clean" ? "night" : "warm"));
                      }}
                      accessibilityLabel="Toggle reading theme"
                    >
                      <Ionicons
                        name={readerTheme === "night" ? "moon" : readerTheme === "clean" ? "sunny" : "book"}
                        size={15}
                        color={activeColors.controlText}
                      />
                    </Pressable>

                    {/* Font Size Toggle Button */}
                    <Pressable
                      style={[styles.readerFontButton, { backgroundColor: activeColors.controlBg, borderColor: activeColors.borderColor }]}
                      onPress={() => {
                        try {
                          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        } catch {}
                        setReaderFontSize((curr) => (curr === 16 ? 18 : curr === 18 ? 21 : curr === 21 ? 24 : 16));
                      }}
                      accessibilityLabel="Change text size"
                    >
                      <Text style={[styles.readerFontButtonText, { color: activeColors.controlText }]}>
                        Aa
                      </Text>
                    </Pressable>

                    {/* Page Badge */}
                    <View style={[styles.readerPagePill, { backgroundColor: activeColors.controlBg, borderColor: activeColors.borderColor }]}>
                      <Text style={[styles.readerPagePillText, { color: activeColors.controlText }]}>
                        {isReaderLoading ? "..." : readerPages.length > 0 ? ('' + (readerPageIndex + 1) + '/' + readerPages.length) : "0/0"}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Apple Slim Reading Progress Bar */}
                <View style={styles.readerProgressTrack}>
                  <View
                    style={[
                      styles.readerProgressFill,
                      { width: (bookProgressRatio * 100) + '%' },
                    ]}
                  />
                </View>
              </View>

              {/* Main Reading Frame */}
              <View style={styles.readerMainArea}>
                <View style={[styles.readerPageCard, { backgroundColor: activeColors.cardBg, borderColor: activeColors.borderColor }]}>
                  {isReaderLoading ? (
                    <View style={styles.readerLoadingWrap}>
                      <ActivityIndicator size="large" color="#52B72A" />
                      <Text style={[styles.readerLoadingText, { color: activeColors.eyebrowColor }]}>
                        Opening book...
                      </Text>
                    </View>
                  ) : (
                    <Animated.View style={[styles.readerAnimatedPageWrap, { opacity: pageTurnAnim }]}>
                      {!!readerErrorMessage && (
                        <Text style={styles.readerInlineErrorText}>{readerErrorMessage}</Text>
                      )}

                      <ScrollView
                        ref={readerScrollRef}
                        style={styles.readerPageScroll}
                        contentContainerStyle={styles.readerPageScrollContent}
                        showsVerticalScrollIndicator={false}
                      >
                        {currentPage?.eyebrow ? (
                          <Text style={[styles.readerPageEyebrow, { color: activeColors.eyebrowColor }]}>
                            {currentPage.eyebrow}
                          </Text>
                        ) : null}

                        {currentPage?.title ? (
                          <Text style={[styles.readerPageTitle, { color: activeColors.titleColor }]}>
                            {currentPage.title}
                          </Text>
                        ) : null}

                        {currentPage?.paragraphs.map((paragraph, index) => (
                          <Text
                            key={'' + currentPage.title + '-' + index}
                            style={[
                              styles.readerPageBody,
                              {
                                color: activeColors.textColor,
                                fontSize: readerFontSize,
                                lineHeight: Math.round(readerFontSize * 1.68),
                              },
                            ]}
                          >
                            {paragraph}
                          </Text>
                        ))}

                        <View style={styles.readerEndOfPageSpacer} />
                      </ScrollView>

                      {/* Bottom Page Indicator */}
                      <View style={styles.readerPageFooterRow}>
                        <Text style={[styles.readerPageFooterText, { color: activeColors.pageNumberColor }]}>
                          {readerPages.length > 0 ? ('Page ' + (readerPageIndex + 1) + ' of ' + readerPages.length + ' (' + bookProgressPercent + '%)') : ""}
                        </Text>
                      </View>
                    </Animated.View>
                  )}

                  {/* Reading Milestone Activity Ring (Apple Activity Style) */}
                  {!isReaderLoading && readerPages.length > 0 && nextReadingAchievement ? (
                    <View style={styles.readerRewardBubble} pointerEvents="none">
                      <View style={styles.readerRewardRingBox}>
                        <Svg width={READING_REWARD_RING_SIZE} height={READING_REWARD_RING_SIZE} style={StyleSheet.absoluteFillObject}>
                          <Circle
                            cx={READING_REWARD_RING_SIZE / 2}
                            cy={READING_REWARD_RING_SIZE / 2}
                            r={READING_REWARD_RING_RADIUS}
                            stroke={readerTheme === "night" ? "rgba(255,255,255,0.12)" : "rgba(82, 183, 42, 0.2)"}
                            strokeWidth={READING_REWARD_RING_STROKE}
                            fill="transparent"
                          />
                          <G rotation="-90" origin={`${READING_REWARD_RING_SIZE / 2}, ${READING_REWARD_RING_SIZE / 2}`}>
                            <Circle
                              cx={READING_REWARD_RING_SIZE / 2}
                              cy={READING_REWARD_RING_SIZE / 2}
                              r={READING_REWARD_RING_RADIUS}
                              stroke="#52B72A"
                              strokeWidth={READING_REWARD_RING_STROKE}
                              fill="transparent"
                              strokeDasharray={`${READING_REWARD_RING_CIRCUMFERENCE} ${READING_REWARD_RING_CIRCUMFERENCE}`}
                              strokeDashoffset={readingRewardStrokeOffset}
                              strokeLinecap="round"
                            />
                          </G>
                        </Svg>
                        <View style={styles.readerRewardIconWrap}>
                          {isClaimingReadingReward ? (
                            <ActivityIndicator size="small" color="#52B72A" />
                          ) : (
                            <Image source={TALA_IMAGE} style={styles.readerRewardIcon} contentFit="contain" cachePolicy="memory-disk" />
                          )}
                        </View>
                      </View>
                      <View style={[styles.readerRewardGoalPill, { backgroundColor: activeColors.controlBg, borderColor: activeColors.borderColor }]}>
                        <Text style={[styles.readerRewardGoalText, { color: activeColors.controlText }]}>
                          {readingRewardGoalLabel}
                        </Text>
                      </View>
                    </View>
                  ) : null}
                </View>
              </View>

              {/* Floating Bottom Control Dock */}
              <View style={[styles.readerControlDock, { backgroundColor: activeColors.topBarBg, borderTopColor: activeColors.borderColor }]}>
                {/* Previous Page Circular Action */}
                <Pressable
                  style={[
                    styles.readerNavCircle,
                    { backgroundColor: activeColors.controlBg, borderColor: activeColors.borderColor },
                    (!canGoPreviousPage || isReaderLoading) && styles.readerNavCircleDisabled,
                  ]}
                  disabled={!canGoPreviousPage || isReaderLoading}
                  onPress={() => handleReaderPageChange(readerPageIndex - 1)}
                  accessibilityLabel="Previous Page"
                >
                  <Ionicons
                    name="chevron-back"
                    size={20}
                    color={canGoPreviousPage && !isReaderLoading ? activeColors.controlText : "#94A3B8"}
                  />
                </Pressable>

                {/* Center Star Rating Pod */}
                <View style={[styles.readerRatingPill, { backgroundColor: activeColors.controlBg, borderColor: activeColors.borderColor }]}>
                  <Text style={[styles.readerRatingLabel, { color: activeColors.eyebrowColor }]}>Rating</Text>
                  <View style={styles.ratingStarsRow}>
                    {STAR_VALUES.map((star) => (
                      <Pressable
                        key={star}
                        style={styles.ratingStarButton}
                        onPress={() => {
                          try {
                            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          } catch {}
                          void handleRateBook(star);
                        }}
                      >
                        <Ionicons
                          name={star <= selectedBookRating ? "star" : "star-outline"}
                          size={18}
                          color={star <= selectedBookRating ? "#F59E0B" : activeColors.eyebrowColor}
                        />
                      </Pressable>
                    ))}
                  </View>
                </View>

                {/* Next Page / Finish Book Button */}
                <Pressable
                  style={[
                    styles.readerPrimaryActionPill,
                    isReaderLoading && styles.readerPrimaryButtonDisabled,
                  ]}
                  disabled={isReaderLoading}
                  onPress={() => {
                    try {
                      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    } catch {}
                    if (canGoNextPage) {
                      handleReaderPageChange(readerPageIndex + 1);
                      return;
                    }
                    handleFinishBook();
                  }}
                  accessibilityLabel={canGoNextPage ? "Next Page" : "Finish Book"}
                >
                  <Text style={styles.readerPrimaryActionText}>
                    {isReaderLoading
                      ? "Opening..."
                      : canGoNextPage
                      ? "Next"
                      : selectedBook?.progress?.status === "FINISHED"
                      ? "Close"
                      : "Finish Book"}
                  </Text>
                  <Ionicons
                    name={canGoNextPage ? "arrow-forward" : "checkmark-circle"}
                    size={16}
                    color="#FFFFFF"
                  />
                </Pressable>
              </View>
            </SafeAreaView>
          );
        })()}
      </Modal>

      <Modal
        visible={showReaderExitModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowReaderExitModal(false)}
      >
        <View style={styles.confirmModalBackdrop}>
          <View style={styles.confirmModalCard}>
            <View style={styles.confirmModalIconWrap}>
              <Image source={TALA_IMAGE} style={styles.confirmModalIcon} contentFit="contain" cachePolicy="memory-disk" />
            </View>
            <Text style={styles.confirmModalTitle}>Leave reader?</Text>
            <Text style={styles.confirmModalBody}>
              {readingRewardLeaveMessage}
            </Text>
            <View style={styles.confirmModalActions}>
              <Pressable style={styles.confirmModalSecondaryButton} onPress={() => setShowReaderExitModal(false)}>
                <Text style={styles.confirmModalSecondaryText}>Keep Reading</Text>
              </Pressable>
              <Pressable style={styles.confirmModalDangerButton} onPress={closeReaderImmediately}>
                <Text style={styles.confirmModalDangerText}>Exit</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={Boolean(bookPendingRemoval)}
        transparent
        animationType="fade"
        onRequestClose={() => !isRemovingBook && setBookPendingRemoval(null)}
      >
        <View style={styles.confirmModalBackdrop}>
          <View style={styles.confirmModalCard}>
            <View style={[styles.confirmModalIconWrap, styles.confirmModalRemoveIconWrap]}>
              <Ionicons name="trash-outline" size={26} color="#8B4C43" />
            </View>
            <Text style={styles.confirmModalTitle}>Remove from My Shelf?</Text>
            <Text style={styles.confirmModalBody}>
              This removes the downloaded copy and reading progress for {bookPendingRemoval?.title ?? "this book"}.
            </Text>
            <View style={styles.confirmModalActions}>
              <Pressable
                style={styles.confirmModalSecondaryButton}
                onPress={() => setBookPendingRemoval(null)}
                disabled={isRemovingBook}
              >
                <Text style={styles.confirmModalSecondaryText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.confirmModalDangerButton, isRemovingBook && styles.confirmModalButtonDisabled]}
                onPress={() => void handleConfirmRemoveBook()}
                disabled={isRemovingBook}
              >
                {isRemovingBook ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.confirmModalDangerText}>Remove</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showReadingRewardModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowReadingRewardModal(false)}
      >
        <View style={styles.rewardModalBackdrop}>
          <View style={styles.rewardModalCard}>
            <View style={styles.rewardModalIconHalo}>
              <View style={styles.rewardModalArtPlaceholder}>
                <Ionicons name="trophy-outline" size={30} color="#6E8C35" />
                <Image source={TALA_IMAGE} style={styles.rewardModalIcon} contentFit="contain" cachePolicy="memory-disk" />
              </View>
            </View>
            <Text style={styles.rewardModalEyebrow}>Reading achievement</Text>
            <Text style={styles.rewardModalTitle}>
              +{claimedReadingAchievement?.rewardTala ?? 0} Tala
            </Text>
            <Text style={styles.rewardModalBody}>
              {readingRewardMessage || `${claimedReadingAchievement?.title ?? "Achievement"} unlocked.`}
            </Text>
            <Pressable style={styles.rewardModalButton} onPress={() => setShowReadingRewardModal(false)}>
              <Text style={styles.rewardModalButtonText}>Keep Reading</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Floating Apple Bottom Nav */}
      <View style={[styles.bottomNavContainer, { bottom: Math.max(insets.bottom, 12) + 18 }]}>
        <View
          style={styles.shelfTabsTrack}
          onLayout={(e) => setShelfTabsWidth(e.nativeEvent.layout.width)}
        >
          {tabWidth > 0 ? (
            <Animated.View
              style={[
                styles.shelfSlidingPill,
                {
                  width: tabWidth,
                  transform: [
                    {
                      translateX: slideAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, tabWidth],
                      }),
                    },
                  ],
                },
              ]}
            />
          ) : null}

          <Pressable
            style={styles.shelfTabItem}
            onPress={() => handleShelfTabChange("featured")}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeShelf === "featured" }}
          >
            <Ionicons
              name={activeShelf === "featured" ? "sparkles" : "sparkles-outline"}
              size={17}
              color={activeShelf === "featured" ? "#2E7C1F" : "#64748B"}
            />
            <Text style={[styles.shelfTabText, activeShelf === "featured" && styles.shelfTabTextActive]}>
              Featured
            </Text>
          </Pressable>

          <Pressable
            style={styles.shelfTabItem}
            onPress={() => handleShelfTabChange("my")}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeShelf === "my" }}
          >
            <Ionicons
              name={activeShelf === "my" ? "bookmark" : "bookmark-outline"}
              size={17}
              color={activeShelf === "my" ? "#2E7C1F" : "#64748B"}
            />
            <Text style={[styles.shelfTabText, activeShelf === "my" && styles.shelfTabTextActive]}>
              My Shelf
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F7FAF6" },
  topBar: {
    height: 52,
    borderBottomWidth: 1,
    borderBottomColor: "#D5E8CB",
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    shadowColor: "#6F845C",
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2 },
  backButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center" },
  topTitle: {
    color: "#37475C",
    fontSize: 18,
    lineHeight: 24,
    fontFamily: "Outfit-Bold" },
  topBarSpacer: {
    width: 36,
    height: 36 },
  scroll: {
    flex: 1 },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 84,
    paddingBottom: 115,
    alignItems: "center" },
  scrollContentCompact: {
    paddingHorizontal: 12 },
  contentFrame: {
    width: "100%",
    maxWidth: 420,
    alignSelf: "center" },
  heroCard: {
    width: "100%",
    borderRadius: 30,
    backgroundColor: "#E8F6DF",
    borderWidth: 1,
    borderColor: "#D5E8CB",
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 18,
    overflow: "hidden",
    marginBottom: 14 },
  heroCardCompact: {
    paddingHorizontal: 14,
    paddingTop: 16,
    paddingBottom: 16 },
  heroGlowOne: {
    position: "absolute",
    top: -34,
    right: -18,
    width: 162,
    height: 162,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.24)" },
  heroGlowTwo: {
    position: "absolute",
    left: -28,
    bottom: -54,
    width: 132,
    height: 132,
    borderRadius: 999,
    backgroundColor: "rgba(197, 220, 197, 0.24)" },
  heroHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    columnGap: 12,
    rowGap: 10 },
  heroHeaderRowStacked: {
    flexDirection: "column" },
  heroTextWrap: {
    flex: 1,
    paddingRight: 4 },
  heroBooksCluster: {
    width: 80,
    height: 102,
    justifyContent: "flex-end",
    alignItems: "center",
    alignSelf: "flex-end",
    marginTop: 2 },
  heroBooksClusterStacked: {
    alignSelf: "center",
    marginTop: 8 },
  heroBookSpine: {
    position: "absolute",
    bottom: 8,
    width: 20,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "rgba(82, 71, 54, 0.08)" },
  heroBookSpineOne: {
    left: 8,
    height: 66,
    backgroundColor: LIBRARY_MATCHA.primary },
  heroBookSpineTwo: {
    left: 30,
    height: 56,
    backgroundColor: LIBRARY_MATCHA.surfaceMint },
  heroBookSpineThree: {
    left: 52,
    height: 46,
    backgroundColor: LIBRARY_MATCHA.surfaceTint },
  heroBadge: {
    alignSelf: "flex-start",
    color: "#5C8A4A",
    fontSize: 11,
    lineHeight: 14,
    fontFamily: "Outfit-Bold",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 10 },
  heroTitle: {
    color: "#35485B",
    fontSize: 28,
    lineHeight: 34,
    fontFamily: "Outfit-Bold",
    maxWidth: 280,
    marginBottom: 8 },
  heroTitleCompact: {
    fontSize: 24,
    lineHeight: 30,
    maxWidth: "100%" },
  heroBody: {
    color: "#5C655B",
    fontSize: 14,
    lineHeight: 20,
    maxWidth: 286 },
  heroBodyCompact: {
    maxWidth: "100%" },
  heroStatsRow: {
    flexDirection: "row",
    columnGap: 8,
    marginTop: 16 },
  heroStatsRowWrap: {
    flexWrap: "wrap",
    rowGap: 8,
    justifyContent: "space-between" },
  heroStatPill: {
    flex: 1,
    minWidth: 92,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.78)",
    borderWidth: 1,
    borderColor: "rgba(213, 232, 203, 0.9)",
    paddingHorizontal: 10,
    paddingVertical: 10 },
  heroStatPillCompact: {
    minWidth: "48%" },
  heroStatValue: {
    color: "#394B5A",
    fontSize: 20,
    lineHeight: 24,
    fontFamily: "Outfit-Bold",
    marginBottom: 2 },
  heroStatLabel: {
    color: "#5C655B",
    fontSize: 11,
    lineHeight: 14 },
  introCard: {
    width: "100%",
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D5E8CB",
    paddingHorizontal: 15,
    paddingTop: 14,
    paddingBottom: 14,
    marginBottom: 14,
    shadowColor: "#6F845C",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2 },
  introCardCompact: {
    paddingHorizontal: 13,
    paddingTop: 13,
    paddingBottom: 13 },
  introEyebrow: {
    color: "#5C8A4A",
    fontSize: 11,
    lineHeight: 14,
    fontFamily: "Outfit-Bold",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 4 },
  introTitle: {
    color: "#35485B",
    fontSize: 18,
    lineHeight: 23,
    fontFamily: "Outfit-Bold",
    marginBottom: 6 },
 introBody: {
   color: "#5C655B",
   fontSize: 13,
   lineHeight: 19 },
 shelfTabs: {
   width: "100%",
    borderRadius: 999,
    backgroundColor: "#EDF2EB",
    borderWidth: 1,
    borderColor: "#DEE6DC",
    flexDirection: "row",
    alignItems: "center",
    padding: 4,
    marginBottom: 14 },
  shelfTabButton: {
    flex: 1,
    minHeight: 38,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    columnGap: 6,
    paddingHorizontal: 12 },
  shelfTabButtonActive: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#0F172A",
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2 },
  shelfTabText: {
    color: "#64748B",
    fontSize: 13.5,
    fontFamily: "Outfit-SemiBold",
    textAlign: "center" },
  shelfTabTextActive: {
    color: "#0F172A",
    fontFamily: "Outfit-Bold" },
  shelfTabCountBadge: {
    paddingHorizontal: 7,
    paddingVertical: 1.5,
    borderRadius: 999,
    backgroundColor: "rgba(0, 0, 0, 0.06)" },
  shelfTabCountBadgeActive: {
    backgroundColor: "#EAF6E8" },
  shelfTabCountText: {
    color: "#64748B",
    fontSize: 11,
    fontFamily: "Outfit-Bold" },
  shelfTabCountTextActive: {
    color: "#2E7C1F" },
  searchCard: {
    width: "100%",
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D5E8CB",
    padding: 10,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    columnGap: 8 },
  searchCardCompact: {
    flexDirection: "column",
    alignItems: "stretch",
    rowGap: 8 },
  searchInputWrap: {
    flex: 1,
    minHeight: 44,
    borderRadius: 16,
    backgroundColor: "#F7FAF6",
    borderWidth: 1,
    borderColor: "#D5E8CB",
    flexDirection: "row",
    alignItems: "center",
    columnGap: 8,
    paddingLeft: 12,
    paddingRight: 6 },
  searchCharCount: {
    alignSelf: "flex-end",
    color: "#91A0AB",
    fontSize: 11,
    lineHeight: 14,
    marginTop: 4,
    marginBottom: 2,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    color: "#35485B",
    fontSize: 14,
    lineHeight: 19,
    paddingVertical: 8 },
  searchIconButton: {
    width: 32,
    height: 32,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center" },
 searchButton: {
   minHeight: 44,
   borderRadius: 16,
    backgroundColor: "#52B72A",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    columnGap: 6,
    paddingHorizontal: 14 },
  searchButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    lineHeight: 18,
    fontFamily: "Outfit-Bold" },
  libraryActionMessage: {
    color: "#4F7E3E",
    fontSize: 12,
    lineHeight: 17,
    fontFamily: "Outfit-Bold",
    marginBottom: 10,
    paddingHorizontal: 4 },
  libraryActionMessageError: {
    color: "#9B4B3D" },
  filterIconButton: {
    width: 44,
    minHeight: 44,
    borderRadius: 16,
    backgroundColor: "#F7FAF6",
    borderWidth: 1,
    borderColor: "#D5E8CB",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  filterIconButtonActive: {
    backgroundColor: "#70C943",
    borderColor: "#70C943",
  },
  filterActiveDot: {
    position: "absolute",
    top: 7,
    right: 7,
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: "#E8F6DF",
    borderWidth: 1,
    borderColor: "#70C943",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(12, 35, 65, 0.4)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  filterModalCard: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#D5E8CB",
    padding: 20,
    shadowColor: "#6F845C",
    shadowOpacity: 0.16,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  filterModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  filterModalIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#E8F6DF",
    alignItems: "center",
    justifyContent: "center",
  },
  filterModalTitle: {
    color: "#35485B",
    fontSize: 17,
    lineHeight: 22,
    fontFamily: "Outfit-Bold",
  },
  filterModalCloseButton: {
    width: 30,
    height: 30,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F7FAF6",
  },
  filterModalSection: {
    marginBottom: 16,
  },
  filterModalSectionTitle: {
    color: "#5C655B",
    fontSize: 13,
    lineHeight: 18,
    fontFamily: "Outfit-Bold",
    marginBottom: 8,
  },
  filterModalOptionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  filterModalOptionPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: "#F7FAF6",
    borderWidth: 1,
    borderColor: "#D5E8CB",
  },
  filterModalOptionPillActive: {
    backgroundColor: "#70C943",
    borderColor: "#70C943",
  },
  filterModalOptionText: {
    color: "#5C655B",
    fontSize: 13,
    lineHeight: 17,
    fontFamily: "Outfit-SemiBold",
  },
  filterModalOptionTextActive: {
    color: "#FFFFFF",
    fontFamily: "Outfit-Bold",
  },
  filterModalActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#F0F5ED",
  },
  filterModalResetButton: {
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 14,
  },
  filterModalResetText: {
    color: "#7E8B7B",
    fontSize: 13,
    lineHeight: 18,
    fontFamily: "Outfit-SemiBold",
  },
  filterModalDoneButton: {
    backgroundColor: "#70C943",
    paddingVertical: 9,
    paddingHorizontal: 22,
    borderRadius: 14,
  },
  filterModalDoneText: {
    color: "#FFFFFF",
    fontSize: 13,
    lineHeight: 18,
    fontFamily: "Outfit-Bold",
  },
  sectionHeader: {
    width: "100%",
    marginBottom: 10,
    paddingHorizontal: 2 },
  sectionTitle: {
    color: "#35485B",
    fontSize: 20,
    lineHeight: 26,
    fontFamily: "Outfit-Bold",
    marginBottom: 2 },
  sectionSubTitle: {
    color: "#5C655B",
    fontSize: 13,
    lineHeight: 18 },
  bookList: {
    width: "100%",
    rowGap: 12 },
  paginationRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    columnGap: 8,
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "#F7FAF6",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#D5E8CB",
  },
  paginationArrowButton: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D5E8CB",
    alignItems: "center",
    justifyContent: "center",
  },
  paginationArrowButtonDisabled: {
    backgroundColor: "transparent",
    borderColor: "transparent",
  },
  paginationNumbersRow: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 6,
  },
  paginationNumberBox: {
    minWidth: 32,
    height: 32,
    paddingHorizontal: 6,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D5E8CB",
    alignItems: "center",
    justifyContent: "center",
  },
  paginationNumberBoxActive: {
    backgroundColor: "#70C943",
    borderColor: "#70C943",
  },
  paginationNumberText: {
    color: "#35485B",
    fontSize: 13,
    lineHeight: 17,
    fontFamily: "Outfit-Bold",
  },
  paginationNumberTextActive: {
    color: "#FFFFFF",
  },
  paginationDotsWrap: {
    width: 20,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  paginationDotsText: {
    color: "#7E8B7B",
    fontSize: 13,
    lineHeight: 16,
    fontFamily: "Outfit-Bold",
    letterSpacing: 1,
  },
  loadingCard: {
    width: "100%",
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D5E8CB",
    paddingHorizontal: 18,
    paddingVertical: 24,
    alignItems: "center",
    rowGap: 10 },
  loadingText: {
    color: "#5C655B",
    fontSize: 13,
    lineHeight: 18,
    fontFamily: "Outfit-SemiBold" },
  emptyCard: {
    width: "100%",
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D5E8CB",
    paddingHorizontal: 18,
    paddingVertical: 22,
    alignItems: "center" },
  emptyTitle: {
    color: "#35485B",
    fontSize: 17,
    lineHeight: 22,
    fontFamily: "Outfit-Bold",
    marginBottom: 6,
    textAlign: "center" },
  emptyText: {
    color: "#5C655B",
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center" },
  retryButton: {
    marginTop: 14,
    minHeight: 40,
    borderRadius: 999,
    backgroundColor: "#70C943",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18 },
  retryButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    lineHeight: 18,
    fontFamily: "Outfit-Bold" },
  bookCardWrap: {
    width: "100%",
  },
  bottomNavContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    zIndex: 90,
    backgroundColor: "transparent",
  },
  shelfTabsTrack: {
    width: "100%",
    maxWidth: 380,
    height: 52,
    borderRadius: 999,
    backgroundColor: "rgba(228, 237, 226, 0.95)",
    borderWidth: 1,
    borderColor: "rgba(211, 227, 207, 0.9)",
    flexDirection: "row",
    position: "relative",
    padding: 4,
    shadowColor: "#0F172A",
    shadowOpacity: 0.14,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  shelfSlidingPill: {
    position: "absolute",
    top: 4,
    left: 4,
    bottom: 4,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    shadowColor: "#0F172A",
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  shelfTabItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    columnGap: 6,
    zIndex: 2,
    borderRadius: 999,
  },
  bookCard: {
    width: "100%",
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D5E8CB",
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 14,
    overflow: "hidden",
    shadowColor: "#6F845C",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2 },
  bookCardCompact: {
    paddingHorizontal: 12,
    paddingTop: 13,
    paddingBottom: 13 },
  bookCardTopRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    columnGap: 8,
    rowGap: 6,
    marginBottom: 12 },
  bookTag: {
    borderRadius: 999,
    backgroundColor: "#F7FAF6",
    borderWidth: 1,
    borderColor: "#D5E8CB",
    paddingHorizontal: 10,
    paddingVertical: 6 },
  bookTagText: {
    color: "#5C655B",
    fontSize: 11,
    lineHeight: 14,
    fontFamily: "Outfit-Bold" },
  bookCardBody: {
    flexDirection: "row",
    alignItems: "flex-start",
    columnGap: 12 },
  bookCardBodyStacked: {
    flexDirection: "column",
    rowGap: 8 },
  bookCoverWrap: {
    width: 92,
    height: 118,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    padding: 10 },
  bookCoverWrapCompact: {
    width: 100,
    height: 108,
    borderRadius: 20 },
  bookCoverWrapStacked: {
    alignSelf: "center",
    marginBottom: 2 },
  bookCoverImage: {
    width: 64,
    height: 82 },
  bookCoverPlaceholder: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4 },
  bookCoverInitial: {
    color: LIBRARY_MATCHA.text,
    fontSize: 26,
    lineHeight: 32,
    fontFamily: "Outfit-Bold",
    marginBottom: 2 },
  bookCoverPlaceholderLabel: {
    color: LIBRARY_MATCHA.textMuted,
    fontSize: 10,
    lineHeight: 12,
    fontFamily: "Outfit-SemiBold",
    textAlign: "center" },
  bookInfoWrap: {
    flex: 1,
    minWidth: 0,
    paddingTop: 2 },
  bookCategory: {
    color: "#6F845C",
    fontSize: 11,
    lineHeight: 14,
    fontFamily: "Outfit-Bold",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    marginBottom: 4 },
  bookTitle: {
    color: "#35485B",
    fontSize: 19,
    lineHeight: 24,
    fontFamily: "Outfit-Bold",
    marginBottom: 2 },
  bookTitleCompact: {
    fontSize: 18,
    lineHeight: 23 },
  bookAuthor: {
    color: "#81776A",
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 7 },
  bookBlurb: {
    color: "#5D564D",
    fontSize: 13,
    lineHeight: 19 },
  bookMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10 },
  bookMetaPill: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 5,
    borderRadius: 999,
    backgroundColor: "#F7FAF6",
    borderWidth: 1,
    borderColor: "#D5E8CB",
    paddingHorizontal: 9,
    paddingVertical: 6 },
  bookMetaText: {
    color: "#5C655B",
    fontSize: 11,
    lineHeight: 14,
    fontFamily: "Outfit-SemiBold" },
  bookAccessHelper: {
    color: LIBRARY_MATCHA.textSoft,
    fontSize: 11,
    lineHeight: 15,
    fontFamily: "Outfit-Regular",
    marginTop: 8 },
  bookActionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 12 },
 bookReadButton: {
   minHeight: 38,
   borderRadius: 999,
    backgroundColor: "#52B72A",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    columnGap: 6,
    paddingHorizontal: 15 },
  bookReadButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    lineHeight: 18,
    fontFamily: "Outfit-Bold" },
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
    paddingHorizontal: 15 },
  bookActionButtonDisabled: {
    opacity: 0.68 },
  bookDownloadButtonText: {
    color: "#4D6243",
    fontSize: 13,
    lineHeight: 18,
    fontFamily: "Outfit-Bold" },
  bookRemoveButton: {
    minHeight: 38,
    borderRadius: 999,
    backgroundColor: "#FCECE8",
    borderWidth: 1,
    borderColor: "#F2C7BD",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    columnGap: 6,
    paddingHorizontal: 13 },
  bookRemoveButtonText: {
    color: "#8B4C43",
    fontSize: 13,
    lineHeight: 18,
    fontFamily: "Outfit-Bold" },
  bookExternalButton: {
    minHeight: 38,
    borderRadius: 999,
    backgroundColor: "#4E7E9E",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    columnGap: 6,
    paddingHorizontal: 15 },
  bookExternalButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    lineHeight: 18,
    fontFamily: "Outfit-Bold" },
  bookDisabledCta: {
    minHeight: 38,
    borderRadius: 999,
    backgroundColor: "#EBF3E8",
    borderWidth: 1,
    borderColor: "#D5E8CB",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    columnGap: 6,
    paddingHorizontal: 13,
    opacity: 0.85 },
  bookDisabledCtaText: {
    color: LIBRARY_MATCHA.textSoft,
    fontSize: 12,
    lineHeight: 16,
    fontFamily: "Outfit-Bold" },
  readerScreen: {
    flex: 1,
  },
  readerHeader: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 6,
    borderBottomWidth: 1,
    zIndex: 10,
  },
  readerHeaderTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  readerCloseCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0F172A",
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  readerHeaderCenter: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 8,
  },
  readerHeaderCategory: {
    fontSize: 10.5,
    fontFamily: "Outfit-Bold",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  readerHeaderBookTitle: {
    fontSize: 14.5,
    fontFamily: "Outfit-Bold",
    letterSpacing: -0.2,
  },
  readerHeaderActions: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 6,
  },
  readerThemeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  readerFontButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  readerFontButtonText: {
    fontSize: 13,
    fontFamily: "Outfit-Bold",
  },
  readerPagePill: {
    paddingHorizontal: 8,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  readerPagePillText: {
    fontSize: 11,
    fontFamily: "Outfit-Bold",
  },
  readerProgressTrack: {
    height: 3,
    backgroundColor: "rgba(0,0,0,0.06)",
    borderRadius: 999,
    overflow: "hidden",
  },
  readerProgressFill: {
    height: "100%",
    backgroundColor: "#52B72A",
    borderRadius: 999,
  },

  readerMainArea: {
    flex: 1,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 6,
  },
  readerPageCard: {
    flex: 1,
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
    position: "relative",
    shadowColor: "#0F172A",
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  readerAnimatedPageWrap: {
    flex: 1,
  },
  readerLoadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    rowGap: 10,
  },
  readerLoadingText: {
    fontSize: 13,
    fontFamily: "Outfit-Medium",
  },
  readerInlineErrorText: {
    color: "#DC2626",
    fontSize: 12,
    fontFamily: "Outfit-Bold",
    marginBottom: 8,
  },
  readerPageEyebrow: {
    fontSize: 11,
    fontFamily: "Outfit-Bold",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  readerPageTitle: {
    fontSize: 24,
    lineHeight: 30,
    fontFamily: "Outfit-Bold",
    letterSpacing: -0.3,
    marginBottom: 16,
  },
  readerPageScroll: {
    flex: 1,
  },
  readerPageScrollContent: {
    paddingBottom: 16,
  },
  readerPageBody: {
    fontFamily: "Outfit-Regular",
    marginBottom: 16,
    letterSpacing: 0.2,
  },
  readerEndOfPageSpacer: {
    height: 24,
  },
  readerPageFooterRow: {
    alignItems: "center",
    paddingTop: 6,
    paddingBottom: 2,
  },
  readerPageFooterText: {
    fontSize: 11,
    fontFamily: "Outfit-Medium",
  },

  /* Reward Milestone Bubble */
  readerRewardBubble: {
    position: "absolute",
    right: 12,
    bottom: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  readerRewardRingBox: {
    width: READING_REWARD_RING_SIZE,
    height: READING_REWARD_RING_SIZE,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  readerRewardIconWrap: {
    width: READING_REWARD_RING_SIZE,
    height: READING_REWARD_RING_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  readerRewardIcon: {
    width: 20,
    height: 20,
  },
  readerRewardGoalPill: {
    marginTop: 4,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 999,
    borderWidth: 1,
  },
  readerRewardGoalText: {
    fontSize: 9.5,
    fontFamily: "Outfit-Bold",
  },

  /* Bottom Control Dock */
  readerControlDock: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
    borderTopWidth: 1,
    columnGap: 10,
  },
  readerNavCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0F172A",
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  readerNavCircleDisabled: {
    opacity: 0.4,
  },
  readerRatingPill: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 8,
    paddingHorizontal: 12,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    shadowColor: "#0F172A",
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  readerRatingLabel: {
    fontSize: 11,
    fontFamily: "Outfit-Bold",
    letterSpacing: 0.4,
  },
  ratingStarsRow: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 2,
  },
  ratingStarButton: {
    padding: 2,
  },
  readerPrimaryActionPill: {
    flex: 1,
    maxWidth: 160,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#52B72A",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    columnGap: 6,
    paddingHorizontal: 14,
    shadowColor: "#52B72A",
    shadowOpacity: 0.28,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  readerPrimaryButtonDisabled: {
    opacity: 0.6,
  },
  readerPrimaryActionText: {
    color: "#FFFFFF",
    fontSize: 13.5,
    fontFamily: "Outfit-Bold",
  },

  confirmModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(45, 38, 28, 0.38)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24 },
  confirmModalCard: {
    width: "100%",
    maxWidth: 342,
    borderRadius: 26,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D5E8CB",
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 18,
    alignItems: "center",
    shadowColor: "#5C4B35",
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 7 },
  confirmModalIconWrap: {
    width: 58,
    height: 58,
    borderRadius: 999,
    backgroundColor: "#FFF3C4",
    borderWidth: 1,
    borderColor: "#F0D88A",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12 },
  confirmModalRemoveIconWrap: {
    backgroundColor: "#FCECE8",
    borderColor: "#F2C7BD" },
  confirmModalIcon: {
    width: 30,
    height: 30 },
  confirmModalTitle: {
    color: LIBRARY_MATCHA.text,
    fontSize: 22,
    lineHeight: 28,
    fontFamily: "Outfit-Bold",
    textAlign: "center",
    marginBottom: 7 },
  confirmModalBody: {
    color: "#675F53",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    marginBottom: 18 },
  confirmModalActions: {
    width: "100%",
    flexDirection: "row",
    columnGap: 9 },
  confirmModalSecondaryButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 999,
    backgroundColor: "#F7FAF6",
    borderWidth: 1,
    borderColor: "#E6D9C8",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12 },
  confirmModalSecondaryText: {
    color: "#5E574D",
    fontSize: 13,
    lineHeight: 18,
    fontFamily: "Outfit-Bold",
    textAlign: "center" },
  confirmModalDangerButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 999,
    backgroundColor: "#8B4C43",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12 },
  confirmModalButtonDisabled: {
    opacity: 0.68 },
  confirmModalDangerText: {
    color: "#FFFFFF",
    fontSize: 13,
    lineHeight: 18,
    fontFamily: "Outfit-Bold",
    textAlign: "center" },
  rewardModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(45, 38, 28, 0.36)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24 },
  rewardModalCard: {
    width: "100%",
    maxWidth: 340,
    borderRadius: 28,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D5E8CB",
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 20,
    alignItems: "center",
    shadowColor: "#5C4B35",
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 7 },
  rewardModalIconHalo: {
    width: 82,
    height: 82,
    borderRadius: 999,
    backgroundColor: "#FFF3C4",
    borderWidth: 1,
    borderColor: "#F0D88A",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12 },
  rewardModalIcon: {
    position: "absolute",
    right: -4,
    bottom: -2,
    width: 28,
    height: 28 },
  rewardModalArtPlaceholder: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: "#F8FFE8",
    borderWidth: 1,
    borderColor: "#DCECA9",
    alignItems: "center",
    justifyContent: "center" },
  rewardModalEyebrow: {
    color: "#8A7552",
    fontSize: 11,
    lineHeight: 14,
    fontFamily: "Outfit-Bold",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 5 },
  rewardModalTitle: {
    color: LIBRARY_MATCHA.text,
    fontSize: 28,
    lineHeight: 34,
    fontFamily: "Outfit-Bold",
    marginBottom: 7 },
  rewardModalBody: {
    color: "#675F53",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    marginBottom: 18 },
  rewardModalButton: {
    minHeight: 44,
    borderRadius: 999,
    backgroundColor: "#70C943",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 22 },
  rewardModalButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    lineHeight: 18,
    fontFamily: "Outfit-Bold" } });
