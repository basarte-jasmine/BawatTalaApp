import type { LibraryBookRecord } from "./backend-api";

export type LibraryFilterSource = "all" | "builtin" | "downloaded";
export type LibrarySortOption = "recent" | "title" | "author";

export function isBuiltInBook(book: LibraryBookRecord): boolean {
  return book.provider === "builtin" || (typeof book.id === "string" && book.id.startsWith("builtin-"));
}

export function filterAndSortLibraryBooks(
  books: LibraryBookRecord[],
  options: {
    source?: LibraryFilterSource;
    sort?: LibrarySortOption;
  } = {}
): LibraryBookRecord[] {
  const { source = "all", sort } = options;

  let filtered = books;
  if (source === "builtin") {
    filtered = books.filter((b) => isBuiltInBook(b));
  } else if (source === "downloaded") {
    filtered = books.filter((b) => !isBuiltInBook(b));
  }

  if (!sort) {
    return filtered;
  }

  const getRecentTimestamp = (book: LibraryBookRecord): number => {
    const timeStr =
      book.progress?.lastOpenedAt ||
      book.progress?.updatedAt ||
      book.progress?.finishedAt ||
      book.downloadedAt;
    if (timeStr) {
      const parsed = new Date(timeStr).getTime();
      if (!Number.isNaN(parsed)) return parsed;
    }
    return 0;
  };

  const sorted = [...filtered].sort((a, b) => {
    if (sort === "title") {
      return (a.title || "").localeCompare(b.title || "", undefined, { sensitivity: "base" });
    }
    if (sort === "author") {
      return (a.author || "").localeCompare(b.author || "", undefined, { sensitivity: "base" });
    }
    if (sort === "recent") {
      const timeA = getRecentTimestamp(a);
      const timeB = getRecentTimestamp(b);
      if (timeA !== timeB) {
        return timeB - timeA; // Descending (most recent first)
      }
      return (a.title || "").localeCompare(b.title || "", undefined, { sensitivity: "base" });
    }
    return 0;
  });

  return sorted;
}


export function paginateBooks<T>(items: T[], page: number, pageSize = 10): {
  items: T[];
  totalItems: number;
  totalPages: number;
  currentPage: number;
} {
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const startIndex = (currentPage - 1) * pageSize;
  const slicedItems = items.slice(startIndex, startIndex + pageSize);

  return {
    items: slicedItems,
    totalItems,
    totalPages,
    currentPage,
  };
}

export function getPaginationPageNumbers(currentPage: number, totalPages: number): (number | "...")[] {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  // If near the start
  if (currentPage <= 2) {
    return [1, 2, 3, "...", totalPages];
  }

  // If near the end
  if (currentPage >= totalPages - 1) {
    return [1, "...", totalPages - 2, totalPages - 1, totalPages];
  }

  // Middle
  return [1, "...", currentPage - 1, currentPage, currentPage + 1, "...", totalPages];
}
