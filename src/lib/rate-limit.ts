// Token-bucket rate limiter.
// Backend selection via RATE_LIMIT_BACKEND env var:
//   unset / "memory" → in-process Map (not safe for Vercel multi-region)
//   "supabase"        → Postgres-backed via consume_token RPC (distributed)
//
// When RATE_LIMIT_BACKEND=supabase, an in-memory L1 cache (5s TTL) short-circuits
// the DB call for repeat hits within the same Lambda invocation window.

export interface TokenBucket {
  tokens: number;
  lastRefill: number;
}

// ── In-process state (L1 cache + fallback) ───────────────────────────────────

const buckets = new Map<string, TokenBucket>();

// L1 cache: stores last DB-confirmed state with a timestamp so we avoid
// a round-trip on every request within the same short window.
const l1Cache = new Map<string, { allowed: boolean; expiresAt: number }>();
const L1_TTL_MS = 5_000;

// ── In-memory implementation (default / fallback) ────────────────────────────

function rateLimitMemory(
  identifier: string,
  capacity: number,
  refillRatePerSecond: number
): boolean {
  const now = Date.now();

  if (!buckets.has(identifier)) {
    buckets.set(identifier, { tokens: capacity - 1, lastRefill: now });
    return true;
  }

  const bucket = buckets.get(identifier)!;
  const timePassed = (now - bucket.lastRefill) / 1000;

  bucket.tokens = Math.min(capacity, bucket.tokens + timePassed * refillRatePerSecond);
  bucket.lastRefill = now;

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    return true;
  }

  return false;
}

// ── Supabase / distributed implementation ────────────────────────────────────

async function rateLimitSupabase(
  identifier: string,
  capacity: number,
  refillRatePerSecond: number
): Promise<boolean> {
  const now = Date.now();

  // L1 cache: if we recently decided to BLOCK this key, keep blocking without
  // hitting the DB (avoids thundering-herd on burst traffic).
  const cached = l1Cache.get(identifier);
  if (cached && cached.expiresAt > now && !cached.allowed) {
    return false;
  }

  try {
    const { createClient } = await import('@/lib/supabase-server');
    const supabase = await createClient();

    // consume_token is not yet in the auto-generated DB types (migration 20260528010000
    // must be applied and `supabase gen types` re-run before this cast can be removed).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.rpc as any)('consume_token', {
      p_key: identifier,
      p_capacity: capacity,
      p_refill_per_sec: refillRatePerSecond,
    });

    if (error) {
      // DB unavailable: fall back to in-memory so we don't hard-block traffic.
      console.warn('[rate-limit] Supabase RPC error, falling back to memory:', error.message);
      return rateLimitMemory(identifier, capacity, refillRatePerSecond);
    }

    const allowed = data === true;
    l1Cache.set(identifier, { allowed, expiresAt: now + L1_TTL_MS });
    return allowed;
  } catch (err) {
    console.warn('[rate-limit] Unexpected error, falling back to memory:', err);
    return rateLimitMemory(identifier, capacity, refillRatePerSecond);
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

const backend = process.env.RATE_LIMIT_BACKEND ?? 'memory';

/**
 * Synchronous variant — always uses the in-memory backend.
 * Use this only in contexts where async is not possible.
 */
export function rateLimit(
  identifier: string,
  capacity: number,
  refillRatePerSecond: number
): boolean {
  return rateLimitMemory(identifier, capacity, refillRatePerSecond);
}

/**
 * Async variant — uses the configured backend (memory or supabase).
 * Prefer this in Server Actions and API Routes.
 */
export async function rateLimitAsync(
  identifier: string,
  capacity: number,
  refillRatePerSecond: number
): Promise<boolean> {
  if (backend === 'supabase') {
    return rateLimitSupabase(identifier, capacity, refillRatePerSecond);
  }
  return rateLimitMemory(identifier, capacity, refillRatePerSecond);
}
