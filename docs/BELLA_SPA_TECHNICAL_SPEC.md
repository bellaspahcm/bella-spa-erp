# Bella Spa ERP - Technical Specification
**Version:** 2.7  
**Last Updated:** 2026-05-19 (15:50)  
**Status:** Implementation Phase (Phase 25: Landing Page Visual Refinements & Mobile Drawer Optimization - Completed)

---

## 🚀 PROJECT OVERVIEW

**Business:** Vietnamese postpartum mother & baby spa (bathing, massage, lactation support)  
**System:** Full-stack ERP replacing Excel operations  
**Scope Phase 1:** MVP — Booking, Staff Schedule, Service Tracking, Basic Finance  
**Timeline Phase 1:** 6-8 weeks  
**Team Size:** 2-3 developers  

---

## 🚀 CORE ARCHITECTURE PRINCIPLES
1. **Serverless First**: Toàn bộ logic Backend được xử lý qua Next.js Server Actions và API Routes (Edge/Serverless Runtime). Không duy trì server chạy 24/7.
2. **Database-as-API**: Tận dụng tối đa Supabase SDK để truy vấn dữ liệu. Logic bảo mật (Authorization) phải được cài đặt ở tầng Database (RLS).
3. **Hybrid Rendering**: 
   - **Server Components (RSC)**: Mặc định cho toàn bộ trang để tối ưu SEO và bảo mật dữ liệu nhạy cảm.
   - **Client Components**: Chỉ sử dụng cho các thành phần cần tương tác (Form, Animation, Real-time Chat).
4. **Design Driven**: Giao diện phải tuân thủ triết lý "Premium & Modern" — sử dụng Tailwind v4 cho styling và Framer Motion cho micro-interactions.
5. **Modular Design**: Kiến trúc phân tách theo tính năng (Feature-based), giúp hệ thống dễ dàng mở rộng và bảo mật theo từng domain (Customers, Bookings, Finance, Salary, Inventory).

---

## 🏗️ TECH STACK (MANDATORY)

### 1. Frontend (Web & Mobile Web)
- **Framework**: Next.js 16 (phiên bản mới nhất) + React 19.
- **Ngôn ngữ**: TypeScript (Strict Mode).
- **Styling**: Tailwind CSS v4 (CSS-first engine).
- **Animations**: Framer Motion (cho hiệu ứng chuyển trang và bento-grid).
- **Icons**: Lucide React.
- **Data Visualization**: Recharts (Dashboard tài chính).
- **State Management**: Zustand (Client state) & TanStack Query (Server state caching).

### 2. Backend & Database (Supabase Cloud)
- **Database**: PostgreSQL (Managed by Supabase).
- **Auth**: Supabase Auth (OAuth, Email, OTP).
- **Real-time**: Supabase Realtime (cho thông báo và lịch hẹn).
- **Storage**: Supabase Storage (Lưu trữ hình ảnh KTV, nhật ký bé).
- **Edge Functions**: Deno (nếu cần xử lý logic nặng ngoài Next.js).

### 3. Infrastructure
- **Platform**: Vercel.
- **CI/CD**: GitHub Actions tích hợp Vercel Workflow.
- **Monitoring**: Sentry (Error tracking) & Logtail (Log management).

---

## 📊 DATABASE SCHEMA (16 Core Tables)

All tables include `tenant_id` UUID for multi-tenant support (Phase 3).

### 1. USERS
```sql
id (UUID) | email | password_hash | full_name | phone | role 
(admin|ktv_lead|ktv|admin_staff|accountant) | avatar_url | status | tenant_id
```

### 2. CUSTOMERS
```sql
id | phone (UNIQUE) | name_mother | name_baby | dob_baby | dob_expected 
| address | referrer_id (FK) | zalo_oa_id | status | notes | tenant_id
```

### 3. BOOKINGS
```sql
id | booking_number (UNIQUE: BK-YYMMDD-NNN) | customer_id (FK) | package_id (FK)
| status (inquiry|deposit_pending|booked|in_progress|completed|cancelled)
| deposit_amount | full_price | start_date | end_date | expected_birth_date
| assigned_ktv_id (FK) | ktv_commission (Locked rate) | tenant_id
```

### 4. SESSION_LOGS (Immutable — only INSERT, never UPDATE/DELETE)
```sql
id | booking_id (FK) | session_number (1-21) | assigned_date | completed_date
| completed_by_ktv_id (FK) | address | status (scheduled|completed|cancelled)
| created_at (IMMUTABLE) | tenant_id | is_confirmed (BOOLEAN)

INDEX: booking_id, completed_date
```

### 5. SESSION_REVIEWS (Encrypted Note Field)
```sql
id | session_log_id (FK) | reviewer_id (FK customer) | ktv_id (FK)
| rating (1-5, NOT NULL) | note (TEXT, encrypted AES-256)
| note_encrypted (BOOLEAN, default TRUE)
| is_hidden_from_ktv (BOOLEAN, default TRUE) ← KTV NEVER sees note
| status (pending_review|approved|published) | created_at | tenant_id

INDEX: ktv_id, session_log_id
SECURITY: SELECT notes requires role=admin/manager, audit logged
BUSINESS LOGIC: Approved ratings directly calculate monthly KTV performance bonuses.
```

### 6. KTV_SCHEDULE
```sql
id | ktv_id (FK) | date | status (free_full|free_partial|full|off)
| off_paid (BOOLEAN) | note | tenant_id

UNIQUE INDEX: (ktv_id, date)
```

