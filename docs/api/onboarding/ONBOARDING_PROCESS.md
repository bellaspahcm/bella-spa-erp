# Partner Onboarding Process
*Bella API Gateway - Complete Onboarding Journey*

Last Updated: 2026-06-19

---

## 📋 Overview

This document outlines the complete step-by-step process for onboarding new API partners into the Bella ERP ecosystem. The process is designed to ensure smooth integration, proper training, and successful go-live.

**Typical Timeline**: 4-6 weeks from application to production launch

---

## 🗺️ Onboarding Journey Map

```
┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│   Initial   │──▶│  Technical  │──▶│   Sandbox   │──▶│  Production │──▶│  Go-Live &  │
│  Application│   │  Assessment │   │  Testing    │   │   Approval  │   │   Support   │
└─────────────┘   └─────────────┘   └─────────────┘   └─────────────┘   └─────────────┘
   Week 1            Week 1-2          Week 2-4          Week 4-5          Week 5-6
```

---

## Phase 1: Initial Application & Screening

### Duration: Week 1 (5-7 business days)

### Step 1.1: Partner Submits Application

**Partner Actions:**
1. Complete online application form at: https://api.bellaspa.vn/partner-apply
2. Provide required documents:
   - [ ] Company registration certificate
   - [ ] Business license
   - [ ] Technical capability overview
   - [ ] Integration use case (1-2 pages)
   - [ ] 2 reference customers

**Bella Response Time**: 1-2 business days to acknowledge receipt

---

### Step 1.2: Preliminary Review

**Bella Actions:**
1. Review application against [Partner Selection Criteria](./PARTNER_SELECTION_CRITERIA.md)
2. Score application (0-100 points)
3. Conduct initial background check:
   - Company reputation research
   - Review existing customer feedback
   - Check for security incidents

**Decision Points:**
- ✅ **Score ≥ 70**: Fast-track approval → Move to Phase 2
- ⚠️ **Score 50-69**: Conditional approval → Request additional information
- ❌ **Score < 50**: Rejection → Provide feedback and potential reapplication timeline

**Bella Response Time**: 3-5 business days

---

### Step 1.3: Kickoff Call

**Participants:**
- Partner: Technical Lead + Business Owner
- Bella: API Partnership Manager + Solutions Architect

**Agenda** (60 minutes):
1. Introductions (10 min)
2. Partnership goals alignment (15 min)
3. Integration scope definition (20 min)
4. Timeline agreement (10 min)
5. Next steps & expectations (5 min)

**Deliverables:**
- [ ] Kickoff call recording
- [ ] Agreed integration scope document
- [ ] Project timeline
- [ ] Contact list (escalation matrix)

---

## Phase 2: Technical Assessment & Contract

### Duration: Week 1-2 (7-10 business days)

### Step 2.1: Technical Discovery Session

**Format**: Video call (90 minutes)

**Bella Presents:**
1. API Gateway architecture overview
2. Authentication & security model
3. Rate limiting & quota system
4. Webhook delivery mechanism
5. Error handling & retry logic
6. Sandbox environment tour

**Partner Presents:**
1. Current technical architecture
2. Integration approach
3. Security practices
4. Expected API usage patterns
5. Webhook endpoint readiness

**Deliverables:**
- [ ] Technical integration design document
- [ ] Security assessment checklist
- [ ] API usage projection (requests/day, peak times)

---

### Step 2.2: Contract Negotiation

**Bella Provides:**
- Partner Agreement template (SaaS standard terms)
- SLA tier options (see [SLA_AGREEMENTS.md](./SLA_AGREEMENTS.md))
- Rate limit tier assignment
- Pricing (if revenue-sharing applies)

**Partner Reviews & Negotiates:**
- Service level expectations
- Support channels & response times
- Data retention & privacy terms
- Liability & indemnification clauses
- Commercial terms (if applicable)

