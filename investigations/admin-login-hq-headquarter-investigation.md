# Investigation: Admin Login After HQ Headquarter Adjustment

## Hand-off Brief

1. **What happened.** Admin rows still exist in `public.users`, but local `/login` dev-bypass no longer detects them because the browser anon client cannot read `public.users` under current RLS.
2. **Where the case stands.** Root cause is confirmed for localhost/dev login; production/HQ real-password login remains separate.
3. **What's needed next.** Move the dev-only email existence check behind a server action using the existing service-role development bypass pattern.

## Case Info

| Field | Value |
| --- | --- |
| Ticket | N/A |
| Date opened | 2026-10-06 |
| Status | Concluded |
| System | BELLA SPA ERP local Next.js dev server |
| Evidence sources | Source code, service-role DB query, anon DB query, memory context |

## Problem Statement

User reported: "cac email user admin hien tai khong login duoc sau khi dieu chinh HQ Headquarter".

## Evidence Inventory

| Source | Status | Notes |
| --- | --- | --- |
| `src/app/(auth)/login/page.tsx` | Available | Dev-bypass checks `public.users` from browser Supabase anon client. |
| Service-role DB read | Available | Admin users and tenants exist, including Beauty V2, Haircut, HQ, and HQ legacy admins. |
| Anon DB read | Available | Same admin emails return no readable rows without error. |
| `src/services/user-actions.ts` | Available | Existing post-cookie dev bypass uses service-role lookup on the server. |
| `src/services/hq-actions.ts` | Available | HQ authorization now uses `tenant.product_key === 'bella_hq'`. |

## Investigation Backlog

| # | Path to Explore | Priority | Status | Notes |
| - | --- | --- | --- | --- |
| 1 | Restore local login dev-bypass without weakening RLS | High | Done | Consumer fix only. |
| 2 | Verify HQ real auth password path | Medium | Open | Requires known current HQ password or reset authority. |

## Timeline of Events

| Time | Event | Source | Confidence |
| --- | --- | --- | --- |
| 2026-10-06 | Admin login failure reported after HQ Headquarter changes. | User report | Confirmed |
| 2026-10-06 | `public.users` admin rows read successfully through service role. | DB query | Confirmed |
| 2026-10-06 | Browser/anon client reads for admin emails returned no rows. | DB query | Confirmed |
| 2026-10-06 | Targeted Jest and browser smoke verified the repaired dev-bypass path. | Local verification | Confirmed |

## Confirmed Findings

### Finding 1: Dev login still depends on anon-readable `public.users`

**Evidence:** `src/app/(auth)/login/page.tsx:56`

**Detail:** The login page calls `supabase.from('users').select('email, role')` from the client when password is `password123`.

### Finding 2: Server-side dev bypass already has the correct RLS-safe pattern

**Evidence:** `src/services/user-actions.ts:126`

**Detail:** After `mock_user_email` exists, `getCurrentUser()` uses a service-role admin client in development to fetch the profile.

### Finding 3: HQ authorization is no longer name-based in code

**Evidence:** `src/services/hq-actions.ts:52`, `src/lib/business-rules/hq-tenant.ts:5`

**Detail:** `checkHqAuth()` selects `product_key`; `isHqTenant()` checks `bella_hq`.

## Deduced Conclusions

### Deduction 1: The failing local admin login is a stale consumer problem

**Based on:** Findings 1 and 2.

**Reasoning:** The canonical local dev-bypass path already treats unauthenticated `public.users` reads as blocked by RLS and uses service role server-side. The login page is the stale consumer that still performs the unauthenticated read before the cookie exists.

**Conclusion:** Fix `/login` dev-bypass to call a dev-only server action for email existence, then set `mock_user_email` as before.

## Hypothesized Paths

### Hypothesis 1: HQ real-password login may also fail if the current auth password is unknown

**Status:** Open

**Theory:** `/hq/login` uses real Supabase auth, so it is independent from `password123` local dev-bypass.

**Supporting indicators:** `src/app/hq/login/hq-login-client.tsx:20` calls `signInWithPassword`.

**Would confirm:** A sign-in attempt with the current HQ password fails.

**Would refute:** A sign-in attempt with the current HQ password succeeds and `verifyHqLogin()` passes.

**Resolution:** Pending password/reset authority.

## Missing Evidence

| Gap | Impact | How to Obtain |
| --- | --- | --- |
| Current HQ real password | Cannot verify `/hq/login` end-to-end | User supplies password or authorizes reset. |

## Source Code Trace

| Element | Detail |
| --- | --- |
| Error origin | `src/app/(auth)/login/page.tsx` dev-bypass branch |
| Trigger | Local login with `password123` and an admin email not in the hardcoded special list |
| Condition | Anon client cannot read `public.users` before mock cookie/server bypass is established |
| Related files | `src/services/user-actions.ts`, `src/lib/supabase-dev-bypass-server.ts`, `src/proxy.ts` |

## Conclusion

**Confidence:** High

The local admin login failure is confirmed as a stale client-side dev-bypass lookup. The fix keeps RLS intact and moves only the email existence check to a development-only server action. Targeted Jest, diff check, ESLint, and localhost browser smoke passed.

## Recommended Next Steps

### Fix direction

Add a small server action for development login bypass email validation, call it from `/login`, and verify admin emails can set `mock_user_email` again.

### Diagnostic

After patching, test `admin.beauty.demo@bellaspa.test`, `admin@haircutshop.test`, and `admin@bellaspa.vn` with `password123` on localhost.

## Reproduction Plan

1. Open `/login` on localhost.
2. Enter an existing admin email and `password123`.
3. Before fix: login falls through to real Supabase auth and fails if `password123` is not the real password.
4. After fix: login sets `mock_user_email` and routes to the dashboard path.

## Side Findings

- HQ portal `/hq/login` is a real-auth path and should not be conflated with local `/login` dev-bypass.
- `admin@bellaspa.vn` currently signs in through real Supabase auth with `password123`; no mock cookie is needed for that account in the observed localhost smoke.
