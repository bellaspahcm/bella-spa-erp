# BDGF PRODUCTIONIZATION PLAN
**Date:** 2026-08-20  
**Current:** August 2026 — BDGF MVP Complete  
**Status:** Planning Phase — Stream A  
**Goal:** Transform BDGF from MVP to Production-Grade Governance

---

## EXECUTIVE SUMMARY

**Current:** BDGF MVP Complete (119+ tests PASS, closed-loop governance proven)

**Goal:** Production-grade deployment governance mechanism used for ALL Bella production changes

**Timeline:** September-October 2026 (6-8 weeks)

**Priority:** CRITICAL (Stream A — runs parallel with Platform Core inventory)

**Parallel Execution:**
- **Stream A:** BDGF Productionization (this document)
- **Stream B:** Platform Core Freeze preparation
- **Stream C:** EOS×EIP integration specification

---

## WHY THIS MATTERS

BDGF MVP proved the concept. Now we need to prove it works at scale, with real production traffic, real incidents, real recovery procedures.

**Without productionization:**
- BDGF remains "experimental"
- Manual monitoring required
- No real-time incident response
- Secret management immature
- Can't enforce deployment gates

**With productionization:**
- BDGF becomes THE deployment mechanism
- Automated monitoring & alerting
- Real-time incident response
- Enterprise-grade security
- Enforced governance for all changes

---

## SCOPE

### In Scope

✅ Secrets management hardening  
✅ Credential rotation automation  
✅ Real-time monitoring & alerting  
✅ Audit dashboard & incident management  
✅ Backup/recovery automation  
✅ Regression suite CI/CD integration  
✅ Deployment gate enforcement  

### Out of Scope (Post-Productionization)

❌ New governance features  
❌ Platform Core freeze  
❌ New Industry OS  
❌ Application-level governance  
❌ Multi-region HA  

---

## WORKSTREAM 1: SECRETS MANAGEMENT

**Status:** ⏳ Not Started  
**Priority:** CRITICAL  
**Timeline:** Week 1-2 (Early September 2026)

### Current State

**MVP Implementation:**
```bash
# .env file
GATE_SIGNING_KEY=<base64_key>
```

**Issues:**
- Keys in plaintext files
- No rotation mechanism
- No audit trail
- Manual key distribution
- No recovery procedures

### Target State

**Production Implementation:**
```
AWS Secrets Manager / HashiCorp Vault
  ↓
Automatic key retrieval
  ↓
Runtime decryption
  ↓
In-memory only (never written to disk)
```

### Tasks

#### 1.1 Choose Secrets Manager

**Options:**
- AWS Secrets Manager (if using AWS)
- HashiCorp Vault (provider-agnostic)
- Azure Key Vault (if using Azure)
- Google Secret Manager (if using GCP)

**Recommendation:** AWS Secrets Manager (Bella likely on AWS/Supabase)

**Decision Point:** Confirm cloud provider strategy

#### 1.2 Migrate GATE_SIGNING_KEY

- [ ] Create secret in secrets manager
- [ ] Update code to retrieve from secrets manager
- [ ] Test token issuance with new retrieval method
- [ ] Test token validation with new retrieval method
- [ ] Remove key from .env files
- [ ] Update deployment documentation

**Code Change:**
```javascript
// Before (MVP)
const signingKey = process.env.GATE_SIGNING_KEY;

// After (Production)
import { SecretsManager } from '@aws-sdk/client-secrets-manager';

async function getSigningKey() {
  const client = new SecretsManager({ region: 'us-east-1' });
  const response = await client.getSecretValue({
    SecretId: 'bdgf/gate-signing-key'
  });
  return response.SecretString;
}
```

#### 1.3 Implement Key Rotation

- [ ] Define rotation schedule (quarterly recommended)
- [ ] Implement dual-key validation (old + new during rotation window)
- [ ] Create rotation procedure document
- [ ] Test rotation end-to-end
- [ ] Set up automated rotation (AWS Lambda or scheduled job)

