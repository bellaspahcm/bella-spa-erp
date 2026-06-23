# Hướng Dẫn Setup Sentry cho Bella Mobile

**Mục đích**: Cấu hình Sentry error monitoring cho ứng dụng mobile trước khi deploy RPC và bắt đầu pilot.

**Thời gian**: ~15-30 phút

**Yêu cầu**:
- ✅ Đã có tài khoản Sentry (đang sử dụng cho Bella ERP web)
- ✅ Quyền admin trên organization Sentry
- ✅ Máy tính có thể truy cập https://sentry.io

---

## Bước 1: Tạo Project "Bella Mobile" trong Sentry

### 1.1. Đăng nhập vào Sentry Dashboard

1. Truy cập: https://sentry.io
2. Đăng nhập với tài khoản hiện tại (đang dùng cho Bella ERP)
3. Chọn organization của bạn

### 1.2. Tạo Project mới

1. Click nút **"Create Project"** (góc trên bên phải)
2. Chọn platform: **"React Native"**
3. Đặt tên project: `bella-mobile`
4. Chọn team: Default (hoặc team phù hợp)
5. Click **"Create Project"**

### 1.3. Copy DSN (Data Source Name)

Sau khi tạo project, Sentry sẽ hiển thị trang setup. Bạn cần copy **DSN**.

**DSN có format**:
```
https://[hash]@[region].ingest.sentry.io/[project-id]
```

**Ví dụ**:
```
https://abc123def456ghi789jkl012@o123456.ingest.sentry.io/7890123
```

**Cách tìm lại DSN nếu đóng trang**:
1. Vào project "bella-mobile"
2. Click **Settings** (bánh răng)
3. Chọn **Client Keys (DSN)**
4. Copy DSN từ đây

---

## Bước 2: Cấu hình DSN trong Mobile App

### 2.1. Tạo file `.env.local`

Mở terminal tại thư mục `apps/mobile/` và chạy:


```bash
cd apps/mobile
cp .env.example .env.local
```

### 2.2. Cập nhật `.env.local` với DSN thực

Mở file `apps/mobile/.env.local` và thay thế placeholder bằng DSN thực:

**Trước**:
```env
EXPO_PUBLIC_SENTRY_DSN=https://[hash]@[region].ingest.sentry.io/[project-id]
EXPO_PUBLIC_ENV=development
```

**Sau** (thay bằng DSN thật từ Bước 1.3):
```env
EXPO_PUBLIC_SENTRY_DSN=https://abc123def456ghi789jkl012@o123456.ingest.sentry.io/7890123
EXPO_PUBLIC_ENV=development
```

**⚠️ LƯU Ý**:
- File `.env.local` đã được thêm vào `.gitignore` → KHÔNG bị commit lên Git
- DSN **KHÔNG** phải secret key, nhưng vẫn nên giữ trong `.env.local`
- Khi deploy production, thay `development` → `production`

---

## Bước 3: Khởi động lại Expo Dev Server

Expo cần restart để load environment variables mới.

### 3.1. Dừng server hiện tại

Nếu Expo dev server đang chạy:
- Nhấn `Ctrl + C` trong terminal để dừng

### 3.2. Khởi động lại

```bash
cd apps/mobile
npm start
```

Hoặc nếu dùng `npm run dev`:
```bash
npm run dev
```

### 3.3. Reload app trên thiết bị/emulator

- **iOS Simulator**: Nhấn `Cmd + R` hoặc `i` trong Expo terminal
- **Android Emulator**: Nhấn `Cmd + M` (Mac) hoặc `Ctrl + M` (Windows) → Reload
- **Device thật**: Lắc điện thoại → Reload


---

## Bước 4: Verify Sentry Integration

### 4.1. Mở app và đăng nhập

1. Mở Bella Mobile trên emulator/device
2. Đăng nhập với tài khoản KTV hoặc Admin

### 4.2. Vào trang Profile

1. Nhấn vào tab **"Cá nhân"** (Profile) ở bottom navigation
2. Scroll xuống phần **"Thông tin kỹ thuật"**

