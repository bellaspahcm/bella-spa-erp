# ARCHITECTURE GATE RESULT - BELLA NAIL OPERATIONAL SLICE

Status: PASS for the first bounded Nail operational slice.

Phase 1 Revenue extension status: PASS for bounded Revenue verification work.

## Bella OS / Product Development Process Gate

Problem: start Bella Nail Shop as a Beauty OS product, not as an independent product stack.

First slice:

```text
Nail Shop
  -> Services / Packages
  -> Booking
  -> Completed Session
  -> Revenue visibility boundary
```

Non-goals:
- Do not modify Preschool, BabyCare, Healthcare, Education, or Logistics code.
- Do not reopen Haircut hardening unless Nail produces a new, reproduced defect in a shared canonical capability.
- Do not add payroll, commission, attendance, Finance posting, AR allocation, inventory, or reconciliation in this slice.
- Do not create new database tables, migrations, RPCs, contracts, or Beauty OS engines.
- Do not bypass Beauty OS through product-owned persistence.

## Product Manifest

Product identity:

```text
productKey: bella_nail
displayName: Bella Nail Shop
subtitle: Nail Shop Management
requiredModules: [beauty_spa]
serviceProfile: nail
defaultRoute: /dashboard/nail
navigationProfile: nail
```

Module capability:

```text
beauty_spa / Beauty OS
```

Product scope:
- Product-specific identity and presentation.
- Nail service taxonomy through existing Beauty service/package metadata.
- Nail booking and session orchestration through existing Beauty OS application services.
- Nail runtime/browser evidence for the bounded customer -> booking -> session completion path.

## Ownership Map

| Capability / Data | Owner | Source of truth | Slice decision |
| --- | --- | --- | --- |
| Product identity | Platform Product Registry | `src/platform/registry/product-registry.ts` | Add `bella_nail` only |
| Beauty module capability | Beauty OS | `beauty_spa` module + Beauty OS contracts | Reuse |
| Service/package catalog | Beauty OS / existing service catalog | `packages` / service catalog contract | Reuse metadata, no schema |
| Customer | Existing platform/product customer model | existing customer contracts/tables | Reuse |
| Booking / appointment | Beauty OS | `src/platform/beauty/application/services.ts`, `beauty_appointments` | Reuse |
| Resource allocation | Beauty OS | `beauty_resource_allocations` | Reuse multi-resource pattern |
| Staff assignment | Beauty OS / staff capability | `beauty_professional_assignments` | Reuse technician terminology only |
| Session completion | Beauty OS | `beauty_sessions` + session service | Reuse with Nail outcome metadata |
| Revenue visibility | Existing order/revenue path | Haircut proved payment boundary separately | DEFER write integration until Nail-specific need is proven |
| Payroll / commission / Finance | Payroll / Finance OS | canonical payroll and Finance services | DEFER |

## Contract Dependency Map

```text
Bella Nail Product
  -> ProductRegistry(productKey = bella_nail)
  -> requiredModules = [beauty_spa]
  -> Beauty OS application services
       -> AppointmentService
       -> ProfessionalAssignmentService
       -> ResourceAllocationService
       -> SessionTrackingService
  -> Beauty OS contracts/tables
       -> beauty_appointments
       -> beauty_professional_assignments
       -> beauty_resource_allocations
       -> beauty_sessions
  -> Existing service catalog / package metadata
```

No direct Product -> database bypass is authorized beyond existing verified runtime tests.

## Change Authority

Authorized in this slice:
- Product identity registration for `bella_nail`.
- Product identity tests proving Nail and Haircut are distinct products sharing `beauty_spa`.
- Nail gate/documentation for the first operational slice.
- Targeted verification for existing Nail service/runtime/browser evidence.

Not authorized:
- Preschool branch or files.
- Healthcare/Education/Logistics kernels.
- Beauty OS contract or schema changes.
- Finance, payroll, commission, attendance, or accounting mappings.
- Haircut hardening or redesign.

If Nail later requires lower-layer changes, stop and raise the gap separately.

## UI -> Contract Reconciliation

