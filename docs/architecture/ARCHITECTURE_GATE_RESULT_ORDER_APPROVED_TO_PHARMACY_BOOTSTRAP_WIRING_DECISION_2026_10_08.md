# Architecture Gate Result: Order Approved to Pharmacy Bootstrap Wiring Decision

Date: 2026-10-08

## Status

```text
ORDER_APPROVED_TO_PHARMACY_BOOTSTRAP_WIRING_DECISION_TRACE = PASS
ORDER_APPROVED_TO_PHARMACY_BOOTSTRAP_WIRING_IMPLEMENTATION = PASS
HOSPITAL_MEDICATION_PHARMACY_MAR_REAL_DB_PROOF = PASS
GO_LIVE_DECISION = NO
```

## Trigger

After the approved CDS persistence fix, the Hospital Real DB / RLS proof reached Medication / Pharmacy / MAR and failed at prescription lookup:

```text
PRESCRIPTION_NOT_FOUND: Prescription not found for order <orderId>
```

Observed runtime event output:

```text
[EventBus] No handlers for event: hos.order.approved.v1
```

## Ownership Map

```text
Medication order approval = Healthcare OS / Order Engine
Prescription bootstrap = Healthcare OS / Pharmacy Engine
Cross-engine event wiring = Healthcare OS / host event bus composition
Hospital product = consumer only
```

## Dependency Map

```text
Hospital Medication service
  -> public OrderEngineContract.createOrder(MEDICATION)
  -> public OrderEngineContract.approveOrder()
  -> host event bus publishes hos.order.approved.v1
  -> Pharmacy prescription bootstrap must consume approved medication order
  -> public PharmacyEngineContract fulfillment/MAR path
```

## Existing Capability Trace

Order Engine default runtime publishes:

```text
hos.order.approved.v1
```

from `OrderEngineService.approveOrder()`.

Pharmacy already has a prescription bootstrap subscriber:

```text
OrderApprovedSubscriber
  listens to legacy/internal OrderApproved
  reads clinical order snapshot
  filters MEDICATION
  creates prescription idempotently
```

Existing host event wirings do not include Order Approved to Pharmacy:

```text
wireBedToBilling()
wireMedicationToTimeline()
wireVitalsToAIAlerts()
```

Therefore the current default Real DB runtime path has:

```text
Order approval persisted
  -> hos.order.approved.v1 published
  -> no host handler
  -> no Pharmacy prescription bootstrap
  -> PRESCRIPTION_NOT_FOUND
```

## Root Cause

```text
ORDER_APPROVED_TO_PHARMACY_PRESCRIPTION_BOOTSTRAP_HOST_EVENT_WIRING = MISSING
```

This is not a Hospital product code issue and must not be worked around by direct Hospital access to Pharmacy repositories or `hc_*` tables.

## Boundary

Do not fix by:

```text
Hospital -> Pharmacy repository
Hospital -> hc_prescriptions
Hospital -> direct DB prescription insert
Hospital-specific pharmacy engine fork
bypassing OrderApproved event semantics
```

Potential minimal fix after approval:

```text
hos.order.approved.v1
  -> existing Pharmacy prescription bootstrap semantics
  -> idempotent prescription creation for MEDICATION orders
```

The implementation decision must preserve:

```text
existing public OrderEngineContract
existing public PharmacyEngineContract
existing Pharmacy domain semantics
event-after-persistence
tenant isolation
idempotency
```

## Implementation

The minimal implementation is composition-root wiring only:

```text
hos.order.approved.v1
  -> existing Pharmacy OrderApprovedSubscriber
  -> existing Pharmacy repository / clinical order reader
  -> idempotent prescription bootstrap for MEDICATION orders
```

Files:

```text
src/platform/healthcare/wiring/order-approved-to-pharmacy.wiring.ts
src/platform/healthcare/service-locator.ts
src/platform/healthcare/engines/order-engine/order-engine.service.ts
```

No Hospital workaround was introduced.

## Verification

```text
npx jest src/products/bella-hospital/services/__tests__/hospital-real-db-rls-proof.test.ts --runInBand
= PASS
```

Runtime evidence:

```text
hos.order.approved.v1
  -> OrderApprovedSubscriber
  -> Successfully bootstrapped prescription
  -> Pharmacy verification
  -> Dispense
  -> MAR
```

## Canonical Output

```text
ORDER_APPROVED_TO_PHARMACY_BOOTSTRAP_WIRING_DECISION_TRACE = PASS
ORDER_APPROVED_TO_PHARMACY_BOOTSTRAP_WIRING_IMPLEMENTATION = PASS
OWNER = HEALTHCARE OS / ORDER-PHARMACY EVENT WIRING
HOSPITAL_CODE_FIX = NOT_INDICATED
PUBLIC_CONTRACT_CHANGE_REQUIRED = NOT_PROVEN
SCHEMA_CHANGE_REQUIRED = NOT_PROVEN

HOSPITAL_MEDICATION_PHARMACY_MAR_REAL_DB_PROOF = PASS
GO_LIVE_DECISION = NO
```

## Next Required Capability

```text
HOSPITAL_BROWSER_E2E_PROOF
```
