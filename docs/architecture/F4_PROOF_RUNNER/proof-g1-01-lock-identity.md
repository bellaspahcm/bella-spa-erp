# Proof G1-01: Lock Key Hash Identity

## Setup
- Tenant ID: 6c7d9ae6-eacf-4f87-9af2-a37b284e5f30
- Test movement ID: 0c56dd17-6d7c-408e-afec-3d3c1a8bcc48

## Action
- Call finance_financial_lock_key(tenant, 'CASH_MOVEMENT', mvId)
- Call finance_cash_allocation_lock_key(tenant, mvId)
- Compare outputs

## Assertions
- key1 match: true
- key2 match: true
- finance_financial_lock_key output: (-540904126, 1046631746)

## Verdict: PASS
