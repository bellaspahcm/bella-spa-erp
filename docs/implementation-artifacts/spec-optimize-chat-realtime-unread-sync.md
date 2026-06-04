---
title: 'Optimize chat realtime unread sync'
type: 'refactor'
created: '2026-06-04'
status: 'done'
context:
  - '{project-root}/docs/implementation-artifacts/spec-optimize-chat-messaging-dashboard-read-model.md'
  - '{project-root}/docs/implementation-artifacts/spec-harden-portal-chat-action-errors.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** Chat still feels delayed and inconsistent because the customer portal relies on polling and the dashboard only listens to the currently selected conversation, so unread badges, message previews, and read receipts can drift until a refresh or interval tick.

**Approach:** Add deterministic message merge/unread helpers, wire portal chat to Supabase realtime for insert/update events with polling as fallback, and make dashboard chat listen to tenant-visible chat inserts globally so unselected conversations update immediately.

## Boundaries & Constraints

**Always:** Preserve the existing `chat_messages` table and server action contracts, keep portal token validation server-side, surface read/fetch/send failures visibly, and maintain typed `Database['public']['Tables']['chat_messages']` rows.

**Ask First:** Any change to RLS policies, anonymous realtime grants, share token semantics, or a new conversations table.

**Never:** Do not introduce a third-party messaging provider, do not remove the polling fallback, do not mark customer messages as read unless the matching chat is open/selected, and do not convert database failures into silent empty UI.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Portal receives staff insert | Widget closed with existing messages | New staff message merges once, unread increments, toast offers to open chat | If realtime is unavailable, polling still refreshes |
| Portal opens chat | Staff messages are unread | Server action marks staff messages read and local unread clears | Failure displays a small portal chat error state |
| Portal receives update | Customer message `is_read` changes to true | Existing message updates in place so the sent checkmark changes | Unknown message is ignored or merged without duplication |
| Dashboard receives unselected customer insert | Staff is viewing another conversation | Matching conversation preview/time updates and unread increments | If customer is not in the list, reload customer list through the existing action |
| Dashboard receives selected customer insert | Conversation is open | Message appends once and mark-read runs; unread remains 0 | Mark-read failure shows message error |

</frozen-after-approval>

## Code Map

- `src/components/features/portal/portal-chat-utils.ts` -- pure merge/sort/unread helpers shared by widget and tests.
- `src/components/features/portal/PortalChatWidget.tsx` -- customer portal chat UI, realtime subscription, polling fallback, read error display.
- `src/app/dashboard/chat/page.tsx` -- staff dashboard chat UI, global insert subscription, selected-conversation read sync.
- `src/__tests__/portal-chat-utils.test.ts` -- focused pure tests for merge, unread, and read receipt state.

## Tasks & Acceptance

**Execution:**
- [x] `src/components/features/portal/portal-chat-utils.ts` -- add typed helper functions for stable message ordering, dedupe merge, patch/update merge, and unread staff count.
- [x] `src/__tests__/portal-chat-utils.test.ts` -- cover insert merge, update merge, chronological sorting, optimistic replacement, and unread staff counting.
- [x] `src/components/features/portal/PortalChatWidget.tsx` -- use helpers, add realtime insert/update handling, keep a slower polling fallback, and render read/load error text instead of only logging.
- [x] `src/app/dashboard/chat/page.tsx` -- replace selected-only insert subscription with a tenant-visible insert listener that updates unselected previews/unread and still marks selected messages read.
- [x] `docs/implementation-artifacts/spec-optimize-chat-realtime-unread-sync.md` -- mark done with verification results.

**Acceptance Criteria:**
- Given the portal chat is closed, when a staff message arrives through realtime, then it appears once, increments unread, and shows a toast action to open chat.
- Given the portal chat is open, when unread staff messages exist, then `markPortalMessagesAsRead` clears local unread or displays an explicit error.
- Given a dashboard user is viewing one customer, when another customer sends a message, then that other conversation preview/time updates and its unread badge increments.
- Given a dashboard user is viewing the same customer, when a customer message arrives, then the message appears once and the unread badge remains cleared after mark-read succeeds.

## Verification

**Commands:**
- `npm.cmd test -- src/__tests__/portal-chat-utils.test.ts src/__tests__/portal-chat.test.ts src/__tests__/chat-actions.test.ts --runInBand` -- passed: 3 suites, 23 tests.
- `npm.cmd run lint -- src/components/features/portal/PortalChatWidget.tsx src/components/features/portal/portal-chat-utils.ts src/app/dashboard/chat/page.tsx src/__tests__/portal-chat-utils.test.ts` -- passed.
- `npm.cmd run build` -- passed.
- `git diff --check` -- passed; Windows LF/CRLF warnings only.
