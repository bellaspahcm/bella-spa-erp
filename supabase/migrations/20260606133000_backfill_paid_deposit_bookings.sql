-- Keep booking status aligned with confirmed deposit payments.
-- `deposit_pending` means the customer still owes the initial deposit.
-- Once confirmed payments cover the configured deposit target, the booking is
-- operationally booked even when the remaining package balance is still unpaid.

WITH paid_deposit_bookings AS (
  SELECT b.id
  FROM public.bookings b
  CROSS JOIN LATERAL (
    SELECT GREATEST(
      0::NUMERIC,
      COALESCE(b.full_price, 0)::NUMERIC
        * (1 - LEAST(GREATEST(COALESCE(b.discount_percent, 0)::NUMERIC, 0), 100) / 100)
    ) AS price_after_discount
  ) price
  CROSS JOIN LATERAL (
    SELECT LEAST(
      GREATEST(COALESCE(b.deposit_amount, 0)::NUMERIC, 0),
      price.price_after_discount
    ) AS deposit_target
  ) target
  CROSS JOIN LATERAL (
    SELECT COALESCE(SUM(
      CASE
        WHEN lower(COALESCE(r.revenue_type, '')) = 'refund' THEN -ABS(COALESCE(r.amount, 0))
        ELSE COALESCE(r.amount, 0)
      END
    ), 0)::NUMERIC AS total_paid
    FROM public.revenue r
    WHERE r.booking_id = b.id
      AND lower(COALESCE(r.status, '')) = 'confirmed'
  ) paid
  WHERE b.status = 'deposit_pending'
    AND target.deposit_target > 0
    AND paid.total_paid + 1 >= target.deposit_target
)
UPDATE public.bookings b
SET status = 'booked',
    updated_at = NOW()
FROM paid_deposit_bookings p
WHERE b.id = p.id;
