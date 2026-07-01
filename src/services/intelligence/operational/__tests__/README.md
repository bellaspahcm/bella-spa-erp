# Operational Intelligence Tests

This directory contains tests for the Operational Intelligence service layer.

## Test Types

### 1. Unit Tests (`service.test.ts`)
**Status**: ✅ 10/10 passing  
**Run**: `npm test -- service.test.ts`

Tests service layer with mocked cache (no database):
- Cache hit/miss scenarios
- Cache key construction
- healthCheck and clearCache methods
- Error resilience (graceful degradation)

**Dependencies**: None (fully mocked)

---

### 2. Integration Tests (`integration.test.ts`)
**Status**: ⏳ Requires real Supabase instance  
**Run**: `npm test -- integration.test.ts`

Tests operational queries with real database:
- KTV performance data structure validation
- Leaderboard rankings and sorting
- Inventory status filtering
- Session analytics aggregation
- Capacity utilization calculations
- Error handling (invalid UUIDs, non-existent records)

**Dependencies**: Supabase credentials + test data

---

## Running Integration Tests

### Prerequisites

1. **Supabase Instance** with test data:
   - Test tenant with UUID
   - Test KTV user with UUID
   - Materialized views populated (run refresh manually or wait for cron)
   - Sample data: sessions, attendance, inventory, bookings

2. **Environment Variables** (in `.env.local` or `.env.test`):
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   TEST_TENANT_ID=your-test-tenant-uuid
   TEST_KTV_ID=your-test-ktv-user-uuid
   ```

### Setup Steps

1. **Copy environment template**:
   ```bash
   cp .env.local .env.test
   ```

2. **Get test IDs from Supabase**:
   ```sql
   -- Find a test tenant
   SELECT id, name FROM tenants WHERE name LIKE '%Test%' OR name LIKE '%Demo%' LIMIT 1;
   
   -- Find a KTV user in that tenant
   SELECT id, full_name, role FROM users 
   WHERE tenant_id = 'YOUR_TENANT_ID' AND role = 'ktv' 
   LIMIT 1;
   ```

3. **Set environment variables**:
   ```bash
   TEST_TENANT_ID=<tenant-id-from-above>
   TEST_KTV_ID=<ktv-id-from-above>
   ```

4. **Refresh materialized views** (if needed):
   ```sql
   REFRESH MATERIALIZED VIEW CONCURRENTLY mv_ktv_performance_summary;
   REFRESH MATERIALIZED VIEW CONCURRENTLY mv_inventory_status;
   REFRESH MATERIALIZED VIEW CONCURRENTLY mv_session_analytics;
   ```

5. **Run tests**:
   ```bash
   npm test -- integration.test.ts
   ```

### Expected Output

**With credentials (passing)**:
```
[Integration Tests] Running with Supabase: https://...
[Integration Tests] Test Tenant: 550e8400-...
[Integration Tests] Test KTV: 6ba7b810-...

✓ should fetch KTV performance data with valid structure (124ms)
✓ should handle different time periods (387ms)
✓ should fetch leaderboard with proper rankings (156ms)
...
Test Suites: 1 passed, 1 total
Tests:       12 passed, 12 total
```

**Without credentials (skip)**:
```
Test Suites: 1 skipped, 0 of 1 total
Tests:       1 skipped, 1 total
```

---

## Test Coverage Summary

| Test Suite | Status | Tests | Coverage |
|------------|--------|-------|----------|
| Unit Tests | ✅ | 10/10 | Cache logic, error handling |
| Integration Tests | ⏳ | 0/12 | Database queries, data validation |

**Total**: 10/22 tests passing (45% - unit tests only)

**Next Steps**:
1. Set up test Supabase instance
2. Seed test data
3. Run integration tests
4. Add performance benchmarks (Task #10)

---

## Troubleshooting

### Tests skip automatically
- Missing `NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Check `.env.local` or `.env.test` file

### "Invalid UUID" errors
- Check `TEST_TENANT_ID` and `TEST_KTV_ID` format
- Must be valid UUID v4 (8-4-4-4-12 hex digits)

### Empty results but no errors
- Materialized views not refreshed yet
- Run manual refresh SQL (see Setup Steps #4)
- Wait 10 minutes for auto-refresh (pg_cron job)

### "No data found" warnings
- Test tenant has no sessions/bookings/inventory data
- Seed test data or use production-like demo tenant

---

## CI/CD Integration

Integration tests can be configured to:
- **Skip in CI** (default): Fast builds, no external dependencies
- **Run in CI with test DB**: Requires CI secrets for Supabase credentials

**GitHub Actions example**:
```yaml
env:
  NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.TEST_SUPABASE_URL }}
  NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.TEST_SUPABASE_ANON_KEY }}
  TEST_TENANT_ID: ${{ secrets.TEST_TENANT_ID }}
  TEST_KTV_ID: ${{ secrets.TEST_KTV_ID }}

- name: Run Integration Tests
  run: npm test -- integration.test.ts
```

If secrets not set, tests skip gracefully (exit 0).
