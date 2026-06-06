-- Backfill completed session accounting metadata so readiness checks do not
-- treat historical completed sessions as unclassified business events.

WITH completed_session_payload AS (
  SELECT
    sl.id,
    sl.booking_id,
    sl.completed_by_ktv_id,
    sl.completed_date,
    sl.status,
    GREATEST(
      0::NUMERIC,
      COALESCE(b.full_price, 0)::NUMERIC
        * (1 - LEAST(GREATEST(COALESCE(b.discount_percent, 0)::NUMERIC, 0), 100) / 100)
    ) / GREATEST(COALESCE(b.total_sessions, 1), 1)::NUMERIC AS earned_revenue
  FROM public.session_logs sl
  JOIN public.bookings b ON b.id = sl.booking_id
  WHERE lower(COALESCE(sl.status, '')) = 'completed'
)
UPDATE public.session_logs sl
SET business_event_type = 'SESSION_REVENUE_RECOGNIZED',
    accounting_review_status = CASE
      WHEN sl.accounting_review_status = 'POSTING_FAILED' THEN sl.accounting_review_status
      ELSE 'UNREVIEWED'
    END,
    accounting_metadata = jsonb_strip_nulls(
      COALESCE(sl.accounting_metadata, '{}'::jsonb)
      || jsonb_build_object(
        'session_log_id', payload.id,
        'booking_id', payload.booking_id,
        'earned_revenue', payload.earned_revenue,
        'completed_by_ktv_id', payload.completed_by_ktv_id,
        'completed_date', payload.completed_date,
        'status', payload.status
      )
    )
FROM completed_session_payload payload
WHERE sl.id = payload.id
  AND sl.accounting_review_status <> 'POSTING_FAILED'
  AND (
    sl.business_event_type IS NULL
    OR sl.accounting_metadata IS NULL
    OR sl.accounting_metadata->>'earned_revenue' IS NULL
  );
