-- Make critical RPC execution privileges explicit.
-- This avoids production-only PostgREST failures when a function is created or
-- replaced and the expected role grant is not present.

GRANT EXECUTE ON FUNCTION public.get_chat_customers() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_service_performance(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_monthly_pnl(UUID, DATE) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.lock_monthly_records(UUID, DATE) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_financial_anomalies(UUID) TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.enqueue_accounting_event(UUID, TEXT, TEXT, UUID, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_outbox_batch(INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_outbox_completed(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_outbox_failed(UUID, TEXT) TO service_role;

GRANT EXECUTE ON FUNCTION public.ensure_open_period(UUID, DATE) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.preview_closing_entries(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.close_accounting_period(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reopen_accounting_period(UUID) TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.get_trial_balance(UUID, DATE) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_income_statement(UUID, DATE, DATE) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_balance_sheet(UUID, DATE) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_account_ledger(UUID, UUID, DATE, DATE) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_cash_flow_statement(UUID, DATE, DATE) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_reconciliation_report(UUID, DATE, DATE) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_consolidated_pnl(DATE, DATE) TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.get_accounting_readiness(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.preview_legacy_ledger_sync(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sync_legacy_to_ledger_atomic(UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.resolve_accounting_review_item(UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.backfill_accounting_metadata(UUID, INTEGER) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_remaining_payment_atomic(
    UUID, NUMERIC, TEXT, DATE, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, TEXT, JSONB, JSONB
) TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.calculate_ktv_salary_sheet(DATE) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_salary_reconciliation_report(UUID, DATE) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_salary_reconciliation(DATE) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_ai_attendance_kpis(DATE) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_ktv_leaderboard(UUID, DATE) TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.get_effective_subscription_entitlements(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_tenant_sms_usage(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.renew_tenant_subscription(TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.increment_tenant_sms(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_session_tenant(UUID) TO authenticated, service_role;
