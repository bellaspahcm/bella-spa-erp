# 🚀 Bella API Gateway - Tài Liệu Tổng Hợp

**Phiên bản**: 1.0.0  
**Ngày cập nhật**: 18/06/2026  
**Tác giả**: Bella SPA ERP Team

---

## 📋 Mục Lục

1. [Tổng Quan Hệ Thống](#1-tổng-quan-hệ-thống)
2. [Kiến Trúc API Gateway](#2-kiến-trúc-api-gateway)
3. [Quản Lý Partners (Admin UI)](#3-quản-lý-partners-admin-ui)
4. [Hướng Dẫn Kết Nối (Partner Guide)](#4-hướng-dẫn-kết-nối-partner-guide)
5. [Tài Liệu Nội Bộ (Internal Guide)](#5-tài-liệu-nội-bộ-internal-guide)
6. [API Reference Chi Tiết](#6-api-reference-chi-tiết)
7. [Security & Best Practices](#7-security--best-practices)
8. [FAQ & Troubleshooting](#8-faq--troubleshooting)

---

## 1. Tổng Quan Hệ Thống

### 1.1 Giới Thiệu

**Bella API Gateway** là hệ thống cổng tích hợp mở (Open API Gateway) cho phép các đối tác (partners) kết nối và trao đổi dữ liệu với Bella Spa ERP Platform một cách an toàn, hiệu quả và có kiểm soát.

### 1.2 Mục Đích

- ✅ **Tích hợp đa nền tảng**: Kết nối với POS, Payment Gateway, E-Invoice, HR platforms
- ✅ **Quản lý tập trung**: Admin UI để quản lý toàn bộ partners và API keys
- ✅ **Bảo mật cao**: Authentication, rate limiting, scopes, SLA monitoring
- ✅ **Sandbox testing**: Môi trường test an toàn cho partners
- ✅ **Real-time webhooks**: Nhận sự kiện theo thời gian thực
- ✅ **Analytics & Monitoring**: Theo dõi usage, performance, errors

### 1.3 Loại Partners Được Hỗ Trợ

| Loại Partner | Mô Tả | Ví dụ |
|--------------|-------|-------|
| **POS** | Hệ thống điểm bán hàng | KiotViet, MISA, Sapo |
| **Payment** | Cổng thanh toán | Casso, PayOS, MoMo, ZaloPay |
| **Invoice** | Hóa đơn điện tử | VNPT, Viettel, MISA |
| **Franchise** | Đối tác nhượng quyền | Chi nhánh franchise |
| **HR** | Nền tảng quản lý nhân sự | HRM systems, Timekeeping |
| **Analytics** | Công cụ phân tích/BI | Google Analytics, Tableau |
| **Mobile App** | Ứng dụng di động | iOS/Android apps |
| **Other** | Tích hợp khác | Custom integrations |



### 1.4 Thống Kê Hệ Thống (Hiện Tại)

📊 **API Endpoints**: 24 endpoints  
🔑 **Partners**: 0 (sẵn sàng onboard)  
📁 **Components**: 11 UI components  
📝 **Documentation**: 15+ markdown files  
🧪 **Test Coverage**: Comprehensive test suite

---

## 2. Kiến Trúc API Gateway

### 2.1 Cấu Trúc Tổng Quan

```
BELLA API GATEWAY
│
├── 🔐 AUTHENTICATION LAYER
│   ├── API Key validation (Bearer token)
│   ├── Scope-based permissions
│   └── Tenant isolation
│
├── 🚦 MIDDLEWARE LAYER
│   ├── Rate limiting (per partner tier)
│   ├── Request validation (Zod schemas)
│   ├── Sandbox environment isolation
│   └── Error handling
│
├── 📊 ADMIN MANAGEMENT UI
│   ├── Partner CRUD operations
│   ├── API key management
│   ├── Usage analytics dashboard
│   ├── SLA monitoring & alerts
│   ├── Webhook configuration
│   └── Security settings
│
├── 🔌 PUBLIC API ENDPOINTS
│   ├── Orders API
│   ├── Payments API
│   ├── Customers API
│   ├── Products API
│   └── Webhooks API
│
└── 📈 MONITORING & LOGGING
    ├── Request/response logs
    ├── Error tracking
    ├── Performance metrics
    └── SLA compliance tracking
```

### 2.2 Database Schema

#### Bảng Chính

1. **`api_partners`**: Thông tin partner
   - `id`, `tenant_id`, `partner_name`, `partner_type`
   - `api_key`, `api_secret`
   - `allowed_scopes[]`, `is_active`, `is_sandbox`
   - `rate_limit_tier`, `webhook_url`, `webhook_secret`

2. **`api_request_logs`**: Logs tất cả API requests
   - `id`, `partner_id`, `tenant_id`
   - `method`, `endpoint`, `status_code`, `response_time_ms`
   - `is_error`, `error_message`, `ip_address`

3. **`api_rate_limit_counters`**: Đếm requests theo time window
   - `id`, `partner_id`, `window_start`, `window_type`
   - `request_count`, `error_count`

4. **`sandbox.sandbox_metadata`**: Quản lý sandbox resets
   - `id`, `partner_id`, `last_reset_at`, `reset_count`



### 2.3 API Scopes (Permissions)

| Scope | Mô Tả | Ví Dụ Endpoint |
|-------|-------|----------------|
| `order:read` | Xem đơn hàng | `GET /api/v1/orders` |
| `order:write` | Tạo/sửa đơn hàng | `POST /api/v1/orders` |
| `order:complete` | Hoàn thành đơn | `PATCH /api/v1/orders/{id}/complete` |
| `order:cancel` | Hủy đơn hàng | `DELETE /api/v1/orders/{id}` |
| `payment:read` | Xem thanh toán | `GET /api/v1/payments` |
| `payment:write` | Ghi nhận thanh toán | `POST /api/v1/payments` |
| `payment:refund` | Hoàn tiền | `POST /api/v1/payments/{id}/refund` |
| `invoice:read` | Xem hóa đơn | `GET /api/v1/invoices` |
| `invoice:create` | Tạo hóa đơn | `POST /api/v1/invoices` |
| `invoice:cancel` | Hủy hóa đơn | `DELETE /api/v1/invoices/{id}` |
| `pos:sync` | Đồng bộ POS | `POST /api/v1/pos/sync` |
| `hr:sync` | Đồng bộ HR | `POST /api/v1/hr/sync` |
| `analytics:read` | Xem báo cáo | `GET /api/v1/analytics` |
| `webhook:subscribe` | Đăng ký webhook | `POST /api/v1/webhooks` |

**Wildcard Scopes** (Admin only):
- `order:*` - Tất cả permissions về orders
- `payment:*` - Tất cả permissions về payments
- `invoice:*` - Tất cả permissions về invoices

### 2.4 Rate Limit Tiers

| Tier | Requests/Minute | Requests/Day | Burst | Price |
|------|-----------------|--------------|-------|-------|
| **Free** | 60 | 1,000 | 10 | Free |
| **Basic** | 300 | 10,000 | 30 | 500K VND/tháng |
| **Pro** | 1,000 | 100,000 | 100 | 2M VND/tháng |
| **Premium** | 3,000 | 500,000 | 300 | 5M VND/tháng |
| **Enterprise** | 10,000 | 5,000,000 | 1,000 | Custom |

---

## 3. Quản Lý Partners (Admin UI)

### 3.1 Truy Cập Admin Dashboard

**URL**: `/dashboard/admin/partners`  
**Quyền yêu cầu**: Admin hoặc Owner role

### 3.2 Tính Năng Admin UI

#### 📊 Dashboard Overview
- **Stats Cards**: Total partners, Active partners, Total requests (30d), Avg error rate
- **Partner List**: Table với filters, search, pagination
- **Quick Actions**: Create partner, View analytics, Export data

#### ➕ Create/Edit Partner Form (4-Step Wizard)

**Step 1: Basic Information**
- Partner name, type, description
- Contact email, phone
- Sandbox mode toggle

**Step 2: Scopes & Permissions**
- Visual scope selector grouped by categories
- 6 scope presets: Basic, POS Integration, Payment Gateway, HR Platform, Invoice Provider, Admin
- Custom scope selection

**Step 3: Webhooks Configuration**
- Webhook URL input
- Webhook secret generation
- Event subscription (order.created, payment.completed, etc.)
- Test webhook functionality

**Step 4: Review & Confirm**
- Summary of all settings
- API key preview (generated after create)
- Terms & conditions acceptance



#### 📋 Partner Detail Page (9 Tabs)

**1. Tab Overview**
- Partner basic info & contact
- API key management (regenerate, rotate)
- Quick stats (requests, errors, uptime)
- Rate limit configuration
- Notes & tags

**2. Tab Scopes**
- Visual scope manager
- Scope presets (6 options)
- Permission changes audit log

**3. Tab Logs**
- Request history table
- Filters: method, status, date range
- View details dialog
- Export to CSV

**4. Tab Webhooks**
- Webhook configuration form
- Test webhook with sample payload
- Delivery logs (success/failed)
- Retry mechanism UI

**5. Tab Usage Analytics**
- KPI cards: Total requests, Error rate, Avg latency, Uptime
- Bar chart: Requests by day
- Top endpoints table
- Rate limit status indicator

**6. Tab Webhook Logs**
- Webhook delivery history
- Stats: Total sent, Success rate, Failed count, Pending retries
- Filters: status, event type, date range
- Manual retry & batch retry buttons
- Auto-retry configuration

**7. Tab Security**
- API Key Rotation Scheduler
  - Rotation policy: Auto/Manual, Interval (30/60/90/180 days)
  - Overlap period configuration
- API Key Lifecycle Timeline
  - Visual timeline of all keys
  - Status: Active, Rotating, Deprecated, Revoked
  - Expiration dates & warnings

**8. Tab Activity**
- Partner Activity Timeline
  - All partner actions with timestamps
  - Event types: API calls, Config changes, Key rotations, Webhooks, Errors
  - Filters: search, event type, date range
- Export activity log

**9. Tab SLA Monitor**
- Compliance status cards (Overall, Uptime, Latency, Error Rate)
- Quick stats (Requests, Avg/Peak per minute)
- Active alerts banner
- Alert history table with actions (acknowledge/resolve)
- Time range selector (1h/24h/7d/30d)
- SLA configuration dialog
- Export metrics to CSV



#### 🎛️ Advanced Features

1. **Rate Limit Customization** - Custom limits per partner
2. **Advanced Analytics Dashboard** - Partner comparison, Cost & revenue analysis
3. **Webhook Retry Mechanism** - Automatic & manual retry with exponential backoff
4. **API Key Rotation Scheduler** - Scheduled key rotation policies
5. **Partner Activity Timeline** - Complete audit trail
6. **SLA Monitoring & Alerts** - Real-time monitoring with notifications

---

## 4. Hướng Dẫn Kết Nối (Partner Guide)

### 4.1 Đăng Ký Partner Account

📧 **Contact**: api-partners@bellaspa.vn  
📝 **Subject**: "API Partnership Request - [Company Name]"

**Thông tin cần cung cấp**:
- Tên công ty/tổ chức
- Loại partner (POS/Payment/Invoice/etc.)
- Mô tả tích hợp dự kiến
- Website & thông tin liên hệ
- Use cases cụ thể

### 4.2 Nhận API Key

Sau khi được duyệt, bạn sẽ nhận:

**Sandbox Key** (Testing):
```
pk_test_abc123xyz789defghi...
```

**Production Key** (Live):
```
pk_live_abc123xyz789defghi...
```

### 4.3 Tạo Request Đầu Tiên

#### Using cURL
```bash
curl -X GET https://bella-spa-erp.vercel.app/api/v1/orders \
  -H "Authorization: Bearer pk_test_abc123xyz789..." \
  -H "Content-Type: application/json"
```

#### Using JavaScript
```javascript
const response = await fetch('https://bella-spa-erp.vercel.app/api/v1/orders', {
  headers: {
    'Authorization': `Bearer ${API_KEY}`,
    'Content-Type': 'application/json'
  }
});

const data = await response.json();
console.log(data);
```

#### Using Python
```python
import requests

response = requests.get(
    'https://bella-spa-erp.vercel.app/api/v1/orders',
    headers={
        'Authorization': f'Bearer {API_KEY}',
        'Content-Type': 'application/json'
    }
)

data = response.json()
print(data)
```

### 4.4 Response Format

**Success Response**:
```json
{
  "success": true,
  "data": { /* your data */ },
  "meta": {
    "request_id": "req_abc123",
    "timestamp": "2026-06-18T10:30:00Z"
  }
}
```

**Error Response**:
```json
{
  "success": false,
  "error": {
    "code": "AUTH_001",
    "message": "Invalid API key"
  }
}
```

### 4.5 Webhooks Setup

**1. Đăng ký Webhook Endpoint**:
```bash
curl -X POST https://bella-spa-erp.vercel.app/api/admin/partners/{id}/test-webhook \
  -H "Authorization: Bearer pk_test_..." \
  -d '{
    "webhook_url": "https://your-domain.com/webhooks/bella",
    "webhook_events": ["order.created", "payment.completed"]
  }'
```

**2. Xác thực Webhook Signature**:
```javascript
const crypto = require('crypto');

function verifySignature(payload, signature, secret) {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}
```

---

## 5. Tài Liệu Nội Bộ (Internal Guide)

### 5.1 Cấu Trúc Code

```
src/
├── app/api/admin/partners/
│   ├── route.ts                    # GET/POST partners list
│   ├── [id]/
│   │   ├── route.ts               # GET/PATCH/DELETE partner
│   │   ├── logs/route.ts          # Request logs
│   │   ├── usage/route.ts         # Usage analytics
│   │   ├── scopes/route.ts        # Scope management
│   │   ├── sla-metrics/route.ts   # SLA monitoring
│   │   ├── sla-alerts/route.ts    # SLA alerts
│   │   └── sla-config/route.ts    # SLA configuration
│   ├── analytics/route.ts         # Partner analytics
│   └── stats/route.ts             # Dashboard stats
│
├── components/admin/partners/
│   ├── PartnersList.tsx           # Main list view
│   ├── PartnersTable.tsx          # Data table
│   ├── PartnerFormWizard.tsx      # Create/edit wizard
│   ├── wizard-steps/              # 4 wizard steps
│   ├── detail-tabs/               # 9 detail tabs
│   ├── SLAAlertConfigDialog.tsx   # SLA configuration
│   └── RateLimitCustomization.tsx # Rate limit config
│
├── lib/
│   ├── middleware/
│   │   ├── rate-limit.middleware.ts
│   │   ├── validation.middleware.ts
│   │   └── sandbox.middleware.ts
│   ├── mock-data/
│   │   └── sla-generator.ts       # Mock SLA data
│   └── utils/
│       └── api-gateway.utils.ts   # Helper functions
│
└── types/
    └── api-gateway.ts              # All TypeScript types
```

### 5.2 Adding New Endpoint

**1. Define types** in `types/api-gateway.ts`
**2. Create API route** in `app/api/admin/partners/`
**3. Add middleware** if needed
**4. Update UI components**
**5. Write tests**
**6. Update documentation**

### 5.3 Testing

```bash
# Run all tests
npm run test

# Run API Gateway tests only
npm run test -- api-gateway

# Build (TypeScript check)
npm run build
```

---

## 6. API Reference Chi Tiết

📚 **Xem file riêng**: `docs/api/API_REFERENCE.md`

**Các endpoint chính**:

### Orders API
- `POST /api/v1/orders` - Tạo đơn hàng
- `GET /api/v1/orders` - List đơn hàng
- `GET /api/v1/orders/{id}` - Chi tiết đơn hàng
- `PATCH /api/v1/orders/{id}` - Cập nhật đơn hàng
- `DELETE /api/v1/orders/{id}` - Hủy đơn hàng

### Payments API
- `POST /api/v1/payments` - Ghi nhận thanh toán
- `GET /api/v1/payments` - List thanh toán
- `POST /api/v1/payments/{id}/refund` - Hoàn tiền

### Customers API
- `POST /api/v1/customers` - Tạo khách hàng
- `GET /api/v1/customers` - List khách hàng
- `GET /api/v1/customers/{id}` - Chi tiết khách hàng

### Products API
- `GET /api/v1/products` - List sản phẩm/dịch vụ

---

## 7. Security & Best Practices

### 7.1 Bảo Mật API Key

✅ **DO**:
- Store trong environment variables
- Sử dụng HTTPS cho mọi request
- Rotate keys định kỳ (30-90 days)
- Giám sát usage bất thường

❌ **DON'T**:
- Commit vào Git repository
- Expose trong client-side code
- Share giữa các môi trường
- Log API keys trong error messages

### 7.2 Rate Limiting

**Headers trả về**:
```
X-RateLimit-Limit: 300
X-RateLimit-Remaining: 250
X-RateLimit-Reset: 1718611200
```

**Retry Logic**:
```javascript
async function retryWithBackoff(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (error.status === 429 && i < maxRetries - 1) {
        const waitTime = Math.pow(2, i) * 1000; // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      throw error;
    }
  }
}
```

### 7.3 Idempotency

Sử dụng `Idempotency-Key` header cho mutations:

```bash
curl -X POST https://bella-spa-erp.vercel.app/api/v1/orders \
  -H "Authorization: Bearer pk_live_..." \
  -H "Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000" \
  -d '{"customer_id": "cus_123", "items": [...]}'
```

### 7.4 Error Handling

**Error Codes**:
- `AUTH_001` - Invalid API key
- `AUTH_002` - API key inactive
- `AUTHZ_001` - Insufficient permissions
- `VAL_001` - Invalid request body
- `RATE_LIMIT_EXCEEDED` - Rate limit exceeded
- `SERVER_001` - Internal server error

---

## 8. FAQ & Troubleshooting

### Q: Làm sao để reset sandbox data?

```bash
curl -X DELETE https://bella-spa-erp.vercel.app/api/admin/sandbox/reset \
  -H "Authorization: Bearer pk_test_..."
```

### Q: Webhook không nhận được events?

**Checklist**:
1. ✅ URL có support HTTPS?
2. ✅ URL có publicly accessible?
3. ✅ Response status code = 200?
4. ✅ Response time < 30s?
5. ✅ Verify webhook signature đúng?

### Q: Rate limit bị exceed?

**Solutions**:
1. Upgrade tier (contact sales)
2. Implement request batching
3. Cache responses khi có thể
4. Sử dụng webhooks thay vì polling

### Q: API key bị leak?

**Immediate actions**:
1. 🚨 Regenerate API key ngay lập tức (Admin UI)
2. 📧 Notify security team: security@bellaspa.vn
3. 🔍 Review logs để identify unauthorized usage
4. 🔄 Update key trong application configs
5. ✅ Enable API key rotation policy

---

## 📞 Support & Contact

### Technical Support
- 📧 Email: api-support@bellaspa.vn
- ⏰ Response time: 24h (business days)

### Partnership Inquiries
- 📧 Email: api-partners@bellaspa.vn

### Security Issues
- 📧 Email: security@bellaspa.vn (urgent)
- 🔐 PGP Key: Available on request

### Documentation
- 📖 Docs: https://docs.bellaspa.vn/api
- 📊 Status: https://status.bellaspa.vn
- 📋 Changelog: https://changelog.bellaspa.vn

---

## 📝 Document History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0.0 | 2026-06-18 | Initial comprehensive guide | Bella Team |

---

**© 2026 Bella Spa ERP. All rights reserved.**

