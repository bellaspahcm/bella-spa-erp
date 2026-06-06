---
title: Add Supabase Migration Drift Check
type: ops-hardening
created: 2026-06-06
status: done
area: deployment-readiness
---

# Intent

Prevent another production incident where GitHub/Vercel has the newest code but Supabase has not applied the matching migrations.

# Root Cause

The application can pass tests and build successfully while the production database is still behind. The recent `inter_branch_clearing_records` permission error came from exactly that gap: the code was deployed, but the database needed a migration apply.

# Change

- Add `scripts/check-supabase-migrations.cjs`.
- Add `npm run db:migration:check`.
- Add CI step `Supabase migration drift check` to `.github/workflows/quality-security.yml`.
- The CI step uses `SUPABASE_DB_URL` when configured.
- If `SUPABASE_DB_URL` is missing in CI, the step skips with a clear message instead of breaking the existing workflow.

# Behavior

The script fails when:

- local migration files are missing on remote;
- remote has migration versions not present in the repo.

The script passes only when local and remote migration version sets match exactly.

# Follow-up

Set GitHub secret `SUPABASE_DB_URL` to enable the CI guard against production/staging Supabase drift.
