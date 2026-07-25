# Booking Engine - Comprehensive Design Specification

**Version**: 1.0.0  
**Created**: 2026-07-09  
**Owner**: CTO Office  
**Status**: 📋 Design Phase  
**Priority**: ⭐⭐⭐⭐⭐ Critical (Foundation cho Revenue Generation)

---

## 🏗️ ARCHITECTURE POSITION

```
Core Platform Layer
  ├── Decision Engine (Core)
  ├── Workflow Engine (Core)
  └── BI Engine (Core)

Business Engine Layer
  ├── Booking Engine        ← THIS
  ├── Payroll Engine
  ├── POS Engine
  └── ...

Booking Engine (Business)
  ├── Assignment Provider
  ├── Capacity Provider
  ├── Conflict Provider
  ├── Waitlist Provider
  ├── Pricing Provider
  └── Cancellation Provider
```

**Note**: This is a **Business Engine**, not Core Platform. The "Providers" inside Booking Engine are **business-specific providers**, different from Decision Engine Providers (Booking Provider, Payroll Provider already in Core Platform).

---

## 🎯 EXECUTIVE SUMMARY

### Vision
Transform Booking from "manual scheduling tool" → **Intelligent Revenue Optimization Engine**

### Current State (Pain Points)
- ❌ Manual KTV assignment → Time-consuming, suboptimal
- ❌ No capacity management → Overbooking/underbooking
- ❌ Booking conflicts undetected → Customer dissatisfaction
- ❌ No waitlist → Lost revenue opportunities
- ❌ Fixed pricing → Leave money on the table
- ❌ Manual cancellation handling → Administrative burden

### Target State (After Booking Engine)
- ✅ Auto-assign KTV in <1 second (skills, availability, workload balanced)
- ✅ Real-time capacity visibility (prevent overbooking)
- ✅ Conflict detection & resolution (before customer confirmation)
- ✅ Automated waitlist management (convert waiting → bookings)
- ✅ Dynamic pricing (maximize revenue per slot)
- ✅ Smart cancellation logic (minimize refunds, maximize rebooking)

### Expected Impact
- **+15-20% booking conversion** (reduce conflicts, optimize capacity)
- **+10-15% revenue per booking** (dynamic pricing)
- **-50% admin time** (automation)
- **+25% KTV utilization** (balanced workload)

---

## 📊 SCOPE & COMPONENTS

### Booking Engine - 6 Core Providers


#### 1. Assignment Provider 🤖
**Purpose**: Tự động gán KTV tối ưu cho mỗi booking

**Decision Factors**:
- Skills match (package type → KTV specialty)
- Availability (schedule, confirmed bookings, leaves)
- Workload balance (sessions today, this week)
- Performance score (rating, completion rate)
- Customer preference (repeat customer → same KTV)
- Location proximity (multi-branch)

**Output**: Ranked list of suitable KTVs with confidence score

---

#### 2. Capacity Provider 📊
**Purpose**: Real-time capacity tracking & optimization

**Tracks**:
- Per KTV: Max sessions/day, current load, available slots
- Per Time Slot: Total capacity, booked, available, buffer
- Per Package Type: Session duration, setup time, cleanup time
- Per Branch: Total capacity, distribution across KTVs

**Decisions**:
- Accept/reject booking based on capacity
- Suggest alternative time slots
- Trigger waitlist when fully booked
- Alert manager when nearing capacity limit

---

#### 3. Conflict Provider ⚠️
**Purpose**: Phát hiện & resolve conflicts trước khi confirm

**Conflict Types**:
- **Double-booking**: Same KTV, overlapping time
- **Overbooking**: Capacity exceeded for time slot
- **Equipment conflict**: Room/equipment already booked
- **Package conflict**: Incompatible packages (e.g., Mother & Baby requires specific room)
- **Leave conflict**: KTV on leave during booking time
- **Holiday conflict**: Booking on closed days

