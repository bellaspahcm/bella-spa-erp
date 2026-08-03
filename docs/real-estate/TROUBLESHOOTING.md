# Real Estate Module - Troubleshooting

## 🔴 Critical Errors

### Error: "infinite recursion detected in policy for relation user_roles"

**Cause:** RLS policy checks user_roles while querying user_roles

**Fix:**
```bash
# Deploy RLS fix
Supabase Dashboard → SQL Editor → Run:
scripts/deploy-critical-fixes.sql
```

**Verify:**
```sql
SELECT policyname FROM pg_policies WHERE tablename = 'user_roles';
-- Should show: "Authenticated users can view all roles"
```

---

### Error: "function reserve_product does not exist"

**Cause:** RPC migrations not deployed

**Fix:**
```bash
# Deploy RPCs
Supabase Dashboard → SQL Editor → Run:
supabase/migrations/20260802151000_real_estate_rpc_functions.sql
```

**Verify:**
```sql
SELECT routine_name FROM information_schema.routines 
WHERE routine_name = 'reserve_product';
```

---

### Error: "relation real_estate_products does not exist"

**Cause:** Core schema not deployed

**Fix:**
```bash
# Deploy schema
supabase/migrations/20260802150000_real_estate_core_schema.sql
```

---

### Error: "Invalid transition from DRAFT to CONFIRMED"

**Cause:** Invalid FSM state transition

**Valid Transitions:**
- DRAFT → PENDING_APPROVAL ✓
- PENDING_APPROVAL → CONFIRMED ✓
- DRAFT → CONFIRMED ✗ (Must go through PENDING_APPROVAL)

**Fix:** Follow correct state sequence

---

### Error: "Product is not available for reservation (status: reserved)"

**Cause:** Product already reserved by another user

**Check:**
```sql
SELECT * FROM real_estate_products WHERE id = '[product-id]';
-- If status = 'reserved', check who reserved it:
SELECT * FROM re_reservations WHERE product_id = '[product-id]' AND status != 'cancelled';
```

**Fix:** Cancel old reservation or choose different product

---

## ⚠️ Performance Issues

### Slow Query: > 5 seconds

**Check slow queries:**
```sql
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
WHERE mean_exec_time > 1000
ORDER BY mean_exec_time DESC LIMIT 10;
```

**Common fixes:**
- Add indexes on frequently filtered columns
- Use RPC functions instead of complex client queries
- Implement pagination (limit + offset)

---

### High Memory Usage

**Check:**
```sql
SELECT * FROM pg_stat_activity WHERE state = 'active';
```

**Fix:**
- Close idle connections
- Reduce connection pool size
- Optimize JSONB queries

---

## 🐛 Data Issues

### Commission Not Created

**Check:**
```sql
SELECT * FROM re_commissions WHERE contract_id = '[contract-id]';
```

**Possible causes:**
- Commission trigger not created (check migrations)
- Contract not in ACTIVE state
- Agent not assigned to booking

---

### Installments Not Generated

**Check:**
```sql
SELECT installments FROM re_contracts WHERE id = '[contract-id]';
```

**Fix:**
```typescript
await supabase.rpc('generate_contract_installments', {
  p_contract_id: contractId,
  p_installments_count: 12,
  p_start_date: '2026-09-01',
});
```

---

### Product Status Not Updating

**Check triggers:**
```sql
-- Verify product status after contract activation
SELECT status FROM real_estate_products WHERE id = '[product-id]';
-- Should be 'sold' if contract is ACTIVE
```

**Manual fix:**
```sql
UPDATE real_estate_products SET status = 'sold' WHERE id = '[product-id]';
```

---

## 🔍 Debugging Tips

### Enable Query Logging
```typescript
import { dbLogger } from '@/lib/logger';
import { monitoredQuery } from '@/lib/db/query-monitor';

const result = await monitoredQuery(
  () => supabase.from('real_estate_products').select('*'),
  'get_all_products'
);
// Logs duration, row count, errors
```

### Check Sentry for Errors
1. Go to Sentry Dashboard
2. Filter by `context:module:real_estate`
3. Check recent errors

### Verify RLS Policies
```sql
SELECT * FROM pg_policies 
WHERE tablename LIKE 're_%' OR tablename LIKE 'real_estate_%';
```

---

## 📞 Need Help?

**Docs:**
- API Reference: `docs/real-estate/API_REFERENCE.md`
- Migrations Guide: `docs/real-estate/MIGRATIONS_GUIDE.md`

**Logs:**
- Sentry: [PROJECT_URL]
- Supabase Logs: Dashboard → Logs

**Team:**
- Dev Team: [SLACK_CHANNEL]
- On-Call: [PHONE]
