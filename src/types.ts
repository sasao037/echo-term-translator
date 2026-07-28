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

export interface LocalizedName {
  en: string;
  ja: string;
}

export interface PokemonStats {
  hp: number;
  attack: number;
  defense: number;
  specialAttack: number;
  specialDefense: number;
  speed: number;
}

export interface PokemonAbility extends LocalizedName {
  isHidden: boolean;
}

export interface PokemonMove extends LocalizedName {
  level: number;
}

export interface PokemonDetail {
  id: number;
  types: LocalizedName[];
  stats: PokemonStats;
  abilities: PokemonAbility[];
  moves: PokemonMove[];
}
