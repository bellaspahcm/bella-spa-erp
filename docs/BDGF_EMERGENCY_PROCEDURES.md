# BDGF EMERGENCY PROCEDURES
**Date:** August 22, 2026 (Day 3)  
**Purpose:** Incident response procedures for BDGF signing key compromise, system failures, and emergency rollback  
**Classification:** CONFIDENTIAL - SECURITY TEAM ONLY

---

## 🚨 EMERGENCY CONTACTS

**Incident Response Team:**
- Platform Lead: [Contact Info]
- Security Lead: [Contact Info]
- DevOps Lead: [Contact Info]
- On-Call Engineer: [On-Call Phone]

**Escalation Path:**
1. On-Call Engineer (immediate)
2. Platform Lead (< 15 min)
3. Security Lead (< 30 min)
4. CTO (if data breach suspected)

**Communication Channels:**
- Emergency Slack: `#incident-response`
- War Room: [Zoom/Meet Link]
- Status Page: [URL]

---

## 🔴 INCIDENT TYPES

### Priority Levels

**P0 - Critical (Immediate Response Required)**
- Signing key compromised or leaked
- Mass token validation failures
- BDGF completely down
- Security breach detected

**P1 - High (Response < 1 hour)**
- Secrets Manager unavailable
- Partial token validation failures
- Key rotation failed mid-process

**P2 - Medium (Response < 4 hours)**
- Elevated error rates
- Cache failures
- Monitoring alerts

---

## 🔥 SCENARIO 1: SIGNING KEY COMPROMISED

**Indicators:**
- Key found in public repository (git, pastebin, etc.)
- Key exposed in logs or error messages
- Unauthorized access to Secrets Manager detected
- Suspicious token issuance patterns

### Immediate Actions (< 5 minutes)

**1. Confirm Compromise**
```bash
# Check if key exposed in git history
git log -p --all | grep -i "GATE_SIGNING_KEY"

# Check recent Secrets Manager access
aws cloudtrail lookup-events \
  --lookup-attributes AttributeKey=ResourceName,AttributeValue=bdgf/gate-signing-key \
  --max-results 50 \
  --region us-east-1
```

**2. Declare Incident**
```bash
# Post to Slack
/incident declare "BDGF signing key potentially compromised - P0"

# Start war room
# Notify: Platform Lead, Security Lead, On-Call
```

### Emergency Rotation (< 15 minutes)

**Step 1: Generate New Key Immediately**
```bash
cd /path/to/bella-erp

# Generate new key
NEW_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
echo "New key generated (DO NOT log or share)"
```

**Step 2: Deploy New Key to Secrets Manager**
```bash
# Deploy new key as AWSPENDING
aws secretsmanager put-secret-value \
  --secret-id bdgf/gate-signing-key \
  --secret-string "{\"key\":\"$NEW_KEY\"}" \
  --version-stages AWSPENDING \
  --region us-east-1

echo "✅ New key deployed as AWSPENDING"
```

**Step 3: Promote to AWSCURRENT (SKIP TESTING IN EMERGENCY)**
```bash
# Get AWSPENDING version ID
PENDING_VERSION=$(aws secretsmanager describe-secret \
  --secret-id bdgf/gate-signing-key \
  --region us-east-1 \
  --query 'VersionIdsToStages' \
  --output json | jq -r 'to_entries[] | select(.value[] == "AWSPENDING") | .key')

# Promote to AWSCURRENT
aws secretsmanager update-secret-version-stage \
  --secret-id bdgf/gate-signing-key \
  --version-stage AWSCURRENT \
  --move-to-version-id $PENDING_VERSION \
  --region us-east-1

echo "✅ New key promoted to AWSCURRENT"
echo "⏱️  Elapsed time: Check if < 15 minutes"
```

**Step 4: Clear Application Caches**
```bash
# Restart application to clear in-memory cache
# OR
# Force cache clear via API
curl -X POST https://api.bella-erp.com/internal/cache/clear \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"cache": "secrets"}'

echo "✅ Application caches cleared"
```

**Step 5: Verify New Key Active**
```bash
# Test token issuance with new key
node scripts/bdgf/test-secrets-manager.mjs

# Check recent tokens using new key
psql $DATABASE_URL -c "
  SELECT token_id, created_at, status 
  FROM bella_gate_tokens 
  WHERE created_at > NOW() - INTERVAL '5 minutes'
  ORDER BY created_at DESC 
  LIMIT 10;
"

echo "✅ New key verified active"
```

