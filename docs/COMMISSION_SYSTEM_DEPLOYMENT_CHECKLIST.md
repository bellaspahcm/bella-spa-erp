# Commission System - Production Deployment Checklist

> **Deployment Date:** TBD  
> **Maintenance Window:** TBD  
> **Rollback Time Limit:** 1 hour

---

## Pre-Deployment Checklist (T-7 days)

### Code Quality
- [ ] All unit tests passing (130/130)
- [ ] All integration tests passing
- [ ] All E2E tests passing
- [ ] Static analysis (Semgrep) clean
- [ ] Security scans (Trivy) clean
- [ ] No Gitleaks secrets detected
- [ ] TypeScript build: 0 errors
- [ ] ESLint: 0 errors

### Documentation
- [ ] Admin Guide completed
- [ ] KTV Guide completed
- [ ] API documentation updated
- [ ] Database schema documented
- [ ] Rollback procedure documented

### Testing
- [ ] QA sign-off received
- [ ] All critical bugs fixed
- [ ] Staging tested successfully for 3 days
- [ ] Performance benchmarks met:
  - [ ] Salary calc < 5s per KTV
  - [ ] Page load < 3s
  - [ ] API response < 500ms
- [ ] Security testing passed:
  - [ ] RLS policies enforced
  - [ ] No tenant leakage
  - [ ] SQL injection prevented
  - [ ] XSS prevented
- [ ] UAT completed:
  - [ ] Business owner sign-off
  - [ ] KTV user feedback positive

### Infrastructure
- [ ] Production database backup verified (< 24h old)
- [ ] Backup restoration tested on staging
- [ ] Rollback script tested on test environment
- [ ] Monitoring dashboards ready
- [ ] Alert rules configured:
  - [ ] Salary calculation failures
  - [ ] Database query timeouts
  - [ ] RLS policy violations
  - [ ] High error rate (> 1%)
- [ ] Resource capacity checked:
  - [ ] Database storage: > 20% free
  - [ ] Database connections: < 80% used
  - [ ] API server: < 70% CPU/RAM

### Communications
- [ ] Stakeholders notified (CEO, CTO, Product Owner)
- [ ] Support team briefed on new features
- [ ] Support runbook created
- [ ] Customer success team trained
- [ ] Announcement email drafted
- [ ] Help docs published

### Team Readiness
- [ ] Deployment team identified:
  - [ ] Lead: _______________
  - [ ] Database: _______________
  - [ ] Backend: _______________
  - [ ] Frontend: _______________
  - [ ] Support: _______________
- [ ] On-call schedule confirmed
- [ ] Rollback decision-maker identified: _______________

---

## Pre-Deployment Checklist (T-1 day)

### Final Verification
- [ ] Re-run all tests on latest code
- [ ] Staging environment stable for 24h
- [ ] No critical bugs in backlog
- [ ] All team members available during window
- [ ] Backup strategy confirmed

### Preparation
- [ ] Maintenance page ready
- [ ] Customer notification sent
- [ ] Support team on standby
- [ ] Monitoring dashboards open
- [ ] Deployment scripts reviewed
- [ ] Rollback scripts ready

---

## Deployment Day Checklist

### T-60min: Pre-Deployment

- [ ] **09:00** Team standup call
- [ ] Verify team attendance
- [ ] Review deployment steps
- [ ] Confirm rollback criteria
- [ ] Open incident channel (Slack/Teams)

### T-30min: Prepare Environment

- [ ] **09:30** Enable maintenance mode
  ```bash
  # Set maintenance flag
  psql $PROD_DB_URL -c "UPDATE system_config SET maintenance_mode = true"
  ```
- [ ] Verify maintenance page showing
- [ ] Stop background workers/cron jobs
- [ ] Clear application cache

### T-0: Deployment Start

#### Step 1: Database Backup (5 min)
- [ ] **10:00** Start production backup
  ```bash
  ./scripts/backup-production-db.sh
  ```
- [ ] Verify backup file size reasonable (> 1GB)
- [ ] Upload backup to S3/GCS
- [ ] Test backup file integrity:
  ```bash
  pg_restore --list backup_file.sql | head -20
  ```

**✋ STOP: If backup fails, abort deployment**

#### Step 2: Run Migrations (10 min)
- [ ] **10:05** Run migration script
  ```bash
  export PROD_DB_URL="postgresql://..."
  ./scripts/deploy-commission-system-production.sh
  ```
- [ ] Monitor migration progress
- [ ] Record execution times per migration:
  - [ ] Migration 1: ___ seconds
  - [ ] Migration 2: ___ seconds
  - [ ] Migration 3: ___ seconds
  - [ ] Migration 4: ___ seconds
  - [ ] Migration 5: ___ seconds
  - [ ] Migration 6: ___ seconds
