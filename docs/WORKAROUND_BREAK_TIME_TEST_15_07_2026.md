# Workaround: Test Break Time Buffer Without Edit - July 15, 2026

## Issue

Edit Booking Modal bypasses server-side validation by updating database directly via Supabase client. This is why break time buffer validation doesn't run.

## Root Cause

**UI Pattern**: Edit Booking Modal → Direct Supabase Update → Bypasses `updateBooking()` server action

**Files Involved**:
- `src/app/dashboard/customers/[id]/components/CustomerDetailModals.tsx` - EditBookingModal component
- `src/app/dashboard/customers/[id]/page.tsx` - Parent component (likely uses direct supabase.update())

**Why Validation Doesn't Run**:
- Our fix in `update-booking-action.ts` only applies to server action calls
- UI Modal uses Supabase client directly: `supabase.from('bookings').update(...)`
- This bypasses all server-side validation logic

---

## Workaround: Test via CREATE Instead of EDIT

### Test Scenario 1: CREATE Booking with 5-Minute Gap ❌

**Steps**:
1. Existing booking: KTV Cao Thị Thúy Vân, 13:30 - 14:30
2. **Create NEW booking**:
   - Go to **Bookings** → **New Booking**
   - Customer: Different customer OR same customer (after Bug #1 fix)
   - Package: Any package (e.g., Massage Bầu)
   - KTV: **Cao Thị Thúy Vân** (SAME KTV)
   - Time: **14:35** (5-minute gap)
3. Click "Tạo booking"

**Expected**: ❌ ERROR "KTV cần thời gian nghỉ giữa các ca (tối thiểu 15 phút)"

**If this works**: ✅ Break time buffer IS working for CREATE (already confirmed earlier)

---

### Test Scenario 2: CREATE Booking with 20-Minute Gap ✅

**Steps**:
1. Same as above, but time: **14:50** (20-minute gap)

**Expected**: ✅ SUCCESS, booking created

---

## Proper Fix Required

To fix EDIT booking validation, need to:

### Option 1: Fix UI Modal to Use Server Action (RECOMMENDED)
**File**: `src/app/dashboard/customers/[id]/page.tsx` (or similar)

**Change**: Replace direct Supabase update with server action call

**Before** (likely current code):
```typescript
const handleEditBooking = async () => {
  const { error } = await supabase
    .from('bookings')
    .update(editBookingData)
    .eq('id', bookingId);
  
  if (error) {
    // handle error
  }
};
```

**After**:
```typescript
import { updateBooking } from '@/core/services/order';

const handleEditBooking = async () => {
  const result = await updateBooking(bookingId, editBookingData);
  
  if ('error' in result) {
    // handle error - will include break time validation errors
  }
};
```

---

### Option 2: Add RLS Policy Validation (COMPLEX)
**File**: Supabase migration

**Concept**: Add PostgreSQL function that validates break time before UPDATE

**Pros**: Works for ALL update paths (UI, API, direct DB)

**Cons**: Complex, requires PostgreSQL function, harder to maintain

**Example**:
```sql
CREATE OR REPLACE FUNCTION check_break_time_before_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if time/KTV changed
  IF NEW.preferred_time != OLD.preferred_time OR NEW.assigned_ktv_id != OLD.assigned_ktv_id THEN
    -- Check for conflicting bookings with <15 minute gap
    -- (Complex SQL logic here)
    
    IF conflict_found THEN
      RAISE EXCEPTION 'KTV cần thời gian nghỉ giữa các ca (tối thiểu 15 phút)';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER booking_update_check_break_time
  BEFORE UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION check_break_time_before_update();
```

---

### Option 3: Add Client-Side Validation (WEAK)
**File**: `src/app/dashboard/customers/[id]/components/CustomerDetailModals.tsx`

**Concept**: Check break time in UI before submitting

**Pros**: Quick fix

**Cons**: 
- Client-side only (can be bypassed)
- Duplicate logic (server and client)
- Not secure

**Not Recommended** unless combined with Option 1 or 2

---

##  Recommended Solution

**Priority 1**: Fix UI Modal to use server action (Option 1)

**Why**:
- Reuses existing validation logic
- Secure (server-side)
- Consistent with CREATE booking flow
- Easy to maintain

**Estimated Time**: 15-20 minutes

**Steps**:
1. Find `handleEditBooking` or similar in `src/app/dashboard/customers/[id]/page.tsx`
2. Replace direct Supabase update with `updateBooking()` server action
3. Test edit booking with 5-minute gap
4. Should see error ❌

---

## Current Status

**Create Booking Validation**: ✅ WORKING  
**Edit Booking Validation**: ❌ NOT WORKING (bypasses server action)

**Workaround**: Use CREATE to test break time buffer (works correctly)

**Proper Fix**: Modify UI to call server action instead of direct Supabase update

---

**Document Created**: July 15, 2026, 23:40 ICT  
**Status**: Workaround documented, proper fix required  
**Next Step**: Implement Option 1 (UI Modal → Server Action)  
