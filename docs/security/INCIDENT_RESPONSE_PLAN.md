# Bella ERP API Gateway - Incident Response Plan

**Version**: 1.0  
**Date**: 2026-06-17  
**Status**: Active  
**Review Cycle**: Quarterly  
**Scope**: API Gateway (all phases)

---

## Executive Summary

This Incident Response Plan (IRP) defines procedures for detecting, responding to, and recovering from security incidents affecting Bella ERP's API Gateway. The plan covers incident classification, response team roles, communication protocols, and post-incident activities.

### Key Objectives
1. **Minimize Impact**: Contain incidents within 15 minutes (CRITICAL), 1 hour (HIGH)
2. **Preserve Evidence**: Maintain audit trails for forensics and legal requirements
3. **Maintain Transparency**: Notify affected parties per GDPR (within 72 hours for breaches)
4. **Continuous Improvement**: Learn from incidents to prevent recurrence

### Response Metrics (SLAs)

| Severity | Detection Time | Response Time | Containment Time | Recovery Time |
|----------|---------------|---------------|------------------|---------------|
| **CRITICAL** | < 5 min | < 15 min | < 30 min | < 4 hours |
| **HIGH** | < 15 min | < 1 hour | < 2 hours | < 24 hours |
| **MEDIUM** | < 1 hour | < 4 hours | < 8 hours | < 48 hours |
| **LOW** | < 4 hours | < 24 hours | < 48 hours | < 1 week |

---

## Table of Contents

