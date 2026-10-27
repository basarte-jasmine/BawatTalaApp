import type { LibraryBookRecord } from "./backend-api";

export const BUILT_IN_LIBRARY_BOOKS: LibraryBookRecord[] = [
  
  {
    accessType: "full",
    previewOnly: false,
    accentColor: "#A8E08A",
    actionLabel: "Read",
    author: "Ichiro Kishimi, Fumitake Koga",
    blurb: "A bundled EPUB about self-acceptance, courage, and personal responsibility.",
    bundledEpubAsset: require("../assets/books/The Courage to Be Disliked.epub"),
    category: "Self Reflection",
    coverImageUrl: "",
    downloadableEpub: true,
    downloaded: true,
    downloadedAt: null,
    downloadUrl: "",
    estimatedMinutes: 280,
    externalReaderLink: "",
    id: "builtin-courage-to-be-disliked",
    isFreeEbook: false,
    language: "eng",
    pageCount: 0,
    previewLink: "",
    provider: "builtin",
    publishedDate: "",
    publisher: "",
    readerLink: "",
    rewardLabel: "Rate after reading",
    shelfLabel: "Personal library",
    sourceId: "The Courage to Be Disliked.epub",
    sourceReaderLink: "",
    statusLabel: "Ready to read",
    supportsInAppReader: true,
    title: "The Courage to Be Disliked",
    progress: null,
  },
];

export const BUILT_IN_LIBRARY_BOOK_IDS = BUILT_IN_LIBRARY_BOOKS.map((book) => book.id);
