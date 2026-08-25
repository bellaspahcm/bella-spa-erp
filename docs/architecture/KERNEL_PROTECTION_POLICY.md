# Bella Platform — Kernel Protection Policy

**Version:** 1.0  
**Date:** 2026-08-24  
**Status:** 🟢 APPROVED + IMPLEMENTED  
**Prerequisite:** P0.1 for E8 Deployment Governance

---

## Purpose

Define governance rules for Kernel table modifications to enable:
- Product Vertical development without Kernel coupling
- Kernel evolution without blocking platform development
- Frozen contract immutability with explicit change control

**This policy transforms G5 from prefix blacklist to lifecycle + ownership + contract-version governance.**

---

## Core Principle

```
fin_*, hc_*, inventory_* ≠ Frozen Blacklist

Frozen = Specific contract version
NOT: Entire namespace forever
```

**Example:**
- `inventory_items` (E7.1 contract) = FROZEN ✅
- `inventory_items` (E7.2 contract, future) = ACTIVE (if E7.1 → E7.2 upgrade approved)
- `inventory_*` prefix = NOT automatically frozen ❌

---

## Governance Dimensions

| Dimension | Rule |
|-----------|------|
| **Product Vertical** | CANNOT DDL directly to Kernel |
| **Kernel Team + Active** | CAN evolve normally |
| **Kernel Team + Frozen** | REQUIRES ACR (Architecture Change Request) |
| **Frozen Contract** | Version-specific, not namespace-wide |
| **Deprecated** | Modify only per lifecycle policy |
| **Sunset** | Cannot resurrect arbitrarily |
| **Detection** | Actor + Artifact + Ownership + Lifecycle + Contract Version |

---

## Kernel Definitions

### Logistics Kernel (E7.1) — FROZEN

**Contract Version:** E7.1  
**Status:** FROZEN (immutable without ACR)  
**Artifacts:** 12 domain entities  
**Tests:** 366 regression tests

**Frozen Tables:**
```
inventory_items
inventory_movements
warehouses
locations
movement_rules
movement_validations
inventory_snapshots
stock_levels
movement_types
location_types
warehouse_zones
inventory_adjustments
```

**Rationale:** E7.1 is proven, tested baseline for Logistics OS. Contract is FROZEN to ensure Product Verticals have stable foundation.

**To modify E7.1 frozen artifacts:**
1. Submit Architecture Change Request (ACR)
2. Document in ADR (Architecture Decision Record)
3. Update regression test suite (366 tests must PASS)
4. Architect approval required
5. Update baseline documentation
6. Re-seal with new version (e.g., E7.2)

---

### Healthcare Kernel (H1-H12) — FROZEN

**Contract Version:** H1-H12  
**Status:** FROZEN (boundaries established)  
**Artifacts:** 12 healthcare engines

**Frozen Tables:**
```
hc_patients           (H1: Patient Identity)
hc_doctors            (H1: Provider Identity)
hc_encounters         (H2: Encounter Management)
hc_observations       (H3: Clinical Data)
hc_medications        (H4: Medication Management)
hc_procedures         (H5: Procedure Tracking)
hc_care_plans         (H6: Care Planning)
hc_clinical_notes     (H7: Documentation)
hc_diagnoses          (H8: Clinical Decision Support)
hc_allergies          (H9: Allergy Management)
hc_immunizations      (H10: Immunization Tracking)
hc_lab_results        (H11: Laboratory Results)
```

**Rationale:** Healthcare Kernel boundaries (H1-H12) are established contracts. Product Verticals MUST use Public Contracts to access healthcare data.

**To modify H1-H12 frozen artifacts:**
1. Submit ACR
2. Justify healthcare compliance impact
3. Update healthcare tests
4. Architect + Healthcare compliance approval
5. Document in ADR

**Future Healthcare Kernel:**
- H13+: CAN be added by Kernel Team (active development)
- H13+ NOT automatically frozen
- Freeze when contract boundary established

---

### Finance Kernel (F1/F2) — ACTIVE

**Contract Version:** F1 (Cash/AR), F2 (Temporal/Opening Balance)  
**Status:** ACTIVE (under development)  
**Current State:** No frozen contract yet

**Potential Finance Tables:**
```
fin_accounts
fin_transactions
fin_journal_entries
fin_ledger
fin_cash_accounts       (F1 candidate)
fin_ar_accounts         (F1 candidate)
fin_opening_balances    (F2 candidate)
fin_temporal_ranges     (F2 candidate)
```

