# BDGF PRODUCTION DEPLOYMENT GUIDE
**Version:** 1.0.0  
**Date:** 2026-08-20  
**Status:** BDGF MVP Complete

---

## EXECUTIVE SUMMARY

This guide provides step-by-step instructions for deploying BDGF (Bella Deployment Governance Framework) to production.

**Prerequisites:**
- BDGF MVP Complete (✅ verified 2026-08-20)
- PostgreSQL database access
- `bella_migration_executor` role configured
- Environment variables configured

---

## DEPLOYMENT CHECKLIST

### Phase 1: Pre-Deployment Verification

- [ ] Review all evidence documents in `evidence/g3a-architecture/`
- [ ] Verify R3-R4.4 test suite passes (119+ tests)
- [ ] Confirm no regressions in R4.3 tests
- [ ] Review production readiness checklist
- [ ] Backup existing database

### Phase 2: Database Schema Deployment

- [ ] Deploy `bella_gate_approvals` table (if not exists)
- [ ] Deploy `bella_gate_tokens` table
- [ ] Deploy `bella_security_incidents` table
- [ ] Deploy `bella_recovery_actions` table
- [ ] Verify foreign key constraints
- [ ] Verify indexes created

### Phase 3: Configuration

- [ ] Set `GATE_SIGNING_KEY` in production environment
- [ ] Configure `DATABASE_EXECUTOR_URL`
- [ ] Set database connection pooling
- [ ] Configure SSL/TLS for database connections

### Phase 4: Operational Setup

- [ ] Document incident response procedures
- [ ] Set up monitoring/alerting (post-MVP)
- [ ] Configure backup/restore procedures
- [ ] Document recovery runbooks

### Phase 5: Post-Deployment Verification

- [ ] Run `deploy-verify.mjs` script
- [ ] Execute end-to-end lifecycle test
- [ ] Verify incident recording
- [ ] Verify recovery procedures
- [ ] Check audit trail completeness

---

## CURRENT DEPLOYMENT STATUS

### Database Tables

**Deployed:**
```
✅ bella_gate_tokens             (R4.3 Execution Authority)
✅ bella_security_incidents       (R4.4.1 Security Monitoring)
✅ bella_recovery_actions         (R4.4.2 Recovery Control)
✅ bella_migration_approval       (R4.2 Approval Gate - alternate name)
```

**Note:** `bella_migration_approval` serves the same purpose as `bella_gate_approvals`. Both table names are acceptable.

### Environment Configuration

**Required:**
```
DATABASE_EXECUTOR_URL=<connection_string>
GATE_SIGNING_KEY=<signing_key>
```

**Optional (for Supabase integration):**
```
SUPABASE_URL=<url>
SUPABASE_ANON_KEY=<key>
```

---

## DEPLOYMENT SCRIPTS

### 1. Schema Verification

**Script:** `scripts/bdgf/check-tables.mjs`

**Purpose:** Verify all BDGF tables exist

**Usage:**
```bash
node scripts/bdgf/check-tables.mjs
```

**Expected Output:**
```
BDGF Tables Deployed:
✅ bella_gate_tokens
✅ bella_security_incidents
✅ bella_recovery_actions
✅ bella_migration_approval (or bella_gate_approvals)

✅ All BDGF tables deployed!
```

---

### 2. Deployment Verification

**Script:** `scripts/bdgf/deploy-verify.mjs`

**Purpose:** Comprehensive deployment health check

**Usage:**
```bash
node scripts/bdgf/deploy-verify.mjs
```

**Checks:**
1. Database schema (4 tables)
2. Environment configuration
3. Database connectivity
4. Table data status
5. Foreign key constraints
6. Core functions test

**Expected Result:** All checks pass

---

### 3. End-to-End Lifecycle Test

**Script:** `scripts/bdgf/r4-3-4-full-lifecycle-test.mjs`

**Purpose:** Verify complete BDGF workflow

**Usage:**
```bash
node scripts/bdgf/r4-3-4-full-lifecycle-test.mjs
```

**Verified Flow:**
```
1. Developer attempts direct mutation (blocked by R3)
2. Migration request prepared
3. Approval created (R4.2)
4. Gate token issued (R4.3.2)
5. Authorization chain verified (R4.3.3)
6. Migration executed
7. Token consumed (single-use)
8. Audit trail recorded
9. Post-execution bypass attempt (blocked)
```

**Expected:** 8/8 steps PASS

---

### 4. Adversarial Test Suite