**Resolution Strategies**:
- Auto-suggest alternative KTV
- Auto-suggest alternative time slot
- Offer waitlist option
- Escalate to manager (complex conflicts)

---

#### 4. Waitlist Provider 📋
**Purpose**: Convert waiting customers → confirmed bookings

**Waitlist Triggers**:
- Fully booked time slot
- Preferred KTV unavailable
- Equipment unavailable

**Auto-conversion Logic**:
- Monitor cancellations → Auto-offer to waitlist (priority order)
- Monitor new availability → Notify waitlist customers
- Monitor capacity expansion → Batch process waitlist
- Expiry logic → Remove after 7 days without action

**Priority Scoring**:
- VIP customers (highest priority)
- Loyal customers (high priority)
- First-come-first-served (standard)
- Package value (higher value → higher priority)

---

#### 5. Pricing Provider 💰
**Purpose**: Optimize revenue per time slot

**Pricing Factors**:
- **Demand**: Booking velocity for time slot (high demand → surge pricing)
- **Time**: Peak hours (10am-2pm, 6pm-9pm) → +10-20%
- **Day**: Weekend → +15%, Holiday → +25%
- **Advance**: Last-minute (<24h) → +20%, Early bird (>7 days) → -10%
- **Customer Tier**: VIP → loyalty discount, New → first-time discount
- **Capacity**: Low utilization (<50%) → discount to fill, High (>80%) → premium
- **Package**: Combo packages → bundled discount
- **Season**: High season (Tet, Summer) → seasonal pricing

**Pricing Rules**:
- Base price from package configuration
- Apply multipliers (demand, time, day, advance)
- Apply customer discounts (tier, loyalty, referral)
- Round to nearest 1,000 VND
- Min price floor (never below cost)
- Max price ceiling (brand positioning)

**Examples**:
```
Base: 500,000 VND (Standard Package)
Peak hour (+15%): 575,000
Weekend (+15%): 661,250
High demand (+10%): 727,375
Rounded: 730,000 VND

VIP customer (-15%): 620,500
Rounded: 620,000 VND (final price)
```

---

#### 6. Cancellation Provider 🔄
**Purpose**: Minimize revenue loss, maximize rebooking

**Cancellation Policies** (Time-based):
- **>48h before**: 100% refund or reschedule free
- **24-48h before**: 50% refund or reschedule with 100k fee
- **<24h before**: No refund, reschedule with 50% fee
- **No-show**: No refund, no reschedule

**Smart Refund Decisions**:
- Check customer history (frequent cancellations → stricter)
- Check booking value (high-value → flexible, retain customer)
- Check reason (emergency → flexible, casual → strict)
- Check capacity impact (can resell slot → full refund, cannot → partial)

**Rebooking Optimization**:
- Auto-suggest alternative slots (same KTV, similar time)
- Priority for rescheduled bookings (prevent churn)
- Discount voucher for future booking (retain customer)
- Waitlist notification (if slot can be filled)

---

