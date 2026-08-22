# Proof G1-02: Resource Type Namespace Isolation

## Setup
- Same UUID: 033512c1-3dc9-4d98-97d4-c70b0e7ba04b, same tenant, different resource_type

## Action
- Compare CASH_MOVEMENT vs VENDOR_BILL key pairs for identical resource_id

## Assertions
- Namespaces distinct: true

## Verdict: PASS
