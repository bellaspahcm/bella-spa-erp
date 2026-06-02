---
title: 'Harden offline sync error typing'
type: 'refactor'
created: '2026-06-02'
status: 'done'
route: 'one-shot'
---

# Harden offline sync error typing

## Intent

**Problem:** Offline sync used `catch (error: any)` and wrote `error?.message` directly into the retry queue, while the hook consumer exposed loose `any` in `executeAction`.

**Approach:** Normalize caught errors from `unknown`, preserve the existing failed-queue retry behavior, and type the hook return as either the server action result or the offline queued result.

## Suggested Review Order

**Sync Error Boundary**

- Error normalization now handles `unknown` without optional access on `any`.
  [`sync-actions.ts:5`](../../src/services/sync-actions.ts#L5)

- Failed sync records still increment retry count and store an error message.
  [`sync-actions.ts:42`](../../src/services/sync-actions.ts#L42)

**Hook Contract**

- Offline queued result is explicit instead of hidden behind `Promise<any>`.
  [`useOfflineSync.ts:8`](../../src/hooks/useOfflineSync.ts#L8)

- `executeAction` keeps the same call shape with typed payload/result boundaries.
  [`useOfflineSync.ts:81`](../../src/hooks/useOfflineSync.ts#L81)

## Verification

**Commands:**
- `npm.cmd run lint -- src/services/sync-actions.ts src/hooks/useOfflineSync.ts` -- passed.
- `npx.cmd tsc --noEmit --pretty false` -- passed.
- `git diff --check` -- passed.
- `rg -n "catch \\([^)]*: any\\)|error\\?\\.message|Promise<any>|: any\\b|payload: any|\\.\\.\\.args: any" src\\services\\sync-actions.ts src\\hooks\\useOfflineSync.ts` -- no matches.

## Review Notes

- BMAD subagent review was not used because the available subagent tool requires an explicit user request for delegation.
- Local review kept `OfflineAction.payload` unchanged because fully typing queued payloads would fan out into KTV session callers and should be a separate refactor.
