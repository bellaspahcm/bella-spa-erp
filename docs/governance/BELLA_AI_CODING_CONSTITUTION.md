# BELLA ENGINEERING RULES - OS & PRODUCT DEVELOPMENT v2

> Follow Bella Engineering Execution Contract: Evidence -> Ownership -> Canonical Contract -> Minimal Implementation -> Targeted Verification -> Fresh Verification. Never invent a contract, cross an ownership boundary, weaken a test, or hide a failure merely to make TypeScript or CI green.

This is the authoritative engineering constitution for Bella OS and Product development. It applies to AI-assisted and human implementation work across Platform, OS, Product, Integration, Shared UI, CI, tests, and technical-debt cleanup.

This document is not a list of optional preferences. It is the default execution contract. If a local vertical constitution, freeze policy, ADR, or human architect decision is stricter, the stricter rule wins.

## Core Incident Lesson

Most recent Bella failures were not caused by lack of code. They were caused by code written before proving ownership, contract, runtime semantics, execution environment, or closure evidence.

The permanent response is:

```text
LỖI
 ↓
Có phải PR gây ra?
 ↓
Owner là ai?
 ↓
Canonical contract là gì?
 ↓
Layer này có quyền dùng contract đó?
 ↓
Semantics có thực sự tương đương?
 ↓
Minimal fix là gì?
 ↓
Verify
 ↓
STOP
```

## 1. Ownership Before Code

Before creating or modifying a capability, identify the owner:

```text
Platform?
OS?
Product?
Integration?
Shared UI?
```

If ownership is unclear, do not code yet.

Correct data in the wrong layer is still wrong implementation. For example, a Product layer direct query to an internal OS table can be architecturally invalid even when the table contains the right data.

## 2. Reuse Before Create

The mandatory order is:

```text
REUSE
 ↓
EXTEND
 ↓
LOCAL IMPLEMENTATION
 ↓
ABSTRACT
```

Do not create a Factory, Manager, Provider, Registry, Adapter, Generic Engine, or framework because it may be useful later. Add abstraction only after repeated evidence proves it removes real complexity inside the correct ownership boundary.

## 3. Canonical Contract Before Consumer

Before a consumer uses any field, type, API, or behavior, verify:

```text
Consumer expectation
        ↓
Generated type
        ↓
Schema / Migration
        ↓
Producer
        ↓
Domain semantics
```

Do not infer the canonical contract from stale consumer code. If a consumer expects `customer.referred_by` but the canonical contract is `customer.referrer_id`, fix the stale consumer. Do not add a fake field to make the compiler green.

## 4. Never Invent Schema, Field, RPC, API, or Type

If code references a table, field, RPC, API, or type that canonical evidence does not prove, defer it.

Examples:

```text
auto_sales
auto_quotations
some_missing_rpc()
ContractDefinition
```

A TypeScript error may be architecture debt or schema debt, not type debt. Do not repair it by inventing contracts.

## 5. Preserve Boundary Semantics

The standard flow is:

```text
Database
   ↓
Repository / Mapper
   ↓
Domain
   ↓
Service
   ↓
API / DTO
   ↓
UI
```

Each layer has its own contract. Do not assume that because the database is `snake_case`, the Domain must also be `snake_case`. Mapper changes must preserve runtime semantics, not merely reduce diagnostics.

## 6. Foreign Key Is Relationship, Not Business Meaning

A foreign key identifies a relationship. It does not automatically carry the business meaning of the referenced entity.

Example:

```text
current_stage_id
      │ FK
      ▼
auto_journey_stages.id
      ↓
code = "delivered"
```

When business logic needs a referenced entity's attribute, resolve the relation and use the canonical business field. Do not infer business state directly from the FK.

## 7. Read Contract Is Not Write Contract

Proof that a read path maps correctly does not prove write-path equivalence.

Example:

```text
quantity_on_hand -> stock_level
item_code        -> sku
```

This read evidence does not prove the semantics of:

```text
reserve()
release()
deduct()
quantity_reserved
inventory_transactions
```

Write paths must be proven separately, especially for Inventory, Finance, Booking, Reservation, Payment, Capacity, and Workflow transitions.

## 8. Product Identity Owns Presentation

Modules define what the system can do. Products define what users see.

New products must declare:

```text
productKey
navigationProfile
serviceProfile
themePreset
requiredModules
```