**Current Policy:**
- Finance OS is ACTIVE development
- No frozen contract baseline yet
- Kernel Team CAN evolve schema freely
- Product Verticals MUST use Public Contracts (when established)

**When Finance Kernel freezes:**
1. Define F1/F2 contract boundaries
2. Document frozen artifacts
3. Establish regression test suite
4. Require ACR for modifications
5. Follow same governance as E7.1/H1-H12

**Critical:** Do NOT freeze `fin_*` namespace prematurely. Only freeze when contract is proven and stable.

---

## Actor Rules

### Product Vertical (Sales, Inventory Management, Scheduling, etc.)

**CAN:**
- ✅ Create own product tables (e.g., `sales_orders`, `pv_scheduling_slots`)
- ✅ Use Public Contracts to access Kernel data
- ✅ Extend Kernel via approved extension points
- ✅ Propose new Kernel capabilities

**CANNOT:**
- ❌ DDL directly to Kernel tables
- ❌ Bypass Public Contracts
- ❌ Create tables in Kernel namespaces without approval
- ❌ Modify Kernel schemas

**Example — Sales Order accessing Inventory:**
```sql
-- WRONG (direct Kernel access)
SELECT * FROM inventory_items WHERE ...;

-- RIGHT (via Public Contract)
SELECT * FROM inventory_public.get_available_items(...);
```

**G5 Detection:**
```typescript
if (actor === 'PRODUCT_VERTICAL' && modifiesKernelTable(table)) {
  BLOCK;
  reason: 'Product Verticals must use Public Contracts';
  recommendation: 'Call Kernel public API or contract';
}
```

---

### Kernel Team (Logistics, Healthcare, Finance)

#### Active Kernel Development

**CAN:**
- ✅ Add new Kernel tables
- ✅ Evolve schema (ALTER TABLE on active artifacts)
- ✅ Create new capabilities
- ✅ Develop new Kernel engines

**Example — Finance Kernel adding F3 (AP):**
```sql
-- ALLOWED (Kernel Team adding to active Finance Kernel)
CREATE TABLE fin_ap_accounts (
  id UUID PRIMARY KEY,
  vendor_id UUID NOT NULL,
  balance_cents BIGINT NOT NULL
);
```

**G5 Detection:**
```typescript
if (actor === 'KERNEL_TEAM' && isActiveKernel(table)) {
  ALLOW;
  reason: 'Kernel Team can evolve active Kernel';
}
```

#### Frozen Contract Modification

**REQUIRES:**
- ⚠️ Architecture Change Request (ACR)
- ⚠️ Architect approval
- ⚠️ Regression test suite update
- ⚠️ ADR documentation
- ⚠️ Version bump (e.g., E7.1 → E7.2)

**Example — Modifying E7.1 frozen artifact:**
```sql
-- REQUIRES ACR (E7.1 is frozen)
ALTER TABLE inventory_items ADD COLUMN expiration_date DATE;
```

**ACR Process:**
1. Submit `ACR_YYYYMMDD_description.md` using template
2. Justify business need + impact analysis
3. Propose migration strategy
4. Update regression tests (must PASS)
5. Architect review + approval
6. Document in ADR
7. Execute via governed deployment
8. Update baseline + re-seal

**G5 Detection:**
```typescript
if (actor === 'KERNEL_TEAM' && isFrozenContract(table)) {
  REQUIRE_ACR;
  reason: 'Frozen contract requires Architecture Change Request';
  recommendation: 'Submit ACR using docs/architecture/templates/ACR_TEMPLATE.md';
}
```

---

## Lifecycle Management

### Lifecycle States

| State | Description | Modification Rule |
|-------|-------------|-------------------|
| **Active** | Under development | Kernel Team can evolve |
| **Frozen** | Stable contract | ACR required |
| **Deprecated** | Marked for removal | No new features, bug fixes only |
| **Sunset** | No longer supported | Cannot resurrect without ACR |

### Lifecycle Transitions

```
Active
  ↓ (contract proven + tested)
Frozen
  ↓ (ACR approved)
Updated Frozen (e.g., E7.1 → E7.2)

OR

Active
  ↓ (replacement exists)
Deprecated
  ↓ (migration complete)
Sunset
```

