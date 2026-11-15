export interface StorageLike {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
}

export interface SearchHistory {
  getAll: () => string[];
  add: (rawQuery: string) => string[];
  clear: () => string[];
}

const DEFAULT_STORAGE_KEY = "country-search:history";
const DEFAULT_MAX_ITEMS = 6;

export function createSearchHistory(
  storage: StorageLike,
  maxItems = DEFAULT_MAX_ITEMS,
  storageKey = DEFAULT_STORAGE_KEY,
): SearchHistory {
  const read = (): string[] => {
    try {
      const raw = storage.getItem(storageKey);
      if (!raw) {
        return [];
      }
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return [];
      }
      return parsed.filter((item): item is string => typeof item === "string");
    } catch {
      return [];
    }
  };

  const write = (items: string[]): void => {
    try {
      storage.setItem(storageKey, JSON.stringify(items));
    } catch {
      // Игнорируем переполнение или запрет localStorage
    }
  };

  const add = (rawQuery: string): string[] => {
    const query = rawQuery.trim();
    if (!query) {
      return read();
    }

    const normalized = query.toLowerCase();
    const next = [
      query,
      ...read().filter((item) => item.toLowerCase() !== normalized),
    ].slice(0, maxItems);

    write(next);
    return next;
  };

  const clear = (): string[] => {
    write([]);
    return [];
  };

  return {
    getAll: read,
    add,
    clear,
  };
}
