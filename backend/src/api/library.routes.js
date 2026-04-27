const express = require("express");
const http = require("http");
const https = require("https");
const { query } = require("../config/db");

const router = express.Router();
const STUDENT_NUMBER_PATTERN = /^\d{2}-\d{4}$/;
const DEFAULT_BOOK_QUERY = "subject:psychology mental health wellbeing stress anxiety";
const ANNA_ARCHIVE_ENDPOINT = "https://annas-archive-api.p.rapidapi.com/search";
const ANNA_ARCHIVE_DOWNLOAD_ENDPOINT = "https://annas-archive-api.p.rapidapi.com/download";
const ANNA_ARCHIVE_RAPIDAPI_HOST = "annas-archive-api.p.rapidapi.com";
const ANNA_ARCHIVE_DEFAULT_CATEGORIES = "fiction, nonfiction, comic, magazine, musicalscore, other, unknown";
const ANNA_ARCHIVE_DEFAULT_EXTENSIONS = "epub";
const ANNA_ARCHIVE_DEFAULT_SORT = "mostRelevant";
const ANNA_ARCHIVE_DEFAULT_SOURCES = "libgenRs,libgenLi";
const ANNA_ARCHIVE_DEFAULT_MIRROR_PRIORITY = "libgen.vg,libgen.rs,libgen.is,library.lol,libgen.li";
const ANNA_ARCHIVE_DOWNLOAD_PROBE_TIMEOUT_MS = 5000;
const ANNA_ARCHIVE_DOWNLOAD_STREAM_TIMEOUT_MS = 30000;
const MAX_BOOK_RESULTS = 24;
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

