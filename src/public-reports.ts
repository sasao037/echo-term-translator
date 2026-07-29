import type { PublicReport, VoteChoice } from "./types";

let reports: PublicReport[] | null = null;
let loading: Promise<PublicReport[]> | null = null;

async function fetchReports(): Promise<PublicReport[]> {
  const res = await fetch("/api/reports/public");
  if (!res.ok) throw new Error(`Failed to load public reports: ${res.status}`);
  return res.json();
}

export async function getPublicReports(pokemonId: number): Promise<PublicReport[]> {
  if (!reports) {
    if (!loading) loading = fetchReports();
    reports = await loading;
  }
  return reports.filter((r) => r.pokemonId === pokemonId);
}

export async function voteReport(
  id: string,
  vote: VoteChoice,
): Promise<{ ok: boolean; likes?: number; dislikes?: number; error?: string }> {
  const res = await fetch(`/api/reports/${id}/vote`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ vote }),
  });
  const data = await res.json().catch(() => null);
  if (!data) return { ok: false, error: `${res.status}` };
  if (data.ok && reports) {
    const r = reports.find((r) => r.id === id);
    if (r) {
      r.likes = data.likes;
      r.dislikes = data.dislikes;
    }
  }
  return data;
}

const MY_VOTES_KEY = "echo-term-translator:my-votes";

function loadMyVotes(): Record<string, VoteChoice> {
  try {
    return JSON.parse(localStorage.getItem(MY_VOTES_KEY) ?? "{}");
  } catch {
    return {};
  }
}

export function getMyVote(reportId: string): VoteChoice | undefined {
  return loadMyVotes()[reportId];
}

export function setMyVote(reportId: string, vote: VoteChoice | null): void {
  const votes = loadMyVotes();
  if (vote) votes[reportId] = vote;
  else delete votes[reportId];
  localStorage.setItem(MY_VOTES_KEY, JSON.stringify(votes));
}
