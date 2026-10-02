# BEAUTY V2 FINANCE CONTRACT AUDIT

**Date:** 2026-10-02
**Branch:** `codex/beauty-v2-finance-contract-audit`
**Status:** Audit complete; runtime implementation not started.

## Executive Result

Finance OS exists. Beauty V2 Finance usage is not proven.

Updated checkpoint:

```text
BEAUTY_V2_FINANCE

Finance Engine / F1-F5                 EXISTS
Finance accounting_outbox path          EXISTS
F3 AR allocation contract               EXISTS
F5 / reconciliation / health signals    EXISTS, flow-specific proof required

Beauty V2 -> Finance OS contract        NOT_PROVEN
Beauty V2 service receivable -> F3 AR   NOT_PROVEN
Beauty V2 confirmed payment -> F2/F3    NOT_PROVEN
Beauty V2 F5 reconciliation/control     NOT_PROVEN
Beauty V2 alert/severity routing        NOT_PROVEN
```

Conclusion: do not build Finance for Beauty V2. The next engineering decision is whether to wire Beauty V2 into the existing Finance contract, and only after runtime proof shows the gap is `NOT_WIRED`.

## Canonical Reference: Shared Spa / BabyCare Flow

`buildPackageSaleOutboxEvent` emits `PACKAGE_SALE` with `referenceType: REVENUE`, total amount, payment method, description, and branch/tenant payload (`src/lib/business-rules/accounting-outbox.ts:14-34`).

`buildSessionDoneOutboxEvent` emits `SESSION_DONE` with `referenceType: SESSION_LOG`, earned revenue, deferred revenue, receivable amount, booking id, commission amount, KTV id, branch id, and description (`src/lib/business-rules/accounting-outbox.ts:126-153`).

The outbox helper persists through RPC `enqueue_accounting_event` with tenant, event type, reference type, reference id, and payload. The helper documents idempotency via unique `(tenant_id, event_type, reference_type, reference_id)` (`src/lib/accounting-outbox.ts:130-154`).

Booking creation records confirmed deposit revenue and enqueues `PACKAGE_SALE`; failure to enqueue rolls back the revenue and booking (`src/core/services/order/create-booking-helpers.ts:495-568`).

Session completion calculates revenue recognition and enqueues `SESSION_DONE`; failure to enqueue is treated as accounting-critical (`src/core/services/order/session-completion-helpers.ts:619-648`, `src/core/services/order/session-completion-helpers.ts:690`).

Classification:

| Segment | Classification | Evidence |
| --- | --- | --- |
| Shared deposit/package revenue -> outbox | `EXISTS + WIRED` | `create-booking-helpers.ts:551-568` |
| Shared session completion -> outbox | `EXISTS + WIRED` | `session-completion-helpers.ts:619-648` |
| Outbox enqueue/idempotency boundary | `EXISTS + WIRED` | `accounting-outbox.ts:130-154` |

## Canonical Reference: Haircut F3 Bridge

Confirmed payment allocation calls `allocateConfirmedBookingPaymentToFinanceAr`, which constructs `SemanticReceivableChargeService` and calls `allocateConfirmedPaymentToReceivables` with `bookingId` match criteria (`src/services/finance-payment-allocation.ts:19-47`).

`recordRemainingPayment` calls the F3 allocation after persisted payment data is available; it reports `ALLOCATED`, `SKIPPED`, or `FAILED` and preserves transaction/cash movement/allocation evidence in the returned payload (`src/core/services/order/payment-actions.ts:98-180`, `src/core/services/order/payment-actions.ts:184-245`).

The accounting worker also has a service receivable bridge for `SESSION_DONE`, but it is guarded by `isHaircutTenant`; non-Haircut tenants return before F3 service receivable recognition (`src/app/api/cron/accounting-worker/route.ts:407-451`).

Classification:

| Segment | Classification | Evidence |
| --- | --- | --- |
| Confirmed payment -> F2/F3 allocation | `EXISTS + WIRED` for shared booking payments | `finance-payment-allocation.ts:19-47` |
| SESSION_DONE -> service receivable | `EXISTS + WIRED` for Haircut only | `accounting-worker/route.ts:415-451` |
| Beauty V2 reuse of Haircut bridge | `EXISTS + NOT_WIRED` candidate | Haircut-only guard at `accounting-worker/route.ts:415-416` |

## Finance OS Event API Check

`FinanceEventEnvelope` says it is for all Vertical OS including Beauty, and guarantees idempotency, tenant isolation, domain independence, and failure isolation (`src/platform/integration-hub/finance-event-contract.types.ts:15-23`).

The business context includes service/procurement contexts and comments that Beauty-specific context is future work (`src/platform/integration-hub/finance-event-contract.types.ts:80-105`).

The semantic resolver supports Hospital event types and has Beauty event mapping only as a commented future block (`src/platform/finance/resolvers/semantic-resolver.service.ts:38-122`). Unknown event types throw `SemanticResolutionError` (`src/platform/finance/resolvers/semantic-resolver.service.ts:131-139`).

Classification:

| Segment | Classification | Evidence |
| --- | --- | --- |
| Generic Vertical OS finance envelope | `EXISTS` | `finance-event-contract.types.ts:15-23` |
| Beauty event semantic mapping | `CONTRACT_GAP` if API path is chosen | commented mapping at `semantic-resolver.service.ts:109-114` |
| Beauty event API producer | `PROOF_GAP` | focused search found no Beauty producer of `FinanceEventEnvelope` |

## Beauty V2 Trace

