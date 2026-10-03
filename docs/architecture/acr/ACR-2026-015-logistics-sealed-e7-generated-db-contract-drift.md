# Architecture Change Request (ACR)

**ACR ID:** ACR-2026-015
**Date Submitted:** 2026-10-03
**Submitted By:** AI Agent (Full Repository Typecheck Cleanup)
**Status:** APPROVED

---

## Summary

Full repository typecheck is blocked by 268 remaining Logistics diagnostics across 19 files in the sealed/frozen E7 boundary. The diagnostics are concentrated in contract drift among E7 domain/kernel contracts, generated Supabase persistence types, repository mappers, sealed exports, and shared engine type imports.

This ACR approves a scoped Logistics repository/adapter/contract-boundary fix only. It does not approve generated-file edits, migrations, public API redesign, kernel contract weakening, or unrelated refactor.

---

## Current Typecheck Checkpoint

```text
FULL_REPO_TYPECHECK
BASELINE       = 849
RESOLVED       = 516
REMAINING      = 333

HEALTHCARE     = 65  (ACR-2026-014, waiting for explicit grant)
LOGISTICS      = 268 (this ACR)

UNBLOCKED      = 0
SUPPRESSIONS   = NONE
NEW_DEBT       = NONE
STATUS         = BLOCKED_BY_ARCHITECTURAL_FREEZE
```

Diagnostics evidence artifact:

```text
.cache/typecheck-baseline-20261003/logistics-remaining-diagnostics.txt
```

The artifact is analysis evidence only and is not a source artifact to commit unless explicitly requested.

---

## Affected Layer(s)

- [x] E7.1 Domain Kernel
- [x] E7.2 Operational Kernel
- [x] E7.3 Rules & Traceability
- [x] Other: Logistics repository/adapter boundary, logistics contracts, and engine integration boundary

---

## Affected Artifacts

### Audit Scope: 19 Files / 268 Diagnostics

```text
src/platform/logistics/domain/rules/traceability.operations.ts     48
src/platform/logistics/domain/traceability.domain.ts               41
src/platform/logistics/repositories/item.repository.ts             27
src/platform/logistics/domain/location.domain.ts                   26
src/platform/logistics/domain/movement.domain.ts                   24
src/platform/logistics/repositories/inventory.repository.ts        23
src/platform/logistics/domain/item.domain.ts                       18
src/platform/logistics/domain/inventory-operations.domain.ts       17
src/platform/logistics/domain/inventory.domain.ts                  10
src/platform/logistics/domain/rules/traceability.rule.ts            9
src/platform/logistics/repositories/movement.repository.ts          6
src/platform/logistics/engines/shipment-engine.ts                   6
src/platform/logistics/domain/uom.domain.ts                         4
src/platform/logistics/domain/rules/expiry.rule.ts                  3
src/platform/logistics/engines/freight-audit-engine.ts              2
src/platform/logistics/contracts/freight-audit.contract.ts          1
src/platform/logistics/contracts/warehouse.contract.ts              1
src/platform/logistics/repositories/uom.repository.interface.ts     1
src/platform/logistics/warehouse/receipt.service.ts                 1
```

### Approved Unlock Scope

Implementation authority is granted only for the scoped Logistics repository/adapter/contract-boundary fix.

The implementation scope is limited to:

```text
docs/architecture/acr/ACR-2026-015-logistics-sealed-e7-generated-db-contract-drift.md
docs/architecture/adr/ADR-2026-015-logistics-sealed-e7-generated-db-contract-drift.md
scripts/architecture/git-pre-commit-guard.js
scripts/architecture/ci-frozen-check.js

src/platform/logistics/domain/rules/traceability.operations.ts
src/platform/logistics/domain/traceability.domain.ts
src/platform/logistics/repositories/item.repository.ts
src/platform/logistics/domain/location.domain.ts
src/platform/logistics/domain/movement.domain.ts
src/platform/logistics/repositories/inventory.repository.ts
src/platform/logistics/domain/item.domain.ts
src/platform/logistics/domain/inventory-operations.domain.ts
src/platform/logistics/domain/inventory.domain.ts
src/platform/logistics/domain/rules/traceability.rule.ts
src/platform/logistics/repositories/movement.repository.ts
src/platform/logistics/engines/shipment-engine.ts
src/platform/logistics/domain/uom.domain.ts
src/platform/logistics/domain/rules/expiry.rule.ts
src/platform/logistics/engines/freight-audit-engine.ts
src/platform/logistics/contracts/freight-audit.contract.ts
src/platform/logistics/contracts/warehouse.contract.ts
src/platform/logistics/repositories/uom.repository.interface.ts
src/platform/logistics/warehouse/receipt.service.ts
```