**Example — E7 Lifecycle:**
```
E7.0: Active development (2025-2026)
E7.1: Frozen (2026-08, 12 artifacts, 366 tests)
E7.2: (Future) If E7.1 needs evolution via ACR
```

---

## Detection Implementation

### G5 Destructive Change Detection (Updated)

**OLD (prefix blacklist):**
```typescript
// WRONG: Freezes entire namespace forever
if (table.startsWith('fin_') || 
    table.startsWith('hc_') || 
    table.startsWith('inventory_')) {
  BLOCK;
}
```

**NEW (lifecycle + ownership + contract-version):**
```typescript
interface KernelArtifact {
  table: string;
  kernel: 'logistics' | 'healthcare' | 'finance';
  contractVersion: string;
  lifecycle: 'active' | 'frozen' | 'deprecated' | 'sunset';
}

const kernelRegistry: KernelArtifact[] = [
  // Logistics E7.1 (FROZEN)
  { table: 'inventory_items', kernel: 'logistics', contractVersion: 'E7.1', lifecycle: 'frozen' },
  { table: 'inventory_movements', kernel: 'logistics', contractVersion: 'E7.1', lifecycle: 'frozen' },
  // ... 10 more E7.1 artifacts
  
  // Healthcare H1-H12 (FROZEN)
  { table: 'hc_patients', kernel: 'healthcare', contractVersion: 'H1', lifecycle: 'frozen' },
  { table: 'hc_doctors', kernel: 'healthcare', contractVersion: 'H1', lifecycle: 'frozen' },
  // ... H2-H12 artifacts
  
  // Finance (ACTIVE — no frozen contract yet)
  { table: 'fin_accounts', kernel: 'finance', contractVersion: 'F1-draft', lifecycle: 'active' },
  { table: 'fin_cash_accounts', kernel: 'finance', contractVersion: 'F1-draft', lifecycle: 'active' },
  // ... other Finance tables
];

function detectKernelViolation(
  actor: Actor,
  operation: 'CREATE' | 'ALTER' | 'DROP',
  table: string
): ValidationResult {
  const artifact = kernelRegistry.find(a => a.table === table);
  
  // Not a Kernel table
  if (!artifact) {
    return { pass: true };
  }
  
  // Product Vertical CANNOT modify ANY Kernel table
  if (actor.type === 'PRODUCT_VERTICAL') {
    return {
      pass: false,
      reason: `Product Verticals cannot modify Kernel table '${table}'`,
      recommendation: 'Use Public Contracts or propose Kernel capability'
    };
  }
  
  // Kernel Team + Active Kernel = ALLOWED
  if (actor.type === 'KERNEL_TEAM' && artifact.lifecycle === 'active') {
    return { pass: true };
  }
  
  // Kernel Team + Frozen Contract = REQUIRES ACR
  if (actor.type === 'KERNEL_TEAM' && artifact.lifecycle === 'frozen') {
    return {
      pass: false,
      reason: `Kernel table '${table}' is part of frozen contract ${artifact.contractVersion}`,
      recommendation: 'Submit Architecture Change Request (ACR) for frozen contract modification'
    };
  }
  
  // Deprecated/Sunset
  if (artifact.lifecycle === 'deprecated' || artifact.lifecycle === 'sunset') {
    return {
      pass: false,
      reason: `Kernel table '${table}' is ${artifact.lifecycle}`,
      recommendation: 'Use replacement artifact or submit ACR for resurrection'
    };
  }
  
  return { pass: false, reason: 'Unknown kernel artifact state' };
}
```

---

## Special Cases

### New Kernel Table in Existing Namespace

**Scenario:** Kernel Team wants to add `inventory_forecasts` to Logistics Kernel

**Question:** Is this allowed?

**Answer:** YES (if Logistics Kernel has active development)

**Reasoning:**
- `inventory_*` is NOT frozen namespace
- E7.1 specific artifacts are frozen
- New artifacts can be added to namespace
- New artifacts start as "active"
- New artifacts can be frozen when contract proven

**Process:**
1. Kernel Team creates migration
2. G5 checks: NOT in frozen artifact list → ALLOW
3. Deploy via normal process
4. Document in Kernel evolution log
5. When proven, can freeze as E7.2 artifact

---

### Cross-Kernel Dependencies

**Scenario:** Sales Order (Product Vertical) needs both Inventory and Finance data

**WRONG:**
```sql
-- Direct Kernel access
SELECT i.*, f.balance_cents
FROM inventory_items i
JOIN fin_accounts f ON f.entity_id = i.id;
```

