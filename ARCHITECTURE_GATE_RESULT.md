# ARCHITECTURE GATE RESULT - BELLA ENGLISH CENTER POST-RC ENVIRONMENT CLOSURE

> **Status:** PASS - dev-only API auth-context repair for Post-RC runtime validation
> **Date:** 2026-09-15
> **Canonical base:** `origin/main@fbff36721c3f53067cbd3992157dbb3ba04e634a`
> **Scope:** English Center API runtime validation path only

---

## 1. Product Manifest (Capabilities & Scope)

This closure does not add a new English Center business capability. It fixes the local Post-RC browser validation path where development mock authentication resolves a tenant/user but the API repository Supabase client remains anonymous, causing RLS-backed Command Center reads to fail against `public.user_org_unit_access`.

Included:
- Keep E6-E9 product surfaces unchanged.
- Keep canonical Education OS contracts unchanged.
- Use a service-role Supabase client only for the existing development mock-user branch.
- Preserve production cookie/JWT Supabase client behavior.

Excluded:
- No Education Kernel modification.
- No Healthcare, Logistics, Finance, or cross-industry dependency.
- No `anon` database grant expansion to make tests pass.
- No new database table, policy, or migration in code.

## 2. Ownership Map ("WHO OWNS THIS DATA?")

| Artifact | Owner Context | Data Definition |
|---|---|---|
| `src/app/api/english-center/_shared.ts` | Bella English Center API boundary | API context resolution only |
| `public.user_org_unit_access` | Platform Authorization projection | Existing branch/org-unit access read model |
| English Center E2-E8 tables | Bella English Center Product | Existing product-owned projections and runtime data |

## 3. Contract Dependency Map

```
Post-RC browser gate
        |
        v
English Center API context
        |
        +-- production auth: SSR Supabase client with user JWT
        |
        +-- development mock auth: service-role Supabase client
        |
        v
English Center repositories
        |
        v
Platform Authorization projection (user_org_unit_access)
        |
        v
Product RLS / tenant / branch scope
```

No Product -> Education Kernel bypass is introduced.

## 4. Additive Migration Plan

No code migration is added. Environment closure applied canonical existing migrations/grants to the linked Supabase project and refreshed PostgREST schema cache separately from this source patch.

## 5. 11 Automated Verification Gates Plan

- Gate 1 Architecture Compliance: no `src/platform/education/` change; no cross-industry import.
- Gate 2 Contract Boundary: no Education contract bypass change.
- Gate 3 Tenant Isolation: preserve tenant lookup and RLS-backed branch filtering.
- Gate 4 RLS & Authorization: do not grant `anon`; development mock uses controlled admin client.
- Gate 5 Database Migration Safety: no new migration.
- Gate 6 Event-After-Persistence: not applicable; read-only API context path.
- Gate 7 Academic Safety Routing: not applicable; no assessment calculation change.
- Gate 8 Temporal Provenance: not applicable; no temporal write.
- Gate 9 Rule Governance: not applicable; no grading rule change.
- Gate 10 Audit Evidence Integrity: not applicable; no transcript/export change.
- Gate 11 Platform Regression: run Post-RC browser gate and targeted English Center API tests.

---

# ARCHITECTURE GATE RESULT — PR82 CI REMEDIATION

> **Status:** PASS — CI-only remediation, no Product Vertical or Kernel impact
> **Date:** 2026-09-13
> **Scope:** GitHub Actions checks for PR #82 (`infra/git-workflow-constitution-install`)

---

## 1. Product Manifest (Capabilities & Scope)

This change is limited to CI workflow execution policy:
- Bound API documentation checks to API/API-documentation changes.
- Bound live Supabase/DB checks to database, application, or DB-check changes.
- Remove unsafe direct GitHub context interpolation from shell `run:` blocks.
- Pin the branch-cleanup GitHub Action to an immutable commit SHA.

No Healthcare, Education, Logistics, Finance, or Product Vertical runtime capability is added or changed.

## 2. Ownership Map ("WHO OWNS THIS DATA?")

No business data or domain entity is owned or modified by this change.

| Artifact | Owner Context | Data Definition |
|---|---|---|
| `.github/workflows/*` | Repository CI Governance | Automation policy only |
| `docs/api-reference.md` | API Documentation Governance | Referenced deliverable, not created in this change |

## 3. Contract Dependency Map

```
GitHub PR event
        │
        ▼
GitHub Actions workflow checks
        │
        ├── Repo scripts (`npm run docs:api:*`)
        └── GitHub Advanced Security Semgrep OSS
```

No Product -> Contract -> Kernel dependency exists in this remediation.

## 4. Additive Migration Plan

No database migration. No schema change. No RLS policy change.

## 5. 11 Automated Verification Gates Plan

The Healthcare/Education 11-gate product-vertical suite is not applicable because no vertical or kernel code is touched.

