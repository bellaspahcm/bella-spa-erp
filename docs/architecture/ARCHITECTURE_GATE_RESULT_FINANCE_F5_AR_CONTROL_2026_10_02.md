# Architecture Gate Result - Finance F5 AR Control

Date: 2026-10-02
Scope: FINANCE F5 AR CONTROL for Beauty business facts
Status: PASS

## Bella OS / Product Development Process Gate

Truth:
- F5.5 AR_GL_BALANCE already exists as a Finance OS control domain.
- F5 reads AR facts through `finance_ar_facts_as_of(F3_AR:v1)` and GL facts through `finance_journal_entries_as_of(F1_GL:v1)`.
- F5 writes only `f5_control_results` and `f5_control_cases`.
- Beauty V2 completion persists operational checkout facts, but Finance AR control proof is not currently tied to Beauty V2 business facts.
- CI Real DB proof exposed an E2E database parity gap: the isolated database was missing the F5 control schema and did not expose `public.f5_run_reconciliation` even though the frozen F5 contract and generated DB types define them.

Source of truth:
- `docs/architecture/ARCHITECTURE_GATE_RESULT_F5.md`
- `supabase/migrations/20260819000000_f5_schema.sql`
- `supabase/migrations/20260819010000_f5_read_contracts.sql`
- `supabase/migrations/20260819020000_f5_reconstruction_engine.sql`
- `supabase/migrations/20260823000000_f5_ar_reconciliation.sql`
- `supabase/migrations/20260823010000_f5_ar_reconciliation_fix.sql`
- `supabase/migrations/20261001970000_restore_f5_control_schema.sql`
- `supabase/migrations/20261001980000_restore_f5_read_contracts.sql`
- `supabase/migrations/20261001990000_restore_f5_reconstruction_engine.sql`
- `supabase/migrations/20261002000000_restore_f5_reconciliation_rpc.sql`
- `supabase/migrations/20261002010000_restore_f5_ar_reconciliation_rpc.sql`
- `src/__tests__/f5-ar-reconciliation.integration.test.ts`
- `src/products/beauty-spa-v2/__tests__/beauty-spa-v2-real-db.test.ts`
- `src/platform/finance/services/semantic-receivable-charge.service.ts`

Canonical contract:
- Beauty product fact must enter Finance through the Finance semantic receivable contract, not by direct F1/F3 writes from Product.
- F5 AR control consumes only Finance public DB read contracts and writes only F5 evidence/case tables.
- Alert routing for this slice is the existing F5 case route: `VARIANCE` or `QUARANTINED` result creates an `OPEN` `f5_control_cases` row linked by `case_id`.

## Product Manifest

In scope:
- Audit current F5 AR capability.
- Prove Beauty V2 completed-service business facts can be controlled by F5 AR.
- Prove PASS and mismatch/failure cases on Real DB.
- Prove severity routing through F5 result severity.
- Prove alert/case routing through `f5_control_cases`.
- Prove idempotent rerun of the same F5 AR control identity.
- Prove tenant isolation for the control evidence.
- Seal with focused verification.

Out of scope:
- Beauty H8 core changes.
- Booking/resource concurrency changes.
- Session rollback changes.
- Immutable history changes.
- F1/F2/F3 engine changes.
- BabyCare production.
- New Finance subsystem.
- New notification/Slack/alert transport.
- Auto-posting Finance side effects inside `BeautySpaV2Service.completeSession`.

## Ownership Map

| Data / capability | Owner | Authorized action |
| --- | --- | --- |
| Beauty appointment/session operational facts | Beauty OS / Beauty V2 Product | Reuse existing Real DB proof path |
| Service receivable recognition | Finance OS F3 semantic contract | Reuse public `SemanticReceivableChargeService` |
| AR/GL reconciliation | Finance OS F5 | Reuse `f5_run_reconciliation` |
| Severity classification | Finance OS F5 | Verify existing routing |
| Alert/case routing | Finance OS F5 | Verify `f5_control_cases` creation |
| F1/F2/F3 persistence engines | Finance OS | Read only through existing public contracts |