Focused Logistics regression tests may be added or updated only if required by the approved boundary fix.

Generated database types, migrations, tsconfig weakening, and unrelated non-Logistics consumers are not in scope.

The guard script changes are limited to recognizing ACR-2026-015 in the existing Layer 3 and Layer 4 ACR authorization resolver. They do not change the frozen file list, disable enforcement, or broaden runtime scope.

---

## Reason for Change

### Business Context

The Logistics E7 kernel is sealed and serves as a stable business contract. Full repository typecheck could not reach zero while 268 Logistics diagnostics remained, and resolving them required explicit ACR authority.

The architecture review approved a scoped boundary fix, not a general refactor.

### Technical Context

The 268 diagnostics group into seven categories:

```text
snake/camel contract drift              152
type/null/value-object mismatch          69
unresolved contract surface              28
missing sealed export                     7
missing generated Database.logistics      6
missing @/core/types/engine module        4
implicit-any cascade from unresolved type 2
```

Diagnostic codes:

```text
TS2551  145
TS2322   62
TS2339   31
TS2305    7
TS2561    7
TS2352    6
TS2307    4
TS7006    2
TS18048   1
TS2345    1
TS2554    1
TS2741    1
```

The dominant pattern is not a random implementation cleanup. It is a multi-boundary contract drift:

```text
Generated Supabase Database contract
        <-> repository mapper/adapter
        <-> sealed Logistics E7 domain/kernel contract
        <-> Logistics contracts/engines/rules
```

### Priority

- [ ] P0 - Critical (production outage, data loss, security)
- [x] P1 - High (blocks full repository typecheck zero-debt closure)
- [ ] P2 - Medium (minor issue, workaround available)
- [ ] P3 - Low (enhancement, nice-to-have)

---

## Root Cause Map

### RC1: Canonical Naming Drift (`snake_case` / `camelCase`)

```text
Diagnostics = 152
Main files =
  src/platform/logistics/domain/rules/traceability.operations.ts
  src/platform/logistics/domain/traceability.domain.ts
  src/platform/logistics/repositories/item.repository.ts
  src/platform/logistics/repositories/inventory.repository.ts
  src/platform/logistics/domain/location.domain.ts
  src/platform/logistics/domain/item.domain.ts
  src/platform/logistics/domain/rules/traceability.rule.ts
  src/platform/logistics/domain/rules/expiry.rule.ts
```

Observed examples:

```text
movement_date -> movementDate
from_location_id -> fromLocationId
to_location_id -> toLocationId
tenant_id -> tenantId
expiry_date -> expiryDate
sku_code -> skuCode
base_uom -> baseUom
custodyEvents -> custody_events
recallStatus -> recall_status
complianceStatus -> compliance_status
```

Architecture question:

```text
Which naming convention is canonical inside the sealed Logistics domain/kernel?
Which naming convention belongs only to the persistence boundary?
```

### RC2: Type, Nullability, and Value Object Boundary Drift

```text
Diagnostics = 69
Main files =
  src/platform/logistics/domain/movement.domain.ts
  src/platform/logistics/domain/inventory-operations.domain.ts
  src/platform/logistics/domain/item.domain.ts
  src/platform/logistics/domain/traceability.domain.ts
  src/platform/logistics/repositories/movement.repository.ts
  src/platform/logistics/engines/shipment-engine.ts
  src/platform/logistics/domain/inventory.domain.ts
  src/platform/logistics/repositories/inventory.repository.ts
```

Observed examples:

```text
string | null -> string | undefined
Date | null -> Date | undefined
number | null -> number | undefined
string -> ItemId / LocationId / SkuCode
Record<string, unknown> -> Location / ShipmentItem / Weight / Volume
```

Architecture question:

```text
Where should DB nullable values be normalized?
Where should primitive IDs be wrapped into Logistics value objects?
Can engine-level Record payloads be accepted directly, or must they pass through typed decoders/mappers?
```

### RC3: Unresolved Contract Surface Drift

```text
Diagnostics = 28
Main files =
  src/platform/logistics/domain/location.domain.ts
  src/platform/logistics/domain/inventory.domain.ts
  src/platform/logistics/domain/traceability.domain.ts
  src/platform/logistics/domain/item.domain.ts
  src/platform/logistics/domain/inventory-operations.domain.ts
  src/platform/logistics/engines/freight-audit-engine.ts
```

Observed examples:

```text
addressJson missing from location props/domain object
quantityReserved / quantityOnHand missing from inventory update props
uomId missing from inventory
id/status/updatedBy missing from create props
reason_code missing from freight discrepancy contract
```

