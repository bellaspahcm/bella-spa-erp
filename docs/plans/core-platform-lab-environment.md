# Core Platform Lab Environment

## Purpose

This worktree is the isolated lab for core-platform conversion:

- Path: `D:\Antigravity\Projects\BELLA-ERP-CORE-PLATFORM`
- Branch: `core-platform-lab`
- Baseline tag: `pre-core-platform-baseline-2026-06-03`
- Vercel project: `bella-erp-core-platform`
- Supabase lab project: `bella-erp-core-platform-lab`
- Supabase lab ref: `avinnjksfgmsriaahqmy`

The lab must never use the production Supabase project or production Vercel project.

## Current Setup Status

- Git worktree exists and tracks `origin/core-platform-lab`.
- Vercel project is linked locally via `.vercel/project.json`.
- `.vercel/` is ignored by git.
- Vercel project currently has no environment variables.
- Supabase CLI is authenticated via `SUPABASE_ACCESS_TOKEN` from User env.
- Supabase lab project is linked via `supabase/.temp/project-ref`.
- Supabase lab migrations are pushed and `supabase db push` reports the remote database is up to date.
- Vercel project environment variables are still not configured.

## Required Supabase Lab Project

Use the separate Supabase project before deploying the lab.

Recommended project name:

```text
bella-erp-core-platform-lab
```

Current project ref:

```text
avinnjksfgmsriaahqmy
```

Required values after project creation:

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DEFAULT_TENANT_ID=
DB_ENCRYPTION_KEY=
CRON_SECRET=
PAYMENT_WEBHOOK_SECRET=
TELEGRAM_WEBHOOK_SECRET=
RATE_LIMIT_BACKEND=supabase
```

Optional values:

```text
GEMINI_API_KEY=
SUPABASE_AUTH_SMS_TWILIO_AUTH_TOKEN=
SUPABASE_AUTH_EXTERNAL_APPLE_SECRET=
```

## Setup Steps

1. Log in Supabase CLI or set `SUPABASE_ACCESS_TOKEN`.

```powershell
npx.cmd supabase login
```

2. Create or select the lab Supabase project.

Do not link this worktree to the production Supabase project.

3. Link the lab worktree to the lab Supabase project.

```powershell
npx.cmd supabase link --project-ref <LAB_PROJECT_REF>
```

4. Push migrations to the lab database.

```powershell
npx.cmd supabase db push
```

Migration note:

The legacy migration chain originally could not run from an empty Supabase project because several early migrations depended on production-era/manual schema objects. The lab branch now carries compatibility fixes in the migration history so a new lab database can be brought up by `supabase db push`.

5. Seed only safe lab/demo data.

Do not copy production customer, salary, phone, Zalo, or payment data into the lab.

6. Add Vercel environment variables to `bella-erp-core-platform`.

Use only lab Supabase credentials.

```powershell
npx.cmd vercel env add NEXT_PUBLIC_SUPABASE_URL
npx.cmd vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
npx.cmd vercel env add SUPABASE_SERVICE_ROLE_KEY
npx.cmd vercel env add DEFAULT_TENANT_ID
npx.cmd vercel env add DB_ENCRYPTION_KEY
npx.cmd vercel env add CRON_SECRET
npx.cmd vercel env add PAYMENT_WEBHOOK_SECRET
npx.cmd vercel env add TELEGRAM_WEBHOOK_SECRET
npx.cmd vercel env add RATE_LIMIT_BACKEND
```

7. Pull env locally if needed.

```powershell
npx.cmd vercel env pull .env.local
```

8. Deploy preview/lab only after env is configured.

```powershell
npx.cmd vercel
```

## Guardrails

- Never run `scripts/db-reset.js` against production credentials.
- Never paste production `SUPABASE_SERVICE_ROLE_KEY` into the lab Vercel project.
- Never connect `core-platform-lab` to the production Vercel project.
- Never push broad core-platform conversion changes to `main` before they pass through the lab.
- Keep `main` deployable as the current Bella Spa production/stable line.

## Verification Before First Lab Deploy

Run:

```powershell
git status --short --branch
npx.cmd supabase status
npx.cmd vercel env ls
npx.cmd tsc --noEmit --pretty false
npm.cmd test -- --runInBand
```

Expected:

- branch is `core-platform-lab`
- Supabase project ref is the lab project
- Vercel env exists and points to lab credentials
- TypeScript passes
- Jest passes
