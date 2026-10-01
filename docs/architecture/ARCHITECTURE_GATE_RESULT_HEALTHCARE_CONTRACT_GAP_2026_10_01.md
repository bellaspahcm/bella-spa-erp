# Architecture Gate Result - Healthcare Contract Gap

Date: 2026-10-01
Status: PASS

## Problem / Non-goals

Resolve the Healthcare product public-contract drift identified after the governance residual boundary seal.

The current product consumers reference these public Healthcare contract surfaces:

- `src/platform/healthcare/contracts/admission-engine.contract.ts`
- `src/platform/healthcare/contracts/audit-compliance.contract.ts`
- CDS product-facing exports from `src/platform/healthcare/contracts/cds-engine.contract.ts`

Current source evidence shows:

- Admission canonical engine contract exists under `src/platform/healthcare/engines/admission-engine/contracts/admission-engine.contract.ts`.
- H11 public clinical audit contract exists as `src/platform/healthcare/contracts/clinical-audit.contract.ts`.
- H8 public CDS contract exists as `src/platform/healthcare/contracts/cds-engine.contract.ts`, but product-facing order-safety symbols are missing.

Non-goals:

- Do not modify H1-H12 Kernel engine responsibilities.
- Do not create H13 or a new Healthcare engine.
- Do not query or modify `hc_*` tables.
- Do not touch Preschool, Nail, Haircut, Finance, Logistics, or unrelated `any` cleanup.
- Do not change DB schema, RLS, migrations, runtime business workflow, or CI framework.

## Product Manifest

Affected product verticals:

```text
Bella Hospital
Bella Dental
```

Affected capabilities:

```text
Inpatient admission public contract
Bed transfer public contract
Inpatient discharge public contract
H11 audit evidence public contract
H8 order-safety public contract
H9 temporal event call shape used by Hospital bed transfer
```

## Ownership Map

```text
Patient / Encounter / CDS / Audit Evidence -> Healthcare OS Kernel H1-H12
Hospital admission workflow consumer       -> Bella Hospital Product
Dental chair procedure consumer            -> Bella Dental Product
Public contract facade                     -> Healthcare public contract layer
```

## Contract Dependency Map

```text
Bella Hospital Product
  -> Healthcare public admission contract
  -> Healthcare H9 temporal contract
  -> Healthcare public audit-compliance contract
  -> Healthcare public CDS order-safety contract

Bella Dental Product
  -> Healthcare H9 temporal contract
  -> Healthcare public audit-compliance contract
  -> Healthcare public CDS order-safety contract
```

## Change Authority

Authorized:

- Add/restore missing public contract files under `src/platform/healthcare/contracts/`.
- Add product-facing DTO/interface exports to existing CDS public contract.
- Export the restored public contracts through `src/platform/healthcare/contracts/index.ts`.
- Tighten affected product service return types if required by the public contract.
- Correct affected product-service calls to existing H9 public temporal contract when exposed by the compile probe.

Not authorized:

- Modify Healthcare Kernel engine implementations or responsibilities.
- Add compatibility aliases that are not backed by current product consumers.
- Change runtime service behavior to make tests pass.
- Edit generated types, migrations, fixtures, unrelated tests, or unrelated residual `any` files.

## UI -> Contract Reconciliation

Not applicable. No UI change.

## Additive Migration Plan

Not applicable. No DB change.

## 11 Automated Verification Gates Plan

Targeted verification:

```text
npx jest src/products/bella-hospital/services/__tests__/hospital-services.test.ts --runInBand
npx jest src/products/bella-hospital/__tests__/bella-hospital-conformance.integration.test.ts --runInBand
npx jest src/products/bella-dental/__tests__/bella-dental-conformance.integration.test.ts --runInBand
npx eslint src/platform/healthcare/contracts src/products/bella-hospital/services src/products/bella-dental/services
npm run healthcare:verify
npm run check:any-types
git diff --check
```

Full repository typecheck may remain governed by baseline comparison; do not reinterpret pre-existing unrelated diagnostics as this PR's regression.

## Decision

PASS.

Proceed with a minimal public-contract repair in the Healthcare contract layer and affected product services only.
