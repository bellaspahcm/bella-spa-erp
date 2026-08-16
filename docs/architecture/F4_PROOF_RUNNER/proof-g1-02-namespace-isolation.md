# Proof G1-02: Resource Type Namespace Isolation

## Setup
- Same UUID: 53128c19-0f85-44f7-a6dc-a296c01e85da, same tenant, different resource_type

## Action
- Compare CASH_MOVEMENT vs VENDOR_BILL key pairs for identical resource_id

## Assertions
- Namespaces distinct: true

## Verdict: PASS
