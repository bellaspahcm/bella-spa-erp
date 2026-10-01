# Architecture Gate Result - Healthcare Residual Contract Mocks

## Status

PASS for Dental chair service/test/runtime adapter and Medical conformance test mock typing.

DEFER for Healthcare DB/RPC generated-contract residuals in `src/services/healthcare/healthcare-actions.ts`.

## Scope

Repair remaining Healthcare residual `any` instances that are proven to be stale test/runtime contract mocks:

- Bella Dental conformance mocks.
- Dental chair runtime fallback adapter.
- Bella Medical conformance mocks.

Out of scope:

- `healthcare-actions.ts` RPC/generated table casts.
- Healthcare kernel H1-H12 implementation.
- Database migrations.
- New public contracts.
- Nail, Preschool, Logistics, Education, Core.

## Truth / Source Of Truth / Canonical Contract

| Area | Canonical source |
| --- | --- |
| H9 Temporal | `src/platform/healthcare/contracts/temporal-engine.contract.ts` |
| H11 Clinical Audit | `src/platform/healthcare/contracts/clinical-audit.contract.ts` |
| H8 CDS | `src/platform/healthcare/contracts/cds-engine.contract.ts` |
| Encounter / Order / Laboratory mocks | existing Medical product service constructor contracts |

## Ownership

Dental and Medical product tests own their test doubles. Healthcare public contracts own the boundary shape. Product tests must model those boundaries without `any`.

## Change Authority

Authorized:

- Product service consumer mapping where current imports point to obsolete contract names.
- Product test mocks and dev fallback adapters.

Not authorized:

- H1-H12 kernel engine internals.
- DB schema, generated DB types, RPC contracts.

## Verification Plan

- Dental conformance Jest.
- Medical conformance Jest.
- Targeted ESLint for touched files.
- `npm run healthcare:verify`.
- `npm run check:any-types` as residual inventory evidence.
- `git diff --check`.

## Gate Conclusion

PASS for the mock/adapter repair above. Stop if any change requires schema/RPC/generated contract decisions.
