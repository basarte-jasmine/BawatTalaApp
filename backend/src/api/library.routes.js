const express = require("express");
const https = require("https");
const { query } = require("../config/db");

const router = express.Router();
const STUDENT_NUMBER_PATTERN = /^\d{2}-\d{4}$/;
const DEFAULT_BOOK_QUERY = "subject:psychology mental health wellbeing stress anxiety";
const GOOGLE_BOOKS_ENDPOINT = "https://www.googleapis.com/books/v1/volumes";
const ANNA_ARCHIVE_ENDPOINT = "https://annas-archive-api.p.rapidapi.com/search";
const ANNA_ARCHIVE_RAPIDAPI_HOST = "annas-archive-api.p.rapidapi.com";
const ANNA_ARCHIVE_DEFAULT_CATEGORIES = "fiction, nonfiction, comic, magazine, musicalscore, other, unknown";
const ANNA_ARCHIVE_DEFAULT_EXTENSIONS = "pdf, epub, mobi, azw3";
const ANNA_ARCHIVE_DEFAULT_SORT = "mostRelevant";
const ANNA_ARCHIVE_DEFAULT_SOURCES = "libgenLi, libgenRs";
const MAX_BOOK_RESULTS = 24;
const RELEVANCE_KEYWORDS = [
  "anxiety",
  "behavior",
  "cognitive",
  "counseling",
  "depression",
  "emotion",
  "emotional",
  "health",
  "mental",
  "mindfulness",
  "psychology",
  "resilience",
  "self-help",
  "stress",
  "therapy",
  "wellbeing",
  "wellness",
];
const ACCENT_COLORS = ["#D7F0B7", "#CFE6F8", "#E8D7F2", "#F8E8BE", "#D7EBE5", "#F1D4D4"];

