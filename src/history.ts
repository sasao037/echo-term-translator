const STORAGE_KEY = "echo-term-translator:search-history";
const MAX_ENTRIES = 15;

export function loadHistory(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((v): v is string => typeof v === "string")
      : [];
  } catch {
    return [];
  }
}

export function addHistoryEntry(query: string): string[] {
  const trimmed = query.trim();
  if (!trimmed) return loadHistory();

  const deduped = loadHistory().filter((q) => q !== trimmed);
  const next = [trimmed, ...deduped].slice(0, MAX_ENTRIES);

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // localStorage unavailable (e.g. private browsing) — history just won't persist.
  }

  return next;
}

export function clearHistory(): string[] {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  return [];
}