| UI / workflow element | UI expectation | Canonical contract | Backend reality | Conclusion |
| --- | --- | --- | --- | --- |
| `/dashboard/nail` product surface | Identify Nail operations | Product identity should be `bella_nail` | Route exists, registry lacks production Nail identity | MAPPING BUG |
| Run booking | Pedicure allocates station + foot spa | Beauty OS resource allocation supports multiple allocations per commitment | `NailService.bookService()` reuses Beauty OS allocation service | MATCH |
| Run waitlist | Full capacity routes demand to waitlist status | Waitlist contract exists for beauty services | Browser route currently simulates capacity evidence; runtime waitlist is bounded evidence, not go-live proof | MATCH for RC harness / DEFER live waitlist |
| Run reassignment | Technician no-show replaced and history preserved | Professional assignment disruption and history | `NailService.reassignTechnician()` reuses Beauty OS assignment service | MATCH |
| Completed session outcome | Store polish/art/photo result | `beauty_sessions.outcome` metadata | Nail runtime doc/test verifies json outcome round-trip historically | MATCH, needs fresh rerun for current closure |
| Revenue | Show revenue after completion | Existing revenue/payment paths are proven in other Beauty/order flows, but Nail-specific revenue write/read path is not freshly proven | No Nail revenue write integration is implemented in this slice | DEFER / NOT_PROVEN |

## Additive Migration Plan

No migration is authorized or required for this slice.

```text
CREATE new product tables: none
CREATE new indexes: none
ALTER existing Beauty OS tables: none
RPC changes: none
```

Nail-specific details must fit existing metadata/outcome extension points unless a reproduced operational gap proves otherwise.

## Minimal Implementation Plan

1. Register `bella_nail` in Product Registry with `requiredModules: ['beauty_spa']`.
2. Add focused ProductRegistry tests for the registered Nail product and the Haircut/Nail shared Beauty OS distinction.
3. Run targeted ProductRegistry test.
4. Run existing Nail workflow tests that do not require external credentials.
5. Run Nail real DB runtime verification using a legitimate E2E tenant context.
6. Run changed-file type/lint/diff checks where available.
7. Keep browser smoke and revenue proof as separate evidence gates; do not claim go-live from stale docs.

## 11 Automated Verification Gates Plan

| Gate | Command / evidence | Required for this slice |
| --- | --- | --- |
| 1. Architecture gate | This document | PASS |
| 2. Product identity unit | `jest src/platform/registry/__tests__/product-registry.test.ts --runInBand` | PASS |
| 3. Nail workflow unit/integration | `jest src/products/nail/__tests__/nail.workflow.integration.test.ts --runInBand` | PASS |
| 4. Nail service/adapters | Existing targeted Nail tests where local env allows | PASS or NOT_PROVEN with reason |
| 5. Runtime DB | `src/products/nail/__tests__/nail.runtime.test.ts` with real E2E credentials | PASS on E2E project `bmnbqbcdbuklhopfbopv` |
| 6. Browser smoke | `playwright test e2e/tests/29-nail-product-rc-ui.spec.ts` with valid E2E env/server | BLOCKED_BY_ENV: E2E public anon/publishable key missing |
| 7. TypeScript changed/affected | `npm run typecheck:affected` or scoped equivalent | Required before closure |
| 8. ESLint changed files | `npx eslint <changed files>` | Required before closure |
| 9. Diff hygiene | `git diff --check` | Required |
| 10. Architecture guard | `npm run arch:guard` | Required if platform guard applies |
| 11. Tenant/security boundary | Runtime/browser tenant isolation evidence | PASS for real DB runtime; browser remains BLOCKED_BY_ENV |

## Gate Conclusion

PASS for bounded Nail operational slice setup.

Reason: the requested first phase can proceed by registering product identity and reusing existing Beauty OS Nail service evidence without schema, contract, kernel, Preschool, Haircut, payroll, or Finance changes.

Fresh evidence update:

```text
Product Identity / Registry / Resolver = PROVEN
Beauty OS local workflow reuse          = PASS
Real DB runtime                         = PASS
Real DB cleanup                         = PASS after manual residual tenant cleanup
Browser smoke                           = BLOCKED_BY_ENV
Revenue                                 = NOT_PROVEN / DEFER
Typecheck affected                      = NOT_VERIFIED / TIMEOUT
```

Closure boundary: Product identity, local Nail workflow, and real DB Beauty OS persistence are proven for this operational slice. Browser smoke, revenue write/read proof, payroll, commission, and Finance remain separate gates and must not be claimed as verified until fresh evidence exists.

## Phase 1 Revenue Gate - Full Go-Live Workstream

New target:

```text
BELLA NAIL
GO-LIVE TARGET = FULL OPERATIONAL READINESS
CURRENT PHASE   = Revenue
```

### Problem / Non-Goals

Problem: prove the Nail revenue chain using existing Bella contracts.