## 🏗️ ARCHITECTURE

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                     Booking Engine (Frontend)                │
│  - Booking Form UI                                           │
│  - Calendar View                                             │
│  - Capacity Dashboard                                        │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│              Booking Orchestrator (Workflow)                 │
│  - Step 1: Validate Request                                  │
│  - Step 2: Check Capacity                                    │
│  - Step 3: Detect Conflicts                                  │
│  - Step 4: Auto-assign KTV                                   │
│  - Step 5: Calculate Price                                   │
│  - Step 6: Create Booking or Waitlist                        │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│                 Decision Engine (Core)                       │
│  - Auto-Assignment Provider                                  │
│  - Capacity Provider                                         │
│  - Conflict Provider                                         │
│  - Waitlist Provider                                         │
│  - Pricing Provider                                          │
│  - Cancellation Provider                                     │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│                      Data Layer                              │
│  - bookings, booking_service_items                           │
│  - employees (KTV availability)                              │
│  - attendance (leave tracking)                               │
│  - sessions (capacity tracking)                              │
│  - waitlist (new table)                                      │
│  - pricing_rules (new table)                                 │
└─────────────────────────────────────────────────────────────┘
```

### Database Schema Changes

**New Tables**:

```sql
-- Waitlist Management
CREATE TABLE waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  customer_id UUID NOT NULL REFERENCES customers(id),
  package_id UUID NOT NULL REFERENCES packages(id),
  preferred_date DATE NOT NULL,
  preferred_time_slot TEXT, -- 'morning', 'afternoon', 'evening'
  preferred_ktv_id UUID REFERENCES employees(id),
  priority_score INT NOT NULL DEFAULT 0, -- VIP=100, Loyal=50, New=0
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'converted', 'expired', 'cancelled'
  expires_at TIMESTAMP NOT NULL, -- Auto-expire after 7 days
  notified_at TIMESTAMP, -- Last notification sent
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Dynamic Pricing Rules
CREATE TABLE pricing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  rule_type TEXT NOT NULL, -- 'peak_hour', 'weekend', 'demand', 'advance', 'seasonal'
  condition JSONB NOT NULL, -- e.g., {"hour_range": [10, 14], "days": ["Mon", "Fri"]}
  multiplier NUMERIC(3,2) NOT NULL, -- 1.15 = +15%
  priority INT NOT NULL DEFAULT 0, -- Higher priority applies first
  enabled BOOLEAN DEFAULT true,
  valid_from DATE,
  valid_to DATE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Capacity Snapshots (for reporting)
CREATE TABLE capacity_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  snapshot_date DATE NOT NULL,
  snapshot_hour INT NOT NULL, -- 0-23
  total_capacity INT NOT NULL,
  booked INT NOT NULL,
  available INT NOT NULL,
  utilization_rate NUMERIC(5,2), -- Percentage
  created_at TIMESTAMP DEFAULT NOW()
);

-- Booking History (for analytics)
CREATE TABLE booking_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id),
  event_type TEXT NOT NULL, -- 'created', 'assigned', 'confirmed', 'cancelled', 'rescheduled', 'completed'
  event_data JSONB, -- Additional context
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 🔄 WORKFLOWS

### Workflow 1: New Booking Creation

**Input**: Customer, Package, Preferred Date/Time, Preferred KTV (optional)

**Steps**:
1. **Validate Request**
   - Check package exists & active
   - Check customer exists & not blocked
   - Check date/time is future (not past)
   - Check tenant operating hours

2. **Check Capacity**
   - Query available capacity for time slot
   - Decision: `CapacityProvider.checkAvailability()`
   - If no capacity → Go to Waitlist flow

3. **Detect Conflicts**
   - Check KTV availability (leaves, existing bookings)
   - Check equipment availability
   - Check holiday calendar
   - Decision: `ConflictProvider.detectConflicts()`
   - If conflicts → Suggest alternatives or Waitlist

4. **Auto-assign KTV**
   - Get list of eligible KTVs
   - Score KTVs (skills, availability, workload, rating)
   - Decision: `AutoAssignmentProvider.assignKTV()`
   - Return top 3 recommendations

5. **Calculate Price**
   - Get base price from package
   - Apply pricing rules (demand, time, customer tier)
   - Decision: `PricingProvider.calculatePrice()`
   - Return final price with breakdown

6. **Create Booking**
   - Insert booking record (status='pending_confirmation')
   - Insert booking_service_items
   - Send confirmation email/SMS
   - Emit event: `booking.created`

7. **Update Capacity**
   - Decrement available capacity
   - Update KTV schedule
   - Trigger capacity snapshot

**Output**: Booking created (pending confirmation) or Waitlist entry

---

### Workflow 2: Waitlist Conversion

**Trigger**: Cancellation detected OR New capacity added