Do not use `moduleKey` as Product Identity. Do not let one Product inherit another Product's presentation by fallback. Unknown Product means neutral, not another Product.

## 9. Shared UI Uses Semantic Tokens

Theme resolution order is:

```text
Explicit Tenant Theme
        ↓
Product Default Theme
        ↓
Platform Neutral Default
```

Shared UI must not hardcode a Product-specific color or style as a universal default.

## 10. Nullability Is Business Information

Before changing or masking nullability, determine:

```text
NULL means what?
undefined means what?
No record means what?
Is fallback behavior valid for the business?
```

Do not fix TypeScript with `value!`, `value as string`, or `value ?? ''` unless the semantics are proven.

## 11. Cast Is Not a Contract Fix

Do not hide mismatch with:

```ts
as any
as unknown as X
@ts-ignore
@ts-expect-error
```

The correct flow is:

```text
Type error
   ↓
Read producer
   ↓
Read canonical contract
   ↓
Determine mismatch
   ↓
Map / Narrow / Fix stale consumer
```

For literal unions, use the canonical allowlist or type guard when needed.

## 12. Generated Types Are Evidence, Not a Repair Surface

Generated database types are used to verify:

```text
table
field
nullable
enum
relation
RPC
```

Do not hand-edit generated types to satisfy a consumer. If generated types and migrations disagree, investigate the source of truth.

## 13. Architecture Ownership Beats Diagnostic Count

Correct architecture is more important than a lower TypeScript diagnostic count.

Do not violate Core Freeze, OS boundary, Product Constitution, Platform ownership, or frozen integration contracts to reduce diagnostics.

## 14. Data Correctness Does Not Override Ownership

Before a query, answer both:

```text
1. Is this canonical data?
2. Does this layer have the right to access it?
```

Only `YES + YES` permits implementation.

## 15. Tests Must Follow Production Contract

When production code is corrected to the canonical contract, fixtures and mocks must follow that contract.

Do not revert production to an obsolete contract merely because old tests fail.

## 16. Test Doubles Must Model the Boundary They Replace

Database mocks that cover multiple tables must be table-aware. Do not let `.from('anything')` return the same fixture for every table.

The standard is minimum faithful mock, not a full fake database.

## 17. Integration Tests Must Declare Execution Requirements

If a test needs real Supabase, PostgreSQL, migrations, network, or credentials, its execution contract must declare that requirement.

Do not run an integration test in a non-DB Jest job and then treat `mock.supabase.co` or `ENOTFOUND` as a product failure. Reuse canonical credential-gating patterns when they exist.

## 18. Never Weaken Tests to Make CI Green

Do not:

```text
delete assertions
skip because the test is failing
increase global timeout
mock away behavior being tested
exclude the test from selector
catch or swallow errors
```

Skip or gate only when the execution environment is proven not to satisfy the test contract, and the test still runs in the correct environment.

## 19. Attribute Failures Before Fixing

A red CI result is not automatically a PR regression. Classify first:

```text
PR_REGRESSION
PRE_EXISTING
ENVIRONMENT
FIXTURE_STATE
CONTRACT_DRIFT
SCHEMA_DRIFT
BASELINE_DRIFT
CASCADE
```

Each class has a different fix path.

## 20. Compare With Main Before Blaming the PR

When a CI failure is unclear, compare PR behavior with `origin/main` under the same selector, environment, command, and fixture.

If main also fails, do not call the failure a PR regression.

## 21. Fix Root Failure, Not Cascade Failure

Do not investigate aggregate failures as independent root causes.

Examples:

```text
Affected Tests failed
       ↓
All Required Gates failed
```

Fix the root failure. The cascade should clear after the root clears.

## 22. Cancel Expensive CI After Proven Blocking Failure

If a blocking failure is already proven while expensive jobs continue, it can be appropriate to cancel heavy jobs such as full typecheck, baseline comparison, or heavy integration runs.

This is an operational optimization only. It must never be used to hide unverified gates before merge.

## 23. Zero New Technical Debt From Day One

New OS/Product work must start with:

```text
TypeScript diagnostics = 0
ESLint errors          = 0
Architecture violation = 0
```

Do not create a temporary baseline to handle later. Historical debt in existing Bella areas is being cleaned up; new work must not create the next generation of historical debt.

## 24. BAD_NEW Is Immediate Authority During Cleanup

