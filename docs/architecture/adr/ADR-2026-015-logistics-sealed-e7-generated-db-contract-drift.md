# ADR-2026-015: Logistics Sealed E7 Generated DB Contract Drift

**Date:** 2026-10-03
**Status:** APPROVED
**Related ACR:** [ACR-2026-015](../acr/ACR-2026-015-logistics-sealed-e7-generated-db-contract-drift.md)

---

## Context

Full repository typecheck cleanup left 268 Logistics diagnostics across 19 files in the sealed E7 boundary.

The diagnostics were concentrated in:

```text
snake/camel contract drift
type/null/value-object mismatch
unresolved contract surface
missing sealed exports
missing generated Database.logistics namespace
missing shared engine type import
implicit-any cascades
```

Logistics E7 remains sealed. This decision grants only a temporary, scoped boundary repair.

---

## Decision

```text
Logistics Domain/Kernel Contract =
  canonical business contract.

Generated Supabase Database types =
  canonical persistence contract.

Repository / Adapter / Mapper =
  authorized translation boundary.

Sealed exports =
  explicit owner files are the canonical export source.

Shared engine types =
  resolve to an approved canonical owner before use.
```

Snake/camel conversion and null/value-object conversion belong at approved boundaries. Generated database types must not be edited manually.

---

## Authorized Scope

Allowed implementation files are the 19 audited Logistics files listed in ACR-2026-015, plus this ADR and ACR.

Layer 3 and Layer 4 guard scripts may be updated only to recognize ACR-2026-015 in the existing ACR authorization resolver. The frozen file list and enforcement behavior must not be weakened.

Focused Logistics tests may be added or updated only where required by the boundary fix.

---

## Constraints

- No generated-file manual edits.
- No migration.
- No public API redesign.
- No kernel contract weakening.
- No `as any`.
- No `@ts-ignore`.
- No `@ts-expect-error`.
- No `as unknown as` workaround.
- No unrelated refactor.
- No Healthcare changes.
- No architecture-guard weakening or frozen-list removal.

---

## Consequences

Implementation outcome:

```text
Logistics diagnostics: 268 -> 0
Full repo diagnostics: 268 -> 0
Logistics guard: PASS
Logistics regression: PASS (15 suites / 547 tests)
```

Healthcare ACR-2026-014 is a separate decision and implementation scope.