**Script:** `scripts/bdgf/r4-4-4-adversarial-test.mjs`

**Purpose:** Verify detection & recovery under attack

**Usage:**
```bash
node scripts/bdgf/r4-4-4-adversarial-test.mjs
```

**Expected:** 9/9 scenarios PASS

---

## PRODUCTION CONFIGURATION

### Secrets Management

**MVP (Current):**
```bash
# .env file
GATE_SIGNING_KEY=<base64_encoded_key>
```

**Production (Post-MVP - Q3 2024):**
```
Migrate to secrets manager:
- AWS Secrets Manager
- HashiCorp Vault
- Azure Key Vault
```

### Key Generation

Generate a new signing key for production:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

**⚠️ Security:**
- Never commit signing keys to git
- Rotate keys quarterly
- Use different keys for staging/production
- Document key recovery procedures

---

### Database Connection

**Connection Pooling:**
```javascript
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_EXECUTOR_URL,
  ssl: { rejectUnauthorized: false },
  max: 20,                    // Maximum pool size
  idleTimeoutMillis: 30000,  // Close idle clients after 30s
  connectionTimeoutMillis: 2000  // Return error after 2s if no connection available
});
```

**SSL/TLS:**
```
Ensure SSL is enabled for production:
- rejectUnauthorized: true (production)
- Use certificate pinning if available
```

---

## MONITORING & ALERTING

### MVP (Current)

**Available:**
- Console logging
- Database incident recording
- Real-time detection at execution boundary

**Monitoring:**
```sql
-- Recent incidents
SELECT incident_type, severity, COUNT(*) 
FROM bella_security_incidents 
WHERE occurred_at > NOW() - INTERVAL '24 hours'
GROUP BY incident_type, severity;

-- Unresolved incidents
SELECT incident_id, incident_type, severity, occurred_at
FROM bella_security_incidents
WHERE recovery_required = TRUE AND resolved_at IS NULL
ORDER BY occurred_at DESC;

-- Recovery status
SELECT r.action_type, r.execution_result, COUNT(*)
FROM bella_recovery_actions r
JOIN bella_security_incidents i ON r.incident_id = i.incident_id
WHERE i.occurred_at > NOW() - INTERVAL '7 days'
GROUP BY r.action_type, r.execution_result;
```

### Post-MVP (Roadmap)

**Planned:**
- APM/Grafana dashboards
- Real-time alerting (Slack/email/PagerDuty)
- Distributed tracing
- SLO/SLA monitoring
- Automated incident response

---

## INCIDENT RESPONSE

### Detection

**Automatic Detection:**
- Forged tokens
- Expired tokens
- Replay attacks
- Binding mismatches
- Direct bypass attempts
- Execution failures

**Alert Channels (MVP):**
- Database: `bella_security_incidents`
- Console: Real-time logs

### Response Procedures

#### 1. Authorization Failures (CRITICAL)

**Incidents:** forged_token, replay_attack, binding_mismatch, bypass_attempt

**Response:**
1. ✅ Already blocked (fail-closed)
2. Verify zero mutations
3. Investigate attack source
4. Review access logs
5. Consider credential rotation if breach suspected

**Recovery:** Automatic (fail-closed verification)

#### 2. Execution Failures (ERROR)

**Incidents:** execution_failure

**Response:**
1. Check if transactional (auto-rollback)
2. If non-transactional, inspect partial state
3. Execute cleanup/forward-fix if needed
4. Verify final state
5. Mark incident as resolved

**Recovery:** Semi-automatic (procedure documented)

#### 3. Environment Failures (WARNING)

**Incidents:** execution timeout, connection failure

**Response:**
1. Inspect execution state (UNKNOWN)
2. Check if migration was applied
3. Decide: rollback or forward-fix
4. Manual verification required
5. Document resolution

**Recovery:** Manual (requires human decision)

---

## BACKUP & RECOVERY

### Database Backup

**Frequency:**
- Full backup: Daily
- Incremental: Hourly
- Transaction log: Continuous

**Critical Tables:**
```
bella_gate_tokens           (authorization trail)
bella_gate_approvals         (approval audit)
bella_security_incidents     (security forensics)
bella_recovery_actions       (recovery audit)
```

### Disaster Recovery

**RTO (Recovery Time Objective):** < 4 hours  
**RPO (Recovery Point Objective):** < 1 hour

**Procedure:**
1. Restore database from backup
2. Verify table integrity
3. Run `deploy-verify.mjs`
4. Execute lifecycle test
5. Resume operations