### Post-Emergency Actions (< 1 hour)

**1. Invalidate All Old Tokens**
```bash
# Mark all tokens issued with old key as invalid
psql $DATABASE_URL -c "
  UPDATE bella_gate_tokens
  SET status = 'revoked',
      revoked_at = NOW(),
      revocation_reason = 'Emergency key rotation due to compromise'
  WHERE status = 'issued'
    AND created_at < (SELECT MAX(created_at) FROM bella_gate_tokens WHERE status = 'issued')
    AND token_signature NOT LIKE '%new_key_signature_pattern%';
"

echo "✅ Old tokens invalidated"
```

**2. Remove Compromised Key from Secrets Manager**
```bash
# Get AWSPREVIOUS version (compromised key)
PREVIOUS_VERSION=$(aws secretsmanager describe-secret \
  --secret-id bdgf/gate-signing-key \
  --region us-east-1 \
  --query 'VersionIdsToStages' \
  --output json | jq -r 'to_entries[] | select(.value[] == "AWSPREVIOUS") | .key')

# Remove AWSPREVIOUS stage
aws secretsmanager update-secret-version-stage \
  --secret-id bdgf/gate-signing-key \
  --version-stage AWSPREVIOUS \
  --remove-from-version-id $PREVIOUS_VERSION \
  --region us-east-1

echo "✅ Compromised key removed"
```

**3. Forensic Analysis**
```bash
# Where was key exposed?
# - Git history?
# - Logs?
# - Error messages?
# - External service?

# Document in incident report
```

**4. Notification**
```bash
# Notify users if needed (depending on impact)
# Update status page
# Send all-hands notification if required
```

### Recovery Validation (< 2 hours)

**Checklist:**
- [ ] New key deployed and active
- [ ] Old key removed from Secrets Manager
- [ ] All old tokens invalidated
- [ ] Application functioning normally
- [ ] No unauthorized token issuance detected
- [ ] Monitoring shows normal patterns
- [ ] Incident documented
- [ ] Post-mortem scheduled

---

## 🔄 SCENARIO 2: FAILED KEY ROTATION - ROLLBACK

**Indicators:**
- Token validation failures after rotation
- Application errors after promotion
- BDGF tests failing post-rotation

### Immediate Rollback (< 5 minutes)

**Step 1: Assess Situation**
```bash
# Check current secret versions
aws secretsmanager describe-secret \
  --secret-id bdgf/gate-signing-key \
  --region us-east-1 \
  --query 'VersionIdsToStages'

# Check application errors
tail -f /var/log/bella-erp/application.log | grep -i "signing"
```

**Step 2: Rollback to AWSPREVIOUS**
```bash
# Get version IDs
CURRENT_VERSION=$(aws secretsmanager describe-secret \
  --secret-id bdgf/gate-signing-key \
  --query 'VersionIdsToStages' \
  --output json | jq -r 'to_entries[] | select(.value[] == "AWSCURRENT") | .key')

PREVIOUS_VERSION=$(aws secretsmanager describe-secret \
  --secret-id bdgf/gate-signing-key \
  --query 'VersionIdsToStages' \
  --output json | jq -r 'to_entries[] | select(.value[] == "AWSPREVIOUS") | .key')

# Rollback: Promote AWSPREVIOUS to AWSCURRENT
aws secretsmanager update-secret-version-stage \
  --secret-id bdgf/gate-signing-key \
  --version-stage AWSCURRENT \
  --move-to-version-id $PREVIOUS_VERSION \
  --region us-east-1

echo "✅ Rolled back to previous key"
echo "   Failed version: $CURRENT_VERSION"
echo "   Restored version: $PREVIOUS_VERSION"
```

**Step 3: Clear Caches**
```bash
# Clear application cache
curl -X POST https://api.bella-erp.com/internal/cache/clear \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"cache": "secrets"}'

# Restart application if needed
kubectl rollout restart deployment/bella-erp-api
# OR
systemctl restart bella-erp
```

**Step 4: Verify Rollback**
```bash
# Test token issuance
node scripts/bdgf/test-secrets-manager.mjs

# Run BDGF test suite
node scripts/bdgf/r4-3-2-gate-token-test.mjs
node scripts/bdgf/r4-4-4-adversarial-test.mjs

echo "✅ Rollback verification complete"
```

