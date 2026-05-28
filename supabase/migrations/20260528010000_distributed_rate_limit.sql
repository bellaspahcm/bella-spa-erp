-- Distributed token-bucket rate limiter backed by Postgres.
-- Replaces in-memory Map which is not safe in Vercel multi-region deployments.
-- Enable via RATE_LIMIT_BACKEND=supabase env var; in-memory stays as L1 cache.

CREATE TABLE IF NOT EXISTS public.rate_limit_buckets (
  key            TEXT        PRIMARY KEY,
  tokens         NUMERIC     NOT NULL DEFAULT 0,
  last_refill    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Service role only — never exposed to anon/authenticated via RLS.
ALTER TABLE public.rate_limit_buckets ENABLE ROW LEVEL SECURITY;
-- No RLS policies → only service_role (BYPASSRLS) can access this table.

-- consume_token: atomically refill + decrement one token.
-- Returns TRUE if token was consumed, FALSE if bucket was empty.
-- Uses pg_advisory_xact_lock to prevent races without table-level locks.
CREATE OR REPLACE FUNCTION public.consume_token(
  p_key               TEXT,
  p_capacity          NUMERIC,
  p_refill_per_sec    NUMERIC
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now       TIMESTAMPTZ := NOW();
  v_bucket    public.rate_limit_buckets%ROWTYPE;
  v_elapsed   NUMERIC;
  v_new_tokens NUMERIC;
BEGIN
  -- Advisory lock scoped to this key for the duration of the transaction.
  PERFORM pg_advisory_xact_lock(hashtext(p_key));

  SELECT * INTO v_bucket FROM public.rate_limit_buckets WHERE key = p_key FOR UPDATE;

  IF NOT FOUND THEN
    -- First request: insert full bucket minus one token.
    INSERT INTO public.rate_limit_buckets (key, tokens, last_refill)
    VALUES (p_key, p_capacity - 1, v_now);
    RETURN TRUE;
  END IF;

  -- Refill based on elapsed time.
  v_elapsed    := EXTRACT(EPOCH FROM (v_now - v_bucket.last_refill));
  v_new_tokens := LEAST(p_capacity, v_bucket.tokens + v_elapsed * p_refill_per_sec);

  IF v_new_tokens >= 1 THEN
    UPDATE public.rate_limit_buckets
    SET tokens = v_new_tokens - 1, last_refill = v_now
    WHERE key = p_key;
    RETURN TRUE;
  ELSE
    -- Bucket empty: update last_refill timestamp but do not consume.
    UPDATE public.rate_limit_buckets
    SET tokens = v_new_tokens, last_refill = v_now
    WHERE key = p_key;
    RETURN FALSE;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.consume_token(TEXT, NUMERIC, NUMERIC) TO service_role;

COMMENT ON TABLE public.rate_limit_buckets IS
  'Distributed token-bucket state for API rate limiting. Service-role only.';
COMMENT ON FUNCTION public.consume_token IS
  'Atomically refill and consume one token. Returns false when bucket is empty.';
