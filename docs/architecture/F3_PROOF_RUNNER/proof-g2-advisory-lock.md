# Proof G2-01: Advisory Transaction Lock Concurrency

## Preconditions
- 2 receivable positions initialized at 1,000,000 each.
- 1 F2 cash movement of 1,000,000 inflow.
- 2 independent database connections active.

## Action
- Connection A requests 700,000 allocation. Advisory lock acquired.
- Connection B concurrently requests 500,000 allocation.
- Connection B blocks on Connection A's advisory lock.
- Connection A commits. Advisory lock released.
- Connection B unblocks, evaluates total allocations (700,000 + 500,000 > 1,000,000), and throws OVER_ALLOCATION.

## Expected
- Total allocations never exceed 1,000,000.
- Connection B is blocked and then rejected.
- Sum allocated is exactly 700,000.

## Observed
- Connection B blocked immediately: YES
- Connection B rejection error: OVER_ALLOCATION
- Active Allocations Count: 1
- Invoice A allocated: 700000 minor units
- Invoice B allocated: 0 minor units

## Verdict: PASS