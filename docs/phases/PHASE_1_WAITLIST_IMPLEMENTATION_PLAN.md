# Phase 1: Waitlist Implementation Plan
## Complete Booking Engine Production-Readiness

**Date:** 2026-07-10  
**Duration:** 2 weeks  
**Priority:** ⭐⭐⭐⭐⭐ (Blocker for UX phases)  
**Approach:** Database-first, measure twice cut once

---

## 🎯 Goal

Make Booking Engine production-ready by completing Waitlist feature with:
- ✅ Database schema (waitlist tables)
- ✅ Backend service layer (CRUD + business logic)
- ✅ API routes (RESTful endpoints)
- ✅ UI components (list, add, manage waitlist)
- ✅ Notifications (Zalo/SMS/Email integration)
- ✅ Integration tests (100% coverage)
- ✅ Pilot customer testing

---

## 📊 Current Status Assessment

### ✅ DONE (Decision Engine Provider Layer)
- `WaitlistManagementProvider` class (~600 lines)
- 10 business rules defined in `waitlist-rules.ts`
- Priority calculation logic (tier, value, wait time, flexibility)
- Tests: `waitlist-management-provider.test.ts` (passing)

### ❌ MISSING (Database + API + UI)
- **NO waitlist table in database** (checked migrations)
- NO API routes for waitlist operations
- NO UI components for waitlist management
- NO notification service integration
- NO end-to-end tests

---

## 📋 Implementation Checklist

### Week 1: Database + Backend API

#### Day 1-2: Database Schema Design ⭐⭐⭐⭐⭐
**Status:** NOT STARTED  
**Blocker:** MUST complete before any code

**Tasks:**
- [ ] Read existing database schema thoroughly
  - [ ] `bookings` table structure
  - [ ] `customers` table structure
  - [ ] `session_logs` table structure
  - [ ] `booking_resources` table structure
  - [ ] `users` table structure
- [ ] Design `waitlist_entries` table schema
  - [ ] PK: id (UUID)
  - [ ] FK: tenant_id, customer_id, booking_id (optional), service_id, ktv_id (preferred)
  - [ ] Columns: priority_score, position, wait_minutes, status, created_at, expires_at
  - [ ] Constraints: UNIQUE(tenant_id, customer_id, service_id, preferred_date) for active entries
  - [ ] Indexes: tenant_id, status, priority_score, expires_at
  - [ ] Triggers: update_updated_at, audit_log
- [ ] Write migration file
  - [ ] CREATE TABLE with full schema
  - [ ] CREATE INDEXes for performance
  - [ ] ENABLE RLS (Row Level Security)
  - [ ] CREATE POLICIES (tenant isolation)
  - [ ] GRANT permissions (authenticated role)
  - [ ] COMMENT ON TABLE/COLUMNS (documentation)
- [ ] Test migration locally
  - [ ] Run `supabase db reset`
  - [ ] Verify table created correctly
  - [ ] Verify RLS policies work
  - [ ] Verify indexes exist
- [ ] Update TypeScript types
  - [ ] Run `supabase gen types typescript` → `src/lib/database.types.ts`
  - [ ] Create `src/types/waitlist.ts` (domain types)

**Success Criteria:**
- Migration runs without errors
- RLS prevents cross-tenant data leaks
- Types compile with zero TypeScript errors
- Can insert/query test data via Supabase dashboard

---

#### Day 3-4: Backend Service Layer
**Status:** NOT STARTED  
**Depends:** Database schema complete

**Tasks:**
- [ ] Create `src/services/waitlist/waitlist-service.ts`
  - [ ] `addToWaitlist(input)` - Add customer to waitlist with priority calculation
  - [ ] `getWaitlistByTenant(tenantId, filters)` - List with filters (date, service, status)
  - [ ] `getWaitlistEntry(entryId)` - Get single entry details
  - [ ] `updateWaitlistEntry(entryId, updates)` - Update status, position, etc.
  - [ ] `removeFromWaitlist(entryId, reason)` - Remove with audit trail
  - [ ] `processSlotAvailable(slot, tenantId)` - Auto-notify top customers
  - [ ] `expireOldEntries(tenantId)` - Cleanup expired entries (cron job)
  - [ ] `recalculatePositions(tenantId, serviceId, date)` - Reorder when waitlist changes
- [ ] Integrate with `WaitlistManagementProvider`
  - [ ] Call provider for priority calculation
  - [ ] Call provider for slot matching
  - [ ] Map provider output to database schema
