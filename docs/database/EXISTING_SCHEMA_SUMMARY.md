# Existing Database Schema Summary
## Pre-Waitlist Implementation Analysis

**Date:** 2026-07-10  
**Purpose:** Understand current schema before designing waitlist_entries table

---

## 🗂️ Core Tables (Relevant to Waitlist)

### 1. `tenants`
**Purpose:** Multi-tenancy support  
**Key Columns:**
- `id` (UUID, PK)
- `name` (TEXT)
- `status` (active/suspended/terminated)
- `parent_tenant_id` (UUID, FK → tenants.id) - Franchise hierarchy

**Relevance:** Waitlist must be tenant-isolated (RLS policies)

---

### 2. `customers`
**Purpose:** Customer database  
**Key Columns:**
- `id` (UUID, PK)
- `phone` (TEXT, UNIQUE) - Primary identifier
- `name_mother` (TEXT) - Baby care context
- `name_baby` (TEXT)
- `dob_expected` (DATE) - Expected birth date
- `zalo_oa_id` (TEXT) - Zalo OA integration
- `tenant_id` (UUID, FK → tenants.id)
- `referrer_id` (UUID, FK → users.id)

**Relevance:** Waitlist entry must reference customer_id

---

### 3. `users` (Staff/KTV)
**Purpose:** Staff accounts (admin, KTV, accountant)  
**Key Columns:**
- `id` (UUID, PK)
- `email` (TEXT, UNIQUE)
- `full_name` (TEXT)
- `role` (admin/ktv_lead/ktv/admin_staff/accountant)
- `tenant_id` (UUID, FK → tenants.id)

**Relevance:** Waitlist may have preferred_ktv_id

---

### 4. `packages` (Services)
**Purpose:** Service catalog (massage packages, facials, etc.)  
**Key Columns:**
- `id` (UUID, PK)
- `name` (TEXT) - e.g., "Combo Mẹ & Bé Tiết Kiệm"
- `price` (BIGINT) - Service price
- `duration` (TEXT) - e.g., "90 phút/buổi"
- `total_sessions` (INTEGER) - Number of sessions in package
- `ktv_commission` (BIGINT)
- `tenant_id` (UUID, FK → tenants.id)
- `is_hq_template` (BOOLEAN) - Franchise template
- `template_id` (UUID, FK → packages.id)

**Relevance:** Waitlist entry must reference service_id (package_id)

**NOTE:** In Bella ERP, "packages" = "services" (no separate services table)

---

### 5. `bookings`
**Purpose:** Customer bookings (contracts)  
**Key Columns:**
- `id` (UUID, PK)
- `booking_number` (TEXT, UNIQUE) - e.g., "BK-2024-001"
- `customer_id` (UUID, FK → customers.id)
- `package_id` (UUID, FK → packages.id)
- `status` (inquiry/deposit_pending/booked/in_progress/completed/cancelled)
- `full_price` (DECIMAL)
- `deposit_amount` (DECIMAL)
- `start_date` (DATE)
- `end_date` (DATE)
- `total_sessions` (INTEGER)
- `completed_sessions` (INTEGER)
- `assigned_ktv_id` (UUID, FK → users.id)
- `tenant_id` (UUID, FK → tenants.id)

**Relevance:** Waitlist may link to booking_id (if failed booking → waitlist)

---

### 6. `session_logs`
**Purpose:** Individual session tracking  
**Key Columns:**
- `id` (UUID, PK)
- `booking_id` (UUID, FK → bookings.id)
- `session_number` (INTEGER)
- `assigned_date` (DATE)
- `completed_date` (DATE)
- `completed_by_ktv_id` (UUID, FK → users.id)
- `status` (scheduled/completed/cancelled)
- `tenant_id` (UUID, FK → tenants.id)

**Relevance:** Session cancellation should trigger waitlist processing

---

