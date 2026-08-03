# Production Deployment Checklist

## 📋 Overview

Complete checklist for deploying Real Estate module to production.

**Estimated Time:** 2-4 hours  
**Risk Level:** Medium  
**Rollback Time:** 15-30 minutes

---

## 🔒 Pre-Deployment (1 week before)

### Infrastructure Readiness

- [ ] **Database Backup**
  - [ ] Full database backup created
  - [ ] Backup tested and verified (restore test)
  - [ ] Backup stored in secure location
  - [ ] Recovery time tested (< 30 minutes)

- [ ] **Environment Configuration**
  - [ ] Production environment variables set
  - [ ] Supabase project configured
  - [ ] Sentry DSN configured
  - [ ] API keys rotated (if needed)
  - [ ] SSL certificates valid (> 30 days)

- [ ] **Monitoring Setup**
  - [ ] Sentry project created
  - [ ] Sentry alerts configured
  - [ ] Log aggregation enabled
  - [ ] Dashboard access verified
  - [ ] On-call rotation updated

- [ ] **Access Control**
  - [ ] Production access list reviewed
  - [ ] Service accounts created
  - [ ] API keys generated
  - [ ] Database credentials secured

### Code Readiness

- [ ] **Code Review**
  - [ ] All code reviewed and approved
  - [ ] Security scan passed (no critical issues)
  - [ ] Dependency audit passed
  - [ ] No hardcoded secrets
  - [ ] Environment variables documented

- [ ] **Testing**
  - [ ] Unit tests passed (>80% coverage)
  - [ ] Integration tests passed
  - [ ] E2E tests passed (critical flows)
  - [ ] Load tests passed (see benchmarks)
  - [ ] Security tests passed

- [ ] **Documentation**
  - [ ] API documentation complete
  - [ ] Deployment runbook reviewed
  - [ ] Rollback procedures documented
  - [ ] Team trained on new features

### Stakeholder Communication

- [ ] **Notifications Sent**
  - [ ] Deployment window announced (24h notice)
  - [ ] Maintenance window communicated
  - [ ] Business stakeholders informed
  - [ ] Support team briefed

---

## 🚀 Deployment Day (D-Day)

### Phase 1: Pre-Deployment Verification (30 min)

**Time: T-30 minutes**

- [ ] **Final Checks**
  - [ ] Verify no active users on system
  - [ ] Check system health (CPU, memory, disk)
  - [ ] Verify backup is fresh (< 1 hour old)
  - [ ] Confirm team availability (dev, ops, support)

- [ ] **Communication**
  - [ ] Post "Maintenance in progress" banner
  - [ ] Disable new user registrations
  - [ ] Notify active users (if any)

### Phase 2: Database Migrations (45 min)

**Time: T-0 (Start of deployment)**

- [ ] **Backup Current State**
  ```bash
  # Create immediate backup
  pg_dump -h [HOST] -U [USER] [DB] > backup_pre_deployment_$(date +%Y%m%d_%H%M%S).sql
  ```

- [ ] **Deploy RLS Fix**
  - [ ] Open Supabase Dashboard → SQL Editor
  - [ ] Execute: `scripts/deploy-critical-fixes.sql`
  - [ ] Verify output: "✅ DEPLOYMENT COMPLETED SUCCESSFULLY"
  - [ ] Run verification queries
  - [ ] Test admin login (no infinite recursion)

- [ ] **Deploy Real Estate Schema**
  - [ ] Execute: `supabase/migrations/20260802150000_real_estate_core_schema.sql`
  - [ ] Verify: 9 tables created
  - [ ] Verify: 5 enums created
  - [ ] Verify: 9 RLS policies created

- [ ] **Deploy Real Estate RPCs**
  - [ ] Execute: `supabase/migrations/20260802151000_real_estate_rpc_functions.sql`
  - [ ] Verify: 9 RPC functions created
  - [ ] Test RPC: `get_available_products`
  - [ ] Test RPC: `reserve_product` (dry run with rollback)

### Phase 3: Application Deployment (30 min)

**Time: T+45 minutes**

- [ ] **Build Application**
  ```bash
  npm run build
  # Verify: No build errors
  # Verify: No TypeScript errors
  ```

- [ ] **Deploy to Vercel/Platform**
  ```bash
  git push origin main
  # OR
  vercel --prod
  ```

- [ ] **Verify Deployment**
  - [ ] Check deployment status: Success
  - [ ] Check build logs: No errors
  - [ ] Verify environment variables loaded

### Phase 4: Smoke Testing (30 min)

**Time: T+75 minutes**

- [ ] **Basic Health Checks**
  - [ ] Homepage loads
  - [ ] Login works
  - [ ] Dashboard accessible
  - [ ] Real Estate module visible

- [ ] **Critical Flow Tests**
  - [ ] **Test 1: View Products**
    - [ ] Navigate to Real Estate → Products
    - [ ] Products list loads
    - [ ] Filters work
    - [ ] No console errors

  - [ ] **Test 2: Reserve Product**
    - [ ] Select available product
    - [ ] Fill customer info
    - [ ] Submit reservation
    - [ ] Verify status: pending_deposit
    - [ ] Check database record created

  - [ ] **Test 3: Lead Assignment**
    - [ ] Create new lead
    - [ ] Assign to agent
    - [ ] Verify status: ASSIGNED
    - [ ] Check database record

  - [ ] **Test 4: Dashboard Stats**
    - [ ] Navigate to dashboard
    - [ ] Stats load correctly
    - [ ] Charts render
    - [ ] No errors in console

