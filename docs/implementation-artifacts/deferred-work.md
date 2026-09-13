# Deferred Work

## Phase 7 Deployment and Operations

- Provision an isolated staging Vercel project, staging application Supabase database, URL, and bypass secret; then run staging preview/smoke/promote. The separate Supabase E2E database is already provisioned.
- Configure GitHub Production required reviewers plus VERCEL_TOKEN, VERCEL_PRODUCTION_PROJECT_ID, PRODUCTION_SUPABASE_DB_URL, and bypass secret; then run the immutable production release. E2E repository secrets are already configured.
- Run emergency-rollback.sh in dry-run mode against a real previous Ready production deployment and retain evidence.
- Enable paid Supabase Read Replica only when approved; add an authoritative replication-lag RPC or metric before marking replica health complete.
- Regenerate Supabase database types for api_partners and API gateway tables, then remove temporary local typed adapters.
- Cancel or ignore stale SLA configuration responses when the selected partner changes during an in-flight request.

## CI Supply-Chain Hardening

- 2026-09-13: Audit and pin all remaining mutable GitHub Actions and container references across `.github/workflows/`. PR #82 only addressed the exact Semgrep OSS new mutable-tag alert for `actions/github-script@v7`; broader pinning should be reviewed as a separate supply-chain hardening change.
