# Partner Selection Guide - Pilot Program

## Purpose

This document guides the Bella ERP team in selecting the best pilot partners for the API program. A good pilot partner helps validate the API while minimizing risk.

---

## Evaluation Framework

### Scoring Matrix (Total: 100 points)

| Category | Weight | Max Points |
|----------|--------|------------|
| **Technical Capability** | 30% | 30 |
| **Partnership Strength** | 25% | 25 |
| **Risk Profile** | 20% | 20 |
| **Business Value** | 15% | 15 |
| **Resource Commitment** | 10% | 10 |

**Scoring**:
- 80-100: Excellent - Proceed immediately
- 60-79: Good - Proceed with caution
- 40-59: Fair - Consider alternatives
- 0-39: Poor - Do not proceed

---

## 1. Technical Capability (30 points)

### Developer Team (10 points)
- **10 pts**: Dedicated API integration team (2+ developers)
- **7 pts**: 1 dedicated developer
- **4 pts**: Developer available part-time
- **0 pts**: No dedicated technical resource

### API Experience (10 points)
- **10 pts**: Extensive REST API experience, multiple integrations
- **7 pts**: Some API experience, 1-2 integrations
- **4 pts**: Limited API experience
- **0 pts**: No API experience

### Technical Infrastructure (10 points)
- **10 pts**: Production-grade infrastructure, CI/CD, monitoring
- **7 pts**: Basic production infrastructure
- **4 pts**: Development-only infrastructure
- **0 pts**: No infrastructure for hosting integration

**Questions to Ask**:
1. How many developers will work on this integration?
2. What APIs have you integrated with before?
3. What programming languages does your team use?
4. Do you have a staging/production environment?
5. What monitoring tools do you use?

---

## 2. Partnership Strength (25 points)

### Existing Relationship (10 points)
- **10 pts**: Long-term Bella customer (2+ years) OR strategic technology partner
- **7 pts**: Current Bella customer (< 2 years)
- **4 pts**: New Bella customer (< 6 months)
- **0 pts**: No existing relationship

### Commitment Level (10 points)
- **10 pts**: Signed partnership agreement, committed resources
- **7 pts**: Verbal commitment, resources identified
- **4 pts**: Interested but no formal commitment
- **0 pts**: Just exploring

### Communication & Availability (5 points)
- **5 pts**: Responsive, available for weekly calls, Slack active
- **3 pts**: Responsive via email, occasional calls
- **0 pts**: Slow to respond, limited availability

**Questions to Ask**:
1. How long have you been a Bella customer/partner?
2. Can you commit 10-20 hours over 4 weeks?
3. Are you available for weekly sync calls?
4. What's your preferred communication channel?

---

## 3. Risk Profile (20 points)

### Integration Criticality (10 points)
- **10 pts**: Read-only integration, no critical workflows
- **7 pts**: Read-write but non-financial (orders, customers)
- **4 pts**: Financial integration (payments, invoices)
- **0 pts**: Mission-critical, affects business operations

### Rollback Plan (5 points)
- **5 pts**: Clear rollback plan, manual fallback available
- **3 pts**: Basic rollback plan
- **0 pts**: No rollback plan

### Data Sensitivity (5 points)
- **5 pts**: Low sensitivity (products, public data)
- **3 pts**: Medium sensitivity (customer data, orders)
- **0 pts**: High sensitivity (payments, financial records)

**Questions to Ask**:
1. What will this integration replace/enhance?
2. What happens if the API goes down?
3. Do you have a rollback plan?
4. What data will you access via the API?

---

## 4. Business Value (15 points)

### Market Impact (10 points)
- **10 pts**: Integration benefits 100+ Bella customers
- **7 pts**: Integration benefits 20-99 Bella customers
- **4 pts**: Integration benefits 5-19 Bella customers
- **0 pts**: Integration benefits < 5 Bella customers

### Strategic Value (5 points)
- **5 pts**: Strategic partner (POS, payment gateway, accounting)
- **3 pts**: Valuable partner (HR, analytics)
- **0 pts**: Limited strategic value

**Questions to Ask**:
1. How many Bella customers would use this integration?
2. What problem does this integration solve?
3. Is this integration unique or available elsewhere?

---

## 5. Resource Commitment (10 points)

### Timeline Commitment (5 points)
- **5 pts**: Can start immediately, 4-week timeline acceptable
- **3 pts**: Can start within 2 weeks
- **0 pts**: Timeline uncertain or > 1 month to start

