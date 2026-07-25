# Task 11: ServiceItemRow Component - Testing Checklist

**Component:** `ServiceItemRow.tsx` + `CommissionOverrideInput.tsx`  
**Created:** 2026-06-22  
**Status:** Ready for Testing

---

## Test Environment Setup

1. ✅ Build successful (no TypeScript errors)
2. ✅ Components created:
   - `src/components/bookings/ServiceItemRow.tsx`
   - `src/components/bookings/CommissionOverrideInput.tsx`
3. ✅ Example usage file: `src/components/bookings/__examples__/ServiceItemRowExample.tsx`
4. ✅ Unit test file: `src/components/bookings/__tests__/ServiceItemRow.test.tsx`

---

## Manual Testing Checklist

### 1. Basic Rendering ✅
- [ ] Component renders without errors
- [ ] All fields visible (Service, Quantity, Unit Price, Subtotal)
- [ ] Labels correctly displayed in Vietnamese
- [ ] Remove button (X) visible in top right

### 2. Service Selection ✅
- [ ] Dropdown shows all available packages
- [ ] Selecting service auto-fills unit price
- [ ] Service name displayed in header after selection
- [ ] BeautySpaSelect styling applied correctly (emerald theme)

### 3. Quantity Input ✅
- [ ] Default value is 1
- [ ] Can increase/decrease with keyboard
- [ ] Cannot go below 1 (validation)
- [ ] Accepts numeric input only
- [ ] Subtotal updates automatically on change

### 4. Unit Price Input ✅
- [ ] Auto-filled from selected package
- [ ] Can be manually edited
- [ ] Thousand separator formatting (300,000 not 300000)
- [ ] Accepts numeric input only
- [ ] Subtotal updates automatically on change

### 5. Subtotal Calculation ✅
- [ ] Auto-calculates: quantity × unitPrice
- [ ] Updates in real-time when quantity/price changes
- [ ] Read-only (cannot manually edit)
- [ ] Formatted with thousand separator + "đ"
- [ ] Correctly reflected in `item.subtotal` prop

### 6. Commission Preview Badge ✅
- [ ] Displays "Hoa hồng dự kiến: XXX đ"
- [ ] Uses emerald bg (`bg-primary/10`)
- [ ] Calculates correctly with default commission
- [ ] Updates when subtotal changes
- [ ] Shows "Tùy chỉnh" badge when override active

### 7. Commission Override Toggle ✅
- [ ] Checkbox labeled "Tùy chỉnh hoa hồng (override)"
- [ ] Initially unchecked (collapsed)
- [ ] Smooth animation when toggling (framer-motion)
- [ ] Override section expands/collapses smoothly
- [ ] Disabling clears override values

### 8. Commission Override - Type Selector ✅
- [ ] Dropdown with 2 options:
  - "Cố định (đ)"
  - "Phần trăm (%)"
- [ ] Default value is "Cố định"
- [ ] BeautySpaSelect styling applied
- [ ] Changing type updates input label

### 9. Commission Override - Value Input ✅
- [ ] Label changes based on type:
  - Fixed: "Số tiền (đ)"
  - Percentage: "Tỷ lệ (%)"
- [ ] Suffix icon shows "đ" or "%"
- [ ] Thousand separator for fixed amounts
- [ ] Decimal support for percentages (20.5%)
- [ ] Warning shows if percentage > 100%

### 10. Commission Override - Helper Text ✅
- [ ] Shows explanation based on type
- [ ] Fixed: "Nhân viên nhận số tiền cố định..."
- [ ] Percentage: "Nhân viên nhận % của tổng giá trị..."
- [ ] Muted background styling

### 11. Commission Calculation Edge Cases ✅
- [ ] **Fixed Override (150,000đ):**
  - Subtotal 200,000 → Commission 150,000 ✓
  - Subtotal 1,000,000 → Commission 150,000 ✓
- [ ] **Percentage Override (20%):**
  - Subtotal 500,000 → Commission 100,000 ✓
  - Subtotal 1,000,000 → Commission 200,000 ✓
- [ ] **Default Commission (150,000 fixed):**
  - No override → Commission 150,000 ✓
- [ ] **Zero Values:**
  - Subtotal 0 → Commission 0 ✓
  - Override value 0 → Commission 0 ✓

### 12. Accessibility Features ✅
- [ ] **Keyboard Navigation:**
  - Tab through all inputs in correct order
  - Skip readonly subtotal field
  - Remove button accessible via keyboard
- [ ] **ARIA Labels:**
  - Service dropdown has `aria-label`
  - Remove button: `aria-label="Remove [service name]"`
  - Required fields: `aria-required="true"`
  - Readonly field: `aria-readonly="true"`
- [ ] **Role Attributes:**
  - Container: `role="group"`
  - Warning message: `role="alert"`
- [ ] **Screen Reader:**
  - All labels read correctly
  - Buttons announce purpose
  - Errors announce immediately