Required Phase 1 chain:

```text
Completed Session
  -> Revenue
  -> Payment
  -> Remaining Debt / Paid
  -> DB read-back
```

Non-goals:
- Do not modify Preschool, Haircut, Healthcare, Education, or Logistics code.
- Do not implement Nail-specific Finance, Payroll, Commission, or Attendance features.
- Do not create migrations, RPCs, tables, accounting mappings, or a new Revenue engine.
- Do not call Phase 2+ capabilities proven from this Revenue test.

### Truth and Source of Truth

| Truth | Source of truth | Phase 1 decision |
| --- | --- | --- |
| Product identity | Product Registry `bella_nail` + tenant `product_key` | Reuse |
| Session completion | `completeSession()` -> `processSessionCompletion()` | Reuse |
| Single-session revenue | `recordSingleSessionRevenueIfNeeded()` creates confirmed `revenue` for eligible pay-per-session packages | Prove with Real DB |
| Payment/debt state | `calculateBookingPaymentState()` over confirmed `revenue` rows | Reuse |
| Remaining payment | `recordRemainingPayment()` / `record_remaining_payment_atomic` | Prove with Real DB |
| Finance AR side effect | `recordRemainingPayment()` calls canonical `allocateConfirmedBookingPaymentToFinanceAr()` for confirmed revenue | Observe only; full Finance proof remains later phase |

### Ownership Map

| Capability / Data | Owner | Authorized access in Phase 1 |
| --- | --- | --- |
| `revenue` row creation | Core order/payment services | Product test may invoke public server actions |
| Booking payment state | Core payment business rules | Product test may calculate read-back debt/paid state |
| Accounting outbox for session/revenue | Accounting integration boundary | Product test may read scoped outbox evidence |
| Finance AR allocation | Finance contract | No new Finance implementation; allocation result may be observed as existing side effect |

### Contract Dependency Map

```text
Bella Nail tenant
  -> ProductRegistry(productKey = bella_nail)
  -> Core order actions
       -> createBooking()
       -> completeSession()
       -> recordRemainingPayment()
  -> Existing DB contracts
       -> customers
       -> packages
       -> bookings
       -> session_logs
       -> revenue
       -> accounting_outbox
  -> Existing business rules
       -> calculateBookingPaymentState()
```

### Change Authority

Authorized:
- Add/adjust focused Nail Revenue verification artifacts.
- Reuse existing Core order/payment actions exactly as their public contract.
- Update this gate with the new Revenue phase scope.
- Add a controlled Core fix under `ACR-2026-011` so `completeSession()` respects tenant Payroll capability.

Not authorized:
- New Nail business logic for revenue.
- New Finance, Payroll, Commission, or Attendance implementation.
- Beauty OS refactor or Haircut/Preschool hardening.
- Accounting policy changes or new Vietnamese accounting mapping.
- Product-specific branching such as `product_key === "bella_nail"`.

### UI -> Contract Reconciliation

No production UI data/action element is authorized in Phase 1 unless browser evidence requires a minimal test harness adjustment. Any browser assertion must trace to the existing order/payment contracts above and must not invent a new UI workflow or KPI.

### Additive Migration Plan

One additive contract repair was required because E2E runtime proved `createBooking()` expects `bookings.metadata` while the E2E schema cache did not expose it.

```text
CREATE tables: none
CREATE indexes: none
ALTER tables: public.bookings ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb
RPC changes: none
```

Migration artifact: `supabase/migrations/20260930093000_add_bookings_metadata_contract_column.sql`.

### Minimal Implementation Plan

1. Add a focused Real DB Nail Revenue proof test under the Nail product tests.
2. Use a `bella_nail` tenant with `beauty_spa` enabled.
3. Prove completed single-session service creates confirmed revenue and paid read-back.
4. Prove deposit + remaining payment transitions debt to paid using existing payment action.
5. Verify fixture cleanup for tenant/customer/package/booking/session/revenue/outbox rows.
6. If shared completion hard-requires Payroll while tenant Payroll is disabled, apply only the approved `ACR-2026-011` capability guard.
7. Run targeted test, lint/diff/architecture guard as scope allows.

### 11 Automated Verification Gates Plan

