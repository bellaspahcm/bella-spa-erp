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

## Local Development Mock Authentication (Bypass)

To facilitate local testing without requiring developers to confirm emails on a remote Supabase Auth database (which blocks direct access), we implemented a **Cookie-Based Auth Bypass** active strictly in the development environment.

### 1. How It Works
- **Strict Environment Isolation**: Protected by `process.env.NODE_ENV === 'development'`. Completely disabled in production.
- **Login Credentials**: Developers can enter **any existing email** from the `public.users` table and the universal password **`password123`**.
- **Mock Cookie Injection**: 
  - Upon submission, the login handler in [login/page.tsx](file:///d:/Antigravity/Projects/BELLA%20SPA%20ERP/src/app/(auth)/login/page.tsx) verifies if the email exists in `public.users`.
  - If it exists, it sets the `mock_user_email` cookie with a lifespan of 1 year.
- **Unified Role Resolution**:
  - The [getCurrentUser](file:///d:/Antigravity/Projects/BELLA%20SPA%20ERP/src/services/user-actions.ts) server action reads this cookie. If present, it bypasses the standard Supabase Auth session and fetches the user's profile matching that email.
  - If the cookie is absent, it defaults to `ktv1@bellaspa.com.vn` (so existing KTV workflows still work instantly).
  - Both client-side page layouts (like [dashboard/page.tsx](file:///d:/Antigravity/Projects/BELLA%20SPA%20ERP/src/app/dashboard/page.tsx)) and server actions call `getCurrentUser`, ensuring perfect role synchronization.
- **Logout Cleansing**:
  - Clicking the **Logout** button in [sidebar.tsx](file:///d:/Antigravity/Projects/BELLA%20SPA%20ERP/src/components/layout/sidebar.tsx) clears the `mock_user_email` cookie cleanly.

### 2. Available Test Accounts (`password123`)
| Role | Email | Name |
| :--- | :--- | :--- |
| **Admin** | `bellaspa.testadmin@gmail.com` | Test Admin Full Chức Năng |
| **Admin** | `admin@bellaspa.vn` | Admin Bella Spa |
| **Admin** | `caothithuyvan93@gmail.com` | Chủ Spa (Admin) |
| **Admin** | `admin@bellaspa.com.vn` | Nguyễn Phương Anh |
| **KTV** | `ktv1@bellaspa.com.vn` | Nguyễn Thị Hoa |
| **KTV** | `ktv2@bellaspa.com.vn` | Trần Thị Mai |