During historical cleanup:

```text
BAD_NEW > 0 -> FAIL
BAD_NEW = 0 -> checkpoint may be valid
```

Raw diagnostic count is useful only when no new bad diagnostics are introduced. The final target remains absolute diagnostics = 0.

## 25. Fresh Full Verification Is Final Authority

Targeted checks save time, but important closure requires fresh evidence:

```text
targeted test
      ↓
targeted lint
      ↓
diff-check
      ↓
full typecheck
      ↓
relevant architecture/test gates
```

Do not use stale cache or old artifacts as closure evidence.

## 26. Easy + Proven + Local First

During cleanup, fix only when the issue is:

```text
EASY
+
PROVEN
+
LOCAL
```

Defer when a diagnostic pulls into recursive types, `TS2589`, query-builder redesign, schema invention, RPC creation, generic/conditional type design, unclear business semantics, or architecture ownership decisions.

## 27. One Root Cause, One Minimal Fix, Verify, Stop

Do not opportunistically:

```text
refactor a file
rename code
clean imports across a domain
redesign an interface
add abstraction
fix unrelated warnings
```

A cluster is closed when the cluster's root cause is resolved. The entire file does not need to be zero if residual diagnostics belong to other root causes.

## 28. Deferred Is a Valid Engineering Decision

`DEFER` means there is not enough evidence to safely fix the issue in the current scope.

Examples:

```text
ContractDefinition -> Platform architecture decision
quantity_reserved  -> Inventory behavior decision
journey.status     -> lifecycle semantics unclear
TS2589             -> query/type-system complexity
```

Deferred debt belongs in an appropriate workstream, not forced through TypeScript cleanup.

## 29. Multi-Tenant Isolation Is a Hard Invariant

Every OS/Product must define:

```text
tenant_id
authorization
RLS
service-role path
cross-tenant prevention
```

No feature is done if tenant isolation is unresolved.

## 30. Security Is Part of the Contract

Every input boundary must consider:

```text
validation
authentication
authorization
tenant scope
PII
injection
audit
```

Security is not a final hardening phase; it is part of the implementation contract.

## 31. UI Is Not the Domain Engine

UI should collect input, present state, and invoke use cases.

UI must not own business invariants, financial calculations, inventory transitions, workflow state machines, or authorization decisions. Those belong to the correct domain/service layer.

## 32. Evidence Before Closure

Do not report:

```text
DONE
VERIFIED
CLOSED
READY
```

merely because code was written.

Closure requires appropriate evidence:

```text
contract verified
targeted tests PASS
TypeScript PASS
lint PASS
architecture PASS
security/tenant verification when relevant
regression check PASS
```

If evidence is missing, report the status as open, partial, deferred, blocked, hotspot, or unverified.

## Definition of Done for New OS/Product Work

```text
BELLA OS / PRODUCT - DEFINITION OF DONE

□ Ownership rõ
□ Reuse đã được kiểm tra
□ Canonical contract được xác minh
□ Không invent schema/type/API/RPC
□ DB -> Repository -> Domain -> Service -> API -> UI boundary đúng
□ FK/relation được resolve đúng semantics
□ Read/write contracts được chứng minh riêng khi cần
□ Product Identity rõ
□ Tenant isolation đúng
□ AuthN/AuthZ đúng
□ Null semantics rõ
□ Không any/suppression workaround
□ Không sửa generated type để chiều consumer
□ Không vi phạm Core/Frozen/Architecture boundary
□ Test fixture/mock theo production contract
□ Integration test chạy đúng environment
□ TypeScript = 0 đối với code mới
□ ESLint errors = 0
□ Architecture gates = PASS
□ Relevant tests = PASS
□ Security gates liên quan = PASS
□ Không regression ngoài scope
□ Có evidence trước khi CLOSED
```

## Default Stop Conditions

Stop implementation and report status when any of these is true:

```text
Owner is unclear
Canonical contract is missing or contradictory
Current layer does not have access rights
Read/write semantics are not proven
Fix requires frozen/core/kernel modification
Fix requires inventing schema, RPC, API, field, or type
Execution environment cannot satisfy the test contract
Verification evidence is stale or unavailable
```

When stopped for these reasons, use `DEFER`, `BLOCKED`, `HOTSPOT`, or `UNVERIFIED`; do not claim PASS.
