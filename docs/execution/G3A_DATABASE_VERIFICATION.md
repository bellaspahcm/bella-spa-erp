# G3A: Xác Minh Database Reality - Real Estate Customer Tracking

**Ngày:** 2026-08-11  
**Mục đích:** Xác minh bảng `re_customers` có tồn tại và được sử dụng trong runtime không  
**Trạng thái:** ⏳ CHỜ THỰC THI

---

## Vấn Đề Cần Giải Quyết

**Phát hiện từ G3:**
- Type definitions có `re_customers` (auto-generated)
- Code KHÔNG query `re_customers`
- Migrations KHÔNG tạo `re_customers`

**Câu hỏi:**
1. Bảng `re_customers` có tồn tại trong database không?
2. Nếu có, có data không?
3. Có foreign key/reference nào tới nó không?
4. Nếu không có, thì Real Estate track customer ở đâu?

---

## Bước 1: Kiểm Tra Bảng Tồn Tại

### Query 1.1: Kiểm tra table trong schema

```sql
-- Kiểm tra bảng re_customers có trong public schema không
SELECT 
  table_name,
  table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name = 're_customers';
```

**Kết quả chờ điền:**
- [ ] Bảng TỒN TẠI
- [ ] Bảng KHÔNG TỒN TẠI

**Nếu KHÔNG tồn tại:**
→ `re_customers` là ghost table (chỉ có trong type definitions)  
→ SKIP migration `re_customers`, tìm actual customer tracking  
→ Chuyển sang Bước 3

**Nếu TỒN TẠI:**
→ Tiếp tục Bước 2

---

## Bước 2: Kiểm Tra Data & Usage (Nếu bảng tồn tại)

### Query 2.1: Đếm số row

```sql
SELECT COUNT(*) as total_rows FROM re_customers;
```

**Kết quả:** _____ rows

**Nếu 0 rows:**
→ Bảng tồn tại nhưng KHÔNG có data  
→ Có thể là bảng cũ đã bị migrate hoặc chưa dùng  
→ KHÔNG ưu tiên migration

**Nếu >0 rows:**
→ Có data thực tế, tiếp tục kiểm tra

---

### Query 2.2: Xem sample data

```sql
SELECT 
  id,
  tenant_id,
  name,
  phone,
  email,
  created_at,
  updated_at
FROM re_customers 
LIMIT 5;
```

**Kết quả:** (copy 3-5 rows mẫu)

```
[điền data mẫu ở đây]
```

**Phân tích:**
- Có data hợp lệ không?
- Có tenant_id đúng không?
- Data có vẻ đang được dùng không?

---

### Query 2.3: Kiểm tra foreign keys TỚI re_customers

```sql
-- Tìm tất cả tables có FK reference tới re_customers
SELECT
  tc.table_name AS referencing_table,
  kcu.column_name AS referencing_column,
  ccu.table_name AS referenced_table,
  ccu.column_name AS referenced_column
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND ccu.table_name = 're_customers';
```

**Kết quả:**

| Bảng Tham Chiếu | Cột FK | Bảng Được Tham Chiếu | Cột Được Tham Chiếu |
|-----------------|--------|----------------------|---------------------|
| _[điền]_ | _[điền]_ | re_customers | id |

**Nếu KHÔNG có FK nào:**
→ Bảng isolated, không được reference  
→ Có thể là legacy/unused

**Nếu CÓ FK:**
→ Bảng đang được dùng bởi: _[liệt kê tables]_  
→ PHẢI migration

---

### Query 2.4: Kiểm tra foreign keys TỪ re_customers

```sql
-- Tìm FK từ re_customers đi ra
SELECT
  tc.table_name AS referencing_table,
  kcu.column_name AS referencing_column,
  ccu.table_name AS referenced_table,
  ccu.column_name AS referenced_column
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name = 're_customers';
```

**Kết quả:** (liệt kê FK từ re_customers)

---

### Query 2.5: Kiểm tra recent updates

```sql
-- Xem bảng có data mới không
SELECT 
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days') as created_last_30d,
  COUNT(*) FILTER (WHERE updated_at > NOW() - INTERVAL '30 days') as updated_last_30d,
  MAX(created_at) as last_created,
  MAX(updated_at) as last_updated
FROM re_customers;
```

**Kết quả:**
- Rows created 30 ngày qua: _____
- Rows updated 30 ngày qua: _____
- Last created: _____
- Last updated: _____

**Nếu không có activity 30 ngày:**
→ Bảng có thể không active

**Nếu có activity gần đây:**
→ Bảng đang được dùng actively

---

## Bước 3: Tìm Actual Customer Tracking

### Query 3.1: Kiểm tra real_estate_products.owner_name

```sql
-- Xem owner_name được dùng như thế nào
SELECT 
  id,
  product_code,
  owner_name,
  status,
  COUNT(*) OVER (PARTITION BY owner_name) as products_by_owner
FROM real_estate_products
WHERE owner_name IS NOT NULL
LIMIT 10;
```

**Kết quả:**

```
[điền sample data]
```

**Phân tích:**
- `owner_name` có giá trị không? (Có/Không)
- `owner_name` là text tự do hay có pattern? _____
- Có owner có nhiều products không? (Có/Không)
- `owner_name` có vẻ là identity hay chỉ label? _____

---

### Query 3.2: Kiểm tra duplicate owner names