- [ ] Error handling
  - [ ] Validation errors (return 400 with clear message)
  - [ ] Database errors (return 500, log to Sentry)
  - [ ] Business rule violations (return 422 with reason)
- [ ] Audit logging
  - [ ] Log all waitlist operations to `audit_logs` table
  - [ ] Include: user_id, action, entity_id, changes, timestamp

**Success Criteria:**
- All 8 service functions work correctly
- TypeScript compiles with zero errors
- Error messages are clear and actionable
- Audit logs capture all operations

---

#### Day 5-7: API Routes
**Status:** NOT STARTED  
**Depends:** Service layer complete

**Tasks:**
- [ ] `src/app/api/waitlist/route.ts` (List + Create)
  - [ ] GET `/api/waitlist` - List waitlist entries with filters
    - Query params: `tenantId`, `serviceId`, `status`, `date`, `page`, `limit`
    - Response: `{ entries: [], total, page, totalPages }`
  - [ ] POST `/api/waitlist` - Add customer to waitlist
    - Body: `{ customerId, serviceId, preferredDate, preferredTime, bookingValue, isFlexible }`
    - Response: `{ success, entry, position, estimatedWait }`
- [ ] `src/app/api/waitlist/[entryId]/route.ts` (Get + Update + Delete)
  - [ ] GET `/api/waitlist/[entryId]` - Get single entry
  - [ ] PATCH `/api/waitlist/[entryId]` - Update entry (status, position, notes)
  - [ ] DELETE `/api/waitlist/[entryId]` - Remove from waitlist
- [ ] `src/app/api/waitlist/[entryId]/notify/route.ts` (Manual Notify)
  - [ ] POST `/api/waitlist/[entryId]/notify` - Manually send notification
- [ ] `src/app/api/waitlist/process-slot/route.ts` (Auto-process)
  - [ ] POST `/api/waitlist/process-slot` - Process when slot available
    - Body: `{ tenantId, serviceId, date, startTime, ktvId, resourceId }`
    - Response: `{ notified: [{ customerId, sent }], total }`
- [ ] Authentication middleware
  - [ ] Verify JWT token (Next.js server-side)
  - [ ] Extract user_id, tenant_id from token
  - [ ] Verify user has permission (admin, admin_staff only)
- [ ] Input validation
  - [ ] Use Zod schemas for request validation
  - [ ] Return 400 with validation errors
- [ ] Rate limiting
  - [ ] Max 100 requests/minute per tenant
  - [ ] Return 429 if exceeded

**Success Criteria:**
- All API endpoints work correctly
- Authentication prevents unauthorized access
- Input validation catches invalid data
- Rate limiting prevents abuse

---

### Week 2: UI Components + Notifications + Testing

#### Day 8-10: UI Components
**Status:** NOT STARTED  
**Depends:** API routes complete

**Tasks:**
- [ ] Waitlist List Page (`src/app/dashboard/waitlist/page.tsx`)
  - [ ] Table view with columns: Customer, Service, Position, Wait Time, Status, Actions
  - [ ] Filters: Service, Date, Status
  - [ ] Search: Customer name/phone
  - [ ] Pagination: 20 items/page
  - [ ] Actions dropdown: View, Notify, Remove
  - [ ] Status badges: Active (blue), Notified (green), Reserved (yellow), Expired (gray)
- [ ] Add to Waitlist Modal (`src/components/waitlist/AddToWaitlistModal.tsx`)
  - [ ] Customer selector (autocomplete)
  - [ ] Service selector (dropdown)
  - [ ] Preferred date picker
  - [ ] Preferred time picker
  - [ ] Booking value input
  - [ ] Flexibility checkbox
  - [ ] "Add to Waitlist" button
  - [ ] Show estimated position + wait time after submission
- [ ] Waitlist Detail Page (`src/app/dashboard/waitlist/[entryId]/page.tsx`)
  - [ ] Customer info card
  - [ ] Booking preferences card
  - [ ] Priority breakdown (tier score, value score, wait time score)
  - [ ] Position history timeline
  - [ ] Notification history
  - [ ] Actions: Update Status, Send Notification, Remove
- [ ] Auto-notification on Slot Available (Integration)
  - [ ] When booking cancelled → call `/api/waitlist/process-slot`
  - [ ] When new slot created → call `/api/waitlist/process-slot`
  - [ ] Show toast: "3 customers notified from waitlist"
