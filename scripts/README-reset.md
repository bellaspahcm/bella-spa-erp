# Reset Customer Data — Hướng dẫn sử dụng

> **Mục đích**: Đưa hệ thống BELLA SPA ERP về trạng thái "phần mềm mới hoàn toàn" — xoá sạch dữ liệu khách hàng + vận hành + tài chính phát sinh + các chi nhánh phụ, **chỉ giữ 1 chi nhánh trụ sở và admin**.

## 1. Phạm vi tác động

### ❌ Sẽ bị XOÁ SẠCH
- **Khách hàng & dẫn xuất**: `customers`, `bookings`, `session_logs`, `session_reviews`, `shifts`, `revenue`, `chat_threads`, `chat_messages`, `membership_records`
- **Vận hành**: `attendance`, `staff_leaves`, `expenses`
- **Kho**: `inventory_items`, `inventory_logs`, `package_materials`
- **Lương & KPI**: `salary_records`, `kpi_records`
- **Tài chính phát sinh**: `journal_entries`, `journal_lines`, `accounting_outbox`, `franchise_royalty_invoices`, `subscription_invoices`, `inventory_transfer_orders`, `inter_branch_clearing_records`
- **Log**: `audit_logs`, `app_notifications`, `ai_agent_logs`
- **Người dùng**: tất cả users có `role <> 'admin'` (cả trong `public.users` và `auth.users`)
- **Tenants**: tất cả trừ `Bella Spa Headquarter`

### ✅ Sẽ ĐƯỢC GIỮ
- **Tenant `Bella Spa Headquarter`** (cấu hình + zalo + bank + salary_config)
- **Users role = 'admin'** (tự động reassign về HQ tenant nếu đang ở tenant khác)
- **Master data**: `packages`, `brand_service_master`, `accounting_accounts` (COA)
- **Định nghĩa kỳ kế toán** (`accounting_periods`) — mọi kỳ CLOSED sẽ được mở lại
- **Cấu hình AI**: `ai_agent_configs` (token Telegram của HQ)
- **Toàn bộ cấu trúc schema, RLS policies, triggers, functions** — không thay đổi gì

## 2. Quy trình chạy

### Bước 1: Backup (BẮT BUỘC)

**Option A — Supabase Cloud Dashboard** (khuyên dùng nếu có Pro plan):
1. Truy cập Supabase Dashboard → Project → Database → Backups
2. Bấm "Create backup now"
3. Đợi snapshot hoàn tất

**Option B — `pg_dump` thủ công**:
```bash
# Lấy DB URL từ Supabase: Settings → Database → Connection string (Direct)
export DB_URL="postgresql://postgres:<PASSWORD>@db.<PROJECT>.supabase.co:5432/postgres"

# Dump toàn bộ (data + schema)
pg_dump "$DB_URL" \
  --no-owner --no-acl \
  --format=custom \
  --file="backup-before-reset-$(date +%Y%m%d-%H%M%S).dump"
```

### Bước 2: Dry-run (kiểm thử không xoá)

1. Mở file `scripts/reset-customer-data.sql`
2. Đổi dòng:
   ```sql
   v_dry_run := FALSE;
   ```
   thành:
   ```sql
   v_dry_run := TRUE;
   ```
3. Mở Supabase SQL Editor → New Query → Paste toàn bộ file → Run
4. Đọc phần `NOTICE` output để xem số dòng sẽ bị xoá
5. Xác nhận con số hợp lý → quay lại đổi `TRUE` về `FALSE`

### Bước 3: Chạy reset thật

1. Trong Supabase SQL Editor, paste lại file `scripts/reset-customer-data.sql` (với `v_dry_run := FALSE`)
2. Bấm **Run**
3. Đợi 10-30 giây (tuỳ data size)
4. Đọc NOTICE output — kỳ vọng kết thúc bằng dòng `RESET COMPLETE — kept tenant: Bella Spa Headquarter`
5. **Nếu lỗi**: toàn bộ transaction ROLLBACK tự động, dữ liệu không bị ảnh hưởng

### Bước 4: Verify

1. Paste `scripts/verify-reset.sql` vào SQL Editor → Run
2. Kỳ vọng kết thúc bằng `VERIFY RESET — ALL CHECKS PASSED ✓`
3. Nếu có `RAISE EXCEPTION` → bảng còn dữ liệu → kiểm tra lại

