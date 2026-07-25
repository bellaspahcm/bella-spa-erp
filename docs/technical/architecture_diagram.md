# 🏛️ Kiến Trúc Hệ Thống — Bella Spa ERP

> **Stack chính:** Next.js 15 (App Router) · Supabase (PostgreSQL + Auth + Realtime) · Expo React Native · Vercel · Sentry

---

## 1. Toàn Cảnh Monorepo

```mermaid
graph TD
    subgraph MONOREPO["📦 Monorepo Root — BELLA SPA ERP"]
        WEB["🌐 Web App\n/src (Next.js 15)"]
        MOBILE["📱 Mobile App\n/apps/mobile (Expo RN)"]
        SUPABASE["🗄️ Database\n/supabase (Migrations + Seed)"]
        SCRIPTS["⚙️ Scripts\n/scripts"]
        DOCS["📚 Docs\n/docs"]
        E2E["🧪 E2E Tests\n/e2e + /tests"]
        MCPSERVER["🔌 MCP Server\n/mcp-server"]
        OPENAPI["📋 OpenAPI\n/openapi"]
    end

    WEB --> SUPABASE
    MOBILE --> SUPABASE
    SCRIPTS --> SUPABASE
```

---

## 2. Kiến Trúc Web App (Next.js)

```mermaid
graph TD
    subgraph WEBAPP["🌐 src/ — Next.js 15 App Router"]

        subgraph ROUTES["app/ — Route Groups"]
            AUTH["(auth)/\n🔐 Login · Register · MFA"]
            DASH["dashboard/\n📊 Main ERP Dashboard"]
            HQ["hq/\n🏢 Headquarters Portal"]
            KTV["ktv/\n💆 KTV Mobile Web"]
            PORTAL["portal/\n👤 Customer Self-Service"]
            BOOK["book/\n📅 Public Booking Page"]
            STUDENT["student/\n🎓 Training Portal"]
            BSPA["beauty-spa/\n💅 Beauty Spa Module"]
            API_ROUTES["api/\n🔗 API Routes"]
        end

        subgraph COMPONENTS["components/"]
            COMP_FEATURES["features/\nDomain components"]
            COMP_UI["ui/\nBase UI kit (shadcn)"]
            COMP_LAYOUT["layout/\nShell · Sidebar · Nav"]
            COMP_COMMON["common/\nShared widgets"]
            COMP_PROVIDERS["providers/\nContext providers"]
            COMP_ACCOUNTING["accounting/\nAccounting UI"]
            COMP_ADMIN["admin/\nAdmin UI"]
        end

        subgraph SERVICES["services/ — Business Logic (Server Actions)"]
            SVC_BOOKING["booking-resource-actions\nattendance-actions\npackage-actions"]
            SVC_CUSTOMER["customer-actions\ncrm/\nmarketing/"]
            SVC_FINANCE["finance-actions\nrevenue-recognition\naccounting/\naccounting-engine"]
            SVC_SALARY["ktv-actions\nsalary-reconciliation-actions\nreconciliation-actions"]
            SVC_INVENTORY["inventory-actions\ninventory-transfer-actions\nclearing-actions"]
            SVC_AI["ai/orchestrator\nai/agents/(CFO·CHRO·CMO·CPO·Franchise)"]
            SVC_TENANT["tenant-actions\nonboarding-actions\nfranchise-actions"]
            SVC_SUBSCRIPTION["subscription-actions\nhq-subscription-actions"]
            SVC_TRAINING["training-actions"]
            SVC_NOTIFY["notification-actions\nchat-actions\nportal-chat-actions"]
            SVC_SYSTEM["system-monitor-actions"]
            SVC_APIGATEWAY["api-gateway/"]
        end

        subgraph LIB["lib/ — Utilities"]
            LIB_SUPA["supabase-server\nsupabase-client\nsupabase-admin"]
            LIB_BUSINESS["business-rules/"]
            LIB_ACCOUNTING["accounting-outbox\naccounting-outbox-monitoring"]
            LIB_SECURITY["rate-limit\ncrypto\nmfa\nlog-redactor"]
            LIB_CACHE["*-page-client-cache files"]
            LIB_API["api/ (API helpers)"]
            LIB_MIDDLEWARE["middleware/"]
            LIB_VALIDATION["validation/\nform-validators"]
        end

        subgraph TYPES["types/"]
            T_DB["database.types.ts\n(auto-generated)"]
            T_DOMAIN["domain.ts"]
            T_APIGATEWAY["api-gateway.ts"]
            T_TRAINING["training.ts"]
            T_RPC["rpc.ts"]
        end

        ROUTES --> SERVICES
        ROUTES --> COMPONENTS
        SERVICES --> LIB
        SERVICES --> TYPES
        COMPONENTS --> LIB
    end
```

