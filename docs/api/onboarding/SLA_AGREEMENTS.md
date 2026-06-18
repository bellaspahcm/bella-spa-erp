# SLA Agreements & Service Tiers
*Bella API Gateway - Service Level Commitments*

Last Updated: 2026-06-19

---

## 📋 Overview

This document defines the Service Level Agreements (SLAs) for Bella API Gateway partners. Our SLA tiers are designed to provide appropriate service levels based on partner integration criticality and business needs.

---

## 🎯 SLA Tiers

Bella API Gateway offers **5 service tiers** with increasing levels of support, rate limits, and uptime guarantees:

| Tier | Best For | Monthly Fee | Rate Limit | Uptime SLA | Support |
|------|----------|-------------|------------|------------|---------|
| **Free** | Testing, POCs | $0 | 100 req/hour | 95% | Community |
| **Startup** | Small integrations | $49 | 1,000 req/hour | 99% | Email (8h) |
| **Business** | Production apps | $199 | 5,000 req/hour | 99.5% | Email (4h) |
| **Professional** | High-volume apps | $499 | 20,000 req/hour | 99.9% | Email (2h) + Phone |
| **Enterprise** | Mission-critical | Custom | Unlimited | 99.95% | 24/7 Dedicated |

---

## Tier 1: Free (Sandbox Only)

### Purpose
- Evaluation and proof-of-concept
- Development and testing
- Non-production use

### Included Features
- ✅ Full API access (all endpoints)
- ✅ Sandbox environment with demo data
- ✅ Documentation access
- ✅ Community forum support
- ✅ Basic webhook delivery (5 retries)

### Limitations
- ❌ No production access
- ❌ Data reset every 7 days
- ❌ No uptime guarantee
- ❌ No dedicated support
- ❌ Limited to 3 team members

### Rate Limits
- **100 requests/hour**
- **1,000 requests/month**
- Burst: 10 requests/second (short peaks)

### Support
- **Channel**: Community forum only
- **Response Time**: Best effort (usually 3-5 business days)
- **Availability**: Monday-Friday, 9 AM - 6 PM GMT+7

### Upgrade Path
Once ready for production, must upgrade to **Startup** tier minimum.

---

## Tier 2: Startup

### Purpose
- Small businesses with light integration needs
- Pilot programs
- Low-volume production use

### Included Features
- ✅ Production API access
- ✅ Sandbox environment
- ✅ **99% uptime guarantee**
- ✅ Email support
- ✅ API key rotation
- ✅ Basic monitoring dashboard
- ✅ Webhook delivery (10 retries)
- ✅ Up to 5 team members

### Rate Limits
- **1,000 requests/hour** (42 req/minute)
- **50,000 requests/month**
- Burst: 20 requests/second
- Webhook: 500 deliveries/day

### Support
- **Channel**: Email (api-support@bellaspa.vn)
- **Response Time**: < 8 hours (business hours)
- **Availability**: Monday-Friday, 9 AM - 6 PM GMT+7
- **SLA**: 99% uptime

### Monitoring & Reporting
- Weekly usage summary email
- Monthly invoice with usage breakdown
- Access to partner admin dashboard

### Cost
- **Base Fee**: $49/month (billed monthly)
- **Overage**: $0.01 per additional request beyond quota
- **Contract**: Monthly (no commitment)

---

## Tier 3: Business

### Purpose
- Growing businesses with moderate integration traffic
- Standard production deployments
- Most common tier for partners

### Included Features
- ✅ Production API access
- ✅ Sandbox environment
- ✅ **99.5% uptime guarantee**
- ✅ Priority email support
- ✅ Advanced monitoring dashboard
- ✅ Webhook delivery (15 retries with exponential backoff)
- ✅ API key rotation with scheduling
- ✅ Custom rate limit configuration
- ✅ Up to 10 team members
- ✅ Quarterly business reviews (QBR)

### Rate Limits
- **5,000 requests/hour** (83 req/minute)
- **300,000 requests/month**
- Burst: 50 requests/second
- Webhook: 2,000 deliveries/day

### Support
- **Channel**: Email + Slack channel (by invitation)
- **Response Time**: 
  - P1 (Critical): < 2 hours
  - P2 (High): < 4 hours
  - P3 (Medium): < 8 hours
  - P4 (Low): < 1 business day
- **Availability**: Monday-Friday, 9 AM - 6 PM GMT+7
- **SLA**: 99.5% uptime (< 3.6 hours downtime/month)

