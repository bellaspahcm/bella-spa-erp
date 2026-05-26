# 專案上下文 (Agent Context)：BELLA SPA ERP

> **最後更新時間**：2026-05-27 06:27
> **自動生成**：由 `prepare_context.py` 產生，供 AI Agent 快速掌握專案全局

---

## 🎯 1. 專案目標 (Project Goal)
* **核心目的**：_（請手動補充，或建立 README.md）_

## 🛠️ 2. 技術棧與環境 (Tech Stack & Environment)
* **核心套件**：@sentry/nextjs, @supabase/ssr, @supabase/supabase-js, clsx, date-fns, dexie, framer-motion, html-to-image, lucide-react, next
* **開發套件**：@playwright/test, @tailwindcss/postcss, @testing-library/jest-dom, @testing-library/react, @types/jest, @types/node, @types/react, @types/react-dom
* **可用指令**：dev, build, start, lint, test, e2e, e2e:ui, e2e:headed, e2e:debug, e2e:report, load:smoke, load:dashboard, load:stress, load:spike, load:soak, load:soak:short, load:report

### 原始設定檔

<details><summary>package.json</summary>

```json
{
  "name": "bella-spa-erp",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "test": "jest",
    "e2e": "playwright test",
    "e2e:ui": "playwright test --ui",
    "e2e:headed": "playwright test --headed",
    "e2e:debug": "playwright test --debug",
    "e2e:report": "playwright show-report",
    "load:smoke": "k6 run load-tests/scripts/01-smoke.js",
    "load:dashboard": "k6 run load-tests/scripts/02-dashboard-load.js",
    "load:stress": "k6 run load-tests/scripts/03-booking-stress.js",
    "load:spike": "k6 run load-tests/scripts/04-login-spike.js",
    "load:soak": "k6 run load-tests/scripts/05-checkout-soak.js",
    "load:soak:short": "k6 run -e SOAK_MINUTES=5 load-tests/scripts/05-checkout-soak.js",
    "load:report": "k6 run --out json=load-tests/results/result.json load-tests/scripts/01-smoke.js"
  },
  "dependencies": {
    "@sentry/nextjs": "^10.53.1",
    "@supabase/ssr": "^0.10.3",
    "@supabase/supabase-js": "^2.105.4",
    "clsx": "^2.1.1",
    "date-fns": "^4.1.0",
    "dexie": "^4.4.2",
    "framer-motion": "^12.38.0",
    "html-to-image": "^1.11.13",
    "lucide-react": "^1.14.0",
    "next": "16.2.6",
    "react": "19.2.4",
    "react-dom": "19.2.4",
    "recharts": "^3.8.1",
    "sonner": "^2.0.7",
    "tailwind-merge": "^3.6.0",
    "xlsx": "^0.18.5",
    "zod": "^4.4.3",
    "zustand": "^5.0.13"
  },
  "devDependencies": {
    "@playwright/test": "^1.60.0",
    "@tailwindcss/postcss": "^4",
    "@testing-library/jest-dom": "^6.9.1",
    "@testing-library/react": "^16.3.2",
    "@types/jest": "^30.0.0",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "eslint": "^9",
    "eslint-config-next": "16.2.6",
    "jest": "^30.4.2",
    "jest-environment-jsdom": "^30.4.1",
    "md-to-pdf": "^5.2.5",
    "tailwindcss": "^4",
    "ts-node": "^10.9.2",
    "typescript": "^5"
  }
}

```
</details>

