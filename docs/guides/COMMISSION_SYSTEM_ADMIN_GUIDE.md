# Hướng Dẫn Quản Trị Hệ Thống Hoa Hồng

> **Đối tượng:** Quản trị viên Bella ERP (Admin)  
> **Phiên bản:** 1.0.0  
> **Cập nhật lần cuối:** 22/06/2026

---

## 1. Giới Thiệu & Tổng Quan

Hệ thống hoa hồng của Bella ERP giúp bạn tự động tính toán thu nhập cho nhân viên KTV dựa trên:

- **Hoa hồng dịch vụ (Service Commission):** Phần trăm hoặc số tiền cố định từ mỗi buổi dịch vụ mà KTV thực hiện
- **Hoa hồng bán hàng (Product Sales Commission):** Phần trăm hoặc số tiền cố định từ sản phẩm mà KTV bán được
- **Thưởng chức vụ (Position Bonus):** Hệ số nhân dựa trên chức danh (Junior, Senior, Lead, Expert)
- **Thưởng thâm niên (Seniority Bonus):** Thưởng thêm theo số năm làm việc
- **Điều chỉnh thủ công (Manual Adjustments):** Thưởng/phạt bổ sung do quản lý quyết định

### Luồng hoạt động chính

```
KTV thực hiện dịch vụ/bán hàng
         ↓
Hệ thống ghi nhận hoa hồng tự động
         ↓
Tích lũy theo tháng
         ↓
Admin duyệt + chốt lương cuối tháng
         ↓
KTV nhận được lương bao gồm hoa hồng
```

---

## 2. Cấu Hình Hoa Hồng Mặc Định

### 2.1. Hoa hồng dịch vụ (Service Commission)

Truy cập: **Dashboard → Cài đặt → Hoa hồng dịch vụ**

**Cấu hình cấp hệ thống (System Default):**
- Mặc định: **15%** giá trị dịch vụ
- Áp dụng cho tất cả dịch vụ nếu không có cấu hình riêng

**Cấu hình cấp cơ sở (Tenant Default):**
- Admin có thể tùy chỉnh theo nhu cầu cơ sở của mình
- Ví dụ: Spa A có thể đặt 20%, Spa B có thể đặt 12%

**Cấu hình cấp dịch vụ cụ thể (Per-Service Override):**
- Thiết lập riêng cho từng gói dịch vụ trong **Quản lý gói dịch vụ**
- Cột: `override_commission_type`, `override_commission_value`
- Ví dụ:
  - Gói "Chăm sóc Mẹ & Bé VIP": 25% hoặc 150,000 VND cố định
  - Gói "Massage cổ vai gáy": 50,000 VND cố định

**Độ ưu tiên:**
```
Cấu hình riêng dịch vụ > Cấu hình cơ sở > Cấu hình hệ thống
```


### 2.2. Hoa hồng bán hàng (Product Sales Commission)

Truy cập: **Dashboard → Kho → Sản phẩm → Cài đặt hoa hồng**

**Cấu hình hệ thống:**
- Mặc định: **5%** giá bán
- Áp dụng cho tất cả sản phẩm nếu không có cấu hình riêng

**Cấu hình riêng từng sản phẩm:**
- Admin có thể thiết lập hoa hồng riêng cho từng mặt hàng
- Ví dụ:
  - Dầu massage cao cấp: 10% hoặc 20,000 VND/chai
  - Combo sản phẩm khuyến mãi: 0% (không hưởng hoa hồng)

**Lưu ý:**
- Hoa hồng bán hàng chỉ được tính khi đơn hàng **đã thanh toán**
- Nếu hoàn trả (refund), hệ thống sẽ **tự động thu hồi hoa hồng** đã tính

---

### 2.3. Hệ số chức vụ (Position Multipliers)

Truy cập: **Dashboard → Nhân sự → Cấu hình chức vụ**

| Chức vụ | Hệ số nhân | Ví dụ (hoa hồng gốc 100k) |
|---------|-----------|---------------------------|
| Junior  | 1.0x      | 100,000 VND              |
| Senior  | 1.2x      | 120,000 VND              |
| Lead    | 1.5x      | 150,000 VND              |
| Expert  | 2.0x      | 200,000 VND              |

**Cách áp dụng:**
- Gán chức vụ cho KTV trong **Hồ sơ nhân viên**
- Hệ số tự động nhân lên tổng hoa hồng dịch vụ + bán hàng

