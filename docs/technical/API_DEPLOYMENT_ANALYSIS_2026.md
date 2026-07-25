# PHÂN TÍCH KẾ HOẠCH TRIỂN KHAI API - BELLA ERP 2026

**Ngày phân tích**: 17/06/2026  
**Người phân tích**: Kiro AI Agent  
**Phiên bản tài liệu**: 1.0

---

## 📋 MỤC LỤC

1. [Tổng Quan](#tổng-quan)
2. [Tình Trạng Hiện Tại](#tình-trạng-hiện-tại)
3. [Kiến Trúc API](#kiến-trúc-api)
4. [Kế Hoạch 5 Phases](#kế-hoạch-5-phases)
5. [Chiến Lược POS HR Platform](#chiến-lược-pos-hr-platform)
6. [Bản Đồ Tích Hợp](#bản-đồ-tích-hợp)
7. [Đánh Giá & Phân Tích](#đánh-giá--phân-tích)
8. [Rủi Ro & Giải Pháp](#rủi-ro--giải-pháp)
9. [Khuyến Nghị](#khuyến-nghị)

---

## 🎯 TỔNG QUAN

### Mục Tiêu Chiến Lược

Kế hoạch triển khai API Gateway và tích hợp thị trường Việt Nam với **5 mục tiêu chính**:

1. **🔐 API Gateway Foundation**
   - Xây dựng cổng API chuẩn REST với authentication, rate limiting, logging
   - TenantContext auto-injection cho multi-tenancy
   - Core contract types cho type safety

2. **💳 Tích Hợp Thanh Toán**
   - VietQR, ngân hàng (Vietcombank, MB, ACB, TPBank)
   - Payment webhooks với idempotency
   - Tự động đối soát và tạo revenue/accounting entries

3. **📱 Tích Hợp Zalo & Gửi Tin**
   - Zalo OA API cho nhắc lịch, xác nhận booking
   - SMS gateway (VNPT, Viettel, Mobifone)
   - Email marketing automation

4. **📄 Hóa Đơn Điện Tử**
   - VNPT Invoice, Viettel eSinvoice, MISA eFast
   - Tự động xuất hóa đơn khi hoàn thành dịch vụ
   - Sync với accounting module

5. **🔔 Webhook & Real-time Events**
   - Cho franchise, mobile app, third-party integrations
   - Event-driven architecture
   - Real-time notifications

### Tầm Nhìn

> *Biến Bella ERP từ một hệ thống internal-only thành một **nền tảng mở** (open platform) hỗ trợ tích hợp với toàn bộ hệ sinh thái thanh toán, thông tin và kế toán tại Việt Nam.*

---

## 📊 TÌNH TRẠNG HIỆN TẠI

### APIs Đã Có (Phase 3 Complete)

Theo `docs/api/phase-3-api-reference.md` và `docs/api-reference.md`, hệ thống đã có:

#### ✅ Order Management APIs
- `POST /api/orders` - Tạo booking/order mới
- `GET /api/orders` - Danh sách orders với tenant filter
- `GET /api/orders/:id` - Chi tiết order
- `PATCH /api/orders/:id` - Cập nhật order
- `POST /api/orders/:id/complete` - Hoàn thành order với side effects
- `POST /api/orders/:id/cancel` - Hủy order và refund

#### ✅ Payment APIs
- `POST /api/payments` - Xử lý thanh toán
- `GET /api/payments` - Danh sách giao dịch
- `GET /api/payments/:id` - Chi tiết payment
- `POST /api/payments/:id/refund` - Hoàn tiền

#### ✅ Notification APIs
- `POST /api/notifications` - Gửi thông báo
- `GET /api/notifications` - Danh sách notification
- `PATCH /api/notifications/:id/read` - Đánh dấu đã đọc

#### ✅ Analytics APIs
- `GET /api/analytics/dashboard` - Dashboard data với module widgets
- `GET /api/analytics/reports/:reportType` - Tạo báo cáo (revenue, expenses, P&L)

#### ✅ Audit APIs
- `GET /api/audit-logs` - Audit trail cho compliance

#### ✅ Tenant Configuration
- `GET /api/tenant/context` - Tenant config cho TenantContextProvider

#### ✅ Webhooks (Partial)
- `POST /api/webhooks/payment` - Payment webhook với idempotency
  - Hỗ trợ: Casso, SePay, PayOS
  - Auto-reconcile booking theo pattern `BELLA...`
  - Tạo revenue và accounting entries
  - Secret-based authentication (`PAYMENT_WEBHOOK_SECRET`)

#### ✅ Cron Jobs
- `GET /api/cron/accounting-worker` - Xử lý accounting outbox batch (50 events)
- `GET /api/cron/ai-autopilot` - AI autopilot alerts qua Telegram
- `GET /api/cron/zalo-reminders` - Nhắc lịch Zalo định kỳ

#### ✅ AI APIs
- `POST /api/v1/ai/coo-orchestrator` - AI COO phân tích dự báo
- `POST /api/v1/ai/action-approval` - AI action approval workflow
- `POST /api/v1/ai/telegram-webhook` - Telegram bot `/coo` command

### Đặc Điểm Kỹ Thuật Hiện Tại

#### 🔐 Authentication & Authorization
- **Session-based auth** với httpOnly cookies
- Token validity: 7 days, auto-refresh on activity
- Role-based access control (RBAC): `admin`, `accountant`, `staff`, `customer`, `super_admin`

#### 🏢 Multi-Tenancy
- **TenantContext auto-injection** từ session token
- Database RLS (Row-Level Security) policies
- Automatic tenant filtering cho mọi query
- Tenant isolation at multiple layers

#### 📝 Type Safety
- **Core Contract Types**: `CoreBookingOrder`, `PaymentIntent`, `NotificationEvent`, `AuditEvent`
- TypeScript strict mode
- Supabase generated database schemas

#### 🔄 Module Adapter Integration
- Module-specific business logic qua adapters
- `adapter.validateBookingRules()` - Validate logic theo ngành
- `adapter.onBookingCompleted()` - Side effects (salary, inventory, revenue)
- `adapter.getModuleWidgets()` - Dashboard widgets riêng