- [ ] Total migration time: ___ minutes

**✋ STOP: If any migration fails, execute rollback immediately**


#### Step 3: Verify Schema Changes (5 min)
- [ ] **10:15** Verify tables created
  ```sql
  SELECT tablename FROM pg_tables 
  WHERE tablename IN ('booking_service_items', 'product_sales', 'salary_adjustments');
  ```
- [ ] Verify columns added
  ```sql
  SELECT column_name FROM information_schema.columns 
  WHERE table_name='salary_records' 
  AND column_name LIKE '%commission%';
  ```
- [ ] Check RLS policies active
  ```sql
  SELECT COUNT(*) FROM pg_policies 
  WHERE tablename IN ('booking_service_items', 'product_sales', 'salary_adjustments');
  ```
  Expected: >= 9 policies
- [ ] Check indexes created
  ```sql
  SELECT indexname FROM pg_indexes 
  WHERE tablename IN ('booking_service_items', 'product_sales', 'salary_adjustments');
  ```
  Expected: >= 12 indexes
- [ ] Check constraints
  ```sql
  SELECT constraint_name FROM information_schema.table_constraints 
  WHERE table_name IN ('booking_service_items', 'product_sales', 'salary_adjustments');
  ```

**✋ STOP: If verification fails, execute rollback**

#### Step 4: Deploy Application Code (10 min)
- [ ] **10:20** Deploy frontend build
  ```bash
  npm run build
  npm run deploy:production
  ```
- [ ] Deploy API services
- [ ] Restart application servers
- [ ] Clear CDN cache
- [ ] Verify deployment version
  ```bash
  curl https://api.bella-erp.vn/version
  ```

#### Step 5: Smoke Tests (10 min)
- [ ] **10:30** Test critical paths:

**Auth & Access**
- [ ] Admin can login
- [ ] KTV can login
- [ ] Dashboard loads

**Service Commission**
- [ ] Can create service item
- [ ] Commission calculated correctly
- [ ] Service item appears in list

**Product Sales**
- [ ] Can create product sale
- [ ] Commission calculated correctly
- [ ] Sale appears in list

**Manual Adjustments**
- [ ] Can create adjustment
- [ ] Can approve adjustment
- [ ] Salary recalculates

**Salary View**
- [ ] Can view salary breakdown
- [ ] All commission components visible
- [ ] Export CSV works

**Multi-Tenant**
- [ ] Tenant A sees only their data
- [ ] Tenant B sees only their data

**✋ STOP: If any smoke test fails, execute rollback**

#### Step 6: Disable Maintenance Mode (2 min)
- [ ] **10:40** Disable maintenance mode
  ```bash
  psql $PROD_DB_URL -c "UPDATE system_config SET maintenance_mode = false"
  ```
- [ ] Restart background workers
- [ ] Restart cron jobs
- [ ] Verify public site accessible

#### Step 7: Monitor (60 min)
- [ ] **10:42** Monitor dashboards:
  - [ ] Error rate < 0.5%
  - [ ] Response time < 1s (p95)
  - [ ] Database CPU < 70%
  - [ ] Database connections < 80%
  - [ ] No RLS violations
  - [ ] No tenant leakage alerts

- [ ] Monitor application logs:
  - [ ] No new ERROR logs
  - [ ] No unexpected WARN logs
  - [ ] Commission calculations succeeding

- [ ] Check user activity:
  - [ ] Users logging in
  - [ ] Bookings created
  - [ ] Salary viewed

**✋ STOP: If critical issues detected, execute rollback**

---

## Post-Deployment Verification (T+1h)

### Data Integrity Checks
- [ ] **11:45** Run data integrity queries:

```sql
-- Check for orphaned records
SELECT COUNT(*) FROM booking_service_items bsi
LEFT JOIN bookings b ON bsi.booking_id = b.id
WHERE b.id IS NULL;
-- Expected: 0

-- Check for missing commissions
SELECT COUNT(*) FROM booking_service_items
WHERE commission_value IS NULL;
-- Expected: 0

-- Check for negative commissions
SELECT COUNT(*) FROM booking_service_items
WHERE commission_value < 0;
-- Expected: 0

-- Check salary totals consistency
SELECT COUNT(*) FROM salary_records
WHERE total_salary < (base_salary + COALESCE(service_commission_total, 0));
-- Expected: 0
```

- [ ] All data integrity checks passed

