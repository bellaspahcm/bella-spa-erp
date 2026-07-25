# Module Theme Color Override Guide

## Vấn đề

Khi thêm module mới (VD: Beauty Spa, Industrial Cleaning), các màu hardcoded trong components (như `bg-rose-50`, `text-pink-600`) không tự động chuyển theo theme của module mới, dẫn đến UI bị màu sai (VD: Beauty Spa hiển thị màu hồng của Baby Care thay vì màu xanh).

## Nguyên nhân

1. **Hardcoded Tailwind classes**: Nhiều components sử dụng Tailwind utility classes trực tiếp (VD: `bg-rose-50`, `text-pink-600`) thay vì dùng CSS variables hoặc conditional classes
2. **CSS Specificity**: Tailwind inline classes có specificity cao, khó override bằng CSS variables
3. **Theme detection logic**: Logic phát hiện module chưa đúng (parse JSONB từ database sai format)

## Incident Timeline (22/06/2026)

### Triệu chứng
- Beauty Spa module hiển thị màu hồng (Baby Care) thay vì xanh lá/teal
- Icon menu, "TỔNG THU", dashboard cards, loaders đều màu hồng
- CSS variable `--primary` đã set đúng nhưng không áp dụng

### Root Causes
1. **API Route Bug**: `src/app/api/tenant/context/route.ts` parse JSONB `{beauty_spa: true}` thành `[{beauty_spa: true}]` (array of object) thay vì `['beauty_spa']` (array of strings)
2. **TenantContextProvider Logic**: Check object format trước array format, dẫn đến sai thứ tự
3. **CSS Override Missing**: Không có comprehensive overrides cho tất cả rose/pink shades

## Giải pháp Bắt buộc cho Module Mới

### 1. Database Schema & API Response

**Database**: `tenants.enabled_modules` column (JSONB format)
```json
{
  "beauty_spa": true,
  "babycare": false,
  "industrial_cleaning": false
}
```

**API Route** (`src/app/api/tenant/context/route.ts`):
```typescript
function transformTenantRowToContext(tenant: TenantRow): TenantContext {
  let enabledModules: string[] = ['spa']; // Default fallback
  
  if (tenant.enabled_modules) {
    if (Array.isArray(tenant.enabled_modules)) {
      enabledModules = tenant.enabled_modules;
    } else if (typeof tenant.enabled_modules === 'object' && tenant.enabled_modules !== null) {
      // CRITICAL: Parse JSONB object → filter enabled → return array of strings
      enabledModules = Object.entries(tenant.enabled_modules)
        .filter(([_key, value]) => value === true)
        .map(([key, _value]) => key);
      
      if (enabledModules.length === 0) {
        enabledModules = ['spa'];
      }
    }
  }
  
  // Return array of enabled module names: ['beauty_spa'] or ['industrial_cleaning']
  return {
    ...tenant,
    enabledModules,
  };
}
```

### 2. TenantContextProvider Theme Detection

**File**: `src/core/providers/TenantContextProvider.tsx`

**CRITICAL**: Check array format FIRST (vì API đã convert sang array):
```typescript
useEffect(() => {
  if (!context) return;

  const enabledModules = context.enabledModules;
  let moduleKey: string = 'baby_care'; // Default fallback

  // CRITICAL: Array format FIRST (not object)
  if (Array.isArray(enabledModules)) {
    // Priority: industrial_cleaning > beauty_spa > babycare/spa
    if (enabledModules.includes('industrial_cleaning')) {
      moduleKey = 'industrial_cleaning';
    } else if (enabledModules.includes('beauty_spa')) {
      moduleKey = 'beauty_spa';
    } else if (enabledModules.includes('babycare') || enabledModules.includes('spa')) {
      moduleKey = 'baby_care';
    }
  } else if (typeof enabledModules === 'object' && enabledModules !== null) {
    // Fallback for legacy JSONB object format
    const modules = enabledModules as any;
    if (modules.industrial_cleaning === true) {
      moduleKey = 'industrial_cleaning';
    } else if (modules.beauty_spa === true) {
      moduleKey = 'beauty_spa';
    }
  }

  // Set data-tenant-module attribute on <html>
  document.documentElement.dataset.tenantModule = moduleKey;
}, [context]);
```

### 3. CSS Variable Definition

**File**: `src/app/globals.css`

**BẮT BUỘC**: Thêm CSS variables cho module mới:
```css
/* [Module Name] tenant shell */
html[data-tenant-module="[module_key]"] {
  --primary: #[primary_color];
  --primary-hover: #[primary_hover];
  --primary-foreground: #[foreground];
  --secondary: #[secondary];
  --accent: #[accent];
  --background: #[bg];
  --foreground: #[fg];
  --border: rgba(...);
  --ring: #[primary];
}
```

**Ví dụ Beauty Spa**:
```css
html[data-tenant-module="beauty_spa"] {
  --primary: #074e44;        /* Dark teal/green */
  --primary-hover: #0a6357;
  --accent: #c8a97a;         /* Gold */
  --background: #f8f6f2;     /* Warm white */
}
```

