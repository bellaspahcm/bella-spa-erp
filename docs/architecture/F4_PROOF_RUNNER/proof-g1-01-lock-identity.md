# Proof G1-01: Lock Key Hash Identity

## Setup
- Tenant ID: 00e15ca5-1a95-4751-b4a7-39b85e28131b
- Test movement ID: b31b6288-a661-4aee-b432-8d6e17cf1907

## Action
- Call finance_financial_lock_key(tenant, 'CASH_MOVEMENT', mvId)
- Call finance_cash_allocation_lock_key(tenant, mvId)
- Compare outputs

## Assertions
- key1 match: true
- key2 match: true
- finance_financial_lock_key output: (-1212360777, 729163130)

## Verdict: PASS