Architecture question:

```text
Are these fields intended business contract members, persistence-only fields, or stale implementation assumptions?
```

### RC4: Missing Sealed Exports

```text
Diagnostics = 7
Files =
  src/platform/logistics/domain/inventory-operations.domain.ts
  src/platform/logistics/domain/location.domain.ts
  src/platform/logistics/domain/uom.domain.ts
  src/platform/logistics/repositories/uom.repository.interface.ts
```

Observed missing exports:

```text
Movement
LocationStatus
UnitOfMeasure
CreateUOMProps
UpdateUOMProps
UOMStatus
```

Architecture question:

```text
Which sealed file owns these public Logistics types?
Should they be restored as explicit exports, moved to owner contracts, or removed from consumers as stale assumptions?
```

### RC5: Missing Generated `Database.logistics` Namespace

```text
Diagnostics = 6
Files =
  src/platform/logistics/repositories/inventory.repository.ts
  src/platform/logistics/repositories/item.repository.ts
```

Observed references:

```text
Database['logistics']['Tables']['inventory']
Database['logistics']['Tables']['items']
```

Architecture question:

```text
Does the generated Supabase Database contract intentionally expose Logistics tables under a logistics namespace?
If not, which generated persistence contract is canonical for Logistics repositories?
```

### RC6: Missing Shared Engine Type Module

```text
Diagnostics = 4
Files =
  src/platform/logistics/contracts/freight-audit.contract.ts
  src/platform/logistics/contracts/warehouse.contract.ts
  src/platform/logistics/engines/freight-audit-engine.ts
  src/platform/logistics/warehouse/receipt.service.ts
```

Observed import:

```text
@/core/types/engine
```

Architecture question:

```text
Is @/core/types/engine a removed shared Core contract, an ungenerated alias, or a stale Logistics dependency?
Should Logistics define local engine result types, import the canonical shared type from its current owner, or request a Core contract restoration?
```

### RC7: Implicit Any Cascades

```text
Diagnostics = 2
Files =
  src/platform/logistics/domain/traceability.domain.ts
  src/platform/logistics/domain/rules/traceability.rule.ts
```

These are downstream effects of unresolved array/member contracts and must not be fixed by adding `any`.

---

## Architecture Decision Requested

### Question

What is the canonical contract relationship among sealed Logistics E7 domain/kernel contracts, generated Supabase database types, and mapper/adapter boundaries?

### Proposed Decision

```text
DECISION = APPROVED

Logistics Domain/Kernel Contract =
  canonical business contract inside sealed E7.

Generated Supabase Database types =
  canonical persistence contract at the DB boundary.

Repository / adapter / mapper =
  required translation boundary between persistence shape and Logistics domain shape.

Sealed exports =
  must be owned by explicit E7 owner files; consumers must not invent or duplicate owner types.

Shared engine types =
  must resolve to a canonical owner before implementation; do not create a product-local substitute unless Human Architect approves it.
```

### Naming Decision

The approved decision preserves split boundary ownership.

- Logistics domain/kernel objects keep the canonical business contract.
- Generated persistence rows keep the canonical database contract.
- Approved repository/adapter/rule boundary files translate snake_case/value-object legacy or persistence shapes to the domain-facing contract.
- Existing sealed exports remain owned by their explicit E7 owner files.

### Architecture Decision Status

```text
Decision  = APPROVED
Authority = GRANTED_FOR_SCOPED_LOGISTICS_BOUNDARY_FIX
Code      = TEMPORARILY_UNLOCKED_FOR_APPROVED_SCOPE
```

---

## Approved Changes

### Implementation Plan

Implementation may occur only within the approved scope after this ACR and ADR-2026-015 are recorded.

Implementation proceeds in small batches:

1. Resolve canonical Logistics domain naming and sealed owner exports.
2. Resolve `Database.logistics` persistence source of truth without manual generated-file edits.
3. Resolve `@/core/types/engine` by importing from the canonical owner or approving a scoped replacement.
4. Repair repository/adapter mapper boundaries before changing higher-level domain logic.
5. Normalize null/undefined and value-object wrapping only at approved boundaries.
6. Run targeted Logistics typecheck/regression after each batch.
7. Stop immediately on diagnostic increase or behavior regression.

### Prohibited Implementation Tactics