## 📂 3. 核心目錄結構 (Core Structure)
_(💡 AI 讀取守則：請依據此結構尋找對應檔案，勿盲目猜測路徑)_
```text
BELLA SPA ERP/
├── 2026-05-21.md
├── 2026-05-22.md
├── 2026-05-23.md
├── 2026-05-25.md
├── 2026-05-26.md
├── 2026-05-27.md
├── AGENTS.md
├── AGENT_CONTEXT.md
├── CLAUDE.md
├── FullLogo_Transparent_NoBuffer.png
├── IMPLEMENTATION_PLAN.md
├── bella-spa-erp
│   └── README.md
├── bella_ai_erp_implementation_plan.html
├── bella_spa_erp_audit_report.html
├── bella_spa_erp_audit_report.pdf
├── bella_spa_erp_audit_report_2026_05_21.html
├── comprehensive_test_plan.html
├── create-admin.js
├── diary
│   └── 2026
│       └── 05
├── docs
│   ├── BELLA_AI_ERP_PROGRESS.md
│   ├── BELLA_SPA_ERP_MASTER_GUIDE.md
│   ├── BELLA_SPA_ERP_MASTER_GUIDE.pdf
│   ├── BELLA_SPA_EXECUTIVE_SUMMARY.md
│   ├── BELLA_SPA_FRANCHISE_EXPANSION.md
│   ├── BELLA_SPA_SECURITY_UPDATE_REPORT_2026_05_21.md
│   ├── BELLA_SPA_STANDARDIZATION_PLAN.md
│   ├── BELLA_SPA_SYSTEM_EVALUATION.md
│   ├── BELLA_SPA_SYSTEM_EVALUATION_2026_05_21.md
│   ├── BELLA_SPA_TECHNICAL_SPEC.md
│   ├── KNOWLEDGE_AUTH.md
│   ├── KNOWLEDGE_MAINTENANCE_LOG.md
│   ├── KTV_CHANGE_AND_SALARY_LOGIC.md
│   ├── KTV_KPI_EVALUATION_SYSTEM_SPEC.md
│   ├── KTV_TEST_ACCEPTANCE.md
│   ├── MULTI_BRANCH_AND_FRANCHISE_SPEC.md
│   ├── README.md
│   ├── bella_spa_demo.html
│   ├── bella_spa_demo_guide.md
│   ├── bella_spa_erp_complete.md
│   ├── convert.js
│   ├── plans
│   │   ├── 2026-05-18-hr-attendance.md
│   │   └── OFFLINE_SYNC_STRATEGY.md
│   ├── user-manuals
│   │   ├── accountant.html
│   │   ├── admin.html
│   │   ├── hr.html
│   │   ├── index.html
│   │   ├── ktv.html
│   │   └── sop.html
│   └── zero-mock-phase-1.md
├── e2e
│   ├── README.md
│   ├── fixtures
│   │   └── auth.ts
│   ├── helpers
│   │   ├── supabase-admin.ts
│   │   └── ui.ts
│   └── tests
│       ├── 01-booking-creation.spec.ts
│       ├── 02-session-checkin-checkout.spec.ts
│       ├── 03-bank-reconciliation.spec.ts
│       ├── 04-period-closing.spec.ts
│       └── 05-payroll-finalization.spec.ts
├── eslint.config.mjs
├── fix_as_any.ps1
├── generate-report.js
├── jest.config.ts
├── jest.setup.ts
├── load-tests
│   ├── README.md
│   ├── config
│   │   ├── env.js
│   │   └── thresholds.js
│   ├── helpers
│   │   ├── auth.js
│   │   └── data.js
│   ├── results
│   └── scripts
│       ├── 01-smoke.js
│       ├── 02-dashboard-load.js
│       ├── 03-booking-stress.js
│       ├── 04-login-spike.js
│       └── 05-checkout-soak.js
├── mcp-server
│   ├── package-lock.json
│   ├── package.json
│   ├── src
│   │   ├── db.ts
│   │   ├── index.ts
│   │   ├── prompts.ts
│   │   ├── resources.ts
│   │   └── tools.ts
│   └── tsconfig.json
├── next-env.d.ts
├── next.config.ts
├── package-lock.json
├── package.json
├── playwright-report
│   └── index.html
├── playwright-results.json
├── playwright.config.ts
├── postcss.config.mjs
├── public
│   ├── FullLogo_Transparent_NoBuffer.png
│   ├── banner_tam_be.png
│   ├── bella_real_1.jpg
│   ├── bella_real_2.jpg
│   ├── bella_real_3.jpg
│   ├── bella_real_4.jpg
│   ├── file.svg
│   ├── globe.svg
│   ├── home_baby_care.png
│   ├── icons
│   │   ├── icon-192x192.png
│   │   └── icon-512x512.png
│   ├── images
│   │   ├── logo.png
│   │   └── receipt-bg.png
│   ├── logo.png
│   ├── manifest.json
│   ├── newborn_baby_hand.png
│   ├── newborn_family_happy.png
│   ├── newborn_mother_love.png
│   ├── next.svg
│   ├── sw.js
│   ├── vercel.svg
│   └── window.svg
├── scratch
│   ├── accounting_cleanup.sql
│   ├── apply_fix_via_pg.mjs
│   ├── check_all_columns.js
│   ├── check_audit_table.js
│   ├── check_column_types.mjs
│   ├── check_columns.js
│   ├── check_columns.ts
│   ├── check_customer_data.js
│   ├── check_finance_data.js
│   ├── check_ids.js
│   ├── check_ktv_shifts.js
│   ├── check_real_project.js
│   ├── check_salary.js
│   ├── check_user_tenant.js
│   ├── create_table_attempt.js
│   ├── debug_finance.ts
│   ├── debug_reconciliation.mjs
│   ├── debug_user.py
│   ├── diagnose_function.sql
│   ├── fix_booking_actions.py
│   ├── fix_packages_permissions.js
│   ├── fix_reconciliation_auth.sql
│   ├── fix_reconciliation_v2.sql
│   ├── generate_icons.py
│   ├── migration_v1.js
│   ├── query.js
│   ├── query_packages.js
│   ├── query_tenants.js
│   ├── test-query.js
│   ├── test.txt
│   ├── test_gemini.js
│   ├── test_keys.js
│   ├── test_packages.js
│   ├── test_regex.js
│   ├── trigger_sync_local.js
│   └── update_booking.js
├── scripts
│   ├── README-reset.md
│   ├── check_exec_sql.mjs
│   ├── db-reset.js
│   ├── debug
│   │   ├── query_ktv.js
│   │   ├── query_ktv2.js
│   │   ├── test-db-policies.js
│   │   ├── test-db.js
│   │   ├── test-notif-insert-2.js
│   │   ├── test-notif-insert.js
│   │   ├── test-rpc.js
│   │   ├── test_startSession.js
│   │   ├── test_upcoming.js
│   │   ├── test_upcoming2.js
│   │   └── test_upcoming_auth.js
│   ├── encrypt_telegram_tokens.mjs
│   ├── reset-customer-data.sql
│   ├── seed-demo.mjs
│   ├── simulate-realtime.mjs
│   └── verify-reset.sql
├── security-report-2026-05-25.html
├── sentry.client.config.ts
├── sentry.edge.config.ts
├── sentry.server.config.ts
├── src
│   ├── __tests__
│   │   ├── accounting-engine.test.ts
│   │   ├── accounting-outbox.test.ts
│   │   ├── accounting-reports.test.ts
│   │   ├── ai-agent.test.ts
│   │   ├── ai-coo-agents.test.ts
│   │   ├── booking.test.ts
│   │   ├── brand-service-master.test.ts
│   │   ├── cash-flow.test.ts
│   │   ├── consolidated-pnl.test.ts
│   │   ├── dual-mode-accounting.test.ts
│   │   ├── e2e-negative-pipeline.test.ts
│   │   ├── e2e-pipeline.test.ts
│   │   ├── finance.lockMonth.test.ts
│   │   ├── finance.test.ts
│   │   ├── form-validators.test.ts
│   │   ├── franchise-royalty.test.ts
│   │   ├── hq-audit-explorer.test.ts
│   │   ├── inter-branch-clearing.test.ts
│   │   ├── inventory-transfer.test.ts
│   │   ├── kpi-calculator.test.ts
│   │   ├── log-redactor.test.ts
│   │   ├── onboarding.test.ts
│   │   ├── period-closing.test.ts
│   │   ├── rate-limit.test.ts
│   │   ├── reconciliation.test.ts
│   │   ├── rls-compliance.test.ts
│   │   ├── salary-reconciliation.test.ts
│   │   ├── salary.test.ts
│   │   ├── subscription.test.ts
│   │   ├── utils.test.ts
│   │   └── validations.test.ts
│   ├── app
│   │   ├── (auth)
│   │   ├── api
│   │   ├── book
│   │   ├── dashboard
│   │   ├── favicon.ico
│   │   ├── globals.css
│   │   ├── hq
│   │   ├── ktv
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── portal
│   ├── components
│   │   ├── common
│   │   ├── features
│   │   ├── layout
│   │   └── ui
│   ├── config
│   │   └── ai-constants.ts
│   ├── constants
│   ├── hooks
│   │   └── useOfflineSync.ts
│   ├── lib
│   │   ├── accounting-outbox.ts
│   │   ├── crypto.ts
│   │   ├── form-validators.ts
│   │   ├── log-redactor.ts
│   │   ├── mfa.ts
│   │   ├── migration.ts
│   │   ├── offline-db.ts
│   │   ├── rate-limit.ts
│   │   ├── revalidate.ts
│   │   ├── safe-logger.ts
│   │   ├── subscription.ts
│   │   ├── supabase-client.ts
│   │   ├── supabase-server.ts
│   │   ├── utils.ts
│   │   └── validations.ts
│   ├── modules
│   │   ├── booking
│   │   └── hr-salary
│   ├── proxy.ts
│   ├── services
│   │   ├── accounting-actions.ts
│   │   ├── accounting-engine.ts
│   │   ├── ai-coo-service.ts
│   │   ├── attendance-actions.ts
│   │   ├── audit-actions.ts
│   │   ├── brand-service-actions.ts
│   │   ├── chat-actions.ts
│   │   ├── clearing-actions.ts
│   │   ├── crm-actions.ts
│   │   ├── customer-actions.ts
│   │   ├── dashboard-actions.ts
│   │   ├── export-actions.ts
│   │   ├── finance-actions.ts
│   │   ├── franchise-actions.ts
│   │   ├── hq-actions.ts
│   │   ├── inventory-actions.ts
│   │   ├── inventory-transfer-actions.ts
│   │   ├── ktv-actions.ts
│   │   ├── notification-actions.ts
│   │   ├── onboarding-actions.ts
│   │   ├── package-actions.ts
│   │   ├── reconciliation-actions.ts
│   │   ├── revenue-recognition.ts
│   │   ├── salary-reconciliation-actions.ts
│   │   ├── subscription-actions.ts
│   │   ├── sync-actions.ts
│   │   ├── tenant-actions.ts
│   │   └── user-actions.ts
│   ├── store
│   ├── types
│   │   ├── database.types.ts
│   │   └── domain.ts
│   └── utils
│       └── geo.ts
├── supabase
│   ├── config.toml
│   ├── fix_and_seed_final.sql
│   ├── migrations
│   │   ├── 20260511000000_initial_schema.sql
│   │   ├── 20260512000000_fix_permissions.sql
│   │   ├── 20260514000000_add_gender_baby.sql
│   │   ├── 20260514000000_audit_logs.sql
│   │   ├── 20260515000000_standardization_phase_1.sql
│   │   ├── 20260515000001_dashboard_optimization.sql
│   │   ├── 20260515010000_the_great_purge.sql
│   │   ├── 20260515020000_finance_automation_pnl.sql
│   │   ├── 20260515030000_ktv_mobile_experience.sql
│   │   ├── 20260515040000_create_packages_table.sql
│   │   ├── 20260515050000_fix_bookings_missing_columns.sql
│   │   ├── 20260515224956_fix_chat_rpc.sql
│   │   ├── 20260516000000_financial_reconciliation.sql
│   │   ├── 20260516000001_audit_logs.sql
│   │   ├── 20260516000002_fix_chat_schema.sql
│   │   ├── 20260516000003_fix_chat_rpc_ambiguous.sql
│   │   ├── 20260516000004_add_discount_percent.sql
│   │   ├── 20260516000005_financial_reconciliation_discount_fix.sql
│   │   ├── 20260518000000_disable_attendance_rls.sql
│   │   ├── 20260518000001_fix_ktv_leaderboard_approved_reviews.sql
│   │   ├── 20260518000002_optimize_booking_triggers.sql
│   │   ├── 20260519000000_ktv_duration_kpi_system.sql
│   │   ├── 20260519010000_staff_leaves.sql
│   │   ├── 20260519020000_add_rejection_reason_to_staff_leaves.sql
│   │   ├── 20260520000000_add_zalo_config_to_tenants.sql
│   │   ├── 20260520000001_add_bank_details_to_tenants.sql
│   │   ├── 20260520000002_fix_staff_leaves_permissions.sql
│   │   ├── 20260520000003_audit_all_tables.sql
│   │   ├── 20260520000004_add_role_permissions.sql
│   │   ├── 20260520000005_drop_password_hash.sql
│   │   ├── 20260520000006_enable_core_rls.sql
│   │   ├── 20260520000007_add_salary_config_to_tenants.sql
│   │   ├── 20260520000008_fix_audit_trigger_exception.sql
│   │   ├── 20260520000009_add_tenants_update_policy.sql
│   │   ├── 20260521000001_add_gps_to_session_logs.sql
│   │   ├── 20260521000001_fix_rls_security.sql
│   │   ├── 20260521000002_lock_month_guards.sql
│   │   ├── 20260521000003_create_app_notifications.sql
│   │   ├── 20260521000004_harden_rls_and_tenant.sql
│   │   ├── 20260521000005_tenant_onboarding.sql
│   │   ├── 20260521000006_subscription_engine.sql
│   │   ├── 20260522000000_enable_attendance_rls.sql
│   │   ├── 20260522010000_franchise_royalty_system.sql
│   │   ├── 20260522020000_inter_branch_clearing.sql
│   │   ├── 20260522030000_inventory_transfer_orders.sql
│   │   ├── 20260522040000_brand_service_master.sql
│   │   ├── 20260523000000_fix_create_onboarding_user.sql
│   │   ├── 20260523010000_harden_all_database_rls.sql
│   │   ├── 20260523020000_add_receipt_url_to_revenue.sql
│   │   ├── 20260523020000_get_user_by_email_rpc.sql
│   │   ├── 20260523030000_grant_service_role_schema_access.sql
│   │   ├── 20260523040000_fix_hq_super_admin_rls.sql
│   │   ├── 20260524000000_accounting_core.sql
│   │   ├── 20260525000000_security_hardening.sql
│   │   ├── 20260525100000_accounting_rls_harden.sql
│   │   ├── 20260525110000_seed_default_coa.sql
│   │   ├── 20260525120000_accounting_periods_auto.sql
│   │   ├── 20260525130000_accounting_outbox.sql
│   │   ├── 20260525140000_onboard_with_coa.sql
│   │   ├── 20260525150000_accounting_reports.sql
│   │   ├── 20260525160000_accounting_grants.sql
│   │   ├── 20260525170000_period_closing_workflow.sql
│   │   ├── 20260525180000_cash_flow_statement.sql
│   │   ├── 20260525190000_consolidated_pnl_hq.sql
│   │   ├── 20260525200000_fix_consolidated_pnl_ambiguous.sql
│   │   ├── 20260525210000_reconciliation_report.sql
│   │   ├── 20260525220000_fix_function_grants.sql
│   │   ├── 20260525230000_fix_reconciliation_date_types.sql
│   │   ├── 20260526000000_ai_agent_infrastructure.sql
│   │   ├── 20260526010000_ai_agent_salary_tools.sql
│   │   ├── 20260526020000_allow_service_role_ai_rpc.sql
│   │   ├── 20260526030000_ai_security_hardening.sql
│   │   ├── 20260526040000_fix_attendance_logic.sql
│   │   ├── 20260526040000_salary_reconciliation.sql
│   │   ├── 20260526040000_salary_reconciliation_report.sql
│   │   ├── 20260526050000_dual_mode_accounting.sql
│   │   └── 20260526060000_add_hr_role.sql
│   ├── seed.sql
│   └── seed_demo_2026.sql
├── test-execution-report.html
├── test-results
├── test-results-fresh.json
├── test-results.json
├── test-summary.json
├── tsconfig.json
├── tsconfig.tsbuildinfo
└── vercel.json
```

## 🏛️ 4. 架構與設計約定 (Architecture & Conventions)
* _（尚無 `.auto-skill-local.md`，專案踩坑經驗將在開發過程中自動累積）_

## 🚦 5. 目前進度與待辦 (Current Status & TODO)
_(自動提取自最近日記 2026-05-27)_

### 🚧 待辦事項
- [ ] Tiếp tục theo dõi phản hồi thực tế từ khách hàng về giao diện đặt lịch.
- [ ] Kiểm thử kỹ lưỡng hành vi đặt lịch trên các thiết bị di động để đảm bảo độ mượt mà khi cuộn và hiệu năng chuyển trang.

