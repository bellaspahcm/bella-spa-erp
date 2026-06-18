# Hướng Dẫn Sử Dụng Admin UI - Quản Lý Đối Tác API

**Phiên bản**: 1.1  
**Ngày cập nhật**: 18/06/2026  
**Trạng thái**: ✅ Hoàn thành Phần 2/4 (Forms) + Phần 3/4 (Detail Page)

---

## 📋 Mục Lục

1. [Tổng Quan](#tổng-quan)
2. [Danh Sách Đối Tác](#danh-sách-đối-tác)
3. [Tạo Đối Tác Mới](#tạo-đối-tác-mới)
4. [Chỉnh Sửa Đối Tác](#chỉnh-sửa-đối-tác)
5. [Xem Chi Tiết Đối Tác](#xem-chi-tiết-đối-tác) ⭐ MỚI
6. [Quản Lý API Key](#quản-lý-api-key)
7. [Xóa Đối Tác](#xóa-đối-tác)
8. [Bảo Mật & Quyền Truy Cập](#bảo-mật--quyền-truy-cập)

---

## Tổng Quan

Admin UI cung cấp giao diện quản lý đối tác API một cách trực quan, giúp quản trị viên:

- ✅ Tạo và quản lý đối tác API
- ✅ Phân quyền truy cập (scopes)
- ✅ Cấu hình webhooks
- ✅ Quản lý API keys (tạo mới, tái tạo)
- ✅ Theo dõi usage và logs
- ✅ Sandbox testing

### Vị Trí Truy Cập

```
Dashboard → Hệ thống → API Partners
URL: /dashboard/admin/partners
```

### Quyền Truy Cập

Chỉ **admin** và **owner** mới có quyền truy cập Admin UI.

---

## Danh Sách Đối Tác

### Đường Dẫn
```
/dashboard/admin/partners
```

### Tính Năng

#### 1. **Tìm Kiếm**
- Tìm theo tên đối tác
- Real-time search (không cần nhấn Enter)

#### 2. **Bộ Lọc**
- **Loại Đối Tác**: POS, Payment, Invoice, Franchise, HR, Analytics, Mobile App, Other
- **Trạng Thái**: Active, Inactive
- **Môi Trường**: Sandbox, Production

#### 3. **Thao Tác**
- **Xem Chi Tiết**: Click vào dòng hoặc chọn "View Details"
- **Chỉnh Sửa**: Icon Edit hoặc menu dropdown
- **Copy API Key**: Click icon Copy bên cạnh API key
- **Tái Tạo Key**: Menu dropdown → "Regenerate Key"
- **Xóa Đối Tác**: Menu dropdown → "Delete Partner" (xóa mềm)
- **Export CSV**: Nút "Export" để tải danh sách

#### 4. **Phân Trang**
- Hiển thị 20 đối tác/trang (mặc định)
- Nút Previous/Next để điều hướng
- Hiển thị tổng số đối tác

---

## Tạo Đối Tác Mới

### Đường Dẫn
```
/dashboard/admin/partners/new
```

### Quy Trình 4 Bước

#### **Bước 1: Thông Tin Cơ Bản**

##### Các Trường Bắt Buộc (*)
- **Tên Đối Tác** *: Tên chính thức của tổ chức đối tác
  - Ví dụ: "KiotViet", "Casso Payment Gateway"
- **Loại Đối Tác** *: Chọn loại phù hợp
  - **POS**: Hệ thống bán hàng (KiotViet, MISA, Sapo)
  - **Payment**: Cổng thanh toán (Casso, SePay, PayOS)
  - **Invoice**: Nhà cung cấp hóa đơn điện tử (VNPT, Viettel, MISA)
  - **Franchise**: Đối tác nhượng quyền
  - **HR**: Nền tảng quản lý nhân sự
  - **Analytics**: Công cụ phân tích/BI
  - **Mobile App**: Ứng dụng di động
  - **Other**: Tích hợp khác
- **Email Liên Hệ** *: Email chính thức của đối tác

##### Các Trường Tùy Chọn
- **Mô Tả**: Mô tả ngắn về đối tác và mục đích tích hợp
- **Số Điện Thoại**: Số điện thoại liên hệ
- **Chế Độ Sandbox**: Bật/tắt môi trường test
  - ✅ **Bật**: API key sẽ có format `pk_test_...`
  - ❌ **Tắt**: API key sẽ có format `pk_live_...`

> **💡 Lưu Ý**: 
> - Sandbox mode phù hợp cho giai đoạn phát triển và test
> - Production mode chỉ nên sử dụng khi đã test kỹ

---

#### **Bước 2: Phân Quyền (Scopes)**

##### Mẫu Phân Quyền Có Sẵn

Click vào mẫu để tự động chọn các quyền phù hợp:

1. **Basic** (Cơ Bản)
   - `order:read`
   - `payment:read`
   - `analytics:read`
   - ✅ Phù hợp: Đối tác chỉ xem dữ liệu

2. **POS Integration** (Tích Hợp POS)
   - `order:read`, `order:write`
   - `payment:read`, `payment:write`
   - `pos:sync`, `pos:read`
   - ✅ Phù hợp: KiotViet, MISA, Sapo

3. **Payment Gateway** (Cổng Thanh Toán)
   - `order:read`
   - `payment:read`, `payment:write`
   - `webhook:subscribe`
   - ✅ Phù hợp: Casso, PayOS, SePay


4. **HR Platform** (Nền Tảng HR)
   - `hr:sync`, `hr:read`
   - `order:read`
   - `analytics:read`
   - ✅ Phù hợp: Hệ thống chấm công, lương

5. **Invoice Provider** (Nhà Cung Cấp Hóa Đơn)
   - `invoice:read`, `invoice:create`, `invoice:cancel`
   - `order:read`, `payment:read`
   - ✅ Phù hợp: VNPT, Viettel Invoice

6. **Admin (Full Access)** ⚠️
   - Tất cả quyền với wildcard `*`
   - ⚠️ **Cảnh báo**: Chỉ dùng cho đối tác tin cậy tuyệt đối

##### Chọn Quyền Thủ Công

Nếu không dùng mẫu, có thể chọn từng quyền cụ thể:

**Nhóm Orders (Đơn Hàng)**
- ☑️ `order:read` - Xem đơn hàng
- ☑️ `order:write` - Tạo đơn hàng
- ☑️ `order:complete` - Hoàn tất đơn hàng
- ☑️ `order:cancel` - Hủy đơn hàng
- ☑️ `order:*` - Toàn quyền đơn hàng

**Nhóm Payments (Thanh Toán)**
- ☑️ `payment:read` - Xem thanh toán
- ☑️ `payment:write` - Ghi nhận thanh toán
- ☑️ `payment:refund` - Hoàn tiền
- ☑️ `payment:*` - Toàn quyền thanh toán

**Nhóm Invoices (Hóa Đơn)**
- ☑️ `invoice:read` - Xem hóa đơn
- ☑️ `invoice:create` - Tạo hóa đơn
- ☑️ `invoice:cancel` - Hủy hóa đơn
- ☑️ `invoice:*` - Toàn quyền hóa đơn

**Nhóm POS**
- ☑️ `pos:sync` - Đồng bộ dữ liệu POS
- ☑️ `pos:read` - Xem dữ liệu POS
- ☑️ `pos:*` - Toàn quyền POS

**Nhóm HR**
- ☑️ `hr:sync` - Đồng bộ dữ liệu HR
- ☑️ `hr:read` - Xem dữ liệu HR
- ☑️ `hr:*` - Toàn quyền HR

**Nhóm Analytics**
- ☑️ `analytics:read` - Xem dữ liệu phân tích
- ☑️ `analytics:*` - Toàn quyền analytics

**Nhóm Webhooks**
- ☑️ `webhook:subscribe` - Đăng ký webhook
- ☑️ `webhook:read` - Xem webhook subscriptions
- ☑️ `webhook:*` - Toàn quyền webhooks

> **⚠️ Lưu Ý Quan Trọng**: 
> - Phải chọn **ít nhất 1 scope**
> - Nên áp dụng nguyên tắc **Least Privilege** (quyền tối thiểu cần thiết)
> - Wildcard `*` nên hạn chế sử dụng


---

#### **Bước 3: Cấu Hình Webhooks (Tùy Chọn)**

Webhook cho phép đối tác nhận thông báo real-time khi có sự kiện xảy ra.

##### Các Trường Webhook

1. **Webhook URL** (Tùy chọn)
   - URL endpoint HTTPS của đối tác
   - Format: `https://partner.example.com/webhooks/bella`
   - ⚠️ Chỉ chấp nhận HTTPS (không dùng HTTP)

2. **Webhook Secret** (Tùy chọn nhưng khuyến nghị)
   - Secret key để verify webhook signature
   - Format: `whsec_...` (tùy theo chuẩn của đối tác)
   - 🔒 Bảo mật: Giúp xác thực webhook requests

3. **Các Sự Kiện** (Chọn nhiều)
   - ☑️ `order.created` - Đơn hàng mới được tạo
   - ☑️ `order.updated` - Đơn hàng được cập nhật
   - ☑️ `order.completed` - Đơn hàng hoàn tất
   - ☑️ `order.cancelled` - Đơn hàng bị hủy
   - ☑️ `payment.received` - Thanh toán được ghi nhận
   - ☑️ `payment.refunded` - Thanh toán được hoàn
   - ☑️ `invoice.created` - Hóa đơn được tạo
   - ☑️ `invoice.cancelled` - Hóa đơn bị hủy

> **💡 Mẹo**: 
> - Có thể bỏ qua bước này và cấu hình webhook sau
> - Webhook giúp giảm polling và nhận dữ liệu real-time
> - Nên test webhook trên sandbox trước khi chuyển production

##### Ví Dụ Cấu Hình Webhook

```json
{
  "webhook_url": "https://kiotviet.vn/api/webhooks/bella-spa",
  "webhook_secret": "whsec_kv_2024_abc123xyz",
  "webhook_events": [
    "order.created",
    "order.completed",
    "payment.received"
  ]
}
```

---

#### **Bước 4: Xem Lại & Xác Nhận**

Kiểm tra lại toàn bộ thông tin trước khi tạo:

##### Thông Tin Cơ Bản
- Tên đối tác
- Loại đối tác
- Email & SĐT liên hệ
- Môi trường (Sandbox/Production)

##### Phân Quyền
- Danh sách scopes đã chọn
- Tổng số scopes

##### Webhooks
- URL endpoint
- Secret (ẩn, hiển thị •••••)
- Các sự kiện đã đăng ký

##### Rate Limiting
- Tier mặc định: **Basic**
  - 100 requests/phút
  - 5,000 requests/ngày

> **Lưu Ý**: 
> - Sau khi tạo, API key sẽ được tự động sinh
> - API key chỉ hiển thị **1 lần duy nhất**, hãy lưu lại ngay
> - Có thể tái tạo API key sau nếu cần

##### Nút Hành Động
- **Back**: Quay lại bước trước để sửa
- **Create Partner**: Hoàn tất tạo đối tác

---


## Chỉnh Sửa Đối Tác

### Đường Dẫn
```
/dashboard/admin/partners/[id]/edit
```

### Quy Trình

Tương tự quy trình tạo mới (4 bước), nhưng:

#### Điểm Khác Biệt

1. **Form được điền sẵn** với dữ liệu hiện có
2. **API Key không thể sửa** (chỉ có thể tái tạo)
3. **Tenant ID không đổi** (bảo mật)
4. **Sandbox mode không thể đổi** sau khi tạo

#### Các Trường Có Thể Sửa

✅ **Được phép sửa:**
- Tên đối tác
- Mô tả
- Email & SĐT liên hệ
- Phân quyền (scopes)
- Webhook URL, secret, events
- Rate limit tier
- Ghi chú nội bộ

❌ **Không được sửa:**
- Tenant ID (cố định)
- API Key (phải dùng tính năng "Regenerate")
- Sandbox mode (cố định khi tạo)
- ID đối tác
- Ngày tạo

### Cách Truy Cập

1. **Từ Danh Sách**: Click icon Edit hoặc menu → "Edit Partner"
2. **Từ Chi Tiết**: Click nút "Edit" trên trang chi tiết
3. **Trực tiếp URL**: `/dashboard/admin/partners/{partner_id}/edit`

---

## Xem Chi Tiết Đối Tác

### Đường Dẫn
```
/dashboard/admin/partners/[id]
```

### Tổng Quan

Trang chi tiết đối tác cung cấp giao diện tập trung với **5 tabs** để quản lý toàn diện thông tin, quyền hạn, logs, webhooks và thống kê sử dụng API của đối tác.

### Cách Truy Cập

1. **Từ Danh Sách**: Click vào dòng đối tác hoặc nút "View Details"
2. **Từ Edit**: Click "Cancel" hoặc quay lại từ trang edit
3. **Trực tiếp URL**: `/dashboard/admin/partners/{partner_id}`

### Header Trang

- **Partner Name** (lớn, prominent)
- **Partner Type** badge (màu sắc tương ứng)
- **Status Badge**: 
  - 🟢 Active (màu xanh)
  - 🔴 Inactive (màu đỏ)
- **Environment Badge**:
  - 🧪 Sandbox (màu vàng)
  - 🚀 Production (màu xanh đậm)
- **Nút Edit**: Chuyển sang trang edit
- **Nút Delete**: Xóa đối tác (xác nhận trước)

---

### Tab 1: Tổng Quan (Overview)

Tab mặc định khi mở trang chi tiết, hiển thị thông tin quan trọng nhất.

#### 1️⃣ **Card Thông Tin Cơ Bản**

- **Partner Name**: Tên đầy đủ
- **Partner Type**: Loại đối tác (POS, Payment, v.v.)
- **Email**: Email liên hệ chính
- **Số Điện Thoại**: SĐT liên hệ
- **Mô Tả**: Mô tả ngắn về đối tác
- **Ngày Tạo**: Thời gian tạo đối tác
- **Cập Nhật Lần Cuối**: Lần chỉnh sửa gần nhất

#### 2️⃣ **Card Quản Lý API Key**

🔑 **Tính năng đặc biệt**:

- **Show/Hide API Key**: 
  - Mặc định: `••••••••••••••••••••`
  - Khi hiện: `pk_live_abc123def456...`
  
- **Copy to Clipboard**: 
  - Click icon 📋
  - Toast notification: "API key copied!"
  
- **Regenerate Key**:
  - Nút "Regenerate"
  - Dialog xác nhận:
    ```
    ⚠️ Regenerate API Key?
    
    API key hiện tại sẽ ngừng hoạt động ngay lập tức.
    Đối tác cần cập nhật key mới trong hệ thống.
    
    Bạn có chắc chắn muốn tiếp tục?
    
    [Cancel]  [Confirm Regenerate]
    ```
  - Sau khi regenerate: Hiển thị key mới trong dialog với nút Copy

- **Rate Limit Tier**: 
  - Badge hiển thị: Basic / Standard / Premium / Enterprise
  - Tooltip hiển thị limits cụ thể

#### 3️⃣ **Card Thông Tin Liên Hệ**

- Email
- Số điện thoại
- Link tới website (nếu có)
- Người liên hệ chính (nếu có)

#### 4️⃣ **Card Thống Kê Nhanh (Quick Stats)**

4 KPIs nhanh:

| Metric | Mô Tả |
|--------|-------|
| **Total Requests** | Tổng số API calls (30 ngày gần nhất) |
| **Error Rate** | % requests lỗi (màu đỏ nếu >5%) |
| **Success Rate** | % requests thành công (màu xanh) |
| **Last Request** | Thời gian request gần nhất (relative time) |

#### 5️⃣ **Card Ghi Chú & Metadata**

- **Internal Notes**: Ghi chú nội bộ (chỉ admin thấy)
- **Created By**: Admin tạo partner
- **Last Modified By**: Admin chỉnh sửa lần cuối
- **Metadata**: JSON display (nếu có custom metadata)

---

### Tab 2: Phân Quyền (Scopes)

Visual scope manager với khả năng toggle realtime.

#### Hiển Thị Scopes

**Grouped by 7 Categories**:

1. **📦 Orders (Đơn Hàng)**
   - ☑️ `order:read`
   - ☑️ `order:write`
   - ☑️ `order:complete`
   - ☑️ `order:cancel`
   - ⚠️ `order:*` (wildcard - có cảnh báo)

2. **💳 Payments (Thanh Toán)**
   - ☑️ `payment:read`
   - ☑️ `payment:write`
   - ☑️ `payment:refund`
   - ⚠️ `payment:*`

3. **🧾 Invoices (Hóa Đơn)**
   - ☑️ `invoice:read`
   - ☑️ `invoice:create`
   - ☑️ `invoice:cancel`
   - ⚠️ `invoice:*`

4. **🖥️ POS**
   - ☑️ `pos:sync`
   - ☑️ `pos:read`
   - ⚠️ `pos:*`

5. **👥 HR**
   - ☑️ `hr:sync`
   - ☑️ `hr:read`
   - ⚠️ `hr:*`

6. **📊 Analytics**
   - ☑️ `analytics:read`
   - ⚠️ `analytics:*`

7. **🔔 Webhooks**
   - ☑️ `webhook:subscribe`
   - ☑️ `webhook:read`
   - ⚠️ `webhook:*`

#### Scope Presets

6 presets nhanh (tương tự form tạo):

| Preset | Scopes |
|--------|--------|
| **Basic** | `order:read`, `payment:read`, `analytics:read` |
| **POS Integration** | Orders + Payments + POS sync |
| **Payment Gateway** | Orders read + Payments full + Webhooks |
| **HR Platform** | HR sync + Orders read + Analytics |
| **Invoice Provider** | Invoices full + Orders read + Payments read |
| **Admin (Full Access)** | All wildcards `*` ⚠️ |

#### Tính Năng

✅ **Toggle Scopes Realtime**:
- Click checkbox để bật/tắt scope
- Màu xanh: Enabled
- Màu xám: Disabled

⚠️ **Cảnh Báo Wildcard**:
```
⚠️ Wildcard Scopes Detected

Các scopes sau cấp quyền toàn diện:
- order:* (toàn quyền đơn hàng)
- payment:* (toàn quyền thanh toán)

Đảm bảo đối tác đáng tin cậy!
```

✅ **Save Changes**:
- Nút "Save Changes" (chỉ active khi có thay đổi)
- Validation: Phải có ít nhất 1 scope
- Toast: "Scopes updated successfully"

✅ **Reset Changes**:
- Nút "Reset" (quay về trạng thái ban đầu)

---

### Tab 3: Nhật Ký (Logs)

Xem lịch sử các API requests của đối tác.

#### Bảng Logs

**Columns**:

| Column | Mô Tả |
|--------|-------|
| **Time** | Thời gian request (relative: "2 phút trước") |
| **Method** | HTTP method với màu sắc (GET=blue, POST=green, PUT=yellow, DELETE=red) |
| **Endpoint** | Path của API (vd: `/v1/orders`) |
| **Status** | HTTP status code với badge màu (200=green, 4xx=yellow, 5xx=red) |
| **Response Time** | Thời gian xử lý (ms) |
| **Actions** | Nút "View Details" |

#### Filters

1. **Method Filter**:
   - Dropdown: All / GET / POST / PUT / DELETE / PATCH

2. **Status Filter**:
   - Dropdown: All / Success (2xx) / Client Error (4xx) / Server Error (5xx)

3. **Search Endpoint**:
   - Input field: Tìm theo path
   - Placeholder: "Search endpoint path..."
   - Real-time search

4. **Date Range** (tùy chọn):
   - Last 24 hours / Last 7 days / Last 30 days / Custom range

#### Pagination

- Hiển thị **20 logs/page**
- Nút Previous/Next
- Hiển thị: "Showing 1-20 of 245 requests"

#### View Details Dialog

Click "View Details" để xem thông tin đầy đủ:

**Request Tab**:
```json
{
  "method": "POST",
  "endpoint": "/v1/orders",
  "headers": {
    "Authorization": "Bearer pk_live_...",
    "Content-Type": "application/json",
    "User-Agent": "KiotViet/1.0"
  },
  "body": {
    "customer_id": "cus_123",
    "items": [...]
  }
}
```

**Response Tab**:
```json
{
  "status": 201,
  "headers": {
    "Content-Type": "application/json",
    "X-Request-ID": "req_abc123"
  },
  "body": {
    "success": true,
    "data": {
      "order_id": "ord_456",
      ...
    }
  },
  "response_time_ms": 234
}
```

**Error Tab** (nếu có lỗi):
```json
{
  "error": {
    "code": "VAL_001",
    "message": "Invalid request body",
    "details": {
      "field": "items",
      "reason": "Array is required"
    }
  },
  "stack_trace": "..." // (chỉ hiện trên sandbox)
}
```

#### Export Logs

Nút **"Export CSV"**:
- Export toàn bộ logs (respect filters)
- Format: `partner_[name]_logs_[date].csv`
- Columns: Time, Method, Endpoint, Status, Response Time, IP Address

---

### Tab 4: Webhooks

Quản lý webhook subscriptions của đối tác.

#### Hiển Thị Cấu Hình Hiện Tại

**Card Current Configuration**:

```
🔔 Webhook Configuration

URL: https://partner.example.com/webhooks/bella
Secret: whsec_••••••••••••••• [Show] [Copy]
Status: 🟢 Active

Subscribed Events (5):
✅ order.created
✅ order.completed
✅ payment.received
✅ payment.refunded
✅ invoice.created
```

#### Form Cấu Hình Webhook

**1. Webhook URL**:
- Input field (type URL)
- Placeholder: `https://partner.example.com/webhooks`
- Validation: 
  - ✅ Phải bắt đầu với `https://`
  - ❌ Không chấp nhận `http://`
  - Error message: "Webhook URL must use HTTPS"

**2. Webhook Secret**:
- Input field (type password)
- Show/Hide toggle
- Placeholder: `whsec_...`
- Optional nhưng khuyến nghị
- Tooltip: "Secret key để verify webhook signature"

**3. Select Events**:

Checkbox list cho **8 events**:

| Event | Mô Tả |
|-------|-------|
| ☑️ `order.created` | Đơn hàng mới được tạo |
| ☑️ `order.updated` | Đơn hàng được cập nhật |
| ☑️ `order.completed` | Đơn hàng hoàn tất |
| ☑️ `order.cancelled` | Đơn hàng bị hủy |
| ☑️ `payment.received` | Thanh toán được ghi nhận |
| ☑️ `payment.refunded` | Thanh toán được hoàn |
| ☑️ `invoice.created` | Hóa đơn được tạo |
| ☑️ `invoice.cancelled` | Hóa đơn bị hủy |

#### Test Webhook

**Nút "Test Webhook"**:
- Gửi test payload tới webhook URL
- Loading state khi đang test
- Kết quả hiển thị:

✅ **Success**:
```
✅ Webhook Test Successful

URL: https://partner.example.com/webhooks/bella
Status: 200 OK
Response Time: 145ms
Response Body: {"received": true}
```

❌ **Failure**:
```
❌ Webhook Test Failed

URL: https://partner.example.com/webhooks/bella
Error: Connection timeout
Status: Request timeout after 5000ms

Suggestions:
- Verify URL is correct and accessible
- Check firewall rules
- Ensure endpoint returns 200 OK
```

#### Example Payload

Card hiển thị **example webhook payload** để đối tác biết cấu trúc:

```json
{
  "event": "order.created",
  "timestamp": "2026-06-18T10:30:00Z",
  "data": {
    "order_id": "ord_abc123",
    "tenant_id": "ten_xyz789",
    "customer": {
      "id": "cus_456",
      "name": "Nguyễn Văn A",
      "phone": "0901234567"
    },
    "items": [
      {
        "product_id": "prod_111",
        "name": "Massage 90 phút",
        "quantity": 1,
        "price": 500000
      }
    ],
    "total_amount": 500000,
    "payment_status": "pending",
    "created_at": "2026-06-18T10:30:00Z"
  },
  "signature": "sha256=abc123..." // Verify using webhook_secret
}
```

#### Save/Reset

- **Nút "Save Webhook Config"**: Lưu cấu hình mới
- **Nút "Reset"**: Quay về cấu hình ban đầu
- Validation: URL phải HTTPS
- Toast: "Webhook configuration updated"

---

### Tab 5: Thống Kê (Usage)

Dashboard thống kê sử dụng API của đối tác.

#### 1️⃣ **KPI Cards (4 Cards)**

| KPI | Mô Tả | Icon |
|-----|-------|------|
| **Total Requests** | Tổng số requests (time range) | 📊 |
| **Error Rate** | % requests lỗi (màu đỏ nếu >5%) | ⚠️ |
| **Avg Response Time** | Thời gian phản hồi trung bình (ms) | ⏱️ |
| **P95 Response Time** | Percentile 95 response time | 📈 |

Ví dụ:
```
📊 Total Requests          ⚠️ Error Rate
    12,456                    2.3%
    ↑ 15% vs last period     ↓ 0.5% (improvement)
```

#### 2️⃣ **Requests Chart (Bar Chart)**

- **X-axis**: Ngày (7 ngày gần nhất hoặc 30 ngày)
- **Y-axis**: Số lượng requests
- **Bars**: 
  - 🟢 Success (2xx)
  - 🟡 Client Errors (4xx)
  - 🔴 Server Errors (5xx)
- **Hover**: Hiển thị chi tiết từng ngày

#### 3️⃣ **Top 10 Endpoints Table**

Bảng hiển thị 10 endpoints được gọi nhiều nhất:

| Endpoint | Method | Total Calls | Avg Time (ms) | Error Rate |
|----------|--------|-------------|---------------|------------|
| `/v1/orders` | POST | 3,456 | 234ms | 1.2% |
| `/v1/payments` | POST | 2,890 | 189ms | 0.5% |
| `/v1/orders/{id}` | GET | 2,456 | 45ms | 0.1% |
| ... | ... | ... | ... | ... |

#### 4️⃣ **Rate Limit Status**

Hiển thị tình trạng rate limit hiện tại:

```
⏱️ Rate Limit Status

Tier: Basic (100 req/min, 5,000 req/day)

Current Usage:
├─ Per Minute: ████████░░ 78/100 (78%)
└─ Per Day: ████░░░░░░ 2,340/5,000 (47%)

Status: 🟢 Healthy
```

Màu sắc:
- 🟢 <70%: Healthy
- 🟡 70-90%: Warning
- 🔴 >90%: Critical

#### 5️⃣ **Health Status**

Đánh giá sức khỏe API integration:

```
🏥 Integration Health

Overall: 🟢 Excellent

Metrics:
✅ Uptime: 99.8%
✅ Error Rate: 2.3% (Good)
✅ Avg Response Time: 178ms (Fast)
⚠️ P95 Response Time: 456ms (Acceptable)
```

Rating:
- 🟢 **Excellent**: Error rate <3%, response time <200ms
- 🟡 **Good**: Error rate <5%, response time <500ms
- 🟠 **Fair**: Error rate <10%, response time <1000ms
- 🔴 **Poor**: Error rate ≥10% hoặc response time ≥1000ms

#### Time Range Filter

Dropdown để chọn khoảng thời gian:
- Last 24 hours
- Last 7 days (default)
- Last 30 days
- Custom date range

#### API Endpoint

```typescript
GET /api/admin/partners/[id]/usage?timeRange=7d
```

Response:
```json
{
  "success": true,
  "data": {
    "kpis": {
      "total_requests": 12456,
      "error_rate": 2.3,
      "avg_response_time": 178,
      "p95_response_time": 456
    },
    "chart_data": [
      {
        "date": "2026-06-18",
        "success": 1890,
        "client_error": 45,
        "server_error": 12
      },
      ...
    ],
    "top_endpoints": [
      {
        "endpoint": "/v1/orders",
        "method": "POST",
        "total_calls": 3456,
        "avg_time": 234,
        "error_rate": 1.2
      },
      ...
    ],
    "rate_limit_status": {
      "tier": "basic",
      "per_minute": { "used": 78, "limit": 100 },
      "per_day": { "used": 2340, "limit": 5000 }
    },
    "health": {
      "overall": "excellent",
      "uptime": 99.8,
      "metrics": {...}
    }
  }
}
```

---

### Điều Hướng Giữa Các Tabs

- **URL Update**: Mỗi tab có URL riêng:
  - `/dashboard/admin/partners/[id]` - Overview (default)
  - `/dashboard/admin/partners/[id]?tab=scopes`
  - `/dashboard/admin/partners/[id]?tab=logs`
  - `/dashboard/admin/partners/[id]?tab=webhooks`
  - `/dashboard/admin/partners/[id]?tab=usage`

- **Browser Back/Forward**: Hoạt động bình thường với history

- **Deep Links**: Có thể share link trực tiếp tới tab cụ thể

---

## Quản Lý API Key

### Xem API Key

#### Tại Danh Sách
- API key hiển thị dạng **masked**: `pk_live_abc1...xyz9`
- Click icon **Copy** để sao chép full key

#### Tại Chi Tiết
- Hiển thị đầy đủ (với nút Show/Hide)
- Nút Copy clipboard
- Cảnh báo bảo mật

### Tái Tạo API Key

⚠️ **CẢNH BÁO QUAN TRỌNG**: 
- API key cũ sẽ **ngừng hoạt động ngay lập tức**
- Đối tác cần cập nhật key mới trong hệ thống của họ
- Tất cả API requests dùng key cũ sẽ bị từ chối (401 Unauthorized)

#### Quy Trình Tái Tạo

1. **Từ Danh Sách hoặc Chi Tiết**: 
   - Menu → "Regenerate Key"
   
2. **Xác nhận**:
   ```
   Bạn có chắc muốn tái tạo API key cho [Tên Đối Tác]?
   
   ⚠️ API key hiện tại sẽ ngừng hoạt động ngay lập tức.
   ```
   
3. **Nhận Key Mới**:
   - Hiển thị API key mới
   - ✅ Copy và gửi cho đối tác ngay
   - ⚠️ Key chỉ hiển thị 1 lần



#### Best Practices

✅ **Nên:**
- Thông báo đối tác trước khi tái tạo key
- Có kế hoạch rollover (tạm thời support 2 keys)
- Test key mới trên sandbox trước
- Lưu log lịch sử tái tạo key

❌ **Không nên:**
- Tái tạo key trong giờ cao điểm
- Tái tạo mà không thông báo đối tác
- Chia sẻ API key qua email không mã hóa

---

## Xóa Đối Tác

### Cơ Chế Xóa Mềm (Soft Delete)

Bella ERP sử dụng **xóa mềm** để đảm bảo:
- ✅ Dữ liệu lịch sử được giữ lại
- ✅ Có thể khôi phục nếu cần
- ✅ Audit trail đầy đủ

#### Khi Xóa Đối Tác

1. **Trạng thái** chuyển sang `is_active = false`
2. **API key** ngừng hoạt động ngay lập tức
3. **Dữ liệu** được giữ nguyên trong database
4. **Logs** và usage history vẫn xem được

### Quy Trình Xóa

1. **Chọn Xóa**:
   - Menu → "Delete Partner"
   
2. **Xác nhận**:
   ```
   Bạn có chắc muốn xóa [Tên Đối Tác]?
   
   Hành động này sẽ:
   - Thu hồi quyền truy cập API ngay lập tức
   - Dữ liệu sẽ được lưu trữ (có thể khôi phục)
   
   Thao tác này không thể hoàn tác.
   ```
   
3. **Kết quả**:
   - Đối tác biến mất khỏi danh sách active
   - API key không còn valid
   - Toast notification: "Đã xóa [Tên Đối Tác]"

### Khôi Phục Đối Tác

Hiện tại chưa có UI khôi phục. Liên hệ technical team để:
- Xem danh sách đối tác đã xóa
- Khôi phục bằng cách set `is_active = true`
- Tái tạo API key mới

---

## Bảo Mật & Quyền Truy Cập

### Phân Quyền Người Dùng

| Vai Trò | Quyền Truy Cập |
|---------|---------------|
| **Owner** | ✅ Toàn quyền: Tạo, sửa, xóa, xem tất cả |
| **Admin** | ✅ Toàn quyền: Tạo, sửa, xóa, xem tất cả |
| **Manager** | ❌ Không truy cập được |
| **Staff** | ❌ Không truy cập được |
| **KTV** | ❌ Không truy cập được |

### Cách Ly Dữ Liệu (Tenant Isolation)

#### Bảo Mật Multi-Tenant

1. **Backend Validation**:
   ```typescript
   // Mọi API route đều check tenant ownership
   const partner = await getPartnerById(id, user.tenant_id);
   ```

2. **Không thể truy cập**:
   - ❌ Đối tác của tenant khác
   - ❌ API keys của tenant khác
   - ❌ Logs của tenant khác

3. **Database RLS**:
   - Row Level Security policies
   - Filter tự động theo `tenant_id`



### Best Practices Bảo Mật

#### Cho Admin

✅ **Nên làm:**
1. **API Key Management**:
   - Không chia sẻ API key qua email/chat không mã hóa
   - Yêu cầu đối tác lưu key an toàn (vault, secrets manager)
   - Tái tạo key định kỳ (3-6 tháng)
   - Rotate key ngay nếu nghi ngờ bị lộ

2. **Scope Management**:
   - Áp dụng nguyên tắc **Least Privilege**
   - Chỉ cấp quyền tối thiểu cần thiết
   - Review scopes định kỳ (mỗi quý)
   - Hạn chế wildcard `*` scopes

3. **Webhook Security**:
   - Bắt buộc HTTPS cho webhook URLs
   - Yêu cầu đối tác implement signature verification
   - Kiểm tra webhook endpoint trước khi bật

4. **Monitoring**:
   - Theo dõi usage patterns bất thường
   - Alert khi có spike requests
   - Review logs định kỳ
   - Monitor failed authentication attempts

❌ **Không nên:**
- Tạo đối tác với full admin access mặc định
- Chia sẻ credentials qua kênh không an toàn
- Bỏ qua việc review logs và usage
- Cấp quyền production ngay từ đầu (nên test sandbox trước)

#### Cho Đối Tác

Khi gửi thông tin cho đối tác, nhớ nhắc:

📧 **Email Template**:
```
Kính gửi [Đối Tác],

API credentials của bạn đã được tạo:

🔑 API Key: [hiển thị 1 lần]
📋 Partner ID: [partner_id]
🌍 Environment: [Sandbox/Production]

⚠️ BẢO MẬT:
- API key chỉ hiển thị 1 lần, vui lòng lưu ngay
- Không chia sẻ key với bên thứ 3
- Lưu trữ an toàn (secrets manager, vault)
- Liên hệ ngay nếu key bị lộ

📖 Tài liệu API: https://docs.bella.vn/api
🧪 Sandbox Endpoint: https://sandbox-api.bella.vn/v1
🚀 Production Endpoint: https://api.bella.vn/v1

Trân trọng,
[Tên Admin]
```

---

## API Endpoints Sử Dụng Trong UI

### Danh Sách APIs

| Method | Endpoint | Mô Tả |
|--------|----------|-------|
| GET | `/api/admin/partners` | Danh sách đối tác (với filters) |
| POST | `/api/admin/partners` | Tạo đối tác mới |
| GET | `/api/admin/partners/[id]` | Chi tiết 1 đối tác |
| PUT | `/api/admin/partners/[id]` | Cập nhật đối tác |
| DELETE | `/api/admin/partners/[id]` | Xóa đối tác (soft) |
| POST | `/api/admin/partners/[id]/regenerate-key` | Tái tạo API key |

### Query Parameters (GET List)

```typescript
interface ListPartnersParams {
  // Filters
  type?: 'pos' | 'payment' | 'invoice' | 'franchise' | 'hr' | 'analytics' | 'mobile_app' | 'other';
  is_active?: 'true' | 'false';
  is_sandbox?: 'true' | 'false';
  search?: string;  // Tìm theo tên
  
  // Pagination
  limit?: number;   // Default: 20
  offset?: number;  // Default: 0
}
```

### Response Format

```typescript
// Success Response
{
  "success": true,
  "data": APIPartner | APIPartner[],
  "pagination": {
    "total": 45,
    "limit": 20,
    "offset": 0,
    "has_more": true
  }
}

// Error Response
{
  "success": false,
  "error": {
    "message": "Partner not found",
    "code": "VAL_001",
    "details": { ... }
  }
}
```

---


## Troubleshooting

### Lỗi Thường Gặp

#### 1. **"Unauthorized" khi truy cập /admin/partners**

**Nguyên nhân**: 
- User không có role admin/owner
- Session hết hạn

**Giải pháp**:
```bash
# Kiểm tra role trong database
SELECT id, email, role FROM users WHERE email = 'admin@example.com';

# Cấp quyền admin
UPDATE users SET role = 'admin' WHERE email = 'admin@example.com';
```

---

#### 2. **"At least one scope is required"**

**Nguyên nhân**: Không chọn scope nào ở Bước 2

**Giải pháp**: 
- Chọn ít nhất 1 scope thủ công
- Hoặc dùng preset (Basic, POS Integration, v.v.)

---

#### 3. **"Partner not found" khi edit**

**Nguyên nhân**:
- Partner đã bị xóa
- Không có quyền truy cập (khác tenant)
- URL sai

**Giải pháp**:
```bash
# Kiểm tra partner tồn tại
SELECT id, partner_name, is_active, tenant_id 
FROM api_partners 
WHERE id = '[partner_id]';

# Kiểm tra tenant match
SELECT tenant_id FROM users WHERE id = '[user_id]';
```

---

#### 4. **Webhook không hoạt động**

**Nguyên nhân**:
- URL không phải HTTPS
- Endpoint không response 200 OK
- Firewall block requests từ Bella

**Giải pháp**:
1. Test webhook endpoint thủ công:
```bash
curl -X POST https://partner.example.com/webhooks/bella \
  -H "Content-Type: application/json" \
  -d '{"event": "order.created", "data": {...}}'
```

2. Kiểm tra logs tại `/admin/partners/[id]` tab "Logs"
3. Verify webhook signature implementation

---

#### 5. **API key không hoạt động sau khi tạo**

**Nguyên nhân**:
- Copy sai key (thiếu ký tự)
- Dùng test key cho production endpoint
- Partner đã bị disable (`is_active = false`)

**Giải pháp**:
```bash
# Test API key
curl -X GET https://api.bella.vn/v1/orders \
  -H "Authorization: Bearer pk_live_..." \
  -H "Content-Type: application/json"

# Kiểm tra partner status
SELECT is_active, api_key FROM api_partners WHERE id = '[id]';
```

---

## Changelog

### Version 1.1 - 18/06/2026

**✅ Hoàn thành Phần 3/4 - Partner Detail Page**

#### Tính năng mới:
- ✅ Trang chi tiết đối tác với 5 tabs
- ✅ **Tab Overview**: 5 cards (thông tin cơ bản, API key manager, liên hệ, quick stats, notes)
- ✅ **Tab Scopes**: Visual scope manager với 7 categories, 6 presets, toggle realtime
- ✅ **Tab Logs**: Request logs với filters, pagination, view details, export CSV
- ✅ **Tab Webhooks**: Form config webhook, test webhook, example payload
- ✅ **Tab Usage**: Dashboard với KPIs, charts, top endpoints, rate limit status, health assessment

#### Components mới:
- `PartnerOverviewTab.tsx` - Tab tổng quan
- `PartnerScopesTab.tsx` - Tab phân quyền
- `PartnerLogsTab.tsx` - Tab nhật ký
- `PartnerWebhooksTab.tsx` - Tab webhooks
- `PartnerUsageTab.tsx` - Tab thống kê
- `src/app/(dashboard)/admin/partners/[id]/page.tsx` - Main detail page

#### API Routes mới:
- `GET /api/admin/partners/logs` - Lấy request logs (với filters)
- `GET /api/admin/partners/[id]/usage` - Lấy thống kê sử dụng
- `POST /api/admin/partners/[id]/test-webhook` - Test webhook endpoint

#### Cải tiến:
- ✅ Deep linking cho từng tab (URL với query params)
- ✅ Real-time scope management
- ✅ Dialog xác nhận regenerate key với hiển thị key mới
- ✅ Webhook testing với kết quả real-time
- ✅ Rate limit progress bars với color-coding
- ✅ Health status assessment dựa trên metrics

---

### Version 1.0 - 18/06/2026

**✅ Hoàn thành Phần 2/4 - Partner Management Forms**

#### Tính năng:
- ✅ Form wizard 4 bước tạo đối tác
- ✅ Danh sách đối tác với tìm kiếm & filters
- ✅ Chỉnh sửa đối tác
- ✅ Quản lý API keys (copy, regenerate)
- ✅ Xóa mềm đối tác
- ✅ Export CSV
- ✅ Scope presets

#### Components:
- `PartnerFormWizard.tsx` - Main wizard
- `BasicInfoStep.tsx` - Bước 1
- `ScopesStep.tsx` - Bước 2
- `WebhooksStep.tsx` - Bước 3
- `ReviewStep.tsx` - Bước 4
- `PartnersList.tsx` - Danh sách
- `PartnersTable.tsx` - Bảng data

#### API Routes:
- `POST /api/admin/partners` - Create
- `GET /api/admin/partners` - List
- `GET /api/admin/partners/[id]` - Get one
- `PUT /api/admin/partners/[id]` - Update
- `DELETE /api/admin/partners/[id]` - Delete
- `POST /api/admin/partners/[id]/regenerate-key` - Regenerate

---

### Roadmap - Các Phần Tiếp Theo

#### Phần 4/4: Advanced Features (Dự kiến)
- [ ] Rate limit customization UI (nâng/hạ tier)
- [ ] Advanced analytics dashboard
- [ ] Webhook retry mechanism UI
- [ ] API key rotation scheduler
- [ ] Partner activity timeline
- [ ] Cost tracking per partner
- [ ] SLA monitoring & alerts

---

## Liên Hệ & Hỗ Trợ

### Technical Support

📧 **Email**: dev@bella.vn  
📱 **Hotline**: 1900-xxxx  
💬 **Slack**: #bella-api-support

### Tài Liệu Liên Quan

- [API Reference](./API_REFERENCE.md)
- [Getting Started](./GETTING_STARTED.md)
- [Security Best Practices](./SECURITY_BEST_PRACTICES.md)
- [Webhooks Guide](./WEBHOOKS.md)
- [Error Handling](./ERROR_HANDLING.md)

---

**Cập nhật lần cuối**: 18/06/2026  
**Phiên bản**: 1.1  
**Tác giả**: Bella ERP Development Team


---

## 🐛 Khắc Phục Lỗi Đã Gặp

### Lỗi #1: Trang Create Partner Bị Màn Đen (Black Screen) - 18/06/2026

**Triệu chứng:**
- Truy cập `/dashboard/admin/partners/new` trên production (Vercel) hiển thị màn hình đen hoàn toàn
- Console log hiển thị lỗi:
  ```
  Uncaught (in promise) TypeError: Failed to fetch
  Failed to load resource: the server responded with a status of 404
  GET https://bella-spa-erp.vercel.app/admin/partners/new 404 (Not Found)
  ```
- Local dev server (`npm run dev`) hoạt động bình thường
- Production build (`npm start`) cũng bị lỗi tương tự

**Nguyên nhân gốc rễ:**

1. **Routing path inconsistency** (Nguyên nhân chính):
   - Component `PartnersTable.tsx` có button "Create Partner" navigate tới `/admin/partners/new` (path cũ)
   - Route thực tế nằm ở `/dashboard/admin/partners/new` (đã được di chuyển)
   - Browser request URL sai → 404 Not Found

2. **Service Worker caching issue** (Nguyên nhân phụ):
   - Service Worker (`public/sw.js`) cố precache các file static
   - Một số file trong `PRECACHE_ASSETS` không tồn tại trên production
   - SW fetch event handler gây lỗi "Failed to fetch"

**Cách khắc phục:**

#### Bước 1: Fix routing paths trong components

Tìm và sửa tất cả references tới path cũ `/admin/partners`:

```bash
# Search toàn bộ codebase
grep -r "\/admin\/partners" src/components --include="*.tsx" --include="*.ts"
```

Sửa trong `src/components/admin/partners/PartnersTable.tsx`:

```typescript
// ❌ SAI (path cũ)
const handleView = (partner: APIPartner) => {
  router.push(`/admin/partners/${partner.id}`);
};

const handleEdit = (partner: APIPartner) => {
  router.push(`/admin/partners/${partner.id}/edit`);
};

<Button onClick={() => router.push('/admin/partners/new')}>
  Create Partner
</Button>

// ✅ ĐÚNG (path mới)
const handleView = (partner: APIPartner) => {
  router.push(`/dashboard/admin/partners/${partner.id}`);
};

const handleEdit = (partner: APIPartner) => {
  router.push(`/dashboard/admin/partners/${partner.id}/edit`);
};

<Button onClick={() => router.push('/dashboard/admin/partners/new')}>
  Create Partner
</Button>
```

**Files cần sửa:**
- `src/components/admin/partners/PartnersTable.tsx` (3 chỗ)
- `src/components/admin/partners/PartnerFormWizard.tsx` (2 chỗ - đã fix trước đó)
- `src/components/admin/partners/PartnersList.tsx` (1 chỗ - đã fix trước đó)

#### Bước 2: Vô hiệu hóa Service Worker caching tạm thời

Sửa `public/sw.js` để skip caching admin routes:

```javascript
// Skip admin routes - they require authentication
if (url.pathname.startsWith('/dashboard/admin')) {
  return;
}

// Skip API routes
if (url.pathname.startsWith('/api/')) {
  return;
}
```

Hoặc disable SW hoàn toàn nếu vẫn gặp vấn đề:

```javascript
// Install Event - Skip precaching
self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

// Activate Event - Clear all caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => Promise.all(cacheNames.map((cache) => caches.delete(cache))))
      .then(() => self.clients.claim())
  );
});

// Fetch Event - No caching
self.addEventListener('fetch', (event) => {
  return; // Let browser handle normally
});
```

#### Bước 3: Clear browser cache và Service Worker

Sau khi deploy lên production:

1. **Hard refresh:**
   - Windows: `Ctrl + Shift + R`
   - Mac: `Cmd + Shift + R`

2. **Clear Service Worker (Chrome/Edge):**
   - Mở DevTools (`F12`)
   - Tab "Application" → Sidebar "Service Workers"
   - Click "Unregister" cho tất cả SWs

3. **Clear Site Data:**
   - DevTools → Tab "Application"
   - Sidebar "Storage" → Click "Clear site data"

4. **Test trong Incognito/Private mode:**
   - `Ctrl + Shift + N` (Chrome/Edge)
   - Không có SW hoặc cache cũ

#### Bước 4: Verify fix

```bash
# Build production locally
npm run build
npm start

# Test URLs
- http://localhost:3000/dashboard/admin/partners (list page)
- Click "Create Partner" button
- Should navigate to: http://localhost:3000/dashboard/admin/partners/new ✅
```

**Commits liên quan:**
- `edabb64e` - Fix routing links after folder move
- `6da1dc15` - Fix service worker skip admin routes
- `797acef1` - Disable service worker caching completely
- `803c3faa` - Fix remaining old path references in PartnersTable

**Thời gian xử lý:** ~2 giờ

**Bài học:**

1. ✅ **Luôn kiểm tra toàn bộ codebase** khi di chuyển route folder:
   ```bash
   # Tìm tất cả hardcoded paths
   grep -r "'/admin/partners" src/ --include="*.tsx" --include="*.ts"
   grep -r "\`/admin/partners" src/ --include="*.tsx" --include="*.ts"
   ```

2. ✅ **Test cả local production build** trước khi deploy:
   ```bash
   npm run build
   npm start  # Not just npm run dev
   ```

3. ✅ **Service Worker cần skip authenticated routes**:
   - Admin routes
   - API routes
   - Any routes requiring session/auth

4. ✅ **Dùng search & replace an toàn** khi refactor paths:
   - Tìm: `/admin/partners`
   - Thay: `/dashboard/admin/partners`
   - Confirm từng match để tránh replace nhầm (như trong comments)

5. ✅ **Hard refresh không đủ** khi có Service Worker:
   - Cần unregister SW
   - Hoặc test trong Incognito mode
   - Hoặc clear site data hoàn toàn

**Cách phòng tránh:**

1. **Tạo constant cho routes:**
   ```typescript
   // src/lib/constants/routes.ts
   export const ROUTES = {
     ADMIN: {
       PARTNERS: {
         LIST: '/dashboard/admin/partners',
         NEW: '/dashboard/admin/partners/new',
         DETAIL: (id: string) => `/dashboard/admin/partners/${id}`,
         EDIT: (id: string) => `/dashboard/admin/partners/${id}/edit`,
       }
     }
   };
   
   // Usage
   router.push(ROUTES.ADMIN.PARTNERS.NEW);
   ```

2. **Dùng TypeScript helper cho navigation:**
   ```typescript
   // src/lib/navigation.ts
   export const navigateTo = {
     partnerList: () => '/dashboard/admin/partners',
     partnerCreate: () => '/dashboard/admin/partners/new',
     partnerDetail: (id: string) => `/dashboard/admin/partners/${id}`,
     partnerEdit: (id: string) => `/dashboard/admin/partners/${id}/edit`,
   };
   ```

3. **Viết test cho navigation links:**
   ```typescript
   describe('PartnersTable Navigation', () => {
     it('should navigate to correct create path', () => {
       const { getByText } = render(<PartnersTable />);
       const createBtn = getByText('Create Partner');
       fireEvent.click(createBtn);
       expect(mockRouter.push).toHaveBeenCalledWith('/dashboard/admin/partners/new');
     });
   });
   ```

4. **Add ESLint rule để cảnh báo hardcoded paths:**
   ```javascript
   // .eslintrc.js
   rules: {
     'no-restricted-syntax': [
       'error',
       {
         selector: 'Literal[value=/^\\/admin\\//]',
         message: 'Use ROUTES constant instead of hardcoded admin paths'
       }
     ]
   }
   ```

**Tài liệu tham khảo:**
- Next.js 15 Routing: https://nextjs.org/docs/app/building-your-application/routing
- Service Worker Best Practices: https://web.dev/service-worker-lifecycle/
- Smart File Move tool: Dùng `smart_relocate` thay vì manual move để auto-update imports

---