function getAnnaRapidApiHeaders(apiKey) {
  return {
    "Content-Type": "application/json",
    "x-rapidapi-host": String(process.env.ANNA_ARCHIVE_RAPIDAPI_HOST || ANNA_ARCHIVE_RAPIDAPI_HOST),
    "x-rapidapi-key": apiKey,
  };
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

function slugifyBookTitle(value) {
  return String(value || "book").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "book";
}

function normalizeHttpUrl(value) {
  const compact = normalizeCompactSpaces(value);
  if (!/^https?:\/\//i.test(compact)) return "";
  try {
    return new URL(compact.replace(/^http:\/\//i, "https://")).toString();
  } catch {
    return "";
  }
}

function collectUrls(value, depth = 0, urls = []) {
  if (depth > 5 || value === null || value === undefined) return urls;
  if (typeof value === "string") {
    const url = normalizeHttpUrl(value);
    if (url) urls.push(url);
    return urls;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      collectUrls(item, depth + 1, urls);
    }
    return urls;
  }
  if (typeof value !== "object") return urls;

  for (const key of ["downloadUrl", "download_url", "url", "href", "link", "download", "downloads", "links"]) {
    collectUrls(value[key], depth + 1, urls);
  }

  for (const item of Object.values(value)) {
    collectUrls(item, depth + 1, urls);
  }

  return urls;
}

function getMirrorPriority(url) {
  let hostname = "";
  try {
    hostname = new URL(url).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return Number.MAX_SAFE_INTEGER;
  }

  const priorityHosts = String(process.env.ANNA_ARCHIVE_MIRROR_PRIORITY || ANNA_ARCHIVE_DEFAULT_MIRROR_PRIORITY)
    .split(",")
    .map((item) => item.trim().replace(/^www\./i, "").toLowerCase())
    .filter(Boolean);
  const priority = priorityHosts.findIndex((host) => hostname === host || hostname.endsWith(`.${host}`));
  return priority >= 0 ? priority : priorityHosts.length;
}

function sortDownloadUrls(urls) {
  return [...new Set(urls.map(normalizeHttpUrl).filter(Boolean))].sort((left, right) => {
    const priorityDiff = getMirrorPriority(left) - getMirrorPriority(right);
    if (priorityDiff !== 0) return priorityDiff;
    return left.localeCompare(right);
  });
}

function isUsableDownloadProbe(response, url) {
  const statusCode = Number(response.statusCode || 0);
  if (statusCode < 200 || statusCode >= 300) return false;

  const contentType = String(response.headers["content-type"] || "").toLowerCase();
  const disposition = String(response.headers["content-disposition"] || "").toLowerCase();
  if (contentType.includes("text/html") || contentType.includes("application/json")) return false;

  return (
    !contentType ||
    contentType.includes("epub") ||
    contentType.includes("zip") ||
    contentType.includes("octet-stream") ||
    disposition.includes(".epub") ||
    /\.epub(?:$|[?#])/i.test(url)
  );
}

function probeDownloadUrl(url, method = "HEAD", redirectDepth = 0) {
  return new Promise((resolve) => {
    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch {
      resolve(false);
      return;
    }

    const client = parsedUrl.protocol === "http:" ? http : https;
    const headers = {
      Accept: "application/epub+zip,application/zip,application/octet-stream,*/*",
      "User-Agent": "BawatTalaApp/1.0",
    };
    if (method === "GET") {
      headers.Range = "bytes=0-0";
    }

    let settled = false;
    const settle = (result) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    const request = client.request(url, { headers, method }, (response) => {
      const location = response.headers.location;
      if ([301, 302, 303, 307, 308].includes(Number(response.statusCode)) && location && redirectDepth < 4) {
        response.resume();
        probeDownloadUrl(new URL(location, url).toString(), method, redirectDepth + 1).then(settle);
        return;
      }

      const usable = isUsableDownloadProbe(response, url);
      response.resume();
      settle(usable);
    });

    request.setTimeout(
      clampInteger(Number(process.env.ANNA_ARCHIVE_DOWNLOAD_PROBE_TIMEOUT_MS), 1000, 15000, ANNA_ARCHIVE_DOWNLOAD_PROBE_TIMEOUT_MS),
      () => {
        request.destroy();
        settle(false);
      },
    );
    request.on("error", () => settle(false));
    request.end();
  });
}

async function pickDownloadUrl(urls) {
  const candidates = sortDownloadUrls(urls);
  for (const url of candidates) {
    if (await probeDownloadUrl(url, "HEAD")) return url;
    if (await probeDownloadUrl(url, "GET")) return url;
  }
  return candidates[0] || "";
}

function getAnnaCoverUrl(book) {
  const rawUrl = pickString(book, ["coverImageUrl", "cover_url", "coverUrl", "cover", "thumbnail", "image"]);
  if (!rawUrl) return "";
  if (rawUrl.startsWith("//")) return `https:${rawUrl}`;
  return rawUrl.replace(/^http:\/\//i, "https://");
}

function getAnnaSourceId(book) {
  return pickString(book, ["md5", "id", "bookId", "isbn13", "isbn", "aarecord_id"]);
}

function getAnnaBookId(book, index) {
  const title = pickString(book, ["title", "bookTitle", "name"]) || "Untitled book";
  const sourceId = getAnnaSourceId(book);
  return sourceId ? `anna-${sourceId}` : `anna-${index}-${slugifyBookTitle(title)}`;
}

function mapAnnaBook(book, index, progressByBookId, downloadsByBookId) {
  const title = pickString(book, ["title", "bookTitle", "name"]) || "Untitled book";
  const sourceId = getAnnaSourceId(book);
  const id = getAnnaBookId(book, index);
  const pageCount = pickInteger(book, ["pageCount", "pages", "numPages"], 0, 2000, 0);
  const extension = pickString(book, ["extension", "ext", "format", "fileExtension"]).toLowerCase();
  const category = pickString(book, ["category", "cat", "topic", "genre"]) || "Mental Health";
  const progress = progressByBookId.get(id) || null;
  const download = downloadsByBookId.get(id) || null;

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
    downloaded: Boolean(download),
    downloadedAt: download?.downloadedAt || null,
    downloadUrl: download?.downloadUrl || "",
    infoLink: "",
    isFreeEbook: false,
    language: pickString(book, ["language", "lang"]),
    pageCount,
    previewLink: "",
    provider: "anna",
    publishedDate: pickString(book, ["publishedDate", "publishDate", "year"]),
    publisher: pickString(book, ["publisher"]),
    readerLink: download?.downloadUrl || "",
    rewardLabel: progress?.rating ? `${progress.rating}/5 stars` : "Rate after reading",
    shelfLabel: download ? "Downloaded" : "Catalog shelf",
    sourceId,
    title,
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

function mapDownloadRow(row) {
  if (!row) return null;
  return {
    bookId: row.book_id,
    downloadedAt: row.downloaded_at || null,
    downloadUrl: row.download_url || "",
    provider: row.provider || "library",
    sourceId: row.source_id || "",
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

async function getStudentDownloads(studentNumber, bookIds) {
  if (!STUDENT_NUMBER_PATTERN.test(studentNumber) || !bookIds.length) {
    return new Map();
  }

  const result = await query(
    `
      select book_id, provider, source_id, download_url, downloaded_at
      from public.student_library_downloads
      where student_number = $1
        and book_id = any($2::text[])
    `,
    [studentNumber, bookIds],
  );

  return new Map(result.rows.map((row) => [row.book_id, mapDownloadRow(row)]));
}

async function hasStudentDownloadedBook(studentNumber, bookId) {
  if (!STUDENT_NUMBER_PATTERN.test(studentNumber) || !bookId) {
    return false;
  }

  const result = await query(
    `
      select 1
      from public.student_library_downloads
      where student_number = $1
        and book_id = $2
      limit 1
    `,
    [studentNumber, bookId],
  );

  return result.rowCount > 0;
}

async function getStudentDownload(studentNumber, bookId) {
  if (!STUDENT_NUMBER_PATTERN.test(studentNumber) || !bookId) {
    return null;
  }

  const result = await query(
    `
      select book_id, provider, source_id, download_url, downloaded_at
      from public.student_library_downloads
      where student_number = $1
        and book_id = $2
      limit 1
    `,
    [studentNumber, bookId],
  );

  return mapDownloadRow(result.rows[0]);
}

async function updateStudentDownloadUrl(studentNumber, bookId, downloadUrl) {
  if (!STUDENT_NUMBER_PATTERN.test(studentNumber) || !bookId || !downloadUrl) {
    return;
  }

  await query(
    `
      update public.student_library_downloads
      set download_url = $3,
          downloaded_at = now(),
          updated_at = now()
      where student_number = $1
        and book_id = $2
    `,
    [studentNumber, bookId, downloadUrl],
  );
}

async function upsertDownload({
  authors,
  bookId,
  bookTitle,
  downloadUrl,
  provider,
  sourceId,
  studentNumber,
}) {
  const result = await query(
    `
      insert into public.student_library_downloads (
        student_number,
        book_id,
        book_title,
        book_authors,
        provider,
        source_id,
        download_url,
        downloaded_at,
        updated_at
      )
      values ($1, $2, $3, $4, $5, $6, $7, now(), now())
      on conflict (student_number, book_id)
      do update set
        book_title = coalesce(excluded.book_title, public.student_library_downloads.book_title),
        book_authors = coalesce(excluded.book_authors, public.student_library_downloads.book_authors),
        provider = excluded.provider,
        source_id = coalesce(excluded.source_id, public.student_library_downloads.source_id),
        download_url = coalesce(excluded.download_url, public.student_library_downloads.download_url),
        downloaded_at = now(),
        updated_at = now()
      returning book_id, provider, source_id, download_url, downloaded_at
    `,
    [studentNumber, bookId, bookTitle || null, authors || null, provider || "library", sourceId || null, downloadUrl || null],
  );

  return mapDownloadRow(result.rows[0]);
}

async function fetchAnnaDownloadUrl(sourceId) {
  const apiKey = String(process.env.ANNA_ARCHIVE_RAPIDAPI_KEY || "").trim();
  if (!apiKey) {
    throw new Error("Anna's Archive RapidAPI key is not configured.");
  }

  const endpoint = String(process.env.ANNA_ARCHIVE_DOWNLOAD_ENDPOINT || ANNA_ARCHIVE_DOWNLOAD_ENDPOINT).trim();
  const params = new URLSearchParams({ md5: sourceId });
  const data = await fetchJson(`${endpoint}?${params.toString()}`, {
    headers: getAnnaRapidApiHeaders(apiKey),
    serviceName: "Anna's Archive download",
  });
  const downloadUrl = await pickDownloadUrl(collectUrls(data));
  if (!downloadUrl) {
    throw new Error("Anna's Archive did not return a download link for this book.");
  }
  return downloadUrl;
}

function streamRemoteFile(url, res, redirectDepth = 0) {
  return new Promise((resolve, reject) => {
    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch {
      reject(new Error("The EPUB download link is invalid."));
      return;
    }

    const client = parsedUrl.protocol === "http:" ? http : https;
    const request = client.get(
      url,
      {
        headers: {
          Accept: "application/epub+zip,application/zip,application/octet-stream,*/*",
          "User-Agent": "BawatTalaApp/1.0",
        },
      },
      (response) => {
        const location = response.headers.location;
        if ([301, 302, 303, 307, 308].includes(Number(response.statusCode)) && location && redirectDepth < 4) {
          response.resume();
          streamRemoteFile(new URL(location, url).toString(), res, redirectDepth + 1).then(resolve, reject);
          return;
        }

        if (Number(response.statusCode || 0) < 200 || Number(response.statusCode || 0) >= 300) {
          response.resume();
          reject(new Error("The EPUB mirror did not return a downloadable book file."));
          return;
        }

        res.setHeader("Content-Type", response.headers["content-type"] || "application/epub+zip");
        res.setHeader("Cache-Control", "no-store");
        if (response.headers["content-length"]) {
          res.setHeader("Content-Length", response.headers["content-length"]);
        }

        response.pipe(res);
        response.on("end", resolve);
        response.on("error", reject);
      },
    );

    request.setTimeout(
      clampInteger(Number(process.env.ANNA_ARCHIVE_DOWNLOAD_STREAM_TIMEOUT_MS), 5000, 120000, ANNA_ARCHIVE_DOWNLOAD_STREAM_TIMEOUT_MS),
      () => {
        request.destroy();
        reject(new Error("The EPUB mirror took too long to respond."));
      },
    );
    request.on("error", reject);
  });
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
  const apiKey = String(process.env.ANNA_ARCHIVE_RAPIDAPI_KEY || "").trim();
  if (!apiKey) {
    return res.status(500).json({ message: "Anna's Archive RapidAPI key is not configured." });
  }

  try {
    const params = new URLSearchParams({
      cat: String(process.env.ANNA_ARCHIVE_CATEGORIES || ANNA_ARCHIVE_DEFAULT_CATEGORIES),
      ext: String(process.env.ANNA_ARCHIVE_EXTENSIONS || ANNA_ARCHIVE_DEFAULT_EXTENSIONS),
      limit: String(maxResults),
      page: String(clampInteger(Number(req.query.page || 1), 1, 100, 1)),
      q: searchQuery.replace(/^subject:/i, ""),
      skip: String((clampInteger(Number(req.query.page || 1), 1, 100, 1) - 1) * maxResults),
      sort: String(process.env.ANNA_ARCHIVE_SORT || ANNA_ARCHIVE_DEFAULT_SORT),
    });
    const sources = String(process.env.ANNA_ARCHIVE_SOURCES || ANNA_ARCHIVE_DEFAULT_SOURCES).trim();
    if (sources) {
      params.set("source", sources);
    }

    const data = await fetchJson(`${ANNA_ARCHIVE_ENDPOINT}?${params.toString()}`, {
      headers: getAnnaRapidApiHeaders(apiKey),
      serviceName: "Anna's Archive",
    });
    const selectedItems = findFirstArray(data).slice(0, maxResults);
    const bookIds = selectedItems
      .map((item, index) => getAnnaBookId(item, index))
      .filter(Boolean);
    const [progressByBookId, downloadsByBookId] = await Promise.all([
      getStudentProgress(studentNumber, bookIds),
      getStudentDownloads(studentNumber, bookIds),
    ]);
    const books = selectedItems.map((item, index) => mapAnnaBook(item, index, progressByBookId, downloadsByBookId));

    return res.json({
      books,
      query: searchQuery,
      totalItems: Number(data.totalItems || data.total || data.count || books.length),
    });
  } catch (error) {
    return res.status(502).json({ message: error.message || "Failed to load library books." });
  }
});

router.post("/download", async (req, res) => {
  const studentNumber = normalizeStudentNumber(req.body.studentNumber || "");
  const bookId = normalizeCompactSpaces(req.body.bookId || "");
  const provider = normalizeCompactSpaces(req.body.provider || "anna").toLowerCase();
  const sourceId = normalizeCompactSpaces(req.body.sourceId || "");
  const bookTitle = normalizeCompactSpaces(req.body.bookTitle || "");
  const authors = normalizeCompactSpaces(req.body.authors || "");

  if (!STUDENT_NUMBER_PATTERN.test(studentNumber)) {
    return res.status(400).json({ message: "Valid student number is required." });
  }
  if (!bookId) {
    return res.status(400).json({ message: "Book id is required." });
  }
  if (provider !== "anna") {
    return res.status(400).json({ message: "Only Anna's Archive books are supported." });
  }
  if (!sourceId) {
    return res.status(400).json({ message: "Anna's Archive source id is required." });
  }

  try {
    const downloadUrl = await fetchAnnaDownloadUrl(sourceId);
    if (!downloadUrl) {
      return res.status(502).json({ message: "No download link is available for this book right now." });
    }

    const download = await upsertDownload({
      authors,
      bookId,
      bookTitle,
      downloadUrl,
      provider,
      sourceId,
      studentNumber,
    });

    return res.json({
      download,
      message: "Book downloaded.",
    });
  } catch (error) {
    return res.status(502).json({ message: error.message || "Failed to download this book." });
  }
});

router.get("/download-file", async (req, res) => {
  const studentNumber = normalizeStudentNumber(req.query.studentNumber || "");
  const bookId = normalizeCompactSpaces(req.query.bookId || "");

  if (!STUDENT_NUMBER_PATTERN.test(studentNumber)) {
    return res.status(400).json({ message: "Valid student number is required." });
  }
  if (!bookId) {
    return res.status(400).json({ message: "Book id is required." });
  }

  try {
    const download = await getStudentDownload(studentNumber, bookId);
    if (!download) {
      return res.status(403).json({ message: "Download this book before opening the reader." });
    }

    let downloadUrl = download.downloadUrl;
    if (download.provider === "anna" && download.sourceId) {
      const freshDownloadUrl = await fetchAnnaDownloadUrl(download.sourceId);
      if (freshDownloadUrl) {
        downloadUrl = freshDownloadUrl;
        await updateStudentDownloadUrl(studentNumber, bookId, freshDownloadUrl);
      }
    }

    if (!downloadUrl) {
      return res.status(502).json({ message: "No download link is available for this book right now." });
    }

    await streamRemoteFile(downloadUrl, res);
  } catch (error) {
    if (res.headersSent) {
      res.destroy(error);
      return;
    }
    return res.status(502).json({ message: error.message || "Failed to open this EPUB." });
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
    const downloaded = await hasStudentDownloadedBook(studentNumber, bookId);
    if (!downloaded) {
      return res.status(403).json({ message: "Download this book before opening the reader." });
    }

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
    const downloaded = await hasStudentDownloadedBook(studentNumber, bookId);
    if (!downloaded) {
      return res.status(403).json({ message: "Download this book before rating it." });
    }

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