---

## 3. Route Groups & Vai Trò Người Dùng

```mermaid
graph LR
    subgraph ROLES["👥 Vai Trò & Cổng Vào"]
        OWNER["👑 Owner / Admin\n/dashboard/admin"]
        MANAGER["👔 Manager\n/dashboard"]
        KTV_ROLE["💆 KTV\n/ktv · Mobile App"]
        CUSTOMER["👩 Khách Hàng\n/portal · /book"]
        HQ_ROLE["🏢 HQ Super Admin\n/hq"]
        PARTNER["🤝 Partner / Franchisor\n/dashboard/admin/partners"]
        STUDENT_ROLE["🎓 Học Viên\n/student"]
    end

    subgraph PAGES["📄 Trang Chính"]
        DASH_MAIN["Dashboard Tổng Quan"]
        BOOKING["Quản Lý Đặt Lịch"]
        SESSION["Phiên Dịch Vụ"]
        SALARY["Tính Lương KTV"]
        FINANCE["Tài Chính & P&L"]
        ACCOUNTING["Kế Toán (COA, Journals)"]
        INVENTORY["Kho & Chuyển Kho"]
        CRM_PAGE["CRM & Marketing"]
        TRAINING_PAGE["Đào Tạo"]
        AI_COPILOT["AI Copilot\n(CFO·CHRO·CMO·CPO)"]
        SYSTEM_MONITOR["System Monitor"]
        AUDIT["Audit Logs"]
        HQ_DASHBOARD["HQ Dashboard"]
        FRANCHISE_PAGE["Franchise Management"]
    end

    OWNER --> DASH_MAIN
    OWNER --> ACCOUNTING
    OWNER --> SALARY
    OWNER --> FINANCE
    OWNER --> INVENTORY
    OWNER --> AI_COPILOT
    MANAGER --> BOOKING
    MANAGER --> SESSION
    MANAGER --> CRM_PAGE
    KTV_ROLE --> SESSION
    KTV_ROLE --> SALARY
    HQ_ROLE --> HQ_DASHBOARD
    HQ_ROLE --> FRANCHISE_PAGE
    HQ_ROLE --> AI_COPILOT
    PARTNER --> FRANCHISE_PAGE
    STUDENT_ROLE --> TRAINING_PAGE
    CUSTOMER --> BOOKING
```

---

## 4. API Layer

```mermaid
graph TD
    subgraph APILAYER["🔗 API Routes — /src/app/api/"]
        AUTH_API["auth/\nOAuth callbacks · Session"]
        ADMIN_API["admin/\nAdmin-only operations"]
        CRON_API["cron/\nScheduled jobs"]
        HEALTH_API["health/\nHealth check"]
        TENANT_API["tenant/\nTenant provisioning"]
        V1_AI["v1/ai/\nAI Agent REST endpoints"]
        V1_ORDERS["v1/orders/\nOrder processing"]
        WEBHOOKS["webhooks/\nZalo · Meta · Payment gateway"]
    end

    subgraph MIDDLEWARE["🛡️ Middleware"]
        MW_AUTH["Auth Gate\n(Supabase session check)"]
        MW_TENANT["Tenant Resolver"]
        MW_RATE["Rate Limiter\n(distributed, Redis-like via DB)"]
        MW_REDIRECT["Route Guard\n(role-based redirect)"]
    end

    BROWSER["🌐 Browser / Client"] -->|"HTTP"| MW_AUTH
    MOBILE_APP["📱 Mobile App"] -->|"HTTPS"| MW_AUTH
    MW_AUTH --> MW_TENANT --> MW_RATE --> APILAYER
    MW_AUTH --> MW_REDIRECT
```

