# Proof G1-01: Lock Key Hash Identity

## Setup
- Tenant ID: ad901081-7116-4092-afe0-78268310315c
- Test movement ID: 6e3b6511-49c8-4912-9127-3525cb129501

## Action
- Call finance_financial_lock_key(tenant, 'CASH_MOVEMENT', mvId)
- Call finance_cash_allocation_lock_key(tenant, mvId)
- Compare outputs

## Assertions
- key1 match: true
- key2 match: true
- finance_financial_lock_key output: (-262503958, 1104566316)

## Verdict: PASS
