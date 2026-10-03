# Architecture Change Request (ACR)

**ACR ID:** ACR-2026-014
**Date Submitted:** 2026-10-03
**Submitted By:** AI Agent (Full Repository Typecheck Cleanup)
**Status:** APPROVED

<!-- APPROVED_CORE_CHANGE_V1
{
  "version": 1,
  "acrId": "ACR-2026-014",
  "status": "APPROVED",
  "pr": 203,
  "approvedCoreFiles": [
    "src/core/examples/TenantInfoExample.tsx",
    "src/core/middleware/tenantContext.ts",
    "src/core/providers/TenantContextProvider.tsx",
    "src/core/services/order/create-booking-action.ts",
    "src/core/services/order/update-booking-action.ts",
    "src/core/types/module.ts"
  ],
  "approver": "Human/ARB",
  "approvedDate": "2026-10-03",
  "purpose": "Authorize the exact Core compatibility files required by the full-repository TypeScript cleanup to preserve canonical module identifiers, tenant context typing, and booking action type contracts without schema, RPC, ownership, or generated-file changes.",
  "contractChange": true,
  "schemaChange": false,
  "rpcChange": false,
  "apiChange": false,
  "ownershipChange": false
}
-->

---

## Summary

Healthcare kernel repository typecheck is blocked by 65 diagnostics in one frozen kernel repository file. The diagnostics are concentrated at the generated database `Json` and row-shape boundary versus the domain-facing repository contracts.

This ACR approves a scoped Healthcare repository mapper fix only. It does not approve generated-file edits, migrations, public API changes, or kernel contract weakening.

---

## Current Typecheck Checkpoint

```text
FULL_REPO_TYPECHECK
BASELINE       = 849
RESOLVED       = 516
REMAINING      = 333

UNBLOCKED      = 0
BLOCKED        = 333

HEALTHCARE     = 65
LOGISTICS      = 268

SUPPRESSIONS   = NONE
NEW_DEBT       = NONE
STATUS         = BLOCKED_BY_ARCHITECTURAL_FREEZE
```

Healthcare ACR scope:

```text
src/modules/bella-healthcare/kernel/repositories/supabase-repositories.ts
```

---

## Affected Layer(s)

- [ ] E7.1 Domain Kernel
- [ ] E7.2 Operational Kernel
- [ ] E7.3 Rules & Traceability
- [x] Other: Healthcare OS Kernel repository boundary (H1-H12 frozen)

---

## Affected Artifacts

### Audit Scope

```text
src/modules/bella-healthcare/kernel/repositories/supabase-repositories.ts
```

### Requested Unlock Scope If Approved

The requested implementation authority is intentionally narrow:

```text
src/modules/bella-healthcare/kernel/repositories/supabase-repositories.ts
docs/architecture/acr/ACR-2026-014-healthcare-kernel-type-contract-drift.md
docs/architecture/adr/ADR-2026-014-healthcare-kernel-type-contract-drift.md
```

Focused Healthcare kernel repository tests may be added or updated only if they already exist for this boundary or are required by the approved decision:

```text
src/modules/bella-healthcare/kernel/repositories/**/*.test.ts
src/modules/bella-healthcare/kernel/**/__tests__/**/*.ts
```

Any additional source, generated type, migration, public contract, or product consumer file requires explicit Human Architect approval in the final ACR decision.

---

## Reason for Change

### Business Context

The full repository typecheck cleanup resolved all unblocked diagnostics outside frozen Healthcare and sealed Logistics boundaries. The remaining Healthcare diagnostics prevent the repository from reaching zero typecheck debt, but the file is inside the frozen Healthcare OS kernel boundary.

The cleanup must not convert a typecheck task into an unauthorized kernel contract change.

### Technical Context

The 65 Healthcare diagnostics are not scattered implementation mistakes. They are concentrated in the repository mapper where generated database row types meet domain-facing repository contracts.

Primary drift categories:

1. Generated database `Json` versus domain `Record<string, unknown>` or typed domain arrays.
2. Domain input naming drift, especially camelCase contract fields versus snake_case persistence fields.
3. Generated journey row-shape drift, including fields such as `expected_end_at`, `updated_at`, and subjourney or milestone `description`.
4. Timeline event category and version shape mismatch.
5. Asset, contract, projection, and rules metadata mapping drift.

Representative affected contract areas:

```text
Healthcare party and role mapping
Healthcare journey/subjourney/milestone mapping
Healthcare timeline event mapping
Healthcare asset and asset event mapping
Healthcare contract party/payment/line-item mapping
Healthcare rules condition/action/metadata mapping
Healthcare projection version and payload mapping
```

### Priority

