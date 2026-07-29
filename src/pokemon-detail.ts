import type { PokemonDetail } from "./types";

let details: Map<number, PokemonDetail> | null = null;
let loading: Promise<Map<number, PokemonDetail>> | null = null;

async function fetchDetails(): Promise<Map<number, PokemonDetail>> {
  const res = await fetch("/api/data/pokemon-detail");
  if (!res.ok) {
    throw new Error(`Failed to load pokemon detail data: ${res.status}`);
  }
  const data: PokemonDetail[] = await res.json();
  return new Map(data.map((d) => [d.id, d]));
}

export async function loadPokemonDetails(): Promise<Map<number, PokemonDetail>> {
  if (details) return details;
  if (!loading) loading = fetchDetails();
  details = await loading;
  return details;
}

export async function getPokemonDetail(id: number): Promise<PokemonDetail | undefined> {
  const map = await loadPokemonDetails();
  return map.get(id);
}
