---
title: 'Fix Protected Layout Server Auth'
type: 'fix'
created: '2026-06-03'
status: 'done'
baseline_commit: 'ff238279e72d10a8b646d3f2e518ddd9481f35e1'
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md'
  - '{project-root}/node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** Browser smoke on the lab deployment could log in through Supabase Auth, but protected dashboard routes stayed on the loading screen. Console logs showed `DashboardLayout` failing a client-side auth check with `TypeError: Failed to fetch`.

**Approach:** Move protected-route auth checks from client `useEffect` to server layouts. `dashboard/layout.tsx` and `ktv/layout.tsx` now call `getCurrentUser()` server-side and use `redirect()` for unauthorized or wrong-role users. `Sidebar` receives the server-resolved user so it does not immediately call the same Server Action from the client after hydration.

## Boundaries & Constraints

**Always:** Keep route access rules stable: unauthenticated users go to `/login`, KTV users go to `/ktv/dashboard`, non-KTV users cannot stay under `/ktv`, and suspended tenants see a suspended notice. Keep Sidebar interactivity as a Client Component.

**Ask First:** Stop before replacing the Supabase auth system, changing login semantics, changing RLS, or changing tenant authorization rules.

**Never:** Do not expose service role keys or lab passwords. Do not add a production bypass. Do not silently ignore auth failures in Server Actions.

</frozen-after-approval>

## Code Map

- `src/app/dashboard/layout.tsx` -- protected dashboard server-side auth guard and dashboard shell.
- `src/app/ktv/layout.tsx` -- protected KTV server-side auth guard.
- `src/components/layout/sidebar.tsx` -- client sidebar now accepts `initialUser` from the server layout.

## Tasks & Acceptance

**Execution:**
- [x] `src/app/dashboard/layout.tsx` -- convert from client spinner/auth effect to server-side auth guard.
- [x] `src/app/ktv/layout.tsx` -- convert from client spinner/auth effect to server-side auth guard.
- [x] `src/components/layout/sidebar.tsx` -- accept server-provided initial user and avoid duplicate client auth lookup on dashboard load.

**Acceptance Criteria:**
- Given an authenticated admin session, when visiting `/dashboard`, then the dashboard shell renders without staying on the loading spinner.
- Given no authenticated session, when visiting protected dashboard/KTV routes, then the server redirects to `/login`.
- Given a KTV user visits `/dashboard`, then the server redirects to `/ktv/dashboard`.
- Given a non-KTV user visits `/ktv/*`, then the server redirects to `/dashboard`.

## Verification

**Commands:**
- `npx.cmd eslint src/app/dashboard/layout.tsx src/app/ktv/layout.tsx src/components/layout/sidebar.tsx` -- passed.
- `npx.cmd tsc --noEmit --incremental false` -- passed.
- `git diff --check` -- passed.
- `npm.cmd run build` -- compiled and typechecked successfully, then stopped at page-data collection because local shell lacks Supabase env; Vercel lab has the required env.

## Suggested Review Order

**Auth Guard**

- Dashboard guard resolves user server-side before rendering shell.
  [`layout.tsx:34`](../../src/app/dashboard/layout.tsx#L34)

- KTV guard resolves user server-side and preserves role redirects.
  [`layout.tsx:34`](../../src/app/ktv/layout.tsx#L34)

**Client Shell**

- Sidebar receives `initialUser` to avoid immediate client Server Action fetch on hydration.
  [`sidebar.tsx:91`](../../src/components/layout/sidebar.tsx#L91)