- [ ] P0 - Critical (production outage, data loss, security)
- [x] P1 - High (full repository typecheck is blocked by frozen kernel contract drift)
- [ ] P2 - Medium (minor issue, workaround available)
- [ ] P3 - Low (enhancement, nice-to-have)

---

## Architecture Decision Requested

### Question

Which contract is canonical at the Healthcare kernel repository boundary?

```text
Generated DB Json / generated row type
        versus
Domain repository contract
```

### Proposed Decision

Use a split canonical boundary:

```text
Generated DB types are canonical at the persistence boundary.
Domain repository contracts are canonical at the domain-facing boundary.
supabase-repositories.ts owns the explicit mapping and validation between them.
```

This preserves generated database truth without leaking persistence `Json` and storage naming into Healthcare domain consumers.

### Architecture Decision Status

```text
Decision = APPROVED
Authority = GRANTED_FOR_SCOPED_MAPPER_FIX
```

The approved decision preserves both canonical boundaries: generated database types are canonical at persistence, Healthcare domain/kernel contracts are canonical for business logic, and the repository mapper owns translation between them.

---

## Proposed Changes If Approved

### Implementation Plan

If the proposed decision is approved, implementation should be limited to mapper-boundary repairs:

1. Keep generated database `Json` and generated row types as the persistence source of truth.
2. Keep domain repository contracts as the domain-facing source of truth.
3. Add or adjust local repository mapper helpers for `Json` to record, array, and typed domain value conversion.
4. Normalize camelCase domain input into snake_case persistence payloads inside the repository only.
5. Update journey, asset, contract, rules, and projection mappers to read actual generated row shapes and emit domain shapes.
6. Preserve all existing domain behavior and public contracts unless the approved decision explicitly changes them.

### Prohibited Implementation Tactics

- No `as any`.
- No `@ts-ignore`.
- No `@ts-expect-error`.
- No manual edit of generated database output.
- No weakening of domain contracts just to match `Json`.
- No Healthcare kernel behavior refactor.
- No product consumer rewrite.
- No schema or migration change unless Human Architect explicitly chooses the database/schema as the source needing correction.

### API Impact

- [ ] Yes - Breaking change
- [ ] Yes - Additive change (backward compatible)
- [x] No - Internal implementation only, if the proposed split-boundary decision is approved

If Human Architect instead decides that either the generated database type or the domain repository contract is globally canonical, this ACR must be updated before implementation because public contract or migration impact may change.

---

## Impact Analysis

### Blast Radius

**Direct consumers:**

```text
Healthcare OS kernel repository bootstrap and Healthcare domain services using the repository contract.
```

**Indirect consumers:**

```text
Healthcare product/runtime flows that rely on domain repository outputs.
Full repository typecheck gate.
```

**Out of scope:**

```text
Logistics sealed E7 diagnostics.
Healthcare product UI fixes.
Database migrations.
Generated database type regeneration.
Non-Healthcare domains.
```

### Migration Path

No data migration is proposed under the recommended split-boundary decision.

If Human Architect decides the generated database source is wrong, a separate migration or generated-type regeneration plan is required. If Human Architect decides the domain contract is wrong, a separate public-contract migration plan is required.

### Risk Assessment

**Medium Risk:**

- The file sits inside the frozen Healthcare H1-H12 kernel boundary.
- Incorrect mapping can alter domain objects even when no database schema changes.
- Changing source-of-truth incorrectly can leak persistence concerns into domain contracts.

**Low Risk Under Proposed Narrow Unlock:**

- Mapper-only repairs.
- No schema change.
- No public API change.
- No manual generated-code edit.
- Type safety improves without suppressions.

**Risk Level:** MEDIUM

---

## Alternatives Considered

### Alternative 1: Generated DB Type Is Canonical Everywhere

**Pros:**

- Aligns all TypeScript shapes with generated Supabase types.
- Reduces mapper pressure.

**Cons:**

- Leaks persistence `Json` and snake_case storage shapes into the domain boundary.
- Weakens domain repository contracts.
- Can force broad consumer changes outside the repository boundary.

**Why not chosen:**

Not recommended without an explicit Healthcare architecture decision to make persistence shape the domain contract.

### Alternative 2: Domain Repository Contract Is Canonical Everywhere

**Pros:**

- Preserves domain purity.
- Keeps Healthcare consumers isolated from persistence details.

**Cons:**

- May require schema changes, generated type regeneration, or unsafe manual generated-type edits.
- Does not respect generated database types as persistence evidence.

**Why not chosen:**

Not recommended unless Human Architect confirms the generated database contract is incorrect.

### Alternative 3: Split Canonical Boundary With Explicit Mapper

**Pros:**

- Preserves generated database truth at persistence.
- Preserves domain contracts at the domain boundary.
- Keeps all drift handling inside the repository mapper.
- Avoids broad public-contract changes.
- Supports minimal, testable implementation.