Beauty H8 has session domain state: `PLANNED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED` (`src/platform/beauty/contracts/domain.ts:1-3`). `SessionRecord` carries tenant id, appointment id, service commitment id, status, actual start/end, performer, and outcome (`src/platform/beauty/contracts/domain.ts:72-81`).

`SessionTrackingService.complete` changes an in-progress Beauty session to `COMPLETED`, sets `actualEndAt` and outcome, validates invariants, then updates the session repository (`src/platform/beauty/application/services.ts:285-305`).

`SupabaseBeautySessionRepository` persists Beauty sessions to `beauty_sessions` and updates only appointment/service/status/actual performer/outcome fields (`src/platform/beauty/infrastructure/supabase-h8.repositories.ts:309-355`).

Focused search over `src/platform/beauty` and `src/modules/beauty-spa` found no references to:

```text
accounting_outbox
enqueueWithAutoClient
buildSessionDoneOutboxEvent
buildPackageSaleOutboxEvent
SemanticReceivableChargeService
allocateConfirmedBookingPaymentToFinanceAr
finance_ar_allocation
```

Classification:

| Segment | Classification | Evidence |
| --- | --- | --- |
| Beauty H8 session completion | `EXISTS` | `services.ts:299-305` |
| Beauty H8 session persistence | `EXISTS` | `supabase-h8.repositories.ts:334-355` |
| Beauty H8 completion -> accounting_outbox | `EXISTS + NOT_WIRED` candidate | focused search no matches |
| Beauty H8 completion -> F3 service receivable | `EXISTS + NOT_WIRED` candidate | focused search no matches |
| Beauty H8 payment -> F2/F3 allocation | `PROOF_GAP` | no Beauty payment producer traced in this audit |

## F5 / Control / Alert Trace

Accounting business health recognizes missing side effects such as confirmed package revenue missing accounting, completed session missing `SESSION_DONE`, and posting failures (`src/core/services/accounting/business-health.ts:364-405`).

The same health surface reads `accounting_outbox`, journal entries, journal lines, revenue, sessions, and related datasets (`src/core/services/accounting/business-health.ts:599-638`).

Repair metadata exists for missing `SESSION_DONE` and missing `PACKAGE_SALE` side effects, but requires confirmation (`src/core/services/accounting/business-health.ts:782-807`).

Accounting worker health computes severity as `critical`, `warning`, or `healthy`, and can publish alert notifications for worker health problems (`src/core/services/accounting/health.ts:555-569`, `src/core/services/accounting/health.ts:582-610`, `src/core/services/accounting/health.ts:630-682`).

Classification:

| Segment | Classification | Evidence |
| --- | --- | --- |
| Outbox/journal control surface | `EXISTS` | `business-health.ts:599-638` |
| Missing side-effect detection for shared flow | `EXISTS` | `business-health.ts:396-399` |
| Repair actions for shared flow | `EXISTS` | `business-health.ts:782-807` |
| Alert/severity framework | `EXISTS` | `health.ts:555-682` |
| Beauty H8 specific F5/control proof | `PROOF_GAP` | Beauty H8 `beauty_sessions` is not proven in the inspected control dataset |

## Gap Matrix

| Trace point | Status | Classification | Next proof needed |
| --- | --- | --- | --- |
| BabyCare/shared booking deposit -> `PACKAGE_SALE` | Proven statically | `EXISTS + WIRED` | Real DB proof only if reused for Beauty V2 test |
| BabyCare/shared session complete -> `SESSION_DONE` | Proven statically | `EXISTS + WIRED` | Real DB proof only if reused for Beauty V2 test |
| Accounting worker handles `PACKAGE_SALE` / `SESSION_DONE` | Proven statically | `EXISTS + WIRED` | Worker run/read-back |
| Haircut `SESSION_DONE` -> F3 service receivable | Proven statically for Haircut | `EXISTS + WIRED` | None for Haircut; not Beauty proof |
| Beauty H8 `COMPLETED` session -> outbox | Not found | `EXISTS + NOT_WIRED` candidate | Real DB or code trace proving no event row |
| Beauty H8 `COMPLETED` session -> F3 receivable | Not found | `EXISTS + NOT_WIRED` candidate | Real DB or code trace proving no invoice/receivable |
| Beauty V2 confirmed payment -> F2/F3 | Not traced | `PROOF_GAP` | Identify Beauty V2 payment path |
| Finance event API Beauty semantic | Commented future mapping | `CONTRACT_GAP` if chosen | Architecture decision whether to use API vs accounting outbox |
| F5/control for Beauty H8 facts | Not proven | `PROOF_GAP` | Control dataset must include or reconcile Beauty H8 facts |
| Alert/severity for Beauty H8 finance gap | Not proven | `PROOF_GAP` | Failure scenario and alert read-back |

## Recommended Next Step

Do not code yet. Run a Real DB trace in this worktree:

```text
Beauty H8 session start/complete
  -> query accounting_outbox by tenant/reference
  -> query journal_entries/journal_lines
  -> query finance receivable invoice/position/allocation tables
  -> query business/accounting health result
```

If the Real DB trace confirms that Beauty H8 completion creates no Finance event/outbox while the business requirement needs it, classify as `EXISTS + NOT_WIRED` and authorize the smallest Beauty consumer mapping to the existing Finance contract.

If the trace shows Beauty V2 uses the legacy shared `session_logs` path rather than H8 `beauty_sessions`, do not wire H8 blindly. First decide which session source is canonical for Beauty V2 Finance.

## Seal

This audit does not authorize runtime changes. It seals only:

```text
Finance exists.
Beauty V2 Finance usage is NOT_PROVEN.
No new Finance subsystem should be built.
Next work must prove or refute NOT_WIRED with Real DB evidence.
```
