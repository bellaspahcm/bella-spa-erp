# Partner Onboarding Documentation
*Bella API Gateway - Complete Onboarding Resources*

Last Updated: 2026-06-19

---

## 📚 Overview

This directory contains all documentation needed to onboard new partners to Bella API Gateway, from initial application through production launch and ongoing support.

---

## 📖 Document Index

### 1. **[Partner Selection Criteria](./PARTNER_SELECTION_CRITERIA.md)**

**Purpose**: Define who we partner with and why

**Audience**: Business development, partnerships team

**Key Sections**:
- Target partner profiles (6 categories)
- Mandatory requirements (business, technical, support)
- Preferred qualifications (bonus points)
- Disqualifying factors (automatic rejection)
- Evaluation scoring matrix (100-point scale)
- Application process (3-4 week timeline)
- Priority partners (fast-track list)

**Use When**:
- Evaluating a new partnership inquiry
- Deciding which partners to approach proactively
- Setting partnership strategy for the quarter

---

### 2. **[Partner Onboarding Process](./ONBOARDING_PROCESS.md)**

**Purpose**: Step-by-step guide to onboard a partner from application to go-live

**Audience**: Partner managers, technical account managers, partners

**Key Sections**:
- Complete onboarding journey (5 phases, 4-6 weeks)
- Phase 1: Application & screening
- Phase 2: Technical assessment & contract
- Phase 3: Sandbox testing (10-15 days)
- Phase 4: Production approval
- Phase 5: Go-live & post-launch support
- Ongoing support channels
- Success metrics
- Common pitfalls & solutions
- Escalation matrix

**Use When**:
- Starting onboarding for a new approved partner
- Partner asks "What happens next?"
- Training new team members on onboarding process

---

### 3. **[SLA Agreements & Service Tiers](./SLA_AGREEMENTS.md)**

**Purpose**: Define service levels, guarantees, and commitments for each tier

**Audience**: Partners, sales team, support team

**Key Sections**:
- 5 SLA tiers (Free → Enterprise)
- Rate limits & quotas per tier
- Uptime guarantees (95% → 99.95%)
- Support response times
- Service credit policy (refunds)
- Scheduled maintenance windows
- Incident response protocols
- Upgrade/downgrade policies

**Use When**:
- Partner asks "What tier should we choose?"
- Discussing commercial terms
- SLA violation occurs (need to calculate credits)
- Partner wants to upgrade/downgrade

---

### 4. **[Support Process & Channels](./SUPPORT_PROCESS.md)**

**Purpose**: How partners get help when they need it

**Audience**: Partners, support team

**Key Sections**:
- Support channels (email, Slack, phone, video)
- Incident severity levels (P0 → P4)
- Response time commitments per tier
- Support ticket lifecycle
- Escalation paths (L1 → CTO)
- Emergency contact protocol
- Knowledge base & self-service
- Training & enablement
- Proactive support
- Common issues & solutions

**Use When**:
- Partner needs help
- Partner asks "How do I get support?"
- Training new support team members
- Incident response needed

---

### 5. **[Launch Strategy & Pilot Program](./LAUNCH_STRATEGY.md)**

**Purpose**: Phased rollout plan from pilot to general availability

**Audience**: Leadership, product team, pilot partners

**Key Sections**:
- 4-phase launch plan (Pilot → Beta → Soft Launch → GA)
- Pilot partner selection (2-3 partners, 2 months)
- Beta program (5-10 partners, 3 months)
- Soft launch strategy (1 month)
- General availability roadmap
- Success metrics per phase
- Go/No-Go criteria
- Marketing & PR plans
- Long-term vision (2027-2028)

**Use When**:
- Planning API Gateway launch
- Recruiting pilot/beta partners
- Reporting progress to executives
- Making go/no-go decisions

---

## 🎯 Quick Start Guide

### For Partners (New Applicants)

1. **Read First**: [Partner Selection Criteria](./PARTNER_SELECTION_CRITERIA.md)
   - Understand if you're a good fit
   - Check mandatory requirements
   - Review scoring matrix

2. **Apply**: Submit application at https://api.bellaspa.vn/partner-apply
   - Fill out application form
   - Attach required documents
   - Wait 3-5 business days for response

3. **If Approved**: Review [Onboarding Process](./ONBOARDING_PROCESS.md)
   - Understand the 5-phase journey
   - Prepare your technical team
   - Review [SLA Tiers](./SLA_AGREEMENTS.md) to choose appropriate level

4. **During Onboarding**: Bookmark [Support Process](./SUPPORT_PROCESS.md)
   - Know how to get help
   - Understand response time expectations
   - Save emergency contacts

---

### For Bella Team (Internal)

1. **New Application Received**:
   - Score against [Partner Selection Criteria](./PARTNER_SELECTION_CRITERIA.md)
   - Make approval decision
   - Send response within 3-5 days

