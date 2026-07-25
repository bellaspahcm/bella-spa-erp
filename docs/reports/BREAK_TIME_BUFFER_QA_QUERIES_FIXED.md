# Break Time Buffer QA - Fixed Queries

## Query 1: Find Today's Bookings (FIXED)

```sql
-- Find bookings today with correct column names
SELECT 
  u.full_name as ktv_name,
  TO_CHAR(b.start_time, 'HH24:MI') as start_time,
  b.status,
  p.name as package_name,
  b.id as booking_id
FROM bookings b
JOIN users u ON u.id = b.assigned_ktv_id
JOIN packages p ON p.id = b.package_id
WHERE b.tenant_id = (SELECT id FROM tenants WHERE name ILIKE '%bella%' LIMIT 1)
  AND b.start_time::date = CURRENT_DATE
  AND b.status IN ('confirmed', 'in_progress', 'scheduled', 'deposit_pending')
ORDER BY u.full_name, b.start_time;
```

## Query 2: If No Results, Check All Recent Bookings

```sql
-- Check last 7 days to see any bookings
SELECT 
  u.full_name as ktv_name,
  b.start_time::date as booking_date,
  TO_CHAR(b.start_time, 'HH24:MI') as start_time,
  b.status,
  p.name as package_name
FROM bookings b
JOIN users u ON u.id = b.assigned_ktv_id
JOIN packages p ON p.id = b.package_id
WHERE b.tenant_id = (SELECT id FROM tenants WHERE name ILIKE '%bella%' LIMIT 1)
  AND b.start_time >= CURRENT_DATE - INTERVAL '7 days'
  AND b.status IN ('confirmed', 'in_progress', 'scheduled', 'deposit_pending')
ORDER BY b.start_time DESC
LIMIT 20;
```

## Query 3: Simplest - Check if ANY bookings exist

```sql
-- Count bookings by status
SELECT 
  status,
  COUNT(*) as count,
  MAX(start_time) as latest_booking
FROM bookings
WHERE tenant_id = (SELECT id FROM tenants WHERE name ILIKE '%bella%' LIMIT 1)
GROUP BY status
ORDER BY count DESC;
```

## Query 4: Check Tenant Config (Verify Break Time Enabled)

```sql
-- Verify Bella tenant has break time config
SELECT 
  id,
  name,
  metadata->'capacity_config'->>'minBreakMinutes' as min_break,
  metadata->'capacity_config'->>'enforceBreakTimes' as enforce,
  status
FROM tenants
WHERE name ILIKE '%bella%'
LIMIT 1;
```

**Expected**:
- `min_break = "15"`
- `enforce = "true"`

## Query 5: List All KTVs (For Manual Booking Creation)

```sql
-- Get list of KTVs to use for testing
SELECT 
  id,
  full_name,
  email,
  role
FROM users
WHERE tenant_id = (SELECT id FROM tenants WHERE name ILIKE '%bella%' LIMIT 1)
  AND role = 'ktv'
  AND status = 'active'
ORDER BY full_name;
```

## Query 6: List All Customers (For Manual Booking Creation)

```sql
-- Get list of customers
SELECT 
  id,
  full_name,
  phone,
  email
FROM customers
WHERE tenant_id = (SELECT id FROM tenants WHERE name ILIKE '%bella%' LIMIT 1)
  AND status = 'active'
ORDER BY full_name
LIMIT 20;
```

## Query 7: List All Packages (For Manual Booking Creation)

```sql
-- Get list of packages
SELECT 
  id,
  name,
  duration_minutes,
  price
FROM packages
WHERE tenant_id = (SELECT id FROM tenants WHERE name ILIKE '%bella%' LIMIT 1)
  AND status = 'active'
ORDER BY name;
```

---

## Alternative: If bookings table uses different column names

Try these variations:

### Variation 1: scheduled_date + scheduled_time
```sql
SELECT 
  u.full_name,
  b.scheduled_date,
  b.scheduled_time,
  b.status
FROM bookings b
JOIN users u ON u.id = b.assigned_ktv_id
WHERE b.scheduled_date = CURRENT_DATE
LIMIT 10;
```

### Variation 2: appointment_time or booking_time
```sql
SELECT 
  u.full_name,
  b.appointment_time,
  b.status
FROM bookings b
JOIN users u ON u.id = b.assigned_ktv_id
WHERE b.appointment_time::date = CURRENT_DATE
LIMIT 10;
```

### Variation 3: Check bookings table schema
```sql
-- Show all columns in bookings table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'bookings'
  AND table_schema = 'public'
ORDER BY ordinal_position;
```

---

## Quick Start (No Query Needed)

If queries are too complex, just:

1. **Open localhost:3000 in browser**
2. **Login as Admin**
3. **Go to Bookings page**
4. **Click "Create New Booking"** (or similar button)
5. **Try to create 2 bookings for same KTV with 10-minute gap**
6. **Should see error message**

That's it! No SQL needed if you just want to test the UI.

---

**Use Query 3** (simplest) first to check if any bookings exist at all.