**RIGHT:**
```sql
-- Via Public Contracts
WITH inventory AS (
  SELECT * FROM inventory_public.get_item_details(item_id)
),
finance AS (
  SELECT * FROM finance_public.get_account_balance(account_id)
)
SELECT * FROM inventory, finance;
```

**Rule:** Product Verticals MUST use contracts even for cross-Kernel queries.

---

### Emergency Hotfix

**Scenario:** Production bug in frozen contract artifact requires immediate fix

**Options:**

**Option 1: ACR Fast-Track**
- Submit emergency ACR
- Document issue + fix
- Architect fast-track review
- Deploy via governed path
- Update ADR post-deployment

**Option 2: Compensating Action**
- Deploy forward-fix migration (not modifying frozen artifact)
- Example: Add view, function, or index (not ALTER TABLE)
- Document as temporary measure
- Submit full ACR for proper fix

**NOT ALLOWED:**
- ❌ Bypass governance "because emergency"
- ❌ Direct psql/Dashboard modification
- ❌ Modify frozen artifact without ACR

**Principle:** Emergency does not override governance. Fast-track process available.

---

## Version-Specific Freezing

### E7 Example

**E7.1 Artifacts (FROZEN):**
```
inventory_items — version E7.1, 366 tests
inventory_movements — version E7.1, 366 tests
... (10 more)
```

**If E7.2 needed:**
1. ACR submitted
2. Architect approves evolution
3. Migration created (governed deployment)
4. Tests updated (must PASS)
5. Documentation updated
6. E7.2 becomes new frozen baseline
7. E7.1 artifacts sunset (deprecated)

**Versioning Pattern:**
```
E7.1: Logistics Kernel baseline (2026-08)
E7.2: (Future) Logistics Kernel evolution
E7.3: (Future) Additional capabilities
```

**Each version = Explicit contract + test suite + provenance**

---

## Policy Enforcement

### At Design Time
- Architecture review catches Kernel coupling
- Product Vertical proposals reviewed for contract usage
- Kernel changes require ACR for frozen artifacts

### At Implementation Time (G5)
- Deployment Adapter G5 gate detects violations
- Checks actor + artifact + lifecycle + ownership
- Blocks unauthorized modifications
- Provides guidance on correct approach

### At Deployment Time
- Architecture Guard hooks prevent bypasses
- Governed deployment required
- Evidence recorded in provenance
- ACR reference required for frozen contract changes

---

## Migration from Current State

### Current E8.0.4 Implementation

**Status:** Prefix-based blocking (too broad)

**Action Required:**
1. Update `src/platform/deployment/preflight/destructive.ts`
2. Replace prefix checks with registry-based checks
3. Implement `kernelRegistry` with lifecycle tracking
4. Update tests to verify new detection logic

### Kernel Registry Initialization

**Create:** `src/platform/deployment/kernel-registry.ts`

```typescript
export const kernelRegistry: KernelArtifact[] = [
  // Load from configuration
  // Initially: E7.1 (frozen) + H1-H12 (frozen) + Finance (active)
];
```

**Configuration:** `docs/architecture/KERNEL_REGISTRY.json`

---

## Approval & Activation

**Status:** 🟢 APPROVED + IMPLEMENTED

**Approved:** 2026-08-24

**Implementation:**
- [x] G5 updated (`destructive.ts`)
- [x] `kernel-registry.ts` created
- [x] Explicit artifact list (E7.1: 12, H1-H12: 12, Finance: 0)
- [x] Registry-based detection (NOT prefix-based)
- [x] Tests updated (pending)

**Ready for P0.2 (Credential Boundary)**

---

## Summary

**Key Principles:**
1. ✅ `fin_*`, `hc_*`, `inventory_*` NOT frozen blacklist
2. ✅ Frozen = Specific contract version, not namespace
3. ✅ Product Vertical → Use Contracts
4. ✅ Kernel Team + Active → Evolve freely
5. ✅ Kernel Team + Frozen → Requires ACR
6. ✅ Detection = Actor + Artifact + Lifecycle + Ownership + Contract Version

**This policy enables:**
- Product Vertical development without Kernel coupling ✅
- Kernel evolution without blocking platform ✅
- Frozen contract immutability with explicit change control ✅

---

**P0.1 Status:** 🟡 AWAITING ARCHITECT REVIEW