function normalizeCompactSpaces(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function normalizeStudentNumber(value) {
  const compact = normalizeCompactSpaces(value).replace(/\s+/g, "");
  const match = compact.match(/^(\d{2})[- ]?(\d{4})$/);
  if (!match) return compact;
  return `${match[1]}-${match[2]}`;
}

function clampInteger(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function stripHtml(value) {
  return String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function truncateText(value, maxLength) {
  const text = stripHtml(value);
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trim()}...`;
}

function fetchJson(url, { headers = {}, serviceName = "Library API" } = {}) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers }, (response) => {
        let body = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          body += chunk;
        });
        response.on("end", () => {
          let parsed = {};
          try {
            parsed = body ? JSON.parse(body) : {};
          } catch (error) {
            reject(new Error(`${serviceName} returned an unreadable response.`));
            return;
          }

          if (response.statusCode < 200 || response.statusCode >= 300) {
            reject(new Error(parsed?.error?.message || parsed?.message || `${serviceName} request failed.`));
            return;
          }

          resolve(parsed);
        });
      })
      .on("error", reject);
  });
}

function getLibraryBooksProvider() {
  const configuredProvider = String(process.env.LIBRARY_BOOKS_PROVIDER || "").trim().toLowerCase();
  if (configuredProvider) return configuredProvider;
  return process.env.ANNA_ARCHIVE_RAPIDAPI_KEY ? "anna" : "google";
}

function getImageUrl(imageLinks = {}) {
  const rawUrl = imageLinks.thumbnail || imageLinks.smallThumbnail || "";
  return rawUrl ? String(rawUrl).replace(/^http:\/\//i, "https://") : "";
}

function isRelevantBook(volume) {
  const info = volume.volumeInfo || {};
  const searchable = [
    info.title,
    info.subtitle,
    info.description,
    ...(Array.isArray(info.categories) ? info.categories : []),
  ]
    .join(" ")
    .toLowerCase();

  return RELEVANCE_KEYWORDS.some((keyword) => searchable.includes(keyword));
}

function isFreeGoogleBook(volume) {
  const saleability = String(volume.saleInfo?.saleability || "").toUpperCase();
  return saleability !== "FOR_SALE" && saleability !== "FOR_SALE_AND_RENTAL";
}

function getReaderLink(accessInfo = {}, info = {}) {
  return accessInfo.webReaderLink || info.previewLink || info.infoLink || "";
}

function findFirstArray(value, depth = 0) {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object" || depth > 3) return [];

  for (const key of ["books", "results", "items", "data", "docs", "records"]) {
    const found = findFirstArray(value[key], depth + 1);
    if (found.length) return found;
  }

  return [];
}

function pickString(source, keys) {
  for (const key of keys) {
    const value = source?.[key];
    if (Array.isArray(value)) {
      const compact = value
        .map((item) => (typeof item === "object" ? item?.name || item?.title || "" : item))
        .filter(Boolean)
        .join(", ");
      if (compact) return normalizeCompactSpaces(compact);
    }
    if (value !== null && value !== undefined && typeof value !== "object") {
      const compact = normalizeCompactSpaces(value);
      if (compact) return compact;
    }
  }
  return "";
}

function pickInteger(source, keys, min, max, fallback) {
  for (const key of keys) {
    const parsed = Number(source?.[key]);
    if (Number.isInteger(parsed)) return Math.max(min, Math.min(max, parsed));
  }
  return fallback;
}

function getAnnaCoverUrl(book) {
  const rawUrl = pickString(book, ["coverImageUrl", "cover_url", "coverUrl", "cover", "thumbnail", "image"]);
  if (!rawUrl) return "";
  if (rawUrl.startsWith("//")) return `https:${rawUrl}`;
  return rawUrl.replace(/^http:\/\//i, "https://");
}

function mapAnnaBook(book, index, progressByBookId) {
  const title = pickString(book, ["title", "bookTitle", "name"]) || "Untitled book";
  const rawId = pickString(book, ["id", "md5", "bookId", "isbn13", "isbn", "aarecord_id"]);
  const id = rawId ? `anna-${rawId}` : `anna-${index}-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
  const pageCount = pickInteger(book, ["pageCount", "pages", "numPages"], 0, 2000, 0);
  const extension = pickString(book, ["extension", "ext", "format", "fileExtension"]).toLowerCase();
  const category = pickString(book, ["category", "cat", "topic", "genre"]) || "Mental Health";
  const progress = progressByBookId.get(id) || null;

  return {
    accentColor: ACCENT_COLORS[index % ACCENT_COLORS.length],
    author: pickString(book, ["authors", "author", "creator"]) || "Library catalog",
    blurb: truncateText(pickString(book, ["description", "summary", "subtitle"]) || "A library catalog result related to mental health and wellbeing.", 650),
    category,
    coverImageUrl: getAnnaCoverUrl(book),
    downloadableEpub: extension.includes("epub"),
    downloadablePdf: extension.includes("pdf"),
    estimatedMinutes: Math.max(4, Math.min(45, pageCount ? Math.ceil(pageCount / 25) : 8)),
    id,
    infoLink: "",
    isFreeEbook: false,
    language: pickString(book, ["language", "lang"]),
    pageCount,
    previewLink: "",
    publishedDate: pickString(book, ["publishedDate", "publishDate", "year"]),
    publisher: pickString(book, ["publisher"]),
    readerLink: "",
    rewardLabel: progress?.rating ? `${progress.rating}/5 stars` : "Rate after reading",
    shelfLabel: "Catalog shelf",
    title,
    progress,
  };
}

function mapGoogleBook(volume, index, progressByBookId) {
  const info = volume.volumeInfo || {};
  const saleInfo = volume.saleInfo || {};
  const accessInfo = volume.accessInfo || {};
  const categories = Array.isArray(info.categories) ? info.categories : [];
  const authors = Array.isArray(info.authors) && info.authors.length ? info.authors.join(", ") : "Google Books";
  const pageCount = clampInteger(info.pageCount, 0, 2000, 0);
  const estimatedMinutes = Math.max(4, Math.min(45, pageCount ? Math.ceil(pageCount / 25) : 8));
  const progress = progressByBookId.get(volume.id) || null;

  return {
    accentColor: ACCENT_COLORS[index % ACCENT_COLORS.length],
    author: authors,
    blurb: truncateText(info.description || info.subtitle || "A free mental-health and wellbeing read from Google Books.", 650),
    category: categories[0] || "Mental Health",
    coverImageUrl: getImageUrl(info.imageLinks),
    downloadableEpub: Boolean(accessInfo.epub?.isAvailable),
    downloadablePdf: Boolean(accessInfo.pdf?.isAvailable),
    estimatedMinutes,
    id: volume.id,
    infoLink: info.infoLink || "",
    isFreeEbook: saleInfo.saleability === "FREE" || accessInfo.viewability === "ALL_PAGES",
    language: info.language || "",
    pageCount,
    previewLink: info.previewLink || "",
    publishedDate: info.publishedDate || "",
    publisher: info.publisher || "",
    readerLink: getReaderLink(accessInfo, info),
    rewardLabel: progress?.rating ? `${progress.rating}/5 stars` : "Rate after reading",
    shelfLabel: "Free shelf",
    title: info.title || "Untitled book",
    progress,
  };
}

function mapProgressRow(row) {
  if (!row) return null;
  return {
    bookId: row.google_volume_id,
    currentPage: Number(row.current_page || 0),
    finishedAt: row.finished_at || null,
    lastOpenedAt: row.last_opened_at || null,
    percent: Number(row.progress_percent || 0),
    rating: row.rating === null || row.rating === undefined ? null : Number(row.rating),
    status: row.status || "STARTED",
    totalPages: Number(row.total_pages || 0),
    updatedAt: row.updated_at || null,
  };
}

async function getStudentProgress(studentNumber, bookIds) {
  if (!STUDENT_NUMBER_PATTERN.test(studentNumber) || !bookIds.length) {
    return new Map();
  }

  const result = await query(
    `
      select google_volume_id, current_page, total_pages, progress_percent, status, rating,
             finished_at, last_opened_at, updated_at
      from public.student_library_progress
      where student_number = $1
        and google_volume_id = any($2::text[])
    `,
    [studentNumber, bookIds],
  );

  return new Map(result.rows.map((row) => [row.google_volume_id, mapProgressRow(row)]));
}

async function upsertProgress({
  authors,
  bookId,
  bookTitle,
  currentPage,
  rating,
  status,
  studentNumber,
  totalPages,
}) {
  const progressPercent = totalPages > 0 ? Math.round((Math.min(currentPage + 1, totalPages) / totalPages) * 100) : 0;
  const result = await query(
    `
      insert into public.student_library_progress (
        student_number,
        google_volume_id,
        book_title,
        book_authors,
        current_page,
        total_pages,
        progress_percent,
        status,
        rating,
        finished_at,
        last_opened_at,
        updated_at
      )
      values (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        case when $8 = 'FINISHED' then now() else null end,
        now(),
        now()
      )
      on conflict (student_number, google_volume_id)
      do update set
        book_title = coalesce(excluded.book_title, public.student_library_progress.book_title),
        book_authors = coalesce(excluded.book_authors, public.student_library_progress.book_authors),
        current_page = excluded.current_page,
        total_pages = excluded.total_pages,
        progress_percent = excluded.progress_percent,
        status = excluded.status,
        rating = coalesce(excluded.rating, public.student_library_progress.rating),
        finished_at = case
          when excluded.status = 'FINISHED' then coalesce(public.student_library_progress.finished_at, now())
          else public.student_library_progress.finished_at
        end,
        last_opened_at = now(),
        updated_at = now()
      returning google_volume_id, current_page, total_pages, progress_percent, status, rating,
                finished_at, last_opened_at, updated_at
    `,
    [studentNumber, bookId, bookTitle || null, authors || null, currentPage, totalPages, progressPercent, status, rating ?? null],
  );

  return mapProgressRow(result.rows[0]);
}

router.get("/books", async (req, res) => {
  const studentNumber = normalizeStudentNumber(req.query.studentNumber || "");
  const maxResults = clampInteger(Number(req.query.maxResults || MAX_BOOK_RESULTS), 1, 40, MAX_BOOK_RESULTS);
  const searchQuery = normalizeCompactSpaces(req.query.q || DEFAULT_BOOK_QUERY);
  const provider = getLibraryBooksProvider();

  if (provider === "anna") {
    const apiKey = String(process.env.ANNA_ARCHIVE_RAPIDAPI_KEY || "").trim();
    if (!apiKey) {
      return res.status(500).json({ message: "Anna's Archive RapidAPI key is not configured." });
    }

    try {
      const params = new URLSearchParams({
        cat: String(process.env.ANNA_ARCHIVE_CATEGORIES || ANNA_ARCHIVE_DEFAULT_CATEGORIES),
        ext: String(process.env.ANNA_ARCHIVE_EXTENSIONS || ANNA_ARCHIVE_DEFAULT_EXTENSIONS),
        page: String(clampInteger(Number(req.query.page || 1), 1, 100, 1)),
        q: searchQuery.replace(/^subject:/i, ""),
        sort: String(process.env.ANNA_ARCHIVE_SORT || ANNA_ARCHIVE_DEFAULT_SORT),
      });
      const sources = String(process.env.ANNA_ARCHIVE_SOURCES || ANNA_ARCHIVE_DEFAULT_SOURCES).trim();
      if (sources) {
        params.set("source", sources);
      }

      const data = await fetchJson(`${ANNA_ARCHIVE_ENDPOINT}?${params.toString()}`, {
        headers: {
          "Content-Type": "application/json",
          "x-rapidapi-host": String(process.env.ANNA_ARCHIVE_RAPIDAPI_HOST || ANNA_ARCHIVE_RAPIDAPI_HOST),
          "x-rapidapi-key": apiKey,
        },
        serviceName: "Anna's Archive",
      });
      const selectedItems = findFirstArray(data).slice(0, maxResults);
      const bookIds = selectedItems
        .map((item, index) => {
          const title = pickString(item, ["title", "bookTitle", "name"]) || "Untitled book";
          const rawId = pickString(item, ["id", "md5", "bookId", "isbn13", "isbn", "aarecord_id"]);
          return rawId ? `anna-${rawId}` : `anna-${index}-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
        })
        .filter(Boolean);
      const progressByBookId = await getStudentProgress(studentNumber, bookIds);
      const books = selectedItems.map((item, index) => mapAnnaBook(item, index, progressByBookId));

      return res.json({
        books,
        query: searchQuery,
        totalItems: Number(data.totalItems || data.total || data.count || books.length),
      });
    } catch (error) {
      return res.status(502).json({ message: error.message || "Failed to load library books." });
    }
  }

  const apiKey = String(process.env.GOOGLE_BOOKS_API_KEY || "").trim();
  if (!apiKey) {
    return res.status(500).json({ message: "Google Books API key is not configured." });
  }

  try {
    const params = new URLSearchParams({
      filter: "free-ebooks",
      key: apiKey,
      langRestrict: "en",
      maxResults: String(maxResults),
      orderBy: "relevance",
      printType: "books",
      q: searchQuery,
    });
    const data = await fetchJson(`${GOOGLE_BOOKS_ENDPOINT}?${params.toString()}`);
    const items = Array.isArray(data.items) ? data.items : [];
    const freeItems = items.filter(isFreeGoogleBook);
    const relevantItems = freeItems.filter(isRelevantBook);
    const selectedItems = relevantItems.length ? relevantItems : freeItems;
    const bookIds = selectedItems.map((item) => item.id).filter(Boolean);
    const progressByBookId = await getStudentProgress(studentNumber, bookIds);
    const books = selectedItems.map((item, index) => mapGoogleBook(item, index, progressByBookId));

    return res.json({
      books,
      query: searchQuery,
      totalItems: Number(data.totalItems || books.length),
    });
  } catch (error) {
    return res.status(502).json({ message: error.message || "Failed to load library books." });
  }
});

router.post("/progress", async (req, res) => {
  const studentNumber = normalizeStudentNumber(req.body.studentNumber || "");
  const bookId = normalizeCompactSpaces(req.body.bookId || "");
  const currentPage = clampInteger(Number(req.body.currentPage), 0, 1000, 0);
  const totalPages = clampInteger(Number(req.body.totalPages), 1, 1000, 1);
  const status = String(req.body.status || "STARTED").trim().toUpperCase() === "FINISHED" ? "FINISHED" : "STARTED";

  if (!STUDENT_NUMBER_PATTERN.test(studentNumber)) {
    return res.status(400).json({ message: "Valid student number is required." });
  }
  if (!bookId) {
    return res.status(400).json({ message: "Book id is required." });
  }

  try {
    const progress = await upsertProgress({
      authors: normalizeCompactSpaces(req.body.authors || ""),
      bookId,
      bookTitle: normalizeCompactSpaces(req.body.bookTitle || ""),
      currentPage: Math.min(currentPage, totalPages - 1),
      status,
      studentNumber,
      totalPages,
    });

    return res.json({ message: "Reading progress saved.", progress });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to save reading progress." });
  }
});

router.post("/rating", async (req, res) => {
  const studentNumber = normalizeStudentNumber(req.body.studentNumber || "");
  const bookId = normalizeCompactSpaces(req.body.bookId || "");
  const rating = clampInteger(Number(req.body.rating), 1, 5, 0);
  const currentPage = clampInteger(Number(req.body.currentPage), 0, 1000, 0);
  const totalPages = clampInteger(Number(req.body.totalPages), 1, 1000, 1);

  if (!STUDENT_NUMBER_PATTERN.test(studentNumber)) {
    return res.status(400).json({ message: "Valid student number is required." });
  }
  if (!bookId) {
    return res.status(400).json({ message: "Book id is required." });
  }
  if (!rating) {
    return res.status(400).json({ message: "Rating must be between 1 and 5." });
  }

  try {
    const progress = await upsertProgress({
      authors: normalizeCompactSpaces(req.body.authors || ""),
      bookId,
      bookTitle: normalizeCompactSpaces(req.body.bookTitle || ""),
      currentPage: Math.min(currentPage, totalPages - 1),
      rating,
      status: req.body.status === "FINISHED" ? "FINISHED" : "STARTED",
      studentNumber,
      totalPages,
    });

    return res.json({ message: "Book rating saved.", progress });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to save book rating." });
  }
});

module.exports = router;
