# Hospital Vertical Chain Investigation

## Hand-off Brief

Hospital is not starting from zero: the repo already contains a Bella Hospital product pack with inpatient admission/discharge and clinical alert services. Product identity was sealed on 2026-10-07, but current evidence still does not prove the full Hospital Foundation or Outpatient/Inpatient operational chain, because patient/facility/staff foundation, Real DB, Browser E2E, and Finance/AR/Ledger evidence are not present for Hospital as a sealed product. Implementation must stay in narrow gates and must not build new Hospital runtime on legacy direct `hc_*` table paths.

## Case Info

- Date: 2026-10-07
- Scope: Bella Hospital current code audit for domain -> contract -> DB/actions/UI/finance/E2E chain planning
- Mode: read-only investigation; no runtime code modified
- Stronghold: `src/products/bella-hospital/services/hospital-admission.service.ts` proves a product service exists and consumes Healthcare public contracts for admission, bed transfer, temporal event, audit, and evidence package.

## Problem Statement

The proposed Hospital chain is intentionally end-to-end. Before implementation, Bella governance requires proof of business truth, ownership, canonical contracts, boundaries, change authority, product manifest, additive migration scope, and verification gates. The immediate question is whether the repo currently has enough Hospital contract/model evidence to begin coding Slice 1.

## Confirmed Evidence

| Evidence | Status | Source |
| --- | --- | --- |
| Healthcare H1-H12 Kernel is frozen; products must use `Product -> Contract -> Kernel`; direct internal `hc_*` access is forbidden for verticals. | Confirmed | `docs/architecture/HEALTHCARE_VERTICAL_CODING_CONSTITUTION.md` |
| Bella Hospital product service exists for inpatient admission, bed transfer, and discharge. | Confirmed | `src/products/bella-hospital/services/hospital-admission.service.ts:77` |
| Admission service depends on public contract types, including Admission, Bed, Temporal, and Clinical Audit contracts. | Confirmed | `src/products/bella-hospital/services/hospital-admission.service.ts:77` |
| Bed transfer records a temporal event through H9 contract. | Confirmed | `src/products/bella-hospital/services/hospital-admission.service.ts:129` |
| Discharge records audit and issues evidence package through H11 contract. | Confirmed | `src/products/bella-hospital/services/hospital-admission.service.ts:191` |
| Clinical alert service routes medication safety through CDS contract and enforces ABSOLUTE_BLOCK. | Confirmed | `src/products/bella-hospital/services/hospital-clinical-alert.service.ts:57` |
| Baseline audit originally found ProductRegistry without Hospital identity; follow-up registered `bella_hospital` with `healthcare` required module, `/dashboard/hospital` default route, and `hospital` navigation profile. | Confirmed | `src/platform/registry/product-registry.ts` |
| Hospital conformance test uses Jest mocks for contracts. It is useful unit/contract-shape evidence, not Real DB or full kernel regression proof. | Confirmed | `src/products/bella-hospital/__tests__/bella-hospital-conformance.integration.test.ts:32` |
| Hospital conformance Gate 5 is `expect(true).toBe(true)`, so migration safety is not actually proven by that test. | Confirmed | `src/products/bella-hospital/__tests__/bella-hospital-conformance.integration.test.ts:217` |
| Legacy Hospital/Healthcare service paths directly access many `hc_*` tables. | Confirmed | `src/services/healthcare-hospital-services.ts:196` |
| Finance integration exists as general Finance contracts/outbox infrastructure, but no Hospital-specific service -> invoice -> payment -> AR -> ledger chain is proven. | Confirmed | `src/platform/integration-hub/finance-outbox-writer.ts`, `src/platform/finance/contracts` |

## Deduced Conclusions

1. Hospital Foundation cannot be called `PASS` yet. The repo has partial product-service evidence, but not the Foundation chain proposed by the user.
2. The first authorized implementation slice should be product identity plus minimal Foundation contract mapping, unless an explicit product registry/product manifest decision already exists elsewhere.
3. Legacy paths under `src/services/healthcare*` and `src/app/dashboard/healthcare*` are audit targets, not canonical implementation targets for a new Hospital chain.
4. Finance must be introduced through existing Finance OS public contracts or outbox semantics. Hospital-specific accounting policy, posting rules, and legal-source mapping are not proven by current Hospital code.
5. Foundation ownership map is now recorded: Admission, Bed, and Encounter are reusable through public Healthcare contracts; Patient/Profile, Department management, Doctor/Staff identity, and runtime RBAC remain blocked for contract trace.
6. Foundation contract boundary tests now pass and protect new Hospital Product implementation from direct `hc_*` table access, legacy `src/services/healthcare*` dependencies, and direct internal Healthcare Kernel imports.

## Missing Evidence

| Missing Evidence | Why It Blocks Closure | How To Obtain |
| --- | --- | --- |
| Hospital product key/manifest in Product Registry | Product identity is mandatory for tenant routing and go-live chain. | CLOSED 2026-10-07 for identity only; runtime tenant DB classification remains outside this item. |
| Facility/Department/Staff/Doctor ownership map | Slice 1 foundation depends on ownership and canonical contract. | Trace Platform org/user/staff contracts and Healthcare provider/facility contracts. |
| Patient/Profile canonical path | Patient is Kernel-owned; Product must not duplicate it. | Map patient identity contract and allowed product DTO. |
| Real DB Hospital tests | Mock contract tests do not prove runtime DB/RLS/tenant behavior. | Add Real DB tests after product identity and contract map. |
| Browser E2E route and UI trace | Current evidence does not prove Hospital UI flows. | Identify intended `/dashboard/hospital` or product route and trace data/actions. |
| Finance chain mapping | Billing/payment/AR/ledger cannot be invented. | Reuse Finance contract with a Hospital service-charge mapping gate. |
| Production readiness evidence | Go-live requires deploy/health/backup/restore and production data safety proof. | Separate operational readiness audit after full chain passes. |

## Current Status

`BLOCKED_FOR_IMPLEMENTATION` until the Hospital Foundation architecture gate is accepted as the current slice boundary. No architectural gap requiring H13 or frozen Kernel modification is proven yet; however, any new requirement that cannot be satisfied through existing public Healthcare contracts must be reported as `ARCHITECTURAL GAP DETECTED` before coding.
