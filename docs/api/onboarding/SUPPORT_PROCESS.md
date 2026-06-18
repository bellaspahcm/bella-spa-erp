# Partner Support Process
*Bella API Gateway - Support Channels & SLA*

Last Updated: 2026-06-19

---

## 📋 Overview

This document outlines the support process, channels, and response times for Bella API Gateway partners. Our goal is to provide timely, effective support that keeps your integration running smoothly.

---

## 🎯 Support Philosophy

**Our Commitments:**
1. **Proactive Monitoring**: We detect issues before you report them
2. **Transparent Communication**: Real-time status updates during incidents
3. **Fast Resolution**: Clear SLAs with measurable response times
4. **Knowledge Sharing**: Comprehensive documentation and self-service resources
5. **Continuous Improvement**: Every incident improves our system

---

## 📞 Support Channels

### 1. Self-Service Resources (24/7, Free)

**Documentation Portal**: https://api.bellaspa.vn/docs
- API Reference
- Integration guides
- Code examples
- Troubleshooting guides

**Status Page**: https://status.bellaspa.vn
- Real-time system status
- Planned maintenance schedule
- Incident history
- Subscription for email/SMS alerts

**Community Forum**: https://community.bellaspa.vn/api
- Ask questions
- Share integration tips
- Connect with other partners
- Bella team monitors and responds

**Response Time**: Best effort (usually 24-48 hours)

---

### 2. Email Support

**Address**: api-support@bellaspa.vn

**Available For**: Startup tier and above

**Use Cases**:
- Technical questions
- Bug reports
- Feature requests
- Account management
- Billing inquiries

**Required Information**:
```
Subject: [PRIORITY] Brief description
Body:
- Partner Name: 
- API Key Prefix (first 12 chars): bella_live_xxxxxxxxxxxx
- Severity: P1 / P2 / P3 / P4
- Issue Description:
- Steps to Reproduce:
- Expected Behavior:
- Actual Behavior:
- Request ID (if applicable):
- Timestamp:
- Relevant Code Snippet:
```

**Response Times**:
- **Startup**: < 8 hours (business hours)
- **Business**: < 4 hours (business hours)
- **Professional**: < 2 hours (24/7)
- **Enterprise**: < 30 minutes (24/7)

---

### 3. Slack Support

**Available For**: Business tier and above