---

## ROLLBACK PROCEDURES

### Schema Rollback

**If deployment fails:**

```sql
-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS bella_recovery_actions CASCADE;
DROP TABLE IF EXISTS bella_security_incidents CASCADE;
DROP TABLE IF EXISTS bella_gate_tokens CASCADE;
DROP TABLE IF EXISTS bella_gate_approvals CASCADE;
```

**⚠️ Warning:** This deletes all audit trail. Only use in emergency.

### Application Rollback

**If BDGF causes issues:**

1. Disable gate token enforcement
2. Fall back to direct execution (R3 only)
3. Investigate root cause
4. Fix and redeploy

**Fallback Mode:**
```javascript
// Temporarily bypass R4.3 gate tokens
process.env.BDGF_BYPASS_MODE = 'true'; // Emergency only!
```

**⚠️ Critical:** Document and review all bypass usage.

---

## POST-DEPLOYMENT TASKS

### Immediate (Week 1)

- [ ] Monitor incident rates for 7 days
- [ ] Review all recorded incidents
- [ ] Verify recovery procedures executed correctly
- [ ] Check audit trail completeness
- [ ] Document any issues/edge cases

### Short-Term (Month 1)

- [ ] Analyze incident patterns
- [ ] Tune detection sensitivity if needed
- [ ] Optimize database queries/indexes
- [ ] Create operational runbooks
- [ ] Train team on incident response

### Long-Term (Quarter 1)

- [ ] Migrate to secrets manager
- [ ] Implement APM/Grafana dashboards
- [ ] Set up real-time alerting
- [ ] Conduct load testing
- [ ] Review and update procedures

---

## KNOWN LIMITATIONS (MVP)

### Out of Scope

**Not included in MVP:**
- Real-time alerting (Slack/email/PagerDuty)
- APM/Grafana dashboards
- Distributed tracing
- Load/stress testing
- Chaos engineering
- Multi-region deployment
- High-availability setup
- Automated incident response
- ML-based anomaly detection

**Rationale:** MVP focuses on core closed-loop governance. Observability enhancements are post-MVP.

### MVP Boundaries

**What MVP Delivers:**
✅ Prevent unauthorized execution (R3 + R4.3)  
✅ Detect security incidents (R4.4.1)  
✅ Execute recovery procedures (R4.4.2)  
✅ Maintain audit trail (R4.4.3)  
✅ Verify under adversarial conditions (R4.4.4)  

**What MVP Does NOT Deliver:**
❌ Real-time alerting to external systems  
❌ Automated incident triage  
❌ Performance metrics dashboards  
❌ High-availability clustering  

---

## SUPPORT & TROUBLESHOOTING

### Common Issues

#### Issue: Table not found

**Symptom:** `relation "bella_gate_approvals" does not exist`

**Solution:**
```bash
# Check deployed tables
node scripts/bdgf/check-tables.mjs

# If missing, deploy schema
node scripts/bdgf/deploy-schema.mjs
```

#### Issue: Signature validation fails

**Symptom:** `Token validation failed: INVALID_SIGNATURE`

**Solution:**
1. Verify `GATE_SIGNING_KEY` matches between issuer and validator
2. Check key encoding (base64)
3. Ensure no whitespace in key
4. Verify token not tampered

#### Issue: Token already used

**Symptom:** `Token validation failed: TOKEN_ALREADY_USED`

**Solution:**
1. ✅ Expected behavior (single-use enforcement)
2. Issue new token for retry
3. Investigate if replay attack

#### Issue: Permission denied

**Symptom:** `must be owner of table`

**Solution:**
1. Verify using `bella_migration_executor` role
2. Check database permissions
3. Grant necessary privileges

---

## CONCLUSION

**BDGF MVP is production-ready.**

**Deployed Components:**
- ✅ R3: Database Authority
- ✅ R4.2: Approval Gate
- ✅ R4.3: Execution Authority
- ✅ R4.4: Detection & Recovery

**Next Steps:**
1. Deploy to staging
2. Run full verification suite
3. Monitor for 7 days
4. Deploy to production
5. Plan post-MVP enhancements

---

**For questions or issues:**
- Review evidence: `evidence/g3a-architecture/`
- Check test suite: `scripts/bdgf/`
- Consult architecture: `docs/architecture/BDGF-*.md`

---

**Deployment Date:** 2026-08-20  
**Version:** BDGF MVP 1.0.0  
**Status:** ✅ Production Ready

---
