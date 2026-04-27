import * as FileSystem from "expo-file-system/legacy";
import JSZip from "jszip";
import { DOMParser } from "@xmldom/xmldom";
import { Platform } from "react-native";

export type EpubReaderPage = {
  eyebrow: string;
  paragraphs: string[];
  title: string;
};

const EPUB_PAGE_TARGET_LENGTH = 1100;
const LIBRARY_EPUB_DIRECTORY = `${FileSystem.documentDirectory ?? ""}library-epubs/`;
const WEB_EPUB_URI_PREFIX = "web-epub:";
const webEpubCache = new Map<string, ArrayBuffer>();

function getElementAttribute(element: Element | null | undefined, attributeName: string) {
  return element?.getAttribute(attributeName) || "";
}

function normalizeZipPath(path: string) {
  const segments: string[] = [];
  String(path || "")
    .replace(/\\/g, "/")
    .split("/")
    .forEach((segment) => {
      if (!segment || segment === ".") return;
      if (segment === "..") {
        segments.pop();
        return;
      }
      segments.push(segment);
    });
  return segments.join("/");
}

function dirname(path: string) {
  const normalized = normalizeZipPath(path);
  const index = normalized.lastIndexOf("/");
  return index >= 0 ? normalized.slice(0, index + 1) : "";
}

function resolveZipPath(baseDirectory: string, href: string) {
  return normalizeZipPath(`${baseDirectory}${decodeURIComponent(String(href || "").split("#")[0])}`);
}

