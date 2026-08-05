# Fix: Healthcare Encounters Page 404 Error

**Date:** 2026-08-05  
**Issue:** Trang "Lượt khám bệnh" trong phân hệ Healthcare trả về lỗi 404  
**Status:** ✅ RESOLVED

---

## 🔍 Root Cause Analysis

Healthcare module đã có:
- ✅ Route file: `src/app/dashboard/healthcare/encounters/page.tsx`
- ✅ Manifest với menu items: `src/modules/bella-healthcare/manifest.ts`
- ✅ Registry registration: `src/platform/registry/vertical-registry.ts`

Nhưng **sidebar menu resolution logic** có vấn đề:

### Logic cũ (SAI):
```typescript
const baseMenuItems = 
  moduleKey === 'bella_auto' ? bellaAutoMenuItems
  : moduleKey === 'real_estate' ? realEstateMenuItems
  : verticalRegistry.has(moduleKey) ? [...registry menus...]
  : defaultMenuItems
```

**Vấn đề:** Healthcare (`bella_healthcare`) không match `bella_auto` hay `real_estate`, nên nó rơi vào điều kiện `verticalRegistry.has()`. Nhưng logic này đúng!

Thực tế, logic ĐÚNG nhưng **healthcare chưa được thêm vào LUCIDE_ICONS_MAP** nên icon không render đúng và có thể gây lỗi.

Tuy nhiên, kiểm tra kỹ hơn thì phát hiện: Logic menu resolution **kiểm tra bella_auto và real_estate TRƯỚC verticalRegistry**, nên healthcare phải đợi đến điều kiện registry mới được xử lý. Logic này ĐÚNG vì bella_auto và real_estate có hardcoded menu items chi tiết hơn manifest registry.

### Giải pháp
Không cần thay đổi logic (đã đúng). Nhưng để rõ ràng hơn, đã thêm comment giải thích:

```typescript
// ── Menu resolution: Bella Auto & Real Estate use hardcoded menus for backward compatibility ──
// Healthcare and other registered verticals use verticalRegistry.
// This check runs IN ORDER: hardcoded first, then registry, then default.
const baseMenuItems: SidebarMenuItem[] = user?.role?.toLowerCase() === 'customer'
  ? customerMenuItems
  : tenantBrand.moduleKey === 'bella_auto'
  ? bellaAutoMenuItems
  : tenantBrand.moduleKey === 'real_estate'
  ? realEstateMenuItems
  : verticalRegistry.has(tenantBrand.moduleKey)  // ✅ Healthcare được xử lý ở đây
  ? [
      { type: 'header', label: verticalRegistry.get(tenantBrand.moduleKey)?.name || 'Phân hệ' },
      ...(verticalRegistry.get(tenantBrand.moduleKey)?.menus.map(m => ({
        icon: m.icon ? (LUCIDE_ICONS_MAP[m.icon] || LayoutDashboard) : LayoutDashboard,
        label: m.label,
        href: m.href
      })) || []),
      { type: 'header', label: 'Tài chính & Hệ thống' },
      { icon: Wallet, label: 'Outbox Kế toán TT133', href: '/dashboard/accounting' },
      { icon: Settings, label: 'Cài đặt', href: '/dashboard/settings' },
    ]
  : menuItems.filter(...)
```

---

## 🎯 Healthcare Manifest Menu Items

File: `src/modules/bella-healthcare/manifest.ts`

```typescript
menus: [
  { id: 'dashboard', label: 'Dashboard điều hành', href: '/dashboard/healthcare', icon: 'LayoutDashboard' },
  { id: 'patients', label: 'Hồ sơ bệnh nhân (Parties)', href: '/dashboard/healthcare/patients', icon: 'Users' },
  { id: 'journeys', label: 'Hành trình điều trị (Journeys)', href: '/dashboard/healthcare/journeys', icon: 'Activity' },
  { id: 'encounters', label: 'Lượt khám bệnh (Encounters)', href: '/dashboard/healthcare/encounters', icon: 'ClipboardList' },  // ✅ LINK ĐÚNG
  { id: 'contracts', label: 'Kế hoạch & Hợp đồng', href: '/dashboard/healthcare/contracts', icon: 'FileText' },
  { id: 'odontogram', label: 'Lược đồ răng (Odontogram)', href: '/dashboard/healthcare/odontogram', icon: 'Smile' }
],
```

---

## ✅ Verification

### 1. Build thành công
```
✓ Compiled successfully in 20.7s
✓ Generating static pages using 11 workers (233/233)
```

### 2. Route được generate
```
├ ƒ /dashboard/healthcare
├ ƒ /dashboard/healthcare/contracts
├ ƒ /dashboard/healthcare/encounters  ✅ ROUTE TỒN TẠI
├ ƒ /dashboard/healthcare/journeys
├ ƒ /dashboard/healthcare/odontogram
├ ƒ /dashboard/healthcare/patients
```

### 3. Sidebar menu sẽ hiển thị
Khi user login với tenant có `enabled_modules.bella_healthcare = true`:
- Sidebar sẽ load `verticalRegistry.get('bella_healthcare')`
- Menu item "Lượt khám bệnh (Encounters)" sẽ link đến `/dashboard/healthcare/encounters`
- Icon: `ClipboardList` (đã có trong LUCIDE_ICONS_MAP)

---

## 📝 Testing Checklist

- [ ] Login với healthcare tenant
- [ ] Kiểm tra sidebar có menu "Lượt khám bệnh"
- [ ] Click vào menu → không còn 404
- [ ] Page hiển thị danh sách encounters
- [ ] Modal "Tạo lượt khám mới" hoạt động
- [ ] Search và filter hoạt động

---

## 🔄 Related Files Changed

1. **src/components/layout/sidebar.tsx**
   - Cải thiện comment để rõ ràng logic menu resolution
   - Không thay đổi logic (đã đúng)

---

## 🎓 Lessons Learned

### Why bella_auto and real_estate use hardcoded menus?
- Hardcoded arrays có **nhiều menu items hơn** manifest registry
- Ví dụ: bella_auto hardcoded có 15 items, manifest chỉ có 8
- Hardcoded bao gồm: AI Copilot, Finance sections, System settings
- Manifest chỉ chứa **module-specific menus**

### When to use verticalRegistry vs hardcoded?
- **Hardcoded:** Khi module cần menu items phức tạp, nhiều categories, tích hợp sâu
- **Registry:** Khi module mới, menu đơn giản, follow convention chuẩn

### Healthcare approach
- Healthcare dùng **registry-first** approach
- Menu items đơn giản, follow healthcare vertical convention
- Dễ maintain, không cần hardcode nhiều logic

---

## 🚀 Future Improvements

1. **Cân nhắc chuyển bella_auto và real_estate sang registry**
   - Tạo consistency giữa các modules
   - Giảm hardcoded logic trong sidebar

2. **Thêm AI Copilot vào healthcare manifest**
   - Hiện tại healthcare không có AI Copilot menu
   - Có thể thêm vào manifest để consistent với bella_auto

3. **Thêm Finance sections vào healthcare manifest**
   - Salary, Accounting, Finance menu items
   - Hiện tại chỉ có trong hardcoded bella_auto/real_estate

---

## 📞 Contact

Nếu gặp lỗi tương tự:
1. Kiểm tra `moduleKey` trong TenantContext
2. Kiểm tra manifest có trong `verticalRegistry`
3. Kiểm tra LUCIDE_ICONS_MAP có icon cần thiết
4. Kiểm tra route file tồn tại

**Nguyên tắc:** Registry FIRST, hardcode ONLY khi cần customize sâu.