**Channel Types**:
- **Business tier**: Shared partner channel (#bella-api-partners)
- **Professional/Enterprise**: Dedicated private channel

**Use Cases**:
- Quick questions
- Real-time troubleshooting
- Incident updates
- General discussions

**Bella Team Members in Channel**:
- Support engineers (rotating shifts)
- Technical Account Manager (Professional+)
- Solutions Architect (Enterprise only)

**Response Times**:
- **Business hours** (9 AM - 6 PM GMT+7): < 15 minutes
- **After hours**: < 1 hour (Professional+), next business day (Business)

---

### 4. Phone Support

**Available For**: Professional and Enterprise tiers

**Number**: +84 (028) XXXX XXXX

**Hours**:
- **Professional**: Monday-Friday, 8 AM - 8 PM GMT+7
- **Enterprise**: 24/7/365

**Use Cases**:
- **Critical incidents only** (P0/P1)
- When immediate voice communication needed
- Escalation of unresolved issues

**Phone Etiquette**:
1. State your partner name immediately
2. Provide API key prefix
3. Describe severity (P0 or P1)
4. Briefly explain the issue
5. Be ready to share screen if needed

**Response Time**: Immediate pickup (Enterprise), < 5 minutes (Professional)

---

### 5. Video Call Support

**Available For**: Professional and Enterprise tiers

**Scheduling**: via Calendly link (provided by TAM)

**Use Cases**:
- Complex integration troubleshooting
- Screen-sharing sessions
- Training and best practices
- Quarterly business reviews

**Duration**: 30-60 minutes per session

**Frequency**:
- **Professional**: On-demand (max 4/month)
- **Enterprise**: Unlimited

---

## 🚨 Incident Severity Levels

### P0 - Emergency (Critical Outage)

**Definition**:
- Complete API unavailability
- Data loss or corruption
- Security breach

**Examples**:
- API returns 503 for all requests
- Database is down
- Unauthorized access detected

**Response Time**:
- Enterprise: < 15 minutes (24/7)
- Professional: < 30 minutes (24/7)
- Not available for Business/Startup (escalates to P1)

**Resolution Target**: < 1 hour

**Communication**:
- Immediate phone call (if number on file)
- Slack notification
- Email notification
- Status page updated
- Updates every 30 minutes

---

### P1 - Critical (Major Impact)

**Definition**:
- Major feature completely unavailable
- Affecting multiple partners
- No workaround available

**Examples**:
- Webhook delivery failing for all partners
- Authentication service down
- Rate limiting not working (allows unlimited)

**Response Time**:
- Enterprise: < 30 minutes (24/7)
- Professional: < 1 hour (24/7)
- Business: < 2 hours (business hours)
- Startup: < 4 hours (business hours)

**Resolution Target**: < 4 hours

**Communication**:
- Slack notification (if enabled)
- Email notification
- Status page updated
- Updates every hour

---

### P2 - High (Significant Impact)

**Definition**:
- Important feature degraded
- Affecting single partner or small subset
- Workaround available

**Examples**:
- Slow response times (but API working)
- Webhook delays (but eventually delivered)
- Admin dashboard not loading
- Incorrect usage metrics

**Response Time**:
- Enterprise: < 1 hour (24/7)
- Professional: < 2 hours (business hours)
- Business: < 4 hours (business hours)
- Startup: < 8 hours (business hours)

**Resolution Target**: < 8 hours

**Communication**:
- Email notification
- Slack update (if applicable)
- Updates every 4 hours

---

### P3 - Medium (Moderate Impact)

**Definition**:
- Minor feature issue
- Cosmetic bug
- Feature request

**Examples**:
- API documentation outdated
- Admin UI typo or formatting issue
- Minor webhook retry delay
- Non-critical validation error

**Response Time**:
- All tiers: < 1 business day

**Resolution Target**: < 1 week

**Communication**:
- Email acknowledgment
- Updates as progress is made

---

### P4 - Low (Minimal Impact)

**Definition**:
- Enhancement request
- Question or clarification
- General inquiry

**Examples**:
- "How do I implement X feature?"
- "Can you add Y to the API?"
- "What's the best practice for Z?"

**Response Time**:
- All tiers: < 2 business days

**Resolution Target**: Varies (feature requests added to roadmap)

**Communication**:
- Email response with recommendations

---

## 🔄 Support Ticket Lifecycle

### 1. Ticket Creation

**Methods**:
- Email to api-support@bellaspa.vn
- Slack message (auto-creates ticket)
- Phone call (agent creates ticket)
- Self-service portal (coming soon)

**Automatic Actions**:
- Ticket ID assigned (format: `SUP-YYYYMMDD-XXXX`)
- Severity auto-detected (can be adjusted)
- Partner tier identified
- SLA clock starts
- Auto-reply sent with ticket ID

---

### 2. Initial Response

**Actions**:
- Support engineer reviews ticket
- Severity confirmed or adjusted
- Additional information requested (if needed)
- Workaround provided (if available)
- Investigation begins

**Timeframe**: Based on severity and tier SLA

---

### 3. Investigation & Diagnosis

**Actions**:
- Review logs (API gateway, application, database)
- Reproduce issue in staging
- Identify root cause
- Develop fix or workaround

**Updates**:
- Progress updates per severity SLA
- Partner can request updates anytime

---

### 4. Resolution

**Actions**:
- Fix deployed (after testing)
- Partner notified
- Verification requested
- Root Cause Analysis (RCA) provided (P0/P1 only)

**Partner Actions Required**:
- Verify fix works
- Confirm resolution
- Provide feedback

---

### 5. Ticket Closure

**Conditions**:
- Issue resolved
- Partner confirms fix
- OR partner non-responsive for 7 days
- OR workaround accepted

**Post-Closure**:
- Satisfaction survey sent (optional)
- Knowledge base article created (if applicable)
- Incident postmortem (P0/P1 only)

---

## 📊 Support Metrics & Reporting

### Key Metrics

1. **First Response Time (FRT)**
   - Time from ticket creation to first human response
   - Target: Based on severity and tier SLA

2. **Time to Resolution (TTR)**
   - Time from ticket creation to issue resolved
   - Target: Based on severity level

3. **Ticket Volume**
   - Total tickets per partner per month
   - Target: < 5 tickets/month (healthy integration)

4. **Customer Satisfaction (CSAT)**
   - Post-resolution survey (1-5 stars)
   - Target: ≥ 4.5/5.0 average

5. **Reopen Rate**
   - Percentage of tickets reopened within 7 days
   - Target: < 5%

### Reporting

**For Partners**:
- Monthly support summary email
- Quarterly business review (Professional+)
- Real-time ticket status in admin portal

**Internal (Bella)**:
- Daily support dashboard
- Weekly team review
- Monthly leadership report

---

## 🎓 Partner Enablement

### Documentation

**Comprehensive Guides**:
- [API Reference](../API_REFERENCE.md)
- [Getting Started Guide](../GETTING_STARTED.md)
- [Webhooks Implementation](../WEBHOOKS.md)
- [Error Handling](../ERROR_HANDLING.md)
- [Security Best Practices](../SECURITY_BEST_PRACTICES.md)

**Code Examples**:
- Node.js / TypeScript
- Python
- PHP
- Java
- C# / .NET
- Ruby

**Postman Collection**:
- Pre-configured API calls
- Environment templates
- Sample responses
- Error scenarios

---

### Training Sessions

**Onboarding Training** (All tiers):
- Duration: 60 minutes
- Format: Video call + screen share
- Topics: API overview, authentication, basic integration
- Timing: Week 1 of onboarding

**Advanced Training** (Professional+):
- Duration: 90 minutes
- Format: Video call + hands-on exercises
- Topics: Webhooks, error handling, performance optimization
- Timing: On-demand

**Quarterly Webinars** (All tiers):
- New feature announcements
- Best practices sharing
- Partner success stories
- Q&A session

---

### Office Hours

**Weekly Drop-in Sessions**:
- **When**: Every Thursday, 3:00 PM - 5:00 PM GMT+7
- **Where**: Zoom (link in partner portal)
- **Who**: Any partner (all tiers)
- **Format**: Informal Q&A, troubleshooting help
- **No Registration**: Just join when you need help

---

## 🚀 Proactive Support

### Health Monitoring

**Bella Monitors**:
- Partner API error rates (threshold: > 2%)
- Response time degradation (threshold: > 1000ms p95)
- Webhook delivery failures (threshold: > 10%)
- Rate limit approaching (threshold: > 80% of quota)

**Proactive Actions**:
- **< 80% quota**: No action
- **80-90% quota**: Informational email (weekly)
- **90-95% quota**: Warning email (daily)
- **> 95% quota**: Phone call (Professional+) / Email (Business/Startup)

---

### Incident Prevention

**Quarterly Infrastructure Reviews** (Professional+):
- Review integration architecture
- Identify potential bottlenecks
- Recommend optimizations
- Discuss scaling plans

**Annual Security Audit** (Enterprise):
- Penetration testing
- Code review
- Compliance check
- Security recommendations

---

## 📈 Escalation Path

### Level 1: Support Engineer

**Handles**:
- Common issues (90% of tickets)
- API usage questions
- Basic troubleshooting
- Documentation clarification

---

### Level 2: Senior Engineer

**Handles**:
- Complex technical issues
- Performance optimization
- Integration architecture questions
- Custom development consultation

**Escalation Trigger**:
- Ticket open > 24 hours (P1/P2)
- Requires code-level investigation
- L1 engineer requests escalation

---

### Level 3: Engineering Team Lead

**Handles**:
- System-level issues
- Infrastructure problems
- Database performance
- Critical bugs requiring code changes

**Escalation Trigger**:
- Ticket open > 48 hours (P1)
- Multiple partners affected
- Requires production hotfix
- L2 engineer requests escalation

---

### Level 4: CTO / VP Engineering

**Handles**:
- Emergency escalations
- Partnership disputes
- Major outages
- Strategic decisions

**Escalation Trigger**:
- P0 incidents > 2 hours
- Partner threatens termination
- Legal/compliance issues
- Executive-level relationship needed

**Contact**: cto@bellaspa.vn (Enterprise partners only)

---

## 🛡️ Emergency Contact Protocol

### For P0 Incidents (Enterprise Only)

1. **Call Phone Hotline**: +84 (028) XXXX XXXX
2. **State**: "This is a P0 emergency"
3. **Provide**: Partner name, API key prefix
4. **Describe**: Brief issue summary
5. **Expect**: Immediate engineer response

### If No Answer (Failsafe)

1. **Send SMS** to hotline number with:
   ```
   P0 EMERGENCY
   Partner: [Your Company]
   Issue: [Brief description]
   Contact: [Your phone number]
   ```
2. **Email** cto@bellaspa.vn with subject: `[P0 EMERGENCY] Brief description`
3. **Post in Slack** (if available)

**We commit to responding within 15 minutes, 24/7/365.**

---

## 📚 Knowledge Base Articles

### Most Common Issues

1. **401 Unauthorized Errors**
   - **Cause**: Invalid or expired API key
   - **Solution**: Regenerate API key in admin portal
   - **Prevention**: Implement key rotation every 90 days

2. **429 Rate Limit Exceeded**
   - **Cause**: Too many requests in time window
   - **Solution**: Implement exponential backoff, respect `Retry-After` header
   - **Prevention**: Monitor usage, upgrade tier if needed

3. **Webhook Signature Verification Failing**
   - **Cause**: Incorrect secret, clock skew
   - **Solution**: Verify webhook secret, sync server time
   - **Prevention**: Use library for signature verification

4. **Slow Response Times**
   - **Cause**: Network latency, large result sets
   - **Solution**: Use pagination, filters, caching
   - **Prevention**: Optimize queries, use async processing

5. **Idempotency Key Conflicts**
   - **Cause**: Reusing same key for different requests
   - **Solution**: Generate unique UUIDs per operation
   - **Prevention**: Use timestamp + request hash

---

## 📞 Contact Summary

| Purpose | Channel | When | Who |
|---------|---------|------|-----|
| **Technical Questions** | Email | Anytime | All tiers (Startup+) |
| **Quick Help** | Slack | Business hours | Business+ |
| **Critical Issues** | Phone | 24/7 | Professional+ |
| **Emergency** | Phone + SMS | P0 incidents | Enterprise only |
| **Training** | Video call | Scheduled | Professional+ |
| **Casual Q&A** | Office Hours | Thursday 3-5 PM | All tiers |
| **Status Updates** | Status Page | 24/7 | Everyone |
| **Community** | Forum | Anytime | Everyone (free) |

---

## 📚 Related Documents

- [SLA Agreements & Service Tiers](./SLA_AGREEMENTS.md)
- [Partner Onboarding Process](./ONBOARDING_PROCESS.md)
- [API Error Codes](../ERROR_HANDLING.md)
- [Security Incidents](../SECURITY_BEST_PRACTICES.md#incident-response)

---

*Our support team is here to ensure your integration success. Don't hesitate to reach out!*