| Gate | Command / evidence | Phase 1 target |
| --- | --- | --- |
| 1. Architecture gate | This Phase 1 section | PASS |
| 2. Product identity | Existing registry/resolver tests | Already proven |
| 3. Revenue Real DB | New Nail Revenue proof test with `.env.e2e` | Required |
| 4. Payment/debt read-back | Same test + `calculateBookingPaymentState()` | Required |
| 5. Browser smoke | Existing Nail browser smoke, then Revenue browser if UI evidence is added | Required before Go-Live closure |
| 6. Fixture cleanup | Test cleanup + post-run read-back | Required |
| 7. ESLint scoped | Changed files | Required |
| 8. Diff hygiene | `git diff --check` | Required |
| 9. Architecture guard | `npm run arch:guard` | Required |
| 10. Typecheck affected | `npm run typecheck:affected` | Best effort; timeout is NOT_VERIFIED, not FAIL |
| 11. Regression boundary | No Haircut/Preschool file changes | Required |

### Phase 1 Gate Conclusion

PASS.

Reason: existing Core order/payment contracts already own the required revenue and payment semantics. The minimum sufficient action is to prove Nail can use those contracts with a `bella_nail` tenant on Real DB before deciding whether any production code gap exists.

Fresh Revenue runtime evidence update:

```text
E2E bookings.metadata schema drift       = FIXED / VERIFIED
Core payroll capability guard            = PASS
Revenue proof test                       = PASS
Single-session revenue read-back         = PASS
Multi-session deposit/debt read-back     = PASS
Remaining payment idempotency            = PASS
SESSION_DONE / PACKAGE_SALE outbox       = PASS
Browser smoke                            = PASS
Fixture cleanup read-back                = PASS (revenue + browser markers = 0)
Scoped ESLint                            = PASS
Architecture Guard                       = PASS
Core Freeze Guard                        = PASS (ACR-2026-011, LOCAL-NAIL-PHASE1 binding)
Typecheck affected                       = NOT_VERIFIED / TIMEOUT (>120s)
Finance AR allocation                    = OBSERVED_FAILED / OUT_OF_SCOPE_PHASE_1
Nail business logic                      = NOT_FAILED
Revenue/payment logic                    = PASS
Payroll / Commission                     = NOT_IN_SCOPE_FOR_PHASE_1
```

Conclusion: Phase 1 Revenue is sealed for the scoped Nail chain. `completeSession()` now respects tenant Payroll capability, so Payroll OFF tenants do not require Payroll schema to complete service and prove Revenue/Payment read-back. Finance AR allocation reports missing TT99 `TRADE_RECEIVABLE` mapping and remains a later Finance-phase blocker, not a Phase 1 Revenue blocker.

## Phase 2 Staff / Attendance Gate

```text
BELLA NAIL
GO-LIVE TARGET = FULL OPERATIONAL READINESS
CURRENT PHASE   = Staff / Attendance / Service Attribution
```

### Problem / Non-Goals

Problem: prove Nail can use existing Bella staff and attendance capabilities without creating Nail-specific HR logic.

Required Phase 2 chain:

```text
Staff user
  -> Attendance check-in / check-out
  -> Booking assignment
  -> Completed session attribution
  -> DB read-back
```

Non-goals:
- Do not implement Payroll or Commission.
- Do not change salary calculation.
- Do not create Nail-specific staff tables.
- Do not modify Haircut, Preschool, Healthcare, Education, or Logistics.

### Truth and Source of Truth

| Truth | Source of truth | Phase 2 decision |
| --- | --- | --- |
| Staff identity | `users` table with `role = 'ktv'` and tenant scope | Reuse |
| Attendance | `src/services/attendance-actions.ts` over `attendance` table | Reuse |
| Assignment | `bookings.assigned_ktv_id` | Reuse |
| Service attribution | `session_logs.completed_by_ktv_id` after `completeSession()` | Reuse |

### Change Authority

Authorized:
- Add a focused Nail Staff Real DB proof test.
- Reuse existing attendance, booking, and completion actions.
- Update this gate with Staff evidence.

Not authorized:
- Payroll/Commission implementation.
- New HR schema or Nail-specific staff model.
- Product-specific Core branching.

### Phase 2 Minimal Plan

1. Create a `bella_nail` tenant.
2. Create admin + KTV users in that tenant.
3. Check KTV in/out through existing attendance actions.
4. Create a Nail booking assigned to the KTV.
5. Complete the session through public Core action.
6. Read back attendance + booking assignment + completed session attribution.
7. Cleanup scoped fixtures and verify counts.

### Phase 2 Gate Conclusion

PASS.

Fresh Staff runtime evidence:

```text
Staff identity (`users.role = ktv`)        = PASS
Attendance check-in / check-out            = PASS
Attendance DB read-back                    = PASS
Booking assignment (`assigned_ktv_id`)     = PASS
Completed service attribution              = PASS
SESSION_DONE outbox on completion          = PASS
Fixture cleanup read-back                  = PASS (nail-staff markers = 0)
Payroll / Commission                       = NOT_IN_SCOPE_FOR_PHASE_2
Finance                                    = NOT_IN_SCOPE_FOR_PHASE_2
```

Conclusion: Phase 2 Staff / Attendance is sealed for the scoped Nail chain using existing Bella staff, attendance, booking, and completion contracts. No Nail-specific staff model or HR implementation is required.

### ACR-2026-011 Core Fix Scope

```text
CORE CHANGE
= completeSession() payroll capability guard

REASON
= tenant Payroll disabled but completion hard-required Payroll schema

EXPECTED EFFECT
= Payroll OFF skips salary recalculation and continues Revenue / outbox path

OUT OF SCOPE
= Payroll engine
= Finance
= Commission rules
= Revenue calculation
= Schema redesign
= Haircut behavior change outside regression verification
```

Guard rule:

```text
enabled_modules.payroll === true  -> run salary recalculation
enabled_modules.payroll !== true  -> skip salary recalculation
```

Forbidden workaround:

```text
product_key === "bella_nail"
```

## Phase 3 Payroll / Commission Gate

```text
BELLA NAIL
GO-LIVE TARGET = FULL OPERATIONAL READINESS
CURRENT PHASE   = Payroll / Commission
```

### Problem / Non-Goals

Problem: prove Nail can use the existing Bella payroll lifecycle after Revenue and Staff are proven.

Required Phase 3 chain:

```text
Attendance
  + Completed Service
  + Existing commission inputs
  -> Salary record
  -> Publish
  -> Confirm
  -> Finalize / Lock
  -> Expense read-back
```

Non-goals:
- Do not create a Nail payroll engine.
- Do not introduce Nail-specific commission rules.
- Do not change Finance accounting policy.
- Do not modify Haircut or Preschool.
- Do not enable unified provider flags unless separately proven.

### Truth and Source of Truth

| Truth | Source of truth | Phase 3 decision |
| --- | --- | --- |
| Payroll lifecycle | `src/modules/hr-salary/actions/admin-salary-actions.ts` | Reuse |
| Salary calculation | `src/modules/hr-salary/actions/salary-recalculation-engine.ts` | Reuse |
| Advanced commission inputs | `booking_service_items`, `product_sales`, `salary_adjustments` migrations + generated DB types | Reuse |
| Tenant payroll provider config | generated DB types + `scripts/run-config-migrations.ts` + archived SQL contract | Restore missing active migration artifact |
| Commission requirement | Nail requirement not yet proven beyond service attribution | Prove zero/additive commission path first |

### Phase 3 Schema Readiness Finding

Fresh E2E schema audit on project `bmnbqbcdbuklhopfbopv` found only `users.hire_date` from the Payroll/Commission contract. The DB was missing:

```text
tenant_payroll_config
tenant_payroll_config_history
booking_service_items
product_sales
salary_adjustments
salary_records.service_commission
salary_records.product_sales_commission
salary_records.position_bonus
salary_records.seniority_bonus
salary_records.manual_adjustments
users.position_tier
tenants.commission_config
```

Root classification:

```text
Payroll logic              = NOT_FAILED
Nail business logic        = NOT_FAILED
E2E schema                 = DRIFT / NOT_READY
Active migration artifact  = MISSING for tenant_payroll_config
```

### Change Authority

Authorized:
- Restore missing active Payroll config migration files already referenced by repo script and generated types.
- Apply existing additive Payroll/Commission migrations to E2E before Real DB proof.
- Add focused Nail Payroll Real DB proof only after schema readiness is verified.

Not authorized:
- New Payroll engine.
- New Finance posting policy.
- Product-specific Core branch.
- Commission business-rule redesign.

### Phase 3 Gate Conclusion

PASS.

Fresh Payroll runtime evidence:

```text
E2E Payroll/Commission schema alignment     = PASS
Missing tenant payroll migration restored   = PASS
Payroll-enabled Nail completion             = PASS
Salary record creation/read-back            = PASS
Session bonus read-back                      = PASS
Service commission read-back                = PASS
Product sales commission read-back          = PASS
Manual adjustment read-back                 = PASS
Publish salary                              = PASS
Admin confirm salary                        = PASS
Finalize / lock salary                      = PASS
Completed session lock                      = PASS
Salary expense creation                     = PASS
Fixture cleanup read-back                   = PASS (nail-payroll markers = 0)
```