---

### 2.4. Thưởng thâm niên (Seniority Bonus)

Truy cập: **Dashboard → Nhân sự → Cấu hình thâm niên**

| Số năm làm việc | Thưởng thêm |
|----------------|-------------|
| < 1 năm        | 0 VND       |
| 1-3 năm        | 500,000 VND/tháng |
| 3-5 năm        | 1,000,000 VND/tháng |
| > 5 năm        | 2,000,000 VND/tháng |

**Cách tính:**
- Hệ thống tự động tính dựa trên `hire_date` trong hồ sơ nhân viên
- Cộng vào lương cuối tháng

---

## 3. Quản Lý Hoa Hồng Dịch Vụ

### 3.1. Thêm dịch vụ vào buổi làm việc

**Cách 1: Qua màn hình Booking**
1. Truy cập **Dashboard → Lịch hẹn → Chọn booking**
2. Click "Thêm dịch vụ"
3. Chọn gói dịch vụ
4. Chọn KTV thực hiện
5. Nhập giá (mặc định từ gói)
6. Hệ thống tự động tính hoa hồng theo công thức:
   ```
   Hoa hồng = Giá dịch vụ × % hoa hồng × Hệ số chức vụ
   ```

**Cách 2: Qua API/Import hàng loạt**
- Sử dụng endpoint: `POST /api/service-items`
- Format CSV: xem file mẫu `service_items_import_template.csv`

### 3.2. Ghi đè hoa hồng (Override Commission)

Đôi khi bạn muốn đặt hoa hồng riêng cho một buổi dịch vụ cụ thể:

**Bước thực hiện:**
1. Vào chi tiết buổi dịch vụ
2. Click "Chỉnh sửa hoa hồng"
3. Chọn loại:
   - **Phần trăm:** Nhập % (ví dụ: 25%)
   - **Số tiền cố định:** Nhập số tiền (ví dụ: 200,000 VND)
4. Lưu thay đổi

**Lưu ý:**
- Hoa hồng ghi đè chỉ áp dụng cho buổi dịch vụ đó
- Không ảnh hưởng đến các buổi khác

### 3.3. Xem báo cáo hoa hồng

Truy cập: **Dashboard → Lương → Báo cáo hoa hồng**

**Các báo cáo có sẵn:**
- **Hoa hồng theo KTV:** Xem tổng hoa hồng của từng nhân viên trong tháng
- **Hoa hồng theo dịch vụ:** Dịch vụ nào tạo ra hoa hồng nhiều nhất
- **Xu hướng theo thời gian:** Biểu đồ tăng/giảm theo tuần/tháng

**Chức năng:**
- Lọc theo tháng, KTV, loại dịch vụ
- Export Excel/CSV
- In báo cáo

---

## 4. Quản Lý Bán Hàng (Product Sales)

### 4.1. Ghi nhận bán hàng

**Cách 1: Qua màn hình Kho**
1. Truy cập **Dashboard → Kho → Bán hàng**
2. Click "Tạo đơn hàng mới"
3. Chọn sản phẩm
4. Nhập số lượng
5. Chọn KTV bán hàng
6. Chọn phương thức thanh toán
7. Xác nhận

**Hoa hồng được tính khi:**
- Trạng thái đơn hàng = "Đã thanh toán" (`paid`)
- Công thức:
  ```
  Hoa hồng = (Giá × Số lượng) × % hoa hồng × Hệ số chức vụ
  ```

### 4.2. Import hàng loạt từ CSV

**Bước thực hiện:**
1. Tải file mẫu: **Dashboard → Kho → Export template**
2. Điền thông tin:
   - `product_id`: Mã sản phẩm
   - `quantity`: Số lượng
   - `ktv_id`: Mã KTV
   - `payment_method`: `cash`, `card`, `transfer`
   - `sale_date`: Ngày bán (YYYY-MM-DD)
3. Upload file CSV
4. Kiểm tra xem trước
5. Xác nhận import

**Lỗi thường gặp:**
- "Product not found" → Kiểm tra `product_id` có đúng không
- "Invalid KTV" → KTV không tồn tại hoặc đã nghỉ việc
- "Duplicate sale" → Trùng đơn hàng (kiểm tra idempotency key)

### 4.3. Xử lý hoàn trả (Refund)

Khi khách trả hàng, hệ thống sẽ **tự động thu hồi hoa hồng** đã tính:

**Hoàn trả toàn phần:**
1. Vào chi tiết đơn hàng
2. Click "Hoàn trả toàn bộ"
3. Nhập lý do
4. Xác nhận
   → Hoa hồng sẽ bị **khấu trừ 100%** trong bảng lương tháng này

**Hoàn trả một phần:**
1. Chọn "Hoàn trả một phần"
2. Nhập số lượng trả lại
3. Hệ thống tự tính hoa hồng bị khấu trừ theo tỷ lệ

**Ví dụ:**
- Đơn hàng: 10 chai dầu × 200k = 2,000,000 VND
- Hoa hồng gốc: 2,000,000 × 10% = 200,000 VND
- Khách trả 3 chai
- Hoa hồng bị thu hồi: 200,000 × (3/10) = 60,000 VND

---

## 5. Quản Lý Điều Chỉnh Thủ Công (Manual Adjustments)

### 5.1. Khi nào cần dùng điều chỉnh thủ công?

Điều chỉnh thủ công dùng cho các trường hợp **ngoại lệ** không tự động:

**Thưởng (Bonus):**
- Thưởng hoàn thành KPI vượt mức
- Thưởng nhân viên xuất sắc tháng
- Thưởng tham gia sự kiện/khóa đào tạo
- Bù chi phí đi lại, ăn uống

**Phạt (Deduction):**
- Phạt đi muộn/về sớm
- Phạt vi phạm nội quy
- Khấu trừ tạm ứng
- Khấu trừ hư hỏng dụng cụ

### 5.2. Danh mục điều chỉnh

Hệ thống có sẵn các danh mục:

| Loại | Danh mục | Mô tả |
|------|----------|-------|
| Thưởng | `kpi_achievement` | Hoàn thành KPI vượt mức |
| Thưởng | `employee_of_month` | Nhân viên xuất sắc tháng |
| Thưởng | `training_participation` | Tham gia đào tạo |
| Thưởng | `expense_reimbursement` | Bù chi phí |
| Phạt | `attendance_violation` | Vi phạm chấm công |
| Phạt | `policy_violation` | Vi phạm nội quy |
| Phạt | `advance_deduction` | Khấu trừ tạm ứng |
| Phạt | `equipment_damage` | Hư hỏng dụng cụ |

**Thêm danh mục mới:**
1. Truy cập **Dashboard → Cài đặt → Danh mục điều chỉnh**
2. Click "Thêm danh mục"
3. Nhập tên và mô tả
4. Lưu

### 5.3. Quy trình phê duyệt

**Bước 1: Tạo điều chỉnh (Draft)**
1. Truy cập **Dashboard → Lương → Điều chỉnh**
2. Click "Thêm điều chỉnh mới"
3. Chọn KTV
4. Chọn tháng áp dụng
5. Chọn loại: Thưởng hoặc Phạt
6. Chọn danh mục
7. Nhập số tiền
8. Nhập lý do (tối thiểu 10 ký tự)
9. Thêm ghi chú nếu cần
10. Lưu nháp

**Bước 2: Gửi phê duyệt**
- Click "Gửi phê duyệt"
- Trạng thái → `pending_approval`

**Bước 3: Admin phê duyệt**
- Xem chi tiết điều chỉnh
- Click "Phê duyệt" hoặc "Từ chối"
- Nếu phê duyệt → Trạng thái = `approved`
  → Hệ thống **tự động tính lại lương** của KTV trong tháng đó

**Lưu ý:**
- Chỉ điều chỉnh ở trạng thái `draft` mới có thể chỉnh sửa
- Sau khi đã `approved`, không thể sửa (phải tạo điều chỉnh ngược lại)

### 5.4. Xem tác động đến lương

Khi xem chi tiết bảng lương KTV:

```
Lương cơ bản:        10,000,000 VND
Hoa hồng dịch vụ:     5,000,000 VND
Hoa hồng bán hàng:    1,500,000 VND
---
Điều chỉnh thủ công:
  + Thưởng KPI:       2,000,000 VND
  - Phạt đi muộn:      -200,000 VND
---
TỔNG LƯƠNG:          18,300,000 VND
```

---

## 6. Hiểu Rõ Công Thức Tính Lương

### 6.1. Công thức tổng quan

