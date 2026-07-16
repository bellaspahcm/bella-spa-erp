# Feature: Add Product Sales Tab to Inventory Page

**Date**: July 15, 2026  
**Issue**: User navigates to "Kho & Bán hàng" menu but only sees inventory management (stock, requests, reconciliation), no product sales section  
**Solution**: Added "Bán hàng sản phẩm" tab to integrate ProductSalesListPage into Inventory page

---

## Problem Description

**User Experience Issue**:
- Menu label: "Kho & Bán hàng" (Inventory & Sales)
- Expected: Both inventory AND sales features
- Reality: Only 3 inventory-related tabs, no sales

**Existing Pages**:
- `/dashboard/inventory` - Inventory management (3 tabs)
- `/dashboard/product-sales` - Product sales page (NOT in menu, orphaned)

---

## Solution Implemented

### ✅ Added 4th Tab: "Bán hàng sản phẩm"

Integrated ProductSalesListPage as a tab within the Inventory page instead of keeping it as a separate page.

**New Tab Structure**:
1. 📦 **Tồn kho Chi nhánh** (Stock)
2. 🚚 **Yêu cầu cấp từ HQ** (Transfer Requests)
3. ✅ **Kiểm kê cuối tháng** (Reconciliation)
4. 🛒 **Bán hàng sản phẩm** (Product Sales) ← NEW

---

## Files Modified

### 1. `src/app/dashboard/inventory/types.ts`
**Change**: Added 'sales' to ActiveInventoryTab type

```typescript
// BEFORE
export type ActiveInventoryTab = 'stock' | 'requests' | 'reconciliation';

// AFTER
export type ActiveInventoryTab = 'stock' | 'requests' | 'reconciliation' | 'sales';
```

---

### 2. `src/app/dashboard/inventory/components/InventoryTabs.tsx`
**Changes**:
- Imported `ShoppingCart` icon from lucide-react
- Added 4th tab button for "Bán hàng sản phẩm"

```tsx
// Added import
import { ClipboardCheck, Package, ShoppingCart, Truck } from 'lucide-react';

// Added tab button
<button
  onClick={() => onChange('sales')}
  className={cn(
    'flex shrink-0 items-center gap-2 border-b-2 pb-4 text-xs font-black uppercase tracking-widest transition-all',
    activeTab === 'sales' ? 'border-primary text-primary' : 'border-transparent text-slate-400 hover:text-slate-600',
  )}
>
  <ShoppingCart className="w-4 h-4" /> Bán hàng sản phẩm
</button>
```

---

### 3. `src/app/dashboard/inventory/page.tsx`
**Changes**:
- Imported `ProductSalesListPage` component
- Added conditional rendering for 'sales' tab
- Sales tab uses full width (no sidebar) for better UX

```tsx
// Added import
import { ProductSalesListPage } from '@/components/product-sales/ProductSalesListPage';

// Added conditional rendering
{activeTab === 'sales' ? (
  // Product Sales tab - full width, no sidebar
  <div className="w-full">
    <ProductSalesListPage />
  </div>
) : (
  // Other tabs with 2-column layout (main content + logs sidebar)
  <div className="grid grid-cols-1 gap-6 xl:grid-cols-3 xl:gap-10">
    {/* Stock, Requests, Reconciliation panels */}
  </div>
)}
```

---

## Design Decisions

### ✅ Why Full Width for Sales Tab?
ProductSalesListPage has its own internal layout with:
- Filter panel
- Stats cards
- Data table with pagination
- Modal for creating/editing sales

→ Needs full width for optimal UX (cramping it in 2/3 layout would be poor UX)

### ✅ Why Not Add Sales to Sidebar Menu Separately?
- Clutters navigation (more menu items = harder to find)
- User expects sales to be WITH inventory (natural workflow: sell product → update inventory)
- Matches menu label promise: "Kho & Bán hàng" = both features in one place

