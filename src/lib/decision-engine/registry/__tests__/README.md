# PolicyRegistry Integration Tests

Integration tests for PolicyRegistry with real Supabase database.

## Prerequisites

### 1. Environment Variables

Copy `.env.test.example` to `.env.test` and fill in your values:

```bash
cp .env.test.example .env.test
```

Required variables:
- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - **Service role key (for testing only)**

⚠️ **NEVER commit `.env.test` to git!**

### 2. Database Schema

Make sure the database schema is deployed:

```sql
-- Tables required:
- policy_registry
- policy_history
```

Run migrations:
```bash
npx supabase db push
```

## Running Tests

### Run all tests (unit + integration):
```bash
npm test
```

### Run integration tests only:
```bash
npm test -- PolicyRegistry.integration.test.ts
```

### Run with coverage:
```bash
npm test -- PolicyRegistry.integration.test.ts --coverage
```

### Run specific test suite:
```bash
npm test -- PolicyRegistry.integration.test.ts -t "Full Lifecycle Flow"
```

## Test Structure

### Test Suites

1. **Full Lifecycle Flow** - Complete policy lifecycle (register → publish → deprecate)
2. **Policy Versioning** - Multiple versions, activation/deactivation
3. **Decision Statistics** - Recording and tracking decision metrics
4. **Governance Validation** - Governance checks and policy expiry
5. **Query Operations** - Listing, filtering, and checking existence
6. **Error Handling** - Error cases and invalid transitions

### Test Database

- Tests use **service role key** to bypass RLS policies
- Each test creates unique policy IDs with timestamp + random suffix
- Automatic cleanup in `afterEach` and `afterAll` hooks
- Test data prefix: `test-*`

## Debugging

### Enable verbose logging:
```bash
DEBUG=* npm test -- PolicyRegistry.integration.test.ts
```

### Check database state manually:
```sql
-- View test policies
SELECT * FROM policy_registry WHERE policy_id LIKE 'test-%';

-- View test audit logs
SELECT * FROM policy_history WHERE policy_id LIKE 'test-%';

-- Clean up manually (if needed)
DELETE FROM policy_history WHERE policy_id LIKE 'test-%';
DELETE FROM policy_registry WHERE policy_id LIKE 'test-%';
```

### Common Issues

**Issue: `cookies` was called outside a request scope**
- **Solution**: Integration tests mock `@/lib/supabase-server` to use `createTestClient()` which bypasses Next.js cookies

**Issue: SUPABASE_SERVICE_ROLE_KEY not defined**
- **Solution**: Add service role key to `.env.test`

**Issue: Tests timing out**
- **Solution**: Check database connection, increase timeout in test (default 30s)

**Issue: Tests failing with constraint violations**
- **Solution**: Run cleanup script to remove orphaned test data

## Best Practices

1. **Always use `generateTestPolicyId()`** to create unique policy IDs
2. **Use `createMockPolicyInput()`** helper for consistent test data
3. **Clean up test data** in `afterEach` hooks
4. **Use helper functions** from `test-helpers.ts` for common operations
5. **Set timeouts** for database operations (default 30s)
6. **Test isolation** - each test should be independent

## Extending Tests

### Add new test suite:
```typescript
describe('New Feature', () => {
  it('should test new feature', async () => {
    testPolicyId = generateTestPolicyId('new-feature');
    
    const input = createMockPolicyInput(testPolicyId);
    await PolicyRegistry.register(input, testUserId);
    
    // Your assertions here
    
  }, 30000); // 30s timeout
});
```

### Add new helper function:
Edit `test-helpers.ts` and add your utility function.

## CI/CD Integration

For CI/CD pipelines, use ephemeral Supabase instances or dedicated test databases:

```yaml
# GitHub Actions example
- name: Run integration tests
  env:
    NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.TEST_SUPABASE_URL }}
    SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.TEST_SERVICE_ROLE_KEY }}
  run: npm test -- PolicyRegistry.integration.test.ts
```

## Security Notes

- Service role key bypasses ALL security policies
- **NEVER** use service role key in production code
- **NEVER** commit service role key to version control
- **ALWAYS** use service role key only for testing
- Consider using separate test database/project

## Performance

- Integration tests are slower than unit tests (30s timeout per test)
- Use `--maxWorkers=1` to run tests sequentially and avoid conflicts
- Consider running integration tests separately from unit tests in CI

```bash
# Run unit tests first (fast)
npm test -- --testPathIgnorePatterns=integration

# Then run integration tests (slower)
npm test -- PolicyRegistry.integration.test.ts
```