**Timeline**: 5-7 business days (may extend if legal review required)

**Deliverables:**
- [ ] Signed Partner Agreement
- [ ] NDA (if not already signed)
- [ ] Data Processing Agreement (DPA)

---

### Step 2.3: Admin Portal Access

**Bella Actions:**
1. Create partner record in admin system
2. Assign initial SLA tier (usually "Startup" or "Business")
3. Generate credentials for admin portal
4. Send welcome email with:
   - Admin portal URL
   - Temporary credentials
   - Documentation links
   - Support contacts

**Partner Actions:**
1. Login to admin portal: https://erp.bellaspa.vn/dashboard/admin/partners
2. Complete company profile
3. Set up billing information (if applicable)
4. Add team members (developers, support staff)

---

## Phase 3: Sandbox Testing

### Duration: Week 2-4 (10-15 business days)

### Step 3.1: Sandbox Environment Setup

**Bella Provisions:**
- [ ] Sandbox tenant with demo data:
  - 50 sample customers
  - 200 sample bookings
  - 10 staff members (KTV)
  - 20 service packages
  - Sample transactions & payments

**Partner Receives:**
- Sandbox API key (prefix: `bella_test_`)
- Sandbox base URL: `https://api-sandbox.bellaspa.vn/v1`
- Test webhook endpoint URL template
- Postman collection for API testing

**Setup Checklist:**
- [ ] Partner configures sandbox API key in their system
- [ ] Partner registers webhook endpoint for testing
- [ ] Partner verifies webhook signature validation
- [ ] Partner tests webhook retry handling

---

### Step 3.2: Integration Development

**Recommended Testing Sequence:**

#### Week 1: Authentication & Basic Calls
- [ ] Test API key authentication
- [ ] Retrieve partner information
- [ ] Test rate limiting (intentionally exceed quota)
- [ ] Handle 401 (unauthorized) responses
- [ ] Handle 429 (rate limit) responses

#### Week 2: Core Integration Flows
- [ ] **Orders Flow**:
  - Create order (POST /v1/orders)
  - Retrieve order (GET /v1/orders/:id)
  - List orders with filters
  - Handle validation errors
  
- [ ] **Payments Flow** (if applicable):
  - Process payment (POST /v1/payments)
  - Handle payment failures
  - Test refund scenarios
  
- [ ] **Customers Flow** (if applicable):
  - Search customers
  - Create customer
  - Update customer info

#### Week 3: Webhook Integration
- [ ] Receive `order.created` webhook
- [ ] Receive `order.updated` webhook
- [ ] Receive `payment.completed` webhook
- [ ] Verify webhook signatures
- [ ] Test webhook retry mechanism (return 5xx errors)
- [ ] Test idempotency (duplicate webhook handling)

#### Week 4: Edge Cases & Error Handling
- [ ] Test network timeouts
- [ ] Test partial failures
- [ ] Test idempotency keys
- [ ] Stress test with concurrent requests
- [ ] Test pagination (large result sets)

**Bella Support:**
- Daily office hours (3 PM - 5 PM GMT+7) for Q&A
- Dedicated Slack channel for partner
- Response time: < 4 hours for technical questions

---

### Step 3.3: Security Audit

**Bella Reviews:**
- [ ] API key storage (never in code, git, or client-side)
- [ ] Webhook signature verification implementation
- [ ] HTTPS-only communication
- [ ] Proper error handling (no sensitive data in logs)
- [ ] Rate limiting compliance
- [ ] Proper retry logic (exponential backoff)

**Tools Used:**
- Code review (partner shares relevant code snippets)
- Security scanning (partner runs provided scripts)
- Penetration testing (optional, for high-value partners)

**Deliverables:**
- [ ] Security audit report
- [ ] Remediation plan (if issues found)
- [ ] Sign-off from Bella Security Team

---

### Step 3.4: UAT (User Acceptance Testing)