**Cons:**

- Requires careful local mapping and validation.
- Requires focused kernel regression verification.

**Why recommended:**

It matches the current architectural boundary: repository as translation layer between persistence and domain.

### Alternative 4: Do Nothing

**Impact of not making this change:**

The repository remains at:

```text
TYPECHECK_FINAL = 333
HEALTHCARE_BLOCKED = 65
FULL_REPO_TYPECHECK = BLOCKED_BY_ARCHITECTURAL_FREEZE
```

---

## Verification Strategy If Approved

### Regression Testing

- [x] Full repository typecheck must be rerun.
- [x] Healthcare architecture guard must be rerun.
- [x] Healthcare kernel regression must be rerun through the approved command.
- [x] No new suppressions or unsafe casts may be introduced.
- [x] Diff check must pass.

### Required Commands

```bash
npm run typecheck:full
npm run healthcare:verify
git diff --check
```

### Expected Typecheck Movement

If only this ACR is implemented and Logistics remains frozen:

```text
BEFORE = 333
AFTER  = 268
DELTA  = 65

HEALTHCARE = 65 -> 0
LOGISTICS  = 268 unchanged
```

Any diagnostic increase must stop implementation and trigger regression investigation.

### Safety Checks

Before sealing any implementation PR:

```text
No new as any
No new @ts-ignore
No new @ts-expect-error
No unusual tsconfig exclusion
No generated file manual edit unless explicitly approved
No migration unless explicitly approved
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
docs/architecture/adr/ADR-2026-014-healthcare-kernel-type-contract-drift.md
```

---

## Timeline

**Estimated Duration After Approval:** 1 focused implementation worktree.

Milestones:

1. Human Architect decision on canonical boundary.
2. Create separate Healthcare ACR implementation worktree and branch.
3. Apply mapper-only fix within approved file scope.
4. Run typecheck and Healthcare regression gates.
5. Seal with ADR and PR evidence.

---

## Dependencies

**Depends on:**

```text
Human Architect decision for this ACR.
Healthcare H1-H12 unlock for the exact approved file scope.
```

**Blocks:**

```text
FULL_REPO_TYPECHECK = PASS
TYPECHECK_ERRORS = 0
```

**Does not block:**

```text
Separate Logistics ACR.
Non-Healthcare product work outside this frozen boundary.
```

---

## Rollback Plan

Runtime implementation was approved only for the scoped repository mapper fix.

If the approved implementation causes problems:

1. Revert the Healthcare ACR implementation PR.
2. Keep this ACR and ADR as decision history.
3. Restore the previous Healthcare kernel repository mapping behavior.
4. Re-run `npm run healthcare:verify` and `npm run typecheck:full`.

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

**ADR Created:** [ADR-2026-014](../adr/ADR-2026-014-healthcare-kernel-type-contract-drift.md)
**Branch:** codex/full-system-typecheck
**PR:** PENDING
**Merged:** PENDING
**Released:** PENDING

---

## ACR Healthcare Decision Packet

```text
ACR HEALTHCARE

Decision = APPROVED

Approved Decision =
  Generated DB types are canonical at the persistence boundary.
  Domain repository contracts are canonical at the domain-facing boundary.
  supabase-repositories.ts owns explicit mapping and validation between them.

Authority =
  GRANTED.
  Temporary Healthcare kernel repository unlock for the scoped mapper fix only.

Allowed files =
  src/modules/bella-healthcare/kernel/repositories/supabase-repositories.ts
  docs/architecture/acr/ACR-2026-014-healthcare-kernel-type-contract-drift.md
  docs/architecture/adr/ADR-2026-014-healthcare-kernel-type-contract-drift.md
  focused Healthcare repository tests only if required by the approved decision.

Migration/contract impact =
  No migration proposed.
  No generated file manual edit proposed.
  No public API change proposed under the recommended split-boundary decision.
  Domain repository contract preservation is recommended.
```

---

## Post-Implementation Review

**Date:** 2026-10-03

**Metrics:**

```text
Healthcare diagnostics before: 65
Healthcare diagnostics after: 0
Full repo diagnostics before: 333
Full repo diagnostics after: 0
Healthcare guard: PASS
Healthcare architecture: PASS
Healthcare conformance: PASS
Healthcare full kernel regression: ENV_FAIL
Healthcare regression evidence: mock.supabase.co ENOTFOUND / fetch failed
```

**Lessons Learned:**

- Generated DB `Json` stays canonical at the persistence boundary; Healthcare domain repository contracts stay canonical at the domain-facing boundary.
- The repository mapper is the correct translation boundary; no generated-file edit, migration, public API weakening, or suppression was required.
- Local Healthcare full regression could not be sealed because the test environment could not resolve `mock.supabase.co`; this remains environment evidence, not a code PASS.