### Monitoring & Reporting
- Real-time usage dashboard
- Weekly health reports
- Monthly business review reports
- SLA compliance tracking

### Cost
- **Base Fee**: $199/month (billed monthly or annually)
- **Annual Discount**: $1,990/year (save $398, ~17% off)
- **Overage**: $0.005 per additional request beyond quota
- **Contract**: 1-month minimum (monthly billing) or 12-month (annual billing)

---

## Tier 4: Professional

### Purpose
- High-volume integrations
- Business-critical applications
- Partners with demanding SLA requirements

### Included Features
- ✅ Production API access
- ✅ Dedicated sandbox environment (isolated infrastructure)
- ✅ **99.9% uptime guarantee**
- ✅ Priority multi-channel support (Email + Slack + Phone)
- ✅ Advanced webhook delivery (25 retries, custom retry policy)
- ✅ API key rotation automation with alert notifications
- ✅ Custom rate limit tuning per endpoint
- ✅ White-label webhook domain (optional)
- ✅ Up to 25 team members
- ✅ Monthly business reviews (QBR)
- ✅ Dedicated Technical Account Manager (TAM)
- ✅ Beta access to new features

### Rate Limits
- **20,000 requests/hour** (333 req/minute)
- **1,500,000 requests/month**
- Burst: 100 requests/second
- Webhook: 10,000 deliveries/day
- **Custom quotas available upon request**

### Support
- **Channels**: 
  - Email (priority queue)
  - Dedicated Slack channel
  - Phone hotline (business hours)
  - Video call support (scheduled)
- **Response Time**:
  - P1 (Critical): < 1 hour
  - P2 (High): < 2 hours
  - P3 (Medium): < 4 hours
  - P4 (Low): < 8 hours
- **Availability**: 
  - Email/Slack: 24/7
  - Phone: Monday-Friday, 8 AM - 8 PM GMT+7
- **SLA**: 99.9% uptime (< 43 minutes downtime/month)

### Monitoring & Reporting
- Real-time usage dashboard with custom metrics
- Daily health reports
- Weekly performance analysis
- Monthly business review with TAM
- SLA compliance reports (monthly)
- Incident postmortems (if applicable)

### Additional Services Included
- Integration consultation (up to 10 hours/quarter)
- Performance optimization reviews
- Custom integration development assistance
- Priority feature requests consideration
- Early access to beta features

### Cost
- **Base Fee**: $499/month (billed monthly or annually)
- **Annual Discount**: $4,990/year (save $998, ~17% off)
- **Overage**: $0.002 per additional request beyond quota
- **Contract**: 3-month minimum (monthly billing) or 12-month (annual billing)

---

## Tier 5: Enterprise

### Purpose
- Mission-critical integrations with zero-tolerance for downtime
- Large-scale partners processing millions of requests
- White-label or co-branded solutions
- Custom contractual requirements

### Included Features
- ✅ **Everything in Professional tier, plus:**
- ✅ **99.95% uptime guarantee** (SLA with financial penalties)
- ✅ Dedicated infrastructure (isolated database, cache, workers)
- ✅ Custom API endpoint domain (e.g., `api.yourcompany.com`)
- ✅ **24/7/365 support** with guaranteed 30-minute response
- ✅ Dedicated Technical Account Manager (TAM)
- ✅ Dedicated Solutions Architect
- ✅ Unlimited team members
- ✅ Custom webhook retry policies
- ✅ Priority bug fixes and feature development
- ✅ Annual on-site visit (Vietnam or partner location)
- ✅ Legal contract customization
- ✅ White-label API documentation (branded)
- ✅ Co-marketing opportunities

### Rate Limits
- **Unlimited API requests** (fair use policy applies)
- **Unlimited webhook deliveries**
- **Custom burst handling** (up to 1,000 req/second)
- **Dedicated rate limit pools** (isolated from other partners)

### Support
- **Channels**: All channels (Email, Slack, Phone, Video, On-site)
- **Response Time**:
  - P0 (Emergency): < 15 minutes (24/7)
  - P1 (Critical): < 30 minutes (24/7)
  - P2 (High): < 1 hour (24/7)
  - P3 (Medium): < 2 hours (business hours)
  - P4 (Low): < 4 hours (business hours)
- **Availability**: 24/7/365 (including holidays)
- **SLA**: 99.95% uptime (< 22 minutes downtime/month)
- **Dedicated on-call engineer** for P0/P1 incidents

