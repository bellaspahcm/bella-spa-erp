# VIP Custom UX/UI Development Playbook

Tài liệu này hướng dẫn cách xây dựng một giao diện (UI/UX) hoàn toàn mới cho khách hàng cao cấp (VIP) hoặc các ngành đặc thù mới mà vẫn tái sử dụng 100% Core ERP của hệ thống (Database, Row-Level Security, Accounting Ledger Engine, Salary & Commissions Engine, Inventory Management, v.v.).

---

## 1. Thiết Kế Hệ Thống: Core ERP vs Custom Shell

Để đảm bảo khả năng nâng cấp hệ thống (maintanability) và không phá hỏng code của nhau khi cập nhật lõi ERP, chúng ta chia giao diện làm 2 lớp:
- **Lớp Nhân (ERP Core Service Actions)**: Chứa toàn bộ các xử lý nghiệp vụ, DB queries, security check, accounting logic và data payload.
- **Lớp Vỏ (Custom Shell UI)**: Chứa layout, sidebar, components, pages và CSS của phân hệ mới.

```
┌──────────────────────────────────────────────────────────┐
│  LAYER 3 — SHELL / CUSTOM UX / UI (Tự do thiết kế 100%) │
│  Layout, Navigation, Pages, Components, CSS              │
│  → Tạo Route Group mới, Layout mới, Components mới       │
├──────────────────────────────────────────────────────────┤
│  LAYER 2 — BUSINESS ACTIONS (Tái sử dụng ~80% - 90%)     │
│  Server Actions, Services, Vocabulary, Permissions       │
│  → Gọi lại trực tiếp từ Shell mới, không viết lại SQL    │
├──────────────────────────────────────────────────────────┤
│  LAYER 1 — CORE / DATABASE (Tái sử dụng 100%)            │
│  Supabase Table Schema, RLS, Accounting Ledger, Salary   │
│  → Dùng chung tuyệt đối, bảo mật tuyệt đối ở DB level   │
└──────────────────────────────────────────────────────────┘
```

---

## 2. Các Bước Triển Khai Cho Ngành VIP Mới

### Bước 1: Khai báo Module Key và Đăng ký Tenant

