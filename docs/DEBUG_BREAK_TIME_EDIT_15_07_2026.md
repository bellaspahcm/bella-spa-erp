# Debug: Break Time Buffer Edit Validation - July 15, 2026

## Issue

After fixing edit booking validation, feature still not working. Need to debug.

## Fix Applied (Version 2)

### Root Cause (Version 1 Bug)
**Problem**: Data structure mismatch

Version 1 code:
```typescript
const updatedBookingData = {
  ...oldBooking,
  ...updatePayload,
  start_time: updatePayload.preferred_time || oldBooking.start_time, // ❌ WRONG field name
};
```

**Issues**:
1. Used `start_time` but Decision Engine expects `start_date`
2. Missing field mapping (Decision Engine needs specific format)
3. No console logging (couldn't debug)

### Fix Version 2

**File**: `src/core/services/order/update-booking-action.ts`

**Changes**:
1. ✅ Map `preferred_time` → `start_date` (Decision Engine field)
2. ✅ Include all required fields (`customer_id`, `package_id`, `status`, etc.)
3. ✅ Map both `assigned_ktv_id` and `ktv_id` (Decision Engine uses `ktv_id`)
4. ✅ Add comprehensive console logging for debugging

**Code**:
```typescript
const updatedBookingData = {
  // Core booking fields
  id: oldBooking.id,
  tenant_id: oldBooking.tenant_id,
  customer_id: oldBooking.customer_id,
  package_id: updatePayload.package_id ?? oldBooking.package_id,
  package_name: updatePayload.package_name ?? oldBooking.package_name,
  
  // Time fields - map preferred_time to start_date for Decision Engine
  start_date: updatePayload.preferred_time ?? oldBooking.start_date, // ✅ CORRECT
  preferred_date: updatePayload.preferred_date ?? oldBooking.preferred_date,
  preferred_time: updatePayload.preferred_time ?? oldBooking.preferred_time,
  
  // KTV assignment - map to both fields
  assigned_ktv_id: updatePayload.assigned_ktv_id ?? oldBooking.assigned_ktv_id,
  ktv_id: updatePayload.assigned_ktv_id ?? oldBooking.assigned_ktv_id, // ✅ Decision Engine uses this
  
  // Status and payment
  status: updatePayload.status ?? oldBooking.status,
  full_price: updatePayload.full_price ?? oldBooking.full_price,
  deposit_amount: updatePayload.deposit_amount ?? oldBooking.deposit_amount,
  
  // Other fields
  total_sessions: updatePayload.total_sessions ?? oldBooking.total_sessions,
  notes: updatePayload.notes ?? oldBooking.notes,
};
```

**Console Logs Added**:
1. `[updateBooking] Decision Engine validation triggered`
2. `[updateBooking] Updated booking data:` - shows mapped data
3. `[updateBooking] Tenant context loaded`
4. `[updateBooking] Decision Engine validation passed`
5. Error logs if validation fails

---

## Testing Instructions

### Step 1: Open Browser DevTools
1. Press `F12` or `Ctrl + Shift + I`
2. Go to **Console** tab
3. Clear console (`Ctrl + L`)

### Step 2: Edit Booking
1. Find booking at 15:00
2. Click "SỬA DỊCH VỤ" (Edit)
3. Change time to **14:35**
4. Click "LƯU THAY ĐỔI" (Save)

### Step 3: Check Console Logs

**If validation is triggered**, you should see:
```
[updateBooking] Decision Engine validation triggered for time/KTV change
[updateBooking] Updated booking data for validation: {
  id: "...",
  start_date: "14:35",
  assigned_ktv_id: "...",
  status: "..."
}
[updateBooking] Tenant context loaded, invoking Decision Engine validation...
```

**Then either**:
- ✅ **Success**: `[updateBooking] Decision Engine validation passed` (BUG - should fail!)
- ❌ **Error**: `[updateBooking] Decision Engine validation failed: KTV cần thời gian nghỉ...` (CORRECT!)

**If no logs appear**: Validation not triggered (need to investigate why)

---

## Possible Issues

### Issue 1: Validation Not Triggered
**Symptom**: No console logs appear

**Causes**:
1. `updatePayload.preferred_time` is `undefined` (field not being updated)
2. `oldBooking` is `null` (failed to fetch old booking)
3. Code not reached (early return before validation)

**Debug**:
```typescript
// Add this before validation check
console.log('[updateBooking] DEBUG:', {
  hasOldBooking: !!oldBooking,
  hasPreferredTime: updatePayload.preferred_time !== undefined,
  hasAssignedKtv: updatePayload.assigned_ktv_id !== undefined,
  updatePayload,
});
```

### Issue 2: Wrong Field Names
**Symptom**: Validation runs but doesn't check break time

**Causes**:
1. Decision Engine uses different field names (e.g., `scheduled_start` instead of `start_date`)
2. Adapter validation not checking break time buffer
3. Break time config not loaded

**Debug**: Check Decision Engine logs for field names used

### Issue 3: Break Time Logic Not Running
**Symptom**: Validation passes when it should fail

**Causes**:
1. Break time buffer logic not enabled in adapter
2. Tenant config `enforceBreakTimes = false`
3. Logic expects different data format

**Debug**: Check tenant config in database

---

## Verification Queries

### Check Tenant Config
```sql
SELECT 
  name,
  metadata->'capacity_config'->>'minBreakMinutes' as min_break,
  metadata->'capacity_config'->>'enforceBreakTimes' as enforce
FROM tenants
WHERE name ILIKE '%bella%'
LIMIT 1;
```

**Expected**:
- `min_break = "15"`
- `enforce = "true"`

### Check Booking Times
```sql
SELECT 
  id,
  start_date,
  preferred_time,
  assigned_ktv_id,
  status
FROM bookings
WHERE assigned_ktv_id = (SELECT id FROM users WHERE full_name = 'Cao Thị Thúy Vân' LIMIT 1)
AND start_date::date = '2026-07-17'
ORDER BY start_date;
```

This shows actual booking times for debugging.

---

## Next Steps

### If Validation Not Triggered
1. Add debug console logs to see `updatePayload` content
2. Check if `preferred_time` field is being set in UI
3. Verify `oldBooking` is loaded correctly

### If Validation Triggered But Passes
1. Check Decision Engine adapter break time logic
2. Verify tenant config `enforceBreakTimes = true`
3. Check field name mapping (might need different field)

### If Validation Fails Correctly
1. ✅ Bug fixed!
2. Update test results in bug fix document
3. Deploy to production

---

**Document Created**: July 15, 2026, 23:25 ICT  
**Fix Version**: 2.0  
**Status**: Awaiting test results  