### Root Cause Analysis

**Common Causes:**
1. **New key format incorrect** → Regenerate properly
2. **Permissions issue** → Check IAM policy
3. **Cache not cleared** → Force clear all caches
4. **Dual-key validation not implemented** → Fix validator code
5. **Secrets Manager API error** → Check AWS status

### Retry Rotation (After Fix)

```bash
# Fix root cause first
# Then retry rotation with dry-run
node scripts/bdgf/rotate-signing-key.mjs --dry-run

# If dry-run passes, execute rotation
node scripts/bdgf/rotate-signing-key.mjs
```

---

## 💥 SCENARIO 3: SECRETS MANAGER UNAVAILABLE

**Indicators:**
- `SecretsManager` API returning errors
- Timeout retrieving secrets
- AWS region outage

### Immediate Fallback (< 2 minutes)

**Option A: Use Cached Key (if cache enabled)**
```bash
# Application should use cached key automatically
# Verify cache is working

# Check cache TTL
curl https://api.bella-erp.com/health/bdgf

# Expected: Cache should serve for 5 minutes
```

**Option B: Emergency Environment Variable Fallback**
```bash
# ONLY IN EXTREME EMERGENCY
# Generate temporary key
EMERGENCY_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

# Set environment variable (container/instance level)
export GATE_SIGNING_KEY=$EMERGENCY_KEY

# Restart application
systemctl restart bella-erp

# ⚠️  CRITICAL: This is temporary only!
# Must migrate back to Secrets Manager when available
```

**Option C: Switch to Different AWS Region**
```bash
# If us-east-1 down, switch to us-west-2
export AWS_REGION=us-west-2

# Ensure secret replicated to us-west-2 first!
# (Set up cross-region replication in advance)

# Restart application
systemctl restart bella-erp
```

### Recovery (When Secrets Manager Available)

```bash
# Verify Secrets Manager available
aws secretsmanager describe-secret \
  --secret-id bdgf/gate-signing-key \
  --region us-east-1

# If available, remove emergency fallback
unset GATE_SIGNING_KEY

# Restart application to use Secrets Manager
systemctl restart bella-erp

# Verify normal operation
node scripts/bdgf/test-secrets-manager.mjs
```

---

## 🔧 SCENARIO 4: DATABASE FAILURE - BDGF DOWN

**Indicators:**
- Cannot write to `bella_gate_tokens` table
- Cannot read from `bella_migration_approval` table
- Database connection errors

### Immediate Response

**Step 1: Assess Database Status**
```bash
# Check database connectivity
psql $DATABASE_URL -c "SELECT 1;"

# Check table access
psql $DATABASE_URL -c "SELECT COUNT(*) FROM bella_gate_tokens;"
```

**Step 2: Emergency Read-Only Mode**
```bash
# If database read-only, BDGF cannot issue new tokens
# Options:
# 1. Wait for database recovery (preferred)
# 2. Defer migrations until database writable
# 3. Emergency bypass (NOT RECOMMENDED)

# Check pending migrations
psql $DATABASE_URL -c "
  SELECT approval_id, migration_id, status 
  FROM bella_migration_approval 
  WHERE status = 'approved' 
  ORDER BY created_at;
"
```

**Step 3: Database Recovery**
```bash
# Follow database incident procedures
# Once database writable, resume BDGF operations

# Test BDGF after recovery
node scripts/bdgf/r4-3-2-gate-token-test.mjs
```

---

## 📋 INCIDENT RESPONSE CHECKLIST

### During Incident

- [ ] **Minute 0:** Incident declared
- [ ] **Minute 2:** War room started, team notified
- [ ] **Minute 5:** Situation assessed, priority confirmed
- [ ] **Minute 15:** Emergency actions executed
- [ ] **Minute 30:** Recovery validated
- [ ] **Minute 60:** Post-incident actions complete

### After Incident

- [ ] Incident timeline documented
- [ ] Root cause identified
- [ ] Post-mortem scheduled (< 48 hours)
- [ ] Action items created
- [ ] Runbook updated
- [ ] Team debriefed
- [ ] Monitoring improved
- [ ] Prevention measures implemented

---

## 🛡️ PREVENTION MEASURES

### Reduce Risk of Key Compromise

