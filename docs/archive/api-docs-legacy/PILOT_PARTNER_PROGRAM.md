# Bella ERP API - Pilot Partner Program

## Overview

The Pilot Partner Program allows early access to Bella ERP Partner API for selected integration partners. Pilot partners help validate the API, provide feedback, and ensure production readiness before public launch.

---

## Program Benefits

### For Partners
- ✅ **Early Access**: Get API access before public launch
- ✅ **Priority Support**: Dedicated support team & daily sync calls
- ✅ **Influence Roadmap**: Your feedback shapes the API
- ✅ **Co-Marketing**: Joint case study & press release
- ✅ **Free Tier**: 3 months free Pro tier access
- ✅ **Technical Review**: Free security audit of your integration

### For Bella
- ✅ Real-world testing & validation
- ✅ Early feedback on API design
- ✅ Identify edge cases & issues
- ✅ Build case studies & references
- ✅ Refine documentation based on usage
- ✅ Establish best practices

---

## Partner Selection Criteria

### Required Criteria

1. **Technical Capability**
   - Has technical team (developers)
   - Experience with REST APIs
   - Understands JSON, HTTP, authentication

2. **Partnership Commitment**
   - Existing Bella customer OR technology partner
   - Willing to dedicate 10-20 hours for pilot
   - Can provide feedback & bug reports
   - Available for weekly sync calls

3. **Risk Profile**
   - Non-critical integration (start with read-only if possible)
   - Can test in sandbox environment first
   - Has rollback plan

4. **Business Value**
   - Clear use case for integration
   - Integration benefits multiple Bella customers
   - Potential for long-term partnership

### Ideal Partner Types

**Priority 1: POS Systems**
- KiotViet, MISA, Sapo
- Use Case: Sync orders, products, inventory
- Scopes: `order:read`, `order:write`, `pos:sync`

**Priority 2: Payment Gateways**
- Casso, SePay, PayOS
- Use Case: Auto-match bank transactions
- Scopes: `payment:read`, `payment:write`, `webhook:subscribe`

**Priority 3: Accounting Software**
- MISA, FAST, Bravo
- Use Case: Export invoices, revenue, expenses
- Scopes: `invoice:read`, `order:read`, `analytics:read`

**Priority 4: HR Platforms**
- Base.vn, 1Office
- Use Case: Sync attendance, salary, KPIs
- Scopes: `hr:read`, `hr:sync`

---

## Pilot Timeline (4 Weeks)

```
Week 1: Onboarding & Sandbox Testing
Week 2: Integration Development & Review
Week 3: Limited Production Testing
Week 4: Full Production & Feedback
```

### Week 1: Onboarding & Sandbox Testing

**Goals**:
- Partner understands API capabilities
- Partner successfully calls all relevant endpoints
- Partner identifies integration requirements

**Activities**:
- [ ] Kickoff meeting (1 hour)
- [ ] Share documentation & Postman collection
- [ ] Provide sandbox API key (`pk_test_`)
- [ ] Partner tests endpoints in Postman
- [ ] Partner reviews documentation
- [ ] Daily Slack/Email check-ins

**Deliverables**:
- ✅ Partner has working Postman setup
- ✅ Partner understands authentication & scopes
- ✅ Partner has tested all needed endpoints
- ✅ Integration plan documented

### Week 2: Integration Development & Review

**Goals**:
- Partner implements integration in their codebase
- Bella reviews partner's implementation
- Security & best practices validated

**Activities**:
- [ ] Partner develops integration (sandbox)
- [ ] Partner shares code for review (optional)
- [ ] Bella reviews integration architecture
- [ ] Security checklist review
- [ ] Performance testing
- [ ] Fix issues found
- [ ] 2x sync calls (mid-week, end-of-week)

**Deliverables**:
- ✅ Integration code complete
- ✅ Security checklist passed
- ✅ Error handling implemented
- ✅ Retry logic implemented
- ✅ All tests passing

### Week 3: Limited Production Testing

