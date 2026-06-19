---
title: 'Hoan thien Phase 7 Deployment va Operations'
type: 'chore'
created: '2026-06-19'
status: 'in-review'
baseline_commit: '4224a8aa6265f1ddd46f88b7f815b6b7d00a019c'
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/docs/infrastructure/ROLLBACK_PROCEDURES.md'
  - '{project-root}/docs/infrastructure/DATABASE_REPLICATION_SETUP.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Phase 7 dang hien thi 0/5 trong khi mot so ha tang da co, nhung production build dang do, staging va read replica chua hoat dong, production khong co approval gate, va nhieu buoc migration/monitoring chi la placeholder.

**Approach:** Bien cac workflow va runbook hien co thanh pipeline co the kiem chung, sua build blocker, cau hinh tach staging/production, them approval va rollback/migration gates, sau do chi cap nhat checklist cho cac muc da duoc xac minh bang run hoac health check.

## Boundaries & Constraints

**Always:** Bao toan thay doi chua commit trong route partner; dung strict database typing, khong them `any`/`as any`; CI va security gates phai fail-closed; API co auth/tenant data phai `no-store`; moi task ha tang chi duoc danh dau xong khi co bang chung runtime.

**Ask First:** Bat ky thao tac rollback production hoac migration ghi vao database.

**Never:** Provision hoac nang cap dich vu co the tinh phi trong dot nay; dung production database lam staging; bo qua lint/build/test/security de deploy; cache response co authentication/PII; ghi de thay doi nguoi dung dang co; danh dau checklist hoan thanh dua tren placeholder hoac tai lieu.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Production release | Main commit da qua quality gates va duoc phe duyet | Mot deployment Ready, health va smoke tests xanh | Khong promote neu bat ky gate nao fail |
| Staging release | Push vao `develop` voi staging secrets rieng | Auto-deploy staging va chay smoke test tren staging URL | Fail ro khi thieu secret/environment |
| Replica unavailable | Replica bat nhung health check fail | Analytics khong duoc am tham bao healthy | Health/CI bao loi; khong danh dau hoan thanh |
| Rollback dry run | Co it nhat hai deployment production | Chon dung deployment truoc va kiem tra target | Khong promote trong che do dry-run; fail neu target khong hop le |

</frozen-after-approval>

## Code Map

- `src/app/api/admin/partners/[id]/webhook-retry-config/route.ts` -- TypeScript blocker cua build hien tai.
- `.github/workflows/ci-tests.yml` -- Test/build tren moi push va pull request.
- `.github/workflows/deploy-staging.yml` -- Staging pipeline dang thieu secret va con placeholder.
- `.github/workflows/deploy-production.yml` -- Production deploy hook, approval boundary va placeholder migration checks.
- `src/lib/database/read-replica.ts` -- Replica routing va fallback hien tai.
- `src/app/api/health/replica/route.ts` -- Runtime evidence cho replica.
- `scripts/emergency-rollback.sh` -- Rollback dang tham chieu sai Vercel project/scope.
- `scripts/check-supabase-migrations.cjs` -- Migration drift gate hien co.
- `docs/api/API_GATEWAY_PRODUCTION_READINESS_CHECKLIST.html` -- Checklist chi cap nhat sau verification.

## Tasks & Acceptance

**Execution:**
- [x] Sua TypeScript blocker bang type ro rang va dua lint/build/test ve xanh.
- [x] Harden CI tren Node 24, env fallback, migration/security checks va scripts ton tai that.
- [x] Harden staging workflow fail-closed cho develop; xac nhan project/database/secrets rieng chua duoc provision va de pending vi can ha tang ben ngoai.
- [x] Chuyen production sang manual dispatch, deploy hook, health/smoke gate va khong deploy neu validation fail.
- [x] Sua rollback runbook/script theo Vercel project that; them dry-run verification.
- [x] Them zero-downtime migration policy check, test va ket noi vao CI/deploy.
- [x] Verify kha nang Supabase read replica; xac nhan can tra phi, de pending va ghi ro bang chung, khong provision.
- [x] Xac nhan Vercel CDN/load-balancing/auto-scaling boundaries; dat no-store cho toan bo /api/* va giu CDN cho static assets.
- [x] Cap nhat Phase 7 checklist thanh PARTIAL 7/10 voi bang chung va cac muc tra phi/ngoai vi de pending.

**Acceptance Criteria:**
- Given mot push/PR, when GitHub Actions chay, then lint, build, critical tests, migration drift va security gates deu thuc thi va bao xanh.
- Given staging va production, when xem Vercel/GitHub environments, then hai moi truong co project, URL va secrets tach biet.
- Given mot production release, when chua co approval hoac bat ky health/smoke gate fail, then production khong duoc promote.
- Given replica duoc bat, when goi replica health endpoint, then ket qua xac nhan dung replica va lag trong nguong.
- Given rollback dry-run, when chon previous Ready deployment, then script in dung target ma khong thay doi production.
- Given checklist Phase 7, when doi chieu runtime evidence, then moi checkbox xanh deu co workflow run, config hoac health check tuong ung.

## Verification

**Commands:**
- `npm.cmd run lint` -- 0 errors.
- `npm.cmd run build` -- production typecheck/build thanh cong.
- `npm.cmd run test:critical` -- tat ca critical suites pass.
- `npm.cmd run security:audit` va `npm.cmd run security:secrets` -- gates pass.
- `npm.cmd run db:migration:check` va zero-downtime policy test -- pass.
- `git diff --check` -- khong co whitespace errors.
- GitHub staging/production runs va Vercel deployment list -- staging Ready, production Ready sau approval.
- Production va replica health endpoints -- HTTP 200 voi trang thai healthy.


## Implementation Evidence

- npm.cmd run lint: pass, 0 errors (existing warnings remain non-blocking).
- npm.cmd run build: pass, Next.js production build generated 74 pages.
- npm.cmd run test:critical: 17 suites, 181 tests passed.
- Migration policy tests: 9 passed; migration policy command passed.
- npm.cmd run security:audit and npm.cmd run security:secrets: pass.
- Workflow YAML parsing, rollback shell syntax, and offline rollback dry-run: pass.
- git diff --check: pass.
- External pending: isolated staging project/database/secrets and paid Supabase Read Replica.