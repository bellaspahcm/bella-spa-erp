# F5 RECONCILIATION & FINANCIAL CONTROL — PUBLIC CONTRACT

> **Freeze Status: 🔒 F5.0 CONSTITUTION FROZEN**
> This document defines the stable, versioned API surface and schema specs of the F5 Reconciliation & Control Plane.
> The DB Kernel, CLI tools, and background workers interact with F5 strictly through these contracts.

---

## Contract Version

| Field | Value |
|---|---|
| **Version** | `F5.0.0-Constitution` |
| **Locked At** | `2026-08-16T08:30:00+07:00` |
| **Commit** | `Constitution v1.2-Final` |

---

## 1. F5 Namespace Database Schema (f5_*)

F5 mutates ONLY tables under the `f5_*` namespace. Core `finance_*` tables are strictly read-only.

### 1.1 Table: `f5_control_results`
Stores the result of every individual reconciliation check at a specific snapshot point.

```sql
CREATE TABLE public.f5_control_results (
    result_id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                  UUID         NOT NULL,

    -- Reconciliation Run Identity
    run_id                     UUID         NOT NULL,
    control_type               TEXT         NOT NULL, -- enum check
    basis_id                   UUID         NOT NULL,
    basis_version              TEXT         NOT NULL, -- version tag e.g. "AP_GL_BALANCE:v1"
    reconciliation_as_of       TIMESTAMPTZ  NOT NULL,
    source_snapshot_hash       TEXT         NOT NULL, -- SHA-256 canonical hash

    -- Canonical Financial Effect Identity
    source_module              TEXT         NOT NULL, -- AR | AP | CASH | PREPAYMENT
    source_type                TEXT         NOT NULL, -- VENDOR_BILL | INVOICE | CASH_MOVEMENT | ...
    source_id                  UUID         NOT NULL,
    source_fact_id             UUID,
    source_version             BIGINT,
    financial_effect_type      TEXT         NOT NULL,
    posting_attempt_id         TEXT         NOT NULL,

    -- Unique constraint enforcing single result per canonical identity per run
    UNIQUE (tenant_id, run_id, source_module, source_type, source_id, 
            financial_effect_type, posting_attempt_id),

    -- Financial values
    expected_amount            NUMERIC(20,4),
    actual_amount              NUMERIC(20,4),
    variance_amount            NUMERIC(20,4) GENERATED ALWAYS AS (actual_amount - expected_amount) STORED,
    source_currency            CHAR(3),
    functional_currency        CHAR(3),
    fx_rate                    NUMERIC(20,6), -- NULL if single-currency

    -- Context
    source_snapshot            JSONB,
    financial_result           TEXT         NOT NULL, -- MATCHED | VARIANCE | QUARANTINED
    severity                   TEXT         NOT NULL, -- CRITICAL | HIGH | MEDIUM | LOW

    detected_at                TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    detected_by                TEXT         NOT NULL, -- RPC/Worker identity
    case_id                    UUID         -- NULL for MATCHED
);
```

### 1.2 Table: `f5_control_cases`
Manages the governance and manual/automated resolution lifecycle of `VARIANCE` and `QUARANTINED` results.

```sql
CREATE TABLE public.f5_control_cases (
    case_id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                  UUID         NOT NULL,
    result_id                  UUID         NOT NULL, -- FK to f5_control_results
    case_state                 TEXT         NOT NULL DEFAULT 'OPEN', -- OPEN | INVESTIGATING | RESOLVED

    -- Lifecycle metadata
    detected_at                TIMESTAMPTZ  NOT NULL,
    detected_by                TEXT         NOT NULL,
    
    -- Investigation roles
    assigned_to                UUID,
    investigated_by            UUID,
    investigation_started_at   TIMESTAMPTZ,

    -- Resolution roles
    resolved_by                UUID,
    authorized_by              UUID,
    resolution_reference       TEXT, -- ID of external corrective workflow/journal entry
    resolved_at                TIMESTAMPTZ,

    -- Governance check
    CONSTRAINT resolution_requires_authority CHECK (
        case_state <> 'RESOLVED' OR (
            resolution_reference IS NOT NULL AND
            authorized_by IS NOT NULL AND
            resolved_at IS NOT NULL
        )
    )
);
```

### 1.3 Table: `f5_projection_health`
Separately tracks the status of derived caches (Control B: Projection Health). Cache drift never spawns financial cases.

```sql
CREATE TABLE public.f5_projection_health (
    health_id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                  UUID         NOT NULL,
    domain                     TEXT         NOT NULL, -- AR | AP | CASH | PREPAYMENT
    run_id                     UUID         NOT NULL,
    reconciliation_as_of       TIMESTAMPTZ  NOT NULL,
    fact_derived_amount        NUMERIC(20,4) NOT NULL,
    cache_amount               NUMERIC(20,4) NOT NULL,
    drift_amount               NUMERIC(20,4) GENERATED ALWAYS AS (cache_amount - fact_derived_amount) STORED,
    projection_result          TEXT         NOT NULL, -- CACHE_SYNCED | CACHE_DRIFT
    detected_at                TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
```

