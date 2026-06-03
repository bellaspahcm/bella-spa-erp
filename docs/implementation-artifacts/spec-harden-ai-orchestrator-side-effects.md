---
title: 'Harden AI Orchestrator Side Effects'
type: 'bugfix'
created: '2026-06-03'
status: 'done'
baseline_commit: '7336ee295fdf6017ee218e18cd29d7b273ad12e9'
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/docs/index.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** AI orchestrator da throw neu ghi `ai_agent_logs` fail, nhung chua co regression test khoa hanh vi nay. Ngoai ra khi Gemini tra `draftActions: []`, code hien tai co the ghi de va lam mat draft proposal den tu sub-agent nhu CFO reconciliation audit.

**Approach:** Giu API va routing hien co, nhung harden merge logic: Gemini chi thay draft actions khi tra ve danh sach khong rong; neu rỗng/khong hop le thi giu proposal nen tu sub-agent. Bo sung regression tests cho log failure, Gemini degraded, va CFO proposal preservation.

## Boundaries & Constraints

**Always:** `ai_agent_logs.insert` failure la DB failure bat buoc va phai lam API tra 500. External Gemini failure la degraded enrichment, khong duoc lam mat du lieu nen tu sub-agent. Draft proposals tu sub-agent khong bi xoa boi Gemini empty array.

**Ask First:** Thay doi route response schema, Gemini prompt lon, action approval flow, hoac co che ghi proposal rieng vao database.

**Never:** Khong swallow DB log insert failure. Khong ghi de `draftActions` bang array rong neu sub-agent da co proposal. Khong bien Gemini HTTP/parse error thanh DB failure.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| AI log insert fails | `ai_agent_logs.insert` returns error | API returns 500 | Details include log failure |
| CFO major diff + Gemini empty actions | CFO returns `reconciliation_audit`, Gemini returns `draftActions: []` | Response still contains CFO proposal | No error |
| Gemini HTTP/JSON fails | Sub-agent data loaded, Gemini enrichment fails | Response keeps sub-agent data and degraded summary | No DB failure |
| Gemini valid non-empty actions | Gemini returns non-empty draftActions | Response uses Gemini actions | No error |

</frozen-after-approval>

## Code Map

- `src/services/ai/orchestrator.ts` -- Multi-agent orchestration, AI log insert, Gemini enrichment, draft action merge.
- `src/__tests__/ai-agent.test.ts` -- API-level AI orchestrator/RBAC/RPC regression tests.

## Tasks & Acceptance

**Execution:**
- [x] `src/services/ai/orchestrator.ts` -- preserve sub-agent draft proposals when Gemini returns empty or invalid draftActions.
- [x] `src/__tests__/ai-agent.test.ts` -- add regression tests for AI log failure, CFO proposal preservation, and Gemini degraded fallback.
- [x] `docs/DEVELOPMENT_LOG.md` -- append verification entry after checks pass.

**Acceptance Criteria:**
- Given `ai_agent_logs.insert` fails, when orchestrator route handles a valid request, then response status is 500.
- Given CFO sub-agent creates a draft proposal and Gemini returns empty draftActions, when response is returned, then `draftActions` still includes the CFO proposal.
- Given Gemini API fails, when sub-agent data was loaded and AI log insert succeeded, then response still succeeds with sub-agent fullData preserved.

## Verification

**Commands:**
- `npm.cmd test -- src/__tests__/ai-agent.test.ts --runInBand` -- pass, 11/11 tests.
- `npx.cmd tsc --noEmit --incremental false` -- pass.
- `npx.cmd eslint src/services/ai/orchestrator.ts src/__tests__/ai-agent.test.ts` -- pass.
- `npm.cmd test -- --runInBand` -- pass, 66 suites / 725 tests.
- `npm.cmd run build` -- pass.

## Review Notes

- Local diff review found no patch findings in scope: DB log failure still throws; only Gemini empty draft action merge behavior changed.
- BMad parallel sub-agent review was not spawned because this runtime only permits sub-agents when the user explicitly requests agent delegation.

## Suggested Review Order

**Draft Action Merge**

- Gemini can replace draft actions only when it returns non-empty actions.
  [`orchestrator.ts:343`](../../src/services/ai/orchestrator.ts#L343)

**Regression Coverage**

- Shared mock still records all `from()` table requests.
  [`ai-agent.test.ts:80`](../../src/__tests__/ai-agent.test.ts#L80)

- CFO proposal survives Gemini empty `draftActions`.
  [`ai-agent.test.ts:265`](../../src/__tests__/ai-agent.test.ts#L265)

- Gemini HTTP failure remains degraded enrichment with sub-agent data preserved.
  [`ai-agent.test.ts:302`](../../src/__tests__/ai-agent.test.ts#L302)

- Required AI log insert failure returns API 500.
  [`ai-agent.test.ts:373`](../../src/__tests__/ai-agent.test.ts#L373)
