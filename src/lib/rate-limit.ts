export interface TokenBucket {
  tokens: number;
  lastRefill: number;
}

const buckets = new Map<string, TokenBucket>();

export function rateLimit(
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
  
  // Refill tokens
  bucket.tokens = Math.min(capacity, bucket.tokens + timePassed * refillRatePerSecond);
  bucket.lastRefill = now;
  
  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    return true;
  }
  
  return false;
}
