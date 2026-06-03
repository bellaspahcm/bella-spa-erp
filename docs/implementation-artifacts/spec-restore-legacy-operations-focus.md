---
title: Restore Legacy Operations Focus
type: one-shot
created: 2026-06-03
status: done
route: one-shot
---

# Restore Legacy Operations Focus

## Intent

Problem: Core-platform lab work is paused. The legacy production project must remain the priority until customer-facing operations are stable and repeatable.

Approach: Keep `D:\Antigravity\Projects\BELLA SPA ERP` on `main` as the active worktree, preserve the rollback tag `pre-core-platform-baseline-2026-06-03`, and start operational hardening with environment-contract cleanup before further refactors.

## Baseline Evidence

- Current branch: `main`.
- Worktree was clean before this one-shot documentation/env change.
- Rollback baseline exists: `pre-core-platform-baseline-2026-06-03`.
- `npx.cmd tsc --noEmit --incremental false` passed.
- `npm.cmd test -- --runInBand` passed: 65 suites / 706 tests.
- Local `npm.cmd run build` compiled and typechecked, then failed page-data collection because required Supabase env values were absent from local `.env.local`.

## Change

- Added `.env.example` so future local/dev/deploy setup has an explicit list of required and optional environment variables.

## Next Operations Order

1. Fill local `.env.local` from production/staging secrets, never from committed files.
2. Re-run `npm.cmd run build`.
3. Continue hardening customer-facing operations in this order:
   - payment webhook and accounting worker env/runtime guards
   - booking/session mutation rollback paths
   - inventory transfer and monthly reconciliation failure states
   - dashboard/HQ error boundaries and empty states