**Rotation Procedure:**
```
1. Generate new key
2. Store as 'key-v2' in secrets manager
3. Update issuer to use 'key-v2'
4. Validator accepts both 'key-v1' and 'key-v2' (7-day overlap)
5. After 7 days, remove 'key-v1'
6. Rename 'key-v2' → 'key-v1'
```

#### 1.4 Document Recovery Procedures

- [ ] Key compromise response plan
- [ ] Emergency rotation procedure
- [ ] Token revocation mechanism
- [ ] Incident communication plan

**Deliverable:** `docs/BDGF_SECRET_MANAGEMENT.md`

---

## WORKSTREAM 2: CREDENTIAL ROTATION

**Status:** ⏳ Not Started  
**Priority:** HIGH  
**Timeline:** Week 2-3 (Mid September 2026)

### Current State

**Database Credentials:**
- Manual rotation
- Requires application restart
- No automated testing
- No rollback procedure

### Target State

**Automated Rotation:**
```
Scheduled Rotation Job
  ↓
Generate new credentials
  ↓
Test connectivity with new credentials
  ↓
Update connection pool
  ↓
Zero-downtime cutover
  ↓
Verify old credentials disabled
  ↓
Audit trail recorded
```

### Tasks

#### 2.1 Database Credential Rotation

- [ ] Implement connection pool refresh without restart
- [ ] Create rotation script
- [ ] Test zero-downtime rotation
- [ ] Set up automated schedule (monthly)
- [ ] Document rollback procedure

#### 2.2 API Key Rotation

- [ ] Inventory all API keys (Supabase, external services)
- [ ] Implement rotation for each
- [ ] Test integration after rotation
- [ ] Document rotation procedures

#### 2.3 Rotation Audit Trail

- [ ] Record rotation events in `bella_security_incidents`
- [ ] Capture: who, when, why, result
- [ ] Alert on rotation failures
- [ ] Dashboard for rotation history

**Deliverable:** `scripts/bdgf/rotate-credentials.mjs`

---

## WORKSTREAM 3: MONITORING & ALERTING

**Status:** ⏳ Not Started  
**Priority:** CRITICAL  
**Timeline:** Week 3-4 (Late September 2026)

### Current State

**MVP Monitoring:**
- Console logs
- Database incident records
- Manual queries to check incidents

**Issues:**
- No real-time visibility
- No proactive alerts
- Manual dashboard construction
- No anomaly detection

### Target State

**Production Monitoring:**
```
Real-time Detection
  ↓
Incident Classification
  ↓
Severity-based Routing
  ↓
Alert Delivery (Slack/PagerDuty/Email)
  ↓
Incident Dashboard
  ↓
Automated Metrics
```

### Tasks

#### 3.1 APM/Grafana Dashboards

**Dashboards to Build:**

**Dashboard 1: BDGF Overview**
- Total incidents (24h / 7d / 30d)
- Incidents by type (pie chart)
- Incidents by severity (stacked bar)
- Recovery success rate
- Detection latency (avg / p95 / p99)

**Dashboard 2: Token Metrics**
- Tokens issued (rate over time)
- Tokens consumed (rate over time)
- Token consumption latency
- Token expiration rate
- Invalid token attempts

**Dashboard 3: Security Incidents**
- Forged token attempts (CRITICAL)
- Replay attacks (CRITICAL)
- Binding mismatches (CRITICAL)
- Bypass attempts (CRITICAL)
- Geographic distribution (if available)

**Dashboard 4: Recovery Operations**
- Recovery procedures executed
- Recovery success/failure rate
- Manual intervention required rate
- Time to recovery (avg / p95)

**Implementation:**
- [ ] Set up Grafana instance
- [ ] Configure Prometheus/InfluxDB for metrics
- [ ] Create dashboard JSON definitions
- [ ] Set up data retention policies

**Deliverable:** Grafana dashboard JSON exports

#### 3.2 Real-Time Alerting

**Alert Channels:**
- Slack (for team visibility)
- PagerDuty (for on-call escalation)
- Email (for audit trail)

**Alert Rules:**