**Scenario Testing:**

| Scenario | Expected Outcome | Status |
|----------|------------------|--------|
| Create order for new customer | Order created, webhook sent | ⏳ |
| Process payment for order | Payment confirmed, balance updated | ⏳ |
| Create order with invalid data | Validation error returned (400) | ⏳ |
| Attempt to access other tenant's data | Authorization error (403) | ⏳ |
| Exceed rate limit | 429 error with retry-after header | ⏳ |
| Webhook endpoint down | Retries sent (up to 5 attempts) | ⏳ |

**Sign-off Requirements:**
- [ ] All critical scenarios passed (100%)
- [ ] All high-priority scenarios passed (≥ 95%)
- [ ] Partner team trained and confident
- [ ] Documentation reviewed and understood

---

## Phase 4: Production Approval

### Duration: Week 4-5 (5-7 business days)

### Step 4.1: Production Readiness Review

**Bella Checklist:**
- [ ] All sandbox tests completed successfully
- [ ] Security audit passed
- [ ] Partner team training completed
- [ ] Support escalation matrix defined
- [ ] Monitoring & alerting configured
- [ ] Rollback plan documented

**Partner Checklist:**
- [ ] Production infrastructure ready (load tested)
- [ ] Webhook endpoint production URL registered
- [ ] Error monitoring & alerting configured (Sentry, Datadog, etc.)
- [ ] Support team briefed and on-call rotation set
- [ ] Incident response plan documented
- [ ] Customer communication plan (if outward-facing feature)

---

### Step 4.2: Production API Key Issuance

**Bella Actions:**
1. Generate production API key (prefix: `bella_live_`)
2. Configure production rate limits based on agreed SLA tier
3. Enable production webhook delivery
4. Assign dedicated support channel

**Partner Actions:**
1. Securely store production API key (use secrets manager)
2. Update application configuration (do NOT deploy yet)
3. Perform final pre-deployment checklist
4. Schedule deployment window

**Security Requirements:**
- [ ] Production key stored in secure vault (AWS Secrets Manager, Azure Key Vault, etc.)
- [ ] Production key NOT in version control
- [ ] Production key NOT in environment files committed to git
- [ ] Access to production key limited to authorized personnel
- [ ] Audit logging enabled for key access

---

### Step 4.3: Soft Launch (Beta Phase)

**Strategy**: Limited rollout to minimize risk

**Approach:**
- **Week 1**: 5% of traffic → monitor closely
- **Week 2**: 20% of traffic → validate stability
- **Week 3**: 50% of traffic → performance tuning
- **Week 4**: 100% of traffic → full production

**Monitoring Focus:**
- API error rates (target: < 0.5%)
- Response times (target: p95 < 500ms)
- Webhook delivery success (target: > 99%)
- Partner-side errors
- Customer complaints

**Go/No-Go Criteria for 100% Rollout:**
- ✅ Error rate < 0.5%
- ✅ No critical incidents
- ✅ No customer complaints
- ✅ Partner team confident
- ❌ Any criterion fails → rollback to previous percentage

---

## Phase 5: Go-Live & Post-Launch Support

### Duration: Week 5-6 and ongoing

### Step 5.1: Full Production Launch

**Launch Day Checklist:**
- [ ] Bella team on standby (9 AM - 6 PM GMT+7)
- [ ] Partner team on standby
- [ ] Monitoring dashboards open
- [ ] Communication channels ready (Slack, phone)
- [ ] Rollback plan ready to execute
- [ ] Customer support briefed

**Deployment Steps:**
1. Partner deploys production configuration
2. Validate first API call successful
3. Monitor for 30 minutes (close watch)
4. Gradually increase traffic to 100%
5. Continue monitoring for 24 hours

---

### Step 5.2: Post-Launch Support (First 30 Days)

**Bella Provides:**
- **Week 1**: Daily check-in calls (15 min)
- **Week 2-4**: Weekly check-in calls (30 min)
- **Ongoing**: Monthly business reviews

