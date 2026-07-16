# HOTFIX: Block Overlapping Bookings (deposit_pending)

**Date**: July 15, 2026 (Evening)  
**Bug**: P0 Critical - Admin can create overlapping bookings  
**Fix Time**: 5 minutes  
**Status**: ✅ FIXED

---

## Bug Summary

**Issue**: System allows admin to create multiple overlapping bookings for same customer

**Example**:
- Customer has "Massage Bụng" (`deposit_pending`)
- Admin creates "Tắm Bé" (new booking)
- Both exist simultaneously ❌

**Root Cause**: Admin booking conflict check did NOT block `deposit_pending` status

---

## The Fix

### File Modified
`src/core/services/order/create-booking-action.ts` (line ~216)

### Change Applied

**BEFORE**:
```typescript
.in('status', ['in_progress', 'scheduled', 'confirmed']);
// ❌ Allows creating new booking if old one is deposit_pending
```

**AFTER**:
```typescript
.in('status', ['deposit_pending', 'in_progress', 'scheduled', 'confirmed']);
// ✅ Blocks any active booking including deposit_pending
```

**Lines Changed**: 3 lines
- Updated comment (removed outdated note)
- Added `'deposit_pending'` to block list

---

## Impact

### ✅ What This Fixes
1. **Prevents overlapping bookings** - Customer cannot have 2 active packages at once
2. **Consistent blocking** - Admin and public booking now have same rules
3. **Data integrity** - No more conflicting service schedules

### ⚠️ What Changes for Admins
**OLD Workflow**:
- Customer has Booking A (`deposit_pending`)
- Admin creates Booking B → ✅ Allowed (BAD!)

**NEW Workflow**:
- Customer has Booking A (`deposit_pending`)
- Admin tries to create Booking B → ❌ Blocked (GOOD!)
- Admin must cancel/complete Booking A first
- Then create Booking B → ✅ Allowed

**Extra Steps**: +1 step (cancel old booking first)

---

## Testing

### ✅ Build Verification
```bash
npm run build
```
**Result**: Exit Code 0 ✅

### Manual Test Plan (TODO)

**Test 1: Admin Blocked by deposit_pending**
1. Create Booking A (`deposit_pending`) for Customer X via admin
2. Try to create Booking B for Customer X
3. **Expected**: ❌ Error message showing conflict
4. **Verify**: Only 1 booking exists in database

**Test 2: Can Create After Cancelling**
1. Cancel Booking A
2. Create Booking B for Customer X
3. **Expected**: ✅ Success
4. **Verify**: New booking created

**Test 3: Public Booking Still Works** (Regression Test)
1. Create Booking A (`deposit_pending`) via admin
2. Try to book via public form as Customer X
3. **Expected**: ❌ Blocked (should still work as before)

---

## Error Messages

### Admin Booking Error
```
❌ Khách hàng đang có 1 gói đang thực hiện:

📦 Massage Bụng

Vui lòng hoàn thành hoặc hủy các gói này trước khi tạo booking mới.

💡 Nếu cần tạo booking đồng thời, vui lòng liên hệ quản lý.
```

### Public Booking Error
```
❌ Bạn đang có 1 gói đang thực hiện:

📦 Massage Bụng

Vui lòng hoàn thành hoặc hủy các gói này trước khi đặt gói mới.

💡 Nếu cần hỗ trợ, vui lòng liên hệ hotline để được tư vấn.
```

---

## Deployment

### Pre-Deploy Checklist
- [✅] Code changed (1 file)
- [✅] Build successful
- [✅] No TypeScript errors
- [ ] Manual testing completed (TODO)
- [ ] Error messages verified (TODO)

### Deploy Command
```bash
vercel --prod
```

### Post-Deploy Verification
1. Check production logs for conflict detection triggers
2. Monitor admin feedback about "too strict"
3. Confirm no new overlapping bookings created

---

## Communication

### For Admins (Slack/Email)
**Subject**: 🔒 Cập nhật: Hệ thống chặn booking trùng lặp nghiêm ngặt hơn

**Message**:
> Team ơi,
> 
> Hệ thống vừa được cập nhật để ngăn chặn tình trạng khách hàng có nhiều gói dịch vụ đang thực hiện cùng lúc.
> 
> **Thay đổi**:
> - Nếu khách hàng đã có booking đang chờ thanh toán (`Đặt cọc`), bạn sẽ không thể tạo booking mới
> - Cần hủy hoặc hoàn thành booking cũ trước khi tạo booking mới
> 
> **Lý do**: Đảm bảo khách hàng không bị trùng lịch dịch vụ, tránh confusion và conflict.
> 
> **Nếu gặp vấn đề**: Ping @tech-team hoặc báo qua Slack.
> 
> Thanks! 🙏

---

## Rollback Plan

If this causes issues, revert commit:

```bash
git revert HEAD
git push origin main
vercel --prod
```

**Time to rollback**: ~2 minutes

**Alternative**: Change back to old block list:
```typescript
.in('status', ['in_progress', 'scheduled', 'confirmed']);
```

---

## Future Enhancements (Optional)

### Phase 2: Smart Reuse Logic
Allow reusing `deposit_pending` IF:
- Same package
- Just updating amount

**Complexity**: Medium  
**Priority**: P2  
**ETA**: Next sprint if admins complain

### Phase 3: Time-Based Conflicts
Allow multiple bookings if:
- Different scheduled dates
- Time slots don't overlap

**Complexity**: High  
**Priority**: P3  
**ETA**: Q4 2026

---

## Related Documents

- `docs/BUG_VERIFICATION_OVERLAPPING_BOOKINGS_15_07_2026.md` - Investigation
- `docs/CRITICAL_BUG_BOOKING_CONFLICT_DETECTION.md` - Original fix (morning)
- `docs/FIX_SUMMARY_BOOKING_CONFLICT.md` - Morning fix summary
- `src/__tests__/booking-conflict-customer-level.test.ts` - Test suite

---

## Conclusion

✅ **Bug FIXED with 1-line change**

**Before**: Admin could create overlapping bookings (deposit_pending not blocked)  
**After**: All active statuses blocked, no overlapping allowed

**Trade-off**: +1 admin step (cancel old first), but much safer and cleaner data

**Risk Level**: 🟢 Low (simple change, well-tested pattern)

---

**Fixed By**: Kiro AI Agent  
**Verified**: Build passing ✅  
**Next**: Manual QA testing + production deployment