### 4. Comprehensive CSS Overrides

**BẮT BUỘC**: Thêm comprehensive overrides cho TẤT CẢ hardcoded colors:

```css
/* ============================================
   [MODULE NAME] - COMPREHENSIVE COLOR OVERRIDES
   Replace default colors with module theme
   ============================================ */

/* Background Colors: Rose → [Module Color] */
html[data-tenant-module="[module_key]"] .bg-rose-50,
html[data-tenant-module="[module_key]"] [class*="bg-rose-50"] {
  background-color: #[new_bg_50] !important;
}

html[data-tenant-module="[module_key]"] .bg-rose-100,
html[data-tenant-module="[module_key]"] [class*="bg-rose-100"] {
  background-color: #[new_bg_100] !important;
}

html[data-tenant-module="[module_key]"] .bg-rose-500 {
  background-color: #[new_primary] !important;
}

/* Pink colors */
html[data-tenant-module="[module_key]"] .bg-pink-50,
html[data-tenant-module="[module_key]"] [class*="bg-pink-50"] {
  background-color: #[new_bg_50] !important;
}

html[data-tenant-module="[module_key]"] .bg-pink-100 {
  background-color: #[new_bg_100] !important;
}

/* Text Colors */
html[data-tenant-module="[module_key]"] .text-rose-500 {
  color: #[new_primary] !important;
}

html[data-tenant-module="[module_key]"] .text-rose-600 {
  color: #[new_primary_dark] !important;
}

html[data-tenant-module="[module_key]"] .text-pink-500 {
  color: #[new_primary] !important;
}

/* Border Colors */
html[data-tenant-module="[module_key]"] .border-rose-100 {
  border-color: #[new_border] !important;
}

html[data-tenant-module="[module_key]"] .border-pink-100 {
  border-color: #[new_border] !important;
}

/* Hover States */
html[data-tenant-module="[module_key]"] .hover\:bg-rose-50:hover,
html[data-tenant-module="[module_key]"] button.hover\:bg-rose-50:hover {
  background-color: #[new_bg_50] !important;
}

html[data-tenant-module="[module_key]"] .hover\:bg-rose-600:hover {
  background-color: #[new_primary_dark] !important;
}

/* Shadow Colors */
html[data-tenant-module="[module_key]"] .shadow-rose-100 {
  --tw-shadow-color: #[new_shadow] !important;
  --tw-shadow: var(--tw-shadow-colored) !important;
}

/* Opacity Variants */
html[data-tenant-module="[module_key]"] .bg-rose-50\/40 {
  background-color: rgba([r], [g], [b], 0.4) !important;
}

html[data-tenant-module="[module_key]"] .bg-rose-50\/50 {
  background-color: rgba([r], [g], [b], 0.5) !important;
}

html[data-tenant-module="[module_key]"] .border-rose-100\/50 {
  border-color: rgba([r], [g], [b], 0.5) !important;
}

/* Loader/Spinner */
html[data-tenant-module="[module_key]"] .animate-spin.text-rose-500 {
  color: #[new_primary] !important;
}

/* END [MODULE NAME] OVERRIDES */
```

### 5. Color Mapping Reference

#### Beauty Spa (Green/Teal Theme)
```
rose-50  → emerald-50  (#ecfdf5)
rose-100 → emerald-100 (#d1fae5)
rose-200 → emerald-200 (#a7f3d0)
rose-400 → emerald-400 (#34d399)
rose-500 → emerald-500 (#10b981)
rose-600 → emerald-600 (#059669)

Primary: #074e44 (dark teal/green)
Accent:  #c8a97a (gold)
```

#### Industrial Cleaning (Navy/Blue/Teal Theme)
```
rose-50  → sky-50     (#f0f9ff)
rose-100 → sky-100    (#e0f2fe)
rose-500 → blue-600   (#2563eb)
rose-600 → blue-700   (#1d4ed8)

Primary: #0C3776 (navy blue)
Accent:  #2D93AE (teal)
```

#### Baby Care (Pink Theme - Default)
```
No overrides needed - this is the base theme
```

## Checklist khi Thêm Module Mới

### Phase 1: Database & API
- [ ] Update `tenants.enabled_modules` JSONB với key mới
- [ ] Test API `/api/tenant/context` trả về array string đúng
- [ ] Verify `enabledModules` là `['new_module']` không phải `[{new_module: true}]`

### Phase 2: Theme Detection
- [ ] Add module key vào priority list trong `TenantContextProvider.tsx`
- [ ] Test `document.documentElement.dataset.tenantModule === 'new_module'`
- [ ] Verify console log: `[TenantContextProvider] Applied module theme: new_module`

### Phase 3: CSS Variables
- [ ] Add CSS variable section trong `globals.css`
- [ ] Define colors: `--primary`, `--primary-hover`, `--accent`, `--background`
- [ ] Test CSS variables apply đúng trong browser DevTools