### Monitoring & Reporting
- Custom monitoring dashboards (Grafana, Datadog integration)
- Real-time alerts (PagerDuty, Opsgenie integration)
- Daily automated reports
- Weekly performance reviews with TAM
- Monthly business reviews with executive sponsors
- Quarterly strategic planning sessions
- Annual performance review and roadmap alignment

### Additional Services Included
- **Custom development**: Up to 40 hours/quarter of engineering time
- **Integration consulting**: Unlimited consultation hours
- **Performance tuning**: Quarterly infrastructure optimization reviews
- **Compliance assistance**: SOC 2, ISO 27001, HIPAA support (if applicable)
- **Training**: Quarterly training sessions for partner team
- **Beta/Alpha testing**: Early access to all new features
- **Influence roadmap**: Priority input on feature development

### Cost
- **Starting at**: $2,500/month (custom pricing based on scale)
- **Typical Range**: $2,500 - $10,000/month depending on:
  - Request volume
  - Infrastructure requirements
  - Support level needed
  - Custom feature development
- **Contract**: 12-month minimum
- **Payment Terms**: Annual pre-payment or quarterly invoicing
- **Overage**: Included (true unlimited)

### Custom Negotiation Points
- Multi-year discounts
- Revenue-sharing models
- Equity partnerships (case-by-case)
- Co-development agreements
- Reseller agreements

---

## 🔄 SLA Metrics & Measurement

### 1. Uptime Calculation

**Definition**: Percentage of time the API Gateway is operational and accessible.

**Formula**:
```
Uptime % = (Total Minutes in Month - Downtime Minutes) / Total Minutes in Month × 100
```

**Measurement Window**: Calendar month (first day 00:00 GMT+7 to last day 23:59 GMT+7)

**What Counts as Downtime**:
- ✅ Complete API unavailability (5xx errors for ALL requests)
- ✅ Response time > 10 seconds for more than 5 minutes
- ✅ Database connectivity failures

**What Does NOT Count as Downtime**:
- ❌ Scheduled maintenance (with 72-hour notice)
- ❌ Issues caused by partner's infrastructure
- ❌ DDoS attacks or other malicious activity
- ❌ Force majeure events (natural disasters, war, etc.)
- ❌ Partner-side errors (4xx errors, invalid requests)

---

### 2. Response Time

**Target**:
- **P50 (Median)**: < 200ms
- **P95**: < 500ms
- **P99**: < 1000ms

**Measurement**: Measured at API Gateway level, excludes network latency.

---

### 3. Webhook Delivery Success Rate

**Target**: > 99% successful delivery (within 24 hours, including retries)

**Formula**:
```
Success Rate = (Successful Deliveries) / (Total Webhooks Sent) × 100
```

**Successful Delivery Criteria**:
- Partner endpoint returns 2xx status code
- Within 5-second timeout
- Within 25 retry attempts (Professional+) or 15 retries (Business) or 10 retries (Startup)

---

## 💰 SLA Credits (Service Credits)

If Bella fails to meet the uptime SLA, partners are entitled to **Service Credits** applied to next month's invoice:

| Uptime Achieved | Service Credit |
|-----------------|----------------|
| < 99.95% (Enterprise tier only) | 10% of monthly fee |
| < 99.9% (Professional tier) | 10% of monthly fee |
| < 99.5% (Business tier) | 10% of monthly fee |
| < 99% (Startup tier) | 25% of monthly fee |
| < 95% (any tier) | 50% of monthly fee |
| < 90% (any tier) | 100% of monthly fee |

### Service Credit Rules

1. **Automatic Application**: Credits applied automatically if SLA missed
2. **Maximum Credit**: 100% of monthly base fee (no cash refunds)
3. **Notification**: Partners notified within 5 business days of month-end
4. **Dispute Window**: 30 days to dispute SLA calculation
5. **Exclusions**: Credits do not apply during:
   - Scheduled maintenance windows
   - Force majeure events
   - Partner-caused outages

---

## 📅 Scheduled Maintenance

### Maintenance Windows

**Standard Maintenance**:
- **Frequency**: Monthly
- **Duration**: < 2 hours
- **Window**: Sunday 2:00 AM - 4:00 AM GMT+7 (lowest traffic period)
- **Notice**: 72 hours advance notice via email + status page

**Emergency Maintenance**:
- **Trigger**: Critical security patches, major bugs
- **Notice**: 24 hours (if possible), or as soon as feasible
- **Priority**: Enterprise partners notified first