**CRITICAL Alerts (immediate notification):**
- Forged token detected
- Replay attack detected
- Binding mismatch detected
- Bypass attempt detected
- Recovery procedure failed

**ERROR Alerts (15min delay):**
- Execution failure
- Token validation error
- Database connectivity issue

**WARNING Alerts (1hr delay):**
- Expired token usage
- Concurrent execution attempt
- High token failure rate (> 5% in 1h)

**Implementation:**
- [ ] Set up alert routing
- [ ] Configure Slack webhooks
- [ ] Configure PagerDuty integration
- [ ] Test alert delivery for each severity
- [ ] Document alert response procedures

**Deliverable:** `docs/BDGF_ALERT_RUNBOOK.md`

#### 3.3 SLO/SLA Definitions

**Service Level Objectives:**
- Detection latency: < 100ms (p99)
- Incident recording: 100% (no missed incidents)
- Recovery initiation: < 5 minutes (for automated)
- Audit trail completeness: 100%

**Service Level Agreements:**
- Deployment gate availability: 99.9%
- Token issuance latency: < 500ms (p95)
- False positive rate: < 1%

**Implementation:**
- [ ] Define measurement methods
- [ ] Set up SLO tracking dashboards
- [ ] Create SLO violation alerts
- [ ] Quarterly SLO review process

---

## WORKSTREAM 4: AUDIT DASHBOARD

**Status:** ⏳ Not Started  
**Priority:** MEDIUM  
**Timeline:** Week 4-5 (Early October 2026)

### Current State

**MVP Audit:**
- SQL queries to view incidents
- Manual correlation of incidents → recoveries
- No UI for incident management

### Target State

**Production Audit:**
```
Incident Management UI
  ↓
Filter / Search / Sort
  ↓
Incident Details (full context)
  ↓
Recovery Status Tracking
  ↓
Resolution Workflow
  ↓
Audit Trail Export
```

### Tasks

#### 4.1 Incident Management UI

**Features:**
- [ ] Incident list view (table with pagination)
- [ ] Filtering (by type, severity, date, status)
- [ ] Sorting (by date, severity)
- [ ] Search (by token_id, approval_id, migration_id)
- [ ] Incident detail view (full context + timeline)
- [ ] Recovery action list (per incident)
- [ ] Resolution workflow (mark resolved, add notes)

**Tech Stack Options:**
- React + Supabase (if using Supabase for auth)
- Next.js + API routes
- Simple admin panel (Retool, Forest Admin)

**Recommendation:** Start with Retool/Forest Admin for speed

#### 4.2 Audit Query Interface

**Pre-built Queries:**
- All incidents in last 24h/7d/30d
- All critical incidents (unresolved)
- All incidents by type
- Token audit trail (full lifecycle)
- Approval audit trail
- Recovery success rate
- Incident trends over time

**Implementation:**
- [ ] Create query templates
- [ ] Build query builder UI (optional)
- [ ] Export functionality (CSV, JSON)
- [ ] Scheduled reports (weekly security report)

**Deliverable:** Audit dashboard accessible at `/admin/audit`

---

## WORKSTREAM 5: BACKUP & RECOVERY

**Status:** ⏳ Not Started  
**Priority:** MEDIUM  
**Timeline:** Week 5-6 (Mid October 2026)

### Current State

**MVP Backup:**
- Database provider backups (if enabled)
- No BDGF-specific backup procedures
- No tested recovery procedures

### Target State

**Production Backup:**
```
Automated Backups
  ↓
Full: Daily
Incremental: Hourly
Transaction Log: Continuous
  ↓
Backup Verification (weekly)
  ↓
Documented Recovery Procedures
  ↓
Tested Recovery (quarterly)
  ↓
RTO: < 4h, RPO: < 1h
```

### Tasks

#### 5.1 Automated Backup Configuration

- [ ] Enable automated backups on database provider
- [ ] Configure backup retention (30d full, 7d incremental)
- [ ] Set up offsite backup replication
- [ ] Test backup restoration

#### 5.2 BDGF-Specific Backup

