# Bella Spa ERP — Playwright E2E Suite

Bộ test end-to-end cho **5 luồng nghiệp vụ P0** của Bella Spa ERP. Khác với Jest unit tests (mock Supabase, logic backend), E2E suite này chạy app thật trên Chromium, login thật, và đụng vào DB Supabase staging/dev.

## Cấu trúc

```
e2e/
├── fixtures/
│   └── auth.ts                       # Auth fixture — adminPage đã login sẵn
├── helpers/
│   ├── supabase-admin.ts             # Service-role client (seed/teardown)
│   └── ui.ts                         # Helper UI: nav, toast, button, label
└── tests/
    ├── 01-booking-creation.spec.ts        # Tạo booking
    ├── 02-session-checkin-checkout.spec.ts # KTV check-in/out session
    ├── 03-bank-reconciliation.spec.ts     # Đối soát ngân hàng
    ├── 04-period-closing.spec.ts          # Đóng kỳ kế toán
    ├── 05-payroll-finalization.spec.ts    # Chốt & duyệt lương
    ├── 06-cross-module-verification.spec.ts
    ├── 07-security-boundary.spec.ts
    └── 08-accounting-tabs-smoke.spec.ts   # Smoke toàn bộ tab Kế toán/Sổ cái
```

## Yêu cầu

1. **Biến môi trường** (`.env.local`):
   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   SUPABASE_SERVICE_ROLE_KEY=...
   ```

2. **Tài khoản admin trong DB** (Bella Spa Headquarter tenant):
   - Có ít nhất 1 user role=`admin` trong `public.users` + tương ứng trong `auth.users`
   - Mật khẩu của user đó phải là `password123` (dev bypass — xem `src/app/(auth)/login/page.tsx`)
   - **Tài khoản này KHÔNG bật MFA** — nếu có MFA, fixture sẽ fail nhanh với message rõ ràng. Tạm tắt MFA hoặc tạo account riêng cho E2E.

3. **Browser đã cài**: `npx playwright install chromium` (đã chạy 1 lần khi setup)

## Chạy tests

```bash
# Headless, full suite
npm run e2e

# UI mode tương tác — chọn test, xem step-by-step
npm run e2e:ui

# Headed browser — xem trình duyệt mở thật
npm run e2e:headed

# Debug mode (mở Playwright Inspector)
npm run e2e:debug

# Mở HTML report sau khi chạy xong
npm run e2e:report

# Chạy 1 file cụ thể
npx playwright test e2e/tests/01-booking-creation.spec.ts

# Chạy với grep
npx playwright test -g "Đặt lịch"
```

## Cách hoạt động

### Auto dev server
`playwright.config.ts` có `webServer: { command: "npm run dev" }` — tự động start `next dev` ở port 3000 trước khi test, share session nếu đã chạy sẵn.

### Login bypass
Mỗi spec import `test` từ `e2e/fixtures/auth.ts` — fixture `adminPage` đã login bằng:
1. Query DB lấy email admin đầu tiên trong tenant HQ
2. Login với password `password123` (dev bypass)
3. Verify URL chuyển sang `/dashboard`

Nếu có MFA → fail rõ ràng. Cách fix: tắt MFA tạm thời cho account E2E.

### Data seeding & cleanup
Mỗi spec dùng `e2e/helpers/supabase-admin.ts` (service-role client) để:
- **Tạo data tạm** (customer, booking, salary_record) trong `beforeEach`
- **Cleanup** trong `afterEach` — xoá data vừa tạo, không leak sang test khác
- **Test month/year** dùng giá trị `2030-01-01` (không đụng dữ liệu thật)

### Serial execution
`fullyParallel: false`, `workers: 1` — Bella business flows chia sẻ DB rows (tenants, packages, accounting_periods). Chạy serial để tránh race condition.

## Phạm vi spec hiện tại

| Spec | Smoke | API/DB | UI workflow |
|---|:-:|:-:|:-:|
| 01 booking-creation | ✓ Trang load + CTA | ✓ INSERT booking | △ Form structure |
| 02 session-checkin-checkout | ✓ Trang sessions | ✓ INSERT session_log | △ KTV dashboard route |
| 03 bank-reconciliation | ✓ Trang reconciliation | ✓ revenue pending → confirmed | △ Upload control hiển thị |
| 04 period-closing | ✓ Accounting routes | ✓ accounting_periods state | ✓ COA seeded |
| 05 payroll-finalization | ✓ Salary pages | ✓ salary_records state machine | △ tenant.salary_config |
| 08 accounting-tabs-smoke | ✓ All accounting tabs | △ Auth/RPC smoke | ✓ No App Router error boundary |

**Legend**: ✓ = đã test đầy đủ · △ = smoke check (verify load + có element key)

## Mở rộng tiếp theo (P1+)

- Form validation: nhập SĐT sai format, ngày dự sinh quá khứ, deposit > price
- Calendar drag & drop: kéo lịch sang ngày khác
- Concurrency: 2 user cùng đặt KTV cùng giờ
- Upload sao kê NH thật + verify auto-match
- KTV mobile flow trên viewport iPhone 14

## Troubleshooting

**`Admin user has MFA enrolled — cannot proceed automated E2E`**
→ Tắt MFA cho account E2E qua Supabase Dashboard → Authentication → Users → MFA Factors.

**`Không tìm thấy tenant 'Bella Spa Headquarter'`**
→ Chạy seed/onboarding tenant. Hoặc đổi `v_hq_name` trong `e2e/helpers/supabase-admin.ts` cho phù hợp.

**Test timeout 30s khi mở `/dashboard`**
→ App có thể compile lần đầu chậm. Tăng `actionTimeout` / `navigationTimeout` trong `playwright.config.ts`, hoặc warmup bằng cách mở `http://localhost:3000` thủ công 1 lần.

**`webServer was not ready`**
→ Port 3000 đang bị chiếm. Đổi `E2E_PORT` env hoặc kill process cũ.

**Cleanup không hoàn tất khi test fail**
→ Mở Supabase SQL Editor, query `WHERE booking_number LIKE 'E2E-%'` (booking) hoặc `WHERE name LIKE 'E2E-%'` (periods) để xoá thủ công.
