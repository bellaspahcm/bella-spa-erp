# Bella Spa ERP — Tài liệu Thiết kế Toàn Bộ Hệ Thống

**Tên Dự Án:** Bella Spa Management System  
**Loại Doanh Vụ:** Spa chăm sóc mẹ và bé sau sinh  
**Phiên Bản:** 1.5  
**Ngày Cập Nhật:** 12/05/2026 (09:00)  
**Status:** Triển khai Production (Chuẩn hóa Luxury UI & Interactive Boxes Toàn Hệ Thống)

---

## 📋 MỤC LỤC

1. [Tổng Quan Hệ Thống](#tổng-quan-hệ-thống)
2. [Kiến Trúc Kỹ Thuật](#kiến-trúc-kỹ-thuật)
3. [Database Schema](#database-schema)
4. [Module Chi Tiết](#module-chi-tiết)
5. [API Endpoints](#api-endpoints)
6. [Lộ Trình Triển Khai (Phases)](#lộ-trình-triển-khai)
7. [Tính Năng & Yêu Cầu Chi Tiết](#tính-năng--yêu-cầu-chi-tiết)
8. [Bảo Mật & Tuân Thủ](#bảo-mật--tuân-thủ)

---

## 🎯 Tổng Quan Hệ Thống

### Mô Tả Ngắn
Hệ thống ERP toàn diện cho Bella Spa, quản lý:
- **Khách hàng & Booking:** Đặt cọc, chọn gói dịch vụ, thẻ liệu trình điện tử
- **Lịch làm việc KTV:** Calendar tháng (đỏ/cam/xanh), timeline giờ, GPS check-in
- **Tài chính:** Doanh thu, chi phí, lương tự động, dự báo thu nhập
- **Nhân sự:** Chấm công, KPI, vi phạm, khen thưởng, phân quyền 5 role
- **Đánh giá KTV:** Sao + ghi chú riêng tư (bảo mật tuyệt đối)
- **CRM & Marketing:** Nhắc lịch, upsell, referral tracking, thành viên

### Nhân Vật & Quyền

| Role | Quyền | Truy Cập |
|------|-------|---------|
| **Admin/Chủ Spa** | Full hệ thống, báo cáo tổng hợp, cấu hình | Web + Mobile |
| **KTV Trưởng Khu Vực** | Quản lý team (lịch, KPI, lương), phân ca | Web + Mobile |
| **KTV** | Check-in/out, xem lịch ca, tích buổi, nhận thông báo | Mobile |
| **Hành Chính** | Nhân sự, kho, chấm công, nhắc nhở | Web + Mobile |
| **Kế Toán** | Tài chính, báo cáo, xuất hóa đơn | Web |
| **Khách Hàng** | Xem lịch hẹn, thẻ liệu trình, đánh giá KTV, nhật ký bé | App riêng/Link |

---

## 🏗️ Kiến Trúc Kỹ Thuật

### Stack Công Nghệ Đề Xuất

```
Frontend (Web App)
├── Next.js 16 + React 19
├── TailwindCSS v4 (CSS-first)
├── Framer Motion (animations)
├── Lucide React (icons)
├── Recharts (charts)
└── Zustand (state management)

Backend & Database (Serverless)
├── Vercel (Edge/Serverless Runtime)
├── Supabase (PostgreSQL Managed)
├── Supabase Auth (Authentication)
├── Supabase Storage (File storage)
└── Supabase Realtime (Real-time updates)

Infrastructure & External
├── GitHub (Source Control)
├── Vercel CI/CD (Auto-deployment)
├── Zalo OA API (Notification & OTP)
├── Sentry (Error tracking)
└── Vercel Edge Config (Feature flags)
```

### Cấu Trúc Thư Mục Dự Án (Full-stack)

```
bella-spa-erp/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (auth)/             # Login, Register pages
│   │   ├── dashboard/          # ERP Dashboard
│   │   ├── api/                # Route Handlers (Backend logic)
│   │   └── layout.tsx          # Root layout
│   ├── components/
│   │   ├── ui/                 # shadcn/ui components
│   │   ├── features/           # Booking, Schedule specific logic
│   │   └── common/             # Sidebar, Header, Layout components
│   ├── hooks/                  # Custom React hooks (useSupabase, useAuth)
│   ├── lib/                    # Library configs (supabase-client.ts, utils.ts)
│   ├── services/               # Data fetching logic (Server Actions)
│   ├── store/                  # Global state management (Zustand)
│   ├── types/                  # TypeScript types & Supabase generated types
│   └── styles/                 # global.css (Tailwind v4)
├── public/                     # Static assets (images, fonts)
├── supabase/                   # Database migrations & configuration
├── tailwind.config.ts          # Tailwind CSS v4 configuration
├── next.config.ts              # Next.js configuration
├── package.json
└── tsconfig.json
```
├── tailwind.config.js
└── package.json
```

---

## 💾 Database Schema

### Entities Chính

#### 1. Users (Nhân viên)
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255),
  phone VARCHAR(20),
  role ENUM('admin', 'ktv_lead', 'ktv', 'admin_staff', 'accountant'),
  avatar_url VARCHAR(500),
  status ENUM('active', 'inactive', 'terminated'),
  tenant_id UUID NOT NULL (multi-tenant),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP
);

-- Indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_tenant_id ON users(tenant_id);
CREATE INDEX idx_users_role ON users(role);
```

#### 2. Customers (Khách hàng)
```sql
CREATE TABLE customers (
  id UUID PRIMARY KEY,
  phone VARCHAR(20) UNIQUE,
  name_mother VARCHAR(255),
  name_baby VARCHAR(255),
  dob_baby DATE,
  dob_expected DATE, -- ngày dự sinh nếu chưa sinh
  address VARCHAR(500),
  district VARCHAR(100),
  zones TEXT[], -- array quận phường
  referral_source ENUM('friend', 'facebook', 'google_maps', 'other'),
  referrer_id UUID, -- khách hàng giới thiệu (FK customers.id)
  zalo_oa_id VARCHAR(100), -- Zalo OA contact ID
  status ENUM('prospect', 'active', 'completed', 'inactive'),
  notes TEXT,
  tenant_id UUID NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_customers_tenant_id ON customers(tenant_id);
CREATE INDEX idx_customers_referrer_id ON customers(referrer_id);
```

#### 3. Bookings (Đặt lịch)
```sql
CREATE TABLE bookings (
  id UUID PRIMARY KEY,
  booking_number VARCHAR(20) UNIQUE, -- BK-YYMMDD-001
  customer_id UUID NOT NULL (FK),
  package_id UUID NOT NULL (FK),
  status ENUM('inquiry', 'deposit_pending', 'booked', 'in_progress', 'completed', 'cancelled'),
  deposit_amount DECIMAL(12,2), -- số tiền cọc (200k-1tr)
  full_price DECIMAL(12,2),
  start_date DATE,
  end_date DATE,
  expected_birth_date DATE, -- nếu chưa sinh
  total_sessions INTEGER, -- 21/16/12 buổi theo gói
  completed_sessions INTEGER DEFAULT 0,
  notes TEXT,
  contract_signed BOOLEAN DEFAULT FALSE,
  contract_signed_at TIMESTAMP,
  contract_url VARCHAR(500), -- PDF link
  assigned_ktv_id UUID (FK users.id),
  tenant_id UUID NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_bookings_customer_id ON bookings(customer_id);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_bookings_assigned_ktv_id ON bookings(assigned_ktv_id);
```

#### 4. Session Logs (Thẻ liệu trình)
```sql
CREATE TABLE session_logs (
  id UUID PRIMARY KEY,
  booking_id UUID NOT NULL (FK),
  session_number INTEGER, -- 1, 2, 3, ... 21
  assigned_date DATE,
  completed_date TIMESTAMP,
  completed_by_ktv_id UUID (FK users.id),
  address VARCHAR(500), -- địa chỉ thực hiện
  status ENUM('scheduled', 'completed', 'cancelled'),
  -- Bất biến: không bao giờ UPDATE/DELETE
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  tenant_id UUID NOT NULL
);

CREATE INDEX idx_session_logs_booking_id ON session_logs(booking_id);
CREATE INDEX idx_session_logs_completed_date ON session_logs(completed_date);
```

#### 5. Session Reviews (Đánh giá KTV)
```sql
CREATE TABLE session_reviews (
  id UUID PRIMARY KEY,
  session_log_id UUID NOT NULL (FK),
  reviewer_id UUID NOT NULL (FK customers.id), -- khách đánh giá
  ktv_id UUID NOT NULL (FK users.id),
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  note TEXT, -- ghi chú riêng tư (mã hoá AES-256)
  note_encrypted BOOLEAN DEFAULT TRUE,
  is_hidden_from_ktv BOOLEAN DEFAULT TRUE, -- KTV không bao giờ thấy note
  status ENUM('pending_review', 'approved', 'published'),
  created_at TIMESTAMP DEFAULT NOW(),
  tenant_id UUID NOT NULL
);

CREATE INDEX idx_session_reviews_ktv_id ON session_reviews(ktv_id);
CREATE INDEX idx_session_reviews_session_id ON session_reviews(session_log_id);
```

#### 6. KTV Schedule (Lịch làm việc KTV)
```sql
CREATE TABLE ktv_schedule (
  id UUID PRIMARY KEY,
  ktv_id UUID NOT NULL (FK users.id),
  date DATE,
  status ENUM('free_full', 'free_partial', 'full', 'off'),
  -- free_full: xanh (trống hoàn toàn)
  -- free_partial: cam (còn slot)
  -- full: đỏ (không nhận thêm)
  -- off: gray (nghỉ - có/không lương)
  off_paid BOOLEAN DEFAULT TRUE, -- nếu status='off'
  note TEXT,
  tenant_id UUID NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_ktv_schedule_date ON ktv_schedule(ktv_id, date);
```

#### 7. Shifts (Ca làm việc)
```sql
CREATE TABLE shifts (
  id UUID PRIMARY KEY,
  ktv_id UUID NOT NULL (FK),
  date DATE,
  start_time TIME,
  end_time TIME,
  customer_id UUID (FK), -- optional, nếu là ca với khách
  booking_id UUID (FK),
  address VARCHAR(500),
  status ENUM('scheduled', 'completed', 'cancelled'),
  checkin_time TIMESTAMP,
  checkin_lat DECIMAL(10,8),
  checkin_lon DECIMAL(11,8),
  checkout_time TIMESTAMP,
  checkout_lat DECIMAL(10,8),
  checkout_lon DECIMAL(11,8),
  tenant_id UUID NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_shifts_ktv_id_date ON shifts(ktv_id, date);
CREATE INDEX idx_shifts_status ON shifts(status);
```

#### 8. Revenue (Doanh thu)
```sql
CREATE TABLE revenue (
  id UUID PRIMARY KEY,
  booking_id UUID (FK),
  amount DECIMAL(12,2),
  revenue_type ENUM('deposit', 'session_completed', 'additional_service'),
  payment_method ENUM('cash', 'bank_transfer', 'zalo_pay', 'momo'),
  received_date DATE,
  recorded_by_id UUID (FK users.id),
  status ENUM('pending', 'confirmed'),
  notes TEXT,
  tenant_id UUID NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_revenue_booking_id ON revenue(booking_id);
CREATE INDEX idx_revenue_received_date ON revenue(received_date);
```

#### 9. Expenses (Chi phí)
```sql
CREATE TABLE expenses (
  id UUID PRIMARY KEY,
  category VARCHAR(100), -- 'office_supplies', 'transportation', 'marketing', etc.
  amount DECIMAL(12,2),
  description TEXT,
  receipt_url VARCHAR(500),
  expense_date DATE,
  approved_by_id UUID (FK users.id),
  status ENUM('submitted', 'approved', 'rejected'),
  submitted_by_id UUID (FK),
  tenant_id UUID NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_expenses_category ON expenses(category);
CREATE INDEX idx_expenses_expense_date ON expenses(expense_date);
```

#### 10. Salary (Lương KTV)
```sql
CREATE TABLE salary_records (
  id UUID PRIMARY KEY,
  ktv_id UUID NOT NULL (FK),
  month_year DATE, -- 2025-05-01
  base_salary DECIMAL(12,2), -- lương cứng
  service_percentage_bonus DECIMAL(12,2), -- % doanh thu ca
  kpi_bonus DECIMAL(12,2),
  violations_deduction DECIMAL(12,2),
  total_salary DECIMAL(12,2),
  status ENUM('draft', 'pending_approval', 'approved', 'paid'),
  paid_date DATE,
  paid_method ENUM('bank_transfer', 'cash'),
  notes TEXT,
  tenant_id UUID NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_salary_ktv_id ON salary_records(ktv_id);
CREATE INDEX idx_salary_month_year ON salary_records(month_year);
```

#### 11. Attendance (Chấm công)
```sql
CREATE TABLE attendance (
  id UUID PRIMARY KEY,
  ktv_id UUID NOT NULL (FK),
  date DATE,
  checkin_time TIMESTAMP,
  checkout_time TIMESTAMP,
  shift_id UUID (FK),
  status ENUM('present', 'late', 'absent', 'half_day'),
  -- Chấm công tự động từ shift check-in/out
  tenant_id UUID NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_attendance_date ON attendance(ktv_id, date);
```

#### 12. KPI Records (KPI hàng tháng)
```sql
CREATE TABLE kpi_records (
  id UUID PRIMARY KEY,
  ktv_id UUID NOT NULL (FK),
  month_year DATE,
  -- Các chỉ số
  sessions_completed INTEGER,
  on_time_rate DECIMAL(5,2), -- %
  customer_satisfaction DECIMAL(4,2), -- trung bình rating
  violations_count INTEGER,
  target_sessions INTEGER,
  kpi_achievement_rate DECIMAL(5,2), -- %
  bonus_amount DECIMAL(12,2),
  notes TEXT,
  tenant_id UUID NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_kpi_ktv_id ON kpi_records(ktv_id);
CREATE INDEX idx_kpi_month ON kpi_records(month_year);
```

#### 13. Chat Threads (Chat nội bộ)
```sql
CREATE TABLE chat_threads (
  id UUID PRIMARY KEY,
  thread_type ENUM('booking', 'general', 'team'),
  booking_id UUID (FK), -- NULL nếu thread_type != 'booking'
  team_id UUID (FK), -- nhóm KTV (nếu thread_type='team')
  channel_name VARCHAR(255), -- tên channel
  created_by_id UUID (FK users.id),
  archived BOOLEAN DEFAULT FALSE,
  archived_at TIMESTAMP,
  tenant_id UUID NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_chat_threads_booking_id ON chat_threads(booking_id);
```

#### 14. Chat Messages (Tin nhắn)
```sql
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY,
  thread_id UUID NOT NULL (FK),
  sender_id UUID (FK users.id),
  content TEXT,
  message_type ENUM('text', 'system', 'file'),
  file_url VARCHAR(500),
  edited_at TIMESTAMP,
  deleted_at TIMESTAMP, -- soft delete
  tenant_id UUID NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_chat_messages_thread_id ON chat_messages(thread_id);
CREATE INDEX idx_chat_messages_created_at ON chat_messages(created_at);
```

#### 15. Membership (Thành viên tích điểm)
```sql
CREATE TABLE membership_records (
  id UUID PRIMARY KEY,
  customer_id UUID NOT NULL (FK),
  tier ENUM('silver', 'gold', 'diamond'), -- Bạc/Vàng/Kim cương
  total_points INTEGER DEFAULT 0,
  points_used INTEGER DEFAULT 0,
  tier_upgrade_date TIMESTAMP,
  expires_at TIMESTAMP,
  benefits_redeemed TEXT[], -- array lợi ích đã dùng
  tenant_id UUID NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_membership_customer_id ON membership_records(customer_id);
```

#### 16. Tenant (Nhượng quyền/Chi nhánh)
```sql
CREATE TABLE tenants (
  id UUID PRIMARY KEY,
  name VARCHAR(255),
  parent_tenant_id UUID (FK), -- nếu là chi nhánh
  franchise_agreement_date DATE,
  royalty_rate DECIMAL(5,2), -- % (10%)
  contact_name VARCHAR(255),
  contact_phone VARCHAR(20),
  address VARCHAR(500),
  status ENUM('active', 'suspended', 'terminated'),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_tenants_parent_id ON tenants(parent_tenant_id);
```

---

## 🔌 API Endpoints

### Authentication
```
POST   /api/v1/auth/login                 → JWT + Refresh Token
POST   /api/v1/auth/refresh               → Mới JWT
POST   /api/v1/auth/logout                → Revoke Token
POST   /api/v1/auth/password-reset        → Gửi OTP qua Zalo
POST   /api/v1/auth/verify-otp            → Xác minh OTP
```

### Customers
```
GET    /api/v1/customers                  → Danh sách khách (với filter)
POST   /api/v1/customers                  → Thêm khách mới
GET    /api/v1/customers/:id              → Chi tiết khách
PATCH  /api/v1/customers/:id              → Cập nhật thông tin
GET    /api/v1/customers/:id/session-history → Lịch sử buổi dịch vụ
```

### Bookings
```
POST   /api/v1/bookings                   → Tạo booking mới
GET    /api/v1/bookings                   → Danh sách booking
GET    /api/v1/bookings/:id               → Chi tiết booking
PATCH  /api/v1/bookings/:id/status        → Cập nhật trạng thái
POST   /api/v1/bookings/:id/sign-contract → Ký hợp đồng điện tử (OTP)
GET    /api/v1/bookings/:id/sessions      → Danh sách buổi trong gói
```

### Schedule
```
GET    /api/v1/schedule/:month            → Calendar tháng (tất cả KTV)
GET    /api/v1/schedule/ktv/:ktv_id/:month → Calendar KTV riêng
GET    /api/v1/schedule/:date/timeline    → Timeline buổi hôm nay
POST   /api/v1/schedule/assign-shift      → Phân ca (smart assignment)
GET    /api/v1/assignments/suggestions    → Gợi ý KTV phù hợp
```

### Check-in/Check-out
```
POST   /api/v1/shifts/checkin             → Check-in GPS
POST   /api/v1/shifts/checkout            → Check-out
GET    /api/v1/shifts/:id/location        → Xem vị trí real-time
```

### Session Completion & Review
```
POST   /api/v1/sessions/:id/complete      → Tích buổi hoàn thành (popup xác nhận)
POST   /api/v1/sessions/:id/review        → Gửi đánh giá sao + ghi chú
GET    /api/v1/sessions/:id/reviews       → Xem đánh giá (chỉ admin/manager)
```

### Finance
```
GET    /api/v1/finance/dashboard          → Revenue, expenses, profit tháng/quý/năm
POST   /api/v1/revenue/record             → Ghi nhận doanh thu
GET    /api/v1/revenue/:month             → Doanh thu theo tháng
POST   /api/v1/expenses/submit            → Báo cáo chi phí
GET    /api/v1/expenses/:month            → Danh sách chi phí
GET    /api/v1/forecast/revenue           → Dự báo doanh thu tháng
GET    /api/v1/forecast/seasonality       → Phân tích mùa vụ
```

### Salary
```
GET    /api/v1/salary/:month              → Bảng lương tháng
POST   /api/v1/salary/calculate           → Tính lương tự động
PATCH  /api/v1/salary/:id/approve         → Phê duyệt lương
GET    /api/v1/salary/:id/pdf             → Xuất phiếu lương PDF
```

### HR & KPI
```
GET    /api/v1/hr/kpi/:month              → KPI tháng
POST   /api/v1/hr/violations              → Ghi nhận vi phạm
GET    /api/v1/hr/attendance/:ktv/:month  → Chấm công
POST   /api/v1/hr/promotion               → Khen thưởng
GET    /api/v1/hr/analytics               → Phân tích nhân sự
```

### Chat
```
WS     /ws/chat/:thread_id                → WebSocket chat thread
GET    /api/v1/chat/threads               → Danh sách thread
POST   /api/v1/chat/threads               → Tạo thread
GET    /api/v1/chat/:thread_id/messages   → Tin nhắn thread
POST   /api/v1/chat/:thread_id/message    → Gửi tin
```

### Membership
```
GET    /api/v1/membership/:customer_id    → Hạng thành viên
POST   /api/v1/membership/redeem-points   → Đổi điểm
GET    /api/v1/membership/leaderboard     → Ranking referral
POST   /api/v1/membership/referral-link   → Tạo mã giới thiệu
```

### Franchise/Multi-tenant
```
GET    /api/v1/franchise/stats            → Thống kê toàn chuỗi (chỉ admin gốc)
GET    /api/v1/franchise/:tenant_id/stats → Thống kê chi nhánh
POST   /api/v1/franchise/royalty/auto-calc → Tính royalty tự động
```

---

## 📅 Lộ Trình Triển Khai (Phases)

### Phase 1 — MVP (6-8 tuần)

**Mục tiêu:** Thay thế Excel, vận hành cơ bản

**Tính năng bắt buộc:**
- Quản lý khách & booking (cọc 200k-1tr, chọn gói)
- Lịch làm việc KTV (tháng, màu sắc, timeline giờ)
- Thẻ liệu trình điện tử (tích buổi, không sửa)
- Quản lý doanh thu/chi phí cơ bản
- Phân quyền 5 role cơ bản
- Dashboard KPI & doanh thu tháng

**Not Included:** 
- Hợp đồng điện tử
- GPS check-in
- Tính lương tự động
- Chat nội bộ
- Đánh giá KTV
- Referral tracking

**Delivery:** Web PWA (mobile responsive), 1 server VPS

---

### Phase 2 — Tối Ưu & Doanh Thu (4-6 tuần sau Phase 1)

**Tính năng thêm:**
- Hợp đồng điện tử (ký OTP Zalo)
- GPS check-in + chống gian lận
- Tính lương tự động cuối tháng
- Nhật ký chăm sóc bé có ảnh
- Nhắc lịch sinh nhật bé + upsell tự động
- Tracking referral (giới thiệu khách)
- Chat nội bộ theo booking (ko dùng Zalo cá nhân)

**Expected Impact:**
- Giảm thời gian tính lương từ 2 ngày → 30 phút
- Tăng tái booking 15-20% (từ nhát sinh nhật + upsell)
- Tăng doanh thu từ referral 10-15%

---

### Phase 3 — Scale & Cạnh Tranh (6-8 tuần sau Phase 2)

**Tính năng thêm:**
- Gợi ý phân ca thông minh (AI ranking)
- Dự báo doanh thu + cảnh báo sớm
- Chương trình thành viên & tích điểm
- Hệ thống nhượng quyền & đa chi nhánh (multi-tenant)
- App mobile native (React Native)

**Capability:**
- Mở rộng 3-5 chi nhánh mà không tăng overhead quản lý
- Doanh thu dự kiến tăng 30-50% so Phase 1

---

## 🎁 Tính Năng & Yêu Cầu Chi Tiết

### Module 1: Booking & Thẻ Liệu Trình

**Quy Trình Booking:**
1. Khách gọi → hành chính nhập thông tin + dự sinh nếu chưa sinh
2. Tư vấn gói (Tiết kiệm 7,050k / Hạnh phúc 12,600k / VIP 21,900k)
3. Khách cọc 200k-1tr → lưu vào DB, trạng thái "deposit_pending"
4. Sau sinh, xác nhận ngày dự sinh → tính ngày hẹn gọi dịch vụ
5. Ký hợp đồng điện tử (OTP Zalo)
6. Phân ca KTV trưởng → app của KTV thấy lịch, khách nhận thông báo Zalo

**Thẻ Liệu Trình Điện Tử:**
- Lưới ô 21 (hoặc 16, 12 tùy gói)
- KTV tích từng buổi (không được sửa sau khi tích)
- Popup xác nhận: "Xác nhận hoàn thành buổi 8/21 — Chị Hoa — 09/05/2025"
- Khách xem: tên KTV phụ trách, số buổi hoàn thành, progress bar
- Tự động gửi Zalo: "Buổi 8/21 hoàn thành, bé tắm xong ngủ ngon!"

**Công Nghệ:**
- React Component: Grid 7×3, state = array Boolean
- Backend: INSERT session_log, tính `completed_sessions = COUNT(*)`
- Webhook Zalo: trigger khi session_log.status = 'completed'

---

### Module 2: Lịch Làm Việc & Check-in

**Calendar Tháng:**
- Grid 7 cột (CN-T7), mỗi ngày hiển thị:
  - Màu sắc: xanh (trống hết) / cam (còn slot) / đỏ (full) / xám (nghỉ)
  - Số ca làm việc
  - Tên KTV (dropdown lọc)
- Click vào ngày → modal timeline ngang 07:00–19:00
  - Mỗi thanh = 1 ca, ghi: giờ bắt đầu–kết thúc, KTV, địa chỉ, khách

**Check-in/Out GPS:**
- KTV bấm "Đã đến" → gọi Geolocation API
- Lưu: lat/lon, timestamp, tính khoảng cách so địa chỉ booking (< 200m OK)
- Alert quản lý nếu: cách > 500m hoặc quên check-in sau 30 phút giờ hẹn
- Tính giờ làm từ checkin → checkout (chấm công tự động)

**Công Nghệ:**
- FullCalendar.js (React wrapper)
- Google Maps Distance Matrix API
- Service Worker cache lịch khi offline

---

### Module 3: Đánh Giá KTV (Bảo Mật Tuyệt Đối)

**Luồng Đánh Giá:**
1. KTV tích buổi xong → Zalo OA tự gửi link đánh giá 1-click (ko cần login)
2. Khách chấm ⭐ 1-5 sao
3. Khách ghi chú (optional, ~200 ký tự max)
4. Gửi → lưu vào `session_reviews`

**Bảo Mật:**
- `note` mã hoá AES-256 server-side, key lưu ở environment
- API `/api/v1/sessions/:id/reviews` chỉ accept role `admin`, `manager`, `ktv_lead`
- KTV **không bao giờ** thấy nội dung ghi chú (chỉ thấy rating trung bình)
- Audit log: ghi lại mỗi lần ai xem review
- UI hiển thị: "Riêng tư — chỉ quản lý Bella Spa xem nội dung ghi chú"

**Tính Trung Bình:**
```sql
SELECT AVG(rating) as avg_rating, COUNT(*) as review_count
FROM session_reviews
WHERE ktv_id = :ktv_id AND EXTRACT(MONTH FROM created_at) = :month
```

**Công Nghệ:**
- Node.js crypto (AES-256-CBC)
- JWT khác cho link đánh giá (1 lần sử dụng)
- Webhook Zalo để trigger gửi link

---

### Module 4: Dashboard Tài Chính & So Sánh

**Metrics Tháng/Quý/Năm:**
- Doanh thu (đã hoàn thành + đã cọc chưa làm)
- Số khách mới
- Số buổi dịch vụ
- Giá trị trung bình/khách
- So sánh % với cùng kỳ năm trước

**Biểu Đồ:**
1. **Bar Chart** (doanh thu năm nay vs năm ngoái, tháng/quý)
2. **Pie Chart** (cơ cấu gói: Tiết kiệm % / Hạnh phúc % / VIP %)
3. **Pie Chart** (nguồn khách: giới thiệu / Zalo / Google Maps / khác)
4. **Line Chart** (mùa vụ lịch sử 12 tháng, xu hướng)

**Công Nghệ:**
- Chart.js
- SQL aggregation: `SUM()`, `COUNT()`, `GROUP BY` theo tháng

---

### Module 5: Tính Lương Tự Động

**Công Thức Lương:**

```
Tổng Lương = Lương Cơ Bản 
           + (Doanh Thu Ca × Tỷ Lệ %) 
           + Thưởng KPI 
           - Trừ Vi Phạm
```

**Chi Tiết:**
- **Lương cơ bản:** Cấu hình mặc định hoặc riêng per KTV
- **% doanh thu:** Tính từ `revenue` table khi `booking_id` có `assigned_ktv_id` match
- **KPI bonus:** Từ `kpi_records` (on-time rate, satisfaction, etc.)
- **Vi phạm:** Trừ % lương theo severity (đi muộn 1 lần = -5%, quên check-in = -10%)

**Quy Trình:**
1. Tháng kế tiếp: bấm "Chốt lương tháng X" (bảng tính + phê duyệt)
2. KTV trưởng duyệt lương team → chủ spa cuối cùng approve
3. Xuất PDF phiếu lương → Zalo cho từng KTV
4. Ghi nhận "paid_date" khi chuyển tiền

**Công Nghệ:**
- NestJS Service tính toán
- Cronjob tháng 1: tính tự động
- PDF generation (pdfkit)
- Email/Zalo notification

---

### Module 6: Chat Nội Bộ Không Dùng Zalo Cá Nhân

**Kênh Chat:**
1. **#Chung Bella Spa** — Thông báo chính sách, lịch họp, nhắc nhở
2. **#Booking BK-YYMMDD-001** — Chat riêng cho từng booking, liên hệ khách
3. **#Team Q7** — Nhóm KTV theo khu vực, quản lý bởi KTV trưởng

**Tính Năng:**
- Lưu toàn bộ lịch sử → khi KTV rời công ty vẫn giữ chat record phục vụ kiểm tra tranh chấp
- Ghim tin quan trọng
- Tìm kiếm tin nhắn
- System notification (khi có booking mới, lương được duyệt, etc.)

**Công Nghệ:**
- WebSocket (Socket.io hoặc Supabase Realtime)
- Message threads lưu DB (`chat_messages` table)
- Realtime presence (online/offline)

---

### Module 7: Gợi Ý Phân Ca Thông Minh

**Thuật Toán Điểm Phù Hợp:**

```
Score = (100 - distance_score × 30) 
      + availability_score × 25 
      + rating_score × 25 
      + familiar_bonus × 20

distance_score = khoảng cách (km) [0-100]
availability_score = số slot trống [0-100]
rating_score = đánh giá KTV [0-100]
familiar_bonus = 15 nếu KTV đã từng phục vụ khách này
```

**Gợi Ý:**
1. Khi booking mới vào → API `/api/v1/assignments/suggestions`
2. Trả lại 3 KTV top điểm
3. Bên cạnh mỗi KTV: dist, avail, rating, familiar badge, điểm tổng
4. Alert: "Nếu chọn Lan: di chuyển 35 phút giữa ca, hợp lý"

**Công Nghệ:**
- Google Maps Distance Matrix (batch call)
- SQL query: sắp xếp theo điểm
- Caching (Redis 5 phút)

---

### Module 8: Dự Báo Doanh Thu & Cảnh Báo

**Pipeline Doanh Thu:**
```
Doanh Thu Tháng N = Xác Nhận (đã hoàn thành)
                  + Committed (đã ký + cọc)
                  + Probable (đang tư vấn × 50%)
```

**Cảnh Báo Sớm:**
- "Tháng này dự báo 97tr / mục tiêu 110tr — thiếu 13tr"
- "Cần 1–2 booking gói Hạnh phúc để vượt mục tiêu"
- "Lịch sử: tuần cuối tháng khách huỷ 30% — nên đẩy booking sớm"

**Phân Tích Mùa Vụ:**
- Line chart 12 tháng (lịch sử 2 năm)
- Trend ngồi dốc lên/xuống
- Ghi chú: "Tháng 8–9 thường thấp (hè nóng), tháng 11 cao"

**Công Nghệ:**
- SQL aggregate + GROUP BY tháng
- Nightly cronjob update forecast (01:00 AM)
- Chart.js với date-fns

---

### Module 9: Chương Trình Thành Viên & Tích Điểm

**3 Hạng:**
- **Bạc:** 1 gói dùng → ưu tiên đặt lịch
- **Vàng:** 2-3 gói → +1 buổi miễn phí
- **Kim cương:** 4+ gói → KTV riêng + ưu đãi 10%

**Tích Điểm:**
- 100 điểm = 1 buổi gói (dựa trên giá gói)
- Tiết kiệm 7,050k = 70 điểm
- Hạnh phúc 12,600k = 126 điểm

**Thẻ Thành Viên Kỹ Thuật Số:**
- QR code / mã BS-YYMMDD-NNN
- Khách chia sẻ link Zalo
- App hiển thị: hạng, điểm tích lũy, progress lên hạng tiếp

**Công Nghệ:**
- Membership record FK customer
- Points engine: auto-add sau khi session completed
- QR code generation (qrcode library)

---

### Module 10: Hệ Thống Nhượng Quyền & Multi-tenant

**Cấu Trúc:**
- 1 **tenant gốc** (Bella Spa Q7) = chủ hệ thống
- N **tenant con** (chi nhánh) = từng nhược quyền

**Dữ Liệu Độc Lập:**
- Mỗi tenant dữ liệu hoàn toàn tách biệt (khách, KTV, booking, doanh thu)
- Truy vấn luôn filter `WHERE tenant_id = :current_tenant_id`
- Phí royalty 10% tính tự động từ doanh thu chi nhánh

**Dashboard Chủ Hệ Thống:**
- Thống kê tổng chuỗi: tổng doanh thu, số khách, số KTV
- So sánh chi nhánh: xếp hạng, growth %, royalty
- Royalty tính mỗi tháng, lập báo cáo (có dấu chữ ký số)

**Công Nghệ:**
- Middleware auth check tenant_id
- JWT payload chứa tenant_id
- Separate DB per tenant (hoặc schema per tenant nếu PostgreSQL)
- Reporting query: `UNION` across tenants (chỉ khi view toàn chuỗi)

---

## 🔐 Bảo Mật & Tuân Thủ

### Authentication & Authorization

**JWT Strategy:**
```
Header: Authorization: Bearer <token>
Token Payload: { sub, email, role, tenant_id, exp }
Refresh Token: Lưu httpOnly cookie, rotate mỗi lần dùng
TTL: 15 phút JWT, 7 ngày Refresh Token
```

**Role-Based Access Control (RBAC):**
```typescript
Admin         → Tất cả
KTV_Lead      → Team mình, lương team
KTV           → Lịch của mình, check-in, buổi của mình
Admin_Staff   → Nhân sự, kho
Accountant    → Tài chính read-only
```

### Data Encryption

**At Rest:**
- Mật khẩu: bcrypt (salt rounds 10)
- Session review note: AES-256-CBC, key từ env var
- Database: PostgreSQL SSL connection

**In Transit:**
- HTTPS/TLS 1.3 (Let's Encrypt)
- API response signed (optional, JWT handle auth)

### API Security

```
- Rate limiting: 100 req/min per IP (Redis)
- CORS: whitelist domain Bella Spa
- CSRF: SameSite cookie
- SQL Injection: Parameterized queries (Prisma ORM)
- XSS: React auto-escape, CSP header
- Input validation: Joi/Zod schema
```

### Audit Logging

```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY,
  user_id UUID,
  action VARCHAR(100), -- 'view_review', 'edit_salary', etc.
  resource VARCHAR(100),
  resource_id UUID,
  timestamp TIMESTAMP,
  ip_address VARCHAR(45),
  changes JSONB, -- before/after
  tenant_id UUID
);
```

### Compliance

- **GDPR:** Right to be forgotten (soft delete + anonymization)
- **Data Residency:** VPS Việt Nam (không cross-border)
- **Backup:** Daily encrypted backup (Cloudflare R2 / S3)
- **Retention:** 3 năm booking + chat, 1 năm tài chính

### GPS & Location Privacy

- Lưu check-in location: chỉ admin/manager view
- KTV không thấy vị trí đồng nghiệp
- Hết ca: xóa location data sau 7 ngày (option)

---

## 📊 Quy Trình Vận Hành Hằng Ngày

### Buổi Sáng (08:00)
1. Hành chính kiểm tra lịch ca hôm nay
2. KTV trưởng phân ca booking mới (gợi ý AI)
3. KTV nhận thông báo Zalo: lịch, địa chỉ, khách
4. Dashboard thực hiện: xem KTV nào đang on-site, độ tiến độ

### Trong Ca Làm Việc (KTV)
1. Check-in GPS khi đến nhà khách
2. Thực hiện dịch vụ
3. Check-out GPS
4. Tích buổi (popup xác nhận) → Zalo nhắc khách
5. Chụp ảnh bé/mẹ → upload qua app

### Cuối Buổi Chiều (Quản Lý)
1. Kiểm tra có KTV nào quên check-in/out
2. Xem đánh giá KTV mới
3. Thêm chi phí nếu có
4. Confirm lịch ngày hôm sau

### Cuối Tuần (Thứ 6)
1. KTV trưởng review KPI team
2. Ghi nhận vi phạm/khen thưởng
3. Duyệt lương draft (chủ spa finalize)

### Cuối Tháng (28–30)
1. Chốt lương → phê duyệt → xuất PDF → gửi Zalo
2. Tính commission referral nếu có
3. Tính royalty chi nhánh
4. Export báo cáo tài chính → kế toán kiểm tra

---

## 🔧 Cấu Hình Deployment

### Local Development

```bash
git clone <repo>
cd bella-spa-backend
cp .env.example .env
docker-compose up -d  # postgres, redis
npm install
npm run migrations
npm run seed
npm run start:dev
```

### Production (VPS)

```
Server: Ubuntu 24 LTS, 4GB RAM, 2vCPU
Services:
  - Nginx (port 80/443, reverse proxy)
  - Node.js + PM2 (port 3000)
  - PostgreSQL 15 (port 5432, local only)
  - Redis 7 (port 6379, local only)
  - Certbot (Let's Encrypt, auto-renew)

Deploy:
  1. git pull origin main
  2. npm ci (production dependencies)
  3. npm run migrations (if new)
  4. npm run build
  5. pm2 restart bella-spa
  6. nginx reload
```

### Database Backup

```bash
# Daily 02:00 UTC
0 2 * * * pg_dump -Fc bella_spa | gzip | aws s3 cp - s3://bella-spa-backup/$(date +\%Y-\%m-\%d).dump.gz
```

---

## 📞 Liên Hệ & Support

**Team Dev Antigracity:**
- Triển khai theo Phase 1 → Phase 2 → Phase 3
- Sprint 2 tuần, daily standup
- QA automation (Jest + E2E Cypress)
- Monitoring & logging (ELK stack optional)

**Maintenance Phase 1 → Phase 2:**
- Bug fixes + minor features
- Backup strategy đã sẵn sàng
- Training KTV/Hành chính sử dụng

---

**Tài liệu này là bản đầy đủ cho team dev. Cần bất kỳ làm rõ nào, liên hệ ngay.**

