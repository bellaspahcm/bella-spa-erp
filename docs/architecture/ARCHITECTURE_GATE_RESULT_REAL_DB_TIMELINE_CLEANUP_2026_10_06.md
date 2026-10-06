# Architecture Gate Result - Real DB Timeline Cleanup

## Status

PASS

## Problem / Non-goals

- Problem: PR #241 CI fails in Real Database Business E2E because three Beauty V2 proof cleanup paths attempt to delete tenant rows while `public.timeline_events` may retain append-only rows with `timeline_events_tenant_id_fkey`.
- Non-goal: no product runtime behavior change, no Healthcare kernel change, no schema/RLS/migration change, no weakening of the branch proof assertions.

## Truth / Source of Truth

- `public.timeline_events` is an append-only platform event table.
- Source of Truth: `supabase/migrations/20260806000000_blueprint_core_schema.sql` defines `timeline_events.tenant_id` referencing `public.tenants(id)` and defines `timeline_events_no_delete`.
- Existing local precedent: `src/__tests__/haircut-nail-chain-seal-real-db.test.ts` retains tenant shells because `timeline_events` has append-only/RLS FK behavior.

## Ownership / Contract Dependency

- Owner: Platform event store owns `timeline_events`; Beauty V2 proof tests are consumers of the real DB fixture environment.
- Contract: proof cleanup may remove mutable business fixture rows but must not require deleting append-only event rows.
- Dependency map: Beauty V2 proof test -> Real DB fixture cleanup -> Platform append-only timeline contract.

## Change Authority

- Authorized layer: test fixture cleanup only.
- Not authorized: Product runtime, Platform schema, Healthcare kernel, Education kernel, RLS, migrations.

## Minimal Plan

- Stop deleting proof tenant rows in the three affected Beauty V2 Real DB cleanup paths.
- Preserve cleanup of business rows: attendance, salary, finance, org, users, outbox/journal rows.
- Adjust residual checks to assert mutable business rows are gone, not append-only tenant shells.
- In the Finance proof, assert the accounting worker processed this proof's `SALARY_PAID` event successfully instead of requiring the entire shared real-DB outbox queue to be clean.

## Verification Plan

- Run targeted Jest for the three affected real DB tests.
- Run changed-file lint for edited tests.
- Run `git diff --check`.
- Push commit and wait for PR #241 checks, especially Real Database Business E2E.