### Bước 5: Smoke test app

- [ ] Vào `/login` → đăng nhập bằng admin → vào được dashboard không lỗi
- [ ] `/dashboard` hiển thị "0 khách / 0 booking", không crash
- [ ] `/dashboard/services` → vẫn thấy danh sách gói (packages giữ nguyên)
- [ ] `/dashboard/accounting/chart-of-accounts` → COA còn nguyên
- [ ] `/dashboard/settings` → tab Thông tin chung, Lương, Kế toán có dữ liệu (tenant settings)
- [ ] `/dashboard/customers` → trống
- [ ] `/dashboard/inventory` → trống
- [ ] `/dashboard/salary` → tháng hiện tại = 0
- [ ] Tạo khách mới + booking thử → KHÔNG lỗi → journal entry mới được POSTED bình thường

## 3. Rollback (nếu cần khôi phục)

### Option A — Supabase PITR (nếu có Pro plan)
1. Dashboard → Database → Backups → Point-in-time recovery
2. Chọn timestamp trước khi chạy reset
3. Bấm "Restore"

### Option B — Restore từ `pg_dump`
```bash
# Restore từ file backup tạo ở Bước 1B
pg_restore \
  --dbname="$DB_URL" \
  --clean --if-exists \
  --no-owner --no-acl \
  backup-before-reset-YYYYMMDD-HHMMSS.dump
```

> ⚠️ **Cảnh báo**: pg_restore với `--clean` sẽ DROP tables trước khi restore. Nếu schema có thay đổi sau backup, restore có thể fail. Để chắc chắn, restore vào DB tạm trước rồi mới migrate sang prod.

## 4. Câu hỏi thường gặp

### Q1: Sau reset, tôi cần làm gì để spa hoạt động bình thường trở lại?
1. Tự thêm KTV qua trang **Cài đặt → Nhân sự & Quyền** (sẽ tự tạo cả `auth.users` và `public.users`)
2. Tự thêm sản phẩm kho qua **Dashboard → Inventory**
3. Tự thêm các loại chi phí qua trang Chi phí
4. Đăng kí khách hàng đầu tiên qua **Dashboard → Khách hàng**

### Q2: Tôi có cần chạy migration nào không?
**Không**. Script chỉ XOÁ DATA. Cấu trúc schema/RLS/triggers/functions không bị thay đổi.

### Q3: Có phá hỏng accounting period đã CLOSED không?
Có — script tự động UPDATE status='OPEN' cho mọi kỳ CLOSED. Logic: số sách giờ rỗng → khoá kỳ vô nghĩa. Bạn có thể đóng lại sau khi có dữ liệu mới.

### Q4: Nếu trigger `Cannot modify a POSTED journal entry` block thì sao?
Script đã `SET LOCAL session_replication_role = 'replica'` → bỏ qua mọi trigger. Sau khi xong tự bật lại `origin`. Không cần làm gì.

### Q5: Có ảnh hưởng đến cấu hình MFA / 2FA của admin không?
**Không**. MFA factor lưu trong `auth.mfa_factors` thuộc schema `auth` và liên kết với `auth.users.id`. Admin được giữ → MFA factor giữ.

### Q6: Test suite (Jest) còn pass không?
Có. Tests không phụ thuộc data — chúng mock Supabase client. Run `npm test` để xác nhận.

### Q7: Sentry/PII redactor có bị ảnh hưởng không?
**Không**. Code mới `src/lib/log-redactor.ts`, `src/lib/mfa.ts`, Sentry configs hoàn toàn độc lập với data.

## 5. Cấu trúc file

```
scripts/
├── reset-customer-data.sql   ← Script reset chính (chạy 1 file duy nhất)
├── verify-reset.sql          ← Verify sau khi reset
└── README-reset.md           ← File này
```

## 6. Lưu ý cuối

- **KHÔNG** commit file backup `.dump` vào git (đã đủ trong `.gitignore` mặc định).
- **KHÔNG** chạy script này trên production trừ khi đã đồng bộ với toàn team.
- **KHÔNG** sửa `v_hq_name` trong script nếu tenant trụ sở của bạn tên khác — sửa cho khớp tên trong DB hiện tại.
- Sau reset, **đăng xuất và đăng nhập lại** trên app (phiên cũ có thể cache user info của KTV đã bị xoá).
