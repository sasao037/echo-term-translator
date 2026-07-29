import { checkPassword, clearSessionCookie, createSessionCookie, isAuthenticated } from "./auth";
import { isDataName, readData, validateData, writeData } from "./data";
import type { Env } from "./env";

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...headers },
  });
}

async function handleLogin(request: Request, env: Env): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "invalid request body" }, 400);
  }
  const password = (body as { password?: unknown } | null)?.password;
  if (typeof password !== "string" || !checkPassword(password, env.ADMIN_PASSWORD)) {
    return json({ ok: false, error: "パスワードが違います" }, 401);
  }
  const cookie = await createSessionCookie(env.SESSION_SECRET);
  return json({ ok: true }, 200, { "Set-Cookie": cookie });
}

function handleLogout(): Response {
  return json({ ok: true }, 200, { "Set-Cookie": clearSessionCookie() });
}

async function handleSession(request: Request, env: Env): Promise<Response> {
  const authed = await isAuthenticated(request, env.SESSION_SECRET);
  return json({ authenticated: authed });
}

async function handleGetData(env: Env, name: string, origin: string): Promise<Response> {
  if (!isDataName(name)) return json({ error: "unknown data name" }, 404);
  try {
    const data = await readData(env, name, origin);
    return json(data);
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
}

async function handlePutData(request: Request, env: Env, name: string): Promise<Response> {
  if (!isDataName(name)) return json({ ok: false, error: "unknown data name" }, 404);
  if (!(await isAuthenticated(request, env.SESSION_SECRET))) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }
  let data: unknown;
  try {
    data = await request.json();
  } catch {
    return json({ ok: false, error: "invalid JSON body" }, 400);
  }
  const error = validateData(name, data);
  if (error) return json({ ok: false, error }, 400);
  await writeData(env, name, data);
  return json({ ok: true });
}

async function handleApi(request: Request, env: Env, url: URL): Promise<Response> {
  const path = url.pathname;

  if (path === "/api/admin/login" && request.method === "POST") return handleLogin(request, env);
  if (path === "/api/admin/logout" && request.method === "POST") return handleLogout();
  if (path === "/api/admin/session" && request.method === "GET") return handleSession(request, env);

  const dataMatch = path.match(/^\/api\/data\/([a-z-]+)$/);
  if (dataMatch) {
    const name = dataMatch[1];
    if (request.method === "GET") return handleGetData(env, name, url.origin);
    if (request.method === "PUT") return handlePutData(request, env, name);
  }

  return json({ error: "not found" }, 404);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      return handleApi(request, env, url);
    }
    return env.ASSETS.fetch(request);
  },
};
