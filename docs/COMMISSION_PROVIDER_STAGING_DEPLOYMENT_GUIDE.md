# Commission Provider - Staging Deployment Guide

**Date:** 2026-07-09  
**Version:** 1.0.0  
**Status:** Ready for Staging  
**Feature Flag:** `FEATURE_COMMISSION_PROVIDER`

---

## 🎯 DEPLOYMENT OBJECTIVE

Validate CommissionProvider in staging environment with real tenant data before Task 7 (Inventory Provider) implementation.

---

## ✅ PRE-DEPLOYMENT CHECKLIST

### Code Quality
- [x] All tests passing (45/45 - 100%)
- [x] Build successful (no TypeScript errors)
- [x] Code committed to repository (2 commits)
- [x] Documentation complete (6,250+ lines)
- [x] Performance verified (0.27ms, 86% faster than target)

### Integration Readiness
- [x] CommissionProviderAdapter implemented
- [x] Salary engine integration complete
- [x] Feature flag configured (default: false)
- [x] Non-blocking design (safe fallback)
- [x] Logging comprehensive (comparison mode)

### Database Requirements
- [ ] Check if `position_tier` column exists in `users` table
- [ ] Check if `hire_date` column exists in `users` table
- [ ] Check if `commission_config` column exists in `tenants` table
- [ ] Verify `booking_service_items` table has commission fields
- [ ] Verify `product_sales` table has commission fields
- [ ] Verify `salary_adjustments` table exists
- [ ] Verify `salary_records` has new commission columns

---

## 🚀 DEPLOYMENT STEPS

### Step 1: Database Schema Verification (5 minutes)

**Check User Table Columns:**
```sql
-- Connect to staging database
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'users' 
  AND column_name IN ('position_tier', 'hire_date');

-- Expected:
-- position_tier | text (or enum with 'junior', 'senior', 'lead')
-- hire_date     | date
```

**Check Tenant Table Columns:**
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'tenants' 
  AND column_name = 'commission_config';

-- Expected:
-- commission_config | jsonb
```

**Check Salary Records Columns:**
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'salary_records' 
  AND column_name IN ('service_commission', 'product_sales_commission', 
                       'position_bonus', 'seniority_bonus', 'manual_adjustments');

-- Expected: All should exist as numeric
```

**Action if Missing:**
- If columns don't exist, provider will use defaults
- No migration blocking deployment
- Document missing columns for future migration

### Step 2: Environment Configuration (2 minutes)

**Update `.env.staging` file:**
```bash
# Enable Commission Provider in staging
FEATURE_COMMISSION_PROVIDER=true

# Keep other providers as is
FEATURE_PAYROLL_PROVIDER=true  # If already enabled
USE_CONFIG_PROVIDERS=false      # Individual providers
```

**Verify environment:**
```bash
# SSH to staging server
ssh staging-server

# Check environment variable
echo $FEATURE_COMMISSION_PROVIDER
# Expected: true

# Restart application
pm2 restart bella-spa-erp
# or
systemctl restart bella-spa-erp
```

### Step 3: Deploy Code (10 minutes)

**Option A: Git Pull (Recommended)**
```bash
# SSH to staging
ssh staging-server
cd /app/bella-spa-erp

# Pull latest code
git fetch origin
git checkout main
git pull origin main

# Install dependencies (if needed)
npm install

# Build application
npm run build

# Restart
pm2 restart bella-spa-erp
```

**Option B: Docker Deploy**
```bash
# Build Docker image
docker build -t bella-spa-erp:staging .

# Push to registry
docker push registry.example.com/bella-spa-erp:staging

# Deploy to staging
docker-compose -f docker-compose.staging.yml up -d
```

### Step 4: Verification (5 minutes)

**Check Application Status:**
```bash
# Check if app is running
pm2 status bella-spa-erp
# or
docker ps | grep bella-spa-erp

# Check logs for errors
pm2 logs bella-spa-erp --lines 50
# or
docker logs bella-spa-erp -f --tail 50
```

**Check Feature Flag:**
```bash
# In Node.js console or API
curl http://staging.example.com/api/health

# Check logs for provider initialization
grep "COMMISSION_PROVIDER" /var/log/bella-spa-erp.log
```

---

## 🧪 VALIDATION TESTS

### Test 1: Commission Calculation with Real Data (15 minutes)

**Scenario:** Trigger salary recalculation for a KTV with commission data

**Steps:**
1. **Select Test KTV:**
```sql
-- Find KTV with commission data
SELECT u.id, u.full_name, 
       COUNT(DISTINCT bsi.id) as service_items,
       COUNT(DISTINCT ps.id) as product_sales
FROM users u
LEFT JOIN booking_service_items bsi ON bsi.ktv_id = u.id AND bsi.status = 'completed'
LEFT JOIN product_sales ps ON ps.ktv_id = u.id AND ps.status = 'completed'
WHERE u.role = 'ktv'
  AND u.tenant_id = 'YOUR_TENANT_ID'
GROUP BY u.id, u.full_name
HAVING COUNT(DISTINCT bsi.id) > 0 OR COUNT(DISTINCT ps.id) > 0
ORDER BY COUNT(DISTINCT bsi.id) + COUNT(DISTINCT ps.id) DESC
LIMIT 5;
```

