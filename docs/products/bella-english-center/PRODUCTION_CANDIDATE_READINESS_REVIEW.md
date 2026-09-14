# Bella English Center - Production Candidate Readiness Review

**Date:** 2026-09-15
**Branch:** `codex/english-center-pc-readiness`
**Canonical base:** `origin/main@d4417cf8`
**Status:** REVIEW COMPLETE / PRODUCTION CANDIDATE HELD

---

## Decision

Bella English Center is eligible to retain **Field Verified RC**.

It is **not yet eligible to be called Production Candidate** because this review
did not find current, product-specific evidence for the final operations gates:

```text
Deployment run on canonical Field Verified RC        NOT FOUND
Staging deployment run for current RC                NOT FOUND
Production deployment run for current RC             NOT FOUND
Rollback dry-run or executed drill for current RC    NOT FOUND
Backup/restore drill covering English Center data    NOT FOUND
Alert delivery / on-call drill for English Center    NOT FOUND
Production runtime env proof for current RC          NOT FOUND
```

This is an evidence hold, not a product-feature hold.

```text
Field Verified RC                  PASS
Production Candidate Readiness     REVIEWED
Production Candidate               HELD
```

---

## Fresh Evidence

Executed from `origin/main@d4417cf8`, then recorded on
`codex/english-center-pc-readiness`.

```text
git rev-parse HEAD
  d4417cf8f1fb0a86153872e782833724acce201b

git rev-parse origin/main
  d4417cf8f1fb0a86153872e782833724acce201b

git diff --check
  PASS

npm run arch:guard
  PASS

npm run test:english-center-post-rc-real-db
  Test Suites: 1 passed, 1 total
  Tests:       1 passed, 1 total

npm run e2e:english-center-post-rc
  2 passed
  Command Center API probe returned HTTP 200

npm run build
  PASS
  English Center API routes and dashboard pages collected

npm run security:secrets
  PASS

npm run security:audit
  PASS
  Allowed production audit advisories:
    xlsx high advisories GHSA-4r6h-8v6p-xvw6 and GHSA-5pgg-2g8v-p4x9
```

Notes:

- The production build still emits the existing Next.js warning for
  `experimental.turbo`; it did not fail the build.
- The real database validation used the configured test database URL from
  `.env.test`. No secret value is recorded in this evidence document.
- `.cache/` remains untracked and outside release scope.

---

## Operations Evidence Review

### Deployment

Repository deployment primitives exist:

```text
.github/workflows/deploy-production.yml
.github/workflows/deploy-staging.yml
vercel.production.json
```

The production workflow requires main branch, immutable deployment configuration,
lint, critical tests, production audit, secret scan, API versioning check,
migration checks, build, immutable Vercel preview health, authenticated browser
smoke, promotion, and promoted production health samples.

Current evidence gap:

```text
gh run list --workflow deploy-production.yml --branch main --limit 5
  latest returned runs are old 2026-06 failures

gh run list --workflow deploy-staging.yml --branch main --limit 5
  no runs returned

gh run list --workflow deploy-staging.yml --limit 5
  no runs returned
```

Therefore deployment readiness is not proven for `origin/main@d4417cf8`.

### Rollback

Repository rollback primitive exists:

```text
scripts/emergency-rollback.sh
```

It dry-runs by default, validates a Ready Vercel deployment target, verifies the
project name, requires an explicit confirmation for execution, promotes the
target only with `--execute`, and samples `/api/health` after promotion.

Current evidence gap:

```text
No rollback dry-run output was found for the current Field Verified RC.
No executed rollback drill was found for the current Field Verified RC.
No rollback log artifact was found for the current Field Verified RC.
```

### Backup / Restore

Repository backup and DR primitives exist:

```text
scripts/backup-database.sh
scripts/run-staging-dr-drill.ts
scripts/README.md
```

The current backup script is scoped to Decision Engine tables, not the full
Bella English Center product dataset. The staging DR drill is an interactive
isolated-staging utility and explicitly warns not to run against production.

Current evidence gap:

```text
No backup artifact was found for English Center tables.
No restore drill output was found for English Center data.
No measured RTO/RPO artifact was found for the current Field Verified RC.
```

### Observability / Alerts

Repository observability primitives exist:

```text
@sentry/nextjs dependency
scripts/test-slack-alert.sh
scripts/test-pagerduty-alert.sh
docs/BDGF_PRODUCTION_DEPLOYMENT_GUIDE.md
docs/BDGF_PRODUCTIONIZATION_PLAN.md
```

Current evidence gap:

```text
No English Center alert route or monitor run was found.
No Slack/PagerDuty alert-delivery proof was found for this RC.
No on-call runbook execution evidence was found for this RC.
No SLO/error-budget dashboard evidence was found for English Center.
```

### Security / Runtime Configuration

Security gate evidence is currently stronger than operations evidence:

```text
npm run security:secrets  PASS
npm run security:audit    PASS with known allowlisted xlsx advisories
vercel.production.json    security headers configured for API and app routes
```

Current evidence gap:

```text
Production Vercel environment values were not verified in this review.
Production Supabase migration state was not verified by a current deploy run.
Production authenticated browser smoke was not executed by deploy workflow.
```

---

## Exit Criteria To Lift The Hold

Production Candidate can be claimed only after these evidence items exist for
the same canonical commit or an explicitly newer canonical commit:

```text
[ ] Deploy staging workflow PASS for canonical commit
[ ] Deploy production workflow PASS or approved production-candidate dry run PASS
[ ] Exact deployed preview health PASS
[ ] Authenticated browser smoke PASS against the deployed preview
[ ] English Center Post-RC browser gate PASS against staging/live-like URL
[ ] Real database validation PASS against staging/live-like database
[ ] Rollback dry-run PASS and target validation captured
[ ] Backup artifact exists for English Center tables or full application DB
[ ] Restore drill PASS with measured RTO/RPO
[ ] Alert delivery drill PASS for critical runtime failure
[ ] Production runtime environment variables verified without exposing secrets
[ ] Final release evidence updated on canonical main
```

---

## Final Classification

```text
BELLA ENGLISH CENTER
canonical origin/main: d4417cf8

Bounded RC              PASS
Field Verified RC       PASS
PC Readiness Review     COMPLETE
Production Candidate    HELD
```

The next workstream should stay operational and narrow: run the staging /
production deployment gates, capture rollback and restore evidence, verify alert
delivery, and then update this document with the results. No new English Center
business capability is required to resolve this hold.