- [ ] Waitlist Stats Widget (Dashboard)
  - [ ] Total entries
  - [ ] Avg wait time
  - [ ] Conversion rate (notified → booked)
  - [ ] Top services (by waitlist size)

**Success Criteria:**
- UI is intuitive (non-technical user can use)
- All CRUD operations work via UI
- Real-time updates (when waitlist changes)
- Mobile responsive

---

#### Day 11-12: Notification Service Integration
**Status:** NOT STARTED  
**Depends:** UI complete

**Tasks:**
- [ ] Create `src/services/notification/notification-service.ts`
  - [ ] `sendWaitlistNotification(entry, type, channel)`
    - Types: `slot_available`, `position_updated`, `expiring_soon`, `expired`
    - Channels: `zalo`, `sms`, `email`
  - [ ] Integrate with existing Zalo/SMS services
  - [ ] Template messages (Vietnamese)
    - "Tin tốt! Đã có chỗ trống cho [Service] vào [Date] lúc [Time]. Vui lòng phản hồi trong 30 phút."
    - "Bạn hiện đang ở vị trí #[Position] trong danh sách chờ. Chúng tôi sẽ thông báo khi có chỗ."
    - "Đăng ký chờ của bạn sẽ hết hạn trong 2 giờ. Vui lòng xác nhận nếu vẫn quan tâm."
  - [ ] Error handling (log failed notifications)
  - [ ] Retry logic (3 attempts with exponential backoff)
- [ ] Update `WaitlistManagementProvider`
  - [ ] Replace mock notification with real service call
  - [ ] Pass notification result to output
- [ ] Create notification log table
  - [ ] `waitlist_notification_logs` (track all notifications sent)
  - [ ] Columns: entry_id, type, channel, status, sent_at, error_message

**Success Criteria:**
- Notifications sent successfully via Zalo/SMS/Email
- Failed notifications logged with reason
- Notification templates are clear and actionable
- Users receive notifications within 30 seconds

---

#### Day 13-14: Integration Tests + Pilot Testing
**Status:** NOT STARTED  
**Depends:** All features complete

**Tasks:**
- [ ] Write integration tests (`src/services/waitlist/__tests__/waitlist-integration.test.ts`)
  - [ ] Test: Add to waitlist → Verify in DB
  - [ ] Test: Add when full → Reject with capacity error
  - [ ] Test: Process slot available → Notify top 3
  - [ ] Test: Expire old entries → Status = expired
  - [ ] Test: Recalculate positions → Verify order correct
  - [ ] Test: Tenant isolation → User A cannot see User B's waitlist
  - [ ] Test: Priority calculation → VIP gets higher priority than Regular
  - [ ] Test: Notification sent → Verify log created
  - [ ] Test: Notification failed → Retry 3 times
  - [ ] Test: Full end-to-end flow (Add → Notify → Book → Remove)
- [ ] Run tests
  - [ ] `npm run test:integration` → All passing
  - [ ] Test coverage >80%
- [ ] Pilot customer testing
  - [ ] Deploy to staging environment
  - [ ] Give access to 1-2 spa owners
  - [ ] Guide through: Add customer to waitlist, Process slot, Notify
  - [ ] Collect feedback (survey + video interview)
  - [ ] Fix critical bugs
  - [ ] Iterate UI based on feedback

**Success Criteria:**
- All integration tests passing
- Test coverage >80%
- Pilot customer says "Waitlist hoạt động tốt"
- Zero critical bugs in production simulation

---

## 📐 Database Schema Design (Detailed)

### `waitlist_entries` Table

