# Booking Engine Integration Tests

## 📋 OVERVIEW

Comprehensive integration tests cho Booking Engine schema deployment:
- **4 Tables**: waitlist, pricing_rules, capacity_snapshots, booking_events
- **3 Functions**: expire_old_waitlist_entries, calculate_waitlist_priority, get_available_capacity
- **Total Test Cases**: 35+

---

## 🚀 RUNNING TESTS

### Run all Booking Engine tests:
```bash
npm run test:booking-engine
```

### Run specific test file:
```bash
npm test -- booking-engine-schema.test.ts
```

### Run with coverage:
```bash
npm test -- booking-engine-schema.test.ts --coverage
```

### Run in watch mode:
```bash
npm test -- booking-engine-schema.test.ts --watch
```

---

## 📊 TEST COVERAGE

### Table Tests (4 suites, 27 test cases)

#### **waitlist** (6 tests)
- ✅ Insert waitlist entry
- ✅ Enforce priority_score constraints (0-100)
- ✅ Enforce time_slot enum (morning, afternoon, evening)
- ✅ Update waitlist status
- ✅ Query active waitlist by priority
- ✅ Delete waitlist entry

#### **pricing_rules** (6 tests)
- ✅ Insert pricing rule
- ✅ Enforce multiplier constraints (0 < x <= 3.0)
- ✅ Enforce rule_type enum (7 types)
- ✅ Query enabled rules by priority
- ✅ Disable pricing rule
- ✅ Delete pricing rule

#### **capacity_snapshots** (6 tests)
- ✅ Insert capacity snapshot
- ✅ Enforce capacity constraints (booked <= total)
- ✅ Enforce utilization_rate constraints (0-100)
- ✅ Enforce unique constraint (tenant + date + hour)
- ✅ Query snapshots by date range
- ✅ Delete capacity snapshot

#### **booking_events** (5 tests)
- ✅ Insert booking event
- ✅ Enforce event_type enum (13 types)
- ✅ Insert event with full audit data (IP, user agent)
- ✅ Query events by booking_id
- ✅ Query events by event_type

### Function Tests (3 suites, 5 test cases)

#### **calculate_waitlist_priority** (2 tests)
- ✅ Calculate priority for customer (returns 0-100)
- ✅ Return 0 for non-existent customer (graceful handling)

#### **get_available_capacity** (2 tests)
- ✅ Get capacity for time slot (returns 5 fields)
- ✅ Work for all time slots (morning, afternoon, evening)

#### **expire_old_waitlist_entries** (1 test)
- ✅ Expire old waitlist entries (status changes to 'expired')

---

## 🛠️ PREREQUISITES

### 1. Environment Variables
Ensure `.env.local` has:
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 2. Database Migration
Migration `20260709140002_booking_engine_schema_v3_final.sql` must be deployed:
```bash
# Verify tables exist
npx supabase db execute --linked "SELECT table_name FROM information_schema.tables WHERE table_name IN ('waitlist', 'pricing_rules', 'capacity_snapshots', 'booking_events');"
```

### 3. Test Data
Tests require existing:
- ✅ At least 1 tenant
- ✅ At least 1 customer
- ✅ At least 1 package
- ✅ At least 1 booking
- ✅ At least 1 KTV user (role='ktv')

---

## 📝 TEST STRUCTURE

```typescript
describe('Booking Engine Schema - Tables', () => {
  beforeAll(async () => {
    // Setup: Get test tenant, customer, package, booking, user IDs
  });

  describe('TABLE: waitlist', () => {
    test('should insert waitlist entry', async () => { ... });
    test('should enforce priority_score constraints', async () => { ... });
    // ... more tests
  });

  describe('TABLE: pricing_rules', () => { ... });
  describe('TABLE: capacity_snapshots', () => { ... });
  describe('TABLE: booking_events', () => { ... });
});

describe('Booking Engine Schema - Functions', () => {
  beforeAll(async () => { ... });

  describe('FUNCTION: calculate_waitlist_priority', () => { ... });
  describe('FUNCTION: get_available_capacity', () => { ... });
  describe('FUNCTION: expire_old_waitlist_entries', () => { ... });
});
```