---

## 5. AI Copilot System

```mermaid
graph TD
    subgraph AI["🤖 AI Copilot — src/services/ai/"]
        ORCHESTRATOR["orchestrator.ts\n(Router & Context Builder)"]
        subgraph AGENTS["Chuyên Gia AI"]
            CFO_AGENT["💰 CFO Agent\nTài chính · P&L · Dòng tiền"]
            CHRO_AGENT["👥 CHRO Agent\nNhân sự · Lương · KPI · Nghỉ phép"]
            CMO_AGENT["📣 CMO Agent\nMarketing · CRM · Meta Ads · Zalo"]
            CPO_AGENT["📦 CPO Agent\nDịch vụ · Kho · Gói liệu trình"]
            FRANCHISE_AGENT["🏢 Franchise Agent\nFranchisor · Royalty · HQ Analytics"]
        end
    end

    subgraph AI_DB["🗄️ AI DB Tables"]
        AI_SESSIONS["ai_sessions"]
        AI_MESSAGES["ai_messages"]
        AI_TOOLS["ai_tool_calls"]
        AI_AUDIT["ai_audit_log"]
    end

    USER_QUERY["👤 User Query"] --> ORCHESTRATOR
    ORCHESTRATOR --> CFO_AGENT
    ORCHESTRATOR --> CHRO_AGENT
    ORCHESTRATOR --> CMO_AGENT
    ORCHESTRATOR --> CPO_AGENT
    ORCHESTRATOR --> FRANCHISE_AGENT

    CFO_AGENT --> AI_DB
    CHRO_AGENT --> AI_DB
    CMO_AGENT --> AI_DB
    CPO_AGENT --> AI_DB

    AI_DB -->|"Tool RPCs"| SUPABASE_AI[("Supabase RPCs\n(salary · finance · inventory)")]
```

---

## 6. Database Architecture (Supabase / PostgreSQL)