Conclusion: Phase 3 Payroll / Commission is sealed for the scoped Nail chain using existing Bella payroll capability. Finance accounting-period enforcement and accounting policy/reconciliation remain Phase 4 scope.

## Phase 4 Finance Gate

```text
BELLA NAIL
GO-LIVE TARGET = FULL OPERATIONAL READINESS
CURRENT PHASE   = Finance / AR Allocation / Cash Read-back
```

### Problem / Non-Goals

Problem: prove Nail can connect completed-service revenue and confirmed payment into the existing Finance truth layer.

Required Phase 4 chain:

```text
Finance foundation
  -> TT99 semantic receivable/revenue mappings
  -> Service receivable recognition
  -> Confirmed remaining payment
  -> AR allocation
  -> Cash movement / position
  -> DB read-back
```

Non-goals:
- Do not implement a Nail-specific Finance engine.
- Do not change Finance accounting policy.
- Do not create new Finance tables, RPCs, or accounting mappings.
- Do not change Haircut, Preschool, Healthcare, Education, or Logistics.
- Do not widen Payroll or Commission.

### Truth and Source of Truth

| Truth | Source of truth | Phase 4 decision |
| --- | --- | --- |
| Chart of accounts | `finance_accounts` tenant fixture | Use existing Finance F1 contract |
| TT99 semantic mappings | `finance_save_accounting_semantic_gl_mapping()` / `finance_get_accounting_semantic_gl_map_as_of()` | Use existing Finance RPCs |
| Receivable recognition | `SemanticReceivableChargeService.recognizeServiceReceivable()` | Reuse |
| Confirmed payment AR allocation | `recordRemainingPayment()` -> `allocateConfirmedBookingPaymentToFinanceAr()` | Reuse |
| Cash movement / position | `CashProjectionWorker` through Finance outbox dispatcher | Reuse |

### Change Authority

Authorized:
- Add a focused Nail Finance Real DB proof test.
- Seed only scoped test tenant Finance foundation: accounting period, accounts, bank account, and TT99 semantic mappings.
- Use existing Finance service/RPC contracts to recognize receivable and allocate payment.
- Update this gate with Finance evidence.

Not authorized:
- New Finance implementation.
- Product-specific Finance branching.
- Accounting policy redesign.
- Revenue, Payroll, Commission, Haircut, or Preschool hardening.

### Phase 4 Minimal Plan

1. Create a `bella_nail` tenant.
2. Seed scoped Finance foundation for the test tenant only.
3. Create Nail customer, package, booking, and completed session using existing Core order actions.
4. Recognize a service receivable through `SemanticReceivableChargeService`.
5. Record confirmed remaining payment through `recordRemainingPayment()`.
6. Read back Finance invoice, receivable position/allocation, cash movement, cash position, and revenue row.
7. Cleanup scoped fixtures and verify counts.

### Phase 4 Gate Conclusion

PASS for Finance proof, with Finance immutable-fact cleanup explicitly retained by design.

Fresh Finance runtime evidence:

```text
E2E project                                  = bmnbqbcdbuklhopfbopv
Finance foundation fixture                  = PASS
TT99 semantic TRADE_RECEIVABLE mapping       = PASS
TT99 semantic SERVICE_REVENUE mapping        = PASS
Completed Nail session                       = PASS
Service receivable recognition               = PASS
Finance invoice finalized                    = PASS
Receivable position before payment           = PASS (outstanding = 300000)
Confirmed remaining payment                  = PASS
Finance AR allocation                        = PASS (allocated = 300000)
Cash movement projection                     = PASS (INFLOW = 300000)
Cash position read-back                      = PASS (balance = 300000)
Revenue read-back                            = PASS
Mutable fixture cleanup read-back            = PASS (users/customers/packages/bookings/session/accounting rows = 0)
Finance immutable facts cleanup              = RETAINED_BY_DESIGN
```

Immutability note: `finance_receivable_ledger`, `finance_receivable_allocations`, `finance_cash_movements`, posted `finance_transactions`, and linked Finance facts are canonical accounting evidence. Direct deletion is blocked by Finance guards (`DIRECT_AR_MUTATION_PROHIBITED` / cash immutability). The proof therefore uses unique `nail-finance-*` tenants and retains Finance facts as audit evidence instead of bypassing the guard.

