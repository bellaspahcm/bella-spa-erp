---
title: 'Harden CFO Agent Reconciliation RPC'
type: 'bugfix'
created: '2026-06-03'
status: 'done'
baseline_commit: 'a03487fada353f43ba8606a1b167af2bee0b95fa'
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/docs/index.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** CFO agent da throw khi RPC reconciliation bao loi, nhung path reconciliation mac dinh van co the coi response sai shape la danh sach rong vi dung `(data || [])`. Neu RPC tra object/null bat thuong nhung khong set `error`, AI co the bao "khong co chenh lech" dua tren du lieu nen that bai.

**Approach:** Giu public `runCFOAgent` API va routing hien co, nhung validate reconciliation RPC data phai la array truoc khi tong hop. Empty array la hop le; non-array/null la failure ro. Bo sung regression tests truc tiep cho CFO agent.

## Boundaries & Constraints

**Always:** RPC `error` phai throw. Reconciliation data sai shape phai throw. Empty reconciliation array van hop le va khong tao draft proposal. MAJOR_DIFF row phai tao draft proposal `reconciliation_audit`.

**Ask First:** Thay doi schema RPC, output contract cua orchestrator API, Gemini prompt, hoac luong ghi `ai_agent_logs`.

**Never:** Khong fallback ve `[]` khi reconciliation RPC tra shape bat thuong. Khong thay doi behavior cua trial balance, income statement, cash flow, P&L trong slice nay.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| RPC error | `get_reconciliation_report` returns error | CFO agent throws | Orchestrator can return 500 |
| Empty valid report | RPC returns `[]` | Success summary says 0 major diffs; no draft proposals | No error |
| Major diff report | RPC returns row with `status = MAJOR_DIFF` | Success with one `reconciliation_audit` draft proposal | No error |
| Invalid report shape | RPC returns object/null without error | CFO agent throws explicit invalid-shape error | No silent empty report |

</frozen-after-approval>

## Code Map

- `src/services/ai/agents/cfo.ts` -- CFO sub-agent report selection and reconciliation summary/proposal logic.
- `src/__tests__/cfo-agent.test.ts` -- New focused tests for CFO reconciliation edge cases.

## Tasks & Acceptance

**Execution:**
- [x] `src/services/ai/agents/cfo.ts` -- validate reconciliation RPC data shape before summary/proposal generation.
- [x] `src/__tests__/cfo-agent.test.ts` -- cover RPC error, empty valid report, major diff proposal, and invalid shape.
- [x] `docs/DEVELOPMENT_LOG.md` -- append verification entry after checks pass.

**Acceptance Criteria:**
- Given `get_reconciliation_report` returns `error`, when CFO agent runs, then it throws that error.
- Given reconciliation RPC returns non-array data without `error`, when CFO agent runs, then it throws an invalid-shape error.
- Given reconciliation RPC returns `[]`, when CFO agent runs, then it succeeds with 0 major differences and no draft proposals.

## Verification

**Commands:**
- `npm.cmd test -- src/__tests__/cfo-agent.test.ts --runInBand` -- pass, 4/4 tests.
- `npx.cmd tsc --noEmit --incremental false` -- pass.
- `npx.cmd eslint src/services/ai/agents/cfo.ts src/__tests__/cfo-agent.test.ts` -- pass.
- `npm.cmd test -- --runInBand` -- pass, 66 suites / 722 tests.
- `npm.cmd run build` -- pass.

## Review Notes

- Local diff review found no patch findings in scope: only reconciliation report shape is hardened; other CFO report branches are unchanged.
- BMad parallel sub-agent review was not spawned because this runtime only permits sub-agents when the user explicitly requests agent delegation.

## Suggested Review Order

**CFO Reconciliation Guard**

- Validate reconciliation RPC payloads before treating them as rows.
  [`cfo.ts:7`](../../src/services/ai/agents/cfo.ts#L7)

- Store only validated reconciliation rows as report data.
  [`cfo.ts:88`](../../src/services/ai/agents/cfo.ts#L88)

- Reuse the same guard before major-difference proposal logic.
  [`cfo.ts:94`](../../src/services/ai/agents/cfo.ts#L94)

**Regression Coverage**

- RPC error still propagates immediately.
  [`cfo-agent.test.ts:33`](../../src/__tests__/cfo-agent.test.ts#L33)

- Empty array remains valid and produces no proposal.
  [`cfo-agent.test.ts:49`](../../src/__tests__/cfo-agent.test.ts#L49)

- MAJOR_DIFF still creates a reconciliation audit draft.
  [`cfo-agent.test.ts:60`](../../src/__tests__/cfo-agent.test.ts#L60)

- Non-array RPC payload is no longer silently treated as empty.
  [`cfo-agent.test.ts:78`](../../src/__tests__/cfo-agent.test.ts#L78)
