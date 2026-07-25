# Commission System - Post-Deployment Monitoring Plan

> **Duration:** First 2 weeks intensive, then ongoing  
> **Version:** 1.0.0  
> **Last Updated:** 22/06/2026

---

## 1. Monitoring Overview

### Objectives
- Detect issues before users report them
- Ensure commission calculations accurate
- Monitor performance and scalability
- Track user adoption and satisfaction
- Identify optimization opportunities

### Monitoring Periods

**Week 1 (Days 1-7): Intensive Monitoring**
- Every 2 hours: Error logs review
- Every 4 hours: Performance metrics
- Daily: User feedback collection
- Daily: Adoption metrics

**Week 2 (Days 8-14): Regular Monitoring**
- Twice daily: Error logs
- Daily: Performance metrics
- Every 2 days: User feedback
- Weekly: Adoption report

**Month 1+ (Days 15+): Ongoing Monitoring**
- Daily: Automated alerts only
- Weekly: Performance review
- Monthly: Comprehensive report

---

## 2. Technical Monitoring

### 2.1. Error Monitoring

#### Critical Errors (Immediate Alert)
```sql
-- Salary calculation failures
SELECT COUNT(*) 
FROM application_logs 
WHERE level = 'ERROR' 
AND message LIKE '%salary%calculation%failed%'
AND created_at > NOW() - INTERVAL '5 minutes';
-- Alert if: > 0

-- Commission calculation failures
SELECT COUNT(*) 
FROM application_logs 
WHERE level = 'ERROR' 
AND message LIKE '%commission%calculation%'
AND created_at > NOW() - INTERVAL '5 minutes';
-- Alert if: > 0

-- RLS policy violations
SELECT COUNT(*) 
FROM application_logs 
WHERE level = 'ERROR' 
AND message LIKE '%permission%denied%'
AND created_at > NOW() - INTERVAL '5 minutes';
-- Alert if: > 5
```

**Alert Channels:**
- Slack: #prod-alerts
- PagerDuty: On-call engineer
- Email: tech-lead@bella-erp.vn

#### High Priority Errors (Alert within 15 min)
- Database query timeouts
- API 500 errors
- Commission not showing
- Salary recalculation stuck

#### Medium Priority Errors (Alert within 1 hour)
- Slow query warnings (> 2s)
- UI component errors
- Export CSV failures
- Cache miss rate high

### 2.2. Performance Monitoring

#### Key Metrics & Thresholds

| Metric | Target | Warning | Critical |
|--------|--------|---------|----------|
| API Response Time (p95) | < 500ms | > 1s | > 2s |
| Salary Calc Time (per KTV) | < 5s | > 10s | > 15s |
| Database CPU Usage | < 60% | > 80% | > 90% |
| Database Connections | < 70% | > 85% | > 95% |
| Page Load Time (p95) | < 3s | > 5s | > 10s |
| Error Rate | < 0.5% | > 1% | > 2% |

#### Performance Queries

```sql
-- Slow salary calculations (> 10s)
SELECT 
  ktv_id, 
  month, 
  calculation_time_ms,
  created_at
FROM salary_calculation_logs
WHERE calculation_time_ms > 10000
AND created_at > NOW() - INTERVAL '1 hour'
ORDER BY calculation_time_ms DESC
LIMIT 20;

-- Slow commission queries
SELECT 
  query_text,
  total_time,
  calls,
  mean_time
FROM pg_stat_statements
WHERE query_text LIKE '%booking_service_items%'
   OR query_text LIKE '%product_sales%'
ORDER BY total_time DESC
LIMIT 10;

-- Database locks and deadlocks
SELECT COUNT(*) 
FROM pg_stat_activity 
WHERE state = 'idle in transaction'
AND now() - query_start > INTERVAL '30 seconds';
-- Alert if: > 5
```

### 2.3. Security Monitoring

#### Tenant Isolation Checks

```sql
-- Check for cross-tenant queries (should be 0)
SELECT COUNT(*) 
FROM application_logs 
WHERE message LIKE '%tenant%mismatch%'
AND created_at > NOW() - INTERVAL '1 hour';
-- Alert if: > 0

-- RLS policy bypass attempts
SELECT COUNT(*) 
FROM application_logs 
WHERE message LIKE '%RLS%bypass%'
AND created_at > NOW() - INTERVAL '1 hour';
-- Alert if: > 0

-- Unauthorized access attempts
SELECT COUNT(*) 
FROM application_logs 
WHERE level = 'WARN' 
AND message LIKE '%unauthorized%access%'
AND created_at > NOW() - INTERVAL '1 hour';
-- Alert if: > 10
```

### 2.4. Data Integrity Monitoring

#### Daily Data Integrity Checks (Run at 2 AM)

