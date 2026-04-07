/**
 * In-memory rate limiter for server actions.
 * Two windows: 10 requests/minute, 30 requests/hour.
 */

const store = new Map<string, number[]>();

// Cleanup stale entries every 5 minutes
let lastCleanup = Date.now();
const CLEANUP_INTERVAL = 5 * 60 * 1000;

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  const hourAgo = now - 3600_000;
  for (const [key, timestamps] of store) {
    const valid = timestamps.filter((t) => t > hourAgo);
    if (valid.length === 0) {
      store.delete(key);
    } else {
      store.set(key, valid);
    }
  }
}

export function checkRateLimit(ip: string): {
  allowed: boolean;
  retryAfter?: number;
} {
  cleanup();

  const now = Date.now();
  const timestamps = store.get(ip) || [];

  // Filter to last hour
  const hourAgo = now - 3600_000;
  const recent = timestamps.filter((t) => t > hourAgo);

  // Check per-minute limit (10/min)
  const minuteAgo = now - 60_000;
  const lastMinute = recent.filter((t) => t > minuteAgo);
  if (lastMinute.length >= 10) {
    const oldest = lastMinute[0];
    return { allowed: false, retryAfter: Math.ceil((oldest + 60_000 - now) / 1000) };
  }

  // Check per-hour limit (30/hour)
  if (recent.length >= 30) {
    const oldest = recent[0];
    return { allowed: false, retryAfter: Math.ceil((oldest + 3600_000 - now) / 1000) };
  }

  // Allowed — record this request
  recent.push(now);
  store.set(ip, recent);

  return { allowed: true };
}