**Steps**:
1. **Identify Waitlist Candidates**
   - Query waitlist for matching date/time
   - Filter by priority_score (VIP first)
   - Check expiry (skip expired entries)

2. **Check Availability**
   - Verify capacity still available
   - Verify KTV still available
   - Decision: `CapacityProvider.checkAvailability()`

3. **Notify Customer**
   - Send SMS/Email: "Slot available! Book now"
   - Set expiry: 2 hours to respond
   - Update waitlist: notified_at = NOW()

4. **Convert to Booking** (if customer accepts)
   - Run "New Booking Creation" workflow
   - Update waitlist: status='converted'
   - Emit event: `waitlist.converted`

5. **Cleanup**
   - Mark expired waitlist entries as 'expired'
   - Remove entries older than 30 days

---

### Workflow 3: Cancellation & Refund

**Input**: Booking ID, Cancellation Reason, Requested By

**Steps**:
1. **Validate Cancellation**
   - Check booking exists & not already cancelled
   - Check booking not completed
   - Check requester permission (customer or staff)

2. **Determine Refund Policy**
   - Calculate hours until booking time
   - Decision: `CancellationProvider.calculateRefund()`
   - Return refund amount & policy applied

3. **Process Refund** (if applicable)
   - Create refund transaction
   - Update customer balance or payment reversal
   - Emit event: `booking.refund_processed`

4. **Update Booking**
   - Set status='cancelled'
   - Record cancellation reason & timestamp
   - Insert booking_event (type='cancelled')

5. **Release Capacity**
   - Increment available capacity
   - Update KTV schedule
   - Trigger capacity snapshot

6. **Notify Waitlist**
   - Trigger "Waitlist Conversion" workflow
   - Offer slot to next customer in queue

7. **Customer Retention**
   - Send rebooking suggestion email
   - Offer discount voucher (if high-value customer)
   - Emit event: `booking.cancelled`

---

### Workflow 4: Dynamic Pricing Calculation

**Input**: Package, Date, Time, Customer

**Steps**:
1. **Get Base Price**
   - Query package base price
   - Check if promotional price exists

2. **Apply Time Multipliers**
   - Check peak hour rules (morning, evening)
   - Check day-of-week rules (weekend)
   - Check seasonal rules (Tet, Summer)
   - Decision: `PricingProvider.getTimeMultipliers()`

3. **Apply Demand Multipliers**
   - Query booking velocity for time slot
   - Calculate utilization rate
   - Decision: `PricingProvider.getDemandMultiplier()`
   - High demand (>80%) → +10-20%
   - Low demand (<30%) → -10-15%

4. **Apply Customer Discounts**
   - Check customer tier (VIP, Loyal, New)
   - Check loyalty points balance
   - Check active campaigns
   - Decision: `DiscountProvider.getCustomerDiscount()`

5. **Calculate Final Price**
   - Base × Time Multipliers × Demand Multiplier
   - Apply customer discount
   - Round to nearest 1,000 VND
   - Enforce min/max price bounds

6. **Return Breakdown**
   ```json
   {
     "base_price": 500000,
     "time_multiplier": 1.15,
     "demand_multiplier": 1.10,
     "customer_discount": 0.85,
     "final_price": 620000,
     "breakdown": {
       "base": 500000,
       "peak_hour": 75000,
       "high_demand": 50000,
       "vip_discount": -105000
     }
   }
   ```

---

## 🧪 TESTING STRATEGY

### Test Coverage Goals
- **Unit Tests**: 90%+ coverage (all decision logic)
- **Integration Tests**: 50+ scenarios (workflows end-to-end)
- **Performance Tests**: <100ms per decision, 1000+ bookings/hour
- **Load Tests**: 10,000 concurrent users, 100,000 bookings/day

### Critical Test Scenarios

