/**
 * Provider portal auth — passwordless magic-link (spec §10 P3 portal).
 *
 * Flow: provider enters email → we email a signed login link → clicking it
 * (GET /api/portal/verify/[token]) sets an HMAC-signed session cookie scoped
 * to that provider_id. No passwords stored. Distinct from admin auth.
 *
 * Signing secret: PORTAL_SESSION_SECRET → LINK_SIGNING_SECRET →
 * ADMIN_SESSION_SECRET → ADMIN_PASSWORD (first present wins).
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSigningSecret } from "./signing";

const COOKIE_NAME = "lux24_provider";
const SESSION_DAYS = 30;
const LOGIN_TOKEN_TTL_MS = 60 * 60_000; // magic link valid 1h

// Provider sessions + login links are provider-facing; sign with the
// dedicated marketplace secret, never the admin password (see signing.ts).
const getSecret = getSigningSecret;

function hmac(secret: string, message: string): string {
  return createHmac("sha256", secret).update(message).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

// ── Login (magic-link) token ──────────────────────────────────────────

export function signLoginToken(providerId: number): string | null {
  const secret = getSecret();
  if (!secret) return null;
  const exp = Date.now() + LOGIN_TOKEN_TTL_MS;
  const payload = `${providerId}.${exp}`;
  return `${Buffer.from(payload).toString("base64url")}.${hmac(secret, `portal-login:${payload}`)}`;
}

export function verifyLoginToken(
  token: string
): { providerId: number; exp: number } | null {
  const secret = getSecret();
  if (!secret) return null;
  const dot = token.lastIndexOf(".");
  if (dot < 0) return null;
  let payload: string;
  try {
    payload = Buffer.from(token.slice(0, dot), "base64url").toString();
  } catch {
    return null;
  }
  const sig = token.slice(dot + 1);
  if (!safeEqual(sig, hmac(secret, `portal-login:${payload}`))) return null;
  const [idStr, expStr] = payload.split(".");
  const providerId = Number(idStr);
  const exp = Number(expStr);
  if (!providerId || !exp || exp < Date.now()) return null;
  return { providerId, exp };
}

// ── Session cookie ────────────────────────────────────────────────────

function signSession(providerId: number, exp: number, secret: string): string {
  return hmac(secret, `portal-session:${providerId}:${exp}`);
}

export async function setProviderSession(providerId: number): Promise<boolean> {
  const secret = getSecret();
  if (!secret) return false;
  const exp = Date.now() + SESSION_DAYS * 86400_000;
  const token = `${providerId}.${exp}.${signSession(providerId, exp, secret)}`;
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 86400,
  });
  return true;
}

export async function clearProviderSession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

function verifySessionToken(token: string | undefined): number | null {
  if (!token) return null;
  const secret = getSecret();
  if (!secret) return null;
  const [idStr, expStr, sig] = token.split(".");
  const providerId = Number(idStr);
  const exp = Number(expStr);
  if (!providerId || !exp || !sig || exp < Date.now()) return null;
  if (!safeEqual(sig, signSession(providerId, exp, secret))) return null;
  return providerId;
}

/** Authenticated provider id, or null. */
export async function getSessionProviderId(): Promise<number | null> {
  const store = await cookies();
  return verifySessionToken(store.get(COOKIE_NAME)?.value);
}

/** Server-component / action guard. Redirects to login when unauthenticated. */
export async function requireProvider(): Promise<number> {
  const providerId = await getSessionProviderId();
  if (!providerId) redirect("/portal/login");
  return providerId;
}
