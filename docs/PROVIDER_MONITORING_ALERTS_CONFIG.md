# Provider Monitoring & Alerts Configuration
**Production Monitoring for Payroll, Commission, Inventory Providers**

**Date:** 2026-07-09  
**Status:** 🟡 CONFIGURATION READY  
**Owner:** DevOps Team

---

## 📊 MONITORING OVERVIEW

### Objectives

1. **Detect Issues Early:** Alert before users notice problems
2. **Enable Fast Response:** Auto-rollback when critical thresholds breached
3. **Track Business Impact:** Measure provider value (accuracy, velocity, errors)
4. **Continuous Improvement:** Identify optimization opportunities

### Monitoring Stack

```yaml
Metrics Collection: Prometheus (built-in Next.js metrics)
Visualization: Grafana dashboards
Alerting: PagerDuty + Slack webhooks
Logging: CloudWatch Logs (AWS) / Application Insights (Azure)
Tracing: OpenTelemetry (optional, for deep debugging)
```

---

## 🎯 KEY METRICS TO TRACK

### 1. Accuracy Metrics (CRITICAL)

**Provider Accuracy Rate**
```yaml
Metric: provider_accuracy_rate
Type: Gauge (percentage, 0-100)
Calculation: (correct_calculations / total_calculations) * 100
Target: 100%
Alert Threshold: <99.9%
Measurement Frequency: Real-time (every calculation)

Labels:
  - provider: payroll | commission | inventory
  - ktv_id: employee identifier
  - month_year: calculation period
  
Sample Query (PromQL):
  sum(provider_correct_calculations_total{provider="payroll"}) /
  sum(provider_total_calculations_total{provider="payroll"}) * 100
```

**Calculation Mismatch Count**
```yaml
Metric: provider_mismatch_count
Type: Counter
Increments: When provider result != legacy result
Target: 0
Alert Threshold: >0 (immediate alert)
Action: Auto-rollback + page on-call

Sample Alert:
  CRITICAL: Payroll Provider mismatch detected
  KTV: ktv-123
  Month: 2026-07
  Provider Total: 12,500,000 VND
  Legacy Total: 12,350,000 VND
  Diff: +150,000 VND (+1.2%)
  Action: Feature flag disabled, legacy logic active
```

---

### 2. Performance Metrics

**Decision Latency**
```yaml
Metric: provider_decision_latency_seconds
Type: Histogram
Buckets: [0.001, 0.002, 0.005, 0.010, 0.050, 0.100] (1ms, 2ms, 5ms, 10ms, 50ms, 100ms)
Target: <0.002 (2ms)
Alert Thresholds:
  - P50 > 2ms: Warning
  - P95 > 5ms: Critical (auto-rollback)
  - P99 > 10ms: Critical (auto-rollback)

Labels:
  - provider: payroll | commission | inventory
  - decision_type: reorder | allocation | expiry (inventory only)

Sample Query (PromQL):
  histogram_quantile(0.95,
    sum(rate(provider_decision_latency_seconds_bucket{provider="payroll"}[5m]))
      by (le)
  )
```

**Cache Hit Rate**
```yaml
Metric: provider_cache_hit_rate
Type: Gauge (percentage, 0-100)
Calculation: (cache_hits / total_requests) * 100
Target: >80%
Alert Threshold: <75%
Action: Investigate cache configuration

Labels:
  - provider: payroll | commission | inventory

Sample Query (PromQL):
  sum(provider_cache_hits_total{provider="commission"}) /
  (sum(provider_cache_hits_total{provider="commission"}) +
   sum(provider_cache_misses_total{provider="commission"})) * 100
```

**Throughput**
```yaml
Metric: provider_decisions_per_second
Type: Gauge (decisions/sec)
Calculation: rate(provider_total_calculations_total[1m])
Target: >1000 decisions/sec
Alert Threshold: <500 decisions/sec (degraded performance)

Sample Query (PromQL):
  sum(rate(provider_total_calculations_total{provider="payroll"}[1m]))
```

---

### 3. Error Metrics

