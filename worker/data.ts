import type { Env } from "./env";

export const DATA_NAMES = ["guide", "towns", "terms", "items", "pokemon", "pokemon-detail"] as const;
export type DataName = (typeof DATA_NAMES)[number];

export function isDataName(name: string): name is DataName {
  return (DATA_NAMES as readonly string[]).includes(name);
}

function isStr(v: unknown): v is string {
  return typeof v === "string";
}
function isNum(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}
function isBool(v: unknown): v is boolean {
  return typeof v === "boolean";
}
function isObj(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function isLocalizedName(v: unknown): v is { en: string; ja: string } {
  return isObj(v) && isStr(v.en) && isStr(v.ja);
}

function isGuideSection(v: unknown): boolean {
  return isObj(v) && isStr(v.id) && isStr(v.titleEn) && isStr(v.titleJa) && isStr(v.body);
}

function isTermEntry(v: unknown): boolean {
  return isObj(v) && isNum(v.id) && isStr(v.en) && isStr(v.ja);
}

function isEvolutionRef(v: unknown): boolean {
  if (!isObj(v)) return false;
  if (v.id !== null && !isNum(v.id)) return false;
  if (v.en !== undefined && !isStr(v.en)) return false;
  if (v.ja !== undefined && !isStr(v.ja)) return false;
  return isStr(v.condition);
}

function isPokemonDetail(v: unknown): boolean {
  if (!isObj(v)) return false;
  if (!isNum(v.id)) return false;
  if (!Array.isArray(v.types) || !v.types.every(isLocalizedName)) return false;
  if (!isObj(v.stats)) return false;
  const statKeys = ["hp", "attack", "defense", "specialAttack", "specialDefense", "speed"];
  if (!statKeys.every((k) => isNum((v.stats as Record<string, unknown>)[k]))) return false;
  if (
    !Array.isArray(v.abilities) ||
    !v.abilities.every((a) => isLocalizedName(a) && isBool((a as Record<string, unknown>).isHidden))
  )
    return false;
  if (!Array.isArray(v.moves) || !v.moves.every((m) => isLocalizedName(m) && isNum((m as Record<string, unknown>).level)))
    return false;
  if (v.evolvesFrom !== null && !isEvolutionRef(v.evolvesFrom)) return false;
  if (!Array.isArray(v.evolvesTo) || !v.evolvesTo.every(isEvolutionRef)) return false;
  return true;
}

const VALIDATORS: Record<DataName, (data: unknown) => string | null> = {
  guide: (data) =>
    Array.isArray(data) && data.every(isGuideSection) ? null : "must be an array of { id, titleEn, titleJa, body }",
  towns: (data) => (Array.isArray(data) && data.every(isTermEntry) ? null : "must be an array of { id, en, ja }"),
  terms: (data) => (Array.isArray(data) && data.every(isTermEntry) ? null : "must be an array of { id, en, ja }"),
  items: (data) => (Array.isArray(data) && data.every(isTermEntry) ? null : "must be an array of { id, en, ja }"),
  pokemon: (data) => (Array.isArray(data) && data.every(isTermEntry) ? null : "must be an array of { id, en, ja }"),
  "pokemon-detail": (data) =>
    Array.isArray(data) && data.every(isPokemonDetail) ? null : "must be an array of PokemonDetail objects",
};

export function validateData(name: DataName, data: unknown): string | null {
  const ids = Array.isArray(data) ? data.map((d) => (isObj(d) ? d.id : undefined)) : [];
  if (new Set(ids).size !== ids.length) return "duplicate id in data";
  return VALIDATORS[name](data);
}

function kvKey(name: DataName): string {
  return `data:${name}`;
}

export async function readData(env: Env, name: DataName, origin: string): Promise<unknown> {
  const stored = await env.DATA_KV.get(kvKey(name));
  if (stored !== null) return JSON.parse(stored);

  // Seed from the bundled static file on first read.
  const res = await env.ASSETS.fetch(new Request(`${origin}/data/${name}.json`));
  if (!res.ok) throw new Error(`No seed data for "${name}"`);
  const data = await res.json();
  await env.DATA_KV.put(kvKey(name), JSON.stringify(data));
  return data;
}

export async function writeData(env: Env, name: DataName, data: unknown): Promise<void> {
  await env.DATA_KV.put(kvKey(name), JSON.stringify(data));
}