### Maintenance Notification Channels

1. Email to all technical contacts
2. Status page: https://status.bellaspa.vn
3. Slack notifications (for Slack-enabled partners)
4. SMS (for Enterprise partners with P0/P1 contacts)

---

## 📊 Monitoring & Transparency

### Public Status Page

**URL**: https://status.bellaspa.vn

**Shows**:
- Current system status (Operational / Degraded / Down)
- Historical uptime (90 days)
- Planned maintenance schedule
- Incident history and postmortems

### Partner Dashboard Metrics

Available in partner admin portal (`/dashboard/admin/partners`):

- Real-time request count
- Error rate breakdown (4xx vs 5xx)
- Response time distribution (P50, P95, P99)
- Webhook delivery success rate
- Current rate limit usage
- Quota remaining
- SLA compliance score (monthly)

---

## 🚨 Incident Response

### Severity Levels

| Level | Definition | Example | Target Resolution |
|-------|------------|---------|-------------------|
| **P0** | Complete outage, all partners affected | API gateway down | < 1 hour |
| **P1** | Major feature unavailable, multiple partners affected | Webhook delivery failing | < 4 hours |
| **P2** | Significant degradation, workaround available | Slow response times | < 8 hours |
| **P3** | Minor issue, single partner affected | Rate limit misconfigured | < 24 hours |
| **P4** | Cosmetic issue, no customer impact | UI typo in docs | < 1 week |

### Communication During Incidents

1. **Initial Detection**: Internal monitoring detects issue
2. **+5 min**: Status page updated with "Investigating"
3. **+15 min**: Email blast to affected partners
4. **+30 min**: Slack update (for Slack-enabled partners)
5. **Hourly**: Status updates until resolved
6. **Post-resolution**: Postmortem published within 48 hours (P0/P1 only)

---

## 🔧 Support Channels Summary

| Channel | Free | Startup | Business | Professional | Enterprise |
|---------|------|---------|----------|--------------|------------|
| **Community Forum** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Email Support** | ❌ | ✅ (8h) | ✅ (4h) | ✅ (2h) | ✅ (30min, 24/7) |
| **Slack Channel** | ❌ | ❌ | ✅ | ✅ (Dedicated) | ✅ (Dedicated) |
| **Phone Support** | ❌ | ❌ | ❌ | ✅ (Business hours) | ✅ (24/7) |
| **Video Calls** | ❌ | ❌ | Quarterly | Monthly | Weekly |
| **TAM (Technical Account Manager)** | ❌ | ❌ | ❌ | ✅ | ✅ |
| **Solutions Architect** | ❌ | ❌ | ❌ | ❌ | ✅ |
| **On-site Visits** | ❌ | ❌ | ❌ | ❌ | Annual |

---

## 📈 Tier Upgrade & Downgrade Policy

### Upgrade Process

- **Effective Date**: Immediate (same-day activation)
- **Prorated Billing**: Pay only difference for remainder of billing cycle
- **Rate Limits**: Increased immediately upon upgrade
- **Support**: New support channels activated within 4 hours

### Downgrade Process

- **Effective Date**: End of current billing cycle
- **Notice Required**: 30 days advance notice
- **Data Retention**: Full data retained for 90 days after downgrade
- **Rate Limits**: Reduced at end of billing cycle (grace period: 7 days)

### Tier Evaluation

Bella reserves the right to **require tier upgrades** if:
- Partner consistently exceeds rate limits (3+ months)
- Partner's usage causes infrastructure strain
- Partner's business criticality warrants higher SLA

---

## 📞 Contact for SLA Questions

**Sales & Pricing Inquiries**:  
Email: sales@bellaspa.vn  
Phone: +84 (028) XXXX XXXX

**Technical Support**:  
Email: api-support@bellaspa.vn  
Slack: (by invitation)  
Phone: (Professional and Enterprise tiers only)

**Executive Escalation** (Enterprise only):  
Email: cto@bellaspa.vn

---

## 📚 Related Documents

- [Partner Selection Criteria](./PARTNER_SELECTION_CRITERIA.md)
- [Partner Onboarding Process](./ONBOARDING_PROCESS.md)
- [API Getting Started Guide](../GETTING_STARTED.md)
- [Support Process & Escalation](./SUPPORT_PROCESS.md)

---

*SLA terms are reviewed annually and may be adjusted based on infrastructure improvements and market conditions. Partners will be notified 90 days before any changes.*
