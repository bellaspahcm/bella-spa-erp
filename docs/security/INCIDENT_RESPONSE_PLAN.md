# Incident Response Plan - Bella ERP API Gateway

**Document Version**: 1.0  
**Last Updated**: 2026-06-17  
**Status**: Active  
**Classification**: Internal - Confidential

---

## Executive Summary

This document defines the incident response procedures for security incidents related to the Bella ERP API Gateway. It provides clear escalation paths, response timelines, and communication protocols.

**Key Principles**:
1. **Speed**: Respond within defined SLAs
2. **Containment**: Prevent further damage immediately
3. **Communication**: Keep stakeholders informed
4. **Learning**: Document and improve after each incident

---

## Table of Contents

1. [Incident Classification](#incident-classification)
2. [Response Team](#response-team)
3. [Response Procedures](#response-procedures)
4. [Communication Plan](#communication-plan)
5. [Post-Incident Activities](#post-incident-activities)

---

## 1. Incident Classification

### 1.1 Severity Levels

| Severity | Definition | Examples | Response Time |
|----------|------------|----------|---------------|
| **🔴 CRITICAL** | Cross-tenant data breach, service down | Partner A accessed Partner B data | < 15 minutes |
| **🟠 HIGH** | Security vulnerability exploited, major data loss risk | Tenant injection attempt detected | < 1 hour |
| **🟡 MEDIUM** | Minor security issue, service degradation | Repeated invalid API key attempts | < 4 hours |
| **🟢 LOW** | Informational, no immediate risk | Partner exceeded rate limit | < 24 hours |

### 1.2 Incident Types

#### Type 1: Data Breach
**Definition**: Unauthorized access to tenant data  
**Examples**:
- Cross-tenant data access
- API key compromise
- Database credential leak

**Initial Response**:
1. Block affected API keys immediately
2. Isolate affected tenants
3. Preserve audit logs
4. Notify legal team

---

#### Type 2: Denial of Service
**Definition**: Service unavailable or degraded  
**Examples**:
- API rate limit exhaustion
- Database connection pool exhaustion
- DDoS attack

**Initial Response**:
1. Enable aggressive rate limiting
2. Block attacking IPs
3. Scale infrastructure
4. Monitor recovery

---

#### Type 3: Authentication Bypass
**Definition**: Unauthorized access without valid credentials  
**Examples**:
- API key brute force
- Session hijacking
- JWT manipulation

**Initial Response**:
1. Invalidate suspicious sessions
2. Enable additional authentication factors
3. Review auth logs
4. Patch vulnerability

---

#### Type 4: Privilege Escalation
**Definition**: Partner gains unauthorized permissions  
**Examples**:
- Scope escalation
- Admin access gained
- RLS bypass

**Initial Response**:
1. Revoke escalated permissions
2. Review scope assignments
3. Audit affected partner's actions
4. Fix authorization logic

---

## 2. Response Team

### 2.1 Team Structure

```
┌────────────────────────────────────┐
│   Incident Commander (CTO)         │
│   • Overall decision authority      │
│   • Escalation to executive team   │
└────────────────────────────────────┘
                 ↓
    ┌────────────┴────────────┐
    ↓                         ↓
┌─────────────────┐   ┌─────────────────┐
│ Technical Lead  │   │ Communications  │
│ (API Team Lead) │   │ (CS Manager)    │
│ • Investigation │   │ • Stakeholder   │
│ • Mitigation    │   │   updates       │
└─────────────────┘   └─────────────────┘
         ↓
┌─────────────────────────────────────┐
│  Support Team                       │
│  • Security Engineer                │
│  • Database Admin                   │
│  • DevOps Engineer                  │
│  • Legal Counsel (if data breach)   │
└─────────────────────────────────────┘
```

### 2.2 Roles & Responsibilities

#### Incident Commander (CTO)
- Declare incident severity
- Authorize service disruption if needed
- Escalate to CEO for CRITICAL incidents
- Approve external communications

#### Technical Lead (API Team Lead)
- Lead technical investigation
- Coordinate mitigation efforts
- Make technical decisions
- Update incident commander

#### Communications Lead (Customer Success Manager)
- Notify affected customers
- Update status page
- Coordinate with legal for breach notifications
- Draft post-mortem

#### Security Engineer
- Analyze attack vectors
- Implement security patches
- Review audit logs
- Provide security recommendations

#### Database Admin
- Query audit logs
- Restore backups if needed
- Monitor database health
- Implement RLS fixes

#### DevOps Engineer
- Deploy emergency patches
- Scale infrastructure
- Monitor system health
- Implement rate limiting

#### Legal Counsel
- Assess legal obligations (GDPR, etc.)
- Review breach notification requirements
- Advise on liability
- Coordinate with regulators

---

## 3. Response Procedures

### 3.1 Detection Phase

**Detection Methods**:
1. **Automated Alerts**:
   - Monitoring system (Datadog, New Relic)
   - Security alerts (tenant injection attempts)
   - Error rate spikes

2. **Manual Reports**:
   - Customer reports
   - Partner reports
   - Internal team discovery

**Alert Channels**:
- Slack: `#security-alerts` (24/7 monitored)
- PagerDuty: On-call rotation
- Email: `security@bella.vn`

---

### 3.2 Triage Phase (< 15 minutes)

**Checklist**:
```
[ ] Confirm incident is real (not false positive)
[ ] Classify severity (CRITICAL/HIGH/MEDIUM/LOW)
[ ] Identify incident type (Breach/DoS/Auth/Privilege)
[ ] Alert incident commander
[ ] Assemble response team
[ ] Create incident ticket (Jira: SEC-XXX)
```

**Triage Questions**:
1. What happened?
2. When did it start?
3. How many tenants affected?
4. Is data compromised?
5. Is service still available?

---

### 3.3 Containment Phase

#### CRITICAL: Cross-Tenant Data Breach

**Immediate Actions** (< 15 minutes):
```typescript
// 1. Block affected API key
await supabase
  .from('api_partners')
  .update({ is_active: false, blocked_reason: 'Security incident SEC-XXX' })
  .eq('api_key', compromisedApiKey);

// 2. Revoke all sessions for affected partner
await supabase.auth.admin.deleteUser(partnerUserId);

// 3. Enable incident mode (extra logging)
await supabase.rpc('enable_incident_mode', { incident_id: 'SEC-XXX' });

// 4. Preserve audit logs
await backupAuditLogs({
  partner_id: affectedPartnerId,
  date_range: [incidentStart, now()],
  destination: 's3://bella-security/incidents/SEC-XXX/',
});
```

**Containment Checklist**:
```
[ ] Affected API keys blocked
[ ] Affected tenants notified (internal)
[ ] Audit logs preserved
[ ] Incident mode enabled
[ ] Additional monitoring enabled
[ ] Vulnerability patched (if known)
```

---

#### HIGH: Tenant Injection Attempt

**Immediate Actions** (< 1 hour):
```typescript
// 1. Log security incident
await logSecurityIncident({
  type: 'TENANT_INJECTION_ATTEMPT',
  partner_id: req.partner.partner_id,
  attempted_tenant: req.body.tenant_id,
  actual_tenant: req.partner.tenant_id,
  ip_address: req.ip,
  user_agent: req.headers['user-agent'],
});

// 2. Increase monitoring for this partner
await setPartnerMonitoringLevel(partnerId, 'HIGH');

// 3. Review partner's recent activity
const recentActivity = await getPartnerActivity({
  partner_id: partnerId,
  time_range: '24h',
});

// 4. Block partner if multiple attempts detected
if (injectionAttempts > 3) {
  await blockPartner(partnerId, 'Multiple tenant injection attempts');
}
```

---

### 3.4 Investigation Phase

**Evidence Collection**:
1. **Audit Logs**:
   ```sql
   SELECT * FROM api_request_logs
   WHERE partner_id = 'affected-partner'
     AND created_at BETWEEN 'incident-start' AND 'incident-end'
   ORDER BY created_at ASC;
   ```

2. **Database Queries**:
   ```sql
   -- Check if cross-tenant access occurred
   SELECT 
     partner_id,
     tenant_id,
     endpoint,
     response_status,
     COUNT(*) as request_count
   FROM api_request_logs
   WHERE created_at > 'incident-start'
   GROUP BY partner_id, tenant_id, endpoint, response_status
   HAVING tenant_id != (
     SELECT tenant_id FROM api_partners WHERE id = partner_id
   );
   ```

3. **System Logs**:
   - Application logs (errors, warnings)
   - Database slow query logs
   - Web server access logs

**Analysis Questions**:
- What was the attack vector?
- How did attacker bypass security?
- What data was accessed?
- How long was the vulnerability exploited?
- Are there other affected partners?

---

### 3.5 Eradication Phase

**Steps**:
1. **Fix Vulnerability**:
   - Deploy security patch
   - Update RLS policies
   - Enhance validation logic

2. **Remove Backdoors**:
   - Check for unauthorized API keys
   - Review scope assignments
   - Audit admin accounts

3. **Update Security Controls**:
   - Add detection rules
   - Enhance monitoring
   - Update firewall rules

---

### 3.6 Recovery Phase

**Steps**:
1. **Restore Service**:
   - Re-enable affected partners (if safe)
   - Verify functionality
   - Monitor closely

2. **Verify Security**:
   - Run security tests
   - Verify logs are clean
   - Confirm vulnerability fixed

3. **Gradual Rollout**:
   - Start with sandbox tenants
   - Monitor for 24 hours
   - Gradually enable production

---

## 4. Communication Plan

### 4.1 Internal Communication

**Incident Declared** (Immediately):
```
TO: incident-response-team@bella.vn
SUBJECT: [CRITICAL] Security Incident SEC-XXX Declared

Incident: Cross-tenant data access detected
Severity: CRITICAL
Commander: [Name]
Status: Containment in progress

Affected:
- Partner: [Partner Name]
- Tenants: [Count]

Next Update: 30 minutes
```

**Status Updates** (Every 30 minutes for CRITICAL, every 2 hours for HIGH):
```
SUBJECT: [SEC-XXX] Update #2

Current Status: Investigation
Actions Taken:
- API key blocked
- Audit logs preserved
- Vulnerability identified

Next Steps:
- Deploy security patch
- Verify no other partners affected

Next Update: 30 minutes
```

---

### 4.2 External Communication

#### To Affected Customers (Within 24 hours)

```
SUBJECT: Security Notice - Action Required

Dear [Customer Name],

We are writing to inform you of a security incident that may have 
affected your Bella ERP account.

WHAT HAPPENED:
On [Date], we detected unauthorized access to [describe data].

WHAT DATA WAS AFFECTED:
[List specific data: orders, customers, etc.]

WHAT WE'RE DOING:
- Blocked unauthorized access immediately
- Conducted thorough security review
- Implemented additional security measures

WHAT YOU SHOULD DO:
- Review your recent activity for anomalies
- Rotate your API keys (instructions attached)
- Contact us if you have questions: security@bella.vn

We sincerely apologize for this incident and are committed to 
protecting your data.

Sincerely,
Bella ERP Security Team
```

---

#### Public Status Page (If service affected)

```
⚠️ Investigating - API Gateway Performance Issues

[2026-06-17 10:30 UTC] We are investigating reports of slow API 
response times. Our team is working to identify the root cause.

[2026-06-17 11:00 UTC] We have identified the issue and are 
implementing a fix. Service should be restored within 30 minutes.

[2026-06-17 11:30 UTC] Service has been restored. We will continue 
to monitor closely.
```

---

### 4.3 Regulatory Notification (GDPR)

**Timeline**: Within 72 hours of discovery

**Notification Template** (to Data Protection Authority):
```
Notification of Personal Data Breach

1. Nature of Breach:
   [Description of what happened]

2. Categories and Number of Data Subjects:
   [e.g., 50 customers, 5 employees]

3. Data Categories Affected:
   [e.g., Names, email addresses, order history]

4. Likely Consequences:
   [Risk assessment]

5. Measures Taken:
   [Containment and mitigation actions]

6. Contact:
   Data Protection Officer: dpo@bella.vn
```

---

## 5. Post-Incident Activities

### 5.1 Post-Mortem (Within 5 business days)

**Template**:

```markdown
# Post-Mortem: SEC-XXX

## Incident Summary
**Date**: 2026-06-17  
**Severity**: CRITICAL  
**Duration**: 2 hours  
**Impact**: 5 tenants affected

## Timeline
- 10:30 - Incident detected (automated alert)
- 10:35 - Incident commander notified
- 10:40 - API key blocked
- 11:00 - Vulnerability identified
- 11:30 - Patch deployed
- 12:00 - Service verified
- 12:30 - Incident resolved

## Root Cause
[Detailed technical explanation]

## What Went Well
- Fast detection (5 minutes)
- Immediate containment
- Clear communication

## What Went Wrong
- Vulnerability existed in production for 3 days
- No automated tests caught this case
- Audit logs delayed by 15 minutes

## Action Items
1. [JIRA-123] Add test case for this scenario - **P0**
2. [JIRA-124] Improve log streaming latency - **P1**
3. [JIRA-125] Enhance pre-production security scanning - **P1**

## Lessons Learned
- Need better input validation at multiple layers
- Automated security tests prevented worse outcome
- Incident response plan worked well
```

---

### 5.2 Security Enhancements

**Mandatory Actions**:
```
[ ] Add test case to prevent regression
[ ] Update threat model
[ ] Update security documentation
[ ] Brief team on lessons learned
[ ] Schedule follow-up review in 30 days
```

**Optional Actions**:
- Conduct tabletop exercise for similar scenario
- Update monitoring thresholds
- Enhance automated alerts

---

### 5.3 Metrics & Reporting

**Key Metrics**:
- **MTTD** (Mean Time To Detect): Target < 5 minutes
- **MTTR** (Mean Time To Resolve): Target < 2 hours for CRITICAL
- **False Positive Rate**: Target < 5%
- **Incidents per Month**: Track trend

**Monthly Report**:
```
Security Incident Report - June 2026

Total Incidents: 3
- CRITICAL: 0
- HIGH: 1 (Tenant injection attempt - blocked)
- MEDIUM: 2 (Rate limit exceeded)
- LOW: 0

MTTD: 3.5 minutes (Target: < 5 min) ✅
MTTR: 45 minutes (Target: < 2 hours) ✅

Top Threats:
1. Invalid API key attempts (50 occurrences)
2. Rate limit exceeded (20 occurrences)
3. Tenant injection attempts (1 occurrence)

Actions Taken:
- Enhanced monitoring for tenant injection
- Blocked 2 abusive API keys
- Updated security documentation
```

---

## 6. Training & Exercises

### 6.1 Tabletop Exercises

**Frequency**: Quarterly

**Scenario Examples**:
1. **Cross-Tenant Data Breach**: Partner A accesses Partner B data
2. **API Key Compromise**: Leaked API key on GitHub
3. **DDoS Attack**: API unavailable due to traffic flood
4. **Insider Threat**: Rogue employee steals data

**Exercise Format**:
- 90 minutes
- All response team members
- Walk through scenario step-by-step
- Identify gaps in procedures
- Update documentation

---

### 6.2 Security Training

**Annual Training** (All Engineers):
- OWASP API Security Top 10
- Secure coding practices
- Incident response procedures
- Data protection regulations (GDPR)

**Quarterly Refreshers**:
- Recent incidents (anonymized)
- New threats
- Updated procedures

---

## 7. Appendices

### Appendix A: Contact List

| Role | Name | Phone | Email |
|------|------|-------|-------|
| Incident Commander | [CTO Name] | +84-XXX-XXX-XXX | cto@bella.vn |
| Technical Lead | [Team Lead] | +84-XXX-XXX-XXX | api-team@bella.vn |
| Security Engineer | [Engineer] | +84-XXX-XXX-XXX | security@bella.vn |
| Legal Counsel | [Lawyer] | +84-XXX-XXX-XXX | legal@bella.vn |

### Appendix B: Tool Access

| Tool | URL | Purpose |
|------|-----|---------|
| Monitoring | https://bella.datadog.com | System metrics |
| Logs | https://bella.supabase.com/logs | Audit logs |
| PagerDuty | https://bella.pagerduty.com | On-call alerts |
| Status Page | https://status.bella.vn | Public updates |

### Appendix C: Escalation Matrix

```
Severity: LOW
↓ (24 hours no resolution)
Severity: MEDIUM
↓ (4 hours no resolution)
Severity: HIGH
↓ (1 hour no resolution)
Severity: CRITICAL
↓ (Immediate)
Executive Team + Board
```

---

**Document Owner**: Security Team  
**Approved By**: CTO  
**Last Tested**: [Pending first tabletop exercise]  
**Next Review**: 2026-09-17
