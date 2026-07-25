# Commission Provider - Staging Deployment Checklist

**Quick Reference** - Use this for rapid deployment validation

---

## ⚡ QUICK DEPLOYMENT (30 minutes)

### Pre-Deployment (5 min)
- [ ] Tests passing: `npm test -- commission` → 45/45 ✅
- [ ] Build successful: `npm run build` → No errors ✅
- [ ] Code committed: `git log -1` → Latest commit present ✅

### Deploy (10 min)
- [ ] SSH to staging: `ssh staging-server`
- [ ] Pull code: `git pull origin main`
- [ ] Build: `npm run build`
- [ ] Set flag: `export FEATURE_COMMISSION_PROVIDER=true`
- [ ] Restart: `pm2 restart bella-spa-erp`

### Verify (15 min)
- [ ] App running: `pm2 status` → bella-spa-erp online ✅
- [ ] Logs clean: `pm2 logs --lines 50` → No errors ✅
- [ ] Provider active: `grep "COMMISSION_PROVIDER" logs` → Events present ✅
- [ ] Test calculation: Recalculate 1 KTV salary → Success ✅
- [ ] Check result: Query salary_records → Commission fields populated ✅

---

## 🧪 VALIDATION TESTS (30 minutes)

### Test 1: Real Calculation (10 min)
```bash
# 1. Find KTV with commission data
psql -d staging_db -c "
SELECT u.id, u.full_name, 
       COUNT(bsi.id) as services,
       COUNT(ps.id) as products
FROM users u
LEFT JOIN booking_service_items bsi ON bsi.ktv_id = u.id
LEFT JOIN product_sales ps ON ps.ktv_id = u.id
WHERE u.role = 'ktv' 
GROUP BY u.id HAVING COUNT(bsi.id) + COUNT(ps.id) > 0
LIMIT 5;"

# 2. Note KTV ID, recalculate via UI

# 3. Check logs
tail -20 /var/log/bella-spa-erp.log | grep COMMISSION_PROVIDER

# Expected: "Unified calculation complete" with commission values
```

**Pass Criteria:** ✅ Calculation completes, commission > 0

### Test 2: Performance (5 min)
```bash
# Extract execution times
grep "execution_time" /var/log/bella-spa-erp.log | \
  grep COMMISSION_PROVIDER | tail -20 | \
  awk '{print $(NF)}' | \
  awk '{sum+=$1; n++} END {print "Avg: " sum/n " ms"}'
```

**Pass Criteria:** ✅ Average <2ms

### Test 3: Error Handling (5 min)
```bash
# Check for errors
grep "COMMISSION_PROVIDER.*Failed" /var/log/bella-spa-erp.log

# Should be empty or show graceful handling
```

**Pass Criteria:** ✅ No errors OR errors with fallback message

### Test 4: Data Accuracy (10 min)
```sql
-- Compare last calculation
SELECT 
  month_year,
  service_commission,
  product_sales_commission,
  position_bonus,
  seniority_bonus,
  total_salary
FROM salary_records
WHERE ktv_id = '[TEST_KTV_ID]'
ORDER BY month_year DESC
LIMIT 2;

-- Compare current vs previous month
-- Values should be reasonable (not 0, not absurdly high)
```

**Pass Criteria:** ✅ Values reasonable, no zeros where data exists

---

## 🚨 QUICK ROLLBACK (2 minutes)

### If Issues Found:
```bash
# Disable feature flag
export FEATURE_COMMISSION_PROVIDER=false

# Restart
pm2 restart bella-spa-erp

# Verify
pm2 logs --lines 20 | grep -v COMMISSION_PROVIDER
# Should show no commission provider logs
```

---

## ✅ GO/NO-GO DECISION

### ✅ GO (Proceed to Task 7)
All true:
- [x] Deployment successful
- [x] Provider logs present
- [x] Test calculation works
- [x] Performance <2ms
- [x] No critical errors
- [x] Data looks reasonable

**Action:** Continue to Task 7 Inventory Provider ✅

### ⚠️ INVESTIGATE (Need more time)
Any true:
- [ ] Performance 2-5ms (acceptable but monitor)
- [ ] Minor calculation differences (document)
- [ ] Low error rate <5% (investigate cause)

**Action:** Monitor for 24 hours before Task 7

### ❌ NO-GO (Rollback required)
Any true:
- [ ] Salary calculations failing
- [ ] Performance >5ms
- [ ] Error rate >10%
- [ ] Calculation differences >20%
- [ ] Data corruption

**Action:** Rollback immediately, fix issues

---

## 📊 QUICK METRICS

### Collect These Numbers:
```bash
# 1. Total calculations
grep "COMMISSION_PROVIDER.*Unified" /var/log/bella-spa-erp.log | wc -l

# 2. Average execution time
grep "execution_time" /var/log/bella-spa-erp.log | \
  grep COMMISSION | awk '{print $(NF)}' | \
  awk '{sum+=$1; n++} END {print sum/n " ms"}'

# 3. Error count
grep "COMMISSION_PROVIDER.*Failed" /var/log/bella-spa-erp.log | wc -l

# 4. Error rate
echo "scale=2; [error_count] / [total_calculations] * 100" | bc
```

**Target:** <2ms, <1% errors

---

## 📋 FINAL CHECKLIST

Before Task 7:
- [ ] Staging deployed
- [ ] Validated 5+ KTV calculations
- [ ] Performance verified (<2ms)
- [ ] No critical errors
- [ ] Monitoring dashboard reviewed
- [ ] Decision: GO/NO-GO documented

**If GO:** Proceed to Task 7 Inventory Provider ✅

---

**Estimated Time:** 1 hour (30 min deploy + 30 min validation)  
**Next:** Task 7 Implementation (2-3 days)