- [ ] **Error Handling**
  - [ ] Trigger intentional error
  - [ ] Verify error boundary shows
  - [ ] Check Sentry receives error
  - [ ] Verify logs written

### Phase 5: Monitoring Verification (15 min)

**Time: T+105 minutes**

- [ ] **Sentry**
  - [ ] Sentry receiving events
  - [ ] No critical errors
  - [ ] Performance metrics normal
  - [ ] Session replay working

- [ ] **Database**
  - [ ] Query performance < 1s (P95)
  - [ ] Connection pool healthy
  - [ ] No slow queries (> 5s)
  - [ ] RLS policies active

- [ ] **Application**
  - [ ] Response time < 2s (P95)
  - [ ] No 500 errors
  - [ ] Memory usage normal
  - [ ] CPU usage < 70%

### Phase 6: Go-Live (15 min)

**Time: T+120 minutes**

- [ ] **Enable Production**
  - [ ] Remove maintenance banner
  - [ ] Enable new registrations
  - [ ] Announce deployment complete

- [ ] **Final Verification**
  - [ ] Test as end user
  - [ ] Verify all features work
  - [ ] Check no errors in logs (last 5 min)

---

## 📊 Post-Deployment (24 hours)

### Immediate (First Hour)

- [ ] **Monitor Closely**
  - [ ] Watch error rate (target: < 1%)
  - [ ] Watch response time (target: < 2s)
  - [ ] Check database load
  - [ ] Monitor user feedback

- [ ] **Quick Fixes**
  - [ ] Hotfix critical issues immediately
  - [ ] Document non-critical issues
  - [ ] Update runbook with learnings

### First 24 Hours

- [ ] **Metrics Review**
  - [ ] Error rate compared to baseline
  - [ ] Performance compared to staging
  - [ ] User adoption tracking
  - [ ] Feature usage analytics

- [ ] **Team Debrief**
  - [ ] Deployment retrospective
  - [ ] Document lessons learned
  - [ ] Update runbook
  - [ ] Share wins with team

### First Week

- [ ] **Performance Tuning**
  - [ ] Identify slow queries
  - [ ] Add indexes if needed
  - [ ] Optimize RPC functions
  - [ ] Update caching strategy

- [ ] **Documentation**
  - [ ] Update deployment guide
  - [ ] Create troubleshooting docs
  - [ ] Document common issues
  - [ ] Share knowledge base

---

## 🔴 Rollback Procedure

**Trigger Rollback If:**
- Error rate > 5%
- Critical feature broken
- Data corruption detected
- Performance degradation > 50%

### Rollback Steps (15-30 minutes)

1. **Announce Rollback**
   ```
   "Reverting deployment due to [ISSUE]. System will be unavailable for 15 minutes."
   ```

2. **Revert Application Code**
   ```bash
   # Revert to previous commit
   git revert HEAD
   git push origin main
   
   # OR redeploy previous version
   vercel rollback [PREVIOUS_DEPLOYMENT_URL]
   ```

3. **Rollback Migrations (if needed)**
   ```sql
   -- See docs/real-estate/MIGRATIONS_GUIDE.md
   -- Section: "Rollback Procedures"
   
   -- Drop RPC functions
   DROP FUNCTION IF EXISTS get_available_products CASCADE;
   -- ... (see full list in guide)
   
   -- Drop tables (⚠️ DATA LOSS)
   DROP TABLE IF EXISTS re_commissions CASCADE;
   -- ... (see full list in guide)
   ```

4. **Restore Database (nuclear option)**
   ```bash
   # Only if data corruption
   pg_restore -h [HOST] -U [USER] -d [DB] backup_pre_deployment_*.sql
   ```

5. **Verify Rollback**
   - [ ] Application loads
   - [ ] Login works
   - [ ] Core features work
   - [ ] No errors in logs

6. **Post-Rollback**
   - [ ] Announce rollback complete
   - [ ] Document root cause
   - [ ] Schedule fix deployment
   - [ ] Update runbook

---

## 📞 Contact List

| Role | Name | Contact | Availability |
|------|------|---------|--------------|
| **Lead Developer** | [NAME] | [PHONE] | On-call 24/7 |
| **DevOps** | [NAME] | [PHONE] | Business hours |
| **Database Admin** | [NAME] | [PHONE] | On-call 24/7 |
| **Product Manager** | [NAME] | [PHONE] | Business hours |
| **Support Lead** | [NAME] | [PHONE] | Business hours |

**Escalation Path:**
1. Lead Developer (first 15 min)
2. DevOps + DBA (if no resolution)
3. Product Manager (if rollback decision needed)

---

## 📈 Success Criteria

Deployment is successful if:

- [x] All migrations executed successfully
- [x] All smoke tests passed
- [x] Error rate < 1% (first 24 hours)
- [x] Response time < 2s P95
- [x] No data corruption
- [x] Critical features work
- [x] Rollback procedure not needed

---

## 🔗 Related Documents

- **Deployment Runbook:** `docs/deployment/DEPLOYMENT_RUNBOOK.md`
- **Migrations Guide:** `docs/real-estate/MIGRATIONS_GUIDE.md`
- **Monitoring Setup:** `docs/deployment/MONITORING_SETUP.md`
- **E2E Testing:** `docs/real-estate/E2E_TESTING_GUIDE.md`

---

**Last Updated:** 2026-08-02  
**Version:** 1.0.0  
**Next Review:** After first production deployment