2. **Partner Approved**:
   - Follow [Onboarding Process](./ONBOARDING_PROCESS.md) exactly
   - Schedule kickoff call (Week 1)
   - Grant sandbox access
   - Assign TAM (Professional+ tiers)

3. **Partner in Production**:
   - Monitor per [SLA Agreements](./SLA_AGREEMENTS.md)
   - Provide support per [Support Process](./SUPPORT_PROCESS.md)
   - Track metrics (usage, uptime, CSAT)

4. **Launch Phases**:
   - Follow [Launch Strategy](./LAUNCH_STRATEGY.md) timeline
   - Report metrics weekly
   - Execute go/no-go decisions

---

## 🔄 Onboarding Workflow (Visual Summary)

```
┌────────────────────────────────────────────────────────────────┐
│                     PARTNER APPLICATION                         │
│                                                                 │
│  Partner submits form + documents                              │
│  └─> Review against Selection Criteria (3-5 days)             │
│       ├─ Score ≥ 70: ✅ APPROVED (fast-track)                 │
│       ├─ Score 50-69: ⚠️ CONDITIONAL (more info needed)       │
│       └─ Score < 50: ❌ REJECTED (feedback provided)          │
└────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────────┐
│                    TECHNICAL ASSESSMENT                         │
│                                                                 │
│  Kickoff call → Technical discovery → Contract negotiation     │
│  └─> Choose SLA tier → Sign agreements → Get sandbox access   │
│       Timeline: 7-10 days                                      │
└────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────────┐
│                      SANDBOX TESTING                            │
│                                                                 │
│  Week 1: Auth + Basic calls                                    │
│  Week 2: Core integration flows                               │
│  Week 3: Webhook integration                                   │
│  Week 4: Edge cases + Security audit                          │
│  └─> UAT sign-off → Production readiness review               │
│       Timeline: 10-15 days                                     │
└────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────────┐
│                    PRODUCTION APPROVAL                          │
│                                                                 │
│  Issue production API key → Soft launch (10% → 100%)          │
│  └─> Monitor closely → Stabilize → Full rollout               │
│       Timeline: 5-7 days                                       │
└────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────────┐
│                    GO-LIVE & SUPPORT                            │
│                                                                 │
│  Production launch → Daily check-ins (Week 1)                  │
│  └─> Weekly reviews → Monthly QBRs → Ongoing support          │
│       Timeline: Ongoing                                        │
└────────────────────────────────────────────────────────────────┘
```

**Total Timeline**: 4-6 weeks from application to production

---

## 📊 Success Metrics (What We Track)

### Partner Acquisition Metrics

- **Application Volume**: # of partnership inquiries/month
- **Approval Rate**: % of applications approved
- **Time to Decision**: Days from application to approval/rejection
- **Conversion Rate**: % of approved partners that complete onboarding

### Onboarding Metrics

- **Time to First Call**: Days from sandbox access to first API request
- **Time to Production**: Days from application to production launch
- **Onboarding Completion Rate**: % of partners reaching production
- **Support Tickets During Onboarding**: Avg # of tickets per partner
- **Onboarding NPS**: Partner satisfaction with onboarding experience

### Operational Metrics

- **API Uptime**: % availability (target: 99.5%+ depending on tier)
- **API Error Rate**: % of requests returning 5xx errors (target: < 0.5%)
- **Webhook Delivery Success**: % of webhooks delivered successfully (target: > 99%)
- **Response Time**: P95 latency (target: < 500ms)
- **Support Ticket Volume**: Avg tickets per partner per month (target: < 3)
- **First Response Time**: Hours to first human response (varies by tier)
- **Time to Resolution**: Hours from ticket creation to closure (varies by severity)

### Business Metrics

- **Active Partners**: # of partners making ≥1 API call/day
- **Monthly API Calls**: Total API requests across all partners
- **Revenue (MRR)**: Monthly recurring revenue from API Gateway
- **Partner NPS**: Net Promoter Score (target: ≥ 8/10)
- **Customer Satisfaction (CSAT)**: Post-support-ticket rating (target: ≥ 4.5/5)
- **Churn Rate**: % of partners discontinuing service/month (target: < 5%)
- **Expansion Revenue**: $ from tier upgrades

---

## 🚨 Common Issues & Quick Fixes

### Issue: Partner can't authenticate (401 errors)

**Quick Fix**:
1. Verify API key format: `bella_live_` prefix for production, `bella_test_` for sandbox
2. Check `Authorization` header: Must be `Bearer YOUR_API_KEY`
3. Confirm API key is active (not revoked) in admin portal
4. Check if partner is using correct base URL (prod vs sandbox)

