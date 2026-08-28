const express = require("express");
const http = require("http");
const https = require("https");
const { query } = require("../config/db");
const { requireStudentOnlyAuth, resolveStudentNumber } = require("../middleware/auth.middleware");

const router = express.Router();
const STUDENT_NUMBER_PATTERN = /^\d{2}-\d{4}$/;
const DEFAULT_BOOK_QUERY = "psychology mental health";
const OPEN_LIBRARY_SEARCH_ENDPOINT = "https://openlibrary.org/search.json";
const ARCHIVE_METADATA_ENDPOINT = "https://archive.org/metadata";
const OPEN_LIBRARY_USER_AGENT = "BawattalaApp/1.0 (basartejasmine@gmail.com)";
const OPEN_LIBRARY_DEFAULT_LANGUAGE = "eng";
const OPEN_LIBRARY_DOWNLOAD_PROBE_TIMEOUT_MS = 5000;
const OPEN_LIBRARY_DOWNLOAD_STREAM_TIMEOUT_MS = 30000;
const OPEN_LIBRARY_DOWNLOAD_CACHE_TTL_MS = 15 * 60 * 1000;
const MAX_BOOK_RESULTS = 24;
const WELLBEING_BOOK_PATTERN = /\b(self[ -]?help|personal development|personal growth|clinical psychology|counseling psychology|positive psychology|mental health|emotional health|emotional intelligence|well[ -]?being|mindfulness|meditation|stress management|anxiety|depression|trauma|grief|resilience|self[ -]?esteem|self[ -]?compassion|coping|burnout|habit|motivation|happiness|therapy|counseling|relationships?)\b/i;
const NON_WELLBEING_BOOK_PATTERN = /\b(fiction|novel|novels|stories|literature|fantasy|magic|witchcraft|wizards|romance fiction|erotic fiction|detective and mystery|murder|thriller|suspense|juvenile fiction|young adult fiction|children's stories|drama|poetry|comics|comic books|graphic novels)\b/i;
const READING_ACHIEVEMENT_NOTIFICATION_KIND = "READING_ACHIEVEMENT_REWARD";
const READING_ACHIEVEMENTS = [
  {
    key: "read_10_seconds",
    seconds: 10,
    rewardTala: 5,
    title: "First Spark",
    description: "Read for 10 seconds",
  },
  {
    key: "read_30_seconds",
    seconds: 30,
    rewardTala: 10,
    title: "Page Warmer",
    description: "Read for 30 seconds",
  },
  {
    key: "read_1_minute",
    seconds: 60,
    rewardTala: 15,
    title: "One-Minute Focus",
    description: "Read for 1 minute",
  },
  {
    key: "read_5_minutes",
    seconds: 5 * 60,
    rewardTala: 20,
    title: "Steady Reader",
    description: "Read for 5 minutes",
  },
  {
    key: "read_15_minutes",
    seconds: 15 * 60,
    rewardTala: 35,
    title: "Quiet Chapter",
    description: "Read for 15 minutes",
  },
  {
    key: "read_30_minutes",
    seconds: 30 * 60,
    rewardTala: 50,
    title: "Deep Reader",
    description: "Read for 30 minutes",
  },
  {
    key: "read_1_hour",
    seconds: 60 * 60,
    rewardTala: 80,
    title: "Library Glow",
    description: "Read for 1 hour",
  },
];
const ACCENT_COLORS = ["#D7F0B7", "#CFE6F8", "#E8D7F2", "#F8E8BE", "#D7EBE5", "#F1D4D4"];
const openLibraryDownloadUrlCache = new Map();

function normalizeCompactSpaces(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function normalizeStudentNumber(value) {
  const compact = normalizeCompactSpaces(value).replace(/\s+/g, "");
  const match = compact.match(/^(\d{2})[- ]?(\d{4})$/);
  if (!match) return compact;
  return `${match[1]}-${match[2]}`;
}

function resolveRequestStudentNumber(req) {
  return normalizeStudentNumber(resolveStudentNumber(req) || "");
}

function parseBookIds(value) {
  return [...new Set(
    String(value || "")
      .split(",")
      .map(normalizeCompactSpaces)
      .filter(Boolean),
  )].slice(0, 50);
}

function isBuiltInLibraryBook(bookId) {
  return String(bookId || "").startsWith("builtin-");
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

function formatReadingDuration(seconds) {
  if (seconds < 60) {
    return `${seconds} second${seconds === 1 ? "" : "s"}`;
  }

  const minutes = seconds / 60;
  if (minutes < 60) {
    return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  }

  const hours = minutes / 60;
  return `${hours} hour${hours === 1 ? "" : "s"}`;
}

function mapReadingAchievement(achievement, claimed = false) {
  if (!achievement) return null;

  return {
    key: achievement.key,
    seconds: achievement.seconds,
    rewardTala: achievement.rewardTala,
    title: achievement.title,
    description: achievement.description,
    durationLabel: formatReadingDuration(achievement.seconds),
    claimed,
  };
}

function getReadingAchievementByKey(key) {
  return READING_ACHIEVEMENTS.find((achievement) => achievement.key === key) || null;
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

function getOpenLibraryHeaders() {
  return {
    Accept: "application/json",
    "User-Agent": String(process.env.OPEN_LIBRARY_USER_AGENT || OPEN_LIBRARY_USER_AGENT),
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

  const priorityHosts = String(process.env.OPEN_LIBRARY_MIRROR_PRIORITY || "archive.org,ia801,ia802,ia803,ia904")
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

function isWebPageResponse(response) {
  const contentType = String(response.headers["content-type"] || "").toLowerCase();
  return contentType.includes("text/html") || contentType.includes("application/json");
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
      if (!usable || method !== "GET") {
        response.resume();
        settle(usable);
        return;
      }

      response.once("data", (chunk) => {
        response.destroy();
        const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        settle(bytes.length >= 2 && bytes[0] === 0x50 && bytes[1] === 0x4b);
      });
      response.once("end", () => settle(false));
      response.once("error", () => settle(false));
    });

    request.setTimeout(
      clampInteger(Number(process.env.OPEN_LIBRARY_DOWNLOAD_PROBE_TIMEOUT_MS), 1000, 15000, OPEN_LIBRARY_DOWNLOAD_PROBE_TIMEOUT_MS),
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
  return "";
}

function normalizeIdentifierWords(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function getSignificantWords(value) {
  const stopWords = new Set(["a", "an", "and", "by", "for", "of", "the", "to"]);
  return String(value || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .map((word) => word.trim())
    .filter((word) => word.length > 2 && !stopWords.has(word));
}

function scoreOpenLibraryIaIdentifier(identifier, book, preferredIdentifier) {
  const normalizedId = normalizeIdentifierWords(identifier);
  if (!normalizedId) return -1;

  const titleWords = getSignificantWords(book.title);
  const authorWords = Array.isArray(book.author_name) ? getSignificantWords(book.author_name.join(" ")) : [];
  const titleScore = titleWords.reduce((score, word) => score + (normalizedId.includes(word) ? 35 : 0), 0);
  const authorScore = authorWords.reduce((score, word) => score + (normalizedId.includes(word) ? 12 : 0), 0);
  const preferredScore = preferredIdentifier && identifier === preferredIdentifier ? 20 : 0;
  const compactTitle = titleWords.join("");
  const compactTitleScore = compactTitle && normalizedId.includes(compactTitle) ? 60 : 0;
  return titleScore + authorScore + preferredScore + compactTitleScore;
}

function getOpenLibraryIaIdentifier(book) {
  const availability = book.availability || {};
  const preferredIdentifier = pickString(availability, ["identifier"]) || pickString(book, ["lending_identifier_s"]);
  const candidates = [
    ...(Array.isArray(book.ia) ? book.ia : []),
    pickString(book, ["lending_identifier_s"]),
    preferredIdentifier,
  ].filter(Boolean);

  if (!candidates.length) return "";

  return [...new Set(candidates)]
    .map((identifier) => ({
      identifier,
      score: scoreOpenLibraryIaIdentifier(identifier, book, preferredIdentifier),
    }))
    .sort((left, right) => right.score - left.score)[0]?.identifier || preferredIdentifier || candidates[0] || "";
}

function normalizeOpenLibraryStatus(value) {
  return normalizeCompactSpaces(value).toLowerCase().replace(/[_-]+/g, " ");
}

function isOpenLibraryFreeFullBook(book) {
  const availability = book.availability || {};
  const status = normalizeOpenLibraryStatus(availability.status || "");
  const ebookAccess = normalizeOpenLibraryStatus(book.ebook_access || "");
  return Boolean(
    book.has_fulltext &&
      book.public_scan_b &&
      (status === "open" || status === "full access" || ebookAccess === "public" || availability.is_readable),
  );
}

function normalizeOpenLibraryLink(value) {
  const compact = normalizeCompactSpaces(value);
  if (!compact) return "";
  if (/^https?:\/\//i.test(compact)) return normalizeHttpUrl(compact);
  if (compact.startsWith("/")) return `https://openlibrary.org${compact}`;
  return "";
}

function pickOpenLibraryLink(source, keys) {
  for (const key of keys) {
    const value = source?.[key];
    if (Array.isArray(value)) {
      const found = value.map(normalizeOpenLibraryLink).find(Boolean);
      if (found) return found;
      continue;
    }
    const link = normalizeOpenLibraryLink(value);
    if (link) return link;
  }
  return "";
}

function getOpenLibraryInfoLink(book) {
  const keyLink = normalizeOpenLibraryLink(book.key || "");
  if (keyLink) return keyLink;
  const availability = book.availability || {};
  const editionId = pickString(availability, ["openlibrary_edition"]);
  if (editionId) return normalizeOpenLibraryLink(editionId.startsWith("/") ? editionId : `/books/${editionId}`);
  const workId = pickString(availability, ["openlibrary_work"]);
  if (workId) return normalizeOpenLibraryLink(workId.startsWith("/") ? workId : `/works/${workId}`);
  return "";
}

function getArchiveDetailsLink(sourceId) {
  return sourceId ? `https://archive.org/details/${encodeURIComponent(sourceId)}/mode/2up` : "";
}

function getOpenLibraryExternalReaderLink(book, sourceId, accessType = "") {
  const availability = book.availability || {};
  const preferredKeys = {
    borrow: ["borrow_url", "read_url", "web_url", "url", "info_url"],
    waitlist: ["borrow_url", "read_url", "web_url", "url", "info_url"],
    preview: ["preview_url", "read_url", "web_url", "url", "info_url"],
    full: ["read_url", "web_url", "url", "info_url"],
  }[accessType] || ["read_url", "borrow_url", "preview_url", "web_url", "url", "info_url"];
  return pickOpenLibraryLink(availability, preferredKeys) || getArchiveDetailsLink(sourceId) || getOpenLibraryInfoLink(book);
}

function getOpenLibraryAccess(book, sourceId, hasDownloadableEpub = false) {
  const availability = book.availability || {};
  const status = normalizeOpenLibraryStatus(availability.status || "");
  const ebookAccess = normalizeOpenLibraryStatus(book.ebook_access || "");
  const isCheckedOut = status.includes("checked out") || status.includes("unavailable") || ebookAccess.includes("unavailable");
  const isWaitlist = Boolean(availability.available_to_waitlist || status.includes("waitlist") || ebookAccess.includes("waitlist") || isCheckedOut);
  const isBorrowable = Boolean(
    availability.available_to_borrow ||
      availability.is_lendable ||
      status === "lendable" ||
      ebookAccess === "borrowable" ||
      (status.includes("borrow") && !isCheckedOut),
  );
  const isPreviewable = Boolean(
    availability.is_previewable ||
      availability.is_restricted ||
      availability.is_printdisabled ||
      status.includes("preview") ||
      status.includes("restricted") ||
      ebookAccess.includes("printdisabled") ||
      ebookAccess.includes("restricted"),
  );
  const isReadableOnline = Boolean(
    availability.is_readable || availability.available_to_browse || book.has_fulltext || ebookAccess === "public" || ebookAccess === "borrowable",
  );

  if (hasDownloadableEpub) {
    return {
      accessLabel: "Free EPUB",
      accessType: "full",
      actionLabel: "Download EPUB",
      description: "A free full-text public scan from Open Library and the Internet Archive.",
      externalReaderLink: getOpenLibraryExternalReaderLink(book, sourceId, "full"),
      shelfLabel: "Free full EPUB",
      statusLabel: "Download EPUB",
      supportsInAppReader: true,
    };
  }

  if (isOpenLibraryFreeFullBook(book)) {
    return {
      accessLabel: "Free online",
      accessType: "full",
      actionLabel: "Read Online",
      description: "A free public scan is available through Open Library.",
      externalReaderLink: getOpenLibraryExternalReaderLink(book, sourceId, "full"),
      shelfLabel: "Free online",
      statusLabel: "Open online",
      supportsInAppReader: false,
    };
  }

  if (isWaitlist) {
    return {
      accessLabel: "Waitlist",
      accessType: "waitlist",
      actionLabel: "Join waitlist",
      description: "This title is checked out, but Open Library may let you join the waitlist after signing in.",
      externalReaderLink: getOpenLibraryExternalReaderLink(book, sourceId, "waitlist"),
      shelfLabel: "Waitlist",
      statusLabel: "Currently checked out",
      supportsInAppReader: false,
    };
  }

  if (isBorrowable) {
    return {
      accessLabel: "Borrow",
      accessType: "borrow",
      actionLabel: "Borrow",
      description: "Borrow this through Open Library using your Open Library account.",
      externalReaderLink: getOpenLibraryExternalReaderLink(book, sourceId, "borrow"),
      shelfLabel: "Borrowable",
      statusLabel: "Open Library account",
      supportsInAppReader: false,
    };
  }

  if (isPreviewable || status === "restricted") {
    return {
      accessLabel: "Preview",
      accessType: "preview",
      actionLabel: "Preview",
      description: "Open Library has a preview for this title, but not a free full EPUB for in-app reading.",
      externalReaderLink: getOpenLibraryExternalReaderLink(book, sourceId, "preview"),
      shelfLabel: "Preview Only",
      statusLabel: "Preview on Open Library",
      supportsInAppReader: false,
    };
  }

  if (isReadableOnline) {
    return {
      accessLabel: "Read online",
      accessType: "online",
      actionLabel: "Read Online",
      description: "Open Library lists an online reader for this title.",
      externalReaderLink: getOpenLibraryExternalReaderLink(book, sourceId, "full"),
      shelfLabel: "Read online",
      statusLabel: "Open online",
      supportsInAppReader: false,
    };
  }

  return null;
}

function getOpenLibraryBookId(book, sourceId, index) {
  const rawKey = pickString(book, ["key"]).replace(/^\/works\//, "");
  return sourceId ? `openlib-${sourceId}` : `openlib-${rawKey || index}`;
}

function getOpenLibraryCoverUrl(book, sourceId) {
  const coverId = Number(book.cover_i || 0);
  if (coverId) return `https://covers.openlibrary.org/b/id/${coverId}-M.jpg`;
  const editionId = pickString(book.availability || {}, ["openlibrary_edition"]);
  if (editionId) return `https://covers.openlibrary.org/b/olid/${editionId}-M.jpg`;
  return sourceId ? `https://archive.org/services/img/${encodeURIComponent(sourceId)}` : "";
}

function getOpenLibraryCategory(book) {
  const subjects = Array.isArray(book.subject) ? book.subject : [];
  return subjects.find((subject) => /psychology|mental|health|wellbeing|stress|anxiety|mind/i.test(subject)) || subjects[0] || "Open Library";
}

function isWellbeingLibraryBook(book) {
  const subjects = Array.isArray(book.subject) ? book.subject : [];
  const normalizedTitle = normalizeCompactSpaces(book.title);
  const normalizedSubjects = subjects.map((value) => normalizeCompactSpaces(value)).filter(Boolean);
  const searchableText = [normalizedTitle, ...normalizedSubjects]
    .map((value) => normalizeCompactSpaces(value))
    .filter(Boolean)
    .join(" ");

  if (NON_WELLBEING_BOOK_PATTERN.test(searchableText)) {
    return false;
  }

  return WELLBEING_BOOK_PATTERN.test(searchableText);
}

function getOpenLibraryEpubFile(files = []) {
  return files.find((file) => {
    const name = String(file?.name || "");
    const format = String(file?.format || "");
    return (
      /\.epub$/i.test(name) &&
      !/_encrypted\.epub$/i.test(name) &&
      !/_lcp\.epub$/i.test(name) &&
      !/encrypted|lcp|acs|daisy/i.test(format)
    );
  });
}

function buildArchiveDownloadUrl(sourceId, fileName) {
  return `https://archive.org/download/${encodeURIComponent(sourceId)}/${encodeURIComponent(fileName).replace(/%2F/gi, "/")}`;
}

async function fetchOpenLibraryEpubDownloadUrl(sourceId) {
  const cached = openLibraryDownloadUrlCache.get(sourceId);
  if (cached?.url && cached.expiresAt > Date.now()) {
    return cached.url;
  }
  openLibraryDownloadUrlCache.delete(sourceId);

  const metadata = await fetchJson(`${ARCHIVE_METADATA_ENDPOINT}/${encodeURIComponent(sourceId)}`, {
    headers: getOpenLibraryHeaders(),
    serviceName: "Internet Archive metadata",
  });
  const epubFile = getOpenLibraryEpubFile(Array.isArray(metadata.files) ? metadata.files : []);
  if (!epubFile?.name) {
    throw new Error("Open Library did not provide a free full EPUB file for this book.");
  }

  const downloadUrl = buildArchiveDownloadUrl(sourceId, epubFile.name);
  openLibraryDownloadUrlCache.set(sourceId, {
    expiresAt: Date.now() + OPEN_LIBRARY_DOWNLOAD_CACHE_TTL_MS,
    url: downloadUrl,
  });
  return downloadUrl;
}

async function resolveOpenLibraryDisplayItem(item) {
  const sourceId = getOpenLibraryIaIdentifier(item);
  let access = getOpenLibraryAccess(item, sourceId);
  if (!access) return null;

  if (isOpenLibraryFreeFullBook(item) && sourceId) {
    try {
      const downloadUrl = await fetchOpenLibraryEpubDownloadUrl(sourceId);
      access = getOpenLibraryAccess(item, sourceId, true);
      return { ...item, access, downloadUrl, sourceId };
    } catch {
      return { ...item, access, sourceId };
    }
  }

  return { ...item, access, sourceId };
}

async function getOpenLibraryDisplayItems(items, maxResults) {
  const displayItems = [];
  const batchSize = clampInteger(Number(process.env.OPEN_LIBRARY_DOWNLOADABLE_CHECK_BATCH_SIZE), 1, 6, 3);

  for (let index = 0; index < items.length && displayItems.length < maxResults; index += batchSize) {
    const batch = items.slice(index, index + batchSize);
    const results = await Promise.all(batch.map(resolveOpenLibraryDisplayItem));

    for (const item of results) {
      if (!item) continue;
      displayItems.push(item);
      if (displayItems.length >= maxResults) break;
    }
  }

  return displayItems;
}

function mapOpenLibraryBook(book, index, progressByBookId, downloadsByBookId) {
  const sourceId = book.sourceId || getOpenLibraryIaIdentifier(book);
  const id = getOpenLibraryBookId(book, sourceId, index);
  const download = downloadsByBookId.get(id) || downloadsByBookId.get(`source:${sourceId}`) || null;
  const progress = progressByBookId.get(id) || progressByBookId.get(download?.bookId) || null;
  const authors = Array.isArray(book.author_name) && book.author_name.length ? book.author_name.join(", ") : "Open Library";
  const publishedDate = book.first_publish_year ? String(book.first_publish_year) : "";
  const title = book.title || "Untitled book";
  const hasDownloadableEpub = Boolean(download?.downloadUrl || book.downloadUrl);
  const access = book.access || getOpenLibraryAccess(book, sourceId, hasDownloadableEpub) || {};
  const externalReaderLink = access.externalReaderLink || getOpenLibraryExternalReaderLink(book, sourceId, access.accessType);

  return {
    accessLabel: access.accessLabel || "Open Library",
    accessType: access.accessType || "catalog",
    accentColor: ACCENT_COLORS[index % ACCENT_COLORS.length],
    actionLabel: access.actionLabel || "View Details",
    author: authors,
    blurb: truncateText(
      [
        publishedDate ? `First published in ${publishedDate}.` : "",
        access.description || `A title from Open Library and the Internet Archive.`,
      ].filter(Boolean).join(" "),
      650,
    ),
    category: getOpenLibraryCategory(book),
    coverImageUrl: getOpenLibraryCoverUrl(book, sourceId),
    downloadableEpub: hasDownloadableEpub,
    downloadablePdf: false,
    estimatedMinutes: 12,
    externalReaderLink,
    id,
    downloaded: Boolean(download),
    downloadedAt: download?.downloadedAt || null,
    downloadUrl: download?.downloadUrl || book.downloadUrl || "",
    infoLink: getOpenLibraryInfoLink(book),
    isFreeEbook: access.accessType === "full",
    language: OPEN_LIBRARY_DEFAULT_LANGUAGE,
    pageCount: 0,
    previewLink: externalReaderLink,
    provider: "openlibrary",
    publishedDate,
    publisher: "Open Library",
    readerLink: download?.downloadUrl || book.downloadUrl || "",
    rewardLabel: progress?.rating ? `${progress.rating}/5 stars` : "Rate after reading",
    shelfLabel: download ? "Downloaded" : access.shelfLabel || "Open Library",
    sourceId,
    sourceReaderLink: externalReaderLink,
    statusLabel: access.statusLabel || "Open Library",
    supportsInAppReader: Boolean(access.supportsInAppReader || hasDownloadableEpub),
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

function mapShelfDownloadRow(row, index) {
  const sourceId = row.source_id || "";
  const progress = row.google_volume_id ? mapProgressRow(row) : null;

  return {
    accessLabel: "Saved EPUB",
    accessType: "full",
    accentColor: ACCENT_COLORS[index % ACCENT_COLORS.length],
    actionLabel: "Read",
    author: row.book_authors || "Open Library",
    blurb: "A free full EPUB saved from Open Library for in-app reading.",
    category: "Saved EPUB",
    coverImageUrl: sourceId ? `https://archive.org/services/img/${encodeURIComponent(sourceId)}` : "",
    downloadableEpub: true,
    downloadablePdf: false,
    downloaded: true,
    downloadedAt: row.downloaded_at || null,
    downloadUrl: row.download_url || "",
    estimatedMinutes: 12,
    externalReaderLink: sourceId ? getArchiveDetailsLink(sourceId) : "",
    id: row.book_id,
    infoLink: sourceId ? getArchiveDetailsLink(sourceId) : "",
    isFreeEbook: true,
    language: OPEN_LIBRARY_DEFAULT_LANGUAGE,
    pageCount: 0,
    previewLink: sourceId ? getArchiveDetailsLink(sourceId) : "",
    provider: row.provider || "openlibrary",
    publishedDate: "",
    publisher: row.provider === "openlibrary" ? "Open Library" : "Library",
    readerLink: row.download_url || "",
    rewardLabel: progress?.rating ? `${progress.rating}/5 stars` : "Rate after reading",
    shelfLabel: "Downloaded",
    sourceId,
    sourceReaderLink: sourceId ? getArchiveDetailsLink(sourceId) : "",
    statusLabel: "Saved in account",
    supportsInAppReader: true,
    title: row.book_title || "Downloaded EPUB",
    progress,
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

async function getStudentDownloads(studentNumber, bookIds, sourceIds = []) {
  if (!STUDENT_NUMBER_PATTERN.test(studentNumber) || (!bookIds.length && !sourceIds.length)) {
    return new Map();
  }

  const result = await query(
    `
      select book_id, provider, source_id, download_url, downloaded_at
      from public.student_library_downloads
      where student_number = $1
        and (
          book_id = any($2::text[])
          or source_id = any($3::text[])
        )
    `,
    [studentNumber, bookIds, sourceIds],
  );

  const downloads = new Map();
  result.rows.forEach((row) => {
    const download = mapDownloadRow(row);
    downloads.set(row.book_id, download);
    if (row.source_id) {
      downloads.set(`source:${row.source_id}`, download);
    }
  });
  return downloads;
}

async function getStudentShelfDownloads(studentNumber) {
  if (!STUDENT_NUMBER_PATTERN.test(studentNumber)) {
    return [];
  }

  const result = await query(
    `
      select d.book_id,
             d.book_title,
             d.book_authors,
             d.provider,
             d.source_id,
             d.download_url,
             d.downloaded_at,
             p.google_volume_id,
             p.current_page,
             p.total_pages,
             p.progress_percent,
             p.status,
             p.rating,
             p.finished_at,
             p.last_opened_at,
             p.updated_at
      from public.student_library_downloads d
      left join public.student_library_progress p
        on p.student_number = d.student_number
       and p.google_volume_id = d.book_id
      where d.student_number = $1
      order by d.downloaded_at desc
    `,
    [studentNumber],
  );

  return result.rows.map(mapShelfDownloadRow);
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

async function canUseInAppReader(studentNumber, bookId) {
  if (isBuiltInLibraryBook(bookId)) {
    return true;
  }
  return hasStudentDownloadedBook(studentNumber, bookId);
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

async function getStudentDownloadBySourceId(studentNumber, sourceId) {
  if (!STUDENT_NUMBER_PATTERN.test(studentNumber) || !sourceId) {
    return null;
  }

  const result = await query(
    `
      select book_id, provider, source_id, download_url, downloaded_at
      from public.student_library_downloads
      where student_number = $1
        and source_id = $2
      order by downloaded_at desc
      limit 1
    `,
    [studentNumber, sourceId],
  );

  return mapDownloadRow(result.rows[0]);
}

async function deleteStudentDownload(studentNumber, bookId) {
  if (!STUDENT_NUMBER_PATTERN.test(studentNumber) || !bookId || isBuiltInLibraryBook(bookId)) {
    return 0;
  }

  const result = await query(
    `
      delete from public.student_library_downloads
      where student_number = $1
        and book_id = $2
    `,
    [studentNumber, bookId],
  );

  await query(
    `
      delete from public.student_library_progress
      where student_number = $1
        and google_volume_id = $2
    `,
    [studentNumber, bookId],
  );

  return result.rowCount;
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
          "User-Agent": String(process.env.OPEN_LIBRARY_USER_AGENT || OPEN_LIBRARY_USER_AGENT),
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
        if (!isUsableDownloadProbe(response, url) || isWebPageResponse(response)) {
          response.resume();
          reject(new Error("The EPUB mirror returned a webpage or unsupported file instead of an EPUB."));
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
      clampInteger(Number(process.env.OPEN_LIBRARY_DOWNLOAD_STREAM_TIMEOUT_MS), 5000, 120000, OPEN_LIBRARY_DOWNLOAD_STREAM_TIMEOUT_MS),
      () => {
        request.destroy();
        reject(new Error("The EPUB mirror took too long to respond."));
      },
    );
    request.on("error", reject);
  });
}

async function streamFirstWorkingRemoteFile(urls, res) {
  const candidates = sortDownloadUrls(urls);
  let lastError = null;

  for (const url of candidates) {
    try {
      await streamRemoteFile(url, res);
      return url;
    } catch (error) {
      lastError = error;
      if (res.headersSent) {
        throw error;
      }
    }
  }

  throw new Error(lastError?.message || "No EPUB mirror returned a downloadable book file.");
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

async function createStudentNotification({
  studentNumber,
  kind,
  title,
  message,
  metadata = {},
}) {
  await query(
    `
      insert into public.student_notifications (
        student_number,
        kind,
        title,
        message,
        metadata
      )
      values ($1, $2, $3, $4, $5::jsonb)
    `,
    [studentNumber, kind, title, message, JSON.stringify(metadata || {})],
  );
}

async function getClaimedReadingAchievementKeys(studentNumber) {
  const result = await query(
    `
      select achievement_key
      from public.student_library_reading_rewards
      where student_number = $1
        and achievement_key is not null
      order by claimed_at asc
    `,
    [studentNumber],
  );

  return new Set(result.rows.map((row) => row.achievement_key).filter(Boolean));
}

async function getReadingAchievementStatus(studentNumber) {
  const claimedKeys = await getClaimedReadingAchievementKeys(studentNumber);
  const nextAchievement = READING_ACHIEVEMENTS.find((achievement) => !claimedKeys.has(achievement.key)) || null;

  return {
    achievements: READING_ACHIEVEMENTS.map((achievement) => mapReadingAchievement(achievement, claimedKeys.has(achievement.key))),
    completedCount: claimedKeys.size,
    nextAchievement: mapReadingAchievement(nextAchievement, false),
    totalCount: READING_ACHIEVEMENTS.length,
  };
}

async function grantReadingReward({ achievement, bookId, bookTitle, readingSeconds, studentNumber }) {
  await query(
    `
      insert into public.student_library_reading_rewards (
        student_number,
        book_id,
        book_title,
        achievement_key,
        achievement_title,
        milestone_seconds,
        reading_seconds,
        reward_tala,
        claimed_at
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, now())
    `,
    [
      studentNumber,
      bookId,
      bookTitle || null,
      achievement.key,
      achievement.title,
      achievement.seconds,
      readingSeconds,
      achievement.rewardTala,
    ],
  );

  const result = await query(
    `
      insert into public.student_tala_wallets (
        student_number,
        total_tala,
        updated_at
      )
      values ($1, $2, now())
      on conflict (student_number)
      do update set
        total_tala = public.student_tala_wallets.total_tala + excluded.total_tala,
        updated_at = now()
      returning total_tala
    `,
    [studentNumber, achievement.rewardTala],
  );

  await createStudentNotification({
    studentNumber,
    kind: READING_ACHIEVEMENT_NOTIFICATION_KIND,
    title: "Reading achievement unlocked",
    message: `${achievement.title}: +${achievement.rewardTala} Tala for reading ${formatReadingDuration(achievement.seconds)}.`,
    metadata: {
      achievementKey: achievement.key,
      achievementTitle: achievement.title,
      bookId,
      bookTitle: bookTitle || null,
      rewardTala: achievement.rewardTala,
      seconds: achievement.seconds,
    },
  });

  return Number(result.rows[0]?.total_tala || 0);
}

router.get("/books", async (req, res) => {
  let studentNumber;
  try {
    studentNumber = resolveRequestStudentNumber(req);
  } catch (error) {
    if (error?.statusCode === 403) {
      return res.status(403).json({ message: "Access denied." });
    }
    throw error;
  }
  const maxResults = clampInteger(Number(req.query.maxResults || MAX_BOOK_RESULTS), 1, 40, MAX_BOOK_RESULTS);
  const searchLimit = Math.min(40, Math.max(maxResults, maxResults * 2));
  const searchQuery = normalizeCompactSpaces(req.query.q || DEFAULT_BOOK_QUERY);

  try {
    const params = new URLSearchParams({
      fields: "key,title,author_name,cover_i,first_publish_year,subject,ia,lending_identifier_s,lending_edition_s,has_fulltext,public_scan_b,ebook_access,availability",
      lang: "en",
      limit: String(searchLimit),
      page: String(clampInteger(Number(req.query.page || 1), 1, 100, 1)),
      q: searchQuery.replace(/^subject:/i, ""),
    });

    const data = await fetchJson(`${OPEN_LIBRARY_SEARCH_ENDPOINT}?${params.toString()}`, {
      headers: getOpenLibraryHeaders(),
      serviceName: "Open Library",
    });
    const relevantItems = (Array.isArray(data.docs) ? data.docs : []).filter(isWellbeingLibraryBook);
    const selectedItems = await getOpenLibraryDisplayItems(relevantItems, maxResults);
    const bookIds = selectedItems
      .map((item, index) => getOpenLibraryBookId(item, item.sourceId, index))
      .filter(Boolean);
    const sourceIds = selectedItems.map((item) => item.sourceId).filter(Boolean);
    const downloadsByBookId = await getStudentDownloads(studentNumber, bookIds, sourceIds);
    const progressBookIds = [
      ...bookIds,
      ...Array.from(downloadsByBookId.values()).map((download) => download?.bookId).filter(Boolean),
    ];
    const progressByBookId = await getStudentProgress(studentNumber, [...new Set(progressBookIds)]);
    const books = selectedItems.map((item, index) => mapOpenLibraryBook(item, index, progressByBookId, downloadsByBookId));

    return res.json({
      books,
      query: searchQuery,
      totalItems: books.length,
    });
  } catch (error) {
    return res.status(502).json({ message: error.message || "Failed to load library books." });
  }
});

router.get("/my-shelf", requireStudentOnlyAuth, async (req, res) => {
  const studentNumber = resolveRequestStudentNumber(req);
  const builtInBookIds = parseBookIds(req.query.builtInBookIds || "");

  if (!STUDENT_NUMBER_PATTERN.test(studentNumber)) {
    return res.status(400).json({ message: "Valid student number is required." });
  }

  try {
    const [books, builtInProgress] = await Promise.all([
      getStudentShelfDownloads(studentNumber),
      getStudentProgress(studentNumber, builtInBookIds),
    ]);

    return res.json({
      books,
      progressByBookId: Object.fromEntries(builtInProgress.entries()),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to load your shelf." });
  }
});

router.post("/download", requireStudentOnlyAuth, async (req, res) => {
  const studentNumber = resolveRequestStudentNumber(req);
  const bookId = normalizeCompactSpaces(req.body.bookId || "");
  const provider = normalizeCompactSpaces(req.body.provider || "openlibrary").toLowerCase();
  const sourceId = normalizeCompactSpaces(req.body.sourceId || "");
  const bookTitle = normalizeCompactSpaces(req.body.bookTitle || "");
  const authors = normalizeCompactSpaces(req.body.authors || "");

  if (!STUDENT_NUMBER_PATTERN.test(studentNumber)) {
    return res.status(400).json({ message: "Valid student number is required." });
  }
  if (!bookId) {
    return res.status(400).json({ message: "Book id is required." });
  }
  if (provider !== "openlibrary") {
    return res.status(400).json({ message: "Only Open Library free full EPUB books are supported." });
  }
  if (!sourceId) {
    return res.status(400).json({ message: "Open Library source id is required." });
  }

  try {
    const existingDownload = await getStudentDownload(studentNumber, bookId) || await getStudentDownloadBySourceId(studentNumber, sourceId);
    if (existingDownload) {
      return res.json({
        alreadyDownloaded: true,
        download: existingDownload,
        message: "This book is already in My Shelf.",
      });
    }

    const downloadUrl = await fetchOpenLibraryEpubDownloadUrl(sourceId);
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

router.delete("/download", requireStudentOnlyAuth, async (req, res) => {
  const studentNumber = resolveRequestStudentNumber(req);
  const bookId = normalizeCompactSpaces(req.query.bookId || "");

  if (!STUDENT_NUMBER_PATTERN.test(studentNumber)) {
    return res.status(400).json({ message: "Valid student number is required." });
  }
  if (!bookId) {
    return res.status(400).json({ message: "Book id is required." });
  }
  if (isBuiltInLibraryBook(bookId)) {
    return res.status(400).json({ message: "Built-in books cannot be removed from My Shelf." });
  }

  try {
    const removedCount = await deleteStudentDownload(studentNumber, bookId);
    return res.json({
      message: removedCount > 0 ? "Book removed from My Shelf." : "This book was not in My Shelf.",
      removed: removedCount > 0,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to remove this book." });
  }
});

router.get("/download-file", requireStudentOnlyAuth, async (req, res) => {
  const studentNumber = resolveRequestStudentNumber(req);
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
    if (download.provider === "openlibrary" && download.sourceId) {
      const freshDownloadUrl = await fetchOpenLibraryEpubDownloadUrl(download.sourceId);
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

router.post("/progress", requireStudentOnlyAuth, async (req, res) => {
  const studentNumber = resolveRequestStudentNumber(req);
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
    const canReadInApp = await canUseInAppReader(studentNumber, bookId);
    if (!canReadInApp) {
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

router.get("/reading-reward/status", requireStudentOnlyAuth, async (req, res) => {
  const studentNumber = resolveRequestStudentNumber(req);

  if (!STUDENT_NUMBER_PATTERN.test(studentNumber)) {
    return res.status(400).json({ message: "Valid student number is required." });
  }

  try {
    const status = await getReadingAchievementStatus(studentNumber);
    return res.json(status);
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to fetch reading achievements." });
  }
});

router.post("/reading-reward", requireStudentOnlyAuth, async (req, res) => {
  const studentNumber = resolveRequestStudentNumber(req);
  const bookId = normalizeCompactSpaces(req.body.bookId || "");
  const bookTitle = normalizeCompactSpaces(req.body.bookTitle || "");
  const readingSeconds = clampInteger(Number(req.body.readingSeconds), 0, 24 * 60 * 60, 0);
  const achievementKey = normalizeCompactSpaces(req.body.achievementKey || "");

  if (!STUDENT_NUMBER_PATTERN.test(studentNumber)) {
    return res.status(400).json({ message: "Valid student number is required." });
  }
  if (!bookId) {
    return res.status(400).json({ message: "Book id is required." });
  }

  try {
    const status = await getReadingAchievementStatus(studentNumber);
    const nextAchievementKey = status.nextAchievement?.key || "";
    const achievement = achievementKey
      ? getReadingAchievementByKey(achievementKey)
      : getReadingAchievementByKey(nextAchievementKey);

    if (!achievement || !nextAchievementKey) {
      return res.status(409).json({
        ...status,
        message: "All reading achievements have already been claimed.",
      });
    }

    if (achievement.key !== nextAchievementKey) {
      return res.status(409).json({
        ...status,
        message: "Claim the next reading achievement first.",
      });
    }

    if (readingSeconds < achievement.seconds) {
      return res.status(400).json({
        ...status,
        message: `Read for ${formatReadingDuration(achievement.seconds)} before claiming this achievement.`,
      });
    }

    const canReadInApp = await canUseInAppReader(studentNumber, bookId);
    if (!canReadInApp) {
      return res.status(403).json({ message: "Download this book before claiming reading rewards." });
    }

    const totalTala = await grantReadingReward({
      achievement,
      bookId,
      bookTitle,
      readingSeconds,
      studentNumber,
    });
    const nextStatus = await getReadingAchievementStatus(studentNumber);

    return res.json({
      ...nextStatus,
      achievement: mapReadingAchievement(achievement, true),
      message: `${achievement.title} unlocked. You earned +${achievement.rewardTala} Tala.`,
      rewardTala: achievement.rewardTala,
      totalTala,
    });
  } catch (error) {
    if (error?.code === "23505") {
      const status = await getReadingAchievementStatus(studentNumber);
      return res.status(409).json({
        ...status,
        message: "This reading achievement was already claimed.",
      });
    }

    return res.status(500).json({ message: error.message || "Failed to claim reading reward." });
  }
});

router.post("/rating", requireStudentOnlyAuth, async (req, res) => {
  const studentNumber = resolveRequestStudentNumber(req);
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
    const canReadInApp = await canUseInAppReader(studentNumber, bookId);
    if (!canReadInApp) {
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