**Goals**:
- Integration works with real production data
- No security incidents
- Performance meets SLA

**Activities**:
- [ ] Partner receives production API key (`pk_live_`)
- [ ] Enable production access (whitelisted)
- [ ] Limited rollout (1-2 branches/customers)
- [ ] Monitor API usage closely
- [ ] Daily sync calls
- [ ] Fast incident response (<4 hours)
- [ ] Log all issues & resolutions

**Deliverables**:
- ✅ Integration live in limited production
- ✅ Zero security incidents
- ✅ Performance within SLA (95% < 500ms)
- ✅ Error rate < 1%
- ✅ Issues documented & resolved

### Week 4: Full Production & Feedback

**Goals**:
- Integration stable in production
- Partner satisfied with API
- Feedback collected & documented

**Activities**:
- [ ] Expand to all branches/customers
- [ ] Monitor for issues
- [ ] Collect detailed feedback
- [ ] Final review meeting
- [ ] Case study interview (optional)
- [ ] Testimonial request

**Deliverables**:
- ✅ Integration fully deployed
- ✅ Partner satisfaction survey completed
- ✅ Feedback document finalized
- ✅ Case study draft (if agreed)
- ✅ Success metrics captured

---

## Onboarding Checklist

### Pre-Onboarding (Bella Team)

- [ ] Partner selected & approved
- [ ] NDA signed (if needed)
- [ ] Partnership agreement reviewed
- [ ] Technical contact identified
- [ ] Business contact identified
- [ ] Slack channel created
- [ ] Sandbox API key generated
- [ ] Postman collection shared

### Kickoff Meeting Agenda (1 hour)

**Introduction (10 min)**
- [ ] Bella team introductions
- [ ] Partner team introductions
- [ ] Program overview & goals

**Technical Overview (20 min)**
- [ ] API capabilities demo
- [ ] Authentication & scopes explained
- [ ] Rate limits & best practices
- [ ] Sandbox vs production environments
- [ ] Postman collection walkthrough

**Integration Planning (20 min)**
- [ ] Partner's use case & requirements
- [ ] Identify needed endpoints
- [ ] Discuss scope permissions
- [ ] Timeline & milestones
- [ ] Support channels (Slack, email, calls)

**Q&A (10 min)**
- [ ] Answer technical questions
- [ ] Clarify requirements
- [ ] Set next meeting

**Post-Meeting**
- [ ] Share meeting notes
- [ ] Send onboarding email with links
- [ ] Add partner to Slack channel
- [ ] Schedule Week 1 check-in

---

## Onboarding Email Template

```
Subject: Welcome to Bella ERP API Pilot Program!

Hi [Partner Name],

Welcome to the Bella ERP API Pilot Partner Program! We're excited to work with you.

📚 RESOURCES:

1. Documentation:
   - Getting Started: https://docs.bellaspa.com/api/getting-started
   - API Reference: https://docs.bellaspa.com/api/reference
   - Integration Guide: https://docs.bellaspa.com/api/integration-guide
   - Security Guide: https://docs.bellaspa.com/api/security

2. Postman Collection:
   - Download: [Attach Postman files]
   - Import to Postman
   - Set your API key in environment

3. Your Sandbox API Key:
   API Key: pk_test_[REDACTED]
   ⚠️ Keep this secure! Never commit to Git.

🎯 WEEK 1 GOALS:

- [ ] Import Postman collection
- [ ] Test "Test API Key" request
- [ ] Seed sandbox data
- [ ] Test all endpoints you need
- [ ] Document any questions/issues

📞 SUPPORT:

- Slack: #pilot-[partner-name]
- Email: api-support@bellaspa.com
- Emergency: +84 [PHONE]

📅 NEXT STEPS:

- Daily check-ins via Slack (10am)
- Mid-week sync call: [DATE/TIME]
- End-of-week review: [DATE/TIME]

Looking forward to working with you!

Best regards,
[Your Name]
Bella ERP API Team
```

---

## Testing Checklist

### Functional Testing