Targeted verification for this CI remediation:
- YAML parse / workflow syntax validation.
- Semgrep OSS annotations addressed without disabling scanner.
- API docs check remains enforced for API/API-doc changes and is skipped for infra-only PRs.
- Live DB checks remain enforced for DB/application/DB-check changes and are skipped for infra-only PRs.
- GitHub Actions status rechecked after commit/push.

---

# ARCHITECTURE GATE RESULT — BELLA FINANCE OS KERNEL F1

> **Status:** APPROVED BY HUMAN ARCHITECT  
> **Milestone:** Phase F1.1 & F1.2 Initialization  
> **Author:** Architecture Review AI (Antigravity)  
> **Date:** 2026-08-15  

---

## 1. Product Manifest (Capabilities & Scope)

Finance OS Kernel F1 Ledger Engine provides core double-entry bookkeeping and accounting capabilities to the Bella Platform. It handles the financial truth layer without any business vertical dependencies.

### Capabilities Exposed:
- **COA Management**: Chart of accounts definition with strict normal balances (Debit/Credit).
- **Accounting Periods**: Open, close, and lock periods. Prevent posting to closed/locked periods.
- **Double-Entry Posting**: Balanced journal entry transactions.
- **Traceable Sourcing**: Map financial records back to vertical business events via opaque `source_type`/`source_id` references.
- **Immutability Enforcement**: Voiding and reversing transactions. No direct updates to posted entries.
- **Idempotent Dispatch**: Prevent duplicate posting using client-provided unique idempotency keys.
- **Decimal Precision**: Represent money in string-based minor units (`amount_minor`) to avoid floating-point math errors.
- **Reporting Dimensions**: Support cost center, BU, location, and department dimensions natively.

---

## 2. Ownership Map ("WHO OWNS THIS DATA?")

| Table Name | Owner Context | Data Definition |
|---|---|---|
| `finance_accounts` | F1 Ledger | Chart of accounts list |
| `finance_accounting_periods` | F1 Ledger | Accounting periods & locks |
| `finance_transactions` | F1 Ledger | Transaction headers, idempotency keys, source mapping |
| `finance_transaction_lines` | F1 Ledger | Double-entry line items, debit/credit string amounts, dimensions |
| `finance_outbox_events` | F1 Ledger | Transactional outbox records for event publishing |
| `finance_audit_trail` | F1 Ledger | Immutable log of all updates to financial state |

---

## 3. Contract Dependency Map

```
Vertical Layer (Spa, Hospital, etc.)
               │
               ▼
Vertical Finance Bridge (ACL)
               │
               ▼ (Calls via Public Contracts only)
ILedgerEngine Contract (F1)
               │
               ▼
LedgerEngineService (F1 Implementation)
               │
               ├── Updates database (finance_*)
               └── Writes to transactional outbox (finance_outbox_events)
```

---

## 4. Additive Migration Plan

No existing accounting or business tables will be deleted or modified. The migration strictly creates new tables.

### SQL Migrations Proposed:
- `CREATE TABLE finance_accounting_periods` with columns for period range and status.
- `CREATE TABLE finance_accounts` with code, normal balance, and status.
- `CREATE TABLE finance_transactions` with status, functional/transaction currency, source type/id, and idempotency key.
- `CREATE TABLE finance_transaction_lines` with debit/credit string representation and dimensions.
- `CREATE TABLE finance_outbox_events` with payload and status.
- `CREATE TABLE finance_audit_trail` for immutable history tracking.
- Enable RLS on all tables with policies asserting `tenant_id = auth.jwt()->>'tenant_id'`.

---

## 5. 10 Automated Verification Gates Plan

| Gate | Verification Target | Test Method |
|---|---|---|
| **Gate F-1** | Architecture Compliance | Static analysis to ensure no vertical imports in F1, and strict typing (no `any` type). |
| **Gate F-2** | Contract Boundary | Verify vertical layers cannot query `finance_*` tables directly, only via contracts. |
| **Gate F-3** | Tenant Isolation (P0) | Assert that data from Tenant A is never visible/accessible to Tenant B across all F1 methods. |
| **Gate F-4** | Double-Entry Invariant | Assert that trying to post an imbalanced entry (Σ debit ≠ Σ credit) throws `DOUBLE_ENTRY_IMBALANCE`. |
| **Gate F-5** | Transaction Immutability | Assert that updating a transaction with status `POSTED` throws an exception, and that reversing creates mirror lines. |
| **Gate F-6** | Idempotency | Assert that two consecutive `postTransaction` calls with the same key return the same transaction ID without duplication. |
| **Gate F-7** | Period Control | Assert that posting to a `CLOSED` or `LOCKED` period is blocked with `PERIOD_NOT_OPEN`. |
| **Gate F-8** | Event-After-Persistence | Verify that `finance_outbox_events` has the event record committed in the same transaction, and the dispatcher publishes it successfully. |
| **Gate F-9** | Full Regression | Run all Finance OS test suites to ensure 100% test coverage. |
| **Gate F-10** | Financial State Reconstruction | Rebuild materialized state from authoritative records and verify equality. |