**Error Rate**
```yaml
Metric: provider_error_rate
Type: Gauge (percentage, 0-100)
Calculation: (errors / total_requests) * 100
Target: 0%
Alert Threshold: >0.1% (1 error per 1000 requests)
Action: Auto-rollback + page on-call

Labels:
  - provider: payroll | commission | inventory
  - error_type: validation | calculation | database | external_api

Sample Query (PromQL):
  sum(rate(provider_errors_total{provider="commission"}[5m])) /
  sum(rate(provider_total_calculations_total{provider="commission"}[5m])) * 100
```

**Error Count by Type**
```yaml
Metric: provider_errors_total
Type: Counter
Increments: When provider throws error
Labels:
  - provider
  - error_type
  - error_code (e.g., VALIDATION_ERROR, CALCULATION_ERROR, TIMEOUT)

Sample Alert:
  WARNING: Commission Provider validation errors
  Count: 5 in last 5 minutes
  Error: MISSING_INPUT_FIELD (sessions.count)
  Impact: Calculations falling back to legacy
  Action: Review integration code
```

---

### 4. Business Impact Metrics

**Salary Calculation Time**
```yaml
Metric: salary_calculation_duration_seconds
Type: Histogram
Measures: Time from month-end to salary draft ready
Target: <1 hour (automated)
Baseline: 5-7 days (manual)

Labels:
  - calculation_method: provider | legacy
  - status: success | failed
```

**Employee Complaints**
```yaml
Metric: employee_salary_complaints_count
Type: Counter
Increments: When employee disputes salary calculation
Target: 0
Baseline: 2-4 per month (legacy)

Labels:
  - complaint_type: calculation_error | missing_component | late_payment
  - provider_used: true | false
```

**HR Escalations**
```yaml
Metric: hr_salary_escalations_count
Type: Counter
Increments: When salary issue escalated to HR
Target: 0
Baseline: 1-2 per month (legacy)

Labels:
  - escalation_reason: cannot_explain | calculation_dispute | system_error
```

---

## 🔔 ALERT RULES

### Critical Alerts (Immediate Action Required)

**Alert #1: Provider Accuracy Mismatch**
```yaml
alert: ProviderAccuracyMismatch
expr: provider_mismatch_count > 0
for: immediate
severity: critical
annotations:
  summary: "{{ $labels.provider }} Provider calculation mismatch detected"
  description: "Provider result differs from legacy for {{ $labels.ktv_id }}"
actions:
  - Auto-disable feature flag
  - Page on-call engineer
  - Post to #decision-engine-alerts Slack channel
```

**Alert #2: High Error Rate**
```yaml
alert: ProviderHighErrorRate
expr: provider_error_rate > 0.1
for: 5m
severity: critical
annotations:
  summary: "{{ $labels.provider }} Provider error rate exceeds 0.1%"
  description: "{{ $value }}% of calculations failing"
actions:
  - Auto-disable feature flag
  - Page on-call engineer
  - Post to #decision-engine-alerts
```

**Alert #3: Extreme Latency**
```yaml
alert: ProviderExtremeLatency
expr: histogram_quantile(0.95, provider_decision_latency_seconds_bucket) > 0.005
for: 5m
severity: critical
annotations:
  summary: "{{ $labels.provider }} Provider P95 latency > 5ms"
  description: "Performance degraded, P95 = {{ $value }}s"
actions:
  - Auto-disable feature flag
  - Notify DevOps team
  - Investigate performance bottleneck
```

---

### Warning Alerts (Investigate Soon)

**Alert #4: Low Cache Hit Rate**
```yaml
alert: ProviderLowCacheHitRate
expr: provider_cache_hit_rate < 75
for: 15m
severity: warning
annotations:
  summary: "{{ $labels.provider }} Provider cache hit rate below 75%"
  description: "Current rate: {{ $value }}%"
actions:
  - Notify DevOps team (Slack only, no page)
  - Review cache configuration
  - Check Redis availability
```

