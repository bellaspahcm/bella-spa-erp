# Booking Engine - Database Schema Design

**Created**: 2026-07-09  
**Migration**: `20260709140000_booking_engine_schema.sql`  
**Status**: ✅ Ready for deployment

---

## 🎯 MỤC ĐÍCH

Thiết kế database schema hỗ trợ 6 core providers của Booking Engine:
1. Assignment Provider
2. Capacity Provider  
3. Conflict Provider
4. Waitlist Provider
5. Pricing Provider
6. Cancellation Provider

---

## 📊 4 TABLES MỚI

### 1. `waitlist` - Hàng Đợi

**Purpose**: Quản lý khách hàng chờ khi fully booked

**Used by**: Waitlist Provider, Capacity Provider

**Key Fields**:
```sql
- customer_id          → Khách hàng chờ
- package_id           → Gói dịch vụ muốn book
- preferred_date       → Ngày mong muốn
- preferred_time_slot  → Buổi (morning/afternoon/evening)
- preferred_ktv_id     → KTV mong muốn (optional)
- priority_score       → 0-100 (VIP=100, Loyal=50, New=0)
- status               → active/notified/converted/expired/cancelled
- expires_at           → Tự động expire sau 7 ngày
- notified_at          → Lần cuối notify customer
- converted_booking_id → Booking ID nếu converted
```

**Indexes**:
- `idx_waitlist_tenant_status` - Query active entries
- `idx_waitlist_date_slot` - Find by date/slot
- `idx_waitlist_priority` - Sort by priority (VIP first)
- `idx_waitlist_expiry` - Cleanup expired entries

**Business Logic**:
- Auto-expire sau 7 ngày (`expires_at`)
- Priority score: VIP (100) > Loyal (50) > Active (25) > New (0)
- Notify customer khi có slot (SMS/Email)
- Auto-convert nếu customer accept trong 2h

---

### 2. `pricing_rules` - Quy Tắc Giá

**Purpose**: Dynamic pricing multipliers

**Used by**: Pricing Provider

**Key Fields**:
```sql
- rule_name      → Tên quy tắc (Peak Morning, Weekend, VIP Discount)
- rule_type      → peak_hour/weekend/demand/advance/seasonal/customer_tier/bundle
- condition      → JSONB (flexible conditions)
- multiplier     → 1.15 = +15%, 0.85 = -15%
- priority       → Thứ tự áp dụng (higher first)
- enabled        → true/false
- valid_from     → Ngày bắt đầu
- valid_to       → Ngày kết thúc
```

**Condition Examples**:
```json
// Peak hour
{"hour_range": [10, 14], "days": ["Mon", "Tue", "Wed", "Thu", "Fri"]}

// Weekend
{"days": ["Sat", "Sun"]}

// High demand
{"utilization_min": 80}

// VIP discount
{"tier": "vip"}

// Advance booking
{"days_advance_min": 7}

// Seasonal (Tet)
{"date_range": ["2026-01-25", "2026-02-05"]}
```

**Indexes**:
- `idx_pricing_rules_tenant_enabled` - Active rules only
- `idx_pricing_rules_type` - Filter by type
- `idx_pricing_rules_priority` - Sort by priority
- `idx_pricing_rules_validity` - Check valid dates

**Business Logic**:
- Apply rules by priority (highest first)
- Multiple rules can stack (peak hour + weekend + high demand)
- Max multiplier: 3.0 (300% of base price)
- Min multiplier: 0.1 (10% of base price)

---

### 3. `capacity_snapshots` - Lịch Sử Capacity

**Purpose**: Historical capacity tracking (analytics & forecasting)

**Used by**: Capacity Provider, BI/Reports