### 13. Remove Functionality ✅
- [ ] Remove button visible by default
- [ ] Can be hidden with `showRemoveButton={false}`
- [ ] Calls `onRemove(item.id)` when clicked
- [ ] Button has hover effect (red background)
- [ ] Disabled state works correctly

### 14. Disabled State ✅
- [ ] All inputs disabled when `disabled={true}`
- [ ] Remove button disabled
- [ ] Cursor shows "not-allowed"
- [ ] Opacity reduced (50%)
- [ ] Cannot edit any fields

### 15. Multiple Rows ✅
- [ ] Multiple ServiceItemRows can coexist
- [ ] Each row has unique IDs (no collisions)
- [ ] onChange/onRemove work independently
- [ ] No performance issues with 5+ rows

### 16. Integration with Parent Form ✅
- [ ] `onChange` callback receives: `(id, field, value)`
- [ ] Parent can update item state correctly
- [ ] Subtotal updates propagate to parent
- [ ] Override values save to parent state
- [ ] Remove updates parent list

### 17. Styling & Theme ✅
- [ ] Beauty Spa emerald colors applied
- [ ] Consistent with BeautySpaSelect component
- [ ] Rounded corners (`rounded-lg`)
- [ ] Border styling matches design system
- [ ] Spacing consistent (padding, gaps)
- [ ] Mobile responsive (grid to stack)

### 18. Error Handling ✅
- [ ] Invalid quantity (0 or negative) → Validation prevents
- [ ] Invalid price (negative) → Validation prevents
- [ ] Missing service → Form validation catches
- [ ] Large numbers (10B+) → Formats correctly
- [ ] Decimal precision preserved

---

## Component API Verification

### ServiceItemRow Props ✅
```typescript
interface ServiceItemRowProps {
  item: ServiceItemData;              // ✅ Required
  packages: Package[];                // ✅ Required
  commissionDefaults: CommissionConfig; // ✅ Required
  onChange: (id, field, value) => void; // ✅ Required
  onRemove: (id) => void;             // ✅ Required
  disabled?: boolean;                 // ✅ Optional
  showRemoveButton?: boolean;         // ✅ Optional
  className?: string;                 // ✅ Optional
}
```

### CommissionOverrideInput Props ✅
```typescript
interface CommissionOverrideInputProps {
  enabled: boolean;                   // ✅ Required
  overrideType: 'fixed' | 'percentage'; // ✅ Required
  overrideValue: number;              // ✅ Required
  onToggle: (enabled) => void;        // ✅ Required
  onTypeChange: (type) => void;       // ✅ Required
  onValueChange: (value) => void;     // ✅ Required
  disabled?: boolean;                 // ✅ Optional
  className?: string;                 // ✅ Optional
}
```

---

## Test Data

### Sample Packages
```typescript
const SAMPLE_PACKAGES = [
  { id: 'pkg-1', name: 'Gội Massage Thu Giãn', price: 200000 },
  { id: 'pkg-2', name: 'Massage Bấm Huyệt', price: 300000 },
  { id: 'pkg-3', name: 'Chăm Sóc Da Mặt', price: 500000 },
];
```

### Sample Commission Defaults
```typescript
const COMMISSION_DEFAULTS = {
  type: 'fixed',
  value: 150000,
};
```

### Test Scenarios

#### Scenario 1: Basic Service (No Override)
```
Service: Gội Massage Thu Giãn
Quantity: 1
Unit Price: 200,000đ
Subtotal: 200,000đ
Override: No
Expected Commission: 150,000đ (default fixed)
```

#### Scenario 2: Fixed Override
```
Service: Massage Bấm Huyệt
Quantity: 2
Unit Price: 300,000đ
Subtotal: 600,000đ
Override: Yes - Fixed 100,000đ
Expected Commission: 100,000đ
```

#### Scenario 3: Percentage Override
```
Service: Chăm Sóc Da Mặt
Quantity: 1
Unit Price: 500,000đ
Subtotal: 500,000đ
Override: Yes - Percentage 20%
Expected Commission: 100,000đ (20% of 500k)
```

---

## Known Limitations

1. ✅ Edit functionality not implemented (delete + re-add pattern)
2. ✅ No inline validation errors (relies on browser validation)
3. ✅ Animation requires framer-motion dependency
4. ✅ Does not include KTV selector (can be added in parent form)
5. ✅ Does not include completed_date field (can be added in parent form)

---

## Testing Sign-off

**Tested by:** _____________  
**Date:** _____________  
**Status:** ⬜ Pass | ⬜ Fail | ⬜ Partial

**Notes:**
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________

---

## Next Steps After Testing

If all tests pass:
1. ✅ Update `COMMISSION_SYSTEM_REMAINING_TASKS.md` - mark Task 11 complete
2. ✅ Create usage documentation in parent form
3. ✅ Refactor `AddServiceItemForm.tsx` to use `ServiceItemRow` (optional)
4. ✅ Move to Task 12: Service Commission Calculation on Booking Save

If tests fail:
1. Document failures in this checklist
2. Fix issues in components
3. Re-test
4. Update components as needed