### 7. SHIFTS
```sql
id | ktv_id (FK) | date | start_time | end_time | booking_id (FK)
| customer_id (FK) | address
| checkin_time | checkin_lat | checkin_lon (GPS)
| checkout_time | checkout_lat | checkout_lon (GPS)
| status (scheduled|completed|cancelled) | tenant_id

INDEX: (ktv_id, date), status
```

### 8. REVENUE
```sql
id | booking_id (FK) | amount | revenue_type (deposit|session_completed|additional)
| payment_method (cash|bank_transfer|zalo_pay|momo) | received_date
| recorded_by_id (FK) | status (pending|confirmed) | notes | tenant_id

INDEX: booking_id, received_date
```

### 9. EXPENSES
```sql
id | category (office|transport|marketing|etc.) | amount
| description | receipt_url | expense_date | approved_by_id (FK)
| status (submitted|approved|rejected) | submitted_by_id (FK) | tenant_id

INDEX: category, expense_date
```

### 10. SALARY_RECORDS
```sql
id | ktv_id (FK) | month_year (DATE) | base_salary | session_commission_total
| kpi_bonus | violations_deduction | total_salary | total_sessions (INT)
| status (draft|pending_approval|approved|paid) | paid_date | paid_method | tenant_id

INDEX: (ktv_id, month_year)
NOTE: session_commission_total is sum of ktv_commission from completed sessions.
```

### 11. ATTENDANCE
```sql
id | ktv_id (FK) | date | checkin_time | checkout_time | shift_id (FK)
| status (present|late|absent|half_day) | tenant_id

UNIQUE INDEX: (ktv_id, date)
NOTE: Auto-generated from shift check-in/out
```

### 12. KPI_RECORDS
```sql
id | ktv_id (FK) | month_year | sessions_completed | on_time_rate (%)
| customer_satisfaction (AVG rating) | violations_count
| target_sessions | kpi_achievement_rate (%) | bonus_amount | notes | tenant_id

INDEX: (ktv_id, month_year)
```

### 13. CHAT_THREADS
```sql
id | thread_type (booking|general|team) | booking_id (FK, if booking)
| team_id (FK, if team) | channel_name | created_by_id (FK)
| archived (BOOLEAN) | archived_at | tenant_id | created_at
```

### 14. CHAT_MESSAGES
```sql
id | thread_id (FK) | sender_id (FK) | content | message_type (text|system|file)
| file_url | edited_at | deleted_at (soft delete) | tenant_id | created_at

INDEX: (thread_id, created_at)
```

### 15. MEMBERSHIP_RECORDS
```sql
id | customer_id (FK) | tier (silver|gold|diamond) | total_points
| points_used | tier_upgrade_date | expires_at | benefits_redeemed (TEXT[])
| tenant_id | created_at | updated_at
```

### 16. TENANTS
```sql
id | name | parent_tenant_id (FK, if franchise) | franchise_agreement_date
| royalty_rate (DECIMAL %) | contact_name | contact_phone | address
| status (active|suspended|terminated) | created_at | updated_at
```

---

## 🔌 CORE API ENDPOINTS (Phase 1 MVP)

### Auth
```
POST   /api/v1/auth/login               → { access_token, refresh_token }
POST   /api/v1/auth/refresh             → { access_token }
POST   /api/v1/auth/logout              → void
```

### Customers
```
POST   /api/v1/customers                → { id, phone, name_mother, ... }
GET    /api/v1/customers                → [Customer] (with filter by status)
GET    /api/v1/customers/:id            → Customer + referrer info
PATCH  /api/v1/customers/:id            → updated Customer
```

### Bookings
```
POST   /api/v1/bookings                 → { id, booking_number, status: 'deposit_pending' }
GET    /api/v1/bookings                 → [Booking] (filter by status, date range)
GET    /api/v1/bookings/:id             → Booking + sessions array
PATCH  /api/v1/bookings/:id/status      → { status: 'booked' }
GET    /api/v1/bookings/:id/sessions    → [SessionLog] (array of 21 sessions)
```

### Schedule
```
GET    /api/v1/schedule/:year/:month    → { days: [{ date, status, count, ktv[] }] }
GET    /api/v1/schedule/:date/timeline  → [{ shift, ktv, time, customer, address }]
POST   /api/v1/schedule/assign-shift    → { shift_id, ktv_id, success: true }
```

### Sessions (Thẻ Liệu Trình)
```
POST   /api/v1/sessions/:id/complete    → Popup confirm, then INSERT session_log
GET    /api/v1/bookings/:id/sessions    → Array of 21 session logs
```

### Finance Dashboard
```
GET    /api/v1/finance/dashboard?period=month&month=5 
       → { revenue, expenses, profit, customerCount, sessionCount, metrics[] }
```

---

## 🎯 PHASE 1 DELIVERABLES (MVP - 6-8 weeks)

### ✅ Must Have
1. **User Management**
   - Login/logout (JWT)
   - 5 role-based access (admin, ktv_lead, ktv, admin_staff, accountant)
   - Password reset (OTP via Zalo, Phase 2)

2. **Customer Management**
   - Add/edit customer (name, phone, address, dob_baby, dob_expected)
   - List with filter (active, completed, etc.)

3. **Booking System**
   - Create booking (select package, deposit amount, cọc)
   - List bookings with status filter
   - Auto-generate 21 session logs when booking created
   - Session grid (7×3, greyed out)

4. **KTV Schedule**
   - Month calendar view (grid 7 columns)
   - Color coding: green (free) / yellow (partial) / red (full) / gray (off)
   - Timeline view per day (07:00-19:00)
   - Filter by KTV name