```
TỔNG LƯƠNG = Lương cơ bản 
            + Hoa hồng dịch vụ 
            + Hoa hồng bán hàng 
            + Thưởng chức vụ 
            + Thưởng thâm niên 
            + Thưởng KPI 
            + Thưởng đánh giá 
            + Điều chỉnh thủ công (thưởng - phạt)
```

### 6.2. Chi tiết từng thành phần

#### 1. Lương cơ bản
- Số tiền cố định theo hợp đồng
- Tính theo công: `(Lương CB / 26) × Số ngày làm việc thực tế`
- Ví dụ: 10,000,000 / 26 × 24 = 9,230,769 VND

#### 2. Hoa hồng dịch vụ
```
Tổng hoa hồng dịch vụ = Σ (Giá dịch vụ × % HH × Hệ số chức vụ)
```
- Cộng dồn tất cả buổi dịch vụ trong tháng
- Áp dụng hệ số chức vụ một lần (không nhân mỗi buổi)

#### 3. Hoa hồng bán hàng
```
Tổng hoa hồng bán hàng = Σ (Giá bán × SL × % HH × Hệ số chức vụ)
```
- Chỉ tính đơn hàng đã thanh toán
- Trừ đi hoa hồng của đơn hoàn trả

#### 4. Thưởng chức vụ
- Áp dụng tự động qua hệ số nhân vào hoa hồng
- Không tính riêng

#### 5. Thưởng thâm niên
- Cộng cố định theo bậc thâm niên
- Ví dụ: 1,000,000 VND/tháng cho KTV có 3-5 năm kinh nghiệm

#### 6. Thưởng KPI
- Do hệ thống tính dựa trên bảng KPI
- Tự động cộng vào lương

#### 7. Thưởng đánh giá
- Dựa trên sao đánh giá trung bình của khách hàng
- Ví dụ: 
  - 5 sao: +500,000 VND
  - 4-4.9 sao: +300,000 VND
  - < 4 sao: 0 VND

#### 8. Điều chỉnh thủ công
- Tổng thưởng - Tổng phạt
- Chỉ tính những điều chỉnh đã được phê duyệt

### 6.3. Ví dụ tính lương đầy đủ

**Thông tin KTV:**
- Tên: Nguyễn Thị Mai
- Chức vụ: Senior (hệ số 1.2x)
- Thâm niên: 4 năm
- Lương CB: 10,000,000 VND
- Số ngày làm: 26/26

**Hoạt động trong tháng:**
- 15 buổi dịch vụ, giá trung bình 500,000/buổi, HH 15%
- Bán được 10 sản phẩm, tổng doanh thu 5,000,000 VND, HH 5%
- Đánh giá: 4.8 sao
- Thưởng KPI: 2,000,000 VND
- Phạt đi muộn 1 lần: -100,000 VND

**Tính toán:**
```
1. Lương cơ bản:         10,000,000 VND
2. HH dịch vụ:           15 × 500,000 × 15% × 1.2 = 1,350,000 VND
3. HH bán hàng:          5,000,000 × 5% × 1.2 = 300,000 VND
4. Thưởng thâm niên:     1,000,000 VND
5. Thưởng KPI:           2,000,000 VND
6. Thưởng đánh giá:      300,000 VND
7. Phạt:                 -100,000 VND
---
TỔNG LƯƠNG:              14,850,000 VND
```

---

## 7. Báo Cáo & Phân Tích

### 7.1. Báo cáo hoa hồng

Truy cập: **Dashboard → Báo cáo → Hoa hồng**

**Các báo cáo:**

1. **Tổng quan hoa hồng theo tháng**
   - Biểu đồ cột so sánh tháng này vs tháng trước
   - Tổng chi trả hoa hồng
   - Tăng/giảm bao nhiêu %

2. **Top KTV có hoa hồng cao nhất**
   - Bảng xếp hạng 10 KTV kiếm hoa hồng nhiều nhất
   - Phân loại theo dịch vụ/bán hàng

3. **Hoa hồng theo loại dịch vụ**
   - Dịch vụ nào tạo ra hoa hồng nhiều nhất
   - Biểu đồ tròn phân bổ

4. **Xu hướng theo thời gian**
   - Biểu đồ đường theo tuần/tháng/quý
   - Dự báo xu hướng

### 7.2. Xuất Excel/CSV

**Bước thực hiện:**
1. Chọn báo cáo muốn xuất
2. Click nút "Export"
3. Chọn định dạng: Excel (.xlsx) hoặc CSV
4. File tự động tải về

