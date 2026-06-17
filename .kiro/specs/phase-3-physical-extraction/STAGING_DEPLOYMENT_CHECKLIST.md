# Phase 3 Staging Deployment Checklist

**Deployment Date**: [TBD]  
**Deployment Window**: [TBD]  
**Responsible Team**: DevOps + Development  
**Estimated Duration**: 2-3 hours

---

## 🎯 Pre-Deployment Checklist

### Environment Setup
- [ ] **Staging server configured**
  - [ ] Server resources allocated (CPU, Memory, Disk)
  - [ ] Network configuration verified
  - [ ] SSL certificates installed
  - [ ] Domain/subdomain configured (e.g., staging.bella-erp.com)

- [ ] **Environment variables set**
  - [ ] `NODE_ENV=production`
  - [ ] `NEXT_PUBLIC_SUPABASE_URL=[staging_url]`
  - [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY=[staging_anon_key]`
  - [ ] `SUPABASE_SERVICE_ROLE_KEY=[staging_service_key]`
  - [ ] `REDIS_URL=[staging_redis_url]`
  - [ ] `SENTRY_DSN=[staging_sentry_dsn]`
  - [ ] Feature flags (if using):
    - [ ] `NEXT_PUBLIC_USE_CORE_PLATFORM=true`
    - [ ] `NEXT_PUBLIC_USE_MODULE_ADAPTERS=true`

- [ ] **Database setup**
  - [ ] Staging database created (Supabase)
  - [ ] Database schema up to date
  - [ ] RLS policies enabled
  - [ ] Test data loaded (or production snapshot)
  - [ ] Database backup created

- [ ] **External services configured**
  - [ ] Redis cache instance running
  - [ ] Sentry error tracking configured
  - [ ] Monitoring tools connected
  - [ ] Logging infrastructure ready
  - [ ] Email service configured (if needed)
  - [ ] SMS service configured (if needed)

---

## 🔨 Build & Deploy Steps

### Step 1: Code Preparation
- [ ] **Pull latest code**
  ```bash
  git checkout main
  git pull origin main
  git log --oneline -5  # Verify latest commits
  ```

- [ ] **Verify Phase 3 completion**
  ```bash
  git log --grep="Phase 3" --oneline
  git tag phase-3-complete  # Tag this version
  git push origin phase-3-complete
  ```

### Step 2: Build Production Bundle
- [ ] **Install dependencies**
  ```bash
  npm ci  # Clean install
  ```

- [ ] **Run build**
  ```bash
  npm run build
  ```

- [ ] **Verify build output**
  - [ ] Build completed successfully
  - [ ] No TypeScript errors
  - [ ] Bundle size reasonable
  - [ ] All routes compiled

### Step 3: Pre-Deployment Testing
- [ ] **Run test suite locally**
  ```bash
  npm run test
  ```
  - [ ] Critical path tests passing
  - [ ] No new test failures

- [ ] **Run linting**
  ```bash
  npm run lint
  ```
  - [ ] No critical lint errors

- [ ] **Check bundle analysis** (optional)
  ```bash
  npm run analyze
  ```

### Step 4: Deploy to Staging
- [ ] **Deploy application**
  - [ ] Using deployment tool (Vercel/Docker/etc.)
  - [ ] Or manual deployment steps:
    ```bash
    # Example for Docker
    docker build -t bella-erp-staging:phase-3 .
    docker push bella-erp-staging:phase-3
    docker-compose up -d
    ```

- [ ] **Verify deployment**
  - [ ] Application starts successfully
  - [ ] Health check endpoint responds
  - [ ] No errors in startup logs

### Step 5: Post-Deployment Verification
- [ ] **Run smoke tests**
  - [ ] Homepage loads
  - [ ] Login works
  - [ ] Dashboard loads
  - [ ] API health check passes

- [ ] **Check monitoring**
  - [ ] Sentry receiving events
  - [ ] Logs flowing correctly
  - [ ] Metrics being collected

---

## 🧪 UAT Testing Preparation

### Test Data Setup
- [ ] **Create test accounts**
  - [ ] Admin user account
  - [ ] KTV user account
  - [ ] Customer account
  - [ ] Accountant account

- [ ] **Seed test data**
  - [ ] Test customers
  - [ ] Test spa packages
  - [ ] Test bookings
  - [ ] Test KTV employees

### UAT Documentation
- [ ] **Prepare UAT test plan**
  - [ ] List critical user flows
  - [ ] Define success criteria
  - [ ] Create test scenarios
  - [ ] Prepare feedback form

- [ ] **Brief UAT team**
  - [ ] Share staging URL
  - [ ] Share test credentials
  - [ ] Explain what to test
  - [ ] Explain how to report issues

---

## 📊 Monitoring Setup

### Application Monitoring
- [ ] **Sentry configuration**
  - [ ] Error tracking active
  - [ ] Performance monitoring enabled
  - [ ] Alert rules configured
  - [ ] Team notifications set

- [ ] **Application logs**
  - [ ] Log aggregation working
  - [ ] Log retention configured
  - [ ] Search functionality tested

- [ ] **Performance monitoring**
  - [ ] Response time tracking
  - [ ] Database query monitoring
  - [ ] Redis cache metrics
  - [ ] API endpoint latency

### Infrastructure Monitoring
- [ ] **Server metrics**
  - [ ] CPU usage monitoring
  - [ ] Memory usage monitoring
  - [ ] Disk usage monitoring
  - [ ] Network traffic monitoring

- [ ] **Database metrics**
  - [ ] Connection pool monitoring
  - [ ] Query performance tracking
  - [ ] Storage usage tracking

---

## 🔧 Rollback Plan

### Preparation
- [ ] **Document rollback steps**
  - [ ] List commands to revert deployment
  - [ ] Identify rollback point (git commit/tag)
  - [ ] Estimate rollback duration (~15 minutes)

- [ ] **Test rollback procedure** (dry run)
  - [ ] Practice rollback on test environment
  - [ ] Verify rollback completes successfully
  - [ ] Document any issues found

### Rollback Trigger Criteria
Deploy rollback if:
- [ ] Critical functionality broken (login, payments, core flows)
- [ ] Error rate > 5%
- [ ] Response time degradation > 50%
- [ ] Database issues
- [ ] Security vulnerability discovered

### Rollback Commands
```bash
# Option 1: Git revert
git revert <commit-range>
npm run build
# Redeploy

# Option 2: Deploy previous version
git checkout phase-2-stable
npm run build
# Redeploy

# Option 3: Feature flag toggle
# Set USE_CORE_PLATFORM=false
# Restart application
```

---

## ✅ Post-Deployment Checklist

### Immediate (Within 1 Hour)
- [ ] **Verify core functionality**
  - [ ] User login works
  - [ ] Dashboard loads
  - [ ] Orders can be created
  - [ ] Payments process correctly
  - [ ] Sessions can be completed

- [ ] **Check error rates**
  - [ ] Sentry error rate < 1%
  - [ ] No critical errors
  - [ ] Application logs clean

- [ ] **Monitor performance**
  - [ ] Response times normal
  - [ ] Database queries performing well
  - [ ] No memory leaks

### First 24 Hours
- [ ] **Daily monitoring**
  - [ ] Check Sentry dashboard morning and evening
  - [ ] Review application logs
  - [ ] Monitor server resources
  - [ ] Check for any user-reported issues

- [ ] **Gather initial feedback**
  - [ ] Contact UAT team for first impressions
  - [ ] Document any issues found
  - [ ] Prioritize fixes if needed

### First Week
- [ ] **Continuous monitoring**
  - [ ] Daily error rate review
  - [ ] Performance metrics tracking
  - [ ] User feedback collection
  - [ ] Issue triage and resolution

- [ ] **UAT progress tracking**
  - [ ] Track UAT test completion
  - [ ] Document all findings
  - [ ] Fix critical issues
  - [ ] Prepare for production deployment

---

## 📋 Communication Plan

### Before Deployment
- [ ] **Notify stakeholders**
  - [ ] Email to all stakeholders (use template)
  - [ ] Set expectations for UAT
  - [ ] Share staging URL and credentials

- [ ] **Brief teams**
  - [ ] Development team briefing
  - [ ] Operations team briefing
  - [ ] Support team briefing (if needed)

### During Deployment
- [ ] **Status updates**
  - [ ] Deployment start notification
  - [ ] Progress updates (if long deployment)
  - [ ] Deployment completion notification

### After Deployment
- [ ] **Success notification**
  - [ ] Email to stakeholders
  - [ ] Share monitoring dashboard
  - [ ] Request UAT participation

- [ ] **Daily updates**
  - [ ] Send daily status during UAT
  - [ ] Share findings and resolutions
  - [ ] Update timeline as needed

---

## 🎯 Success Criteria

Staging deployment is considered **successful** if:
- [ ] Application deploys without errors
- [ ] All smoke tests pass
- [ ] Error rate < 1%
- [ ] Response time < 500ms average
- [ ] No critical functionality broken
- [ ] Monitoring tools working
- [ ] UAT can begin immediately

---

## 📞 Emergency Contacts

### Development Team
- **Lead Developer**: [Name] - [Phone] - [Email]
- **Backend Developer**: [Name] - [Phone] - [Email]
- **Frontend Developer**: [Name] - [Phone] - [Email]

### DevOps Team
- **DevOps Lead**: [Name] - [Phone] - [Email]
- **Infrastructure Engineer**: [Name] - [Phone] - [Email]

### Management
- **Product Manager**: [Name] - [Phone] - [Email]
- **CTO**: [Name] - [Phone] - [Email]

---

## 📝 Notes & Observations

**Deployment Start Time**: __________  
**Deployment End Time**: __________  
**Total Duration**: __________  
**Deployed By**: __________

**Issues Encountered**:
- [ ] None
- [ ] [List any issues]

**Resolutions Applied**:
- [ ] N/A
- [ ] [List resolutions]

**Overall Status**: 
- [ ] ✅ Success
- [ ] ⚠️ Success with minor issues
- [ ] ❌ Failed (rollback executed)

---

**Checklist Version**: 1.0  
**Last Updated**: 2026-06-17  
**Prepared By**: Kiro AI