**Alert #5: Elevated Latency**
```yaml
alert: ProviderElevatedLatency
expr: histogram_quantile(0.50, provider_decision_latency_seconds_bucket) > 0.002
for: 10m
severity: warning
annotations:
  summary: "{{ $labels.provider }} Provider P50 latency > 2ms"
  description: "Median latency = {{ $value }}s"
actions:
  - Notify DevOps team
  - Monitor for 10 minutes
  - If worsens, escalate to critical
```

**Alert #6: Increased Error Count**
```yaml
alert: ProviderIncreasedErrors
expr: rate(provider_errors_total[5m]) > 0
for: 10m
severity: warning
annotations:
  summary: "{{ $labels.provider }} Provider errors detected"
  description: "{{ $value }} errors/sec"
actions:
  - Notify DevOps team
  - Review error logs
  - Identify error pattern
```

---

## 📈 GRAFANA DASHBOARDS

### Dashboard #1: Provider Health Overview

**Panels:**

**Row 1: Status Summary**
- Provider Accuracy Rate (gauge, red if <99.9%)
- Error Rate (gauge, red if >0.1%)
- Cache Hit Rate (gauge, yellow if <80%)
- Current Rollout % (gauge)

**Row 2: Performance**
- Latency P50/P95/P99 (time series, 5min window)
- Throughput (decisions/sec, time series)
- Cache Hits vs Misses (stacked area chart)

**Row 3: Errors & Issues**
- Error Count by Type (bar chart)
- Mismatch Count (time series)
- Error Rate Trend (time series, 1h window)

**Row 4: Business Impact**
- Salary Calculation Time (histogram)
- Employee Complaints (counter)
- HR Escalations (counter)

---

### Dashboard #2: Provider Comparison

**Compares Payroll, Commission, Inventory side-by-side**

**Panels:**
- Accuracy Rate (3 gauges, side-by-side)
- Latency P95 (3 graphs, overlaid)
- Error Rate (3 graphs, stacked)
- Cache Hit Rate (3 gauges)
- Throughput (3 graphs)

**Goal:** Quickly identify which provider is underperforming

---

### Dashboard #3: Rollout Progress

**Tracks gradual rollout from 1% → 100%**

**Panels:**
- Rollout Percentage (gauge + time series)
- Calculations by Method (pie chart: Provider vs Legacy)
- Success Rate by Rollout Stage (table)
- Error Rate Correlation (scatter plot: rollout % vs error rate)

**Goal:** Monitor rollout health, decide Go/No-Go for scale-up

---

## 🔧 IMPLEMENTATION STEPS

### Step 1: Instrument Provider Code

**Add metrics collection to each provider:**

```typescript
// src/lib/decision-engine/providers/payroll/payroll-provider.ts

import { metrics } from '@/lib/observability/metrics';

export class PayrollProvider {
  async evaluate(input: PayrollDecisionInput): Promise<PayrollDecisionOutput> {
    const startTime = performance.now();
    const labels = { provider: 'payroll', ktv_id: input.employeeId };

    try {
      // 1. Increment total calculations counter
      metrics.increment('provider_total_calculations_total', labels);

      // 2. Execute calculation
      const result = await this.calculateSalaryComponents(input);

      // 3. Record latency
      const latency = (performance.now() - startTime) / 1000; // Convert to seconds
      metrics.histogram('provider_decision_latency_seconds', latency, labels);

      // 4. Check cache hit/miss
      if (result.metadata.fromCache) {
        metrics.increment('provider_cache_hits_total', labels);
      } else {
        metrics.increment('provider_cache_misses_total', labels);
      }

      // 5. Compare with legacy (if in pilot)
      if (USE_PAYROLL_PROVIDER && input.metadata.legacyTotal) {
        const matches = Math.abs(result.totalSalary - input.metadata.legacyTotal) < 1000; // 1K VND tolerance
        if (matches) {
          metrics.increment('provider_correct_calculations_total', labels);
        } else {
          metrics.increment('provider_mismatch_count', {
            ...labels,
            provider_total: result.totalSalary,
            legacy_total: input.metadata.legacyTotal,
          });
          
          // Log detailed mismatch
          console.error('[PROVIDER_MISMATCH]', {
            provider: 'payroll',
            ktv_id: input.employeeId,
            month_year: input.monthYear,
            provider_total: result.totalSalary,
            legacy_total: input.metadata.legacyTotal,
            diff: result.totalSalary - input.metadata.legacyTotal,
            components: result.components,
          });
        }
      }

      return result;
    } catch (error) {
      // 6. Record error
      metrics.increment('provider_errors_total', {
        ...labels,
        error_type: error.name,
        error_code: error.code || 'UNKNOWN',
      });

      // 7. Log error details
      console.error('[PROVIDER_ERROR]', {
        provider: 'payroll',
        ktv_id: input.employeeId,
        error: error.message,
        stack: error.stack,
      });

      // 8. Fallback to safe default (non-blocking)
      throw error; // Or return safe default
    }
  }
}
```