**Nội dung file:**
- Sheet 1: Dữ liệu chi tiết
- Sheet 2: Tóm tắt
- Sheet 3: Biểu đồ (chỉ Excel)

### 7.3. Phân tích hiệu suất

**KPI quan trọng:**
- **Hoa hồng bình quân/KTV:** Đánh giá hiệu suất chung
- **Tỷ lệ hoa hồng/Doanh thu:** Kiểm soát chi phí
- **Hoa hồng dịch vụ vs Bán hàng:** Cân đối nguồn thu nhập

**Cách sử dụng:**
1. Theo dõi KPI hàng tháng
2. So sánh với tháng trước
3. Điều chỉnh chính sách nếu cần

---

## 8. Xử Lý Sự Cố

### 8.1. Hoa hồng không hiển thị

**Nguyên nhân & Giải pháp:**

| Nguyên nhân | Cách kiểm tra | Giải pháp |
|-------------|---------------|-----------|
| Buổi dịch vụ chưa hoàn thành | Kiểm tra trạng thái session | Đánh dấu session = `completed` |
| KTV không được gán | Xem `service_item.ktv_id` | Gán KTV cho dịch vụ |
| Cấu hình HH = 0% | Kiểm tra `override_commission_value` | Đặt HH > 0 hoặc xóa override |
| Đơn hàng chưa thanh toán | Kiểm tra trạng thái `product_sale` | Xác nhận thanh toán |

**Cách debug nhanh:**
```sql
-- Kiểm tra service items của KTV
SELECT * FROM service_items 
WHERE ktv_id = 'xxx' 
AND created_at >= '2026-06-01'
ORDER BY created_at DESC;

-- Kiểm tra product sales
SELECT * FROM product_sales 
WHERE ktv_id = 'xxx' 
AND status = 'paid'
AND sale_date >= '2026-06-01';
```


### 8.2. Hoa hồng tính sai

**Các lỗi thường gặp:**

**1. Hoa hồng quá cao**
- Kiểm tra: Có bị tính trùng không?
- Cách fix: Xem log `service_items`, xóa bản ghi trùng

**2. Hoa hồng quá thấp**
- Kiểm tra: Hệ số chức vụ đã đúng chưa?
- Kiểm tra: % hoa hồng có bị override thấp không?
- Cách fix: Cập nhật hồ sơ KTV hoặc xóa override

**3. Hoa hồng bị thu hồi không đúng**
- Kiểm tra: Có đơn hoàn trả nào không?
- Cách fix: Xem lịch sử refund, điều chỉnh lại nếu sai

**Debug bằng SQL:**
```sql
-- Xem chi tiết tính hoa hồng của 1 KTV
SELECT 
  si.service_name,
  si.subtotal,
  si.commission_type,
  si.commission_value,
  u.position_tier,
  (si.subtotal * si.commission_value / 100) as commission_base,
  (si.subtotal * si.commission_value / 100 * 1.2) as commission_with_multiplier
FROM service_items si
JOIN users u ON si.ktv_id = u.id
WHERE si.ktv_id = 'xxx' 
AND EXTRACT(MONTH FROM si.created_at) = 6;
```

### 8.3. Hiệu suất chậm

**Triệu chứng:**
- Màn hình lương load lâu (> 5 giây)
- Export CSV timeout
- Báo cáo lag

**Nguyên nhân & Giải pháp:**

| Nguyên nhân | Giải pháp |
|-------------|-----------|
| Quá nhiều dữ liệu (> 10,000 records) | Lọc theo tháng, KTV cụ thể |
| Database chưa index | Liên hệ IT để tạo index cho `service_items.ktv_id`, `product_sales.ktv_id` |
| Cache không hoạt động | Restart server, clear Redis cache |
| Query phức tạp | Sử dụng database view/materialized view |

**Tối ưu:**
1. Chỉ load dữ liệu cần thiết
2. Dùng phân trang (pagination)
3. Export theo batch thay vì toàn bộ
4. Tắt realtime updates khi không cần

---

## 9. Câu Hỏi Thường Gặp (FAQ)

### Q1: Hoa hồng được trả khi nào?

**Trả lời:**  
Hoa hồng được tính vào lương tháng và trả vào **ngày 5 hàng tháng** (hoặc theo quy định của cơ sở).

Ví dụ:
- Hoa hồng tháng 6/2026 → Trả vào ngày 5/7/2026

### Q2: KTV có thể xem hoa hồng của mình không?