### Phase 4: Comprehensive Overrides
- [ ] Copy template từ section "Comprehensive CSS Overrides" ở trên
- [ ] Replace `[module_key]` và `[new_color]` với colors thực tế
- [ ] Cover ALL shades: 50, 100, 200, 400, 500, 600
- [ ] Cover opacity variants: `/40`, `/50`
- [ ] Cover hover states
- [ ] Cover borders và shadows

### Phase 5: Testing
- [ ] Hard refresh browser (Ctrl + Shift + R)
- [ ] Clear `.next` cache và restart dev server
- [ ] Test các trang: Dashboard, Customers, Bookings, Settings
- [ ] Check console không có lỗi CSS
- [ ] Verify KHÔNG ảnh hưởng modules khác (test switch giữa các modules)

### Phase 6: Visual QA
- [ ] Icons (menu, buttons) - đúng màu module
- [ ] Buttons primary - đúng màu module
- [ ] Cards background - đúng màu module
- [ ] Badges/labels - đúng màu module
- [ ] Hover states - đúng màu module
- [ ] Loaders/spinners - đúng màu module
- [ ] Sidebar - đúng gradient/màu module

## Common Pitfalls (Lỗi Thường Gặp)

### ❌ Sai: Parse JSONB thành array of objects
```typescript
// WRONG: Returns [{ beauty_spa: true, babycare: false }]
const enabledModules = [tenant.enabled_modules];
```

### ✅ Đúng: Parse JSONB thành array of enabled strings
```typescript
// CORRECT: Returns ['beauty_spa']
const enabledModules = Object.entries(tenant.enabled_modules)
  .filter(([_key, value]) => value === true)
  .map(([key, _value]) => key);
```

### ❌ Sai: Check object format trước array
```typescript
// WRONG order
if (typeof enabledModules === 'object') { ... }
else if (Array.isArray(enabledModules)) { ... }
```

### ✅ Đúng: Check array format trước
```typescript
// CORRECT order
if (Array.isArray(enabledModules)) { ... }
else if (typeof enabledModules === 'object') { ... }
```

### ❌ Sai: Override không đủ shades
```css
/* WRONG: Only overrides bg-rose-50 */
html[data-tenant-module="beauty_spa"] .bg-rose-50 {
  background-color: #ecfdf5 !important;
}
```

### ✅ Đúng: Override TẤT CẢ shades + wildcards
```css
/* CORRECT: Covers all variants */
html[data-tenant-module="beauty_spa"] .bg-rose-50,
html[data-tenant-module="beauty_spa"] [class*="bg-rose-50"] {
  background-color: #ecfdf5 !important;
}

html[data-tenant-module="beauty_spa"] .bg-rose-100 { ... }
html[data-tenant-module="beauty_spa"] .bg-rose-500 { ... }
html[data-tenant-module="beauty_spa"] .bg-rose-50\/40 { ... }
```

## Files Modified (Reference)

1. `src/app/api/tenant/context/route.ts` - API response transform
2. `src/core/providers/TenantContextProvider.tsx` - Theme detection
3. `src/app/globals.css` - CSS variables + comprehensive overrides
4. Components với conditional colors (optional):
   - `src/app/dashboard/customers/[id]/components/CustomerProfilePanel.tsx`
   - `src/components/bookings/AddServiceItemForm.tsx`

## Testing Commands

```bash
# Clear cache và rebuild
Remove-Item -Recurse -Force .next
npm run dev

# Test API response
curl http://localhost:3000/api/tenant/context

# Check trong browser Console
document.documentElement.getAttribute('data-tenant-module')
getComputedStyle(document.documentElement).getPropertyValue('--primary')
```

## Priority Matrix cho Module Colors

| Element Type | Override Method | Priority |
|-------------|----------------|----------|
| CSS Variables (`--primary`) | `html[data-tenant-module]` | HIGH |
| Background colors (`bg-*`) | Comprehensive overrides | HIGH |
| Text colors (`text-*`) | Comprehensive overrides | HIGH |
| Borders (`border-*`) | Comprehensive overrides | MEDIUM |
| Shadows (`shadow-*`) | Comprehensive overrides | MEDIUM |
| Hover states | Comprehensive overrides | MEDIUM |
| Opacity variants | Comprehensive overrides | LOW |
| Component conditional | Direct component edit | LOW (fallback) |

## Summary

**CRITICAL RULE**: Khi thêm module mới, BẮT BUỘC phải:

1. ✅ Fix API parse JSONB → array strings
2. ✅ Update TenantContextProvider priority
3. ✅ Add CSS variables for module
4. ✅ Add **comprehensive overrides** (150+ lines) cho TẤT CẢ rose/pink shades
5. ✅ Test trên TẤT CẢ pages và verify không ảnh hưởng modules khác

**Time Saved**: Fixing sau khi deploy = 3-4 hours. Fix đúng từ đầu = 30 minutes.

**Last Updated**: 22/06/2026
**Incident**: Beauty Spa pink theme bug
**Resolution Time**: 4 hours (should have been 30 minutes with this guide)