```sql
CREATE TABLE waitlist_entries (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Foreign Keys (Tenant Isolation)
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL, -- Optional: if waitlist from failed booking
  
  -- Booking Request Details
  service_id UUID REFERENCES services(id) ON DELETE CASCADE,
  service_name TEXT NOT NULL, -- Denormalized for performance
  booking_value DECIMAL(10,2) NOT NULL DEFAULT 0,
  
  -- Preferred Schedule
  preferred_date DATE NOT NULL,
  preferred_start_time TIME NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 90,
  preferred_ktv_id UUID REFERENCES users(id) ON DELETE SET NULL,
  preferred_resource_id UUID REFERENCES booking_resources(id) ON DELETE SET NULL,
  is_flexible BOOLEAN DEFAULT FALSE, -- Can accept alternative times
  
  -- Priority & Position
  priority_score DECIMAL(5,2) NOT NULL DEFAULT 0, -- 0-100 scale
  position INTEGER NOT NULL DEFAULT 0, -- Current position in queue
  tier_score DECIMAL(5,2) DEFAULT 0, -- Customer tier contribution
  value_score DECIMAL(5,2) DEFAULT 0, -- Booking value contribution
  wait_time_score DECIMAL(5,2) DEFAULT 0, -- Wait time contribution
  flexibility_bonus DECIMAL(5,2) DEFAULT 0, -- Flexibility contribution
  
  -- Status & Timing
  status TEXT NOT NULL CHECK (status IN ('active', 'notified', 'reserved', 'expired', 'converted', 'cancelled')) DEFAULT 'active',
  wait_minutes INTEGER DEFAULT 0, -- Time waited so far
  estimated_wait_minutes INTEGER DEFAULT 0, -- Estimated remaining wait
  
  -- Reservation (when notified)
  reserved_at TIMESTAMPTZ,
  reservation_expires_at TIMESTAMPTZ,
  
  -- Expiry
  expires_at TIMESTAMPTZ NOT NULL, -- Auto-expire after config.waitlistExpiryHours
  
  -- Notification Tracking
  notification_channel TEXT, -- zalo, sms, email
  notified_at TIMESTAMPTZ,
  notification_count INTEGER DEFAULT 0,
  last_notification_at TIMESTAMPTZ,
  
  -- Audit
  notes TEXT,
  removal_reason TEXT, -- If cancelled/removed
  converted_to_booking_id UUID REFERENCES bookings(id), -- If successfully booked
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT unique_active_waitlist UNIQUE (tenant_id, customer_id, service_id, preferred_date) 
    WHERE status IN ('active', 'notified', 'reserved')
);

-- Indexes for Performance
CREATE INDEX idx_waitlist_tenant_id ON waitlist_entries(tenant_id);
CREATE INDEX idx_waitlist_customer_id ON waitlist_entries(customer_id);
CREATE INDEX idx_waitlist_service_date ON waitlist_entries(service_id, preferred_date);
CREATE INDEX idx_waitlist_status ON waitlist_entries(status);
CREATE INDEX idx_waitlist_priority ON waitlist_entries(priority_score DESC, created_at ASC);
CREATE INDEX idx_waitlist_expires_at ON waitlist_entries(expires_at) WHERE status IN ('active', 'notified');
CREATE INDEX idx_waitlist_position ON waitlist_entries(tenant_id, service_id, preferred_date, position);

-- Trigger: Update updated_at
CREATE TRIGGER update_waitlist_entries_updated_at
  BEFORE UPDATE ON waitlist_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger: Audit Log
CREATE TRIGGER audit_waitlist_entries
  AFTER INSERT OR UPDATE OR DELETE ON waitlist_entries
  FOR EACH ROW
  EXECUTE FUNCTION audit_log_trigger();

-- RLS: Enable Row Level Security
ALTER TABLE waitlist_entries ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view waitlist in their tenant
CREATE POLICY "Users can view waitlist in their tenant"
  ON waitlist_entries FOR SELECT
  USING (tenant_id IN (
    SELECT tenant_id FROM user_tenant_access WHERE user_id = auth.uid()
  ));

-- Policy: Admins can manage waitlist in their tenant
CREATE POLICY "Admins can manage waitlist in their tenant"
  ON waitlist_entries FOR ALL
  USING (
    tenant_id IN (
      SELECT uta.tenant_id 
      FROM user_tenant_access uta
      JOIN users u ON u.id = uta.user_id
      WHERE u.id = auth.uid() 
      AND u.role IN ('admin', 'admin_staff')
    )
  );

-- Comments (Documentation)
COMMENT ON TABLE waitlist_entries IS 'Manages customer waitlist with intelligent priority ranking';
COMMENT ON COLUMN waitlist_entries.priority_score IS 'Total priority score (0-100): tier + value + wait_time + flexibility';
COMMENT ON COLUMN waitlist_entries.position IS 'Current position in queue (1 = first, auto-recalculated)';
COMMENT ON COLUMN waitlist_entries.status IS 'active: waiting, notified: sent notification, reserved: slot held, expired: timeout, converted: booked, cancelled: removed';
COMMENT ON COLUMN waitlist_entries.is_flexible IS 'Customer can accept alternative times/dates (gets priority boost)';
```

---

### `waitlist_notification_logs` Table