### 7. `booking_resources`
**Purpose:** Spa resources (beds, rooms, equipment)  
**Key Columns:**
- `id` (UUID, PK)
- `tenant_id` (UUID, FK → tenants.id)
- `name` (TEXT) - e.g., "Giường 1"
- `resource_type` (bed/room/equipment/other)
- `status` (available/in_use/maintenance/retired)
- `location_note` (TEXT)
- `capacity` (INTEGER) - Default: 1

**Relevance:** Waitlist may have preferred_resource_id

---

### 8. `ktv_schedule`
**Purpose:** KTV availability calendar  
**Key Columns:**
- `id` (UUID, PK)
- `ktv_id` (UUID, FK → users.id)
- `date` (DATE)
- `status` (free_full/free_partial/full/off)
- `off_paid` (BOOLEAN)
- `tenant_id` (UUID, FK → tenants.id)
- UNIQUE(ktv_id, date)

**Relevance:** Waitlist processing checks KTV availability

---

### 9. `shifts`
**Purpose:** KTV shift assignments (deprecated in favor of session_logs?)  
**Key Columns:**
- `id` (UUID, PK)
- `ktv_id` (UUID, FK → users.id)
- `date` (DATE)
- `start_time` (TIME)
- `end_time` (TIME)
- `booking_id` (UUID, FK → bookings.id)
- `status` (scheduled/completed/cancelled)
- `tenant_id` (UUID, FK → tenants.id)

**Relevance:** May need to check shift conflicts

---

## 🔗 Foreign Key Relationships

```
tenants
  ↓
  ├── customers
  ├── users (staff/KTV)
  ├── packages (services)
  ├── bookings
  ├── session_logs
  ├── booking_resources
  └── ktv_schedule

customers → bookings
users → bookings (assigned_ktv_id)
packages → bookings (package_id)
bookings → session_logs
users → session_logs (completed_by_ktv_id)
users → ktv_schedule (ktv_id)
```

---

## 📊 Data Types Used in Bella ERP

| Type | Usage | Example |
|------|-------|---------|
| `UUID` | Primary keys, foreign keys | `uuid_generate_v4()` |
| `TEXT` | Strings (no length limit) | name, phone, email |
| `DATE` | Dates without time | `2026-07-10` |
| `TIME` | Time without date | `14:30:00` |
| `TIMESTAMPTZ` | Timestamps with timezone | `NOW()` |
| `DECIMAL` / `NUMERIC` | Money amounts | `3500000.00` |
| `BIGINT` | Large integers | price (VND) |
| `INTEGER` | Small integers | session count |
| `BOOLEAN` | True/false flags | `TRUE`, `FALSE` |
| `TEXT[]` | Text arrays | details |

**NOTE:** Money in VND uses `BIGINT` (no decimals needed) or `DECIMAL(10,2)` for precision.

---

## 🔒 Security Patterns Used

### Row Level Security (RLS)
Most tables have RLS enabled with tenant isolation:

```sql
ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their tenant's data"
  ON table_name FOR SELECT
  USING (tenant_id IN (
    SELECT tenant_id FROM user_tenant_access WHERE user_id = auth.uid()
  ));
```

**Exception:** Some core tables have `DISABLE ROW LEVEL SECURITY` (packages, bookings - needs review)

---

### Audit Logging
Some tables have audit triggers:

```sql
CREATE TRIGGER audit_table_name
  AFTER INSERT OR UPDATE OR DELETE ON table_name
  FOR EACH ROW
  EXECUTE FUNCTION audit_log_trigger();
```

---

### Updated_at Triggers
Most tables auto-update `updated_at` column:

```sql
CREATE TRIGGER update_table_name_updated_at
  BEFORE UPDATE ON table_name
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

---

## 🏗️ Naming Conventions

### Tables
- Plural, lowercase with underscores: `customers`, `session_logs`, `booking_resources`

### Columns
- Lowercase with underscores: `customer_id`, `created_at`, `full_name`
- Foreign keys: `{table}_id` (e.g., `customer_id`, `tenant_id`)
- Status columns: TEXT with CHECK constraint
- Amounts: `DECIMAL` or `BIGINT` (VND)

### Indexes
- `idx_{table}_{columns}`: `idx_session_logs_booking_id`

### Constraints
- `UNIQUE(tenant_id, customer_id, ...)` for tenant-scoped uniqueness

---

## 🎯 Key Insights for Waitlist Design

### 1. Service = Package
In Bella ERP, there's no separate `services` table.  
**Waitlist must reference `packages` table, not `services`.**

**Schema adjustment:**
```sql
-- ❌ WRONG
service_id UUID REFERENCES services(id)