**Metrics Tracked:**
- Total API calls
- Error rates
- Response times
- Webhook delivery rates
- Support ticket volume
- Partner satisfaction score

---

### Step 5.3: Ongoing Partnership Management

**Quarterly Business Reviews (QBRs):**
- Review API usage trends
- Discuss integration improvements
- Plan new features/capabilities
- Address any concerns
- Renew SLA commitments

**Annual Reviews:**
- Contract renewal
- SLA tier adjustments
- Rate limit increases (if needed)
- Commercial terms review

---

## 🔄 Ongoing Support Channels

### For Technical Issues

| Channel | Use Case | Response Time |
|---------|----------|---------------|
| **Slack** | Quick questions, real-time troubleshooting | < 1 hour (business hours) |
| **Email** | Non-urgent issues, documentation requests | < 4 hours (business hours) |
| **Phone** | Critical outages, emergency escalation | Immediate (24/7 for Tier 3+) |
| **Support Portal** | Bug reports, feature requests, historical tracking | < 8 hours (business hours) |

### For Business Issues

| Contact | Purpose |
|---------|---------|
| **Partnership Manager** | Billing, SLA discussions, contract changes |
| **Customer Success** | Usage optimization, best practices, training |
| **Executive Sponsor** | Escalations, strategic discussions |

---

## 📊 Success Metrics

A successful onboarding is measured by:

- **Time to First Call**: < 3 days from sandbox access
- **Time to Production**: < 6 weeks from application
- **Integration Quality**: < 1% error rate in first 30 days
- **Partner Satisfaction**: ≥ 8/10 NPS score
- **Customer Impact**: No customer complaints related to integration
- **Support Load**: < 5 support tickets in first 30 days

---

## 🚨 Common Pitfalls & How to Avoid Them

### 1. API Key Exposure
**Problem**: API key committed to git or exposed in client-side code  
**Solution**: Use secrets manager, never commit keys, regular audit

### 2. Webhook Signature Not Validated
**Problem**: Accepting unsigned webhooks → security vulnerability  
**Solution**: Always verify `X-Bella-Signature` header

### 3. No Retry Logic
**Problem**: Single network error breaks integration  
**Solution**: Implement exponential backoff with jitter

### 4. Ignoring Rate Limits
**Problem**: Exceeding quota → 429 errors → angry partners  
**Solution**: Implement client-side rate limiting, queue requests

### 5. Poor Error Handling
**Problem**: Generic error messages → hard to debug  
**Solution**: Log request IDs, proper error codes, meaningful messages

### 6. No Monitoring
**Problem**: Issues discovered by customers instead of proactively  
**Solution**: Set up alerts for error rates, response times, webhook failures

---

## 📞 Escalation Matrix

| Severity | Description | Contact | Response Time |
|----------|-------------|---------|---------------|
| **P0 - Critical** | Complete outage, data loss | Phone: +84 XXX XXX XXX | Immediate (24/7) |
| **P1 - High** | Major feature broken, significant customer impact | Slack + Email | < 1 hour |
| **P2 - Medium** | Feature degraded, workaround available | Slack + Email | < 4 hours |
| **P3 - Low** | Minor issue, cosmetic, feature request | Email | < 1 business day |

---

## 📚 Related Documents

- [Partner Selection Criteria](./PARTNER_SELECTION_CRITERIA.md)
- [SLA Agreements & Tiers](./SLA_AGREEMENTS.md)
- [API Getting Started Guide](../GETTING_STARTED.md)
- [Webhook Implementation Guide](../WEBHOOKS.md)
- [Security Best Practices](../SECURITY_BEST_PRACTICES.md)
- [Error Handling Guide](../ERROR_HANDLING.md)

---

*This onboarding process is continuously improved based on partner feedback. Last major update: 2026-06-19*