## Contract Dependency Map

```text
Beauty V2 completed session
  -> Finance OS semantic service receivable contract
  -> F3 invoice / receivable ledger / receivable position
  -> F1 posted transaction
  -> F5 AR_GL_BALANCE control
  -> f5_control_results
  -> f5_control_cases when VARIANCE or QUARANTINED
```

## Change Authority

Authorized:
- Add architecture gate evidence for this workstream.
- Add focused Real DB proof using existing Beauty V2 and Finance contracts.
- Register the Real DB proof in the existing real-db Jest boundary if required.
- Add idempotent F5 restore migrations when Real DB E2E proves the frozen F5 schema/contract surface is absent from the isolated database.

Not authorized:
- Runtime Beauty V2 workflow mutation.
- Finance F1/F2/F3 engine mutation.
- New Finance subsystem, scheduler, notification engine, or transport.
- Broad schema migration, F5 contract redesign, or new F5 control domain.

## UI To Contract Reconciliation

No UI change.

## Additive Migration Plan

Add idempotent restore migrations:
- `supabase/migrations/20261001970000_restore_f5_control_schema.sql`
- `supabase/migrations/20261001980000_restore_f5_read_contracts.sql`
- `supabase/migrations/20261001990000_restore_f5_reconstruction_engine.sql`
- `supabase/migrations/20261002000000_restore_f5_reconciliation_rpc.sql`
- `supabase/migrations/20261002010000_restore_f5_ar_reconciliation_rpc.sql`
- `supabase/migrations/20261002020000_reapply_f5_ar_reconciliation_rpc.sql`
- `supabase/migrations/20261002030000_reapply_f5_f1_read_contract_source_id_cast.sql`
- Recreates the already-frozen F5 schema, F5 read contracts, F5 reconstruction RPCs, and final `public.f5_run_reconciliation(UUID, TEXT, TEXT, UUID, TEXT, TIMESTAMPTZ)` body from the existing F5 migrations.
- Re-applies the final AR-capable RPC with a later migration version so an isolated E2E database that already recorded an earlier restore still receives the F5.5 body after F5.1 reconstruction restore.
- Re-applies the existing `F1_GL:v1` read contract with explicit `ft.source_id::UUID`, preserving the frozen `source_id UUID` contract surface while accommodating the physical E2E schema's `VARCHAR(255)` column.
- Grants the same service/auth access as the frozen migrations.
- Sends `NOTIFY pgrst, 'reload schema'` so Real DB E2E can resolve the restored schema/RPCs through PostgREST.
- Does not create or mutate Beauty, H8, booking, session rollback, immutable history, F1, F2, or F3 runtime behavior.

## 11 Automated Verification Gates Plan

1. `git diff --check`.
2. Focused Real DB Beauty V2 F5 AR control proof.
3. Existing F5.5 AR integration proof when Real DB credentials are available.
4. PASS case: Beauty receivable reconciles to MATCHED.
5. Failure/mismatch case: Beauty receivable mismatch routes to VARIANCE.
6. Severity routing: mismatch result carries expected severity.
7. Alert routing: mismatch result creates `OPEN` `f5_control_cases`.
8. Idempotency: same run identity returns the same `run_id` and no duplicate result.
9. Tenant isolation: cross-tenant F5 run cannot see source tenant facts.
10. Static scope scan: no Beauty H8 core, booking concurrency, session rollback, F1/F2/F3 engine edits.
11. CI / PR proof before merge; no merge without terminal checks.

Conclusion:
PASS. Current evidence shows F5.5 exists. The minimal work is Beauty business-fact proof/wiring through existing public contracts plus idempotent F5 restore migrations to make the frozen F5 schema and RPC contract available in the isolated Real DB E2E environment.
