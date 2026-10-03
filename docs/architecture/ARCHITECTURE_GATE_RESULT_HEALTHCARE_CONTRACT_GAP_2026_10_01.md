# Architecture Gate Result - Healthcare Contract Gap

## Status

PASS - scope-limited Healthcare product consumer repair using canonical public contracts.

## Problem / Non-Goals

Problem: Healthcare residual `any` violations came from stale product-facing contract names and mocks in Bella Hospital, Dental, Medical, and runtime Healthcare adapters. Affected code referenced shapes such as `IAdmissionContract`, `IAuditComplianceContract`, and old CDS mocks that did not match the current canonical Healthcare public contracts.

Non-goals:

- Do not modify Healthcare H1-H12 kernel engine internals.
- Do not create H13 or new kernel engines.
- Do not query `hc_*` tables directly from product code.
- Do not invent fake public contracts or generated types.
- Do not continue broader `any-types` cleanup.
- Do not touch Nail or Preschool operational work.
- Do not change DB schema, RLS, migrations, or business workflow.

## Product Manifest

Products in scope:

- Bella Hospital.
- Bella Dental.
- Bella Medical.
- Healthcare runtime service adapters.

Capabilities in scope:

- Inpatient admission through Admission Engine public contract.
- Bed transfer through Bed Engine public contract.
- Discharge evidence through Clinical Audit public contract.
- Medication order safety through CDS public contract.
- Dental chair audit/evidence mock conformance.
- Medical consultation/order mock conformance.

Capabilities out of scope:

- Healthcare kernel implementation changes.
- Generated Supabase/RPC contract repair.
- Runtime Healthcare dashboard behavior outside the typed adapters.
- Logistics, Education, Core, Nail, Preschool.

## Ownership Map

| Data / Capability | Owner | Consumer |
| --- | --- | --- |
| Admission lifecycle | Healthcare Admission Engine | Bella Hospital product service |
| Bed allocation / transfer | Healthcare Bed Engine | Bella Hospital product service |
| Clinical safety decision | Healthcare CDS Engine H8 | Hospital alert service |
| Audit / evidence package | Healthcare Clinical Audit H11 | Hospital, Dental, Medical consumers |
| Temporal transfer event | Healthcare Temporal Engine H9 | Hospital and Dental consumers |

## Contract Dependency Map

```text
Bella Hospital Product
  -> AdmissionEngineContract.createAdmission / dischargeAdmission
  -> BedEngineContract.transferBed
  -> CdsEngineContract.generateCdsSummary
  -> IClinicalAuditContract.recordAuditEntry / issueEvidencePackage
  -> ITemporalContract.recordTemporalEvent
  -> Frozen Healthcare Kernel H1-H12

Bella Dental Product
  -> ITemporalContract.recordTemporalEvent
  -> IClinicalAuditContract.recordAuditEntry / issueEvidencePackage
  -> CdsEngineContract.generateCdsSummary
  -> Frozen Healthcare Kernel H1-H12

Bella Medical Product
  -> Encounter / Order / Laboratory public engine contracts
  -> ITemporalContract / IClinicalAuditContract test doubles
  -> Frozen Healthcare Kernel H1-H12
```

## Change Authority

Authorized layers:

- Healthcare product service consumers.
- Healthcare product tests and runtime fallback mocks.
- Public contract re-export of the existing canonical Admission Engine contract.
- Documentation evidence for this workstream.

Not authorized:

- Healthcare kernel engine internals.
- Database migrations.
- Public contract invention.
- Generated Supabase/RPC type invention.
- Core, Logistics, Education, Nail, Preschool.

## UI -> Contract Reconciliation

No UI redesign or new UI-bound field/action is in scope.

## Additive Migration Plan

No database migration.

## 11 Automated Verification Gates Plan

Focused verification:

- Bella Hospital service Jest.
- Bella Hospital conformance Jest.
- Bella Dental conformance Jest.
- Bella Medical conformance Jest.
- Targeted ESLint for touched Healthcare product/service files.
- `npm run healthcare:guard`.
- `npx tsc --project tsconfig.healthcare.json --noEmit --pretty false`.
- `npm run check:any-types` as expected residual count evidence, not as a pass target.
- `git diff --check`.

## Gate Conclusion

PASS for minimal consumer repair using existing canonical public contracts.

DEFER residuals requiring generated Supabase/RPC contracts, Healthcare kernel changes, frozen boundaries, or runtime behavior changes.