**Key Fields**:
```sql
- snapshot_date      → Ngày
- snapshot_hour      → Giờ (0-23)
- time_slot          → morning/afternoon/evening
- total_capacity     → Tổng số KTV available
- booked_capacity    → Số KTV đã book
- available_capacity → Còn trống
- buffer_reserved    → Reserved cho VIP/walk-in (10%)
- utilization_rate   → % (booked / total * 100)
- branch_id          → Chi nhánh (multi-location support)
```

**Indexes**:
- `idx_capacity_snapshots_date` - Time series queries
- `idx_capacity_snapshots_hour` - Hourly breakdown
- `idx_capacity_snapshots_utilization` - High utilization alerts
- Unique constraint: One snapshot per hour per tenant

**Business Logic**:
- Snapshot mỗi giờ (automated job)
- Use for demand forecasting
- Use for pricing (high utilization → surge pricing)
- Analytics: Peak hours, busy days, trends

---

### 4. `booking_events` - Audit Trail

**Purpose**: Audit trail đầy đủ cho booking lifecycle

**Used by**: All Providers (observability), Compliance

**Key Fields**:
```sql
- booking_id         → Reference booking
- event_type         → created/assigned/confirmed/cancelled/completed/...
- event_description  → Human-readable description
- event_data         → JSONB (event-specific data)
- created_by         → User ID
- created_by_role    → customer/staff/admin/system
- ip_address         → Audit (optional)
- user_agent         → Audit (optional)
```

**Event Types**:
```
created              → Booking created
assigned             → KTV assigned (auto or manual)
confirmed            → Customer confirmed booking
rescheduled          → Date/time changed
cancelled            → Booking cancelled
completed            → Service completed
no_show              → Customer no-show
refund_processed     → Refund issued
waitlist_added       → Added to waitlist
waitlist_converted   → Waitlist → Booking
price_calculated     → Dynamic price applied
conflict_detected    → Conflict found
conflict_resolved    → Conflict resolved
```

**Indexes**:
- `idx_booking_events_booking` - All events for booking
- `idx_booking_events_type` - Filter by type
- `idx_booking_events_created_at` - Recent events
- `idx_booking_events_user` - User activity

**Business Logic**:
- Immutable (append-only)
- Full audit trail for compliance
- Observability (track decision-making)
- Debugging (what happened when)

---

## 🔗 EXISTING TABLES USED

### `bookings` (Existing)
**Used by**: All Providers

**Key Queries**:
- Count bookings for capacity
- Check KTV assignments
- Conflict detection (overlapping times)
- Cancellation history

---

### `employees` (Existing)
**Used by**: Assignment Provider, Capacity Provider

**Key Queries**:
- List active KTVs (`role='ktv'`, `status='active'`)
- Check leave schedule (via `attendance`)
- Get KTV skills/specialties
- Performance metrics (rating, completion rate)

---

### `customers` (Existing)
**Used by**: All Providers

**Key Queries**:
- Customer tier (new/active/loyal/vip)
- Booking history (for preference & retention)
- Cancellation history (for policy)

---

### `packages` (Existing)
**Used by**: Pricing Provider, Assignment Provider

**Key Queries**:
- Base price
- Package requirements (skills, duration)
- Package type (for KTV specialty match)

---

### `attendance` (Existing)
**Used by**: Assignment Provider, Capacity Provider, Conflict Provider

**Key Queries**:
- Check KTV on leave (`status='absent'`)
- Count working days (for workload balance)

---

## 🛠️ HELPER FUNCTIONS

### 1. `expire_old_waitlist_entries()`
**Purpose**: Auto-expire waitlist sau 7 ngày

**Usage**: Scheduled job (cron daily)
```sql
SELECT expire_old_waitlist_entries();
```

---

### 2. `calculate_waitlist_priority(customer_id, tenant_id)`
**Purpose**: Tính priority score cho waitlist

**Logic**:
- VIP → 100
- Loyal → 50
- Active → 25
- New → 0

**Usage**:
```sql
SELECT calculate_waitlist_priority('customer-uuid', 'tenant-uuid');
```

---