2. **Trigger Recalculation:**
   - Go to Admin → Payroll → Employee Detail
   - Select test KTV
   - Click "Recalculate Salary" for current month

3. **Check Logs:**
```bash
# Look for Commission Provider logs
grep "COMMISSION_PROVIDER" /var/log/bella-spa-erp.log | tail -20

# Expected output:
# [COMMISSION_PROVIDER] Unified calculation complete: {
#   ktvId: 'ktv-xxx',
#   month: '2024-06',
#   service_commission: 500000,
#   product_sales_commission: 120000,
#   position_bonus: 63800,
#   seniority_bonus: 31900,
#   manual_adjustments: 0,
#   total_commission: 715700,
#   volume_tier: 'high',
#   performance_tier: 'excellent',
#   execution_time: 0.28
# }
```

4. **Verify in Database:**
```sql
-- Check salary record
SELECT 
  ktv_id,
  month_year,
  service_commission,
  product_sales_commission,
  position_bonus,
  seniority_bonus,
  manual_adjustments,
  total_salary
FROM salary_records
WHERE ktv_id = 'YOUR_KTV_ID'
  AND month_year = '2024-06';

-- Compare with previous month (legacy calculation)
```

### Test 2: Provider vs Legacy Comparison (10 minutes)

**Goal:** Verify provider results match legacy logic (within tolerance)

**Steps:**
1. **Collect Provider Results:**
```bash
# From logs, extract provider calculations
grep "COMMISSION_PROVIDER.*Unified calculation complete" \
  /var/log/bella-spa-erp.log | tail -10 > provider_results.log
```

2. **Query Legacy Calculations:**
```sql
-- Get legacy commission calculations
SELECT 
  ktv_id,
  month_year,
  service_commission as legacy_service,
  product_sales_commission as legacy_product,
  position_bonus as legacy_position,
  seniority_bonus as legacy_seniority
FROM salary_records
WHERE month_year >= '2024-01'
  AND service_commission IS NOT NULL
ORDER BY month_year DESC, ktv_id
LIMIT 20;
```

3. **Compare:**
   - Provider service commission vs legacy
   - Provider product commission vs legacy
   - Provider bonuses vs legacy
   - **Expected:** Within ±1% or ±1,000đ (rounding tolerance)

4. **Document Discrepancies:**
   - If >5% difference: Investigate
   - If systematic pattern: May be logic improvement
   - If random variance: Likely acceptable

### Test 3: Performance Validation (5 minutes)

**Goal:** Verify execution time <2ms in production environment

**Steps:**
1. **Check Execution Times from Logs:**
```bash
# Extract execution times
grep "execution_time" /var/log/bella-spa-erp.log | \
  grep "COMMISSION_PROVIDER" | \
  tail -20

# Calculate average
grep "execution_time" /var/log/bella-spa-erp.log | \
  grep "COMMISSION_PROVIDER" | \
  awk '{print $NF}' | \
  awk '{sum+=$1; count++} END {print "Avg:", sum/count, "ms"}'
```

2. **Expected Results:**
   - Average: <2ms
   - 95th percentile: <5ms
   - Maximum: <10ms

3. **Action if Slow:**
   - Check database query performance
   - Verify indexes on commission tables
   - Monitor server resource usage

### Test 4: Error Handling (5 minutes)

