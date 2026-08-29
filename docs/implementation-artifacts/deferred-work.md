# Deferred Work

## Phase 7 Deployment and Operations

- Provision an isolated staging Vercel project, staging application Supabase database, URL, and bypass secret; then run staging preview/smoke/promote. The separate Supabase E2E database is already provisioned.
- Configure GitHub Production required reviewers plus VERCEL_TOKEN, VERCEL_PRODUCTION_PROJECT_ID, PRODUCTION_SUPABASE_DB_URL, and bypass secret; then run the immutable production release. E2E repository secrets are already configured.
- Run emergency-rollback.sh in dry-run mode against a real previous Ready production deployment and retain evidence.
- Enable paid Supabase Read Replica only when approved; add an authoritative replication-lag RPC or metric before marking replica health complete.
- Regenerate Supabase database types for api_partners and API gateway tables, then remove temporary local typed adapters.
- Cancel or ignore stale SLA configuration responses when the selected partner changes during an in-flight request.

## F5.6 Deferred Work - 2026-08-29

- F5.6 Cash + Prepayment reconciliation is complete/verified/pushed. Future work should start from Finance OS Completion Review, not new F5.6 implementation.
- Resolve the 17 legacy/orphan official test/pre-production `finance_vendor_prepayments` facts before broad production validation. Current position contract raises `F4_PREPAYMENT_POSITION_CURRENCY_AUTHORITY_MISSING` instead of inferring currency.
- Consider a future F2 contract extension for unmapped active bank-account coverage. Current approved contract intentionally exposes mapped accounts only.
- Consider future source-content hashing for F5 evidence if Finance allows recalculation after mutable upstream fixture/test data. Current behavior preserves existing F5 idempotency pattern.
- Consider future F2 map hardening for linked-account type/currency policy if a formal cash account invariant is approved.