1. [Incident Classification](#1-incident-classification)
2. [Response Team](#2-response-team)
3. [Response Procedures](#3-response-procedures)
4. [Communication Plan](#4-communication-plan)
5. [Post-Incident Activities](#5-post-incident-activities)
6. [Training & Exercises](#6-training--exercises)
7. [Appendix](#7-appendix)

---

## 1. Incident Classification

### 1.1 Severity Levels

#### CRITICAL
**Definition**: Active data breach, tenant isolation failure, system-wide outage

**Examples**:
- Cross-tenant data leak confirmed
- API keys compromised and actively exploited
- Database breach (unauthorized access to production data)
- Complete API Gateway outage (>99% of requests failing)

**Impact**:
- Customer data at risk
- Regulatory reporting required (GDPR Article 33)
- Legal liability
- Brand damage

**Response SLA**: 15 minutes

---

#### HIGH
**Definition**: Significant security vulnerability, localized outage, attempted breach

**Examples**:
- API key leaked in public repository
- Failed tenant injection attempts (repeated)
- Privilege escalation attempt
- Partial service degradation (10-50% requests failing)

**Impact**:
- Limited customer impact
- Potential data exposure
- Service degradation

**Response SLA**: 1 hour

---

#### MEDIUM
**Definition**: Policy violations, low-risk vulnerabilities, anomalies

**Examples**:
- Unusually high 403 rate for single partner
- Invalid API key brute force attempts
- Deprecated API endpoint usage
- Configuration drift

**Impact**:
- No immediate customer impact
- Potential future risk

**Response SLA**: 4 hours

---

#### LOW
**Definition**: Routine security events, minor issues

**Examples**:
- Occasional invalid API key attempts
- Partner request for API key rotation
- Documentation gaps
- Non-security bugs

**Impact**:
- Minimal risk

**Response SLA**: 24 hours


### 1.2 Incident Types

| Type | Description | Severity Range | Examples |
|------|-------------|----------------|----------|
| **Data Breach** | Unauthorized access to customer data | HIGH - CRITICAL | Cross-tenant leak, database dump |
| **Authentication Bypass** | Circumventing API key validation | HIGH - CRITICAL | Stolen keys, auth logic bug |
| **Denial of Service** | System unavailable or degraded | MEDIUM - CRITICAL | DDoS, resource exhaustion |
| **Injection Attack** | Malicious input execution | HIGH - CRITICAL | SQL injection, tenant injection |

---

## 2. Response Team

### 2.1 Roles & Responsibilities

#### Incident Commander (IC)
**Who**: On-call engineer or Security Lead  
**Responsibilities**:
- Coordinate response across teams
- Make containment decisions
- Authorize emergency changes
- Communicate with stakeholders
- Declare incident resolved

**Authority**: Can override normal approval processes during active incident

---

#### Technical Lead (TL)
**Who**: Senior Backend Engineer or DevOps Lead  
**Responsibilities**:
- Technical investigation (root cause analysis)
- Execute containment actions (block IPs, revoke keys)
- Deploy hotfixes
- Restore services

**Tools**: Database access, production deployment, monitoring dashboards

---

#### Communications Lead (CL)
**Who**: Product Manager or Customer Success Lead  
**Responsibilities**:
- Draft customer notifications
- Update status page
- Coordinate with Legal/PR
- Handle customer inquiries

**Channels**: Email, Slack, Status page (status.bella.vn)

---

#### Security Engineer (SE)
**Who**: Security Team Member  
**Responsibilities**:
- Forensic analysis
- Evidence preservation
- Security recommendations
- Threat intelligence

**Tools**: SIEM, audit logs, intrusion detection systems

---

#### Database Administrator (DBA)
**Who**: DevOps Engineer with DB access  
**Responsibilities**:
- Database forensics
- Query optimization (if DOS)
- Backup restoration
- RLS policy verification

**Access**: Production database (service role)

---

#### DevOps Engineer (DevOps)
**Who**: Infrastructure Team  
**Responsibilities**:
- Infrastructure changes (WAF rules, rate limits)
- Monitoring and alerting
- CDN configuration
- Scaling resources

**Tools**: Vercel, Supabase dashboard, CloudWatch

---

#### Legal Counsel (Legal)
**Who**: General Counsel or external attorney  
**Responsibilities**:
- GDPR compliance guidance
- Regulatory notification
- Customer communication review
- Liability assessment

**Involvement**: CRITICAL/HIGH incidents only


### 2.2 Escalation Path

```
CRITICAL Incident:
  1. On-Call Engineer (immediate)
  2. Security Lead (within 5 min)
  3. CTO (within 15 min)
  4. CEO (within 30 min, if customer-facing)
  5. Legal Counsel (within 1 hour, if breach)

HIGH Incident:
  1. On-Call Engineer (within 15 min)
  2. Security Lead (within 30 min)
  3. CTO (within 1 hour)

MEDIUM/LOW Incident:
  1. On-Call Engineer
  2. Security Lead (as needed)
```

### 2.3 Contact Information

| Role | Primary Contact | Backup | Method |
|------|----------------|--------|--------|
| **On-Call Engineer** | PagerDuty rotation | Slack #engineering | PagerDuty + SMS |
| **Security Lead** | security@bella.vn | CTO | Email + Slack |
| **CTO** | cto@bella.vn | CEO | Email + Phone |
| **Legal** | legal@bella.vn | External counsel | Email |

**Emergency Slack Channel**: `#security-incidents` (alerts all above roles)

---

## 3. Response Procedures

### 3.1 Phase 1: Detection (0-5 minutes)

#### Automated Detection
- **Monitoring alerts** (PagerDuty)
  - Tenant injection attempts
  - High 403 rate (>10/min per partner)
  - API Gateway errors (>5% error rate)
  - Database connection failures
  
- **SIEM alerts** (security events)
  - Invalid API key attempts (>5/min)
  - Cross-tenant access attempts
  - Privilege escalation attempts

#### Manual Detection
- **Partner reports** (support ticket, email)
- **Customer complaints** (data access issues)
- **Security researcher disclosure** (bug bounty, responsible disclosure)

#### Detection Actions
```
1. Acknowledge alert (PagerDuty or Slack)
2. Verify it's a real incident (not false positive)
3. Classify severity (CRITICAL/HIGH/MEDIUM/LOW)
4. Notify Incident Commander
5. Create incident ticket (Jira: SECURITY-XXX)
```

---

### 3.2 Phase 2: Triage (5-15 minutes)

#### Incident Commander Actions
```
1. Assemble response team (page relevant members)
2. Create Slack war room (#incident-<timestamp>)
3. Set incident severity (can upgrade later)
4. Assign Technical Lead
5. Brief team on known information
```

#### Initial Assessment Questions
- What happened? (symptoms, error messages)
- Which partners/tenants affected?
- When did it start? (timeline)
- Is it ongoing? (active attack or past breach)
- What data is at risk?

#### Triage Decision Tree
```
Is data breached? → YES → CRITICAL
  ↓ NO
Is tenant isolation compromised? → YES → CRITICAL
  ↓ NO
Is service unavailable? → YES → HIGH
  ↓ NO
Is attack active? → YES → HIGH
  ↓ NO
Anomaly detected? → YES → MEDIUM
  ↓ NO
Policy violation? → YES → LOW
```


---

### 3.3 Phase 3: Containment (15-30 minutes for CRITICAL)

#### Goal
Stop the incident from spreading, minimize damage

#### Containment Actions by Incident Type

**Data Breach / Tenant Isolation Failure**:
```sql
-- 1. Disable affected partner API key
UPDATE api_partners 
SET is_active = false 
WHERE id = '<partner_id>';

-- 2. Block IP at WAF (Vercel dashboard)
-- Add IP to block list

-- 3. Take database snapshot for forensics
pg_dump bella_production > incident_snapshot_2026-06-17.sql

-- 4. Verify RLS policies are enabled
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE tablename IN ('orders', 'customers', 'payments');
```

**API Key Compromise**:
```typescript
// 1. Immediately invalidate compromised key
await partnerService.updatePartner(partnerId, { 
  is_active: false 
});

// 2. Generate new key
const newKey = await partnerService.regenerateApiKey(partnerId);

// 3. Email partner with new key
await sendEmail({
  to: partner.contact_email,
  subject: 'URGENT: API Key Rotated Due to Security Incident',
  body: `New key: ${newKey.substring(0, 15)}...`
});

// 4. Review audit logs for unauthorized access
const logs = await supabase
  .from('api_request_logs')
  .select('*')
  .eq('partner_id', partnerId)
  .gte('created_at', incidentStartTime);
```

**Denial of Service**:
```typescript
// 1. Identify attacking IP/partner
const topRequesters = await getTopRequestVolume();

// 2. Apply aggressive rate limit
await redis.set(`rate_limit:${partnerId}`, 10);  // Reduce to 10 req/min

// 3. Scale infrastructure if needed
// (Vercel auto-scales, but monitor costs)

// 4. Block IPs at edge if distributed attack
// Vercel dashboard → WAF → Add block rule
```

**Injection Attack**:
```typescript
// 1. Already blocked by middleware (no containment needed)

// 2. Verify middleware is active
await testMiddleware();

// 3. Review similar attempts
const injectionAttempts = await supabase
  .from('api_request_logs')
  .select('*')
  .eq('error_code', 'TENANT_INJECTION_ATTEMPT')
  .gte('created_at', last_24_hours);
```

#### Containment Checklist
- [ ] Threat contained (attacker blocked)
- [ ] No further data loss
- [ ] System stability restored
- [ ] Evidence preserved (logs, snapshots)
- [ ] Incident Commander notified of containment


---

### 3.4 Phase 4: Investigation (30 minutes - 2 hours)

#### Goal
Understand root cause, determine scope of impact

#### Investigation Steps

**1. Timeline Reconstruction**
```
When did it start?
  → Query audit logs for first anomaly
  
When was it detected?
  → Check monitoring alert timestamp
  
When was it contained?
  → Note containment action timestamp
  
Total exposure window = Detection - Start
```

**2. Attack Vector Analysis**
```
How did attacker gain access?
  - Stolen API key? → Check GitHub, logs, partner reports
  - Middleware bypass? → Review code changes
  - RLS policy bug? → Test RLS policies
  - Social engineering? → Interview admins
```

**3. Scope Assessment**
```sql
-- Which tenants were affected?
SELECT DISTINCT tenant_id 
FROM api_request_logs 
WHERE partner_id = '<attacker_partner_id>' 
  AND created_at BETWEEN '<start>' AND '<end>';

-- What data was accessed?
SELECT method, path, status_code, COUNT(*) as count
FROM api_request_logs
WHERE partner_id = '<attacker_partner_id>'
  AND created_at BETWEEN '<start>' AND '<end>'
GROUP BY method, path, status_code;

-- Did attacker modify data? (look for POST/PATCH/DELETE)
SELECT * FROM api_request_logs
WHERE partner_id = '<attacker_partner_id>'
  AND method IN ('POST', 'PATCH', 'DELETE')
  AND status_code IN (200, 201);
```

**4. Evidence Collection**
```bash
# Collect audit logs
pg_dump -t api_request_logs > incident_logs.sql

# Collect system logs
heroku logs --app bella-api --num 10000 > system_logs.txt

# Collect monitoring data
# Export Vercel analytics for incident window

# Collect affected database records
# Export affected orders/customers/payments
```

**5. Root Cause Determination**
```
Possible root causes:
  - Code bug (middleware bypass)
  - Configuration error (RLS disabled)
  - Partner mistake (leaked key)
  - Social engineering (fake partner account)
  - Zero-day vulnerability

Action: Document root cause in incident ticket
```

#### Investigation Checklist
- [ ] Timeline documented
- [ ] Attack vector identified
- [ ] Scope quantified (X tenants, Y records)
- [ ] Evidence collected and preserved
- [ ] Root cause determined


---

### 3.5 Phase 5: Eradication (2-4 hours)

#### Goal
Remove vulnerability, prevent recurrence

#### Eradication Actions

**Code Fixes**
```typescript
// Example: Fix middleware bypass bug
// src/lib/middleware/api-key.middleware.ts

export async function withAPIKey(req: NextRequest) {
  const apiKey = req.headers.get('x-api-key');
  
  // Bug: Didn't validate API key format first
  // Fix: Add format validation
  if (!apiKey || !apiKey.match(/^pk_(live|test)_[a-zA-Z0-9]{32}$/)) {
    throw new APIError('INVALID_API_KEY_FORMAT');
  }
  
  // ... rest of validation
}
```

**Configuration Changes**
```sql
-- Example: Re-enable RLS on table
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Verify all tables have RLS
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('orders', 'customers', 'payments', 'employees');
```

**Deployment**
```bash
# 1. Test fix locally
npm run test:security

# 2. Deploy to staging
vercel --prod=false

# 3. Verify fix in staging
curl https://staging.bella.vn/api/v1/orders \
  -H "X-API-Key: test_key"

# 4. Deploy to production
vercel --prod

# 5. Verify fix in production
npm run test:smoke
```

**Partner Actions**
```
If partner key was compromised:
  1. Partner rotates key (done in Containment)
  2. Partner audits their systems (where was key leaked?)
  3. Partner updates key in their integration
  4. Partner confirms new key works
```

#### Eradication Checklist
- [ ] Vulnerability patched
- [ ] Fix deployed to production
- [ ] Fix verified (automated tests passing)
- [ ] No regression (smoke tests passing)
- [ ] Partner remediation complete (if applicable)

---

### 3.6 Phase 6: Recovery (4-24 hours)

#### Goal
Restore normal operations, verify system integrity

#### Recovery Actions

**1. Re-enable Partner (if applicable)**
```sql
-- After partner confirms new key works and systems secure
UPDATE api_partners 
SET is_active = true 
WHERE id = '<partner_id>';
```

**2. Verify System Health**
```bash
# Run full test suite
npm run test

# Check monitoring dashboards
# - Error rate < 1%
# - Latency < 500ms p95
# - No security alerts

# Verify RLS policies
npm run test:rls
```

**3. Monitor for 24 Hours**
```
Watch for:
  - Unusual request patterns
  - High error rates
  - Similar attack attempts
  - Customer reports
```

**4. Update Documentation**
```
Update:
  - Incident response plan (lessons learned)
  - Runbooks (new procedures)
  - Security documentation
  - Partner onboarding guide (if needed)
```

#### Recovery Checklist
- [ ] System fully operational
- [ ] All tests passing
- [ ] Monitoring normal
- [ ] Partner service restored
- [ ] 24-hour observation complete


---

## 4. Communication Plan

### 4.1 Internal Communication

#### During Active Incident

**Slack Channel**: `#incident-<timestamp>`
- Real-time updates every **15 minutes** (CRITICAL), **30 minutes** (HIGH)
- Status format:
  ```
  [HH:MM] UPDATE: <what changed>
  Current status: <investigating | contained | resolved>
  Next action: <what we're doing next>
  ETA: <when next update>
  ```

**Email Updates**:
- Leadership team (CTO, CEO): Every **30 minutes** (CRITICAL), **2 hours** (HIGH)
- All engineering: Every **2 hours** or at major milestones

#### Example Update
```
[14:30] CRITICAL INCIDENT UPDATE
Incident: SECURITY-123 - Tenant Isolation Breach
Status: CONTAINED

What happened:
- Partner A accessed Partner B's orders via API
- Attack vector: Middleware bypass bug
- Exposure: 2026-06-17 12:00-14:15 (2h 15m)

Actions taken:
- Disabled Partner A API key (14:15)
- Deployed middleware fix (14:25)
- Verified fix with automated tests (14:28)

Impact:
- 3 tenants affected
- 47 orders accessed (read-only, no modifications)
- No PII exposed (orders contain only IDs)

Next steps:
- Complete forensic analysis (ETA: 16:00)
- Notify affected tenants (ETA: 17:00)
- Post-mortem scheduled for 2026-06-18 10:00

Next update: 15:00
```

### 4.2 External Communication

#### Customer Notification

**Timeline**:
- **CRITICAL (data breach)**: Within **24 hours** of confirmation
- **HIGH (attempted breach)**: Within **48 hours** if customer data at risk
- **MEDIUM/LOW**: No notification unless customer impacted

**Approval Process**:
1. Communications Lead drafts message
2. Legal reviews (GDPR compliance)
3. CTO approves
4. Send via email + status page

**Template**:
```
Subject: Security Incident Notification - Bella API Gateway

Dear [Customer Name],

We are writing to inform you of a security incident that may have affected 
your data in Bella ERP's API Gateway.

What happened:
[Brief description without technical jargon]

When:
Start: [Date/Time]
Detected: [Date/Time]
Contained: [Date/Time]

Impact to your account:
[Specific: "47 orders were accessed" not "some data may have been accessed"]

What we've done:
1. [Containment action]
2. [Fix deployed]
3. [Verification completed]

What you should do:
[Specific actions, if any: "Review orders X, Y, Z for accuracy"]

Our commitment:
We take security seriously. We have [new safeguard] to prevent this in the future.

Questions?
Contact: security@bella.vn
Reference: SECURITY-123

Sincerely,
Bella Security Team
```


#### Regulatory Notification (GDPR)

**Requirement**: Notify authorities within **72 hours** if personal data breach

**Trigger**: Any of:
- Customer PII accessed without authorization
- Customer data modified or deleted
- Customer data exfiltrated

**Process**:
1. Legal determines if notification required
2. Draft notification with:
   - Nature of breach
   - Categories of data affected
   - Number of data subjects
   - Likely consequences
   - Measures taken
3. Submit to Data Protection Authority
4. Keep copy for records (7 years)

**Contact**: Vietnam Data Protection Authority (or relevant EU authority if applicable)

#### Public Disclosure

**When**:
- If incident is public knowledge (media, social media)
- If large-scale breach (>1000 customers)
- If requested by authorities

**Where**:
- Company blog (blog.bella.vn)
- Status page (status.bella.vn)
- Social media (Twitter, LinkedIn)

**Tone**:
- Transparent (what happened)
- Accountable (we made a mistake)
- Reassuring (we fixed it)
- Forward-looking (prevention)

### 4.3 Status Page Updates

**URL**: https://status.bella.vn

**During Incident**:
```
[2026-06-17 14:30 UTC+7] CRITICAL - API Gateway Security Incident
We are investigating a security incident affecting the API Gateway.
API requests may be temporarily blocked while we investigate.
Updates every 30 minutes.

[2026-06-17 15:00 UTC+7] UPDATE - Incident Contained
The security vulnerability has been patched and service is being restored.
We are monitoring for any further issues.

[2026-06-17 16:00 UTC+7] RESOLVED - Service Fully Restored
All systems are operational. We will publish a detailed post-mortem within 48 hours.
```

**After Resolution**:
```
[2026-06-19 10:00 UTC+7] Post-Mortem: API Gateway Security Incident (2026-06-17)

Summary: [Brief description]
Timeline: [Key events]
Root Cause: [Technical explanation]
Impact: [Quantified impact]
Prevention: [What we're doing to prevent recurrence]

Full report: [Link to blog post]
```

---

## 5. Post-Incident Activities

### 5.1 Post-Mortem Meeting

**When**: Within **48 hours** of resolution

**Attendees**:
- Incident Commander
- Response team members
- CTO
- Product Manager
- Anyone who wants to learn (open invitation)

**Agenda** (1 hour):
1. **Timeline Review** (10 min): What happened when
2. **Root Cause Analysis** (20 min): Why it happened
3. **What Went Well** (10 min): Celebrate successes
4. **What Went Wrong** (10 min): Identify gaps
5. **Action Items** (10 min): Concrete next steps

**Rules**:
- ✅ Blameless (focus on systems, not people)
- ✅ Action-oriented (every problem → action item)
- ✅ Documented (notes published to team)


### 5.2 Post-Mortem Report Template

```markdown
# Incident Post-Mortem: <Title>

**Incident ID**: SECURITY-XXX  
**Date**: 2026-06-17  
**Severity**: CRITICAL  
**Duration**: 2h 15m (12:00-14:15)  
**Impact**: 3 tenants, 47 orders accessed  

## Summary
[2-3 sentence summary for executives]

## Timeline (all times UTC+7)
| Time | Event |
|------|-------|
| 12:00 | Incident begins (undetected) |
| 14:10 | Monitoring alert: High 404 rate |
| 14:12 | Engineer investigates logs |
| 14:15 | Incident confirmed, partner disabled |
| 14:20 | Fix identified (middleware bug) |
| 14:25 | Fix deployed to production |
| 14:28 | Fix verified with tests |
| 14:30 | Incident contained |
| 16:00 | Forensic analysis complete |
| 17:00 | Customer notifications sent |
| 18:00 | Incident resolved |

## Root Cause
[Technical explanation with code examples]

## Impact
- **Customers affected**: 3 tenants (Bella Spa HCM, Bella Spa Hanoi, Bella Spa Da Nang)
- **Data accessed**: 47 orders (read-only, no modifications)
- **PII exposed**: None (orders contain only UUIDs)
- **Financial loss**: $0 (no refunds/credits)
- **Reputation**: Low (proactive disclosure)

## Detection
- **Method**: Automated monitoring (high 404 rate)
- **Time to detect**: 2h 10m (not acceptable for CRITICAL)
- **Why delayed**: Alert threshold too high (should be 10 404s/min, was 50)

## Response
### What Went Well
- ✅ Containment within 15 minutes of detection (met SLA)
- ✅ Fix deployed in 10 minutes (excellent)
- ✅ Zero false moves (every action was correct)
- ✅ Clear communication (Slack updates every 15 min)

### What Went Wrong
- ❌ Detection took too long (2h 10m)
- ❌ No security tests for this scenario
- ❌ Post-deployment verification missed the bug

## Prevention
### Immediate Actions (completed)
- [x] Deploy middleware fix
- [x] Add 15 new security tests for similar scenarios
- [x] Lower alert threshold (50 → 10 404s/min)

### Short-term Actions (next 2 weeks)
- [ ] Add pre-deployment security checklist
- [ ] Require 2 reviewers for middleware changes
- [ ] Add canary deployment (5% traffic → 100%)

### Long-term Actions (next quarter)
- [ ] Implement request signing (HMAC) for integrity
- [ ] Add anomaly detection (ML-based)
- [ ] Quarterly security exercises

## Lessons Learned
1. **Detection is as important as prevention**: We had good prevention, but detection was slow
2. **Automated tests are not enough**: Need manual security review for critical code
3. **Alert fatigue is real**: High thresholds make us miss incidents

## Action Items
| ID | Owner | Description | Due Date | Status |
|----|-------|-------------|----------|--------|
| A1 | @engineer | Lower 404 alert threshold | 2026-06-18 | ✅ Done |
| A2 | @security | Add 15 new security tests | 2026-06-20 | 🟡 In Progress |
| A3 | @devops | Implement canary deployments | 2026-07-01 | ⬜ Planned |
| A4 | @cto | Quarterly security exercises | 2026-09-01 | ⬜ Planned |

## Appendix
- Incident ticket: SECURITY-123
- Code fix: PR #456
- Customer communications: [Link]
- Monitoring dashboards: [Link]
```


### 5.3 Metrics & Reporting

#### Incident Metrics (tracked monthly)

| Metric | Definition | Target | Current |
|--------|------------|--------|---------|
| **MTTD** | Mean Time To Detect | < 15 min | TBD |
| **MTTR** | Mean Time To Respond | < 30 min | TBD |
| **MTTC** | Mean Time To Contain | < 1 hour | TBD |
| **MTTR** | Mean Time To Resolve | < 4 hours (CRITICAL) | TBD |
| **Incident Count** | Total incidents per month | Trend down | TBD |
| **False Positive Rate** | Alerts that weren't real incidents | < 20% | TBD |

#### Monthly Security Report

**Recipients**: CTO, Security Team, Engineering Leads

**Contents**:
- Total incidents by severity
- Response time metrics
- Top attack vectors
- Partner security issues
- Action items from post-mortems
- Security testing coverage

**Example**:
```
Bella ERP Security Report - June 2026

Incidents:
  CRITICAL: 1 (tenant isolation breach - resolved)
  HIGH: 2 (API key leaks - keys rotated)
  MEDIUM: 5 (anomalous traffic - investigated)
  LOW: 12 (invalid API key attempts - routine)

Metrics:
  MTTD: 22 minutes (target: 15 min) ⚠️
  MTTR: 18 minutes (target: 30 min) ✅
  MTTC: 45 minutes (target: 60 min) ✅

Top Threats:
  1. Tenant injection attempts: 47 (all blocked)
  2. Invalid API keys: 234 (rate limited)
  3. High 404 rate: 12 partners (investigated, normal)

Actions Completed:
  - Lowered 404 alert threshold (A1)
  - Added 15 new security tests (A2)
  - Updated incident response plan (A5)

Actions In Progress:
  - Canary deployments (A3 - 70% complete)
  - Quarterly security exercises (A4 - planning)
```

---

## 6. Training & Exercises

### 6.1 Training Requirements

#### New Engineers (Onboarding)
- **Week 1**: Read incident response plan
- **Week 2**: Shadow on-call engineer
- **Week 3**: Participate in tabletop exercise
- **Week 4**: Join on-call rotation

#### All Engineers (Annual)
- **Security awareness training**: 2 hours/year
- **Incident response refresher**: 1 hour/year
- **Table-top exercise**: 2/year (see below)

### 6.2 Tabletop Exercises

**Frequency**: Quarterly

**Duration**: 2 hours

**Attendees**: Response team + volunteers

**Format**:
1. Facilitator presents scenario (30 min)
2. Team discusses response (60 min)
3. Debrief and lessons learned (30 min)

#### Example Scenario 1: Tenant Isolation Breach
```
Scenario:
It's Monday 2:00 PM. A customer (Bella Spa Hanoi) emails support:
"We just saw orders from another business in our dashboard. 
This is a serious privacy issue!"

Your task:
1. How do you verify this is real?
2. What containment actions do you take?
3. Who do you notify and when?
4. How do you determine scope of breach?
5. What communication do you send to customers?

Twist (revealed at 30 min):
The "other business" orders are actually from a franchise location
that was misconfigured with wrong tenant_id. It's NOT a security breach,
but a data migration error.

Questions:
- How does this change your response?
- Should you still notify customers?
- What could have prevented this confusion?
```


#### Example Scenario 2: API Key Leak
```
Scenario:
It's Friday 5:00 PM. GitHub sends automated alert:
"API key detected in public repository: partner-integration-demo"
The repository belongs to one of your partners.

Your task:
1. What is the severity? (CRITICAL/HIGH/MEDIUM/LOW)
2. What immediate actions do you take?
3. The partner is on vacation and unreachable. Now what?
4. How do you verify if the key was used maliciously?
5. When can you re-enable the partner?

Discussion points:
- Should we automatically rotate keys when detected in GitHub?
- Should we require partner key rotation every 90 days?
- How can we help partners keep keys secure?
```

#### Example Scenario 3: DDoS Attack
```
Scenario:
It's Wednesday 10:00 AM. PagerDuty alerts:
"API Gateway error rate: 45% (threshold: 5%)"
"API Gateway latency: 8000ms p95 (threshold: 500ms)"

You check logs and see:
- 50,000 requests/minute from 1,000 different IPs
- All requests to /api/v1/orders endpoint
- Valid API keys from 3 different partners
- Requests are simple (no complex queries)

Your task:
1. Is this malicious or legitimate traffic spike?
2. What containment actions do you take?
3. How do you determine which partners are affected?
4. When do you scale vs. rate limit vs. block?
5. How do you communicate with partners?

Twist (revealed at 45 min):
One of the partners is running a "flash sale" and legitimately
has 50x traffic. Their integration has a bug causing retries.

Questions:
- How could we have prevented this?
- Should we require partners to notify us before major events?
- What rate limit tier should this partner have?
```

### 6.3 Continuous Improvement

#### After Each Exercise
- Document lessons learned
- Update runbooks with new procedures
- Add test scenarios to automated suite
- Update this IRP if gaps found

#### After Each Real Incident
- Mandatory post-mortem within 48 hours
- Share learnings with entire team
- Update relevant documentation
- Add regression tests
- Consider if new monitoring needed

#### Quarterly Review
- Review all incidents from past quarter
- Identify trends (common attack vectors)
- Assess if SLAs are realistic
- Update threat model
- Adjust alert thresholds based on data

---

## 7. Appendix

### 7.1 Quick Reference - Incident Severity

```
CRITICAL = Data breach OR Tenant isolation failure OR Total outage
  → Response: 15 minutes
  → Notify: CTO + CEO + Legal
  → Customer: Notify within 24 hours

HIGH = API key compromise OR Partial outage OR Active attack
  → Response: 1 hour
  → Notify: CTO
  → Customer: Notify if data at risk

MEDIUM = Failed attacks OR Anomalies OR Policy violations
  → Response: 4 hours
  → Notify: Security Lead
  → Customer: No notification

LOW = Routine events OR Minor bugs
  → Response: 24 hours
  → Notify: On-call engineer
  → Customer: No notification
```

### 7.2 Quick Reference - Containment Actions

```
Tenant Isolation Breach:
  1. Disable partner API key
  2. Block IP at WAF
  3. Take DB snapshot
  4. Verify RLS enabled

API Key Compromise:
  1. Invalidate key
  2. Generate new key
  3. Email partner
  4. Review audit logs

Denial of Service:
  1. Identify attacker
  2. Apply rate limit
  3. Scale if needed
  4. Block IPs at edge

Injection Attack:
  1. Already blocked by middleware
  2. Verify middleware active
  3. Review similar attempts
  4. No further action needed
```


### 7.3 Communication Templates

#### Internal Alert (Slack)
```
🚨 CRITICAL INCIDENT 🚨
Incident: SECURITY-123
Type: Tenant Isolation Breach
Status: INVESTIGATING
Started: 2026-06-17 14:15

Summary: Partner A accessed Partner B's orders

Impact:
- 3 tenants affected
- 47 orders accessed
- No modifications detected

Incident Commander: @jane
War room: #incident-20260617-1415

Action: Join war room if you can help
Next update: 14:30 (15 minutes)
```

#### Customer Email (Data Breach)
```
Subject: Security Notification - Bella ERP API Gateway

Dear [Customer],

We are writing to inform you of a security incident that affected your 
Bella ERP account.

WHAT HAPPENED
On June 17, 2026 between 12:00-14:15 (2h 15m), a partner integration 
accessed data from your account due to a software bug in our API Gateway.

WHAT DATA WAS AFFECTED
- 47 orders (order ID, date, status, total amount)
- No customer names, phone numbers, or addresses were accessed
- No payment information was accessed

WHAT WE'VE DONE
- We detected and fixed the issue within 15 minutes
- We disabled the partner's access immediately
- We verified no data was modified or deleted
- We added additional security safeguards

WHAT YOU SHOULD DO
- No action required from you
- Your data is secure and services are operating normally
- If you notice any discrepancies, please contact us

We sincerely apologize for this incident. Security is our top priority, 
and we are taking additional measures to prevent this from happening again.

Questions? Reply to this email or contact security@bella.vn
Reference: SECURITY-123

Bella Security Team
```

#### Partner Email (API Key Compromised)
```
Subject: URGENT - Your Bella API Key Has Been Rotated

Dear Partner,

We detected that your Bella API key may have been exposed in a public 
GitHub repository. As a precaution, we have immediately rotated your 
key to protect your account.

OLD KEY (INVALIDATED):
pk_live_abc***************************

NEW KEY:
pk_live_xyz123...456 (see secure portal for full key)

ACTION REQUIRED:
1. Log in to https://admin.bella.vn/partners/api-keys
2. Copy your new API key
3. Update your integration
4. Test your integration
5. Confirm working by replying to this email

Your old key will stop working in 1 hour. Please update immediately 
to avoid service interruption.

SECURITY RECOMMENDATIONS:
- Never commit API keys to git repositories
- Use environment variables (.env files)
- Add .env to .gitignore
- Consider using a secrets manager (AWS Secrets Manager, HashiCorp Vault)

Questions? Contact support@bella.vn
Reference: SECURITY-125

Bella API Team
```

### 7.4 Tool Access

| Tool | Purpose | Access |
|------|---------|--------|
| **PagerDuty** | Alerts & on-call | All engineers |
| **Slack #security-incidents** | Coordination | All staff |
| **Jira (SECURITY-* tickets)** | Tracking | Security team + leads |
| **Supabase Dashboard** | Database access | DevOps + on-call |
| **Vercel Dashboard** | Deployment + WAF | DevOps + on-call |
| **CloudWatch** | Logs & monitoring | DevOps + on-call |
| **GitHub** | Code repository | All engineers |
| **Status Page Admin** | Public updates | Communications lead |

### 7.5 Runbook Links

- **API Key Rotation**: [Link to runbook]
- **RLS Policy Verification**: [Link to runbook]
- **Database Snapshot**: [Link to runbook]
- **WAF Configuration**: [Link to runbook]
- **Emergency Deployment**: [Link to runbook]
- **Customer Notification**: [Link to template]

---

## Document Control

**Version**: 1.0  
**Effective Date**: 2026-06-17  
**Next Review**: 2026-09-17 (Quarterly)  
**Owner**: Security Team  
**Approvers**: CTO, Legal Counsel  

**Revision History**:

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-06-17 | Security Team | Initial version - Phase 1 launch |

**Distribution**:
- All engineering team members
- On-call engineers
- CTO, CEO
- Legal counsel
- Customer success team

**Classification**: Internal - Security Team

**Acknowledgment**:
All engineers must acknowledge reading this plan during onboarding.

---

## Emergency Contact Card

**Print and keep at desk or save to phone**

```
┌─────────────────────────────────────────────────┐
│        BELLA ERP SECURITY INCIDENT              │
│           EMERGENCY CONTACTS                    │
├─────────────────────────────────────────────────┤
│ ON-CALL ENGINEER                                │
│   PagerDuty: +84-xxx-xxx-xxxx                  │
│   Slack: #security-incidents                    │
│                                                 │
│ SECURITY LEAD                                   │
│   Email: security@bella.vn                      │
│   Phone: +84-xxx-xxx-xxxx                      │
│                                                 │
│ CTO                                             │
│   Email: cto@bella.vn                          │
│   Phone: +84-xxx-xxx-xxxx                      │
│                                                 │
│ INCIDENT SEVERITY:                              │
│   🔴 CRITICAL: Data breach, isolation failure   │
│   🟠 HIGH: Key compromise, active attack        │
│   🟡 MEDIUM: Failed attacks, anomalies          │
│   🟢 LOW: Routine events                        │
│                                                 │
│ FIRST STEPS:                                    │
│   1. Don't panic                                │
│   2. Alert on-call engineer                     │
│   3. Create incident ticket                     │
│   4. Join #security-incidents                   │
│   5. Follow IRP procedures                      │
│                                                 │
│ INCIDENT RESPONSE PLAN:                         │
│   docs/security/INCIDENT_RESPONSE_PLAN.md       │
└─────────────────────────────────────────────────┘
```

---

**END OF INCIDENT RESPONSE PLAN**