---

### Step 2: Create Metrics Library

```typescript
// src/lib/observability/metrics.ts

interface MetricLabels {
  [key: string]: string | number | boolean;
}

class MetricsCollector {
  private counters: Map<string, number> = new Map();
  private histograms: Map<string, number[]> = new Map();
  
  increment(metric: string, labels: MetricLabels = {}, value: number = 1) {
    const key = this.buildKey(metric, labels);
    this.counters.set(key, (this.counters.get(key) || 0) + value);
    
    // Send to monitoring backend (Prometheus, CloudWatch, etc.)
    this.sendToBackend('counter', metric, value, labels);
  }
  
  gauge(metric: string, value: number, labels: MetricLabels = {}) {
    const key = this.buildKey(metric, labels);
    this.counters.set(key, value);
    this.sendToBackend('gauge', metric, value, labels);
  }
  
  histogram(metric: string, value: number, labels: MetricLabels = {}) {
    const key = this.buildKey(metric, labels);
    if (!this.histograms.has(key)) {
      this.histograms.set(key, []);
    }
    this.histograms.get(key)!.push(value);
    this.sendToBackend('histogram', metric, value, labels);
  }
  
  private buildKey(metric: string, labels: MetricLabels): string {
    const labelStr = Object.entries(labels)
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');
    return `${metric}{${labelStr}}`;
  }
  
  private sendToBackend(
    type: 'counter' | 'gauge' | 'histogram',
    metric: string,
    value: number,
    labels: MetricLabels
  ) {
    // Implementation depends on monitoring backend
    // Example: Prometheus Push Gateway, CloudWatch, Application Insights
    
    if (process.env.MONITORING_BACKEND === 'prometheus') {
      // Push to Prometheus
    } else if (process.env.MONITORING_BACKEND === 'cloudwatch') {
      // Push to CloudWatch
    }
    
    // Also log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`[METRIC] ${type} ${metric} = ${value}`, labels);
    }
  }
}

export const metrics = new MetricsCollector();
```

---

### Step 3: Configure Prometheus

```yaml
# prometheus.yml

global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'bella-erp-providers'
    static_configs:
      - targets: ['localhost:3000']  # Next.js app
    metrics_path: '/api/metrics'

rule_files:
  - 'alerts/provider-alerts.yml'

alerting:
  alertmanagers:
    - static_configs:
        - targets: ['localhost:9093']  # Alertmanager
```

---

### Step 4: Configure Alert Rules