### Performance Verification
- [ ] Run performance benchmarks:
  ```bash
  npm run benchmark:salary-calc
  ```
  - [ ] Average time < 5s per KTV
  - [ ] p95 time < 10s
  - [ ] p99 time < 15s

### User Acceptance
- [ ] Business owner tests real scenario
- [ ] KTV user views their salary
- [ ] Feedback collected

---

## Rollback Criteria

Execute rollback immediately if:

1. **Data Corruption**
   - Salary calculations incorrect
   - Commission values wrong
   - Data loss detected

2. **Critical Bugs**
   - Users cannot login
   - Salary view crashes
   - Commission not calculating
   - Booking creation fails

3. **Performance Degradation**
   - API response time > 5s
   - Database CPU > 90%
   - Page load time > 10s

4. **Security Issues**
   - Tenant leakage detected
   - RLS policies not working
   - Unauthorized access

5. **High Error Rate**
   - Error rate > 2%
   - More than 10 errors in 5 minutes

---

## Rollback Procedure

### Option 1: Code Rollback (Preferred if DB OK)
- [ ] Revert application code to previous version
- [ ] Restart services
- [ ] Verify old version working
- [ ] Duration: ~5 minutes

### Option 2: Database Rollback (If DB corrupted)
- [ ] Stop all application servers
- [ ] Run rollback script:
  ```bash
  ./scripts/rollback-commission-system.sh ./backups/prod_backup_TIMESTAMP.sql
  ```
- [ ] Verify database restored
- [ ] Revert application code
- [ ] Restart services
- [ ] Duration: ~20 minutes

**⚠️ Warning: Database rollback loses all data after backup**

---

## Post-Deployment Tasks (T+24h)

### Day 1
- [ ] Monitor error logs every 2 hours
- [ ] Check performance metrics
- [ ] Review user feedback
- [ ] Address any minor issues
- [ ] Update status page

### Day 2-7 (Week 1)
- [ ] Daily monitoring review
- [ ] Collect user feedback
- [ ] Track adoption metrics:
  - [ ] % of bookings with service items
  - [ ] % of KTV viewing salary
  - [ ] Average commission per KTV
- [ ] Create Week 1 report

### Day 8-14 (Week 2)
- [ ] Continue monitoring (less frequent)
- [ ] Analyze performance trends
- [ ] Plan optimizations if needed
- [ ] Create Week 2 report

---

## Success Metrics

### Technical Metrics (Target)
- [ ] Error rate: < 0.5%
- [ ] API response time: < 500ms (p95)
- [ ] Salary calc time: < 5s per KTV
- [ ] Zero critical bugs
- [ ] Zero tenant leakage incidents
- [ ] Uptime: 99.9%+

### Business Metrics (Target - Month 1)
- [ ] Adoption rate: > 80% of KTV
- [ ] User satisfaction: > 4/5
- [ ] Support tickets: < 20
- [ ] Commission accuracy: > 99%

---

## Incident Response

### Severity Levels

**P0 - Critical (< 15 min response)**
- System down
- Data corruption
- Security breach
- Tenant leakage

**P1 - High (< 1 hour response)**
- Feature not working
- Performance severely degraded
- Multiple user complaints

**P2 - Medium (< 4 hours response)**
- Minor bugs
- Performance slightly slow
- UI issues

**P3 - Low (< 24 hours response)**
- Cosmetic issues
- Feature requests
- Documentation updates

### Escalation Path
1. **On-call Engineer** → Fix or escalate (15 min)
2. **Tech Lead** → Assess & decide (30 min)
3. **CTO** → Rollback decision (15 min)

---

## Deployment Report Template

After deployment, fill out:

**Deployment Summary**
- Date: _______________
- Start time: _______________
- End time: _______________
- Duration: _______________
- Downtime: _______________

**Team**
- Lead: _______________
- Database: _______________
- Backend: _______________
- Frontend: _______________

**Results**
- [ ] Successful
- [ ] Partial success (issues):
- [ ] Failed (rolled back)

**Migration Times**
- Total: ___ minutes
- Breakdown: ___

**Issues Encountered**
1. ___
2. ___

**Rollback Executed?**
- [ ] No
- [ ] Yes (reason):

**Post-Deployment Status**
- Error rate: ___%
- Performance: ___
- User feedback: ___

**Lessons Learned**
1. ___
2. ___

**Next Steps**
1. ___
2. ___

---

**Sign-Off**

**Deployment Lead:**  
Name: _______________  
Date: _______________  
Signature: _______________

**CTO:**  
Name: _______________  
Date: _______________  
Signature: _______________

---

*Checklist version: 1.0.0*  
*Last updated: 22/06/2026*
