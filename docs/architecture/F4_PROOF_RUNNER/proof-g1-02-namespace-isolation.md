# Proof G1-02: Resource Type Namespace Isolation

## Setup
- Same UUID: 1de3fb7d-3aba-4735-b31f-c67a95381226, same tenant, different resource_type

## Action
- Compare CASH_MOVEMENT vs VENDOR_BILL key pairs for identical resource_id

## Assertions
- Namespaces distinct: true

## Verdict: PASS