```sql
-- Orphaned service items (no booking)
SELECT COUNT(*) FROM booking_service_items bsi
LEFT JOIN bookings b ON bsi.booking_id = b.id
WHERE b.id IS NULL;
-- Alert if: > 0

-- Service items without commission
SELECT COUNT(*) FROM booking_service_items
WHERE commission_value IS NULL
AND created_at < NOW() - INTERVAL '1 day';
-- Alert if: > 10

-- Negative commissions (invalid)
SELECT COUNT(*) FROM booking_service_items
WHERE commission_value < 0;
-- Alert if: > 0

-- Salary totals inconsistency
SELECT COUNT(*) FROM salary_records
WHERE total_salary < base_salary
OR total_salary > (base_salary * 10);  -- Sanity check
-- Alert if: > 5

-- Product sales without KTV
SELECT COUNT(*) FROM product_sales
WHERE ktv_id IS NULL
AND created_at > NOW() - INTERVAL '7 days';
-- Alert if: > 20
```

---

## 3. Business Metrics Monitoring

### 3.1. Adoption Metrics

#### Daily Tracking

```sql
-- Commission calculations per day
SELECT 
  DATE(created_at) as date,
  COUNT(*) as total_calculations,
  COUNT(DISTINCT ktv_id) as unique_ktv,
  AVG(total_salary) as avg_salary
FROM salary_records
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Service items created per day
SELECT 
  DATE(created_at) as date,
  COUNT(*) as total_items,
  SUM(commission_value) as total_commission,
  AVG(commission_value) as avg_commission
FROM booking_service_items
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Product sales per day
SELECT 
  DATE(sale_date) as date,
  COUNT(*) as total_sales,
  SUM(commission_value) as total_commission
FROM product_sales
WHERE sale_date >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY DATE(sale_date)
ORDER BY date DESC;

-- Manual adjustments per day
SELECT 
  DATE(created_at) as date,
  COUNT(*) as total_adjustments,
  SUM(CASE WHEN type='bonus' THEN amount ELSE 0 END) as total_bonuses,
  SUM(CASE WHEN type='deduction' THEN amount ELSE 0 END) as total_deductions
FROM salary_adjustments
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

#### Adoption Targets (Month 1)

| Metric | Week 1 | Week 2 | Week 4 | Target |
|--------|--------|--------|--------|--------|
| % KTV viewing salary | 40% | 60% | 80% | 80%+ |
| % Bookings with service items | 30% | 50% | 70% | 70%+ |
| Avg commission per KTV | Baseline | +10% | +20% | +20% |
| Manual adjustments usage | 10/month | 30/month | 50/month | Active use |


### 3.2. User Satisfaction Tracking

#### Feedback Collection Methods

**In-App Surveys**
- Trigger: After first salary view with commission
- Questions:
  1. "Bạn có dễ dàng hiểu bảng lương mới không?" (1-5 sao)
  2. "Hoa hồng có được tính chính xác không?" (Có/Không)
  3. "Bạn muốn cải thiện gì?" (Text field)

**Support Ticket Analysis**
- Track tickets related to commission system
- Categorize by type:
  - Commission not showing
  - Calculation incorrect
  - UI confusion
  - Feature requests
- Target: < 20 tickets in Month 1

**Direct Feedback Sessions**
- Week 1: Interview 5 KTV users
- Week 2: Interview 3 Admin users
- Week 4: Focus group (10 users)

#### User Satisfaction Metrics

| Metric | Target | Status |
|--------|--------|--------|
| Overall satisfaction (1-5) | ≥ 4.0 | ___ |
| Feature clarity (1-5) | ≥ 4.0 | ___ |
| Calculation accuracy (%) | ≥ 95% | ___ |
| Would recommend (NPS) | ≥ 40 | ___ |

---

## 4. Dashboard Setup

### 4.1. Real-Time Dashboard (Grafana/Datadog)

**Panels:**

1. **System Health**
   - Error rate (last 1h, 24h, 7d)
   - API response time (p50, p95, p99)
   - Database CPU/Memory
   - Active connections

2. **Commission Calculations**
   - Calculations per hour (line chart)
   - Average calculation time (gauge)
   - Failed calculations (counter)
   - Top 10 slowest calculations (table)

3. **User Activity**
   - Active users (last 5 min)
   - Page views (commission pages)
   - Salary views per hour
   - Export requests per hour

4. **Business Metrics**
   - Total commission paid today
   - Avg commission per KTV
   - Service items created today
   - Product sales today

5. **Alerts Status**
   - Active alerts (critical, high, medium)
   - Alert history (last 24h)
   - Mean time to resolve (MTTR)

### 4.2. Daily Summary Email

**Recipients:**
- Tech Lead
- Product Owner
- CTO

**Content Template:**

```
📊 Commission System - Daily Summary

