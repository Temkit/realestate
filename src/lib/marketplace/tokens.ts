/**
 * Magic-link tokens.
 * - Dispatch replies: stateless HMAC-signed tokens (no schema change).
 * - Appointments: random tokens stored on the row (confirm_token / manage_token).
 */

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { getSigningSecret } from "./signing";

// Dispatch reply links go to providers by email — sign with the dedicated
// marketplace secret, never the admin password (see signing.ts).
const getSecret = getSigningSecret;

export type DispatchAction = "answered" | "disputed";

const DISPATCH_TOKEN_TTL_DAYS = 30;

export function signDispatchToken(
  dispatchId: number,
  action: DispatchAction
): string | null {
  const secret = getSecret();
  if (!secret) return null;
  const exp = Date.now() + DISPATCH_TOKEN_TTL_DAYS * 86400_000;
  const payload = `${dispatchId}.${action}.${exp}`;
  const sig = createHmac("sha256", secret).update(`dispatch:${payload}`).digest("base64url");
  return Buffer.from(payload).toString("base64url") + "." + sig;
}

export function verifyDispatchToken(
  token: string
): { dispatchId: number; action: DispatchAction } | null {
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
  const expected = createHmac("sha256", secret).update(`dispatch:${payload}`).digest("base64url");
  if (sig.length !== expected.length) return null;
  if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;

  const [idStr, action, expStr] = payload.split(".");
  const exp = Number(expStr);
  const dispatchId = Number(idStr);
  if (!dispatchId || !exp || exp < Date.now()) return null;
  if (action !== "answered" && action !== "disputed") return null;
  return { dispatchId, action };
}

export function randomToken(): string {
  return randomBytes(24).toString("base64url");
}

export function randomId(): string {
  return randomBytes(9).toString("base64url"); // 12 chars, fits leads.id
}