**Critical Tables:**
- `bella_gate_tokens` (authorization trail)
- `bella_gate_approvals` (approval audit)
- `bella_security_incidents` (security forensics)
- `bella_recovery_actions` (recovery audit)

**Backup Strategy:**
- [ ] Separate BDGF table dumps (daily)
- [ ] Store in S3 / cloud storage (encrypted)
- [ ] Retention: 1 year for audit compliance
- [ ] Test restoration of BDGF tables independently

#### 5.3 Disaster Recovery Procedures

**Document:**
- [ ] Database restoration steps
- [ ] BDGF schema verification
- [ ] Data integrity checks
- [ ] Service restoration sequence
- [ ] Rollback procedures

**Test:**
- [ ] Quarterly DR drill
- [ ] Measure RTO/RPO
- [ ] Update procedures based on learnings

**Deliverable:** `docs/BDGF_DISASTER_RECOVERY.md`

---

## WORKSTREAM 6: REGRESSION SUITE AUTOMATION

**Status:** ⏳ Not Started  
**Priority:** HIGH  
**Timeline:** Week 6-7 (Late October 2026)

### Current State

**MVP Testing:**
- Manual test execution
- Tests run on-demand
- No CI/CD integration
- No pre-deployment gate

### Target State

**Production Testing:**
```
Code Commit
  ↓
Automated Test Trigger
  ↓
Run Full Regression Suite (119+ tests)
  ↓
All tests MUST pass
  ↓
Deployment Gate Opens
  ↓
Deploy to production
```

### Tasks

#### 6.1 CI/CD Integration

**Platform:** GitHub Actions / GitLab CI / Jenkins

**Pipeline:**
```yaml
# .github/workflows/bdgf-test.yml
name: BDGF Test Suite

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - name: R4.3.2 Token Crypto
        run: node scripts/bdgf/r4-3-2-gate-token-test.mjs
      - name: R4.3.3 Bypass Prevention
        run: node scripts/bdgf/r4-3-3-bypass-test.mjs
      - name: R4.3.4 Full Lifecycle
        run: node scripts/bdgf/r4-3-4-full-lifecycle-test.mjs
      - name: R4.4.4 Adversarial Tests
        run: node scripts/bdgf/r4-4-4-adversarial-test.mjs
```

**Implementation:**
- [ ] Create CI/CD pipeline configuration
- [ ] Set up test database (ephemeral or dedicated)
- [ ] Configure secrets for CI environment
- [ ] Test pipeline end-to-end
- [ ] Set up status checks (required for merge)

#### 6.2 Pre-Deployment Gate

**Requirement:** ALL 119+ tests MUST pass before production deployment.

**Implementation:**
- [ ] CI/CD pipeline blocks on test failure
- [ ] Manual override requires architect approval + incident recording
- [ ] Failed deployment logged as security incident
- [ ] Post-mortem required for test failures in production pipeline

**Deliverable:** `.github/workflows/bdgf-ci.yml` (or equivalent)

---

## WORKSTREAM 7: DEPLOYMENT GATE ENFORCEMENT

**Status:** ⏳ Not Started  
**Priority:** CRITICAL  
**Timeline:** Week 7-8 (Early November 2026)

### Current State

**MVP Enforcement:**
- BDGF available but optional
- Developers can bypass (for testing)
- No mandatory approval workflow

### Target State

**Production Enforcement:**
```
EVERY production migration MUST:
1. Have approval record
2. Have gate token
3. Pass R4.3 authorization checks
4. Be audited in real-time
5. Trigger recovery on failure

NO EXCEPTIONS (unless emergency escalation)
```

### Tasks

#### 7.1 Mandatory BDGF Policy

**Document:**
- [ ] Policy: All production schema changes require BDGF authorization
- [ ] Emergency escalation procedure (break-glass)
- [ ] Audit requirements
- [ ] Compliance verification

**Enforcement:**
- [ ] Database: Remove direct developer access to production
- [ ] CI/CD: Require gate token for production deployment
- [ ] Manual: Require architect approval for bypass

**Deliverable:** `docs/BDGF_MANDATORY_POLICY.md`