Date: {DATE}

✅ HEALTH STATUS: {HEALTHY | WARNING | CRITICAL}

📈 KEY METRICS (24h)
- Commission calculations: {COUNT}
- Avg calc time: {TIME}s
- Error rate: {RATE}%
- Active users: {COUNT}

🐛 ISSUES (24h)
- Critical errors: {COUNT}
- High priority errors: {COUNT}
- Support tickets: {COUNT}

💰 BUSINESS METRICS
- Total commission paid: {AMOUNT} VND
- Avg commission per KTV: {AMOUNT} VND
- Service items: {COUNT}
- Product sales: {COUNT}

🔔 ALERTS
{LIST_OF_ACTIVE_ALERTS}

📝 ACTIONS NEEDED
{LIST_OF_PENDING_ACTIONS}

---
View full dashboard: https://monitor.bella-erp.vn/commission
```

---

## 5. Alert Configuration

### 5.1. Critical Alerts (Immediate)

```yaml
- name: "Commission Calculation Failed"
  query: "SELECT COUNT(*) FROM logs WHERE level='ERROR' AND message LIKE '%commission%calc%failed%' AND created_at > NOW() - INTERVAL '5 minutes'"
  threshold: "> 0"
  channels: ["slack", "pagerduty", "email"]
  
- name: "Salary Recalculation Stuck"
  query: "SELECT COUNT(*) FROM salary_calculation_queue WHERE status='processing' AND started_at < NOW() - INTERVAL '15 minutes'"
  threshold: "> 0"
  channels: ["slack", "pagerduty"]

- name: "Tenant Data Leakage"
  query: "SELECT COUNT(*) FROM logs WHERE message LIKE '%tenant%mismatch%' AND created_at > NOW() - INTERVAL '5 minutes'"
  threshold: "> 0"
  channels: ["slack", "pagerduty", "email-cto"]

- name: "Database CPU Critical"
  query: "SELECT cpu_usage FROM db_metrics ORDER BY timestamp DESC LIMIT 1"
  threshold: "> 90"
  channels: ["slack", "pagerduty"]

- name: "High Error Rate"
  query: "SELECT (errors::float / total_requests) * 100 FROM request_stats WHERE timestamp > NOW() - INTERVAL '5 minutes'"
  threshold: "> 2"
  channels: ["slack", "pagerduty"]
```

### 5.2. High Priority Alerts (15 min)

```yaml
- name: "Slow Commission Queries"
  query: "SELECT AVG(duration_ms) FROM query_logs WHERE query_type='commission' AND created_at > NOW() - INTERVAL '15 minutes'"
  threshold: "> 2000"
  channels: ["slack"]

- name: "Commission Not Showing"
  query: "SELECT COUNT(*) FROM support_tickets WHERE category='commission' AND priority='high' AND created_at > NOW() - INTERVAL '1 hour'"
  threshold: "> 3"
  channels: ["slack", "email"]

- name: "Export CSV Failures"
  query: "SELECT COUNT(*) FROM logs WHERE level='ERROR' AND message LIKE '%export%csv%failed%' AND created_at > NOW() - INTERVAL '15 minutes'"
  threshold: "> 5"
  channels: ["slack"]
```

### 5.3. Medium Priority Alerts (1 hour)

```yaml
- name: "Data Integrity Issues"
  query: "SELECT COUNT(*) FROM data_integrity_checks WHERE status='failed' AND checked_at > NOW() - INTERVAL '1 hour'"
  threshold: "> 10"
  channels: ["slack"]

- name: "Low Adoption Rate"
  query: "SELECT (active_users::float / total_users) * 100 FROM user_stats WHERE date = CURRENT_DATE"
  threshold: "< 40"  # Week 1 target
  channels: ["email"]
```

---

## 6. Weekly Reports

### Week 1 Report Template

```markdown
# Commission System - Week 1 Report

**Period:** {START_DATE} - {END_DATE}

## Executive Summary
{2-3 sentence summary of the week}

## Key Metrics

### Technical Health
- Uptime: ___%
- Error rate: ___%
- Avg response time: ___ms
- Critical incidents: ___

### Business Performance
- Commission calculations: ___
- Total commission paid: ___ VND
- Active KTV: ___ (___%)
- Service items created: ___
- Product sales: ___

### User Satisfaction
- Overall rating: ___ / 5
- Support tickets: ___
- Common feedback: {LIST}

## Issues & Resolutions

### Critical Issues
1. {ISSUE} - {RESOLUTION} - {DURATION}
2. ...

### High Priority Issues
1. {ISSUE} - {RESOLUTION}
2. ...

## Insights & Trends

