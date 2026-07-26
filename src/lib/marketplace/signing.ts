/**
 * Signing secret for ALL provider-facing tokens — dispatch reply links,
 * appointment magic links, provider login links, and provider session
 * cookies.
 *
 * SECURITY: this must NOT fall back to ADMIN_PASSWORD. Providers routinely
 * receive emails carrying HMACs signed with this key; if it were the admin
 * password, a provider could offline-brute-force it from a known
 * plaintext+HMAC pair and forge admin sessions / any provider's session.
 * Admin auth keeps its own separate secret (see admin-auth.ts).
 *
 * Set MARKETPLACE_SIGNING_SECRET to a high-entropy value (e.g.
 * `openssl rand -hex 32`). When unset, provider-facing signing fails closed
 * (tokens/sessions can't be minted or verified) rather than using a weak key.
 */
export function getSigningSecret(): string | null {
  return (
    process.env.MARKETPLACE_SIGNING_SECRET ||
    process.env.LINK_SIGNING_SECRET ||
    null
  );
}
