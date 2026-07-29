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

export interface EvolutionRef {
  id: number | null;
  /** Display name shown when `id` is null (the linked Pokemon isn't in pokemon.json yet). */
  en?: string;
  ja?: string;
  condition: string;
}

export interface PokemonDetail {
  id: number;
  types: LocalizedName[];
  stats: PokemonStats;
  abilities: PokemonAbility[];
  moves: PokemonMove[];
  evolvesFrom: EvolutionRef | null;
  evolvesTo: EvolutionRef[];
}

export type ReportCategory = "type" | "ability" | "move" | "evolution" | "other";

export const REPORT_CATEGORY_LABELS: Record<ReportCategory, string> = {
  type: "タイプ",
  ability: "特性",
  move: "技",
  evolution: "進化",
  other: "その他",
};

export interface Report {
  id: string;
  pokemonId: number;
  pokemonEn: string;
  pokemonJa: string;
  category: ReportCategory;
  message: string;
  createdAt: string;
  status: "open" | "resolved";
  published: boolean;
  /** Admin-edited text shown publicly when `published` is true. */
  publicNote: string;
}

export interface PublishedNote {
  pokemonId: number;
  category: ReportCategory;
  publicNote: string;
}