```mermaid
graph TD
    subgraph DB["🗄️ Supabase — PostgreSQL"]

        subgraph CORE_TABLES["Core Domain Tables"]
            TENANTS["tenants\n(multi-tenant root)"]
            USERS["users / profiles"]
            BOOKINGS["bookings"]
            SESSION_LOGS["session_logs"]
            REVENUE["revenue"]
            PACKAGES["packages\n(session_multiplier)"]
            CUSTOMERS_T["customers"]
            MEMBERSHIP["membership_records"]
        end

        subgraph HR_TABLES["HR & Payroll"]
            ATTENDANCE["attendance"]
            SALARY_RECORDS["salary_records\n(NUMERIC session count)"]
            KPI_RECORDS["kpi_records"]
            KTV_RATINGS["ktv_ratings"]
            STAFF_LEAVES["staff_leaves"]
        end

        subgraph FINANCE_TABLES["Finance & Accounting"]
            COA["chart_of_accounts"]
            JOURNALS["journal_entries\n+ journal_lines"]
            ACCOUNTING_PERIODS["accounting_periods"]
            OUTBOX["accounting_outbox\n(event-driven)"]
            WORKER_RUNS["accounting_worker_runs"]
            ROYALTY["franchise_royalty_records"]
            CLEARING["inter_branch_clearing_records"]
            RECONCILIATION["salary_reconciliation"]
        end

        subgraph INVENTORY_TABLES["Inventory"]
            PRODUCTS["products"]
            INVENTORY_TRANSACTIONS["inventory_transactions"]
            TRANSFER_ORDERS["inventory_transfer_orders"]
        end

        subgraph CRM_TABLES["CRM & Marketing"]
            PROMOTIONS["promotions"]
            META_ADS_ACCOUNTS["meta_ads_accounts"]
            ZALO_CONFIG["zalo_messaging_config"]
        end

        subgraph SUBSCRIPTION_TABLES["Subscription & Tenant Mgmt"]
            SUBSCRIPTION_PLANS["subscription_plans"]
            TENANT_SUBSCRIPTIONS["tenant_subscriptions"]
            USAGE_QUOTA["subscription_usage_quota"]
        end

        subgraph API_GATEWAY_TABLES["API Gateway"]
            API_PARTNERS["api_partners"]
            API_KEYS["api_keys"]
            API_REQUESTS["api_request_logs"]
            SANDBOX["api_sandbox_environments"]
        end

        subgraph TRAINING_TABLES["Training Module"]
            COURSES["training_courses"]
            LESSONS["training_lessons"]
            ENROLLMENTS["training_enrollments"]
            ASSESSMENTS["training_assessments"]
        end

        subgraph SYSTEM_TABLES["System & Audit"]
            AUDIT_LOGS["audit_logs"]
            NOTIFICATIONS["app_notifications"]
            CHAT_MESSAGES["chat_messages"]
            RATE_LIMITS["rate_limit_counters"]
            INVOICE_PRINT_LOGS["invoice_print_logs"]
        end

        TENANTS --> USERS
        TENANTS --> BOOKINGS
        TENANTS --> PACKAGES
        BOOKINGS --> SESSION_LOGS
        SESSION_LOGS --> REVENUE
        SESSION_LOGS --> ATTENDANCE
        ATTENDANCE --> SALARY_RECORDS
        KPI_RECORDS --> SALARY_RECORDS
        REVENUE --> JOURNALS
        OUTBOX --> JOURNALS
    end

    subgraph SUPABASE_FEATURES["⚡ Supabase Features"]
        RLS["Row-Level Security\n(tenant isolation)"]
        REALTIME["Realtime\n(live dashboard)"]
        STORAGE["Storage\n(receipts · photos)"]
        EDGE_FN["Edge Functions\n(webhooks)"]
        AUTH["Auth\n(email · magic link · MFA)"]
    end

    DB --> RLS
    DB --> REALTIME
    DB --> AUTH
```

---

## 7. Mobile App (Expo React Native)

```mermaid
graph TD
    subgraph MOBILE["📱 apps/mobile/"]
        subgraph M_APP["app/ — Expo Router Screens"]
            M_LOGIN["Login Screen"]
            M_DASHBOARD["KTV Dashboard"]
            M_SESSIONS["Today's Sessions"]
            M_CHECKIN["Check-in / Check-out\n(GPS validation)"]
            M_SALARY["Salary Overview"]
            M_NOTIFICATIONS["Notifications"]
        end

        subgraph M_SRC["src/"]
            M_SERVICES["services/\nsupabase calls + RPCs"]
            M_HOOKS["hooks/\n(data + error + retry)"]
            M_CONTEXTS["contexts/\nAuth · Tenant"]
            M_COMPONENTS["components/\nDashboardErrorState · etc"]
            M_LIB["lib/\nsupabase client"]
        end
    end

    subgraph MOBILE_RPCS["📡 Server-Side RPCs (Security Definer)"]
        RPC_KTV_STATS["rpc_ktv_dashboard_stats\n(filtered by assigned_ktv_id)"]
        RPC_TODAY_SESSIONS["rpc_get_today_sessions_for_ktv"]
        RPC_MOBILE["mobile_rpc.sql migrations"]
    end

    M_APP --> M_SRC
    M_SERVICES --> MOBILE_RPCS
    MOBILE_RPCS --> DB_ICON[("Supabase DB")]
```

---

## 8. Accounting Engine (Double-Entry)