5. **Session Completion**
   - KTV marks session complete (popup confirmation)
   - Auto-send notification to customer
   - Update session_log.completed_date

6. **Finance Dashboard**
   - Revenue this month (total deposits + completed sessions)
   - Expense list (submitted, approved)
   - Simple bar chart (this month vs last month)
   - KPI summary per KTV (# sessions, ratings)

7. **Basic Reports**
   - Monthly P&L
   - KTV utilization
   - Customer acquisition

### ⏭️ Phase 2 (Not Phase 1)
- Electronic contract signature (OTP Zalo)
- GPS check-in/out
- Auto salary calculation
- Chat internal
- KTV review system
- Baby journal with photos

---

## 🔐 SECURITY REQUIREMENTS (Phase 1)

1. **Authentication & Identity**
   - **Supabase Auth**: Sử dụng cơ chế JWT tự động (expiry 1h), Refresh Token (7 days).
   - **Secure Auth flow**: Sử dụng PKCE flow cho Client-side và `auth-helpers-nextjs` (hoặc `@supabase/ssr`) cho Server-side.
   - **Rate limit**: Tích hợp sẵn bởi Supabase & Vercel Edge Middleware.

2. **Authorization (RBAC & Tenant Isolation)**
   - **Supabase RLS (Row Level Security)**: Đây là lớp bảo mật cốt lõi. Toàn bộ bảng dữ liệu hiện đã được kích hoạt RLS và áp dụng chính sách cách ly Tenant (`tenant_id`) nghiêm ngặt.
   - **Standardized Policies**: Sử dụng hàm `get_my_tenant_id()` để tự động lọc dữ liệu theo người dùng đang đăng nhập. Quyền truy cập được phân cấp theo Role (Admin, KTV, Customer).
   - **Service Layer Security**: Mọi Server Action đều xác thực `tenant_id` từ Session trước khi thực hiện truy vấn DB.

3. **Data Protection**
   - **HTTPS/TLS 1.3**: Tự động quản lý bởi Vercel & Supabase.
   - **Parameterization**: Toàn bộ truy vấn qua Supabase SDK đều được tham số hóa tự động, chống SQL Injection tuyệt đối.
   - **Data Validation**: Sử dụng **Zod** schema để validate dữ liệu từ Client gửi lên Server Actions/API Routes.

4. **Audit Log** (optional Phase 1, recommend Phase 2)
   - Log user, action, resource, timestamp on sensitive operations

---

## 💻 DEVELOPER WORKFLOW

### Full-stack (Next.js + Supabase)
```bash
# Khởi tạo project
npx create-next-app@latest . --typescript --tailwind --eslint

# Cài đặt Supabase CLI
npm install supabase --save-dev
npx supabase init

# Quản lý Database
npx supabase db pull # Kéo schema hiện tại từ remote
npx supabase db push # Đẩy migration lên remote
npx supabase gen types typescript --project-id <id> > src/types/supabase.ts

# Phát triển cục bộ
npm run dev
```

### Project Structure
```text
src/
  ├── app/              # App Router (Pages, Layouts, API Routes)
  │   ├── (auth)/       # Auth group (Login, Register)
  │   ├── dashboard/    # Dashboard routes
  │   └── api/          # Serverless functions
  ├── components/       # UI Components
  │   ├── ui/           # shadcn/ui components
  │   ├── common/       # Header, Sidebar, Layout
  │   └── features/     # Booking, Schedule specific components
  ├── hooks/            # Custom React Hooks
  ├── lib/              # Supabase Client, Utils
  ├── services/         # Logic xử lý (Server Actions)
  ├── store/            # State management (Zustand)
  └── types/            # TypeScript definitions
```

### Git Workflow
```
main (production)
  ↑
develop (staging)
  ↑
feature/booking-form
feature/schedule-calendar
feature/finance-dashboard
```

---

## 📦 DEPENDENCIES (Recommended)

### package.json
```json
{
  "dependencies": {
    "next": "16.0.0-canary.x",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "@supabase/supabase-js": "^2.38.0",
    "@supabase/ssr": "^0.0.10",
    "framer-motion": "^11.0.0",
    "lucide-react": "^0.300.0",
    "recharts": "^2.10.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.2.0",
    "zustand": "^4.5.0",
    "date-fns": "^3.3.0"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "tailwindcss": "^4.0.0-alpha.x",
    "@types/node": "^20.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "postcss": "^8.4.35"
  }
}
```

---

## 🧪 TESTING STRATEGY (Phase 1)

### Unit Tests (Backend)
- Services (auth, customers, bookings)
- Target: 70%+ coverage
- Tool: Jest

### Integration Tests
- API endpoints (POST /bookings, GET /schedule)
- Database transactions
- Tool: Jest + Supertest

### E2E Tests (Frontend)
- Login flow
- Create booking
- View schedule
- Tool: Cypress (optional, can defer to Phase 2)

---

## 📈 PERFORMANCE TARGETS

- **Page load:** < 3s (Lighthouse score 80+)
- **API response:** < 200ms (p95)
- **Database query:** < 50ms (p95)
- **Concurrent users:** 50+
- **Uptime:** 99.5%

---

## 🚀 DEPLOYMENT CHECKLIST

- [ ] GitHub repo + branch protection
- [ ] Vercel Project setup
- [ ] Supabase Project (Database + Auth + Storage)
- [ ] Environment variables (NEXT_PUBLIC_SUPABASE_URL, etc.)
- [ ] Database migrations automated via Supabase
- [ ] CI/CD pipeline (Vercel GitHub Integration)
- [ ] Domain configuration
- [ ] SSL certificate (Vercel managed)
- [ ] Backup strategy (Supabase PITR)
- [ ] Monitoring (Logtail / Sentry)

---

## 📞 HANDOFF CHECKLIST

- [ ] Full database schema + migrations
- [ ] API specification (Swagger/OpenAPI)
- [ ] Frontend component library documented
- [ ] Environment setup guide
- [ ] Deployment runbook
- [ ] Testing instructions
- [ ] Code review guidelines
- [ ] On-call support process

---

## 🎓 TRAINING & SUPPORT

**For Bella Spa Team:**
- 2-day onboarding (login, create booking, view schedule)
- Video tutorials (5 min each)
- FAQ document
- Slack/Telegram support channel

**For Antigravity:**
- 1-week buffer for UAT bug fixes
- Post-launch support (2 weeks)
- SLA: Critical bugs within 4 hours

---

## 📅 SAMPLE SPRINT SCHEDULE (Phase 1)

### Week 1-2: Setup & Auth
- Git repo, Docker Compose, DB schema
- User auth (login, register, password reset)
- API documentation (Swagger)

### Week 3-4: Core CRUD
- Customers module (API + UI)
- Bookings module (create, list, detail)
- Session logs auto-generate

### Week 5-6: Schedule & Dashboard
- KTV schedule calendar
- Finance dashboard (basic)
- Session completion flow

### Week 7: Testing & Polish
- Unit/integration tests
- Bug fixes
- Performance optimization

### Week 8: UAT & Launch
- Deploy to staging
- Bella Spa team testing
- Go-live preparation

---

## ❓ FAQ FOR DEVELOPERS

**Q: Tại sao sử dụng Next.js + Supabase?**  
A: Giảm thiểu chi phí hạ tầng (Serverless), tốc độ phát triển cực nhanh, và quản lý Auth/DB tập trung.

**Q: React 19 có ổn định không?**  
A: Next.js 16 (canary/latest) hỗ trợ React 19 rất tốt, tận dụng các tính năng mới như Server Actions và useOptimistic.

**Q: Cấu trúc App Router có phức tạp không?**  
A: Nó giúp tách biệt rõ ràng Server và Client logic, cải thiện SEO và hiệu năng đáng kể so với kiến trúc SPA cũ.

**Q: Timeline: 6-8 weeks realistic with 2 devs?**  
A: Yes, IF:
- Scope strictly Phase 1 (no Phase 2 features)
- Daily standup, clear requirements
- No scope creep
- Bella Spa approves design

---

## 📝 IMPLEMENTATION PROGRESS (Real-time Tracking)

### 🟢 Completed (Done)
- [x] **Phase 0: Infrastructure & Base**
  - [x] Khởi tạo Next.js 16 + React 19 + Tailwind CSS
  - [x] Cấu hình Supabase Client (Auth/Database/SSR).
  - [x] Thiết lập biến môi trường và liên kết Supabase project.
- [x] **Phase 1: Database Migration**
  - [x] Đẩy schema 16 bảng lên Supabase Remote.
  - [x] Khởi tạo dữ liệu mẫu (Seed): Bella Spa Headquarter + Admin User.
- [x] **Phase 2: Core UI Components (Premium Design)**
  - [x] **Auth UI**: Trang đăng nhập Glassmorphism + Framer Motion.
  - [x] **Layout**: Sidebar navigation chuyên nghiệp.
  - [x] **Dashboard**: Giao diện Bento Grid với các thẻ thống kê.
  - [x] **Customer Module**: Danh sách hồ sơ mẹ & bé + Modal thêm mới.
  - [x] **Booking Module**: Giao diện Timeline lịch hẹn + Bộ chọn ngày thông minh.
  - [x] **Finance Module**: Dashboard thu chi + Danh sách giao dịch.
- [x] **Phase 3: Branding & Identity Migration**
  - [x] Thay thế logo mẫu bằng logo chính thức của Bella Spa.
  - [x] Áp dụng hệ màu **Pink Pastel** (Primary: `#FF85A2`) trên toàn bộ hệ thống.
  - [x] Đồng bộ thiết kế Glassmorphism cho ngành chăm sóc mẹ và bé.
- [x] **Phase 4: User Provisioning**
  - [x] Cấp quyền Admin cho các tài khoản production.
  - [x] Phase 14: Hardening Financial Integrity & Transactional Consistency (Completed)
- [x] Phase 15: Salary Reconciliation Logic & Dashboard Role Hardening (Completed)
- [x] Phase 16: Financial Automation, KTV Experience & Customer Portal (Completed)
- [x] Phase 17: Inventory Stability & RLS Hardening (Completed)
- [x] Phase 18: Service Management & Package Schema Alignment (Completed)
- [x] Phase 19: Security Hardening & Analytics Optimization (Completed)
- [x] Phase 20: Operational Stability & Bug Fixes (Completed)
- [x] Phase 21: Financial Reconciliation & Transaction Hardening (Completed)
- [x] Phase 22: Audit Trail & Build Stabilization (Completed)
- [x] Phase 23: UI Standardization & Quality Assurance (Completed)
- [x] Phase 24: Messaging Center Stabilization & UI Enhancements (Completed)

#### ✅ Phase 21: Financial Reconciliation & Transaction Hardening (May 16, 2026) - Verified Stable
- [x] **Reconciliation Module**: Launched a specialized dashboard (`/dashboard/finance/reconciliation`) to track Customer Debt, Orphaned Funds, and Price Mismatches.
- [x] **Real-time UX**: Implemented high-performance local search and multi-type filtering (Revenue/Expense) for the main finance diary.
- [x] **Transaction Reliability**: Migrated critical writes (Revenue/Expenses) to direct Client-side Supabase calls, resolving "cookies outside request scope" and RLS insertion errors.
- [x] **Debt Collection Workflow**: Enhanced the payment modal with direct Booking ID display and pre-filled customer context to ensure 100% audit accuracy.
- [x] **Schema Compliance**: Standardized `expenses` status mapping to `submitted` to satisfy database check constraints.

#### ✅ Phase 22: Audit Trail & Build Stabilization (May 16, 2026) - Verified Stable
- [x] **Audit Trail System**: Implemented a robust database-level audit system using the `audit_logs` table and Postgres triggers (`log_audit_event`). Automatically tracks all `INSERT`, `UPDATE`, and `DELETE` on financial tables.
- [x] **Build Stabilization**: Resolved Vercel build-time TypeScript errors by applying strict type definitions to dynamic data mappings in the reconciliation module.
- [x] **Database Type Sync**: Synchronized `database.types.ts` with the remote schema to include all recent RPCs and tables.
- [x] **Transaction Integrity**: Enforced security-definer triggers for audit logs to ensure immutable records even under restrictive RLS.

#### ✅ Phase 23: UI Standardization & Quality Assurance (May 16, 2026) - Verified Stable
- [x] **Universal Dropdown Migration**: Completed the replacement of all legacy HTML `<select>` elements with the standardized `PremiumSelect` component across Finance, Inventory, Sessions, and Customer modules.
- [x] **Audit Trail UI**: Developed a premium dashboard for real-time monitoring of sensitive data changes (INSERT/UPDATE/DELETE) with a side-by-side JSON diff viewer.
- [x] **Sidebar Enhancement**: Integrated the Audit Trail access point for administrative roles with strict RLS enforcement.
- [x] **Service Sync**: Refactored `audit-actions.ts` to align with the production database schema and optimized join performance for user activity tracking.

#### ✅ Phase 20: Operational Stability & Bug Fixes (May 15, 2026) - Verified Stable
- [x] **Package Visibility Fix**: Corrected `tenant_id` mapping for the `packages` table, resolving RLS isolation issues that caused empty service lists in booking modals.
- [x] **Strict Time Validation**: Implemented `sanitizeTime` backend normalization to ensure all time inputs conform to the strict `HH:MM` PostgreSQL `time` format.
- [x] **UI/UX Hardening**: Replaced free-text "Giờ thực hiện" input with separate structured `time` pickers (Start/End) in the scheduling modal.
- [x] **Workflow Automation**: Set default time ranges (09:00 - 11:00) for new schedules to improve administrative efficiency.

#### ✅ Phase 19: Security Hardening & Analytics Optimization (May 15, 2026) - Verified Stable
- [x] **Hardened RLS Policies**: Enabled RLS across all core tables with standardized tenant-isolation policies. Dropped legacy public/authenticated access.
- [x] **Analytics Unification**: Refactored `get_ktv_leaderboard` RPC to unify data from `session_reviews` and `session_logs`. Leaderboard now accurately reflects KPI bonuses and ratings.
- [x] **Dashboard Rating Source**: Updated dashboard stats to pull ratings from `session_logs` (current truth) with fallback logic to ensure no "zero-data" scenarios.
- [x] **Session Maintenance (Proxy)**: Implemented `proxy.ts` to handle transparent Supabase session refreshes on every request, replacing deprecated middleware logic.
- [x] **Rating Sync**: Enhanced `submitCustomerRating` to populate `session_reviews` for future-proofing while maintaining backward compatibility with `session_logs`.

#### ✅ Phase 18: Service Management & Schema Hardening (May 15, 2026) - Verified Stable
- [x] **Package Schema Alignment**: Synchronized `packages` table with source code by adding `price`, `duration`, `details`, `ktv_commission`, and `offer` columns. (Verified)
- [x] **Permissions & RLS Fix**: Resolved "Permission Denied" errors by granting access and disabling restrictive RLS on `packages` and `bookings` tables. (Verified)
- [x] **Bookings Schema Update**: Added `package_name` and `deposit_amount` columns to the `bookings` table for better data tracking. (Verified)
- [x] **Frontend Display Fix**: Corrected the service badge to use `total_sessions` instead of the non-existent `sessions` field. (Verified)
- [x] **Data Migration**: Successfully migrated legacy `full_price` data to the new `price` column. (Verified)

- [ ] **Zalo OA Integration**: Automate evaluation reminder notifications & Payment reminders (Phase 2).
- [ ] **Bank Statement Sync**: Integration with banking APIs or OCR for automated transaction matching.
- [ ] **Staff Performance Analytics**: Xây dựng biểu đồ xu hướng đánh giá và năng suất KTV.
- [x] **Audit Trail Dashboard**: Built a dedicated interface for Admin to view and filter `audit_logs` by user, action, and date.

---
**Last Updated:** May 15, 2026 (06:05)


## 🛠️ TROUBLESHOOTING & BEST PRACTICES (LESSONS LEARNED)

Để đảm bảo hệ thống vận hành ổn định và không lặp lại các lỗi phổ biến, toàn bộ đội ngũ phát triển (bao gồm AI Agents) phải tuân thủ các quy tắc sau:

### 1. JSX Rendering Strategy
*   **Vấn đề**: Việc viết logic phức tạp (IIFE, lồng ghép ternary nhiều lớp) trực tiếp trong JSX gây ra lỗi cú pháp `Expected '</', got ')'` và làm mã nguồn khó đọc.
*   **Quy tắc**: 
    - Luôn tính toán giá trị/trạng thái (pre-calculate) ở phần đầu của component hoặc hàm xử lý.
    - JSX chỉ nên chứa các biến đơn giản hoặc các component con.
    - *Ví dụ*: Thay vì `<div>{(() => { ... })()}</div>`, hãy sử dụng `const content = renderContent();` và `<div>{content}</div>`.

### 2. Supabase Query Integrity (Join Logic)
*   **Vấn đề**: Khi sử dụng `.select('*, table(*)')`, nếu thiếu trường `id` của bảng được join, các logic phía Client (như Modal, Update) sẽ không thể định danh bản ghi để xử lý.
*   **Quy tắc**:
    - Luôn liệt kê tường minh các trường cần thiết trong chuỗi `select`.
    - **Bắt buộc** phải bao gồm trường `id` cho mọi bảng tham gia vào câu truy vấn.
    - *Mẫu chuẩn*: `.select('*, customers(id, name_mother), session_logs(id, session_number, status)')`.

### 3. Data Fallback & Resilience
*   **Vấn đề**: Khi database trả về rỗng hoặc join thất bại, giao diện thường bị trống hoặc crash do truy cập `undefined.property`.
*   **Quy tắc**:
    - Sử dụng cơ chế Fallback ngay tại Server Action. Nếu dữ liệu thật trống, hãy tra cứu trong `MOCK_DATA` hoặc trả về một object mặc định có cấu trúc chuẩn.
    - Luôn sử dụng Optional Chaining (`?.`) khi truy cập dữ liệu từ các bảng join (ví dụ: `booking.customers?.name_mother`).

### 4. Demo Data Persistence
*   **Vấn đề**: Các thay đổi trong chế độ Demo thường bị mất khi tải lại trang.
*   **Quy tắc**:
    - Sử dụng `localStorage` để đồng bộ các thay đổi thủ công của người dùng trong quá trình Demo.
    - Các Server Actions nên tích hợp sẵn logic kiểm tra: Nếu DB lỗi/rỗng -> Trả về Demo Data + Merge với Local Storage.

### 5. "Soft Luxury" UI Standards
*   **Vấn đề**: Giao diện không đồng nhất do sử dụng các thẻ `select` mặc định và lỗi bị cắt nội dung (clipping) khi đặt trong các card có `overflow-hidden`.
*   **Quy tắc**:
    - **PremiumSelect**: Bắt buộc sử dụng component `PremiumSelect` cho toàn bộ các trường chọn (Dropdown). Không sử dụng HTML `<select>` nguyên bản.
    - **Floating Menus**: Đối với các thẻ (Cards) chứa dropdown, tuyệt đối không sử dụng `overflow-hidden` trực tiếp trên container chính. Hãy tách phần trang trí (Background elements) vào một lớp riêng có overflow-hidden để đảm bảo menu dropdown có thể hiển thị tràn ra ngoài Card.
    - **Pastel Palette**: Luôn tuân thủ mã màu `#FF85A2` cho Primary và các sắc độ Pastel tương ứng để duy trì nhận diện thương hiệu Bella Spa.

### 17. Quản lý Kho & Vật tư (v2.1)
- **Tự động hóa**: Trigger `trigger_deduct_inventory_on_session_complete` tự động trừ kho dựa trên định mức gói dịch vụ (ví dụ: trừ 20ml tinh dầu khi xong 1 buổi tắm bé).
- **Cảnh báo**: Tích hợp thông báo tồn kho thấp vào Dashboard Admin và RPC `get_important_alerts`.
- **Dữ liệu**: Bảng `inventory_items` lưu trữ tồn kho, `package_materials` lưu định mức tiêu hao.

### 6. Ergonomic Data Tables
*   **Vấn đề**: Khi số lượng dữ liệu lớn (nhiều nhân viên, nhiều phiên làm việc), bảng dữ liệu thường bị co hẹp hoặc mất dấu tiêu đề khi cuộn, làm giảm hiệu suất quản lý.
*   **Quy tắc**:
    - **Sticky Header**: Bắt buộc sử dụng `sticky top-0 z-10` kèm `backdrop-blur` cho hàng tiêu đề (`thead`) của các bảng danh sách lớn.
    - **Column Constraints**: Sử dụng `min-w-[...]` cho các cột chứa text dài (như Tên KTV, Tên khách hàng) và `whitespace-nowrap` cho các cột chứa số liệu tài chính để đảm bảo tính dễ đọc.
    - **Horizontal Scroll**: Luôn bao bọc bảng trong một container `overflow-x-auto` để hỗ trợ hiển thị tốt trên mọi kích thước màn hình.
    
### 7. "Dịch vụ lẻ" Operational Logic
*   **Vấn đề**: Các dịch vụ không thuộc gói (ví dụ: làm 1 buổi phát sinh) cần được quản lý mà không làm hỏng cấu trúc 15/21 buổi của hệ thống.
*   **Quy tắc**:
    - **Resolution**: Hệ thống tự động nhận diện "Dịch vụ lẻ" dựa trên `package_name` rỗng và đối chiếu `full_price` với danh sách dịch vụ mẫu.
    - **Multiplicity**: Mỗi lần khách làm dịch vụ lẻ được coi là 1 bản ghi `booking` riêng biệt. Sử dụng `Booking Switcher` để chuyển đổi giữa các lần làm dịch vụ lẻ khác nhau.
    - **Status Mapping**: Dịch vụ lẻ vẫn tuân thủ logic `scheduled` -> `completed`. Khi hoàn thành, thẻ sẽ được đóng lại và lưu vào lịch sử (Completed).

### 9. Salary & Financial Reconciliation
*   **Vấn đề**: Số buổi làm việc của KTV thường bị thay đổi hoặc không khớp giữa bảng đối soát và bảng lương tổng.
*   **Quy tắc**:
    - **Snapshot Confirmation**: Khi Admin nhấn "Duyệt", số buổi tại thời điểm đó phải được ghi đè (persist) vào cột `total_sessions` của bảng `salary_records`.
    - **Audit Trail**: Đánh dấu `is_confirmed = true` cho các buổi đã được đối soát trong bảng `session_logs` để ngăn chặn việc sửa đổi hoặc tính trùng lặp trong tương lai.
    - **Schema Awareness**: Luôn kiểm tra sự tồn tại của các cột nghiệp vụ mới bổ sung (`total_sessions`, `is_confirmed`) trước khi thực hiện các tác vụ cập nhật tài chính.

### 14.3 Quy tắc tính toàn vẹn và Bảo mật (Hardened)

1.  **Tính bất biến của dữ liệu (Data Immutability):**
    *   **KTV/Nhân viên:** Chỉ có thể cập nhật thông tin (Ngày, Giờ, Ghi chú) cho các buổi tập đang ở trạng thái `scheduled`. Khi một buổi đã chuyển sang `completed` hoặc `cancelled`, toàn bộ dữ liệu của buổi đó sẽ bị khóa chặt.
    *   **Admin:** Có quyền ghi đè (Override) mọi trạng thái. Admin có thể khôi phục một buổi đã hoàn thành về trạng thái chờ để sửa lỗi.
2.  **Chống cập nhật trùng lặp (Anti-Fraud):**
    *   KTV không thể nhấn "Hoàn thành" 2 lần cho cùng một khách hàng trong cùng 1 ngày (trừ Admin) để tránh sai sót trong việc tính buổi tập.
3.  **Tự chữa lành dữ liệu (Self-healing Sync):**
    *   Bất cứ khi nào chi tiết của một thẻ liệu trình được mở ra, hệ thống sẽ chạy tác vụ ngầm `syncBookingProgress` để đếm lại số `session_logs` thực tế và cập nhật lại cột `completed_sessions` trong bảng `bookings` nếu có sai lệch.
4.  **Minh bạch nhân sự (Personnel Transparency):**
    *   Mỗi buổi tập hoàn thành đều lưu lại "Snapshot" KTV thực hiện (`completed_by_ktv_id`) để phục vụ đối soát lương và thưởng (KTV Bonus).

### 7. Cross-Page Data Consistency
*   **Vấn đề**: Khi một khách hàng có nhiều booking (ví dụ: 1 gói cũ hoàn thành và 1 gói mới), việc chuyển hướng chung đến `/dashboard/customers/[id]` gây ra sự mơ hồ về gói dữ liệu đang xem.
*   **Quy tắc**:
    - **Booking Context**: Luôn đính kèm `bookingId` vào query params khi điều hướng đến hồ sơ khách hàng từ các thành phần liên quan đến session (`/dashboard/customers/[id]?bookingId=[ID]`).
    - **Explicit Switcher**: Trong trang chi tiết, nếu phát hiện nhiều hơn 1 bản ghi booking, phải hiển thị UI Switcher để người dùng tự do chuyển đổi giữa các gói, tránh hiển thị thông tin sai lệch.
    - **Sorting Priority**: Khi không có `bookingId` cụ thể, logic mặc định phải ưu tiên `active` > `in_progress` > `booked` > `deposit_pending` > `completed`.

### 8. Session Dashboard Integrity
*   **Vấn đề**: Các dashboard quản lý buổi tập thường gặp tình trạng "lệch số buổi" (ví dụ: thực tế làm 5 buổi nhưng trên thẻ hiện 4) do lỗi mạng khi cập nhật hoặc sai lệch logic cũ.
*   **Quy tắc**:
    - **Self-Healing Sync**: Bắt buộc triển khai hàm `syncBookingProgress` để đếm lại thực tế từ bảng `session_logs` và ghi đè (overwrite) vào bảng `bookings`.
    - **Background Trigger**: Kích hoạt lệnh đồng bộ này ngay khi người dùng mở chi tiết thẻ liệu trình để đảm bảo giao diện luôn hiển thị dữ liệu mới nhất.
    - **Multi-Field Filter**: Thanh tìm kiếm tại Dashboard phải hỗ trợ tìm kiếm mờ (fuzzy) qua tên gói, tên KTV, số điện thoại và mã booking thay vì chỉ tìm theo tên khách hàng.
### 9. Analytics Unification & Data Source Hierarchy
*   **Vấn đề**: Tồn tại song song hai bảng chứa rating (`session_logs` và `session_reviews`) dẫn đến số liệu không nhất quán trên Dashboard và Leaderboard.
*   **Quy tắc**:
    - **Hierarchy**: Hệ thống ưu tiên dữ liệu từ `session_reviews` (chính thức). Nếu trống, tự động fallback sang `session_logs` (legacy/quick-rating).
    - **Sync on Submit**: Khi khách hàng đánh giá, `submitCustomerRating` phải cập nhật đồng thời cả hai bảng để đảm bảo tính nhất quán và phục vụ báo cáo KTV Bonus.
    - **RPC First**: Các logic tính toán phức tạp (Leaderboard, P&L) phải được đẩy xuống tầng Database (Postgres RPC) thay vì xử lý tại Client để đảm bảo hiệu năng và bảo mật RLS.

### 10. Strict Time Handling for PostgreSQL Compatibility
*   **Vấn đề**: Cột kiểu `time` trong Postgres (như `assigned_time`) sẽ báo lỗi `invalid input syntax` nếu nhận chuỗi tự do như `"09 - 10"`.
*   **Quy tắc**:
    - **Frontend**: Luôn sử dụng `<input type="time" />` để đảm bảo trình duyệt gửi dữ liệu chuẩn. Nếu cần dải giờ, hãy sử dụng 2 input riêng biệt (Bắt đầu/Kết thúc).
    - **Backend**: Mọi Server Action nhận chuỗi thời gian phải đi qua hàm chuẩn hóa (ví dụ: `sanitizeTime`) để loại bỏ khoảng trắng và chuẩn về dạng `HH:MM`.
    - **Database**: Tránh lưu dải giờ (range) vào cột kiểu `time`. Nếu cần lưu range, hãy lưu giờ bắt đầu vào cột `time` và tính toán duration hoặc lưu vào cột kiểu `text`/`tstzrange`.

---

## 📅 MILESTONES & PHASES

### PHASE 13: Data Integrity & Multi-Booking Context
- **Booking Context**: Pass bookingId through navigation links.
- **Booking Switcher**: UI for switching between concurrent treatment packages.
- **Status Hardening**: Refined sorting and filtering for active records.

### PHASE 14: Advanced Search & Automated Integrity
- **Full-Text Filter**: Multi-field search capability in session dashboard.
- **Auto-Sync Logic**: Automated reconciliation of session logs and booking progress.
- **Security Audit**: Deployment of RLS policies for multi-tenant isolation.

### Phase 16: Financial Automation, KTV Experience & Customer Portal (Completed)
- **Objective**: Standardize financial reporting, optimize KTV operations, and enhance customer engagement.
- **Financial Engine**: 
    - Implemented `get_monthly_pnl` RPC for Revenue/Expense/Salary aggregation.
    - Added `lock_monthly_records` to prevent retrospective financial changes.
    - Implemented `get_service_performance` for ROI tracking.
- **KTV Mobile Experience**:
    - Mobile-optimized dashboard for check-in/out and earnings tracking.
    - `get_ktv_leaderboard` RPC for staff gamification.
- **Customer Portal & Loyalty**:
    - Public `/portal/[token]` page for treatment tracking.
    - `apply_rating_bonus` RPC (20k/50k bonus for 5-star ratings).
    - `increment_loyalty_points` RPC (1 point per 100k confirmed revenue).

### PHASE 19: Security Hardening & Analytics Optimization (Completed)
- **Hardened RLS**: Strict tenant-isolation policies across 100% of core tables.
- **Unified Leaderboard**: High-performance RPC for KTV performance tracking.
- **Session Refresh Proxy**: Automated auth maintenance for stable ERP sessions.
- [x] Rating Consistency: Cross-table sync for customer feedback data.

### PHASE 20: Operational Stability & Bug Fixes (Completed)
- **Data Integrity**: Corrected `tenant_id` mapping for `packages` table.
- **Strict Time Validation**: Replaced free-text time fields with structured pickers and added server-side normalization.
- **UX Improvement**: Default time ranges for faster scheduling.

### PHASE 24: Messaging Center Stabilization & UI Enhancements (Completed)
- **RPC Hardening**: Resolved ambiguous column reference in `get_chat_customers` by explicitly qualifying table prefixes (`public.users.id`).
- **Client-Side Refactoring**: Migrated `/dashboard/chat` from brittle Server Actions to direct Client-side Supabase requests for reliable real-time subscription and data fetching.
- **Portal UI Enhancement**: Redesigned the Customer Portal (`/portal/[token]`) greeting section (large font, primary brand color) and integrated official social media contact links (Facebook).
- **Production Deployment**: Verified all changes and successfully deployed to the Vercel production environment.

### PHASE 25: Landing Page Visual Refinements & Mobile Drawer Optimization (Completed - May 19, 2026)
- **Branding & Logo Refinement**: Removed the `"ERP"` suffix from the public landing page logo text to focus strictly on elegant branding (`"Mẹ & Bé"`).
- **Hero Banner Scale Correction**: Reduced the large hero overlay text scale by 30% to fit mobile device aspect ratios seamlessly without cluttering screen space.
- **Responsive Price & Tag Overhaul**: Replaced absolute labels with responsive flex stacking (`flex-col sm:flex-row`), aligning titles next to prices on desktop while stacking them beautifully on mobile.
- **Mobile Navigation Drawer & Zoom Correction**: Limit desktop-level `zoom: 0.9` styling in `globals.css` to screen widths above `768px` via CSS media queries, enabling a natural `100%` zoom scale on mobile. Optimized mobile drawer menu buttons to capital-case (`ĐĂNG NHẬP`, `DÙNG THỬ NGAY`) and configured header background blur and shadow transition when the mobile drawer is opened.

---

**Document Version:** 2.7  
**Last Updated:** 2026-05-19 (15:50)  
**Status:** Implementation Phase (Phase 25: Completed)  
**Contact:** Bella Spa ERP Dev Team