### Feedback Commitment (5 points)
- **5 pts**: Will provide detailed feedback, surveys, case study
- **3 pts**: Will provide basic feedback
- **0 pts**: Limited feedback commitment

**Questions to Ask**:
1. When can you start the pilot?
2. Can you commit to weekly check-ins?
3. Will you provide feedback surveys?
4. Would you be open to a case study?

---

## Candidate Partners

### Priority 1: POS Systems

**KiotViet**
- **Use Case**: Sync orders & inventory between Bella & KiotViet
- **Scopes**: `order:read`, `order:write`, `pos:sync`, `product:read`
- **Market**: 50,000+ retail customers in Vietnam
- **Bella Overlap**: 50+ spas using both systems
- **Technical**: Strong API team, multiple integrations
- **Risk**: Medium (read-write, financial impact)
- **Estimated Score**: 85/100 ⭐

**MISA**
- **Use Case**: Sync invoices & accounting data
- **Scopes**: `invoice:read`, `order:read`, `analytics:read`
- **Market**: Leading accounting software in Vietnam
- **Bella Overlap**: 30+ spas using both systems
- **Technical**: Experienced API team
- **Risk**: Medium (financial data)
- **Estimated Score**: 80/100 ⭐

**Sapo**
- **Use Case**: Omnichannel retail integration
- **Scopes**: `order:read`, `order:write`, `customer:read`, `product:read`
- **Market**: Growing POS platform
- **Bella Overlap**: 10+ spas
- **Technical**: Modern tech stack
- **Risk**: Medium
- **Estimated Score**: 75/100

---

### Priority 2: Payment Gateways

**Casso**
- **Use Case**: Auto-match bank transactions to orders
- **Scopes**: `payment:read`, `payment:write`, `webhook:subscribe`
- **Market**: Popular bank reconciliation tool
- **Bella Overlap**: 100+ spas using Casso
- **Technical**: Strong webhook integration experience
- **Risk**: High (financial data)
- **Estimated Score**: 90/100 ⭐⭐⭐

**SePay / PayOS**
- **Use Case**: Payment gateway integration
- **Scopes**: `payment:read`, `payment:write`, `order:read`
- **Market**: Growing payment solutions
- **Bella Overlap**: 20+ spas
- **Technical**: API-first company
- **Risk**: High (financial transactions)
- **Estimated Score**: 75/100

---

### Priority 3: Internal Bella Team

**Bella POS Mobile App**
- **Use Case**: Test API for internal mobile app
- **Scopes**: All scopes (unlimited tier)
- **Market**: Internal use, future customer-facing
- **Bella Overlap**: 100%
- **Technical**: Full control, existing knowledge
- **Risk**: Low (internal testing)
- **Estimated Score**: 95/100 ⭐⭐⭐

---

## Recommended Selection

### Phase 1 (Week 1-4): Internal Testing
**Partner**: Bella Mobile App Team  
**Rationale**: 
- Zero risk (internal)
- Full control
- Fast feedback loop
- Test all endpoints
- Validate documentation

**Goals**:
- Verify API works end-to-end
- Test all endpoints thoroughly
- Identify documentation gaps
- Fix critical bugs
- Validate performance

---

### Phase 2 (Week 5-8): External Pilot #1
**Partner**: Casso (Payment Reconciliation)  
**Rationale**:
- Highest score (90/100)
- Large market (100+ Bella customers)
- Clear, well-defined use case
- Read-heavy integration (lower risk initially)
- Strong technical team
- Existing partnership

**Scopes**: `payment:read`, `webhook:subscribe` (read-only first)

**Goals**:
- Validate webhook system
- Test high-volume webhook delivery
- Collect external partner feedback
- Prove value to real customers

---

### Phase 3 (Week 9-12): External Pilot #2
**Partner**: KiotViet (POS Integration)  
**Rationale**:
- High score (85/100)
- Strategic partnership
- Large market opportunity
- Read-write integration (more complex)
- Tests bi-directional sync

**Scopes**: `order:read`, `order:write`, `product:read`, `pos:sync`

**Goals**:
- Validate write operations
- Test order creation flow
- Validate tenant isolation with real data
- Test rate limiting under load

---

## Selection Process

### Step 1: Initial Outreach

