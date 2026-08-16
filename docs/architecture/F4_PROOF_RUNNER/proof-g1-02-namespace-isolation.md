# Proof G1-02: Resource Type Namespace Isolation

## Setup
- Same UUID: df2e495c-afd9-4ab8-b0b9-06c9e645e431, same tenant, different resource_type

## Action
- Compare CASH_MOVEMENT vs VENDOR_BILL key pairs for identical resource_id

## Assertions
- Namespaces distinct: true

## Verdict: PASS
