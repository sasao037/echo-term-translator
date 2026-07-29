import type { Env } from "./env";

export type ReportCategory = "type" | "ability" | "move" | "evolution" | "other";
const CATEGORIES: ReportCategory[] = ["type", "ability", "move", "evolution", "other"];

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
  publicNote: string;
  likes: number;
  dislikes: number;
}

type VoteChoice = "like" | "dislike";
type VoteMap = Record<string, VoteChoice>;

const REPORTS_KEY = "reports:list";
const MAX_MESSAGE_LENGTH = 1000;
const MAX_PUBLIC_NOTE_LENGTH = 1000;
const MAX_REPORTS = 2000; // hard cap so KV can't grow unbounded
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_SECONDS = 60 * 60;

// Backfill fields added after some reports were already stored in KV.
function normalize(r: Partial<Report> & Pick<Report, "id" | "pokemonId" | "category" | "message" | "createdAt">): Report {
  return {
    ...r,
    status: r.status ?? "open",
    published: r.published ?? false,
    publicNote: r.publicNote ?? "",
    likes: r.likes ?? 0,
    dislikes: r.dislikes ?? 0,
    pokemonEn: r.pokemonEn ?? "",
    pokemonJa: r.pokemonJa ?? "",
  };
}

async function getReports(env: Env): Promise<Report[]> {
  const stored = await env.DATA_KV.get(REPORTS_KEY);
  if (!stored) return [];
  const parsed: unknown[] = JSON.parse(stored);
  return parsed.map((r) => normalize(r as Parameters<typeof normalize>[0]));
}

async function saveReports(env: Env, reports: Report[]): Promise<void> {
  await env.DATA_KV.put(REPORTS_KEY, JSON.stringify(reports));
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function clientIp(request: Request): string {
  return request.headers.get("CF-Connecting-IP") ?? "unknown";
}

async function isRateLimited(env: Env, ip: string): Promise<boolean> {
  const key = `reports:ratelimit:${ip}`;
  const stored = await env.DATA_KV.get(key);
  const count = stored ? Number(stored) : 0;
  if (count >= RATE_LIMIT_MAX) return true;
  await env.DATA_KV.put(key, String(count + 1), { expirationTtl: RATE_LIMIT_WINDOW_SECONDS });
  return false;
}

export async function handleSubmitReport(request: Request, env: Env): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "invalid request body" }, 400);
  }
  const b = body as Record<string, unknown> | null;

  // Honeypot: real users never fill this hidden field. Bots that do get a
  // fake success so they don't learn to look elsewhere.
  if (typeof b?.website === "string" && b.website.trim() !== "") {
    return json({ ok: true });
  }

  const ip = clientIp(request);
  if (await isRateLimited(env, ip)) {
    return json({ ok: false, error: "送信回数が多すぎます。しばらくしてから再度お試しください。" }, 429);
  }

  const pokemonId = Number(b?.pokemonId);
  const pokemonEn = b?.pokemonEn;
  const pokemonJa = b?.pokemonJa;
  const category = b?.category;
  const message = b?.message;

  if (
    !Number.isFinite(pokemonId) ||
    typeof pokemonEn !== "string" ||
    typeof pokemonJa !== "string" ||
    typeof category !== "string" ||
    !CATEGORIES.includes(category as ReportCategory) ||
    typeof message !== "string" ||
    !message.trim() ||
    message.length > MAX_MESSAGE_LENGTH
  ) {
    return json({ ok: false, error: "入力内容を確認してください。" }, 400);
  }

  const reports = await getReports(env);
  const report: Report = {
    id: crypto.randomUUID(),
    pokemonId,
    pokemonEn,
    pokemonJa,
    category: category as ReportCategory,
    message: message.trim().slice(0, MAX_MESSAGE_LENGTH),
    createdAt: new Date().toISOString(),
    status: "open",
    published: false,
    publicNote: "",
    likes: 0,
    dislikes: 0,
  };
  reports.push(report);
  // Keep only the most recent MAX_REPORTS if the cap is exceeded.
  const trimmed = reports.length > MAX_REPORTS ? reports.slice(reports.length - MAX_REPORTS) : reports;
  await saveReports(env, trimmed);

  return json({ ok: true });
}

export async function handleListReports(env: Env): Promise<Response> {
  const reports = await getReports(env);
  reports.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return json(reports);
}

export async function handleUpdateReport(request: Request, env: Env, id: string): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "invalid request body" }, 400);
  }
  const b = body as Record<string, unknown> | null;

  const reports = await getReports(env);
  const report = reports.find((r) => r.id === id);
  if (!report) return json({ ok: false, error: "not found" }, 404);

  if (b?.status !== undefined) {
    if (b.status !== "open" && b.status !== "resolved") {
      return json({ ok: false, error: "invalid status" }, 400);
    }
    report.status = b.status;
  }
  if (b?.published !== undefined) {
    if (typeof b.published !== "boolean") return json({ ok: false, error: "invalid published" }, 400);
    report.published = b.published;
  }
  if (b?.publicNote !== undefined) {
    if (typeof b.publicNote !== "string" || b.publicNote.length > MAX_PUBLIC_NOTE_LENGTH) {
      return json({ ok: false, error: "invalid publicNote" }, 400);
    }
    report.publicNote = b.publicNote.trim();
  }

  await saveReports(env, reports);
  return json({ ok: true });
}

export async function handleDeleteReport(env: Env, id: string): Promise<Response> {
  const reports = await getReports(env);
  const next = reports.filter((r) => r.id !== id);
  await saveReports(env, next);
  return json({ ok: true });
}

export async function handleListPublicReports(env: Env): Promise<Response> {
  const reports = await getReports(env);
  const visible = reports
    .filter((r) => r.status === "open" || r.published)
    .map((r) => ({
      id: r.id,
      pokemonId: r.pokemonId,
      category: r.category,
      text: r.published ? r.publicNote : r.message,
      resolved: r.status === "resolved",
      published: r.published,
      likes: r.likes,
      dislikes: r.dislikes,
    }))
    .filter((r) => r.text.trim());
  return json(visible);
}

function voteKey(reportId: string): string {
  return `reports:votes:${reportId}`;
}

export async function handleVoteReport(request: Request, env: Env, id: string): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "invalid request body" }, 400);
  }
  const vote = (body as { vote?: unknown } | null)?.vote;
  if (vote !== "like" && vote !== "dislike") {
    return json({ ok: false, error: "invalid vote" }, 400);
  }

  const reports = await getReports(env);
  const report = reports.find((r) => r.id === id);
  if (!report) return json({ ok: false, error: "not found" }, 404);

  const ip = clientIp(request);
  const votesStored = await env.DATA_KV.get(voteKey(id));
  const votes: VoteMap = votesStored ? JSON.parse(votesStored) : {};
  const previous = votes[ip];

  if (previous === vote) {
    // Voting the same way again undoes it.
    delete votes[ip];
    if (vote === "like") report.likes = Math.max(0, report.likes - 1);
    else report.dislikes = Math.max(0, report.dislikes - 1);
  } else {
    if (previous === "like") report.likes = Math.max(0, report.likes - 1);
    else if (previous === "dislike") report.dislikes = Math.max(0, report.dislikes - 1);
    votes[ip] = vote;
    if (vote === "like") report.likes += 1;
    else report.dislikes += 1;
  }

  await env.DATA_KV.put(voteKey(id), JSON.stringify(votes));
  await saveReports(env, reports);
  return json({ ok: true, likes: report.likes, dislikes: report.dislikes, myVote: votes[ip] ?? null });
}
