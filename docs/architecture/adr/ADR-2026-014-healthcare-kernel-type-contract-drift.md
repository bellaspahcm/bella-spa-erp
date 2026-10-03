# ADR-2026-014: Healthcare Kernel Type Contract Drift

**Date:** 2026-10-03
**Status:** APPROVED
**Related ACR:** [ACR-2026-014](../acr/ACR-2026-014-healthcare-kernel-type-contract-drift.md)

---

## Context

Full repository typecheck cleanup left 65 Healthcare diagnostics in:

```text
src/modules/bella-healthcare/kernel/repositories/supabase-repositories.ts
```

The diagnostics were concentrated at the boundary between generated Supabase database types and Healthcare domain/kernel repository contracts.

Healthcare H1-H12 remains frozen. This decision grants only a temporary, scoped repository mapper unlock.

---

## Decision

```text
Healthcare Domain/Kernel Contract =
  canonical business contract.

Generated Supabase Database types =
  canonical persistence contract.

Repository Mapper / Adapter =
  authorized translation boundary.
```

The repository mapper may translate:

```text
Database Json / row shape
        -> Healthcare domain contract

Healthcare domain input
        -> Database Json / row shape
```

---

## Authorized Scope

Allowed implementation files:

```text
src/modules/bella-healthcare/kernel/repositories/supabase-repositories.ts
docs/architecture/acr/ACR-2026-014-healthcare-kernel-type-contract-drift.md
docs/architecture/adr/ADR-2026-014-healthcare-kernel-type-contract-drift.md
```

Focused Healthcare repository/kernel tests may be added only if required by the mapper fix.

---

## Constraints

- No generated-file manual edits.
- No migration.
- No public API change.
- No Healthcare kernel contract weakening.
- No `as any`.
- No `@ts-ignore`.
- No `@ts-expect-error`.
- No `as unknown as` workaround.
- No unrelated refactor.
- No Logistics changes.

---

## Consequences

The Healthcare repository mapper is responsible for explicit JSON conversion, nullability normalization, row-shape normalization, and domain typed value reconstruction.

Implementation outcome:

```text
Healthcare diagnostics: 65 -> 0
Full repo diagnostics after Healthcare batch: 333 -> 268
```

Logistics is governed separately by ACR-2026-015 / ADR-2026-015.

Healthcare verification:

```text
Healthcare guard: PASS
Healthcare architecture: PASS
Healthcare conformance: PASS
Healthcare full kernel regression: ENV_FAIL (mock.supabase.co ENOTFOUND / fetch failed)
```