**Authentication**
- [ ] API key authentication works
- [ ] Invalid API key rejected (401)
- [ ] Inactive API key rejected (401)

**Orders API**
- [ ] Create order successfully
- [ ] Get order by ID
- [ ] List orders with pagination
- [ ] Filter orders by status
- [ ] Sort orders by date
- [ ] Update order
- [ ] Complete order
- [ ] Cancel order

**Payments API**
- [ ] Create payment
- [ ] Get payment by ID
- [ ] List payments
- [ ] Link payment to order

**Customers API**
- [ ] Create customer
- [ ] Get customer by ID
- [ ] List customers
- [ ] Update customer
- [ ] Search customers

**Products API**
- [ ] List products
- [ ] Get product by ID
- [ ] Filter products by category

**Webhooks**
- [ ] Subscribe to webhook
- [ ] Receive webhook events
- [ ] Verify webhook signatures
- [ ] Unsubscribe webhook

### Security Testing

**API Key Security**
- [ ] API key stored securely (environment variable)
- [ ] API key not logged in application logs
- [ ] API key not committed to Git
- [ ] API key rotation plan documented

**Input Validation**
- [ ] Invalid JSON rejected (400)
- [ ] Missing required fields rejected (422)
- [ ] Invalid field formats rejected (422)
- [ ] SQL injection attempts blocked
- [ ] XSS attempts blocked

**Tenant Isolation**
- [ ] Cannot access other tenant's data
- [ ] Tenant ID in request rejected (403)
- [ ] RLS policies enforced

**Webhook Security**
- [ ] Signatures verified
- [ ] Timestamp validation (5-minute window)
- [ ] Replay attacks prevented (event ID tracking)

### Performance Testing

**Response Times**
- [ ] GET requests < 200ms (95th percentile)
- [ ] POST requests < 500ms (95th percentile)
- [ ] List endpoints with pagination < 300ms

**Rate Limiting**
- [ ] Rate limits enforced correctly
- [ ] Retry-After header respected
- [ ] Exponential backoff implemented

**Error Handling**
- [ ] Network errors handled gracefully
- [ ] Retry logic implemented (with backoff)
- [ ] Circuit breaker implemented (optional)
- [ ] Errors logged for debugging

### Integration Testing

**End-to-End Workflows**
- [ ] Complete order lifecycle (create → complete)
- [ ] Complete payment lifecycle (create → confirm)
- [ ] Webhook event → processing pipeline
- [ ] Error scenarios handled correctly

---

## Integration Review Checklist

### Code Review

**Architecture**
- [ ] API client properly abstracted
- [ ] Configuration externalized (environment variables)
- [ ] Secrets management in place
- [ ] Logging implemented (without exposing keys)

**Error Handling**
- [ ] All API errors caught and handled
- [ ] User-friendly error messages
- [ ] Errors logged with context
- [ ] Failed requests tracked

**Retry Logic**
- [ ] Transient errors retried (500, 502, 503, 429)
- [ ] Exponential backoff implemented
- [ ] Max retry attempts defined
- [ ] Non-retryable errors handled (400, 401, 403)

**Security**
- [ ] API keys stored securely
- [ ] HTTPS enforced
- [ ] Webhook signatures verified
- [ ] Input validation on received data

**Testing**
- [ ] Unit tests for API client
- [ ] Integration tests with sandbox
- [ ] Error scenario tests
- [ ] Mock responses for CI/CD

### Performance Review

**Optimization**
- [ ] API calls minimized (caching where appropriate)
- [ ] Batch operations used when possible
- [ ] Connection pooling implemented
- [ ] Timeout configured appropriately

**Monitoring**
- [ ] API call metrics tracked
- [ ] Error rates monitored
- [ ] Response times logged
- [ ] Alerts configured for anomalies

---

## Feedback Collection

### Mid-Pilot Survey (Week 2)

**API Experience (1-5 scale)**
1. How easy was it to get started with the API?
2. How clear is the API documentation?
3. How helpful are the code examples?
4. How responsive is the support team?

