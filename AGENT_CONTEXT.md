# 專案上下文 (Agent Context)：BELLA SPA ERP

> **最後更新時間**：2026-05-22 11:05
> **自動生成**：由 `prepare_context.py` 產生，供 AI Agent 快速掌握專案全局

---

## 🎯 1. 專案目標 (Project Goal)
* **核心目的**：_（請手動補充，或建立 README.md）_

## 🛠️ 2. 技術棧與環境 (Tech Stack & Environment)
* **核心套件**：@sentry/nextjs, @supabase/ssr, @supabase/supabase-js, clsx, date-fns, dexie, framer-motion, lucide-react, next, react
* **開發套件**：@tailwindcss/postcss, @testing-library/jest-dom, @testing-library/react, @types/jest, @types/node, @types/react, @types/react-dom, eslint
* **可用指令**：dev, build, start, lint, test

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
    "test": "jest"
  },
  "dependencies": {
    "@sentry/nextjs": "^10.53.1",
    "@supabase/ssr": "^0.10.3",
    "@supabase/supabase-js": "^2.105.4",
    "clsx": "^2.1.1",
    "date-fns": "^4.1.0",
    "dexie": "^4.4.2",
    "framer-motion": "^12.38.0",
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
├── AGENTS.md
├── AGENT_CONTEXT.md
├── CLAUDE.md
├── FullLogo_Transparent_NoBuffer.png
├── IMPLEMENTATION_PLAN.md
├── bella-spa-erp
│   └── README.md
├── bella_spa_erp_audit_report.html
├── bella_spa_erp_audit_report.pdf
├── create-admin.js
├── diary
│   └── 2026
│       └── 05
├── docs
│   ├── BELLA_SPA_ERP_MASTER_GUIDE.md
│   ├── BELLA_SPA_ERP_MASTER_GUIDE.pdf
│   ├── BELLA_SPA_EXECUTIVE_SUMMARY.md
│   ├── BELLA_SPA_FRANCHISE_EXPANSION.md
│   ├── BELLA_SPA_STANDARDIZATION_PLAN.md
│   ├── BELLA_SPA_SYSTEM_EVALUATION.md
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
│   └── zero-mock-phase-1.md
├── eslint.config.mjs
├── fix_as_any.ps1
├── jest.config.ts
├── jest.setup.ts
├── next-env.d.ts
├── next.config.ts
├── package-lock.json
├── package.json
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
│   ├── logo.png
│   ├── newborn_baby_hand.png
│   ├── newborn_family_happy.png
│   ├── newborn_mother_love.png
│   ├── next.svg
│   ├── vercel.svg
│   └── window.svg
├── query_ktv.js
├── query_ktv2.js
├── scratch
│   ├── check_all_columns.js
│   ├── check_audit_table.js
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
│   ├── debug_user.py
│   ├── fix_booking_actions.py
│   ├── fix_packages_permissions.js
│   ├── migration_v1.js
│   ├── query.js
│   ├── query_packages.js
│   ├── test-query.js
│   ├── test.txt
│   ├── test_packages.js
│   └── update_booking.js
├── scripts
│   ├── seed-demo.mjs
│   └── simulate-realtime.mjs
├── sentry.client.config.ts
├── sentry.edge.config.ts
├── sentry.server.config.ts
├── src
│   ├── __tests__
│   │   ├── booking.test.ts
│   │   ├── e2e-pipeline.test.ts
│   │   ├── finance.lockMonth.test.ts
│   │   ├── finance.test.ts
│   │   ├── franchise-royalty.test.ts
│   │   ├── inter-branch-clearing.test.ts
│   │   ├── inventory-transfer.test.ts
│   │   ├── kpi-calculator.test.ts
│   │   ├── rate-limit.test.ts
│   │   ├── rls-compliance.test.ts
│   │   └── salary.test.ts
│   ├── app
│   │   ├── (auth)
│   │   ├── api
│   │   ├── book
│   │   ├── dashboard
│   │   ├── favicon.ico
│   │   ├── globals.css
│   │   ├── ktv
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── portal
│   ├── components
│   │   ├── common
│   │   ├── features
│   │   ├── layout
│   │   └── ui
│   ├── constants
│   ├── hooks
│   │   └── useOfflineSync.ts
│   ├── lib
│   │   ├── crypto.ts
│   │   ├── migration.ts
│   │   ├── offline-db.ts
│   │   ├── rate-limit.ts
│   │   ├── revalidate.ts
│   │   ├── supabase-client.ts
│   │   ├── supabase-server.ts
│   │   ├── utils.ts
│   │   └── validations.ts
│   ├── modules
│   │   ├── booking
│   │   └── hr-salary
│   ├── proxy.ts
│   ├── services
│   │   ├── attendance-actions.ts
│   │   ├── audit-actions.ts
│   │   ├── chat-actions.ts
│   │   ├── clearing-actions.ts
│   │   ├── crm-actions.ts
│   │   ├── customer-actions.ts
│   │   ├── dashboard-actions.ts
│   │   ├── export-actions.ts
│   │   ├── finance-actions.ts
│   │   ├── franchise-actions.ts
│   │   ├── inventory-actions.ts
│   │   ├── inventory-transfer-actions.ts
│   │   ├── ktv-actions.ts
│   │   ├── notification-actions.ts
│   │   ├── package-actions.ts
│   │   ├── reconciliation-actions.ts
│   │   ├── sync-actions.ts
│   │   ├── tenant-actions.ts
│   │   └── user-actions.ts
│   ├── store
│   ├── types
│   │   └── database.types.ts
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
│   │   ├── 20260522000000_enable_attendance_rls.sql
│   │   ├── 20260522010000_franchise_royalty_system.sql
│   │   ├── 20260522020000_inter_branch_clearing.sql
│   │   └── 20260522030000_inventory_transfer_orders.sql
│   ├── seed.sql
│   └── seed_demo_2026.sql
├── test-db-policies.js
├── test-db.js
├── test-notif-insert-2.js
├── test-notif-insert.js
├── test-rpc.js
├── test_startSession.js
├── test_upcoming.js
├── test_upcoming2.js
├── test_upcoming_auth.js
├── tsconfig.json
└── tsconfig.tsbuildinfo
```

## 🏛️ 4. 架構與設計約定 (Architecture & Conventions)
* _（尚無 `.auto-skill-local.md`，專案踩坑經驗將在開發過程中自動累積）_

## 🚦 5. 目前進度與待辦 (Current Status & TODO)
_(自動提取自最近日記 2026-05-22)_

### 🚧 待辦事項
- [x] Hoàn tất Step 1: Franchise Royalty Fee Auto-Billing (Tự động hóa phí nhượng quyền & VietQR sandbox)
- [x] Hoàn tất Step 2: Inter-branch Redemption & Clearing Engine (Bù đối chéo & VietQR đối soát thanh toán liên chi nhánh)
- [x] Hoàn tất Step 3: Internal Supply Chain & Inventory Transfer Order (Chuyển kho nội bộ, RLS an toàn & auto-init vật tư chi nhánh)
- [ ] Theo dõi luồng dữ liệu đồng bộ kho thực tế khi Tổng bộ xuất xưởng lô hàng đầu tiên.
- [ ] Mở rộng hệ thống cảnh báo qua Zalo/Email cho các chi nhánh khi lệnh chuyển kho được chuyển sang trạng thái "Đang vận chuyển".
- [ ] Bảo trì định kỳ và theo dõi dung lượng lưu trữ RLS database logs.
