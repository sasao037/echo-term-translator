export type Category = "town" | "term" | "item" | "pokemon";

export interface TermEntry {
  id: number;
  en: string;
  ja: string;
}

export interface SearchResult extends TermEntry {
  category: Category;
}

export const CATEGORY_LABELS: Record<Category, string> = {
  town: "地名",
  term: "用語",
  item: "どうぐ",
  pokemon: "ポケモン",
};

export interface GuideSection {
  id: string;
  titleEn: string;
  titleJa: string;
  body: string;
}