### 3. `get_available_capacity(tenant_id, date, time_slot)`
**Purpose**: Real-time capacity calculation

**Returns**:
```sql
{
  total_capacity: 10,
  booked_capacity: 7,
  available_capacity: 1,  -- 10 - 7 - buffer(2)
  buffer_reserved: 2,      -- 10% of total
  utilization_rate: 70     -- 7/10 * 100
}
```

**Logic**:
1. Count KTVs (active, not on leave)
2. Count bookings (confirmed/pending for slot)
3. Reserve buffer (10%)
4. Calculate available = total - booked - buffer

**Usage**:
```sql
SELECT * FROM get_available_capacity(
  'tenant-uuid',
  '2026-07-10',
  'morning'
);
```

---

## 🔒 SECURITY (RLS)

**All 4 tables có RLS enabled**:

```sql
-- Tenant isolation (mandatory)
CREATE POLICY "Tenant isolation" ON [table]
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- User access (per table)
CREATE POLICY "Users can view own data" ON [table]
  FOR SELECT USING ([conditions]);
```

**Policies**:
- `waitlist`: Users see only their own entries
- `pricing_rules`: Tenant-wide (all users see same rules)
- `capacity_snapshots`: Tenant-wide (read-only for users)
- `booking_events`: Users see events for their bookings

---

## 📈 PERFORMANCE CONSIDERATIONS

### Indexes Strategy

**1. High-read tables**: `pricing_rules`, `capacity_snapshots`
- Indexed on query patterns (enabled, date range, priority)

**2. High-write tables**: `booking_events`
- Minimal indexes (only essential queries)
- Append-only (no updates)

**3. Mixed workload**: `waitlist`
- Indexed on active entries only (`WHERE status = 'active'`)
- Partial indexes save space

### Query Optimization

**Capacity calculation**:
- Use RPC `get_available_capacity()` (pre-optimized)
- Avoid N+1 queries (batch if possible)

**Waitlist queries**:
- Always filter `status = 'active'` first
- Use priority index for sorting

**Pricing rules**:
- Cache in application (change infrequently)
- Filter `enabled = true` early

---

## 🧪 SEED DATA

Migration includes example pricing rules (commented):
- Peak Morning (+15%)
- Peak Evening (+20%)
- Weekend Premium (+15%)
- Early Bird Discount (-10%)
- Last Minute Surge (+20%)
- High Demand (+10%)
- Low Demand Fill (-15%)
- VIP Discount (-15%)
- New Customer Promo (-5%)

**To activate**: Uncomment và replace `YOUR_TENANT_ID`

---

## 📋 MIGRATION CHECKLIST

### Pre-deployment

- [ ] Review schema với team
- [ ] Validate column types & constraints
- [ ] Check RLS policies
- [ ] Test helper functions locally

### Deployment

- [ ] Backup database
- [ ] Run migration on staging
- [ ] Verify all tables created
- [ ] Verify indexes created
- [ ] Test RLS policies
- [ ] Insert seed data (if needed)

### Post-deployment

- [ ] Update TypeScript types (`npx supabase gen types`)
- [ ] Test Provider queries
- [ ] Monitor performance
- [ ] Setup scheduled jobs (expire waitlist)

---

## 🔄 NEXT STEPS

### Immediate

1. ✅ Schema design complete
2. 📋 Deploy migration to dev
3. 📋 Generate TypeScript types
4. 📋 Update Provider implementations với real queries

### Week 1

- [ ] Implement Assignment Provider queries
- [ ] Implement Capacity Provider queries
- [ ] Implement Waitlist Provider queries

### Week 2

- [ ] Implement Pricing Provider queries
- [ ] Implement Conflict Provider queries
- [ ] Implement Cancellation Provider queries

---

**Created**: 2026-07-09  
**Migration File**: `supabase/migrations/20260709140000_booking_engine_schema.sql`  
**Status**: Ready for review & deployment
