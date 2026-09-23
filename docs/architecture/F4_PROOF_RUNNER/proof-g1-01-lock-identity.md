# Proof G1-01: Lock Key Hash Identity

## Setup
- Tenant ID: 9eb349ef-5b81-4962-9828-2a8277b80191
- Test movement ID: 15290215-5ce5-41cb-8990-577f738f956f

## Action
- Call finance_financial_lock_key(tenant, 'CASH_MOVEMENT', mvId)
- Call finance_cash_allocation_lock_key(tenant, mvId)
- Compare outputs

## Assertions
- key1 match: true
- key2 match: true
- finance_financial_lock_key output: (1049512634, 368618573)

## Verdict: PASS