```yaml
# alerts/provider-alerts.yml

groups:
  - name: provider_critical_alerts
    interval: 30s
    rules:
      - alert: ProviderAccuracyMismatch
        expr: provider_mismatch_count > 0
        for: 0s  # immediate
        labels:
          severity: critical
          team: decision-engine
        annotations:
          summary: "Provider calculation mismatch detected"
          description: "{{ $labels.provider }} mismatch for {{ $labels.ktv_id }}"
          runbook_url: "https://wiki.company.com/provider-mismatch-runbook"

      - alert: ProviderHighErrorRate
        expr: (rate(provider_errors_total[5m]) / rate(provider_total_calculations_total[5m])) > 0.001
        for: 5m
        labels:
          severity: critical
          team: decision-engine
        annotations:
          summary: "Provider error rate > 0.1%"
          description: "{{ $labels.provider }} error rate = {{ $value | humanizePercentage }}"

      - alert: ProviderExtremeLatency
        expr: histogram_quantile(0.95, rate(provider_decision_latency_seconds_bucket[5m])) > 0.005
        for: 5m
        labels:
          severity: critical
          team: decision-engine
        annotations:
          summary: "Provider P95 latency > 5ms"
          description: "{{ $labels.provider }} P95 = {{ $value }}s"

  - name: provider_warning_alerts
    interval: 1m
    rules:
      - alert: ProviderLowCacheHitRate
        expr: (rate(provider_cache_hits_total[15m]) / (rate(provider_cache_hits_total[15m]) + rate(provider_cache_misses_total[15m]))) < 0.75
        for: 15m
        labels:
          severity: warning
          team: decision-engine
        annotations:
          summary: "Provider cache hit rate < 75%"
          description: "{{ $labels.provider }} cache hit rate = {{ $value | humanizePercentage }}"
```

---

### Step 5: Configure PagerDuty Integration

```yaml
# alertmanager.yml

global:
  resolve_timeout: 5m

route:
  group_by: ['alertname', 'provider']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 12h
  receiver: 'pagerduty-critical'
  routes:
    - match:
        severity: critical
      receiver: 'pagerduty-critical'
    - match:
        severity: warning
      receiver: 'slack-warnings'

receivers:
  - name: 'pagerduty-critical'
    pagerduty_configs:
      - service_key: '<PAGERDUTY_SERVICE_KEY>'
        description: '{{ .CommonAnnotations.summary }}'
        details:
          provider: '{{ .GroupLabels.provider }}'
          alert: '{{ .GroupLabels.alertname }}'
          description: '{{ .CommonAnnotations.description }}'
  
  - name: 'slack-warnings'
    slack_configs:
      - api_url: '<SLACK_WEBHOOK_URL>'
        channel: '#decision-engine-alerts'
        title: '⚠️ Provider Warning'
        text: '{{ .CommonAnnotations.summary }}'
```

---

## ✅ MONITORING CHECKLIST

**Week 31 (Pre-Deployment):**
- [ ] Metrics library implemented (`src/lib/observability/metrics.ts`)
- [ ] Providers instrumented (Payroll, Commission, Inventory)
- [ ] Prometheus configured and running
- [ ] Grafana dashboards created (3 dashboards)
- [ ] Alert rules configured (6 alerts)
- [ ] PagerDuty integration tested
- [ ] Slack webhooks configured
- [ ] Monitoring documentation complete

**Week 32 (Payroll Pilot):**
- [ ] Provider Health dashboard live
- [ ] Accuracy mismatch alerts tested
- [ ] Error rate alerts tested
- [ ] Latency alerts tested
- [ ] Cache hit rate monitoring active
- [ ] Daily metrics review meeting scheduled

**Week 33 (Commission Pilot):**
- [ ] Commission Provider metrics live
- [ ] Provider Comparison dashboard updated
- [ ] Cross-provider correlation analysis running

**Week 34 (Inventory Pilot - if applicable):**
- [ ] Inventory Provider metrics live
- [ ] Reorder recommendation tracking
- [ ] Operations team feedback loop

---

## 📞 ON-CALL PROCEDURES

### On-Call Engineer Responsibilities

**1. Monitor Slack Channel:** #decision-engine-alerts (24/7)

**2. Respond to PagerDuty Pages:** <5 minutes

**3. Escalation Path:**
   - Level 1: On-Call Engineer (initial response)
   - Level 2: Tech Lead (if issue >30 min)
   - Level 3: CTO (if production impact >1 hour)

**4. Runbooks:**
   - Provider Mismatch: `docs/runbooks/provider-mismatch.md`
   - High Error Rate: `docs/runbooks/provider-errors.md`
   - Performance Degradation: `docs/runbooks/provider-latency.md`

---

**Document Status:** ✅ READY FOR IMPLEMENTATION  
**Next Step:** Week 31 - Implement metrics instrumentation  
**Owner:** DevOps Team