**1. Never Commit Secrets to Git**
```bash
# .gitignore (ensure these patterns exist)
.env
.env.*
*.pem
*.key
secrets/
```

**2. Rotate Keys Regularly**
```bash
# Quarterly rotation schedule
# Q1: January 1
# Q2: April 1
# Q3: July 1
# Q4: October 1

# Set calendar reminder
```

**3. Limit Secrets Manager Access**
```bash
# Principle of least privilege
# Only application service account needs GetSecretValue
# Humans should NOT have direct access in production
```

**4. Enable CloudTrail Monitoring**
```bash
# Alert on unusual Secrets Manager access
# Monitor for:
# - Access from unknown IP
# - Access outside business hours
# - Multiple failed attempts
```

**5. Use Short-Lived Tokens**
```bash
# Token TTL: 60 seconds max (already implemented)
# Tokens automatically expire
# Reduces blast radius of compromised tokens
```

### Improve Failure Recovery

**1. Cross-Region Replication**
```bash
# Replicate secrets to us-west-2
aws secretsmanager replicate-secret-to-regions \
  --secret-id bdgf/gate-signing-key \
  --add-replica-regions Region=us-west-2
```

**2. Automated Failover**
```bash
# If us-east-1 down, automatically switch to us-west-2
# Implement in application health check
```

**3. Enhanced Caching**
```bash
# Increase cache TTL in emergency
# Allow application to function without Secrets Manager for short periods
```

**4. Regular Disaster Recovery Drills**
```bash
# Quarterly DR drill
# Practice:
# - Key compromise response
# - Secrets Manager outage
# - Database failure
# - Full system rollback
```

---

## 📞 COMMUNICATION TEMPLATES

### Internal Notification (Security Team)

```
🚨 SECURITY INCIDENT - P0

Incident: BDGF Signing Key Compromise
Detected: [TIMESTAMP]
Status: Emergency rotation in progress

Actions Taken:
✅ New key generated
✅ Deployed to Secrets Manager
✅ Application restarted
⏳ Old tokens being invalidated

ETA Resolution: 15 minutes
War Room: [LINK]
```

### Status Page Update (External)

```
⚠️ Service Degradation

We are experiencing elevated error rates due to a security 
maintenance event. All data is secure. Migrations are temporarily
paused. Expected resolution: 30 minutes.

Update: [TIMESTAMP]
```

### All-Hands (If Major Impact)

```
Security Incident - All Hands

A security key was rotated as a precautionary measure. All systems
are secure and operational. No data breach occurred. Migrations were
paused for 15 minutes during rotation. Normal operations resumed.

Incident Report: [LINK]
```

---

## 🔍 POST-MORTEM TEMPLATE

```markdown
# Post-Mortem: [Incident Title]

**Date:** [Date]
**Duration:** [Start] - [End] ([Duration])
**Severity:** P0 / P1 / P2
**Impact:** [Description]

## Timeline

- [HH:MM] Incident detected
- [HH:MM] Team notified
- [HH:MM] Emergency actions started
- [HH:MM] Resolution achieved
- [HH:MM] Verification complete

## Root Cause

[Detailed explanation]

## Resolution

[Steps taken to resolve]

## Action Items

1. [ ] [Action] - Owner: [Name] - Due: [Date]
2. [ ] [Action] - Owner: [Name] - Due: [Date]

## Lessons Learned

**What Went Well:**
- [Item]

**What Went Wrong:**
- [Item]

**How to Improve:**
- [Item]
```

---

## 📚 REFERENCE LINKS

**Internal:**
- BDGF Setup Guide: `docs/BDGF_AWS_SECRETS_MANAGER_SETUP.md`
- Rotation Script: `scripts/bdgf/rotate-signing-key.mjs`
- Test Scripts: `scripts/bdgf/*-test.mjs`

**External:**
- AWS Secrets Manager: https://docs.aws.amazon.com/secretsmanager/
- CloudTrail Monitoring: https://docs.aws.amazon.com/cloudtrail/
- Incident Response Best Practices: [Internal Wiki]

---

**Prepared By:** Stream A Team  
**Date:** August 22, 2026 — Day 3  
**Classification:** CONFIDENTIAL  
**Distribution:** Security Team, Platform Team, On-Call Engineers

**Last Reviewed:** August 22, 2026  
**Next Review:** November 22, 2026  
**Review Cycle:** Quarterly

---
