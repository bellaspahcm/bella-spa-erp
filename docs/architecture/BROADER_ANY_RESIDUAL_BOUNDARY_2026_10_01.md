# Broader Any Residual Boundary

Date: 2026-10-01
Status: STOPPED AT GOVERNANCE / CONTRACT BOUNDARY

## Current Baseline

Official sealed baseline after C60 hold resolution:

```text
128 violations / 30 files
```

Raw scanner output:

```text
128 violations / 30 files
```

The official baseline now matches the raw scanner output. C60 is sealed and no longer contributes a hold delta.

## Sealed Batches In This Segment

```text
C70  Finance F2 reconstruction dynamic RPC row guard     -1 / -1
C71  Finance kernel-client local request typing           -3 / -1
C72  Education facilities maintenance repository boundary -6 / -1
C73  Education scheduling leave repository boundary       -3 / -1
C60  Finance F3 proof-runner fixture hold resolution      -2 / -1
```

## Residual Classification

Raw residual:

```text
128 violations / 30 files
```

Classification:

```text
69 Logistics frozen/domain/rules kernel
37 Healthcare product/kernel contract gaps
 6 Education kernel frozen tests
 6 Education facilities projection contract gap
 4 Customer intelligence generated view/runtime boundary
 3 Real Estate generated schema/status contract drift
 2 Finance F1 baseline/test contract boundary
 1 Core-adjacent order pricing test
```

Official residual matches raw residual:

```text
128 violations / 30 files
```

## Boundary Evidence

### Logistics

`src/platform/logistics/**` remains frozen under E7.1/E7.2/E7.3. Do not modify without ACR / Human Architect approval.

### Healthcare

Healthcare product/test mocks are not currently safe type-local cleanup. Several consumers reference stale or missing public contract symbols such as `audit-compliance.contract` / `IAuditComplianceContract` / `ICdsContract`. Do not create fake interfaces to reduce `any`.

### Education Kernel

`src/platform/education/**` is frozen by the Education Constitution. Do not touch kernel tests without explicit architecture authority.

### Education Facilities Projection

`FacilitiesProjectionBridge` uses `FACILITY_MANAGER` and `SAFETY_OFFICER` work-queue roles, while the current Parent Communication exception contract allows only `TEACHER | NURSE | PRINCIPAL | ADMIN`. This is a product contract gap, not a local type cleanup.

### Real Estate

`re_reservations.status` generated enum is:

```text
active | released | expired | converted
```

The reservation release code/test currently uses or expects `cancelled`. That is contract drift; do not hide it with casts.

`real_estate_products.unit_code` remains a generated schema/type gap relative to the consumer fallback.

### Customer Intelligence

Materialized views used by tests are not in generated database types, and the invalid risk-level negative test intentionally crosses a typed union boundary. Do not force a fake type.

### Finance F1

Finance F1 verification has a known unrelated baseline boundary. Do not collapse that contract question into automatic cleanup.

## Decision

No further automatic `any` cleanup should continue from this point without one of:

```text
1. ACR / approval for frozen Logistics or Education kernel files
2. approved Healthcare public contract repair
3. approved Real Estate contract decision for reservation status and unit_code
4. approved Parent Communication work-queue role contract extension
5. explicit Core change authority
6. Finance F1 baseline resolution
```

Current campaign state:

```text
ANY-TYPES CAMPAIGN = STOPPED
Last sealed batch  = C60 hold resolution
Official baseline  = 128 / 30
Raw scanner count  = 128 / 30
Commit             = NO
```