-- ✅ CORRECT
package_id UUID REFERENCES packages(id)
service_name TEXT -- Denormalized from packages.name
```

---

### 2. Preferred Time Format
Existing tables use separate columns:
- `DATE` for dates (`assigned_date`, `completed_date`)
- `TIME` for times (`start_time`, `end_time`)

**Waitlist should follow same pattern:**
```sql
preferred_date DATE NOT NULL,
preferred_start_time TIME NOT NULL,
-- NOT: preferred_datetime TIMESTAMPTZ
```

---

### 3. Tenant Isolation is CRITICAL
All tables have `tenant_id UUID REFERENCES tenants(id)`.  
**Waitlist MUST have:**
- `tenant_id` column
- RLS policy for tenant isolation
- Index on `tenant_id` for performance

---

### 4. Status Enum Pattern
Status columns use TEXT with CHECK constraint:
```sql
status TEXT CHECK (status IN ('active', 'notified', 'expired')) DEFAULT 'active'
```

**NOT:** `status_enum` type (Bella doesn't use ENUMs)

---

### 5. Audit & Updated_at
Most tables have:
- `created_at TIMESTAMPTZ DEFAULT NOW()`
- `updated_at TIMESTAMPTZ DEFAULT NOW()`
- Trigger: `update_updated_at_column()`
- Optional: `audit_log_trigger()`

**Waitlist should follow this pattern.**

---

### 6. Money Amounts
Use `DECIMAL(10,2)` for VND amounts (not `BIGINT`):
```sql
booking_value DECIMAL(10,2) NOT NULL DEFAULT 0
-- NOT: booking_value BIGINT
```

---

### 7. UUID Generation
All PKs use `uuid_generate_v4()`:
```sql
id UUID PRIMARY KEY DEFAULT uuid_generate_v4()
```

---

### 8. Unique Constraints
Use compound unique constraints for tenant-scoped uniqueness:
```sql
UNIQUE(tenant_id, customer_id, package_id, preferred_date)
WHERE status IN ('active', 'notified', 'reserved')
```

This prevents duplicate active waitlist entries.

---

### 9. Indexes for Performance
Critical indexes for waitlist:
- `tenant_id` (tenant isolation)
- `package_id, preferred_date` (slot matching)
- `priority_score DESC, created_at ASC` (queue ordering)
- `expires_at` (expiry cleanup)
- `status` (filtering)

---

### 10. Customer Contact Preferences
`customers` table has `zalo_oa_id` but NO `contact_preferences` column.  
**Need to add or use tenant-level config for notification channels.**

**Options:**
1. Add `preferred_notification_channel` to `customers` table (ALTER TABLE)
2. Use tenant-level config (simpler, less schema change)
3. Hardcode: VIP → Zalo/SMS, Regular → Email (based on tier)

**Decision:** Use option 3 (no schema change), fallback to Zalo if `zalo_oa_id` exists.

---

## 📋 Next Steps

### ✅ DONE
- Read initial schema (tenants, customers, users, bookings, packages, session_logs)
- Understand foreign key relationships
- Document naming conventions
- Identify schema patterns (RLS, triggers, constraints)

### ⏳ NEXT (Day 1-2)
- Design `waitlist_entries` table schema
- Design `waitlist_notification_logs` table
- Write migration file `20260712000000_create_waitlist_tables.sql`
- Test migration locally (`supabase db reset`)
- Update TypeScript types (`supabase gen types typescript`)

---

**Last Updated:** 2026-07-10  
**Status:** Schema analysis complete ✅  
**Next:** Design waitlist_entries table
