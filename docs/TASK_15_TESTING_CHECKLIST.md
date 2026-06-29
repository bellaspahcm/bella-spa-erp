# Task 15: ProductSaleRow Component - Testing Checklist

## Component Features

- ✅ Main row layout (desktop: 7 columns, mobile: stacked)
- ✅ Expandable details with smooth animation (framer-motion)
- ✅ Status badges (completed/pending/cancelled/refunded)
- ✅ Action buttons (Edit/Delete)
- ✅ Product info, quantity, amount, commission display
- ✅ KTV and customer info in expanded view
- ✅ Commission details with override indication
- ✅ Payment method and sale date
- ✅ Notes section
- ✅ Hover effects and responsive design

## Testing Checklist

### 1. Component Rendering

- [ ] Component renders without errors when given valid props
- [ ] Desktop layout shows 7 columns correctly
- [ ] Mobile layout shows stacked card format
- [ ] Product info displays name, category, SKU correctly
- [ ] Status badge shows correct color and label for each status
- [ ] Icons render correctly (ShoppingCart, User, Calendar, etc.)

### 2. Status Display

- [ ] `completed` status → green badge "Hoàn thành"
- [ ] `pending` status → amber badge "Chờ xử lý"
- [ ] `cancelled` status → red badge "Đã hủy"
- [ ] `refunded` status → slate badge "Đã hoàn tiền"

### 3. Payment Method Display

- [ ] `cash` → "Tiền mặt"
- [ ] `bank_transfer` → "Chuyển khoản"
- [ ] `zalo_pay` → "ZaloPay"
- [ ] `momo` → "MoMo"
- [ ] `card` → "Thẻ"

### 4. Expand/Collapse Animation

- [ ] Click on row expands details section
- [ ] ChevronDown icon rotates 180° when expanded
- [ ] Smooth height animation (framer-motion)
- [ ] Click again collapses details
- [ ] Multiple rows can be expanded independently

### 5. Expandable Details Content

- [ ] KTV name and "Kỹ thuật viên" label
- [ ] Customer name and "Khách hàng" label (if exists)
- [ ] Sale date formatted as "dd/MM/yyyy HH:mm"
- [ ] Payment method label
- [ ] Product details: quantity x unit price
- [ ] Commission amount with "đ" suffix
- [ ] Override commission indicator (if enabled)
- [ ] Notes section (if exists)

### 6. Commission Override Display

- [ ] When `override_commission_enabled = true`:
  - [ ] Shows amber "Tùy chỉnh" label in main row
  - [ ] Shows override type and value in details (fixed/percentage)
- [ ] When `override_commission_enabled = false`:
  - [ ] Shows "Hoa hồng mặc định" in details

### 7. Action Buttons

- [ ] Edit button shows Pencil icon
- [ ] Edit button hover → emerald color
- [ ] Edit button calls `onEdit(sale)` prop
- [ ] Delete button shows Trash2 icon
- [ ] Delete button hover → red color
- [ ] Delete button shows confirmation dialog
- [ ] Delete button calls `onDelete(saleId)` prop after confirmation

### 8. Disabled State

- [ ] When `disabled = true`:
  - [ ] Component opacity reduced to 50%
  - [ ] Pointer events disabled
  - [ ] Edit/Delete buttons not clickable
  - [ ] Expand/collapse not working

### 9. Number Formatting

- [ ] Quantity displays as integer
- [ ] Unit price shows "toLocaleString('vi-VN')" format
- [ ] Total amount shows "toLocaleString('vi-VN') đ"
- [ ] Commission amount shows "toLocaleString('vi-VN') đ"

### 10. Mobile Responsive Behavior

- [ ] Desktop (≥768px): Grid layout with 7 columns
- [ ] Mobile (<768px): Stacked card layout
- [ ] Touch targets are large enough on mobile
- [ ] Action buttons show labels on mobile ("Sửa", "Xóa")

### 11. Accessibility

- [ ] Row has `role="button"` attribute
- [ ] Row has `tabIndex={0}` for keyboard navigation
- [ ] Row has `aria-expanded` attribute
- [ ] Row has `aria-label` with product name
- [ ] Edit button has `aria-label="Chỉnh sửa"`
- [ ] Delete button has `aria-label="Xóa"`

### 12. Edge Cases

- [ ] Handles missing `product_category` gracefully
- [ ] Handles missing `product_sku` gracefully
- [ ] Handles missing `customer_name` gracefully
- [ ] Handles missing `notes` gracefully
- [ ] Handles very long product names (truncate)
- [ ] Handles very long category names (truncate)
- [ ] Handles zero commission amount
- [ ] Handles negative quantities (if applicable)

### 13. Integration with Parent Component

- [ ] Can be used in a list with `.map()` rendering
- [ ] `onEdit` prop receives full sale object
- [ ] `onDelete` prop receives sale ID string
- [ ] Component doesn't interfere with sibling rows

