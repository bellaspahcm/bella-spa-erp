---
title: 'Optimize chat messaging dashboard read model'
type: 'refactor'
created: '2026-06-04'
status: 'done'
context:
  - '{project-root}/docs/implementation-artifacts/spec-harden-dashboard-chat-actions.md'
  - '{project-root}/docs/implementation-artifacts/spec-harden-portal-chat-action-errors.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** Chat & Messaging still scores low because the dashboard chat surface has a weak read model: the conversation list shows placeholder previews/timestamps, the search box is decorative, dashboard send still accepts a caller-supplied sender type, and dashboard chat actions lack focused tests for tenant-scoped side effects.

**Approach:** Harden dashboard chat server actions around authenticated tenant context, derive practical last-message previews without adding a migration, make the dashboard list/search/unread state reflect real message changes, and add focused Jest coverage for DB failures and insert/update payloads.

## Boundaries & Constraints

**Always:** Keep portal chat behavior intact, preserve existing `chat_messages` schema, propagate database errors explicitly, type insert/update payloads with generated Supabase table types, and keep tenant filtering in dashboard server actions even when RLS is also present.

**Ask First:** Adding or replacing database RPCs, changing RLS policies, enabling anonymous realtime access, or changing customer portal token semantics.

**Never:** Do not add a new chat platform, do not introduce a separate conversations table, do not bypass dashboard auth with service role, and do not swallow failed read/update/insert operations as empty data.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Dashboard list load | Authenticated staff with tenant customers and chat rows | Conversation rows include real last-message preview/time and current unread count | RPC or preview query failure throws and UI shows a load error |
| Staff sends message | Non-empty message in selected conversation | Insert payload is tenant-scoped, `sender_type='staff'`, `sender_id` is authenticated user, UI appends message and updates preview | Auth/profile/customer/insert failure surfaces as explicit send error |
| Staff reads customer messages | Selected conversation has unread customer messages | Update targets only that customer, tenant, `sender_type='customer'`, `is_read=false`; UI clears badge | Update failure shows message error instead of silently succeeding |
| Search | Staff types name/phone/level text | Conversation list filters locally without refetching | Empty search result shows a clear empty state |

</frozen-after-approval>

## Code Map

- `src/services/chat-actions.ts` -- dashboard chat server-action boundary and tenant-scoped DB reads/writes.
- `src/app/dashboard/chat/page.tsx` -- client dashboard chat UI, realtime subscription, list search, unread/preview state.
- `src/__tests__/chat-actions.test.ts` -- focused regression tests for dashboard chat DB failure propagation and side-effect payload assertions.

## Tasks & Acceptance

**Execution:**
- [x] `src/services/chat-actions.ts` -- require authenticated user tenant, remove caller-controlled sender role from dashboard send, tenant-scope message fetch/insert/update, and enrich customer summaries with latest preview.
- [x] `src/app/dashboard/chat/page.tsx` -- bind search input, render filtered empty state, update list preview/unread on send/realtime/read, and use the hardened send signature.
- [x] `src/__tests__/chat-actions.test.ts` -- add tests for tenant auth, latest preview lookup failure, message fetch tenant filtering, staff insert payload, and mark-read update payload.
- [x] `docs/implementation-artifacts/spec-optimize-chat-messaging-dashboard-read-model.md` -- mark done with verification results after implementation.

**Acceptance Criteria:**
- Given a dashboard staff user with a tenant, when chat customers load, then the UI shows real last-message previews/timestamps and no placeholder preview for conversations with messages.
- Given a staff user sends a message, when the server action inserts into `chat_messages`, then the inserted payload has the authenticated `sender_id`, `sender_type='staff'`, and the verified customer `tenant_id`.
- Given selected customer messages are marked read, when the update runs, then it is scoped by `customer_id`, `tenant_id`, `sender_type='customer'`, and `is_read=false`.
- Given a database query fails in the dashboard chat path, when the action/UI handles it, then the failure is visible and not converted into silent empty data.

## Verification

**Commands:**
- `npm.cmd test -- src/__tests__/chat-actions.test.ts src/__tests__/portal-chat.test.ts --runInBand` -- passed, 2 suites / 17 tests.
- `npm.cmd run lint -- src/services/chat-actions.ts src/app/dashboard/chat/page.tsx src/__tests__/chat-actions.test.ts` -- passed.
- `npm.cmd run build` -- passed.
- `git diff --check` -- passed.