### Positive
- {POSITIVE_INSIGHT_1}
- {POSITIVE_INSIGHT_2}

### Areas for Improvement
- {IMPROVEMENT_1}
- {IMPROVEMENT_2}

## Action Items for Week 2
- [ ] {ACTION_1}
- [ ] {ACTION_2}
- [ ] {ACTION_3}

## Recommendations
{STRATEGIC_RECOMMENDATIONS}

---
*Generated: {TIMESTAMP}*
*Report by: {AUTHOR}*
```

---

## 7. Support Plan

### 7.1. Dedicated Support Channel

**Slack Channel:** `#commission-system-support`

**Members:**
- Development team
- Support team
- Product owner

**SLA:**
- P0 (Critical): < 15 min response
- P1 (High): < 1 hour response
- P2 (Medium): < 4 hours response
- P3 (Low): < 24 hours response

### 7.2. Support Runbook

**Common Issues & Solutions**

| Issue | Symptoms | Quick Fix | Escalate If |
|-------|----------|-----------|-------------|
| Commission not showing | KTV sees 0 commission | Check service item exists, Check completion status | Data actually missing |
| Calculation incorrect | Wrong amount | Run recalculation script | Persistent after recalc |
| Salary view error | UI crashes | Clear cache, Refresh page | Affects multiple users |
| Export CSV fails | Timeout error | Reduce date range | Database issue |
| Permission denied | Cannot access page | Check user role, Check RLS | Widespread issue |

**Escalation Process:**
1. Support agent tries quick fix (5 min)
2. If not resolved → Escalate to dev team
3. Dev investigates (15 min)
4. If critical → Page on-call engineer
5. Track in incident log

### 7.3. FAQ Updates

Update FAQ based on support tickets:

**Week 1:**
- Collect all questions from tickets
- Create FAQ entries
- Publish to help center

**Week 2+:**
- Review weekly
- Add new questions
- Update answers

---

## 8. Success Criteria

### Week 1 Success (Must Achieve)
- [x] Zero critical incidents
- [x] Error rate < 1%
- [x] Avg response time < 1s
- [x] No rollback required
- [x] At least 40% KTV adoption
- [x] User satisfaction ≥ 3.5/5

### Week 2 Success (Should Achieve)
- [x] Error rate < 0.5%
- [x] Avg response time < 500ms
- [x] At least 60% KTV adoption
- [x] User satisfaction ≥ 4.0/5
- [x] < 15 support tickets

### Month 1 Success (Target)
- [x] Uptime 99.9%+
- [x] Error rate < 0.5%
- [x] 80%+ KTV adoption
- [x] User satisfaction ≥ 4.0/5
- [x] Commission accuracy 99%+
- [x] < 20 total support tickets

---

## 9. Continuous Improvement

### Performance Optimization

**If response time > target:**
1. Identify slow queries via `pg_stat_statements`
2. Add missing indexes
3. Optimize query logic
4. Consider caching strategy

**If calculation time > target:**
1. Profile calculation code
2. Identify bottlenecks
3. Optimize algorithms
4. Consider async processing

### Feature Enhancements

**Based on feedback:**
- Week 3-4: Plan quick wins
- Month 2: Implement enhancements
- Month 3: Launch v1.1

**Potential enhancements:**
- Commission history chart
- Prediction of next month commission
- Commission comparison with peers
- Mobile app improvements

---

## 10. Monitoring Schedule

### Week 1 (Intensive)

| Time | Activity | Owner |
|------|----------|-------|
| 08:00 | Review overnight logs | Engineer |
| 10:00 | Check performance metrics | Engineer |
| 12:00 | Review error logs | Engineer |
| 14:00 | Check performance metrics | Engineer |
| 16:00 | Review error logs | Engineer |
| 18:00 | Check performance metrics | Engineer |
| 20:00 | Review daily summary | Tech Lead |

### Week 2 (Regular)

| Time | Activity | Owner |
|------|----------|-------|
| 09:00 | Review overnight logs | Engineer |
| 15:00 | Check metrics & logs | Engineer |
| 20:00 | Review daily summary | Tech Lead |

### Month 1+ (Ongoing)

| Time | Activity | Owner |
|------|----------|-------|
| Daily 09:00 | Review alerts only | Engineer |
| Weekly Fri 16:00 | Performance review | Tech Lead |
| Monthly 1st | Comprehensive report | Product Owner |

---

**Contact Information:**

**On-Call Engineer:** +84-xxx-xxx-xxx  
**Tech Lead:** tech-lead@bella-erp.vn  
**Product Owner:** product@bella-erp.vn  
**Emergency Hotline:** 1900-xxxx

---

*Monitoring Plan Version: 1.0.0*  
*Last Updated: 22/06/2026*