**Trả lời:**  
Có. KTV đăng nhập vào app di động và xem:
- **Dashboard → Lương → Chi tiết tháng này**
- Sẽ thấy hoa hồng từng buổi dịch vụ, từng đơn bán hàng

### Q3: Nếu KTV nghỉ giữa tháng thì hoa hồng tính thế nào?

**Trả lời:**  
Hệ thống tính **pro-rata** (theo tỷ lệ):
- Lương cơ bản: `(Lương CB / 26) × Số ngày làm việc thực tế`
- Hoa hồng: Tính đầy đủ cho tất cả buổi dịch vụ/bán hàng đã thực hiện

Ví dụ:
- KTV nghỉ từ ngày 15/6
- Làm được 14 ngày và 10 buổi dịch vụ
- Lương CB: `10,000,000 / 26 × 14 = 5,384,615 VND`
- Hoa hồng: `10 buổi × 500k × 15% × 1.2 = 900,000 VND`
- Tổng: `6,284,615 VND`

### Q4: Có thể thay đổi cấu hình hoa hồng giữa tháng không?

**Trả lời:**  
Có, nhưng **chỉ áp dụng cho các buổi dịch vụ/bán hàng mới** sau khi thay đổi.

Các buổi đã thực hiện trước đó sẽ giữ nguyên mức hoa hồng cũ.

### Q5: Nếu khách hàng trả hàng sau 2 tháng thì sao?

**Trả lời:**  
Hệ thống sẽ **khấu trừ hoa hồng vào tháng hiện tại** (tháng xử lý hoàn trả), không điều chỉnh lại lương tháng cũ.

Ví dụ:
- Tháng 6: KTV bán hàng, hưởng HH 200k
- Tháng 8: Khách trả hàng
- Lương tháng 8 của KTV sẽ bị trừ 200k

### Q6: Điều chỉnh thủ công có giới hạn số tiền không?

**Trả lời:**  
Không có giới hạn cứng, nhưng:
- Thưởng > 5,000,000 VND → Cần phê duyệt từ Giám đốc
- Phạt > 2,000,000 VND → Cần phê duyệt từ Giám đốc

### Q7: Làm sao để xuất báo cáo cho kế toán?

**Trả lời:**  
1. Truy cập **Dashboard → Báo cáo → Lương tháng**
2. Chọn tháng cần xuất
3. Click "Export cho kế toán"
4. File Excel sẽ bao gồm:
   - Sheet 1: Tổng hợp lương từng KTV
   - Sheet 2: Chi tiết hoa hồng
   - Sheet 3: Điều chỉnh thủ công
   - Sheet 4: Bút toán kế toán

### Q8: Hệ thống có tự động gửi thông báo cho KTV không?

**Trả lời:**  
Có. Hệ thống tự động gửi thông báo khi:
- Có hoa hồng mới được tính
- Lương tháng đã được chốt
- Có điều chỉnh thủ công được phê duyệt

KTV nhận qua:
- App notification
- Email (nếu có)
- Zalo OA (nếu cấu hình)

### Q9: Có thể sửa hoa hồng đã tính không?

**Trả lời:**  
- **Trước khi chốt lương:** Có thể sửa bằng cách xóa và tạo lại
- **Sau khi chốt lương:** Không sửa được, phải tạo điều chỉnh thủ công cho tháng tiếp theo

### Q10: Làm sao để kiểm tra xem hoa hồng có bị tính trùng không?

**Trả lời:**  
1. Truy cập **Dashboard → Lương → Kiểm tra trùng lặp**
2. Hệ thống tự động quét:
   - Service items trùng `booking_id` + `ktv_id`
   - Product sales trùng `sale_id` + `ktv_id`
3. Hiển thị danh sách nếu có
4. Click "Xóa bản ghi trùng" để dọn dẹp

---

## Kết Luận

Hệ thống hoa hồng của Bella ERP giúp bạn:
- ✅ Tự động hóa việc tính lương
- ✅ Minh bạch cho KTV
- ✅ Dễ dàng theo dõi và điều chỉnh
- ✅ Báo cáo đầy đủ cho quản lý

**Hỗ trợ:**
- Email: support@bella-erp.vn
- Hotline: 1900-xxxx
- Tài liệu: https://docs.bella-erp.vn

---

*Cập nhật lần cuối: 22/06/2026*  
*Phiên bản tài liệu: 1.0.0*
