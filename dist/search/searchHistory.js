const DEFAULT_STORAGE_KEY = "country-search:history";
const DEFAULT_MAX_ITEMS = 6;
export function createSearchHistory(
  storage,
  maxItems = DEFAULT_MAX_ITEMS,
  storageKey = DEFAULT_STORAGE_KEY,
) {
  const read = () => {
    try {
      const raw = storage.getItem(storageKey);
      if (!raw) {
        return [];
      }
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return [];
      }
      return parsed.filter((item) => typeof item === "string");
    } catch {
      return [];
    }
  };
  const write = (items) => {
    try {
      storage.setItem(storageKey, JSON.stringify(items));
    } catch {
      // Игнорируем переполнение или запрет localStorage
    }
  };
  const add = (rawQuery) => {
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
  const clear = () => {
    write([]);
    return [];
  };
  return {
    getAll: read,
    add,
    clear,
  };
}
