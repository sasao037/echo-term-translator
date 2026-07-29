import type { PublishedNote } from "./types";

let notes: PublishedNote[] | null = null;
let loading: Promise<PublishedNote[]> | null = null;

async function fetchNotes(): Promise<PublishedNote[]> {
  const res = await fetch("/api/reports/published");
  if (!res.ok) throw new Error(`Failed to load published notes: ${res.status}`);
  return res.json();
}

export async function getPublishedNotes(pokemonId: number): Promise<PublishedNote[]> {
  if (!notes) {
    if (!loading) loading = fetchNotes();
    notes = await loading;
  }
  return notes.filter((n) => n.pokemonId === pokemonId);
}
