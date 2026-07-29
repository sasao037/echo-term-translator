const SESSION_COOKIE = "echo_admin_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

function timingSafeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);
  // Compare against a fixed-length buffer so the loop length never reveals
  // the real password length, then fold in a length mismatch at the end.
  const len = Math.max(aBytes.length, bBytes.length, 32);
  let diff = aBytes.length === bBytes.length ? 0 : 1;
  for (let i = 0; i < len; i++) {
    diff |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0);
  }
  return diff === 0;
}

export function checkPassword(submitted: string, expected: string): boolean {
  if (!expected) return false;
  return timingSafeEqual(submitted, expected);
}

async function hmac(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function createSessionCookie(secret: string): Promise<string> {
  const expires = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payload = String(expires);
  const sig = await hmac(secret, payload);
  const value = `${payload}.${sig}`;
  return `${SESSION_COOKIE}=${value}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${SESSION_TTL_SECONDS}`;
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`;
}

function getCookie(request: Request, name: string): string | undefined {
  const header = request.headers.get("Cookie");
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return rest.join("=");
  }
  return undefined;
}

export async function isAuthenticated(request: Request, secret: string): Promise<boolean> {
  const value = getCookie(request, SESSION_COOKIE);
  if (!value) return false;
  const [payload, sig] = value.split(".");
  if (!payload || !sig) return false;
  const expected = await hmac(secret, payload);
  if (!timingSafeEqual(sig, expected)) return false;
  const expires = Number(payload);
  if (!Number.isFinite(expires) || expires < Date.now() / 1000) return false;
  return true;
}