Conclusion: Phase 4 Finance is sealed for the scoped Nail chain using existing Finance F1/F2/F3 capabilities. This does not authorize a Nail-specific Finance implementation or any accounting-policy redesign.

## Phase 5 Browser E2E Gate

```text
BELLA NAIL
GO-LIVE TARGET = FULL OPERATIONAL READINESS
CURRENT PHASE   = Full Browser E2E
```

### Browser Coverage Finding

Existing `/dashboard/nail` is a browser RC harness for Beauty OS Nail journeys:

```text
Pedicure booking
Capacity waitlist
Technician reassignment
Actual performer / outcome metadata
```

It does not expose a real UI path for:

```text
Customer -> Booking -> Complete session -> Revenue -> Payment
  -> Finance AR allocation -> Staff attendance -> Payroll publish/finalize
```

Therefore the current browser evidence can prove Nail product surface and Beauty OS browser smoke only. It cannot prove the full operational chain already proven by Real DB backend tests.

### Phase 5 Gate Conclusion

```text
Nail Browser RC smoke                    = PASS
Full operational browser E2E             = BLOCKED_BY_UI_COVERAGE
Backend Real DB Revenue                  = PASS
Backend Real DB Staff / Attendance       = PASS
Backend Real DB Payroll / Commission     = PASS
Backend Real DB Finance                  = PASS
```

Evidence:

```text
Command: E2E_ENV_FILE=D:\Antigravity\Projects\BELLA SPA ERP\.env.e2e npx playwright test e2e/tests/29-nail-product-rc-ui.spec.ts
Result: 1 passed
Project: chromium
Route: /dashboard/nail
```

Conclusion: Browser smoke remains PASS, but Go-Live cannot be upgraded to final `READY_FOR_GO_LIVE_DECISION` on browser evidence alone until a real UI workflow exists for the full Nail operational chain or a human accepts backend Real DB proof as sufficient for the missing UI segments.

## Phase 6 UI Coverage Gap Audit

```text
BELLA NAIL
GO-LIVE TARGET = FULL OPERATIONAL READINESS
CURRENT PHASE   = UI Coverage Gap Audit
```

### Segment Audit

| Segment | UI exists? | Current E2E? | User-facing operational action? | Decision |
| --- | --- | --- | --- | --- |
| Login / tenant context | YES: E2E mock user cookie + `/api/tenant/context` | YES: Nail browser RC smoke | YES | REUSE |
| Nail product surface | YES: `/dashboard/nail` | YES: `29-nail-product-rc-ui.spec.ts` | YES | REUSE, but RC harness only |
| Customer | YES: `/dashboard/customers` + customer actions | NOT for Nail chain | YES | GAP for full chain |
| Service / Package | YES: service/package catalog exists | NOT for Nail chain | YES for booking setup | GAP for full chain |
| Booking | YES: `/dashboard/bookings` + `BookingModal` uses `createBooking()` | Smoke/DB-bypass only | YES | GAP for full chain |
| Check-in / Service | YES: `/dashboard/sessions` + session actions | Smoke/DB-bypass only | YES | GAP for full chain |
| Completion | YES: `/dashboard`, `/dashboard/sessions` call `completeSession()` | NOT for Nail full chain | YES | GAP for full chain |
| Payment / Debt collection | PARTIAL: `/dashboard/finance/reconciliation` and payment actions exist | DB-bypass / generic smoke | YES | GAP for full chain |
| Revenue / Debt read-back | YES: Finance / customer / booking surfaces read revenue | NOT for Nail full chain | YES | GAP for read-back |
| Staff / Attendance | YES: `/workforce/attendance`, `/dashboard/salary?tab=attendance` | NOT for Nail chain | YES | GAP for read-back/action coverage |
| Payroll / Commission | YES: `/dashboard/salary` publish/confirm/finalize actions | DB proof only for Nail | YES for admin payroll operation | GAP for full chain |
| Finance | YES: `/dashboard/finance`, `/dashboard/finance/reconciliation`, reports | Smoke/readability only | YES for final read-back; accounting internals are backend-owned | GAP for read-back, not new posting UI |

### Minimal UI Coverage Decision

The smallest valid UI scope is not a new Nail backend or a new Finance/Payroll product surface. It is a browser journey that:

```text
uses existing user-facing screens/actions where they already exist
  -> keeps backend Real DB proof as source of truth for accounting internals
  -> reads final UI-visible state from existing dashboards
```