#### Auto-Assignment Engine (15 scenarios)
1. Single KTV available → Assign directly
2. Multiple KTVs available → Assign highest score
3. No KTV available → Return empty list
4. KTV on leave → Skip from candidates
5. KTV fully booked → Skip from candidates
6. Customer prefers specific KTV → Prioritize if available
7. Repeat customer → Assign same KTV (if available)
8. Skills mismatch → Exclude from candidates
9. Multi-branch → Assign from customer's preferred branch
10. Workload balancing → Assign least loaded KTV
11. Performance score → Higher rating KTV prioritized
12. Location proximity → Closest KTV prioritized
13. Equal scores → Round-robin assignment
14. Override assignment → Manual assignment allowed
15. Capacity buffer → Leave 10% buffer for walk-ins

#### Capacity Management (12 scenarios)
1. Available capacity → Accept booking
2. No capacity → Offer waitlist
3. Partial capacity → Suggest alternative time
4. Overbooking protection → Reject when at 100%
5. Buffer management → Reserve 10% for VIP/walk-ins
6. Multi-package → Calculate combined duration
7. Setup time → Include in capacity calculation
8. Cleanup time → Include in capacity calculation
9. Real-time updates → Reflect cancellations immediately
10. Capacity expansion → Notify waitlist
11. Capacity reduction → Block new bookings
12. Reporting → Daily capacity utilization report

#### Conflict Detection (10 scenarios)
1. Double-booking → Detect & prevent
2. Equipment conflict → Detect & suggest alternative
3. Leave conflict → Detect & exclude KTV
4. Holiday conflict → Detect & reject
5. Room conflict → Detect & suggest alternative room
6. Package incompatibility → Detect & warn
7. Multiple conflicts → Resolve priority (most critical first)
8. Conflict resolution → Auto-suggest alternatives
9. Override conflicts → Allow with manager approval
10. Conflict alerts → Notify manager

#### Waitlist Management (8 scenarios)
1. Add to waitlist → Priority scoring correct
2. Notify on availability → SMS/Email sent
3. Auto-convert → Create booking when customer accepts
4. Priority ordering → VIP first, then FIFO
5. Expiry logic → Remove after 7 days
6. Multi-customer → Notify all, first-accept wins
7. Partial availability → Notify partial match
8. Cleanup → Archive old waitlist entries

#### Dynamic Pricing (10 scenarios)
1. Base price → No multipliers applied
2. Peak hour → +15% applied
3. Weekend → +15% applied
4. High demand → +10-20% applied
5. Low demand → -10-15% applied
6. VIP customer → Discount applied
7. New customer → First-time discount
8. Combo package → Bundle discount
9. Last-minute → Surge pricing
10. Early bird → Advance discount

#### Cancellation Logic (10 scenarios)
1. >48h cancellation → 100% refund
2. 24-48h cancellation → 50% refund
3. <24h cancellation → No refund
4. No-show → No refund
5. Emergency cancellation → Flexible refund
6. Frequent canceller → Stricter policy
7. High-value customer → Retention offer
8. Reschedule free → Within policy
9. Reschedule with fee → Outside policy
10. Waitlist notification → Trigger on cancellation

---

## 📈 PERFORMANCE TARGETS

### Latency Targets
- Auto-assignment decision: <50ms
- Capacity check: <20ms
- Conflict detection: <30ms
- Pricing calculation: <40ms
- Full booking creation: <500ms

### Throughput Targets
- 1,000 bookings/hour sustained
- 10,000 concurrent capacity checks
- 100 waitlist conversions/minute

### Scalability Targets
- Support 1,000+ KTVs per tenant
- Support 10,000+ bookings/day per tenant
- Support 100+ branches per tenant

---

## 🚀 IMPLEMENTATION PLAN

### Week 1: Foundation
**Days 1-2**: Database schema & migrations
- Create new tables (waitlist, pricing_rules, capacity_snapshots, booking_events)
- Add indexes for performance
- Seed test data