### 4.3. Test Sentry

1. Nhấn nút **"🧪 Test Sentry Integration"** (chỉ hiển thị trong dev mode)
2. Confirm dialog: Nhấn **"Test"**
3. Bạn sẽ thấy alert: **"✅ Đã gửi test error đến Sentry"**

### 4.4. Kiểm tra Sentry Dashboard

1. Trở lại https://sentry.io
2. Vào project **"bella-mobile"**
3. Click tab **"Issues"**
4. Chờ 1-2 phút, bạn sẽ thấy:
   - **Issue mới**: "Sentry test exception - This is intentional for testing"
   - **Message**: "Sentry test message from Bella Mobile"

**Nếu thấy 2 events trên → ✅ Sentry đã hoạt động!**

---

## Bước 5: Cấu hình Dashboard và Alerts (Tùy chọn)

### 5.1. Tạo Alert Rule cho Crash Rate

1. Vào project "bella-mobile"
2. Click **Alerts** → **Create Alert**
3. Chọn: **"Issues"**
4. Thiết lập:
   - **When**: An event is seen
   - **If**: The issue is first seen OR the issue changes state
   - **Then**: Send a notification to: [Your email hoặc Slack]
5. Save alert

### 5.2. Cấu hình Performance Monitoring

1. Vào **Settings** → **Projects** → **bella-mobile**
2. Click **Performance**
3. Enable: **Performance Monitoring**
4. Transaction Rate: Để mặc định (đã set 20% trong code)

### 5.3. Cấu hình Release Tracking (Tùy chọn - Week 4+)

Sẽ được cấu hình sau khi có CI/CD pipeline.


---

## Troubleshooting

### ❌ Không thấy nút "Test Sentry" trong Profile

**Nguyên nhân**: Nút chỉ hiển thị trong dev mode (`__DEV__ === true`)

**Giải pháp**:
- Đảm bảo chạy `npm start` hoặc `npm run dev`, KHÔNG phải production build
- Reload app: `Cmd + R` (iOS) hoặc `Ctrl + M` → Reload (Android)

### ❌ Console hiển thị "Sentry DSN not configured"

**Nguyên nhân**: File `.env.local` chưa có hoặc chưa được load

**Giải pháp**:
1. Kiểm tra file `apps/mobile/.env.local` có tồn tại không
2. Kiểm tra DSN có đúng format không (bắt đầu bằng `https://`)
3. Restart Expo dev server (`Ctrl + C` → `npm start`)
4. Reload app

### ❌ Test button bị lỗi "testSentry is not a function"

**Nguyên nhân**: Import bị thiếu hoặc Expo cache

**Giải pháp**:
```bash
cd apps/mobile
rm -rf node_modules/.cache
npm start --clear
```

### ❌ Không thấy events trong Sentry Dashboard sau 5 phút

**Nguyên nhân**: DSN sai hoặc network bị block

**Giải pháp**:
1. Kiểm tra DSN trong `.env.local` có khớp với Sentry dashboard không
2. Kiểm tra network: `curl https://sentry.io`
3. Kiểm tra Expo console có lỗi network không
4. Thử gửi lại: Nhấn test button 1 lần nữa

### ❌ App bị crash ngay khi mở

**Nguyên nhân**: Sentry init có lỗi (hiếm gặp)

**Giải pháp**:
1. Tạm thời comment dòng `initSentry()` trong `apps/mobile/app/_layout.tsx`
2. Reload app
3. Kiểm tra DSN format trong `.env.local`
4. Uncomment lại và test


---

## Checklist Hoàn Thành

Đánh dấu ✅ khi hoàn thành từng bước:

- [ ] Bước 1: Đã tạo project "bella-mobile" trong Sentry
- [ ] Bước 1: Đã copy DSN từ Sentry dashboard
- [ ] Bước 2: Đã tạo file `.env.local` với DSN thực
- [ ] Bước 3: Đã restart Expo dev server
- [ ] Bước 4: Đã test Sentry bằng nút "🧪 Test Sentry Integration"
- [ ] Bước 4: Đã thấy test error xuất hiện trong Sentry dashboard
- [ ] Bước 5: (Tùy chọn) Đã cấu hình alert rules