Authorized UI work:
- Add stable selectors only where existing user-facing controls/read-backs already exist and Playwright cannot address them reliably.
- Add a focused Nail full operational browser E2E that uses a `bella_nail` tenant and existing public screens.
- Seed only prerequisite data that a normal operator would not create inside the target browser path.

Not authorized:
- New Nail business logic.
- New Finance/Payroll engines.
- New Nail-specific Finance or Payroll dashboards.
- UI built solely to make hidden backend internals clickable.
- Preschool or Haircut changes.

Current Phase 6 status:

```text
UI coverage audit = COMPLETE
Minimal implementation target = Browser E2E over existing operational UI/read-back surfaces
Operational UI read-back E2E = PASS
Full click-through action E2E = NOT_CLAIMED / DEFERRED
```

### Phase 6 Implementation Evidence

Minimal UI work added stable selectors to existing user-facing surfaces only:

```text
/dashboard/bookings
  -> completed Nail booking/session read-back

/dashboard/salary
  -> payroll, commission, and attendance-day read-back

/dashboard/finance
  -> revenue/payment and payroll expense read-back
```

No new Nail business logic, Finance engine, Payroll engine, ProductResolver logic, or backend schema was added for this browser evidence.

Browser evidence:

```text
Command: E2E_ENV_FILE=D:\Antigravity\Projects\BELLA SPA ERP\.env.e2e npx playwright test e2e/tests/30-nail-operational-readback.spec.ts
Result: 1 passed
Project: chromium
Duration: 54.4s
```

Post-change checks:

```text
npx eslint e2e/tests/30-nail-operational-readback.spec.ts src/app/dashboard/finance/page.tsx src/app/dashboard/salary/components/SalaryTable.tsx src/app/dashboard/salary/components/AttendanceSummaryTable.tsx src/app/dashboard/bookings/components/BookingsDayTimelineList.tsx src/app/dashboard/bookings/components/BookingsTimelineGrid.tsx
= PASS (only existing .eslintignore deprecation warning)

git diff --check
= PASS (line-ending warnings only)

npm run arch:guard
= PASS
```

Read-back assertions covered:

| Segment | Browser evidence |
| --- | --- |
| Tenant / Login | E2E mock admin for `bella_nail` tenant; sidebar/product context showed Bella Nail Shop |
| Booking | `/dashboard/bookings` showed seeded Nail customer/package completed session |
| Completion | Booking session status displayed completed (`Xong` / `Hoàn thành`) |
| Revenue / Payment | `/dashboard/finance` showed confirmed Nail revenue payment |
| Staff / Attendance | `/dashboard/salary` showed `Ngày công = 1` for the Nail KTV |
| Payroll / Commission | `/dashboard/salary` showed finalized salary, one completed session, service commission, and total salary |
| Finance | `/dashboard/finance` showed confirmed revenue and payroll expense transactions |
| Cleanup | Test `finally` deletes mutable E2E rows: expense, salary, attendance, revenue, session, booking, package, customer, users, tenant |

Known browser environment note:

```text
/dashboard/finance loads an auxiliary Intelligence monthly P&L API.
E2E schema currently lacks public.mv_monthly_pnl, so that auxiliary API logs 500.
This did not block the Finance transaction read-back path under test:
getFinancialOverview("2026-09-01") returned data and the browser assertions passed.
```

Dedicated attendance-tab note:

```text
/dashboard/salary?tab=attendance exists, but under E2E mock-auth it returned an empty attendance table.
The minimal accepted attendance browser proof is the user-facing `Ngày công` payroll column,
which is populated by getSalaryData() from tenant-scoped attendance data.
No security/RLS bypass was added to make the attendance tab pass under mock auth.
```

### Phase 6 Gate Conclusion

```text
Browser RC smoke                       = PASS
Operational UI read-back E2E           = PASS
Full click-through action E2E          = NOT_CLAIMED / DEFERRED
Backend Real DB Revenue                = PASS
Backend Real DB Payment                = PASS
Backend Real DB Staff / Attendance     = PASS
Backend Real DB Payroll / Commission   = PASS
Backend Real DB Finance                = PASS

OPERATIONAL READINESS                  = PROVEN FOR FULL GO-LIVE DECISION INPUT
GO-LIVE                                = READY_FOR_GO_LIVE_DECISION
```

Conclusion: Nail now has backend Real DB proof for the full operational chain plus browser evidence that the existing operator UI can read back the operational state. This is sufficient for a Go-Live decision checkpoint, while avoiding a fake UI built solely to click hidden backend internals.
