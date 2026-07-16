# Beauty Spa Resource Migration Guide

**Date**: 16 July 2026  
**Status**: Ready to Apply 🟢  
**Priority**: P1 (Blocking Beauty Spa resource conflict detection)

---

## Overview

This migration adds resource management tables and conflict detection for Beauty Spa module:

- **Beds (giường)** - Individual service beds
- **Rooms (phòng)** - Service rooms with capacity
- **Equipment (thiết bị)** - Machines and tools with quantity tracking

---

## Migration File

**Location**: `supabase/migrations/20260716120000_add_beauty_spa_resources.sql`

**Changes:**
1. ✅ Create `rooms` table (5 rooms)
2. ✅ Create `beds` table (10 beds per tenant)
3. ✅ Create `equipment` table (machines, tools)
4. ✅ Add columns to `bookings`:
   - `assigned_bed_id` (UUID reference to beds)
   - `assigned_room_id` (UUID reference to rooms)
   - `required_equipment_ids` (JSONB array)
5. ✅ Add indexes for conflict detection queries
6. ✅ Verification checks
7. ✅ Sample data (commented out - manual step)

---

## How to Apply

### Step 1: Open Supabase Dashboard

1. Go to: https://supabase.com/dashboard
2. Select your project
3. Navigate to **SQL Editor**

### Step 2: Copy Migration SQL

1. Open file: `supabase/migrations/20260716120000_add_beauty_spa_resources.sql`
2. Copy entire content (from line 1 to end)

### Step 3: Execute in SQL Editor

1. Paste SQL into editor
2. Click **"Run"** button
3. Wait for completion (~2-5 seconds)

### Step 4: Verify Success

You should see output:

```
✅ Resource columns added to bookings table
✅ Resource tables created
```

If you see any errors, **STOP** and share the error message.

---

## After Migration

### 1. Verify Tables Created

Run this query:

```sql
SELECT 
  tablename,
  schemaname
FROM pg_tables 
WHERE tablename IN ('beds', 'rooms', 'equipment')
ORDER BY tablename;
```

Expected output:

```
tablename  | schemaname
-----------|----------
beds       | public
equipment  | public
rooms      | public
```

### 2. Verify Bookings Columns

Run this query:

```sql
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'bookings'
  AND column_name IN ('assigned_bed_id', 'assigned_room_id', 'required_equipment_ids')
ORDER BY column_name;
```

Expected output:

```
column_name            | data_type | is_nullable
-----------------------|-----------|------------
assigned_bed_id        | uuid      | YES
assigned_room_id       | uuid      | YES
required_equipment_ids | jsonb     | YES
```

### 3. (Optional) Add Sample Data

If you want to test with sample data, uncomment and run the sample data section in the migration file (Step 6).

Sample data includes:
- 10 beds per tenant (G01-G10)
- 5 rooms per tenant (P01-P05)
- 4 equipment types (Laser, Triệt Lông, RF, Dụng Cụ Spa)

---

## Rollback Plan

If anything goes wrong, run this SQL:

```sql
-- Remove columns from bookings
ALTER TABLE bookings DROP COLUMN IF EXISTS assigned_bed_id;
ALTER TABLE bookings DROP COLUMN IF EXISTS assigned_room_id;
ALTER TABLE bookings DROP COLUMN IF EXISTS required_equipment_ids;

-- Drop resource tables
DROP TABLE IF EXISTS beds CASCADE;
DROP TABLE IF EXISTS rooms CASCADE;
DROP TABLE IF EXISTS equipment CASCADE;
```

⚠️ **Only use this if migration fails completely!**

---

## What Happens After Migration

### 1. Resource Conflict Detection Active

`BeautySpaModuleAdapter` will now check:

- ✅ **Bed conflicts**: Same bed + overlapping time = blocked
- ✅ **Room conflicts**: Room capacity exceeded = blocked
- ✅ **Equipment conflicts**: Equipment unavailable = blocked
- ✅ **KTV conflicts**: (inherited from SpaModuleAdapter)

### 2. Booking Flow Changes

When creating a booking:

1. User selects service
2. **(NEW)** User selects bed (optional)
3. **(NEW)** User selects room (optional)
4. **(NEW)** System auto-assigns equipment based on service
5. System validates all resources available
6. Booking created if all checks pass

### 3. No Impact on Existing Bookings

- Existing bookings have `NULL` for resource fields
- Old bookings still work normally
- New bookings can use resource conflict detection

---

## Architecture

### Module Registration

File: `src/modules/spa/register.ts`

```typescript
// Spa module - KTV validation only
moduleRegistry.register('spa', new SpaModuleAdapter());

// Beauty Spa module - KTV + Resource validation
moduleRegistry.register('beauty_spa', new BeautySpaModuleAdapter());
```

### Adapter Hierarchy

```
ModuleAdapter (interface)
  ↑
SpaModuleAdapter (KTV validation)
  ↑
BeautySpaModuleAdapter (KTV + Resource validation)
```

### Conflict Detection Flow

```
1. User creates booking
   ↓
2. invokeAdapterValidation() called
   ↓
3. moduleRegistry.get('beauty_spa') → BeautySpaModuleAdapter
   ↓
4. adapter.validateBookingRules()
   ↓
5. super.validateBookingRules() → Check KTV conflicts
   ↓
6. this.checkResourceConflicts() → Check bed/room/equipment
   ↓
7. Return true (allow) or false (block)
```

---

## Testing Checklist

After migration, test these scenarios:

### 1. Basic Resource Assignment

- [ ] Create booking with bed → Should save `assigned_bed_id`
- [ ] Create booking with room → Should save `assigned_room_id`
- [ ] Create booking with equipment → Should save `required_equipment_ids`

### 2. Conflict Detection

- [ ] Book bed G01 at 10:00-11:00
- [ ] Try to book G01 at 10:30-11:30 → Should be **blocked** (conflict)
- [ ] Book G01 at 11:00-12:00 → Should **succeed** (no overlap)

### 3. Room Capacity

- [ ] Book room P01 (capacity: 2) at 10:00 - 2 bookings → Should succeed
- [ ] Try 3rd booking in P01 at 10:00 → Should be **blocked** (capacity full)

### 4. Equipment Quantity

- [ ] Book Máy Laser (qty: 2) at 10:00 - 2 bookings → Should succeed
- [ ] Try 3rd booking with Máy Laser at 10:00 → Should be **blocked** (quantity exceeded)

---

## Next Steps

1. ✅ Apply migration (this guide)
2. ⏳ Test resource conflict detection
3. ⏳ Add UI for bed/room/equipment selection in booking form
4. ⏳ Add resource management page (CRUD for beds/rooms/equipment)

---

## Support

If you encounter any issues:

1. Check Supabase Dashboard → Logs → SQL errors
2. Share error message
3. Check verification queries above
4. Use rollback plan if needed

---

**Status**: Migration file ready, waiting for user to apply in Supabase Dashboard.