- No `as any`.
- No `@ts-ignore`.
- No `@ts-expect-error`.
- No `as unknown as` cast workaround.
- No generated database file manual edit.
- No migration unless the approved decision explicitly says persistence schema/source is wrong.
- No sealed contract weakening.
- No duplicate owner type.
- No product-local substitute for a missing shared Core type without approval.
- No architecture-guard weakening; ACR resolver updates may only add ACR-2026-015 to the existing authorization path.
- No unrelated refactor.
- No Healthcare changes.

### API Impact

- [ ] Yes - Breaking change
- [ ] Yes - Additive change (backward compatible)
- [x] Unknown until Human Architect decides canonical E7 naming and export ownership

If the decision confirms existing sealed domain contracts as canonical, the implementation may be mapper-only and internal. If the decision changes sealed E7 naming or exports, API/contract impact must be documented in the ADR before implementation.

---

## Impact Analysis

### Blast Radius

**Direct consumers:**

```text
Logistics E7 domain, rules, repository, contracts, engines, and warehouse receipt service.
```

**Indirect consumers:**

```text
Products or services depending on Logistics inventory, movement, traceability, warehouse, and freight-audit contracts.
Full repository typecheck gate.
Logistics regression suite.
```

**Out of scope:**

```text
Healthcare ACR-2026-014 implementation.
Non-Logistics product code.
Manual generated database type edits.
Schema migrations without explicit approval.
Core shared type changes without explicit approval.
```

### Migration Path

No migration is proposed by this ACR.

If Human Architect decides generated persistence shape is wrong, a separate migration/regeneration plan is required. If Human Architect decides sealed domain contracts must change, a separate ADR must record compatibility and consumer migration.

### Risk Assessment

**High Risk:**

- E7.1, E7.2, and E7.3 are sealed/frozen.
- Naming and export changes can change public domain contracts.
- Incorrect mapper fixes can alter inventory, movement, traceability, warehouse, or freight-audit behavior.

**Medium Risk:**

- `Database.logistics` may indicate generated type/schema drift.
- `@/core/types/engine` may require shared Core contract authority.

**Low Risk Only After Approval:**

- Mapper-only translation repairs with no public contract, schema, or generated-file change.

**Risk Level:** MEDIUM after approval; remaining risk is limited to compatibility behavior at repository/adapter/rule boundaries and is covered by Logistics regression.

---

## Alternatives Considered

### Alternative 1: Generated DB Contract Is Canonical Everywhere

**Pros:**

- Aligns repository code directly with generated Supabase shapes.

**Cons:**

- Leaks persistence naming, nullability, generated relations, and `Json` shapes into sealed E7 business contracts.
- Risks weakening Logistics domain/kernel contracts.

**Why not chosen:**

Not recommended without explicit architecture approval because E7 sealed contracts are business contracts, not generated persistence contracts.

### Alternative 2: Logistics Domain/Kernel Contract Is Canonical Everywhere

**Pros:**

- Preserves sealed E7 business boundary.

**Cons:**

- Can ignore generated database evidence if applied globally.
- May tempt manual generated-type edits or persistence mismatch.

**Why not chosen as a blanket rule:**

The domain contract should be canonical for business logic, but generated DB types remain canonical at the persistence boundary.

### Alternative 3: Split Canonical Boundary With Explicit Mapper

**Pros:**

- Preserves sealed E7 business contracts.
- Preserves generated persistence truth at the DB boundary.
- Localizes translation to repository/adapter/mapper layers.
- Mirrors the governance direction already established for Healthcare ACR-2026-014.

**Cons:**

- Requires Human Architect to resolve current naming/export ownership before code changes.
- Requires careful regression because E7 is sealed.

**Why recommended for approval review:**

It separates business and persistence contracts without forcing either one to erase the other.

### Alternative 4: Do Nothing

**Impact of not making this change:**

```text
TYPECHECK_FINAL = 333
LOGISTICS_BLOCKED = 268
FULL_REPO_TYPECHECK = BLOCKED_BY_ARCHITECTURAL_FREEZE
```

---

## Verification Strategy If Approved

### Required Gates

```bash
npm run typecheck:full
npm run logistics:verify
git diff --check
```

Logistics verification is mandatory because the affected boundary is sealed E7.

### Expected Typecheck Movement

If Logistics diagnostics are resolved while Healthcare remains pending:

```text
BEFORE = 333
AFTER  = 65
DELTA  = 268

LOGISTICS  = 268 -> 0
HEALTHCARE = 65 unchanged
```

With Healthcare ACR-2026-014 also approved and implemented:

```text
FULL_REPO_TYPECHECK = PASS
TYPECHECK_ERRORS    = 0
```

This ACR alone must not claim the full repository is green while Healthcare remains blocked.

### Safety Checks

Before sealing any implementation PR:

```text
No new as any
No new @ts-ignore
No new @ts-expect-error
No new as unknown as workaround
No unusual tsconfig exclusion
No manual generated-file edit unless explicitly approved
No migration unless explicitly approved
No non-Logistics file change unless explicitly approved
```

---

## Documentation Updates

- [ ] API documentation
- [x] Architecture documentation
- [ ] Product documentation
- [ ] Migration guides
- [x] ADR required if approved

Required if approved:

```text
docs/architecture/adr/ADR-2026-015-logistics-sealed-e7-generated-db-contract-drift.md
```

---

## Timeline

**Estimated Duration After Approval:** Multiple small implementation batches in one dedicated Logistics ACR worktree.

Milestones:

1. Human Architect resolves canonical naming, generated persistence contract, sealed exports, and shared engine type ownership.
2. Create a dedicated Logistics ACR implementation worktree and branch.
3. Apply one root-cause batch at a time.
4. Run targeted typecheck/regression after each batch.
5. Run full typecheck and `npm run logistics:verify`.
6. Seal with ADR and PR evidence.

---

## Dependencies

**Depends on:**

```text
Human Architect decision for ACR-2026-015.
Explicit unlock of sealed E7 scope.
ADR-2026-015 before implementation.
```

**Blocks:**

```text
FULL_REPO_TYPECHECK = PASS
TYPECHECK_ERRORS = 0
```

**Does not block:**

```text
Healthcare ACR-2026-014 Human Architect grant.
Non-Logistics product work outside this sealed boundary.
```

---

## Rollback Plan

Runtime implementation was approved only for the scoped Logistics repository/adapter/contract-boundary fix.

If the approved implementation causes problems:

1. Revert the Logistics ACR implementation PR.
2. Keep this ACR and ADR as decision history.
3. Restore previous sealed E7 behavior.
4. Re-run `npm run logistics:verify` and `npm run typecheck:full`.

---

## Approval

### Architecture Review

**Reviewed by:** ___________
**Date:** YYYY-MM-DD
**Decision:** APPROVED | REJECTED | DEFER
**Comments:**

### Technical Lead Review

**Reviewed by:** ___________
**Date:** YYYY-MM-DD
**Decision:** APPROVED | REJECTED | DEFER
**Comments:**

---

## Implementation Tracking

**ADR Created:** [ADR-2026-015](../adr/ADR-2026-015-logistics-sealed-e7-generated-db-contract-drift.md)
**Branch:** codex/full-system-typecheck
**PR:** PENDING
**Merged:** PENDING
**Released:** PENDING

---

## ACR Logistics Decision Packet

```text
ACR LOGISTICS

Decision =
  APPROVED

Approved Decision =
  Logistics Domain/Kernel Contract is the canonical business contract.
  Generated Supabase Database types are the canonical persistence contract.
  Repository / adapter / mapper owns translation between persistence and domain.
  Sealed exports must come from explicit E7 owner files.
  Shared engine types must resolve to an approved canonical owner.

Authority =
  GRANTED.
  Runtime implementation authority is limited to the scoped Logistics repository/adapter/contract-boundary fix.

Allowed files if approved =
  19 audited Logistics files listed in this ACR.
  ACR-2026-015.
  ADR-2026-015.
  Layer 3/4 ACR resolver entries for ACR-2026-015 only.
  Focused Logistics tests only if explicitly approved.

Forbidden scope =
  Healthcare changes.
  Generated-file manual edits.
  Migrations without explicit approval.
  Shared Core changes without explicit approval.
  Kernel contract weakening.
  any / suppressions / unknown-cast workarounds.
  Unrelated refactor.

Migration/contract impact =
  No migration proposed.
  No generated-file manual edit proposed.
  Contract impact cannot be finalized until Human Architect resolves E7 naming and export ownership.

Status =
  APPROVED_FOR_SCOPED_IMPLEMENTATION
```

---

## Post-Implementation Review

**Date:** 2026-10-03

**Metrics:**

```text
Logistics diagnostics before: 268
Logistics diagnostics after: 0
Full repo diagnostics before: 333
Full repo diagnostics after: 0
Logistics guard: PASS
Logistics regression: PASS (15 suites / 547 tests)
```

**Lessons Learned:**

- The 268 diagnostics were contract/boundary drift, not independent implementation bugs.
- Keeping generated persistence types and Logistics domain/kernel contracts canonical at their own boundaries allowed the cleanup to reach zero without generated-file edits, migrations, contract weakening, or suppressions.
- The traceability and expiry rule compatibility changes preserve sealed E7 regression behavior while allowing canonical camelCase domain-facing access.