**✅ Khi hoàn thành tất cả → Sentry integration READY cho Pilot!**

---

## Những gì đã được tích hợp sẵn trong code

Bạn **KHÔNG CẦN** làm gì thêm cho các tính năng sau (đã được code sẵn):

### ✅ 1. Automatic Crash Reporting
- Mọi crash/exception trong app đều tự động gửi đến Sentry
- Bao gồm: JavaScript errors, Promise rejections, Native crashes

### ✅ 2. Performance Monitoring
- Tự động track performance của:
  - `useDashboardStats` hook (load KPI)
  - `useTodaySessions` hook (load danh sách ca)
- Metrics: Response time, error rate, span duration

### ✅ 3. Error Boundaries
- Khi app crash, hiển thị màn hình lỗi thân thiện (tiếng Việt)
- User có thể reload app mà không cần force quit
- Error ID được hiển thị để support team tra cứu

### ✅ 4. User Context Tracking
- Sau khi login, Sentry tự động lưu:
  - User ID
  - Email
  - Role (KTV/Admin)
  - Tenant ID
- Khi có lỗi, bạn biết chính xác user nào gặp vấn đề

### ✅ 5. Breadcrumbs (Debug Trail)
- Sentry tự động ghi lại:
  - Navigation events (user đi trang nào)
  - API calls (fetch dashboard stats, fetch sessions)
  - User actions (tap, scroll)
  - Console logs (với sensitive data redaction)

### ✅ 6. Environment-Aware
- Development mode: Lỗi được log ra console + gửi Sentry
- Production mode: Chỉ gửi Sentry, không spam console
- Sample rate: 100% (dev), 20% (prod) để tiết kiệm quota


---

## Next Steps sau khi Setup Sentry

### Ngay sau khi Verify (Day 0)

1. ✅ **Sentry hoạt động** → Chuyển sang Bước 2: Deploy RPC
2. 📄 Tham khảo: `PRE_WEEK_4_EXECUTION_CHECKLIST.md` (Section: Phase 1 - Deploy RPC)

### Trong Pilot (Day 1-7)

1. **Kiểm tra Sentry Dashboard hàng ngày**:
   - Số lượng crash/error mới
   - User nào bị ảnh hưởng nhiều nhất
   - Trang/màn hình nào có lỗi cao
2. **Tham khảo**: `PILOT_METRICS_DASHBOARD.md` (Section: Crash Log)

### Sau Pilot (Day 8+)

1. **Phân tích crash trends**
2. **Ưu tiên fix bugs dựa trên**:
   - Error frequency (số lần xảy ra)
   - User impact (số user bị ảnh hưởng)
   - Severity (crash vs warning)
3. **Release tracking**: Khi có Week 4, 5, 6... setup release versions

---

## Tài liệu tham khảo

- **Sentry Docs**: https://docs.sentry.io/platforms/react-native/
- **Expo + Sentry**: https://docs.expo.dev/guides/using-sentry/
- **Internal Docs**:
  - `SENTRY_INTEGRATION_GUIDE.md` (5-phase integration plan)
  - `WEEK_3_POST_REVIEW_ACTION_PLAN.md` (Sentry elevated to Phase 1)
  - `PILOT_METRICS_DASHBOARD.md` (Crash tracking section)

---

## Liên hệ hỗ trợ

Nếu gặp vấn đề trong quá trình setup:

1. Kiểm tra **Troubleshooting** section ở trên
2. Tham khảo Sentry Docs: https://docs.sentry.io/support/
3. Liên hệ DevOps/Tech Lead team

---

**Phiên bản**: 1.0 (Pre-Week 4 Phase 1)  
**Cập nhật lần cuối**: June 22, 2026  
**Tác giả**: Bella ERP Development Team

