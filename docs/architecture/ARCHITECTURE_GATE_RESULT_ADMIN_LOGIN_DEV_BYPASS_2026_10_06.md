# Architecture Gate Result: Admin Login Dev Bypass Repair

Date: 2026-10-06
Status: PASS

## 1. Bella OS/Product Development Process Gate

Problem: existing admin emails cannot log in on localhost with the dev password path after HQ Headquarter changes.

Non-goals:
- Do not change production Supabase auth.
- Do not weaken RLS.
- Do not change HQ tenant identity semantics.
- Do not reset or expose passwords.
- Do not mutate tenant or auth data.

Truth / Source of Truth:
- Admin identity rows live in `public.users`.
- Tenant identity lives in `tenants.product_key`.
- HQ identity is `product_key = 'bella_hq'`.
- Local dev-bypass is cookie/header based: `mock_user_email` -> `x-mock-user-email` -> server-side lookup.

Canonical Contract:
- Client login may set `mock_user_email` only in `NODE_ENV=development` after proving the email exists.
- Server-side development bypass may use service role to read `public.users`; browser anon client must not rely on direct access through RLS.

Ownership:
- Authentication UI consumer: `src/app/(auth)/login/page.tsx`.
- Development bypass server boundary: shared auth/platform service code.
- Tenant/HQ identity: Platform Product Registry / tenant identity contract.

Change Authority:
- Authorized by the reported login regression.
- Permitted layer: local login dev-bypass consumer and a minimal server action for the same boundary.
- Not authorized: RLS, database schema, HQ product identity, production password policy, tenant mutations.

## 2. Product Manifest

Affected product surfaces:
- Local dashboard login for all products using `/login`.
- HQ portal is referenced only as boundary context; `/hq/login` remains real-auth.

Capabilities:
- Local development login bypass.
- User profile lookup.
- Tenant identity read after login.

## 3. Ownership Map

| Data / Capability | Owner | Current Consumer | Decision |
| --- | --- | --- | --- |
| `public.users.email` | Platform auth/profile | `/login` dev-bypass | Read server-side in dev only |
| `tenants.product_key` | Product identity contract | HQ/dashboard routing | No change |
| Supabase Auth password | Supabase Auth | `/hq/login`, real login fallback | No change |
| `mock_user_email` cookie | Local dev bypass | Dashboard/server actions | Reuse |

## 4. Contract Dependency Map

`Login UI -> dev-login server action -> public.users existence -> mock_user_email cookie -> proxy x-mock-user-email -> getCurrentUser() -> tenant settings -> dashboard routing`

No Product Vertical may bypass tenant isolation. This repair stays within localhost development auth setup.

## 5. Change Authority

Authorized:
- Add a development-only server action that checks whether an email exists in `public.users`.
- Replace the stale browser anon `users` lookup in `/login`.

Not authorized:
- Changing RLS policies.
- Changing tenant rows.
- Changing HQ product key.
- Adding production backdoor auth.

## 6. UI -> Contract Reconciliation

| UI element | UI expectation | Canonical contract | Backend reality | Conclusion |
| --- | --- | --- | --- | --- |
| `/login` email + `password123` in dev | Existing user can enter local app | Dev-only bypass verifies user then sets mock cookie | Browser anon read no longer sees `public.users` | STALE UI |
| `/hq/login` email/password | Real HQ admin auth | Supabase Auth + `checkHqAuth()` | Uses real password and `bella_hq` tenant product key | MATCH |

## 7. Additive Migration Plan

No migration. No database mutation.

## 8. 11 Automated Verification Gates Plan

1. Source diff check for intended files.
2. Static test for login dev-bypass boundary.
3. Targeted Jest for new/updated test.
4. Targeted ESLint on changed files if available.
5. Manual localhost login smoke for known admin email.
6. Confirm no RLS policy changes.
7. Confirm no tenant data mutation.
8. Confirm no secret printing.
9. Confirm production auth path remains fallback.
10. Confirm HQ portal code unchanged.
11. Report any unrun broad gates as NOT_RUN, not PASS.

## Result

PASS: minimal consumer repair is allowed.
