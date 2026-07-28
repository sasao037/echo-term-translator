import type { Category, SearchResult, TermEntry } from "./types";

const DATA_FILES: Record<Category, string> = {
  town: "data/towns.json",
  term: "data/terms.json",
  item: "data/items.json",
  pokemon: "data/pokemon.json",
};

let index: SearchResult[] | null = null;

function toKatakana(s: string): string {
  return s.replace(/[ぁ-ゖ]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) + 0x60),
  );
}

export async function loadIndex(): Promise<SearchResult[]> {
  if (index) return index;

  const entries = await Promise.all(
    (Object.entries(DATA_FILES) as [Category, string][]).map(
      async ([category, path]) => {
        const res = await fetch(`${import.meta.env.BASE_URL}${path}`);
        if (!res.ok) {
          throw new Error(`Failed to load ${path}: ${res.status}`);
        }
        const data: TermEntry[] = await res.json();
        return data.map((entry): SearchResult => ({ ...entry, category }));
      },
    ),
  );

  index = entries.flat();
  return index;
}

export function search(
  entries: SearchResult[],
  query: string,
  limit = 100,
): SearchResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const qJa = toKatakana(q);

  const startsWith: SearchResult[] = [];
  const includes: SearchResult[] = [];

  for (const entry of entries) {
    const en = entry.en.toLowerCase();
    const ja = toKatakana(entry.ja.toLowerCase());

    if (en.startsWith(q) || ja.startsWith(qJa)) {
      startsWith.push(entry);
    } else if (en.includes(q) || ja.includes(qJa)) {
      includes.push(entry);
    }

    if (startsWith.length >= limit) break;
  }

  return [...startsWith, ...includes].slice(0, limit);
}