#### 7.2 Approval Workflow Integration

**Current:** Manual approval process

**Target:** Integrated approval workflow

**Options:**
- GitHub PR approval + automated token issuance
- Slack approval bot
- Custom approval dashboard
- Integration with existing workflow tool

**Implementation:**
- [ ] Design approval workflow
- [ ] Build integration (or manual for MVP)
- [ ] Test approval → token issuance → execution flow
- [ ] Document approval process

#### 7.3 Emergency Procedures

**Scenario:** Production down, schema change required immediately

**Emergency Escalation:**
1. On-call architect notified
2. Architect issues emergency approval
3. Gate token issued with `approval_type = 'emergency'`
4. Migration executed
5. Post-incident review REQUIRED within 24h

**Implementation:**
- [ ] Define emergency criteria
- [ ] Document escalation procedure
- [ ] Set up emergency contact list
- [ ] Test emergency flow (drill)

**Deliverable:** `docs/BDGF_EMERGENCY_PROCEDURES.md`

---

## DELIVERABLES

### Documentation
- [ ] `docs/BDGF_SECRET_MANAGEMENT.md`
- [ ] `docs/BDGF_CREDENTIAL_ROTATION.md`
- [ ] `docs/BDGF_ALERT_RUNBOOK.md`
- [ ] `docs/BDGF_DISASTER_RECOVERY.md`
- [ ] `docs/BDGF_MANDATORY_POLICY.md`
- [ ] `docs/BDGF_EMERGENCY_PROCEDURES.md`

### Code
- [ ] `scripts/bdgf/get-signing-key.mjs` (secrets manager integration)
- [ ] `scripts/bdgf/rotate-credentials.mjs` (automated rotation)
- [ ] `scripts/bdgf/send-alert.mjs` (alert delivery)
- [ ] `.github/workflows/bdgf-ci.yml` (CI/CD pipeline)

### Infrastructure
- [ ] Grafana dashboards (JSON exports)
- [ ] Alert rules (configuration files)
- [ ] Backup automation (scripts + cron)

### UI
- [ ] Audit dashboard (Retool/Forest Admin/custom)
- [ ] Incident management interface

---

## TIMELINE

**Total Duration:** 8 weeks (September-October 2026)

**Parallel Streams:**
```
STREAM A (BDGF Productionization)     STREAM B (Platform Core)
├─ Week 1-2: Secrets                  ├─ Core Inventory
├─ Week 2-3: Credentials              ├─ Core vs Kernel Analysis
├─ Week 3-4: Monitoring               ├─ Dependency Mapping
├─ Week 4-5: Audit Dashboard          ├─ Constitution Draft
├─ Week 5-6: Backup/Recovery          ├─ Architecture Review
├─ Week 6-7: CI/CD Automation         ├─ Freeze Candidates
└─ Week 7-8: Deployment Gate          └─ Constitution Finalization
```

**Checkpoint 1 (Early November 2026):**
- Stream A: BDGF Production-Grade ✅
- Stream B: Platform Core Constitution Complete ✅

**Critical Path:** Secrets Management → Monitoring → Deployment Gate

---

## SUCCESS CRITERIA

**Productionization COMPLETE when:**

✅ All secrets in secrets manager (not in .env)  
✅ Automated credential rotation working  
✅ Real-time alerts firing correctly  
✅ Grafana dashboards live  
✅ Audit dashboard accessible  
✅ Backup/recovery tested  
✅ CI/CD pipeline enforcing regression tests  
✅ BDGF mandatory for all production deployments  
✅ Zero manual monitoring required  
✅ Incident response < 5min  

**Result:** BDGF is no longer "new" — it's THE deployment mechanism.

---

## NEXT STEPS

1. **Approve this plan**
2. **Assign workstream owners**
3. **Set up project tracking** (Jira/Linear/GitHub Projects)
4. **Start Week 1: Secrets Management**

---

**Prepared By:** Bella AI + Human Architect  
**Date:** 2026-08-20  
**Status:** Planning  
**Next:** Execute productionization

---