```sql
CREATE TABLE waitlist_notification_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  waitlist_entry_id UUID NOT NULL REFERENCES waitlist_entries(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  
  notification_type TEXT NOT NULL CHECK (notification_type IN ('slot_available', 'position_updated', 'expiring_soon', 'expired')),
  channel TEXT NOT NULL CHECK (channel IN ('zalo', 'sms', 'email', 'push')),
  
  status TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')) DEFAULT 'pending',
  message_content TEXT,
  
  sent_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notification_logs_entry_id ON waitlist_notification_logs(waitlist_entry_id);
CREATE INDEX idx_notification_logs_status ON waitlist_notification_logs(status);
CREATE INDEX idx_notification_logs_created_at ON waitlist_notification_logs(created_at DESC);
```

---

## 🔄 Integration Points

### 1. Booking Cancellation → Waitlist Processing
**Trigger:** When booking status changes to 'cancelled'  
**Action:** Call `/api/waitlist/process-slot` with cancelled slot details  
**Expected:** Top 3 waitlist customers notified within 30 seconds

### 2. New Slot Created → Waitlist Processing
**Trigger:** When new time slot added to schedule  
**Action:** Call `/api/waitlist/process-slot` with new slot details  
**Expected:** Relevant waitlist entries notified

### 3. Customer Books → Remove from Waitlist
**Trigger:** When waitlist customer books successfully  
**Action:** Update `waitlist_entries.status = 'converted'` and `converted_to_booking_id`  
**Expected:** No duplicate notifications

### 4. Daily Expiry Cleanup (Cron Job)
**Schedule:** Every hour at :00  
**Action:** Call `/api/waitlist/expire-old` (removes entries > 24 hours old)  
**Expected:** Expired entries sent notification, status = 'expired'

---

## 🧪 Testing Strategy

### Unit Tests
- WaitlistManagementProvider (already done)
- waitlist-service.ts functions
- API route handlers

### Integration Tests
- Full flow: Add → Notify → Book → Remove
- Tenant isolation (cannot access other tenant's waitlist)
- Priority calculation (VIP > Loyal > New)
- Expiry cleanup (auto-remove old entries)
- Notification retry (3 attempts on failure)

### E2E Tests (Playwright)
- User adds customer to waitlist via UI
- User processes slot available
- User views notification history
- Customer receives SMS/Zalo notification

### Performance Tests
- 1000 waitlist entries → recalculate positions < 500ms
- 100 concurrent add requests → no deadlocks
- Query with filters → < 100ms response time

---

## 📊 Success Metrics

### Technical Metrics
- [ ] Zero database migration errors
- [ ] 100% TypeScript compilation
- [ ] >80% test coverage
- [ ] <100ms API response time (p95)
- [ ] <500ms position recalculation (1000 entries)

### Business Metrics
- [ ] Pilot customer satisfaction >4/5
- [ ] Waitlist conversion rate >60% (notified → booked)
- [ ] Avg wait time <2 hours
- [ ] Zero critical bugs in staging

### User Experience Metrics
- [ ] Time to add customer to waitlist <30 seconds
- [ ] Notification delivery rate >95%
- [ ] Admin can understand waitlist without training
- [ ] Mobile UI works without issues

---

## 🚧 Risks & Mitigation

### Risk 1: Database Schema Changes Break Existing Code
**Mitigation:** Read all existing code before modifying schema. Use migrations, not manual SQL.

### Risk 2: Notification Service Failures
**Mitigation:** Implement retry logic (3 attempts). Log all failures. Fallback to email if Zalo/SMS fails.

### Risk 3: Performance Issues with Large Waitlists
**Mitigation:** Add database indexes. Use pagination (max 100 items/page). Test with 1000+ entries.

### Risk 4: Tenant Data Leaks
**Mitigation:** Enable RLS on all tables. Add explicit tenant_id checks in service layer. Write tenant isolation tests.

### Risk 5: Priority Calculation Bugs
**Mitigation:** Use existing WaitlistManagementProvider (already tested). Write integration tests for edge cases.

---

## 📝 Next Actions

**IMMEDIATE (Today):**
1. ✅ Approve this implementation plan
2. ⏳ Start Day 1-2: Database Schema Design
  - Read existing schema files thoroughly
  - Design `waitlist_entries` table
  - Write migration file
  - Test migration locally

**THIS WEEK:**
- Days 1-2: Database schema
- Days 3-4: Backend service layer
- Days 5-7: API routes

**NEXT WEEK:**
- Days 8-10: UI components
- Days 11-12: Notifications
- Days 13-14: Testing + pilot

---

**Last Updated:** 2026-07-10  
**Status:** Pending Approval  
**Next Review:** After Day 2 (schema complete)