**Days 3-5**: Core Providers
- Auto-Assignment Provider (rules + logic)
- Capacity Provider (rules + logic)
- Conflict Provider (rules + logic)

### Week 2: Decision Logic
**Days 6-8**: More Providers
- Waitlist Provider (rules + logic)
- Pricing Provider (rules + logic)
- Cancellation Provider (rules + logic)

**Days 9-10**: Provider Integration
- Provider adapters
- Integration with existing booking flow
- Feature flags

### Week 3: Workflows & Testing
**Days 11-13**: Workflow Implementation
- New Booking Creation workflow
- Waitlist Conversion workflow
- Cancellation & Refund workflow
- Dynamic Pricing workflow

**Days 14-15**: Testing & Refinement
- Unit tests (90%+ coverage)
- Integration tests (50+ scenarios)
- Performance tests
- Bug fixes

### Week 4 (if needed): Polish & Launch
- Load testing
- Production deployment
- Monitoring setup
- Documentation

---

## 📋 DELIVERABLES

### Code Deliverables
- [ ] 6 Decision Providers (~1,500 lines)
- [ ] 4 Workflow definitions (~800 lines)
- [ ] 4 Database migrations (~400 lines)
- [ ] Provider adapters (~600 lines)
- [ ] API routes (~400 lines)
- [ ] 65+ comprehensive tests (~2,000 lines)

### Documentation Deliverables
- [ ] This design spec (~current file)
- [ ] API documentation
- [ ] User guide (for booking staff)
- [ ] Admin guide (for configuration)
- [ ] Runbook (troubleshooting)

### Total Estimated LOC: ~5,700 lines

---

## 🎯 SUCCESS CRITERIA

### Technical Success
- [ ] All 65+ test scenarios passing
- [ ] Latency <50ms for all decisions
- [ ] Throughput >1,000 bookings/hour
- [ ] Zero data loss (ACID compliance)
- [ ] 99.9% uptime

### Business Success
- [ ] +15% booking conversion rate (baseline vs 4 weeks after)
- [ ] +10% revenue per booking (dynamic pricing impact)
- [ ] -50% admin time (automation savings)
- [ ] +20% KTV utilization rate
- [ ] <5% cancellation rate

### User Success
- [ ] <5 seconds booking creation (end-to-end)
- [ ] <3 clicks for standard booking
- [ ] 80%+ customer satisfaction (post-booking survey)
- [ ] <1% error rate (conflicts, overbooking)

---

## ⚠️ RISKS & MITIGATION

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Complex logic → Bugs | High | Medium | Comprehensive testing, staged rollout |
| Performance degradation | High | Low | Load testing, caching, database optimization |
| Business rules mismatch | Medium | Medium | Involve business users early, iterate |
| Data migration issues | Medium | Low | Careful migration scripts, backups |
| User adoption resistance | Low | Medium | Training, gradual rollout, feedback loop |

---

## 📞 STAKEHOLDERS

### Decision Makers
- **CEO**: Final approval on pricing strategy
- **CPO**: Product requirements validation
- **CFO**: Revenue impact validation

### Contributors
- **Backend Engineers** (2 FTE): Providers, workflows, APIs
- **Frontend Engineers** (1 FTE): Booking UI, calendar, dashboard
- **QA Engineer** (1 FTE): Test automation, UAT
- **Business Analyst** (0.5 FTE): Business rules, validation

### Reviewers
- **Booking Manager**: Operational validation
- **KTV Team Leads**: Assignment logic validation
- **Finance Team**: Pricing & refund logic validation

---

**Next Steps**:
1. ✅ Review & approve this design spec
2. 📋 Create detailed task breakdown (Jira/Linear)
3. 📋 Set up development environment
4. 📋 Kick-off meeting with team
5. 📋 Start Week 1: Database schema

---

**Last Updated**: 2026-07-09  
**Status**: Awaiting Approval  
**Owner**: CTO Office