---

## 2. Inbound Consumed Contracts (F1–F4 Read Boundary)

Per F5-G7 Read Boundary Gate, F5 consumes F1–F4 data strictly through versioned read-only RPC contracts. All contracts **must** expose:
1. `p_as_of` TIMESTAMPTZ
2. `p_tenant_id` UUID
3. `p_contract_version` TEXT

### 2.1 F1 General Ledger Read Contract
Returns all journal lines posted on or before `p_as_of` for specific account categories.
```sql
CREATE OR REPLACE FUNCTION public.finance_journal_entries_as_of(
    p_tenant_id         UUID,
    p_as_of             TIMESTAMPTZ,
    p_contract_version  TEXT
) RETURNS TABLE (
    transaction_id      UUID,
    journal_line_id     UUID,
    account_id          UUID,
    account_code        VARCHAR,
    debit_amount        NUMERIC(20,4),
    credit_amount       NUMERIC(20,4),
    currency            CHAR(3),
    posting_date        TIMESTAMPTZ,
    source_type         VARCHAR,
    source_id           UUID
);
```

### 2.2 F2 Cash Outflow Read Contract
Returns cash movements recorded on or before `p_as_of`.
```sql
CREATE OR REPLACE FUNCTION public.finance_get_cash_movements_as_of(
    p_tenant_id         UUID,
    p_as_of             TIMESTAMPTZ,
    p_contract_version  TEXT
) RETURNS TABLE (
    movement_id          UUID,
    direction            VARCHAR,
    amount_minor         BIGINT,
    currency             CHAR(3),
    cash_effective_date  TIMESTAMPTZ,
    valuation_rate       NUMERIC(18,6)
);
```

### 2.3 F3 Receivables (AR) Read Contract
Returns all AR subledger events posted on or before `p_as_of`.
```sql
CREATE OR REPLACE FUNCTION public.finance_ar_facts_as_of(
    p_tenant_id         UUID,
    p_as_of             TIMESTAMPTZ,
    p_contract_version  TEXT
) RETURNS TABLE (
    fact_id             UUID,
    invoice_id          UUID,
    entry_type          VARCHAR,
    amount_minor        BIGINT,
    posting_date        TIMESTAMPTZ,
    posting_attempt_id  UUID
);
```

### 2.4 F4 Payables (AP) & Prepayments Read Contract
Returns all AP and Prepayment subledger facts posted on or before `p_as_of`.
```sql
CREATE OR REPLACE FUNCTION public.finance_ap_facts_as_of(
    p_tenant_id         UUID,
    p_as_of             TIMESTAMPTZ,
    p_contract_version  TEXT
) RETURNS TABLE (
    fact_id             UUID,
    vendor_bill_id      UUID,
    vendor_id           UUID,
    entry_type          VARCHAR, -- PAYABLE_ACCRUAL | DISBURSEMENT_ALLOCATION | PREPAYMENT_RECORDED | ...
    amount_minor        BIGINT,
    posting_date        TIMESTAMPTZ,
    posting_attempt_id  UUID
);
```

---

## 3. Outbound Reconciliation API Surface

### 3.1 Run Reconciliation Job: `f5_run_reconciliation`
Main entry point for executing a reconciliation run for a specific domain.

```sql
CREATE OR REPLACE FUNCTION public.f5_run_reconciliation(
    p_tenant_id           UUID,
    p_domain              TEXT, -- AR | AP | CASH | PREPAYMENT
    p_control_type        TEXT, -- Registry-defined type
    p_basis_id            UUID,
    p_basis_version       TEXT,
    p_reconciliation_as_of TIMESTAMPTZ
) RETURNS JSONB;
```
* **Returns:** `{"run_id": UUID, "total_checked": int, "matched": int, "variances": int, "quarantined": int}`
* **Permissions:** Restricted to `service_role` and admin users.

### 3.2 Update Case Status: `f5_investigate_control_case`
Transitions case from `OPEN` to `INVESTIGATING` with audit tracking.

```sql
CREATE OR REPLACE FUNCTION public.f5_investigate_control_case(
    p_tenant_id         UUID,
    p_case_id           UUID,
    p_assigned_to       UUID,
    p_investigated_by   UUID
) RETURNS JSONB;
```

### 3.3 Authorize Case Resolution: `f5_resolve_control_case`
Filing resolution references and signatures for a case. Enforces Law: case resolved != ledger corrected.

```sql
CREATE OR REPLACE FUNCTION public.f5_resolve_control_case(
    p_tenant_id             UUID,
    p_case_id               UUID,
    p_resolved_by           UUID,
    p_authorized_by         UUID,
    p_resolution_reference  TEXT
) RETURNS JSONB;
```