function compactText(value: string) {
  return String(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function textContent(node: Node | null | undefined): string {
  if (!node) return "";
  if (node.nodeType === 3 || node.nodeType === 4) {
    return node.nodeValue || "";
  }

  const elementName = "nodeName" in node ? String(node.nodeName || "").toLowerCase() : "";
  if (["script", "style", "nav", "head"].includes(elementName)) {
    return "";
  }

  const parts: string[] = [];
  for (let index = 0; index < node.childNodes.length; index += 1) {
    const child = node.childNodes.item(index);
    const childText = textContent(child);
    if (childText) parts.push(childText);
  }

  const joined = parts.join(["p", "div", "section", "article", "br", "li", "h1", "h2", "h3"].includes(elementName) ? "\n" : " ");
  return joined;
}

function extractParagraphs(document: Document) {
  const body = document.getElementsByTagName("body").item(0) || document.documentElement;
  const text = textContent(body)
    .split(/\n+/)
    .map(compactText)
    .filter((paragraph) => paragraph.length > 0);

  if (text.length) return text;

  const fallback = compactText(body?.textContent || "");
  return fallback ? [fallback] : [];
}

function getChapterTitle(document: Document, fallbackTitle: string) {
  for (const tagName of ["h1", "h2", "h3", "title"]) {
    const text = compactText(document.getElementsByTagName(tagName).item(0)?.textContent || "");
    if (text) return text.slice(0, 90);
  }
  return fallbackTitle;
}

function chunkParagraphs(paragraphs: string[]) {
  const chunks: string[][] = [];
  let current: string[] = [];
  let currentLength = 0;

  for (const paragraph of paragraphs) {
    if (paragraph.length > EPUB_PAGE_TARGET_LENGTH) {
      if (current.length) {
        chunks.push(current);
        current = [];
        currentLength = 0;
      }

      for (let start = 0; start < paragraph.length; start += EPUB_PAGE_TARGET_LENGTH) {
        chunks.push([paragraph.slice(start, start + EPUB_PAGE_TARGET_LENGTH).trim()]);
      }
      continue;
    }

    if (current.length && currentLength + paragraph.length > EPUB_PAGE_TARGET_LENGTH) {
      chunks.push(current);
      current = [];
      currentLength = 0;
    }

    current.push(paragraph);
    currentLength += paragraph.length;
  }

  if (current.length) chunks.push(current);
  return chunks;
}

function safeFileName(value: string) {
  return String(value || "book").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-|-$/g, "") || "book";
}

function isWebEpubUri(uri: string) {
  return String(uri || "").startsWith(WEB_EPUB_URI_PREFIX);
}

function createWebEpubUri(downloadUrl: string) {
  return `${WEB_EPUB_URI_PREFIX}${encodeURIComponent(downloadUrl)}`;
}

function getWebEpubDownloadUrl(uri: string) {
  return decodeURIComponent(uri.slice(WEB_EPUB_URI_PREFIX.length));
}

async function fetchEpubArrayBuffer(downloadUrl: string) {
  const response = await fetch(downloadUrl, {
    headers: {
      Accept: "application/epub+zip,application/zip,application/octet-stream,*/*",
    },
  });
  const contentType = String(response.headers.get("content-type") || "").toLowerCase();
  const looksLikeWebPage = contentType.includes("text/html") || contentType.includes("application/json");

  if (!response.ok || looksLikeWebPage) {
    throw new Error("The EPUB mirror did not return a downloadable book file. Try Download EPUB again.");
  }

  const arrayBuffer = await response.arrayBuffer();
  if (!arrayBuffer.byteLength) {
    throw new Error("The EPUB file was empty. Try Download EPUB again.");
  }
  return arrayBuffer;
}

async function loadEpubZip(fileUri: string) {
  if (isWebEpubUri(fileUri)) {
    const cachedEpub = webEpubCache.get(fileUri);
    const arrayBuffer = cachedEpub ?? await fetchEpubArrayBuffer(getWebEpubDownloadUrl(fileUri));
    webEpubCache.set(fileUri, arrayBuffer);
    return JSZip.loadAsync(arrayBuffer);
  }

  const base64 = await FileSystem.readAsStringAsync(fileUri, { encoding: FileSystem.EncodingType.Base64 });
  return JSZip.loadAsync(base64, { base64: true });
}

export async function ensureLibraryEpubDirectory() {
  if (!FileSystem.documentDirectory) {
    throw new Error("App document storage is not available on this device.");
  }

  await FileSystem.makeDirectoryAsync(LIBRARY_EPUB_DIRECTORY, { intermediates: true });
  return LIBRARY_EPUB_DIRECTORY;
}

export async function downloadEpubToLibrary(bookId: string, downloadUrl: string) {
  if (Platform.OS === "web" || !FileSystem.documentDirectory) {
    const webEpubUri = createWebEpubUri(downloadUrl);
    const arrayBuffer = await fetchEpubArrayBuffer(downloadUrl);
    await JSZip.loadAsync(arrayBuffer);
    webEpubCache.set(webEpubUri, arrayBuffer);
    return webEpubUri;
  }

  const directory = await ensureLibraryEpubDirectory();
  const fileUri = `${directory}${safeFileName(bookId)}.epub`;
  const result = await FileSystem.downloadAsync(downloadUrl, fileUri, {
    headers: {
      Accept: "application/epub+zip,application/zip,application/octet-stream,*/*",
      "User-Agent": "BawatTalaApp/1.0",
    },
  });
  const status = Number(result.status || 0);
  const contentType = String(result.mimeType || result.headers?.["content-type"] || "").toLowerCase();
  const looksLikeWebPage = contentType.includes("text/html") || contentType.includes("application/json");

  if (status < 200 || status >= 300 || looksLikeWebPage) {
    await FileSystem.deleteAsync(result.uri, { idempotent: true });
    throw new Error("The EPUB mirror did not return a downloadable book file. Try Download EPUB again.");
  }

  return result.uri;
}

export async function localFileExists(uri: string) {
  if (!uri) return false;
  if (isWebEpubUri(uri)) return true;
  if (!FileSystem.documentDirectory) return false;
  const fileInfo = await FileSystem.getInfoAsync(uri);
  return Boolean(fileInfo.exists);
}

export async function readEpubPagesFromFile(fileUri: string, fallbackTitle: string): Promise<EpubReaderPage[]> {
  const zip = await loadEpubZip(fileUri);
  const containerXml = await zip.file("META-INF/container.xml")?.async("string");

  if (!containerXml) {
    throw new Error("This EPUB is missing its container file.");
  }

  const parser = new DOMParser();
  const containerDocument = parser.parseFromString(containerXml, "application/xml");
  const rootfilePath = getElementAttribute(containerDocument.getElementsByTagName("rootfile").item(0), "full-path");

  if (!rootfilePath) {
    throw new Error("This EPUB does not point to a package document.");
  }

  const opfXml = await zip.file(rootfilePath)?.async("string");
  if (!opfXml) {
    throw new Error("This EPUB package document could not be read.");
  }

  const opfDirectory = dirname(rootfilePath);
  const opfDocument = parser.parseFromString(opfXml, "application/xml");
  const manifestItems = Array.from({ length: opfDocument.getElementsByTagName("item").length }, (_, index) =>
    opfDocument.getElementsByTagName("item").item(index),
  );
  const manifestById = new Map(
    manifestItems
      .filter(Boolean)
      .map((item) => [
        getElementAttribute(item, "id"),
        {
          href: getElementAttribute(item, "href"),
          mediaType: getElementAttribute(item, "media-type"),
        },
      ]),
  );

  const itemRefs = Array.from({ length: opfDocument.getElementsByTagName("itemref").length }, (_, index) =>
    opfDocument.getElementsByTagName("itemref").item(index),
  );
  const spinePaths = itemRefs
    .map((itemRef) => manifestById.get(getElementAttribute(itemRef, "idref")))
    .filter((item): item is { href: string; mediaType: string } => Boolean(item?.href))
    .filter((item) => !item.mediaType || /xhtml|html/i.test(item.mediaType))
    .map((item) => resolveZipPath(opfDirectory, item.href));

  const pages: EpubReaderPage[] = [];

  for (const chapterPath of spinePaths) {
    const chapterXml = await zip.file(chapterPath)?.async("string");
    if (!chapterXml) continue;

    const chapterDocument = parser.parseFromString(chapterXml, "application/xhtml+xml");
    const chapterTitle = getChapterTitle(chapterDocument, fallbackTitle);
    const paragraphChunks = chunkParagraphs(extractParagraphs(chapterDocument));

    paragraphChunks.forEach((paragraphs, index) => {
      pages.push({
        eyebrow: index === 0 ? "EPUB Chapter" : "EPUB Page",
        paragraphs,
        title: index === 0 ? chapterTitle : fallbackTitle,
      });
    });
  }

  if (!pages.length) {
    throw new Error("No readable text was found in this EPUB.");
  }

  return pages;
}