**Open Questions**
1. What's working well with the API?
2. What's confusing or difficult?
3. What features are missing?
4. What documentation needs improvement?

### Final Survey (Week 4)

**Overall Satisfaction (1-5 scale)**
1. Overall satisfaction with the API
2. Likelihood to recommend to other partners
3. API reliability & stability
4. API performance & speed
5. Documentation quality
6. Support quality

**Open Questions**
1. What was the best part of the pilot program?
2. What was the most challenging part?
3. What should we improve before public launch?
4. Would you be willing to provide a testimonial?
5. Would you be interested in a case study?

**Success Metrics**
- Integration completion time: [X days]
- Issues encountered: [X]
- Issues resolved: [X]
- Average response time: [X ms]
- Error rate: [X%]
- API calls per day: [X]

---

## Issue Tracking

### Issue Template

```markdown
## Issue Details

**Title**: [Brief description]
**Reported By**: [Partner name]
**Date**: [YYYY-MM-DD]
**Severity**: [Critical / High / Medium / Low]
**Status**: [New / In Progress / Resolved / Won't Fix]

## Description

[Detailed description of the issue]

## Steps to Reproduce

1. [Step 1]
2. [Step 2]
3. [Step 3]

## Expected Behavior

[What should happen]

## Actual Behavior

[What actually happens]

## Environment

- Environment: [Sandbox / Production]
- API Key: [pk_test_... / pk_live_...]
- Endpoint: [/v1/orders]
- Request ID: [req_abc123]

## Logs / Screenshots

[Attach relevant logs or screenshots]

## Impact

[How does this affect the partner's integration?]

## Resolution

[How was this resolved?]

## Prevention

[How can we prevent this in the future?]
```

### Severity Levels

**Critical**
- Production down
- Data loss
- Security vulnerability
- **SLA**: Fix within 4 hours

**High**
- Feature not working
- Workaround available
- Affecting multiple partners
- **SLA**: Fix within 24 hours

**Medium**
- Minor feature issue
- Workaround available
- Affecting single partner
- **SLA**: Fix within 1 week

**Low**
- Documentation issue
- Enhancement request
- Nice-to-have
- **SLA**: Backlog

---

## Success Criteria

### Pilot Program Success

- ✅ At least 1 pilot partner fully onboarded
- ✅ Integration live in production
- ✅ Zero security incidents
- ✅ < 5 critical/high issues
- ✅ All issues resolved within SLA
- ✅ Partner satisfaction > 4/5
- ✅ Partner willing to provide reference

### API Readiness for Public Launch

- ✅ Pilot partner feedback incorporated
- ✅ All critical issues resolved
- ✅ Documentation updated based on feedback
- ✅ Case study published (if agreed)
- ✅ Support processes validated
- ✅ Monitoring & alerting working

---

## Post-Pilot Actions

### Documentation Updates

Based on pilot feedback:
- [ ] Update confusing sections
- [ ] Add missing code examples
- [ ] Clarify error messages
- [ ] Add FAQ entries

### API Improvements

- [ ] Fix bugs found during pilot
- [ ] Implement requested features (if in scope)
- [ ] Optimize performance issues
- [ ] Improve error messages

### Case Study

If partner agrees:
- [ ] Schedule case study interview
- [ ] Draft case study
- [ ] Partner review & approval
- [ ] Publish on website/blog
- [ ] Share on social media

### Public Launch Preparation

- [ ] Update marketing materials
- [ ] Prepare launch announcement
- [ ] Train support team
- [ ] Set up monitoring dashboards
- [ ] Plan soft launch vs hard launch

---

## Contact & Support

**Pilot Program Manager**: [Name]  
**Email**: api-pilot@bellaspa.com  
**Slack**: #pilot-partners  
**Emergency**: +84 [PHONE]

**Office Hours** (Priority Support):
- Monday-Friday: 9am-6pm ICT
- Response Time: < 4 hours
- Emergency Response: < 1 hour

---

**Program Version**: 1.0  
**Last Updated**: 2026-06-18