**Goal:** Verify non-blocking design (provider failure doesn't break salary)

**Steps:**
1. **Simulate Provider Error:**
```sql
-- Temporarily corrupt commission config (DO NOT DO IN PRODUCTION!)
UPDATE tenants 
SET commission_config = '{"invalid_json": true'::jsonb
WHERE id = 'test-tenant-id';
```

2. **Trigger Recalculation:**
   - Should still complete successfully
   - Should log error
   - Should use legacy logic

3. **Check Logs:**
```bash
grep "COMMISSION_PROVIDER.*Failed" /var/log/bella-spa-erp.log
# Expected: Error logged, but salary calculation continued
```

4. **Restore Config:**
```sql
-- Restore valid config
UPDATE tenants 
SET commission_config = NULL
WHERE id = 'test-tenant-id';
```

---

## 📊 MONITORING & METRICS

### Key Metrics to Track

**During Deployment (First 24 hours):**
1. **Error Rate:**
   - Target: <1% of salary calculations
   - Monitor: `grep "COMMISSION_PROVIDER.*Failed" logs`

2. **Performance:**
   - Target: <2ms average execution
   - Monitor: `grep "execution_time" logs | calculate avg`

3. **Calculation Accuracy:**
   - Compare provider vs legacy for first 20 KTVs
   - Document any >5% differences

4. **Feature Flag Usage:**
   - Verify provider is being called
   - Count: `grep "COMMISSION_PROVIDER.*Unified" logs | wc -l`

**After 7 Days:**
1. **Stability:**
   - Zero critical errors
   - No salary calculation failures

2. **Accuracy:**
   - User feedback (any commission disputes?)
   - Reconciliation matches

3. **Performance:**
   - Execution time remains <2ms
   - No performance degradation

---

## 🚨 ROLLBACK PLAN

### When to Rollback

**Immediate Rollback:**
- Critical errors breaking salary calculations
- >10% calculation differences from legacy
- Performance degradation (>5ms average)
- Production incidents attributed to provider

**Temporary Disable:**
- Non-critical issues
- Need investigation time
- User feedback requires changes

### Rollback Steps

**Option 1: Feature Flag Disable (5 seconds)**
```bash
# Update environment variable
export FEATURE_COMMISSION_PROVIDER=false

# Restart application
pm2 restart bella-spa-erp
```

**Option 2: Code Rollback (5 minutes)**
```bash
# Git revert to previous commit
git revert HEAD~2  # Revert last 2 commits
git push origin main

# Deploy
pm2 restart bella-spa-erp
```

**Option 3: Database Rollback (if needed)**
```sql
-- If new columns were added and need removal
ALTER TABLE salary_records DROP COLUMN IF EXISTS service_commission;
-- (Usually not needed due to non-blocking design)
```

---

## ✅ POST-DEPLOYMENT VALIDATION CHECKLIST

### Day 1 (Deployment Day)
- [ ] Application deployed successfully
- [ ] Feature flag enabled and working
- [ ] Provider logs appearing (calculation events)
- [ ] No critical errors in logs
- [ ] First 5 KTV calculations verified manually
- [ ] Performance within targets (<2ms)

### Day 2-3 (Monitoring)
- [ ] 20+ KTV calculations verified
- [ ] Compare with legacy calculations (within tolerance)
- [ ] No user complaints about commission errors
- [ ] Performance stable
- [ ] Error rate <1%

### Day 7 (Stability)
- [ ] 100+ calculations completed without issues
- [ ] User feedback collected (if any)
- [ ] Performance metrics documented
- [ ] Discrepancy analysis complete
- [ ] Decision: Continue or adjust

---

## 📋 VALIDATION REPORT TEMPLATE

```markdown
# Commission Provider - Staging Validation Report

**Date:** [YYYY-MM-DD]
**Environment:** Staging
**Duration:** [X days]
**Tenant:** [Tenant Name/ID]

## Deployment Summary
- Deployment Date: [Date/Time]
- Feature Flag: ENABLED
- Code Version: [Commit Hash]

## Test Results

### Test 1: Real Data Calculation
- KTVs Tested: [Number]
- Calculations: [Number]
- Success Rate: [XX%]
- Errors: [Number and description]

### Test 2: Provider vs Legacy
- Comparisons: [Number]
- Average Difference: [±X%]
- Max Difference: [±X%]
- Within Tolerance: [Yes/No]

### Test 3: Performance
- Average Execution: [X.XX ms]
- 95th Percentile: [X.XX ms]
- Maximum: [X.XX ms]
- Target Met: [Yes/No]

### Test 4: Error Handling
- Error Simulations: [Number]
- Graceful Fallback: [Yes/No]
- Salary Calculations Broken: [Number]

## Issues Found
[List any issues discovered]

## Recommendations
- [ ] Proceed to production
- [ ] Need adjustments (describe)
- [ ] Rollback (reason)

## Next Steps
[Action items]

---
**Validated By:** [Your Name]
**Date:** [YYYY-MM-DD]
```

---

## 🎯 SUCCESS CRITERIA FOR PRODUCTION

After staging validation, proceed to production if:

✅ **All Pass:**
1. Zero critical errors (7 days)
2. Calculation accuracy within ±1% of legacy
3. Performance <2ms average
4. No user complaints
5. 100+ successful calculations
6. Error rate <1%
7. Monitoring dashboard shows green

**Ready for Production:** Continue to Task 7 ✅

---

## 📞 SUPPORT & ESCALATION

### Issue Categories

**P0 - Critical (Immediate action):**
- Salary calculations failing
- Data corruption
- Security vulnerability
- Immediate rollback required

**P1 - High (Within 4 hours):**
- Calculation discrepancies >10%
- Performance degradation >5ms
- Error rate >5%

**P2 - Medium (Within 24 hours):**
- Calculation discrepancies 5-10%
- Performance 2-5ms
- Error rate 1-5%
- Minor UX issues

**P3 - Low (Within 1 week):**
- Documentation updates
- Minor improvements
- Feature requests

---

**Status:** 📋 Ready for Staging Deployment  
**Next:** Validate → Task 7 Inventory Provider  
**Contact:** [Your team contact info]
