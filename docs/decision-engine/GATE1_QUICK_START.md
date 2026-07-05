# Gate 1 Quick Start - Manual Setup

**⏱️ Estimated Time**: 5 minutes

---

## ✅ Checklist

### 1️⃣ Tạo Table `leave_requests`

**Mở Supabase SQL Editor** → Copy-paste SQL này:

```sql
-- Tạo table leave_requests
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
```

**✅ Verify:**
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name = 'leave_requests';
```

---

### 2️⃣ Insert Test Data (2 Leave Requests)

**Copy-paste SQL này:**

```sql
-- Request 1: Success scenario
INSERT INTO leave_requests (
  id, employee_id, leave_type, start_date, end_date, days, reason, status, tenant_id
)
VALUES (
  'req-gate1-success',
  'a3a4f261-506e-4fb7-bd38-d245a3a1fea7',
  'annual',
  CURRENT_DATE + INTERVAL '7 days',
  CURRENT_DATE + INTERVAL '11 days',
  5,
  'Family vacation - Gate 1 test',
  'pending',
  '26c2d467-7c12-4e77-bb67-0e9e43fd7594'
)
ON CONFLICT (id) DO UPDATE SET status = 'pending', updated_at = NOW();

-- Request 2: Rejection scenario
INSERT INTO leave_requests (
  id, employee_id, leave_type, start_date, end_date, days, reason, status, tenant_id
)
VALUES (
  'req-gate1-reject',
  'f3e5e94b-8683-4832-ad39-383c8804751c',
  'annual',
  CURRENT_DATE + INTERVAL '14 days',
  CURRENT_DATE + INTERVAL '18 days',
  5,
  'Personal matter - Gate 1 test',
  'pending',
  '26c2d467-7c12-4e77-bb67-0e9e43fd7594'
)
ON CONFLICT (id) DO UPDATE SET status = 'pending', updated_at = NOW();
```

**✅ Verify:**
```sql
SELECT id, employee_id, days, status FROM leave_requests
WHERE id IN ('req-gate1-success', 'req-gate1-reject');
```

Should return **2 rows**.

---

### 3️⃣ Done! Notify AI Agent

Khi xong, trả lời:

```
"SQL setup complete. Gate 1 ready."
```

AI agent sẽ chạy 6 validation scenarios.

---

## 🧹 Cleanup (Optional - after testing)

```sql
-- Remove test leave requests only
DELETE FROM leave_requests WHERE tenant_id = '26c2d467-7c12-4e77-bb67-0e9e43fd7594';
```

---

## 🔒 Safety Notes

✅ All test data isolated to **"Bella Test" tenant**  
✅ Zero impact on production Bella Spa data  
✅ Test users already exist (created in previous steps)

---

**Full Details**: See `GATE1_MANUAL_SETUP.md` for comprehensive guide.