```mermaid
graph LR
    subgraph ACCOUNTING_ENGINE["📒 Kế Toán Kép (Double-Entry)"]
        EVENTS["Business Events\n(booking confirmed,\nrevenue recognized,\nsalary paid)"]
        OUTBOX_EVT["accounting_outbox\n(event queue)"]
        WORKER["Accounting Worker\n(accounting-outbox.ts)"]
        JOURNAL["journal_entries\n+ journal_lines\n(debit = credit)"]
        REPORTS["Reports\n(Trial Balance · P&L\n· Cash Flow · Consolidated)"]
        PERIODS["accounting_periods\n(open / closed)"]
        TEMPLATES["accounting_templates\n(auto-mapping rules)"]
    end

    EVENTS -->|"Insert"| OUTBOX_EVT
    OUTBOX_EVT -->|"Cron / Trigger"| WORKER
    TEMPLATES --> WORKER
    WORKER -->|"Atomic insert"| JOURNAL
    PERIODS -->|"Guard"| JOURNAL
    JOURNAL --> REPORTS
```

---

## 9. Multi-Tenant & Franchise Architecture

```mermaid
graph TD
    subgraph FRANCHISE["🏢 Multi-Tenant / Franchise"]
        HQ_TENANT["HQ Super Tenant\n(brand owner)"]
        BRANCH_A["Branch A\n(tenant)"]
        BRANCH_B["Branch B\n(tenant)"]
        PARTNER_BRAND["Partner / Franchisor\n(tenant)"]
    end

    subgraph HQ_PORTAL["HQ Dashboard /hq/"]
        CONSOLIDATED_PNL["Consolidated P&L\n(elimination-aware)"]
        ROYALTY_MGT["Royalty Management"]
        BRANCH_PERF["Branch Performance"]
        SUBSCRIPTION_MGT["Subscription Management"]
    end

    subgraph ISOLATION["🔒 Isolation Mechanisms"]
        RLS_TENANT["RLS: tenant_id filter\non every table"]
        CLEARING_SYSTEM["Inter-Branch Clearing\n(outbox-driven)"]
        ELIMINATION["Intercompany Elimination\nin Consolidated P&L"]
    end

    HQ_TENANT --> HQ_PORTAL
    HQ_TENANT --> BRANCH_A
    HQ_TENANT --> BRANCH_B
    BRANCH_A --> CLEARING_SYSTEM
    BRANCH_B --> CLEARING_SYSTEM
    CLEARING_SYSTEM --> ELIMINATION
    RLS_TENANT --> BRANCH_A
    RLS_TENANT --> BRANCH_B
```

---

## 10. Tích Hợp Bên Ngoài (Third-Party)

```mermaid
graph LR
    subgraph INTEGRATIONS["🔌 Tích Hợp Bên Ngoài"]
        ZALO["Zalo OA\n(CRM messaging)"]
        META["Meta Ads\n(Facebook/Instagram campaigns)"]
        PAYMENT["Payment Gateway\n(webhook handler)"]
        SENTRY["Sentry\n(error monitoring)"]
        VERCEL_INT["Vercel\n(deployment · edge)"]
        OPENAI["OpenAI / Gemini\n(AI Copilot LLM)"]
    end

    subgraph HANDLERS["Handlers trong codebase"]
        ZALO_SVC["zalo-messaging.ts\nzalo-config.ts"]
        META_SVC["meta-ads.ts"]
        WEBHOOK_HANDLER["api/webhooks/\n(payment · zalo · meta)"]
        SENTRY_CFG["sentry.server.config.ts\nsentry.edge.config.ts"]
        AI_SVC["ai/orchestrator.ts"]
    end

    ZALO --> ZALO_SVC
    META --> META_SVC
    PAYMENT --> WEBHOOK_HANDLER
    SENTRY --> SENTRY_CFG
    OPENAI --> AI_SVC
```

---

## 11. CI/CD & Security Pipeline