---

## ✅ EXPECTED RESULTS

### All tests passing:
```
PASS src/__tests__/booking-engine/booking-engine-schema.test.ts
  Booking Engine Schema - Tables
    TABLE: waitlist
      ✓ should insert waitlist entry (XXXms)
      ✓ should enforce priority_score constraints (0-100) (XXXms)
      ✓ should enforce time_slot enum (XXXms)
      ✓ should update waitlist status (XXXms)
      ✓ should query active waitlist by priority (XXXms)
      ✓ should delete waitlist entry (XXXms)
    TABLE: pricing_rules
      ✓ should insert pricing rule (XXXms)
      ✓ should enforce multiplier constraints (0 < x <= 3.0) (XXXms)
      ✓ should enforce rule_type enum (XXXms)
      ✓ should query enabled rules by priority (XXXms)
      ✓ should disable pricing rule (XXXms)
      ✓ should delete pricing rule (XXXms)
    TABLE: capacity_snapshots
      ✓ should insert capacity snapshot (XXXms)
      ✓ should enforce capacity constraints (booked <= total) (XXXms)
      ✓ should enforce utilization_rate constraints (0-100) (XXXms)
      ✓ should enforce unique constraint (tenant + date + hour) (XXXms)
      ✓ should query snapshots by date range (XXXms)
      ✓ should delete capacity snapshot (XXXms)
    TABLE: booking_events
      ✓ should insert booking event (XXXms)
      ✓ should enforce event_type enum (XXXms)
      ✓ should insert event with full audit data (XXXms)
      ✓ should query events by booking_id (XXXms)
      ✓ should query events by event_type (XXXms)
  Booking Engine Schema - Functions
    FUNCTION: calculate_waitlist_priority
      ✓ should calculate priority for customer (XXXms)
      ✓ should return 0 for non-existent customer (XXXms)
    FUNCTION: get_available_capacity
      ✓ should get capacity for time slot (XXXms)
      ✓ should work for all time slots (XXXms)
    FUNCTION: expire_old_waitlist_entries
      ✓ should expire old waitlist entries (XXXms)

Test Suites: 1 passed, 1 total
Tests:       32 passed, 32 total
Snapshots:   0 total
Time:        XX.XXXs
```

---

## 🐛 TROUBLESHOOTING

### Test fails: "relation does not exist"
**Solution**: Migration not deployed. Run migration first.

### Test fails: "No rows returned" in beforeAll
**Solution**: No test data. Seed at least 1 tenant, customer, package, booking, user.

### Test fails: RLS policy error
**Solution**: Service role key required. Check `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`.

### Test timeout
**Solution**: Increase Jest timeout:
```typescript
jest.setTimeout(30000); // 30 seconds
```

---

## 📈 CI/CD INTEGRATION

### Add to CI pipeline:
```yaml
# .github/workflows/test.yml
- name: Run Booking Engine Tests
  run: npm run test:booking-engine
  env:
    NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
    SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
```

### Add to pre-commit hook:
```bash
# .husky/pre-commit
npm run test:booking-engine
```

---

## 🎯 NEXT STEPS

After all tests pass:
1. **Update Provider implementations** với real database queries
2. **Write Provider unit tests** cho business logic
3. **Add E2E tests** cho booking workflows
4. **Add performance tests** cho capacity calculations

---

## 📚 RELATED DOCUMENTATION

- `docs/BOOKING_ENGINE_DESIGN_SPEC.md` - Design specification
- `docs/BOOKING_ENGINE_DATABASE_SCHEMA.md` - Schema documentation
- `docs/BOOKING_ENGINE_DEPLOYMENT_SUCCESS.md` - Deployment report
- `supabase/VERIFY_BOOKING_ENGINE_DEPLOYMENT.sql` - Verification queries

---

**Last Updated**: 2026-07-09  
**Test Suite Version**: 1.0.0  
**Migration Version**: 20260709140002_booking_engine_schema_v3_final.sql