### ✅ Why Keep `/dashboard/product-sales` Page?
Left it intact for backward compatibility:
- Direct links might exist in bookmarks/external docs
- Can add redirect later if needed
- No harm in having both routes point to same functionality

---

## User Experience Improvements

### Before
```
Menu: "Kho & Bán hàng" → Click
Page: Shows only 3 inventory tabs
User: "Bán hàng ở đâu?" 🤔
```

### After
```
Menu: "Kho & Bán hàng" → Click
Page: Shows 4 tabs including "Bán hàng sản phẩm" ✅
User: Clicks 4th tab → Sees product sales page 🎉
```

---

## Testing

### ✅ Build Verification
```bash
npm run build
```
**Result**: ✅ Success (Exit Code: 0)

### Manual Testing Checklist
- [ ] Navigate to `/dashboard/inventory`
- [ ] See 4 tabs (Stock, Requests, Reconciliation, Sales)
- [ ] Click "Bán hàng sản phẩm" tab
- [ ] ProductSalesListPage renders correctly
- [ ] Can create/edit/delete product sales
- [ ] Tab switching works smoothly
- [ ] No layout issues (full width on sales tab)

---

## Future Enhancements (Optional)

### 1. Redirect Old Route
Add redirect from `/dashboard/product-sales` → `/dashboard/inventory?tab=sales`:

```tsx
// src/app/dashboard/product-sales/page.tsx
import { redirect } from 'next/navigation';

export default function ProductSalesPage() {
  redirect('/dashboard/inventory?tab=sales');
}
```

### 2. URL Query Param Sync
Update InventoryPage to read/write `?tab=sales` query param:

```tsx
// Sync activeTab with URL
const searchParams = useSearchParams();
const router = useRouter();

useEffect(() => {
  const tab = searchParams.get('tab');
  if (tab && ['stock', 'requests', 'reconciliation', 'sales'].includes(tab)) {
    setActiveTab(tab as ActiveInventoryTab);
  }
}, [searchParams]);

const handleTabChange = (tab: ActiveInventoryTab) => {
  setActiveTab(tab);
  router.push(`/dashboard/inventory?tab=${tab}`, { scroll: false });
};
```

Benefits:
- Shareable links to specific tabs
- Browser back/forward works
- Tab state preserved on page refresh

### 3. Mobile-Optimized Tab Switcher
Current tabs scroll horizontally on mobile (already implemented with `overflow-x-auto`), but could enhance:
- Add swipe gestures to switch tabs
- Show tab indicator dots on mobile
- Collapse tab labels to icons only on small screens

---

## Impact Assessment

### ✅ Benefits
1. **UX Consistency**: Menu label matches page content
2. **Reduced Cognitive Load**: All inventory+sales features in one place
3. **Better Workflow**: Natural flow from inventory to sales
4. **Cleaner Navigation**: No extra menu item needed

### ⚠️ Considerations
- **Page Load**: Sales tab imports ProductSalesListPage (adds ~10KB to bundle)
  - Mitigation: Already using dynamic imports for modals, page is client-side only
- **Layout Shift**: Sales tab uses full width vs other tabs use 2-column
  - Mitigation: Intentional design decision, better UX for sales table

---

## Rollback Plan

If issues arise, revert these 3 commits:

1. **types.ts**: Remove 'sales' from union type
2. **InventoryTabs.tsx**: Remove 4th tab button
3. **page.tsx**: Remove ProductSalesListPage import and conditional rendering

Time to rollback: ~2 minutes

---

## Conclusion

✅ **Feature Successfully Implemented**

User can now access product sales directly from "Kho & Bán hàng" page via the 4th tab. This solves the UX confusion and aligns the UI with user expectations set by the menu label.

**No Breaking Changes**: Existing inventory features unchanged, only additive change.

---

**Implemented By**: Kiro AI Agent  
**Verified**: Build passing, no TypeScript errors  
**Status**: ✅ Ready for QA testing