1. Thêm key nhận diện ngành mới (ví dụ: `clinic` hoặc `vip_retail`) vào:
   - [tenant-modules.ts](file:///d:/Antigravity/Projects/BELLA%20SPA%20ERP/src/lib/business-rules/tenant-modules.ts) trong mảng `TENANT_MODULE_KEYS`.
2. Tạo preset theme thương hiệu mặc định (màu sắc, bo góc, kiểu menu) trong hàm `getDefaultTenantBrandThemeForModule` và định nghĩa hiển thị tương ứng ở `resolveTenantBrandIdentity`.

### Bước 2: Thiết lập Route Group & Shell Layout Riêng biệt

Để tránh xung đột code, không đặt trang mới dưới `/src/app/dashboard/...` (vốn đang dùng sidebar cũ của Bella Spa). Thay vào đó, tạo **Route Group** riêng trong Next.js:

```
src/app/
├── (dashboard)/                ← Shell cũ (Bella / Beauty / Cleaning)
│   └── dashboard/
│       ├── layout.tsx          ← Sidebar cũ
│       └── bookings/page.tsx
│
└── (vip-custom)/               ← Route Group cho giao diện VIP mới
    ├── layout.tsx              ← LAYOUT SHELL MỚI 100% (Top Nav, Canvas...)
    └── vip/                    ← Base path của giao diện VIP
        ├── page.tsx            ← Dashboard hoàn toàn mới
        ├── services/page.tsx   ← UI quản lý dịch vụ mới
        ├── scheduler/page.tsx  ← Lịch hẹn kiểu kéo thả (Drag-drop) mới
        └── settings/page.tsx
```

*Lợi ích:* Layout của `(vip-custom)` sẽ độc lập hoàn toàn với `(dashboard)`. Bạn có thể thay đổi vị trí menu (Top Nav, Bottom Bar cho mobile), font chữ, cấu trúc sidebar mà không sợ ảnh hưởng đến các Spa hiện tại.

### Bước 3: Tạo File CSS Riêng cho Shell Mới

Không viết đè CSS của VIP vào `globals.css` chung dưới dạng Selector toàn cục. Hãy tạo một file CSS cô lập:

1. Tạo file `/src/app/globals-vip.css`.
2. Import file này vào `/src/app/(vip-custom)/layout.tsx`.
3. Hoặc sử dụng CSS Modules (`*.module.css`) cho từng component riêng của VIP.
4. Chỉ áp dụng các CSS biến thể vào thẻ `html` có thuộc tính chính xác:
   ```css
   html[data-tenant-module="vip_retail"] {
     /* Biến CSS màu sắc và font của riêng VIP */
     --primary: #10B981;
     --font-sans: 'Inter', sans-serif;
   }
   ```

### Bước 4: Tái sử dụng Business Logic qua Server Actions

Khi xây dựng các trang mới (ví dụ: `/src/app/(vip-custom)/vip/services/page.tsx`), **không truy vấn trực tiếp cơ sở dữ liệu từ client component**, mà hãy gọi các Server Actions hoặc Services đã có sẵn của ERP:

```tsx
// Ví dụ sử dụng Server Action có sẵn để đồng bộ và hiển thị gói dịch vụ
import { getTenantPackages } from '@/services/accounting-actions';

export default async function VIPServicesPage() {
  // Lấy dữ liệu đã được tự động áp RLS và Tenant Isolation
  const packages = await getTenantPackages(); 
  
  return (
    <VIPCustomTable data={packages} /> // Truyền data vào UI mới
  );
}
```

---

## 3. Quản lý Từ vựng (Vocabulary System)

Khi một ngành mới xuất hiện, thuật ngữ sẽ thay đổi (Ví dụ: Spa gọi là "Kỹ thuật viên - KTV", Clinic gọi là "Bác sĩ / Y tá", Cleaning gọi là "Nhân viên vệ sinh - NVS").

Tái sử dụng hệ thống từ vựng linh hoạt bằng cách khai báo ánh xạ trong:
- [module-vocabulary.ts](file:///d:/Antigravity/Projects/BELLA%20SPA%20ERP/src/lib/business-rules/module-vocabulary.ts)

```typescript
export const MODULE_VOCABULARY = {
  babycare: {
    worker: { singular: 'Kỹ thuật viên', plural: 'Kỹ thuật viên', short: 'KTV' },
    customer: { singular: 'Khách hàng', plural: 'Khách hàng' }
  },
  clinic: {
    worker: { singular: 'Bác sĩ', plural: 'Bác sĩ', short: 'Bác sĩ' },
    customer: { singular: 'Bệnh nhân', plural: 'Bệnh nhân' }
  }
};
```
Sử dụng hook `useModuleVocabulary()` ở UI component để nhãn hiển thị tự động thay đổi theo tenant đăng nhập.

---

## 4. Quy Trình Kiểm Thử & Chống Lỗi Regression (Phòng Tránh Phá Hỏng Giao Diện Cũ)

Khi viết giao diện mới, luôn phải bảo vệ giao diện của các khách hàng cũ:

1. **Không can thiệp vào các Shared Components**: Nếu cần chỉnh sửa các component dùng chung như `<Sidebar />`, `<Navbar />` hay `<Button />` để phục vụ giao diện VIP, hãy **nhân bản** chúng ra thành phiên bản riêng (ví dụ: `<VIPButton />`, `<VIPSidebar />`) hoặc sử dụng biến thể (variants).
2. **Kiểm tra Production Build**:
   ```powershell
   npm run build
   ```
3. **Chạy các bài kiểm thử cô lập**:
   ```powershell
   npm.cmd test -- src/__tests__/industrial-cleaning-module-isolation.test.ts
   npm.cmd test -- src/__tests__/reconciliation.test.ts
   ```
4. **Viết thêm 1 file kiểm thử cô lập mới cho ngành VIP** (Ví dụ: `src/__tests__/clinic-module-isolation.test.ts`) để đảm bảo không có rò rỉ dữ liệu chéo (data leakage) giữa tenant thường và tenant VIP.

---

## 5. Đánh Giá Ưu & Nhược Điểm

### Ưu điểm
- **Tốc độ phát triển**: Rút ngắn 80% thời gian vì không cần xây dựng lại DB schema, API, logic tính lương, đối soát tài chính, kế toán.
- **Tính nhất quán**: Dữ liệu tài chính luôn đi qua Accounting Outbox một cách chính xác theo chuẩn TT133.
- **An toàn bảo mật**: Kế thừa hoàn toàn cơ chế bảo mật cấp cơ sở dữ liệu (RLS) của Supabase.

### Nhược điểm
- **Phụ thuộc cấu trúc bảng**: Giao diện mới vẫn phải liên kết với các thực thể cốt lõi (`bookings`, `session_logs`, `revenue`, `expenses`). Nếu nghiệp vụ VIP có các thực thể hoàn toàn dị biệt (ví dụ: "Toa thuốc clinic"), ta buộc phải viết thêm bảng mới có liên kết khóa ngoại chứ không thể dùng hoàn toàn bảng cũ.
