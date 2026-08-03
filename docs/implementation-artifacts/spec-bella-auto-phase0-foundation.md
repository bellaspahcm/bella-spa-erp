# Technical Specification: Bella Auto Phase 0 (Discovery & Foundation)

> **File Path:** `docs/implementation-artifacts/bella-auto-spec.md`  
> **Module Key:** `bella_auto`  
> **Trạng thái:** DRAFT  
> **Độ ưu tiên:** HIGH

---

## 1. Mục Tiêu & Ranh Giới Kỹ Thuật

Tài liệu này đặc tả chi tiết việc thiết lập hạ tầng cốt lõi cho phân hệ ô tô (**Bella Auto**) làm cơ sở để triển khai các Phase tiếp theo. 

Mọi cấu hình và cơ sở dữ liệu tạo ra trong Phase này phải tuân thủ tuyệt đối quy tắc **Zero Regression** (không làm gián đoạn, thay đổi hành vi hoặc rò rỉ dữ liệu của các tenant hoạt động cũ như Spa, Beauty Spa, và Bất động sản).

---

## 2. Thiết Kế Manifest & Đăng Ký Module

Chúng ta cần tạo manifest cho `bella_auto` tại `src/modules/bella-auto/manifest.ts`.

### 2.1 Cấu Trúc Manifest (`src/modules/bella-auto/manifest.ts`)
Manifest này kế thừa kiểu `VerticalManifest` từ `src/platform/registry/vertical-registry.ts`.

```typescript
import { VerticalManifest } from '../../platform/registry/vertical-registry';

export const bellaAutoManifest: VerticalManifest = {
  key: 'bella_auto',
  name: 'Bella Automotive Platform',
  version: '1.0.0',
  themeKey: 'bella_auto',
  defaultRoute: '/dashboard/bella-auto',
  enabledCapabilities: [
    'vehicle_center',
    'journey_center',
    'experience_center',
    'workflow_center',
    'audit',
    'organization_center'
  ],
  menus: [
    { id: 'dashboard', label: 'Dashboard điều hành', href: '/dashboard/bella-auto', icon: 'LayoutDashboard' },
    { id: 'vehicles', label: 'Quản lý kho xe', href: '/dashboard/bella-auto/vehicles', icon: 'Car' },
    { id: 'journey', label: 'Hành trình khách hàng', href: '/dashboard/bella-auto/journey', icon: 'GitCommit' },
    { id: 'experience', label: 'Experience Center', href: '/dashboard/bella-auto/experience', icon: 'Smile' },
    { id: 'leads', label: 'Quản lý Leads', href: '/dashboard/bella-auto/leads', icon: 'Target' },
    { id: 'sales', label: 'Quy trình bán hàng', href: '/dashboard/bella-auto/sales', icon: 'CircleDollarSign' },
    { id: 'workshop', label: 'Dịch vụ & Xưởng', href: '/dashboard/bella-auto/workshop', icon: 'Wrench' }
  ],
  providers: {
    // Sẽ được mở rộng trong các Phase tiếp theo
  }
};
```

### 2.2 Đăng Ký Manifest Vào Registry
Cần chỉnh sửa `src/platform/registry/vertical-registry.ts` để import và đăng ký `bellaAutoManifest`.

---

## 3. Thiết Kế Database Migrations (`auto_*`)

Trong Phase 0, chúng ta chỉ khởi tạo 3 bảng cơ bản phục vụ catalog ô tô.

### 3.1 Cấu Trúc Bảng
```sql
-- Bảng auto_brands (Thương hiệu xe)
CREATE TABLE public.auto_brands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name TEXT NOT NULL,
    country_of_origin TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Bảng auto_models (Dòng xe)
CREATE TABLE public.auto_models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    brand_id UUID NOT NULL REFERENCES public.auto_brands(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    segment TEXT, -- Sedan, SUV, Crossover, MPV, Hatchback...
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Bảng auto_variants (Phiên bản xe)
CREATE TABLE public.auto_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    model_id UUID NOT NULL REFERENCES public.auto_models(id) ON DELETE CASCADE,
    name TEXT NOT NULL, -- Ví dụ: LCI, xDrive, Luxury Line...
    year INTEGER NOT NULL,
    fuel_type TEXT, -- Gasoline, Diesel, EV, Hybrid...
    transmission TEXT, -- Automatic, Manual...
    specs_json JSONB DEFAULT '{}'::jsonb NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
```

### 3.2 Chính Sách Bảo Mật (Row Level Security - RLS)
Tất cả các bảng trên phải kích hoạt RLS và áp dụng chính sách lọc theo `tenant_id`.

```sql
-- Kích hoạt RLS
ALTER TABLE public.auto_brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auto_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auto_variants ENABLE ROW LEVEL SECURITY;

-- Tạo chính sách phân quyền (Ví dụ cho auto_brands)
CREATE POLICY auto_brands_tenant_isolation ON public.auto_brands
    FOR ALL
    USING (tenant_id = (SELECT get_auth_tenant_id())); -- hoặc qua JWT claim/claims map
```

---

## 4. Routing & Giao Diện Isolated

Để không đụng vào luồng dashboard chính của Bella Spa (`/dashboard`), Bella Auto sẽ sử dụng route cô lập `/dashboard/bella-auto`.

### 4.1 Cấu Trúc File Hệ Thống Route
```
src/app/dashboard/bella-auto/
├── layout.tsx                  # Thiết lập App Shell, tenant/brand checking
├── page.tsx                    # Trang chỉ số tổng quan (Placeholder)
├── vehicles/
│   └── page.tsx                # Danh mục xe (Placeholder)
```

### 4.2 CSS Theme Scoping
Để tránh rò rỉ mã màu (ví dụ màu hồng của Spa hay màu xanh dương của Bất Động Sản rò rỉ sang Ô tô), tất cả các màu sắc chủ đạo của Bella Auto phải nằm dưới selector `html[data-tenant-module="bella_auto"]`.

```css
html[data-tenant-module="bella_auto"] {
  --primary: 215 45% 10%;        /* Deep Navy (#0A1628) */
  --primary-hover: 215 45% 15%;
  --accent: 40 45% 56%;          /* Gold (#C0A060) */
  --background: 210 20% 98%;     /* Off White */
  --card: 0 0% 100%;
  --text-primary: 215 45% 10%;
}
```

---

## 5. Kịch Bản Kiểm Thử & Xác Minh (Verification Suite)

Chúng ta cần có bộ kiểm thử để chạy tự động trên môi trường phát triển và CI/CD.

```typescript
// src/__tests__/auto-module-isolation.test.ts (Draft)
describe("Bella Auto Module & Tenant Isolation", () => {
  it("should block spa tenants from viewing auto brands", async () => {
    // Đăng nhập với tư cách spa tenant
    // Query auto_brands
    // Xác nhận kết quả trả về là rỗng (Empty array) hoặc Permission Denied.
  });

  it("should successfully isolate two auto tenants", async () => {
    // Tạo 2 auto tenants khác nhau: tenantA và tenantB
    // Chèn brand vào tenantA
    // Đăng nhập với tenantB và xác nhận không tìm thấy brand của tenantA.
  });
});
```

---

*Tài liệu đặc tả kỹ thuật này được sử dụng làm tài liệu định hướng cho quá trình phát triển Phase 0.*
