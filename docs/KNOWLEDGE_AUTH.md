# Knowledge: Supabase SSR Authentication in Next.js

## Problem
Users (especially Admins) were authenticated on the frontend but appeared as `null` or `unauthorized` in **Next.js Server Actions** and **Middleware**.

## Root Cause
The application was using two different Supabase clients that didn't share session storage:
1.  **Frontend**: Used `createClient` from `@supabase/supabase-js`, which stores sessions in `localStorage`.
2.  **Server (Actions/Middleware)**: Used `createServerClient` from `@supabase/ssr`, which only reads sessions from **Cookies**.

`localStorage` is invisible to the server, so Server Actions could never see the user's session.

## Solution
Synchronize authentication using **Cookies** for both client and server:

### 1. Update Client-side Client
In `src/lib/supabase-client.ts`, use `createBrowserClient` from `@supabase/ssr` instead of the standard `@supabase/supabase-js`.

### 2. Configure Server-side Client
Ensure `src/lib/supabase-server.ts` correctly handles cookie getting/setting using `next/headers`.

### 3. Middleware Session Refresh
Ensure `src/middleware.ts` calls `supabase.auth.getUser()` on every request to refresh the session cookie.

## Critical Requirement
When switching from `localStorage` to `Cookies`, existing users **MUST logout and login again**.
