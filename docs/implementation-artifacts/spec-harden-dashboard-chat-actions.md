---
title: 'Harden dashboard chat actions'
type: 'refactor'
created: '2026-06-02'
status: 'done'
route: 'plan-code-review'
---

# Harden dashboard chat actions

## Intent

**Problem:** Dashboard chat still had silent database failure paths: customer/message fetches could degrade to empty lists, mark-read errors were only logged, and message inserts used loose payload typing in the client page.

**Approach:** Move the main chat load/send/mark-read paths through typed server actions that throw on database errors, then surface those failures in the dashboard chat UI instead of treating them as empty data.

## Suggested Review Order

**Server Action Contract**

- Fetch actions now throw database errors instead of returning empty arrays.
  [`chat-actions.ts:19`](../../src/services/chat-actions.ts#L19)

- Message sending checks tenant/auth errors and uses a typed insert payload.
  [`chat-actions.ts:50`](../../src/services/chat-actions.ts#L50)

- Mark-read now uses a typed update payload and propagates failures.
  [`chat-actions.ts:102`](../../src/services/chat-actions.ts#L102)

**Dashboard Binding**

- Chat list load now uses the hardened action and displays load errors.
  [`page.tsx:166`](../../src/app/dashboard/chat/page.tsx#L166)

- Message load and mark-read now route through server actions.
  [`page.tsx:191`](../../src/app/dashboard/chat/page.tsx#L191)

- Sending a staff message now uses the typed action and shows failures.
  [`page.tsx:259`](../../src/app/dashboard/chat/page.tsx#L259)

## Verification

**Commands:**
- `npm.cmd run lint -- src/services/chat-actions.ts src/app/dashboard/chat/page.tsx` -- passed.
- `npx.cmd tsc --noEmit --pretty false` -- passed.
- `git diff --check` -- passed.
- `rg -n "catch \\([^)]*: any\\)|Promise<any>|res: any|payload: any|c: any|m: any|return \\[\\];" src\\services\\chat-actions.ts src\\app\\dashboard\\chat\\page.tsx` -- no matches.

## Review Notes

- BMAD subagent review was not used because the available subagent tool requires an explicit user request for delegation.
- Local adversarial review patched two items before commit: load-list failures now clear selected chat, and new user-facing fallback messages use Vietnamese text.
