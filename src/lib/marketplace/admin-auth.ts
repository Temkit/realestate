/**
 * Admin session auth — spec §6.
 * Single shared password (ADMIN_PASSWORD env) → HMAC-signed expiry cookie.
 * Signing secret: ADMIN_SESSION_SECRET, falling back to ADMIN_PASSWORD.
 * Upgrade path: real auth when the provider portal lands (P3).
 */

import { createHmac, createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const COOKIE_NAME = "lux24_admin";
const SESSION_HOURS = 8;

function getSecret(): string | null {
  return process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD || null;
}

function sign(exp: number, secret: string): string {
  return createHmac("sha256", secret).update(`admin-session:${exp}`).digest("hex");
}

export function verifyPassword(candidate: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  const a = createHash("sha256").update(candidate).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export function createSessionToken(): string | null {
  const secret = getSecret();
  if (!secret) return null;
  const exp = Date.now() + SESSION_HOURS * 3600_000;
  return `${exp}.${sign(exp, secret)}`;
}

export function verifySessionToken(token: string | undefined): boolean {
  if (!token) return false;
  const secret = getSecret();
  if (!secret) return false;
  const [expStr, mac] = token.split(".");
  const exp = Number(expStr);
  if (!exp || !mac || exp < Date.now()) return false;
  const expected = sign(exp, secret);
  if (mac.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(mac), Buffer.from(expected));
}

export async function setSessionCookie(): Promise<boolean> {
  const token = createSessionToken();
  if (!token) return false;
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_HOURS * 3600,
  });
  return true;
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function isAdmin(): Promise<boolean> {
  const store = await cookies();
  return verifySessionToken(store.get(COOKIE_NAME)?.value);
}

/** Server-component / server-action guard. Redirects to login when unauthenticated. */
export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) {
    redirect("/admin/login");
  }
}