### 14. Build & Type Safety

- [x] ✅ Build passes with 0 TypeScript errors
- [x] ✅ All types are inline to avoid database migration dependency
- [ ] Component can be imported from parent without errors
- [ ] Props interface matches expected usage

## Integration Test Scenarios

### Scenario 1: Display Product Sales List

1. Create array of 5+ product sales with different statuses
2. Render ProductSaleRow for each item
3. Verify all rows display correctly
4. Click each row to expand/collapse
5. Verify details show correct data

### Scenario 2: Edit Product Sale

1. Render ProductSaleRow with `onEdit` prop
2. Click Edit button
3. Verify `onEdit` is called with full sale object
4. Verify object contains all expected fields

### Scenario 3: Delete Product Sale

1. Render ProductSaleRow with `onDelete` prop
2. Click Delete button
3. Verify confirmation dialog appears
4. Click "OK" in dialog
5. Verify `onDelete` is called with sale ID

### Scenario 4: Override Commission Display

1. Create sale with `override_commission_enabled: true`
2. Set `override_commission_type: 'fixed'` and `override_commission_value: 50000`
3. Verify "Tùy chỉnh" label shows in main row
4. Expand details
5. Verify shows "Tùy chỉnh: 50.000 đ"

1. Create sale with `override_commission_type: 'percentage'` and `override_commission_value: 15`
2. Expand details
3. Verify shows "Tùy chỉnh: 15%"

### Scenario 5: Responsive Layout

1. Render component in desktop viewport (1024px+)
2. Verify 7-column grid layout
3. Resize to mobile viewport (375px)
4. Verify stacked card layout
5. Verify action buttons show text labels on mobile

## Manual Testing Notes

**Prerequisites:**
- `product_sales` table must exist in database
- Sample data should include all 4 statuses
- Sample data should include both override and default commission records

**Test Data Examples:**

```typescript
// Completed sale with default commission
{
  id: '1',
  ktv_id: 'ktv-1',
  customer_id: 'cust-1',
  product_name: 'Serum Vitamin C',
  product_category: 'Chăm sóc da',
  product_sku: 'SER-VIT-C-30',
  quantity: 2,
  unit_price: 450000,
  total_amount: 900000,
  commission_amount: 90000,
  override_commission_enabled: false,
  override_commission_type: null,
  override_commission_value: null,
  payment_method: 'cash',
  sale_date: '2026-06-22T10:30:00',
  status: 'completed',
  notes: 'Khách hàng VIP',
  created_at: '2026-06-22T10:30:00',
  updated_at: '2026-06-22T10:30:00',
  ktv_name: 'Nguyễn Thị Lan',
  customer_name: 'Trần Thị Mai'
}

// Pending sale with override commission (fixed)
{
  id: '2',
  ktv_id: 'ktv-2',
  customer_id: null,
  product_name: 'Mặt nạ Collagen',
  product_category: 'Mặt nạ',
  product_sku: 'MASK-COL-10',
  quantity: 5,
  unit_price: 120000,
  total_amount: 600000,
  commission_amount: 50000,
  override_commission_enabled: true,
  override_commission_type: 'fixed',
  override_commission_value: 50000,
  payment_method: 'momo',
  sale_date: '2026-06-22T14:00:00',
  status: 'pending',
  notes: null,
  created_at: '2026-06-22T14:00:00',
  updated_at: '2026-06-22T14:00:00',
  ktv_name: 'Lê Văn Tuấn',
  customer_name: null
}

// Cancelled sale with override commission (percentage)
{
  id: '3',
  ktv_id: 'ktv-1',
  customer_id: 'cust-2',
  product_name: 'Sữa rửa mặt Foam',
  product_category: 'Làm sạch',
  product_sku: 'CLN-FOAM-150',
  quantity: 1,
  unit_price: 250000,
  total_amount: 250000,
  commission_amount: 37500,
  override_commission_enabled: true,
  override_commission_type: 'percentage',
  override_commission_value: 15,
  payment_method: 'zalo_pay',
  sale_date: '2026-06-22T16:00:00',
  status: 'cancelled',
  notes: 'Khách hàng hủy đơn sau 1 giờ',
  created_at: '2026-06-22T16:00:00',
  updated_at: '2026-06-22T17:00:00',
  ktv_name: 'Nguyễn Thị Lan',
  customer_name: 'Phạm Văn Hùng'
}
```

## Success Criteria

All checkboxes in sections 1-14 must be checked before marking Task 15 complete.

## Known Limitations

- Component uses inline types (not from database.types) because `product_sales` table doesn't exist yet
- After running migration `20260622164000_create_product_sales.sql`, should update types to use `Database['public']['Tables']['product_sales']['Row']`
- Server actions in `product-sales-actions.ts` are commented out and need to be uncommented after migration