```sql
-- Tìm owner names trùng nhau
SELECT 
  owner_name,
  COUNT(*) as product_count,
  array_agg(DISTINCT status) as statuses,
  array_agg(product_code) as products
FROM real_estate_products
WHERE owner_name IS NOT NULL
GROUP BY owner_name
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC
LIMIT 10;
```

**Kết quả:**

| Owner Name | Số Products | Statuses | Products |
|------------|-------------|----------|----------|
| _[điền]_ | _[điền]_ | _[điền]_ | _[điền]_ |

**Phân tích:**
- Có owners có nhiều products không?
- Nếu có → `owner_name` đại diện cho Person/Entity thực
- Nếu không → `owner_name` chỉ là text mô tả

---

### Query 3.3: Kiểm tra reservations có customer info không

```sql
-- Tìm bảng reservations
SELECT 
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name LIKE '%reservation%'
  AND table_schema = 'public'
ORDER BY table_name, ordinal_position;
```

**Kết quả:** (liệt kê columns của reservation tables)

```
[điền columns]
```

**Tìm kiếm trong reservations:**
- Có column `customer_id`, `customer_name`, `buyer_id` không?
- Có column `contact_phone`, `contact_email` không?
- Có FK tới `persons` hoặc `re_customers` không?

---

### Query 3.4: Tìm tất cả tables có từ "customer", "buyer", "owner", "investor"

```sql
SELECT 
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (
    table_name LIKE '%customer%'
    OR table_name LIKE '%buyer%'
    OR table_name LIKE '%owner%'
    OR table_name LIKE '%investor%'
    OR column_name LIKE '%customer%'
    OR column_name LIKE '%buyer%'
    OR column_name LIKE '%owner%'
    OR column_name LIKE '%investor%'
  )
ORDER BY table_name, column_name;
```

**Kết quả:**

| Table | Column | Type | Ghi Chú |
|-------|--------|------|---------|
| _[điền]_ | _[điền]_ | _[điền]_ | _[điền]_ |

---

## Bước 4: Quyết Định Migration Target

### Kịch bản 1: re_customers TỒN TẠI & ĐANG DÙNG

**Bằng chứng:**
- [ ] Bảng có data (>0 rows)
- [ ] Có FK từ tables khác tới re_customers
- [ ] Có activity gần đây (30 ngày)

**Quyết định:**
→ ✅ **MIGRATION TARGET = `re_customers → Person Center`**  
→ Tiếp tục G2, G4, G5 như kế hoạch ban đầu

---

### Kịch bản 2: re_customers TỒN TẠI NHƯNG KHÔNG DÙNG

**Bằng chứng:**
- [ ] Bảng có 0 rows HOẶC
- [ ] Không có FK nào reference HOẶC
- [ ] Không có activity >90 ngày

**Quyết định:**
→ ❌ **SKIP `re_customers` migration**  
→ Đánh dấu ghost table, không ưu tiên  
→ Tìm actual customer tracking (Kịch bản 3)

---

### Kịch bản 3: re_customers KHÔNG TỒN TẠI, owner_name là actual identity

**Bằng chứng:**
- [ ] `re_customers` không tồn tại trong DB
- [ ] `real_estate_products.owner_name` có data
- [ ] Có owners có nhiều products (identity relationship)

**Quyết định:**
→ ✅ **MIGRATION TARGET = `real_estate_products.owner_name → Person Center FK`**

**Thiết kế migration:**
```sql
-- Thêm cột customer_id
ALTER TABLE real_estate_products 
ADD COLUMN customer_id UUID REFERENCES persons(id);

-- Migrate data: tạo Person từ owner_name
-- (chi tiết trong G5 sau khi xác nhận)

-- Deprecate owner_name
-- (giữ dual-read period)
```

---

### Kịch bản 4: Real Estate KHÔNG track customer riêng

**Bằng chứng:**
- [ ] Không có bảng customer
- [ ] `owner_name` chỉ là text tự do, không có pattern
- [ ] Không có owners có nhiều products
- [ ] Reservations không có customer info

**Quyết định:**
→ ⚠️ **Real Estate chưa có customer entity**  
→ Phase 1 cần BUILD customer tracking trước khi migrate  
→ Hoặc skip Real Estate, chọn module khác (Beauty Spa?)

---

## Bước 5: Cập Nhật Gate Status

Sau khi thực thi queries trên, cập nhật:

**G3 Status:**
- [ ] ✅ PASSED - Migration target xác nhận: _[điền target]_
- [ ] 🔴 BLOCKED - Cần action: _[mô tả]_

**G4 (Baseline Freeze):**
- [ ] ✅ CÓ THỂ TIẾP TỤC - Target đã rõ
- [ ] ⏸️ GIỮ NGUYÊN - Chờ quyết định

**G5 (Migration Design):**
- [ ] ✅ CÓ THỂ TIẾP TỤC - Thiết kế cho: _[target]_
- [ ] ⏸️ GIỮ NGUYÊN - Chờ quyết định

---

## Kết Luận G3A

**Migration target thực tế:**
- [ ] `re_customers → Person Center`
- [ ] `real_estate_products.owner_name → Person Center FK`
- [ ] Khác: _[mô tả]_
- [ ] Real Estate chưa có customer entity, cần build trước

**Bằng chứng:**
- _[tóm tắt findings từ queries trên]_

**Next action:**
- _[G2 validation / G4 baseline / G5 design / hoặc pivot plan]_

---

**Thực hiện bởi:** _[điền tên]_  
**Ngày thực hiện:** _[điền ngày]_  
**Database:** _[dev/staging/production]_  
**Thời gian thực hiện:** _[phút]_
