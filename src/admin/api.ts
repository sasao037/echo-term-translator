export type DataName = "guide" | "towns" | "terms" | "items" | "pokemon" | "pokemon-detail";

async function parseJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export async function checkSession(): Promise<boolean> {
  const res = await fetch("/api/admin/session", { credentials: "same-origin" });
  if (!res.ok) return false;
  const data = (await parseJson(res)) as { authenticated?: boolean } | null;
  return !!data?.authenticated;
}

export async function login(password: string): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch("/api/admin/login", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  const data = (await parseJson(res)) as { ok: boolean; error?: string } | null;
  return data ?? { ok: false, error: `${res.status}` };
}

export async function logout(): Promise<void> {
  await fetch("/api/admin/logout", { method: "POST", credentials: "same-origin" });
}

export async function getData<T = unknown>(name: DataName): Promise<T> {
  const res = await fetch(`/api/data/${name}?t=${Date.now()}`, { credentials: "same-origin" });
  if (!res.ok) throw new Error(`${name} の読み込みに失敗しました (${res.status})`);
  return res.json();
}

export async function putData(name: DataName, data: unknown): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`/api/data/${name}`, {
    method: "PUT",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const result = (await parseJson(res)) as { ok: boolean; error?: string } | null;
  return result ?? { ok: false, error: `${res.status}` };
}