```mermaid
graph TD
    subgraph CICD["⚙️ CI/CD & Security"]
        GITHUB[".github/\n(Actions workflows)"]
        SEMGREP["Semgrep\n(SAST scan)"]
        TRIVY["Trivy\n(dependency CVE)"]
        GITLEAKS["Gitleaks\n(secret scan)"]
        ESLINT["ESLint Strict\n(code quality)"]
        JEST["Jest Tests\n(unit + integration)"]
        PLAYWRIGHT["Playwright E2E\n(/e2e folder)"]
        BUILD["Next.js Build\n(type check + bundle)"]
    end

    subgraph DEPLOY["🚀 Deployment Targets"]
        VERCEL_PROD["Vercel Production\n(vercel.production.json)"]
        VERCEL_STAGING["Vercel Staging\n(vercel.staging.json)"]
        SUPABASE_PROD["Supabase Production"]
        SUPABASE_STAGING["Supabase Staging"]
    end

    GITHUB --> SEMGREP
    GITHUB --> TRIVY
    GITHUB --> GITLEAKS
    GITHUB --> ESLINT
    GITHUB --> JEST
    GITHUB --> PLAYWRIGHT
    GITHUB --> BUILD
    BUILD --> VERCEL_PROD
    BUILD --> VERCEL_STAGING
    GITHUB --> SUPABASE_PROD
    GITHUB --> SUPABASE_STAGING
```

---

## 12. Luồng Dữ Liệu Chính — Booking → Revenue → Accounting

```mermaid
sequenceDiagram
    participant C as 👩 Khách
    participant FE as 🌐 Web/Mobile
    participant SVC as ⚙️ Server Action
    participant DB as 🗄️ Supabase
    participant OUTBOX as 📬 Accounting Outbox
    participant WORKER as 🔄 Accounting Worker
    participant JOURNAL as 📒 Journal Entries

    C->>FE: Đặt lịch
    FE->>SVC: booking-resource-actions
    SVC->>DB: INSERT bookings (status=confirmed)
    DB->>DB: Trigger → insert revenue record
    DB->>OUTBOX: Insert outbox event (booking_confirmed)

    C->>FE: Check-in (GPS validate)
    FE->>SVC: attendance-actions (check-in)
    SVC->>DB: INSERT session_logs (check-in)

    C->>FE: Check-out
    FE->>SVC: attendance-actions (check-out)
    SVC->>DB: UPDATE session_logs (completed)
    DB->>DB: Trigger → deduct inventory
    DB->>OUTBOX: Insert outbox event (session_completed)

    WORKER->>OUTBOX: Poll pending events
    OUTBOX-->>WORKER: Events batch
    WORKER->>JOURNAL: atomic INSERT journal_entries\n(debit Revenue / credit Bank)
    WORKER->>OUTBOX: Mark processed
```

---

## 13. Tóm Tắt Công Nghệ

| Layer | Công Nghệ |
|---|---|
| **Frontend** | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, shadcn/ui |
| **Mobile** | Expo 56 (React Native), Expo Router, bare workflow |
| **Backend / BFF** | Next.js Server Actions, API Routes (Edge-compatible) |
| **Database** | Supabase (PostgreSQL 16), Row-Level Security, RPCs, Realtime |
| **Auth** | Supabase Auth (email, magic link, MFA) |
| **AI** | Multi-agent orchestrator (CFO/CHRO/CMO/CPO/Franchise) via OpenAI/Gemini |
| **Accounting** | Double-entry engine, outbox pattern, period closing workflow |
| **CRM / Messaging** | Zalo OA API, Meta Ads API |
| **Observability** | Sentry (error), System Monitor dashboard, Audit Logs |
| **Security** | Semgrep, Trivy, Gitleaks, distributed rate limiting, RLS |
| **Deployment** | Vercel (web), EAS (mobile), Supabase hosted (DB) |
| **Testing** | Jest (unit/integration), Playwright (E2E), load tests |