**Documentation**: [Security Best Practices](../SECURITY_BEST_PRACTICES.md#authentication)

---

### Issue: Partner hitting rate limits (429 errors)

**Quick Fix**:
1. Check current tier and rate limit quota
2. Review `X-RateLimit-*` headers in API responses
3. Implement exponential backoff with `Retry-After` header
4. Consider tier upgrade if consistently hitting limits

**Documentation**: [Error Handling](../ERROR_HANDLING.md#rate-limiting)

---

### Issue: Webhooks not being received

**Quick Fix**:
1. Verify webhook URL is publicly accessible (not localhost)
2. Check webhook endpoint returns 2xx status code
3. Verify signature validation is correct
4. Check webhook logs in admin portal for delivery attempts
5. Test with `/admin/partners/[id]/test-webhook` endpoint

**Documentation**: [Webhooks Guide](../WEBHOOKS.md#troubleshooting)

---

### Issue: Slow response times (> 1 second)

**Quick Fix**:
1. Use pagination for large result sets (`limit` query param)
2. Apply filters to reduce data returned
3. Check network latency from partner's location
4. Consider caching frequently accessed data
5. Use async processing for long-running operations

**Documentation**: [API Reference](../API_REFERENCE.md#pagination)

---

## 📞 Who to Contact

### For Partnership Inquiries

**API Partnership Team**  
Email: api-partnerships@bellaspa.vn  
Phone: +84 (028) XXXX XXXX  
Hours: Monday-Friday, 9 AM - 6 PM GMT+7

---

### For Technical Support (Partners Only)

**Support Team**  
Email: api-support@bellaspa.vn  
Slack: (by invitation after onboarding)  
Phone: (Professional+ tiers only)

**Response Times**: See [Support Process](./SUPPORT_PROCESS.md#support-channels)

---

### For Escalations (Enterprise Partners Only)

**CTO / VP Engineering**  
Email: cto@bellaspa.vn  
Phone: +84 XXX XXX XXXX (emergencies only)

---

## 🎓 Training Resources

### For Partners

1. **Onboarding Webinar** (Required):
   - Duration: 60 minutes
   - Schedule: Week 1 of onboarding
   - Topics: API overview, authentication, first integration

2. **Advanced Integration Workshop** (Optional):
   - Duration: 90 minutes
   - Tier: Professional+ only
   - Topics: Webhooks, performance optimization, best practices

3. **Weekly Office Hours** (Drop-in):
   - Time: Every Thursday, 3-5 PM GMT+7
   - Format: Zoom Q&A session
   - Open to all tiers

4. **Quarterly Webinars** (Public):
   - New features announcements
   - Partner success stories
   - Best practices sharing

---

### For Bella Team (Internal Training)

1. **Partner Onboarding Training**:
   - Audience: New partnership managers, TAMs
   - Duration: 4 hours
   - Materials: This documentation + recorded demos

2. **Support Training**:
   - Audience: Support team, engineers on-call
   - Duration: 2 hours
   - Focus: Common issues, escalation paths, SLA commitments

3. **Sales Enablement**:
   - Audience: Sales team, account executives
   - Duration: 1 hour
   - Focus: Value proposition, pricing, competitive positioning

---

## 📚 Related Documentation

### Technical Documentation

- [API Reference](../API_REFERENCE.md) - Complete endpoint documentation
- [Getting Started Guide](../GETTING_STARTED.md) - Quick start for developers
- [Webhooks Guide](../WEBHOOKS.md) - Webhook implementation details
- [Error Handling](../ERROR_HANDLING.md) - Error codes and retry logic
- [Security Best Practices](../SECURITY_BEST_PRACTICES.md) - Security guidelines

### Business Documentation

- [Bella API Gateway Master Guide](../BELLA_API_GATEWAY_MASTER_GUIDE.md) - Complete overview
- [API Gateway Master Guide (HTML)](../BELLA_API_GATEWAY_MASTER_GUIDE.html) - Styled version
- [Production Readiness Checklist](../API_GATEWAY_PRODUCTION_READINESS_CHECKLIST.html) - Pre-launch validation

### Infrastructure Documentation

- [Infrastructure README](../../infrastructure/README.md) - Infrastructure setup
- [Database Replication](../../infrastructure/DATABASE_REPLICATION_SETUP.md) - Scaling strategy
- [CDN Caching](../../infrastructure/CDN_CACHING_STRATEGY.md) - Performance optimization

---

## 🔄 Document Maintenance

### Review Schedule

- **Monthly**: Update success metrics and current status
- **Quarterly**: Review and update based on partner feedback
- **Annually**: Major revision (strategy, pricing, tiers)

### Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2026-06-19 | Initial creation of all onboarding docs | Bella Product Team |

---

## 📝 Feedback

Have suggestions to improve this documentation? Found an error or outdated information?

**Contact**:
- Email: api-docs@bellaspa.vn
- GitHub: Open an issue (if repository is public)
- Slack: #api-documentation (internal only)

---

*These onboarding documents are living resources that evolve based on real-world partner experiences. Your feedback helps us improve!*
