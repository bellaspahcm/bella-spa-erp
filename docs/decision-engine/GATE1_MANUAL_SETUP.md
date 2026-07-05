# Gate 1 Manual Setup Guide

**Status**: ⏳ **BLOCKED** - Requires manual SQL execution in Supabase

**Reason**: `leave_requests` table does not exist in production database and cannot be created automatically via API.

---

## Prerequisites

- Access to Supabase SQL Editor
- Service role permissions
- **Bella Test tenant** already created (26c2d467-7c12-4e77-bb67-0e9e43fd7594)
- **Test users** already created (3 users)

---

## Step 1: Create `leave_requests` Table

**File**: `supabase/migrations/20260705000000_temp_leave_requests_for_gate1.sql`

**Run in Supabase SQL Editor:**

```sql
-- Create leave_requests table (TEMPORARY for Gate 1 testing)
CREATE TABLE IF NOT EXISTS leave_requests (
  id TEXT PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  leave_type TEXT NOT NULL CHECK (leave_type IN ('annual', 'sick', 'unpaid', 'maternity', 'paternity')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days INTEGER NOT NULL CHECK (days > 0),
  reason TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approval_reason TEXT,
  approved_at TIMESTAMPTZ,
  decision_id TEXT,
  decision_confidence NUMERIC(3,2),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leave_requests_employee ON leave_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_leave_requests_tenant ON leave_requests(tenant_id, created_at DESC);

ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role has full access to leave_requests"
  ON leave_requests FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Users can view their own leave requests"
  ON leave_requests FOR SELECT TO authenticated
  USING (employee_id = auth.uid() OR approved_by = auth.uid());

COMMENT ON TABLE leave_requests IS 'Temporary table for Decision Engine Gate 1 validation. Isolated to Bella Test tenant.';
```

**Verify:**
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name = 'leave_requests';
```

---

## Step 2: Insert Test Leave Requests

**File**: `scripts/insert-gate1-leave-requests.sql`

**Run in Supabase SQL Editor:**

```sql
-- Insert success scenario request
INSERT INTO leave_requests (
  id, employee_id, leave_type, start_date, end_date, days, reason, status, tenant_id
)
VALUES (
  'req-gate1-success',
  'a3a4f261-506e-4fb7-bd38-d245a3a1fea7', -- Employee high balance
  'annual',
  CURRENT_DATE + INTERVAL '7 days',
  CURRENT_DATE + INTERVAL '11 days',
  5,
  'Family vacation - Gate 1 test',
  'pending',
  '26c2d467-7c12-4e77-bb67-0e9e43fd7594' -- Bella Test tenant
)
ON CONFLICT (id) DO UPDATE SET status = 'pending', updated_at = NOW();

-- Insert rejection scenario request
INSERT INTO leave_requests (
  id, employee_id, leave_type, start_date, end_date, days, reason, status, tenant_id
)
VALUES (
  'req-gate1-reject',
  'f3e5e94b-8683-4832-ad39-383c8804751c', -- Employee low balance
  'annual',
  CURRENT_DATE + INTERVAL '14 days',
  CURRENT_DATE + INTERVAL '18 days',
  5,
  'Personal matter - Gate 1 test',
  'pending',
  '26c2d467-7c12-4e77-bb67-0e9e43fd7594' -- Bella Test tenant
)
ON CONFLICT (id) DO UPDATE SET status = 'pending', updated_at = NOW();
```

**Verify:**
```sql
SELECT id, employee_id, days, status, tenant_id
FROM leave_requests
WHERE id IN ('req-gate1-success', 'req-gate1-reject');

-- Should return 2 rows
```

---

## Step 3: Verify Test Data Complete

**Run this verification query:**

```sql
SELECT 
  'Tenant' as entity_type,
  name as entity_name,
  id::text as entity_id
FROM tenants
WHERE name = 'Bella Test'

UNION ALL

SELECT 
  'User' as entity_type,
  full_name as entity_name,
  id::text as entity_id
FROM users
WHERE email LIKE '%gate1%' OR email LIKE '%balance%'

UNION ALL

SELECT 
  'Leave Request' as entity_type,
  id as entity_name,
  employee_id::text as entity_id
FROM leave_requests
WHERE id LIKE 'req-gate1%';
```

**Expected Output:**
```
entity_type     | entity_name                  | entity_id
----------------+------------------------------+---------------------------------------
Tenant          | Bella Test                   | 26c2d467-7c12-4e77-bb67-0e9e43fd7594
User            | Gate1 Test Manager           | 23a9da64-a8c6-4250-8268-37c965e70fd7
User            | Employee High Balance        | a3a4f261-506e-4fb7-bd38-d245a3a1fea7
User            | Employee Low Balance         | f3e5e94b-8683-4832-ad39-383c8804751c
Leave Request   | req-gate1-success           | a3a4f261-506e-4fb7-bd38-d245a3a1fea7
Leave Request   | req-gate1-reject            | f3e5e94b-8683-4832-ad39-383c8804751c
```

---

## Step 4: Ready for Gate 1 Testing

Once Steps 1-3 are complete, notify the AI agent:

```
"SQL setup complete. Gate 1 ready."
```

The agent will then run 6 validation scenarios.

---

## Safety Notes

✅ **All test data is isolated:**
- Only uses "Bella Test" tenant
- Test users have unique email addresses
- Leave request IDs are prefixed with `req-gate1-`
- **Zero impact on Bella Spa production data**

✅ **Cleanup (optional, after testing):**
```sql
-- Remove test leave requests
DELETE FROM leave_requests WHERE tenant_id = '26c2d467-7c12-4e77-bb67-0e9e43fd7594';

-- Remove test users
DELETE FROM users WHERE email LIKE '%gate1%' OR email LIKE '%balance%';

-- Remove test tenant
DELETE FROM tenants WHERE name = 'Bella Test';

-- Drop table (optional)
-- DROP TABLE IF EXISTS leave_requests CASCADE;
```

---

## Troubleshooting

**Issue**: Table creation fails with "relation already exists"
- **Solution**: Table already exists, proceed to Step 2

**Issue**: FK constraint violation on `employee_id`
- **Solution**: Verify test users exist with query in Step 3

**Issue**: RLS policy blocks insert
- **Solution**: Use service role key, not anon key

---

**Next**: After completing this setup, run Gate 1 validation tests.