**Email Template**:
```
Subject: Invitation: Bella ERP API Pilot Program

Hi [Partner Name],

We're launching a new Partner API for Bella ERP and would love to have [Company] as a pilot partner.

WHAT WE'RE BUILDING:
A REST API that enables deep integrations between Bella ERP and partner systems. Use cases include:
- Order synchronization
- Payment reconciliation
- Customer data sync
- Real-time webhooks

WHY [COMPANY]:
- [Specific reason why they're a good fit]
- [Number] Bella customers already use both systems
- Your expertise in [domain] would provide valuable feedback

WHAT'S IN IT FOR YOU:
- Early access before public launch
- Free Pro tier for 3 months ($149/month value)
- Priority support & dedicated integration team
- Co-marketing opportunities (case study, press release)
- Influence the API roadmap

COMMITMENT:
- 4-week pilot program
- 10-20 hours total time investment
- Weekly 30-min sync calls
- Feedback surveys

Interested? Let's schedule a 15-min intro call.

Best regards,
[Your Name]
```

### Step 2: Screening Call (15 min)

**Agenda**:
1. Introduce Bella ERP API
2. Understand partner's use case
3. Assess technical capability
4. Gauge interest & commitment
5. Answer questions
6. Next steps

**Go/No-Go Decision**:
- **Go**: Schedule kickoff meeting, send evaluation form
- **No-Go**: Thank them, keep in touch for public launch

### Step 3: Evaluation Form

Partner completes written evaluation:
- Company & contact info
- Technical team details
- Use case description
- Timeline availability
- References (other APIs integrated)
- NDA signed

### Step 4: Internal Review

Bella team scores candidate using matrix above:
- Calculate total score
- Discuss risks & concerns
- Make final decision
- Prioritize if multiple candidates

### Step 5: Selection Notification

**Accepted**:
```
Subject: Welcome to Bella ERP API Pilot Program!

Hi [Partner],

Great news! We'd love to have [Company] as a pilot partner for the Bella ERP API.

NEXT STEPS:
1. Kickoff Meeting: [Date/Time] (calendar invite attached)
2. NDA: Please sign attached NDA
3. Onboarding: You'll receive access details after kickoff

PREPARATION:
- Review attached API documentation
- Identify 1-2 developers for the integration
- Prepare questions for kickoff meeting

Looking forward to working together!
```

**Declined**:
```
Subject: Bella ERP API - Public Launch Coming Soon

Hi [Partner],

Thanks for your interest in the Bella ERP API pilot program.

We've selected partners for this round, but we'd love to work with you when we launch publicly in [Timeframe].

We'll keep you updated on:
- Public launch date
- API capabilities
- Integration opportunities

Stay tuned!
```

---

## Red Flags 🚩

Avoid partners with these characteristics:

### Technical Red Flags
- ❌ No dedicated technical resource
- ❌ No API experience
- ❌ Unrealistic timeline expectations
- ❌ No testing environment
- ❌ Poor code quality (if reviewed)

### Business Red Flags
- ❌ Unclear use case
- ❌ No commitment to timeline
- ❌ Unresponsive communication
- ❌ Unreasonable demands
- ❌ Unwilling to sign NDA

### Risk Red Flags
- ❌ Mission-critical integration without rollback plan
- ❌ Handling sensitive data without security plan
- ❌ Production-only testing (no sandbox)
- ❌ No error handling strategy
- ❌ Cannot commit to 4-week timeline

---

## Success Metrics

Track these metrics for each pilot partner:

### Engagement Metrics
- Response time to communications
- Meeting attendance rate
- Feedback survey completion
- Documentation feedback provided

### Technical Metrics
- Time to first API call
- Time to integration complete
- Number of issues reported
- Issue resolution time
- API calls per day
- Error rate

### Satisfaction Metrics
- Mid-pilot satisfaction score (1-5)
- Final satisfaction score (1-5)
- Net Promoter Score (NPS)
- Willingness to provide reference
- Willingness for case study

### Business Metrics
- Number of Bella customers benefiting
- Revenue impact (if measurable)
- Time saved (if measurable)
- Partnership tier upgrade

---

## Conclusion

Selecting the right pilot partners is critical for API success. Follow this guide to:
1. Evaluate candidates objectively
2. Minimize risk
3. Maximize learning
4. Build strong case studies
5. Ensure successful public launch

**Remember**: Quality over quantity. One excellent pilot partner is better than three mediocre ones.

---

**Document Owner**: API Product Manager  
**Last Updated**: 2026-06-18  
**Version**: 1.0
