# Intelligence Layer Monitoring Runbook

**Phase 8: Optimization & Production Readiness**  
**Version**: 1.0.0  
**Last Updated**: 2026-06-22  
**Owner**: DevOps Team

---

## Table of Contents

1. [Overview](#overview)
2. [Alert Severities](#alert-severities)
3. [Alert Response Procedures](#alert-response-procedures)
4. [Common Troubleshooting Scenarios](#common-troubleshooting-scenarios)
5. [Escalation Procedures](#escalation-procedures)
6. [Monitoring Stack](#monitoring-stack)
7. [Metrics Reference](#metrics-reference)

---

## Overview

Tài liệu này cung cấp hướng dẫn xử lý sự cố cho các cảnh báo (alerts) của Intelligence Layer.  
Mỗi alert có các bước troubleshooting cụ thể và escalation path rõ ràng.

**Response Time Targets:**
- 🔴 **Critical**: < 15 phút
- 🟠 **Warning**: < 1 giờ
- 🟢 **Info**: < 4 giờ

---

## Alert Severities

| Severity | Response Time | On-Call Required | Example |
|----------|---------------|------------------|---------|
| 🔴 **Critical** | < 15 min | Yes | Forecast accuracy < 60%, API error rate > 10%, MV refresh failed |
| 🟠 **Warning** | < 1 hour | No | Forecast accuracy < 70%, Cache hit rate < 60%, API latency > 500ms |
| 🟢 **Info** | < 4 hours | No | Data freshness > 24h, Connection pool > 80% |

---

## Alert Response Procedures

### 1. ForecastAccuracyCritical / ForecastAccuracyLow

**Alert**: `intelligence_forecast_accuracy < 60` (Critical) hoặc `< 70` (Warning)

**Tác động**:
- Dự báo doanh thu/churn/demand không chính xác
- Ảnh hưởng đến quyết định kinh doanh

**Troubleshooting Steps**:

1. **Check data quality**:
   ```sql
   -- Kiểm tra dữ liệu đầu vào bị thiếu hoặc bất thường
   SELECT 
     forecast_type,
     COUNT(*) AS total_records,
     COUNT(DISTINCT tenant_id) AS tenants,
     MIN(period_start_date) AS min_date,
     MAX(period_end_date) AS max_date
   FROM forecast_results
   WHERE created_at > NOW() - INTERVAL '7 days'
   GROUP BY forecast_type;
   ```

2. **Check model drift**:
   ```sql
   -- So sánh accuracy xu hướng 7 ngày gần nhất
   SELECT 
     forecast_type,
     model_name,
     DATE(created_at) AS date,
     AVG(accuracy_pct) AS avg_accuracy
   FROM forecast_results
   WHERE created_at > NOW() - INTERVAL '7 days'
   GROUP BY forecast_type, model_name, DATE(created_at)
   ORDER BY forecast_type, date DESC;
   ```

3. **Check external factors**:
   - Kiểm tra xem có sự kiện bất thường (holiday, promotion, seasonality) không?
   - Verify upstream data sources (sessions, bookings, revenue)

4. **Retrain or switch model**:
   ```typescript
   // In production, trigger model retraining or switch to backup model
   import { ForecastService } from '@/services/intelligence/forecast/service';
   
   const service = new ForecastService();
   
   // Option 1: Switch to backup model
   await service.switchModel('revenue', 'exponential_smoothing'); // fallback from linear_regression
   
   // Option 2: Trigger manual retraining (if ML pipeline exists)
   // await service.retrainModel('revenue');
   ```

**Escalation**:
- **Warning**: Notify Data Science team via Slack `#bella-erp-data-science-alerts`
- **Critical**: Page on-call Data Scientist + Email CTO

---

### 2. CacheHitRateCritical / CacheHitRateLow

**Alert**: Cache hit rate `< 40%` (Critical) hoặc `< 60%` (Warning)

**Tác động**:
- Increased database load
- Higher API latency (miss → database query)
- Degraded user experience

**Troubleshooting Steps**:

1. **Check cache service health**:
   ```bash
   # Verify cache service is running
   docker ps | grep redis
   
   # Check Redis memory usage
   docker exec -it redis redis-cli INFO memory
   
   # Check if cache is evicting keys too aggressively
   docker exec -it redis redis-cli INFO stats | grep evicted_keys
   ```

2. **Check cache TTL configuration**:
   ```typescript
   // Verify TTL settings in src/services/intelligence/shared/cache-config.ts
   // Forecast TTLs:
   // - Revenue: 12 hours
   // - Churn: 24 hours
   // - Demand: 6 hours
   // - Recommendations: 3-12 hours
   ```

3. **Check cache warming**:
   ```sql
   -- Verify cache warming job ran successfully
   SELECT 
     job_name,
     last_run_at,
     status,
     error_message
   FROM scheduled_jobs
   WHERE job_name = 'cache-warming-intelligence'
   ORDER BY last_run_at DESC
   LIMIT 5;
   ```

4. **Check cache invalidation patterns**:
   ```bash
   # Check Prometheus metrics for cache misses by type
   curl -s 'http://localhost:9090/api/v1/query?query=rate(intelligence_cache_misses_total[5m])' | jq
   
   # Identify cache types with high miss rate
   ```

5. **Immediate fix** (if Redis is down):
   ```bash
   # Restart Redis container
   docker restart redis
   
   # Or scale up Redis replica set
   kubectl scale statefulset redis --replicas=3
   ```

**Escalation**:
- **Warning**: Create Jira ticket for DevOps team
- **Critical**: Page on-call DevOps engineer

---

### 3. APIResponseTimeCritical / APIResponseTimeSlow

**Alert**: P95 API response time `> 1s` (Critical) hoặc `> 500ms` (Warning)

**Tác động**:
- Slow user experience
- Potential timeout errors
- Increased infrastructure costs (longer compute time)

**Troubleshooting Steps**:

1. **Identify slow endpoint**:
   ```bash
   # Query Prometheus for slowest endpoints
   curl -s 'http://localhost:9090/api/v1/query?query=histogram_quantile(0.95, sum(rate(intelligence_api_duration_seconds_bucket[5m])) by (le, endpoint))' | jq
   ```

2. **Check cache hit rate for slow endpoint**:
   ```bash
   # If cache hit rate is low, investigate why
   curl -s 'http://localhost:9090/api/v1/query?query=rate(intelligence_cache_hits_total{endpoint="/api/intelligence/forecast/revenue"}[5m])' | jq
   ```

3. **Check database query performance**:
   ```sql
   -- Find slow queries in last hour
   SELECT 
     query,
     calls,
     total_exec_time,
     mean_exec_time,
     max_exec_time
   FROM pg_stat_statements
   WHERE query LIKE '%intelligence%'
   ORDER BY mean_exec_time DESC
   LIMIT 10;
   ```

4. **Check materialized view freshness**:
   ```sql
   -- Verify MVs are up-to-date
   SELECT 
     schemaname,
     matviewname,
     pg_size_pretty(pg_total_relation_size(schemaname||'.'||matviewname)) AS size,
     last_refresh
   FROM pg_matviews
   WHERE matviewname LIKE 'mv_%'
   ORDER BY last_refresh DESC;
   ```

5. **Check external API latency** (for Marketing Intelligence endpoints):
   ```bash
   # Check if Facebook/Google Ads API is slow
   curl -s 'http://localhost:9090/api/v1/query?query=intelligence_external_api_latency_seconds{provider="facebook"}' | jq
   ```

6. **Immediate mitigation**:
   ```typescript
   // Option 1: Temporarily increase cache TTL
   // Edit src/services/intelligence/shared/cache-config.ts
   
   // Option 2: Enable circuit breaker for external APIs
   // Edit src/services/intelligence/marketing/connectors/base.ts
   
   // Option 3: Scale up API workers
   // kubectl scale deployment intelligence-api --replicas=5
   ```

**Escalation**:
- **Warning**: Notify Backend team via Slack `#bella-erp-alerts`
- **Critical**: Page on-call Backend engineer

---

### 4. MaterializedViewRefreshFailed / MaterializedViewRefreshSlow

**Alert**: MV refresh failed or took `> 60s` (Warning) or `> 300s` (Critical)

**Tác động**:
- Stale data in dashboards and reports
- Inaccurate forecasts and recommendations
- Cache misses lead to direct database queries

**Troubleshooting Steps**:

1. **Check MV refresh job logs**:
   ```sql
   SELECT 
     mv_name,
     refresh_started_at,
     refresh_completed_at,
     duration_seconds,
     status,
     error_message
   FROM mv_refresh_logs
   WHERE mv_name = 'mv_forecast_accuracy' -- Replace with problematic MV
   ORDER BY refresh_started_at DESC
   LIMIT 10;
   ```

2. **Check for blocking locks**:
   ```sql
   -- Find blocking queries
   SELECT 
     blocked_locks.pid AS blocked_pid,
     blocked_activity.usename AS blocked_user,
     blocking_locks.pid AS blocking_pid,
     blocking_activity.usename AS blocking_user,
     blocked_activity.query AS blocked_statement,
     blocking_activity.query AS blocking_statement
   FROM pg_catalog.pg_locks blocked_locks
   JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
   JOIN pg_catalog.pg_locks blocking_locks 
     ON blocking_locks.locktype = blocked_locks.locktype
     AND blocking_locks.database IS NOT DISTINCT FROM blocked_locks.database
     AND blocking_locks.relation IS NOT DISTINCT FROM blocked_locks.relation
     AND blocking_locks.page IS NOT DISTINCT FROM blocked_locks.page
     AND blocking_locks.tuple IS NOT DISTINCT FROM blocked_locks.tuple
     AND blocking_locks.virtualxid IS NOT DISTINCT FROM blocked_locks.virtualxid
     AND blocking_locks.transactionid IS NOT DISTINCT FROM blocked_locks.transactionid
     AND blocking_locks.classid IS NOT DISTINCT FROM blocked_locks.classid
     AND blocking_locks.objid IS NOT DISTINCT FROM blocked_locks.objid
     AND blocking_locks.objsubid IS NOT DISTINCT FROM blocked_locks.objsubid
     AND blocking_locks.pid != blocked_locks.pid
   JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
   WHERE NOT blocked_locks.granted;
   ```

3. **Check table bloat**:
   ```sql
   -- Check if base tables have excessive bloat
   SELECT 
     schemaname,
     tablename,
     pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
     n_dead_tup,
     n_live_tup,
     ROUND(100.0 * n_dead_tup / NULLIF(n_live_tup + n_dead_tup, 0), 2) AS dead_tup_pct
   FROM pg_stat_user_tables
   WHERE schemaname = 'public'
     AND (n_live_tup + n_dead_tup) > 0
   ORDER BY dead_tup_pct DESC
   LIMIT 10;
   ```

4. **Check missing indexes**:
   ```sql
   -- Find missing indexes (high seq scans, low index scans)
   SELECT 
     schemaname,
     tablename,
     seq_scan,
     seq_tup_read,
     idx_scan,
     CASE 
       WHEN seq_scan > 0 THEN ROUND(100.0 * idx_scan / (seq_scan + idx_scan), 2)
       ELSE 0
     END AS index_usage_pct
   FROM pg_stat_user_tables
   WHERE schemaname = 'public'
   ORDER BY seq_scan DESC
   LIMIT 10;
   ```

5. **Immediate remediation**:
   ```sql
   -- Option 1: Cancel long-running refresh (if stuck)
   SELECT pg_cancel_backend(pid)
   FROM pg_stat_activity
   WHERE query LIKE '%REFRESH MATERIALIZED VIEW%'
     AND state = 'active'
     AND query_start < NOW() - INTERVAL '10 minutes';
   
   -- Option 2: Manually trigger CONCURRENT refresh (non-blocking)
   REFRESH MATERIALIZED VIEW CONCURRENTLY mv_forecast_accuracy;
   
   -- Option 3: Run VACUUM ANALYZE to reduce bloat
   VACUUM ANALYZE sessions;
   VACUUM ANALYZE bookings;
   VACUUM ANALYZE revenue;
   ```

**Escalation**:
- **Warning**: Notify Database team via Slack `#bella-erp-database-alerts`
- **Critical**: Page on-call DBA + Email Infrastructure Lead

---

### 5. DatabaseConnectionPoolExhausted

**Alert**: Connection pool usage `> 90%` (Warning) or `> 95%` (Critical)

**Tác động**:
- New requests may timeout waiting for connections
- Cascading failures across services
- Database performance degradation

**Troubleshooting Steps**:

1. **Check current connection usage**:
   ```sql
   -- Count active connections by application
   SELECT 
     application_name,
     state,
     COUNT(*) AS connections
   FROM pg_stat_activity
   WHERE datname = 'bella_erp'
   GROUP BY application_name, state
   ORDER BY connections DESC;
   ```

2. **Identify connection leaks**:
   ```sql
   -- Find long-running idle connections
   SELECT 
     pid,
     usename,
     application_name,
     client_addr,
     state,
     query,
     state_change,
     NOW() - state_change AS idle_duration
   FROM pg_stat_activity
   WHERE state = 'idle'
     AND NOW() - state_change > INTERVAL '10 minutes'
   ORDER BY idle_duration DESC;
   ```

3. **Check for long-running queries**:
   ```sql
   -- Kill queries running > 5 minutes
   SELECT 
     pid,
     usename,
     application_name,
     query,
     NOW() - query_start AS duration
   FROM pg_stat_activity
   WHERE state = 'active'
     AND NOW() - query_start > INTERVAL '5 minutes'
   ORDER BY duration DESC;
   ```

4. **Immediate fix**:
   ```sql
   -- Option 1: Kill idle connections
   SELECT pg_terminate_backend(pid)
   FROM pg_stat_activity
   WHERE state = 'idle'
     AND NOW() - state_change > INTERVAL '10 minutes'
     AND application_name != 'psql'; -- Don't kill admin sessions
   
   -- Option 2: Increase max_connections (requires restart)
   -- ALTER SYSTEM SET max_connections = 200;
   -- SELECT pg_reload_conf();
   ```

5. **Code-level fix** (connection leak):
   ```typescript
   // Ensure all database clients are properly closed
   // Check src/lib/supabase-server.ts
   // Ensure connection pooling is configured correctly
   
   // Example fix:
   try {
     const { data, error } = await supabase
       .from('forecast_results')
       .select('*');
     return data;
   } finally {
     // Always close connection in finally block
     // supabase.removeAllChannels(); // for realtime subscriptions
   }
   ```

**Escalation**:
- **Warning**: Notify Backend + Database teams
- **Critical**: Page on-call DBA + Backend engineer

---

### 6. RecommendationRelevanceLow / RecommendationRelevanceCritical

**Alert**: Recommendation relevance score `< 0.50` (Warning) or `< 0.30` (Critical)

**Tác động**:
- Poor user experience (irrelevant recommendations)
- Low recommendation click-through rate
- Reduced upsell revenue

**Troubleshooting Steps**:

1. **Check recommendation cache freshness**:
   ```sql
   SELECT 
     recommendation_type,
     COUNT(*) AS cached_records,
     MIN(cached_at) AS oldest_cache,
     MAX(cached_at) AS newest_cache
   FROM recommendation_cache
   WHERE tenant_id = '<TENANT_ID>'
   GROUP BY recommendation_type;
   ```

2. **Check customer interaction data quality**:
   ```sql
   -- Verify mv_customer_item_interactions has sufficient data
   SELECT 
     COUNT(DISTINCT customer_id) AS total_customers,
     COUNT(DISTINCT item_id) AS total_items,
     COUNT(*) AS total_interactions,
     AVG(interaction_score) AS avg_score
   FROM mv_customer_item_interactions
   WHERE tenant_id = '<TENANT_ID>';
   ```

3. **Check collaborative filtering matrix staleness**:
   ```sql
   -- Check when MV was last refreshed
   SELECT 
     matviewname,
     last_refresh
   FROM pg_matviews
   WHERE matviewname = 'mv_customer_item_interactions';
   ```

4. **Immediate fix**:
   ```sql
   -- Refresh customer interaction materialized view
   REFRESH MATERIALIZED VIEW CONCURRENTLY mv_customer_item_interactions;
   
   -- Clear recommendation cache to force re-computation
   DELETE FROM recommendation_cache
   WHERE cached_at < NOW() - INTERVAL '6 hours';
   ```

5. **Algorithm tuning**:
   ```typescript
   // Review algorithm parameters in src/services/intelligence/recommendation/service.ts
   // Consider adjusting:
   // - Collaborative filtering K-nearest neighbors (default: 10)
   // - Content-based similarity threshold (default: 0.5)
   // - Market basket min support (default: 0.01)
   // - Market basket min confidence (default: 0.3)
   ```

**Escalation**:
- **Warning**: Notify Data Science team
- **Critical**: Page on-call Data Scientist + Email Product Manager

---

### 7. ExternalAPISyncFailed

**Alert**: External API sync failed `> 3 times` in last hour

**Tác động**:
- Marketing data out-of-date
- Inaccurate campaign performance reports
- Incorrect ROI calculations

**Troubleshooting Steps**:

1. **Check external API credentials**:
   ```bash
   # Verify environment variables are set
   echo $FACEBOOK_ADS_ACCESS_TOKEN
   echo $GOOGLE_ADS_CLIENT_ID
   echo $TIKTOK_ADS_APP_ID
   echo $ZALO_OA_ACCESS_TOKEN
   ```

2. **Check API rate limit status**:
   ```sql
   SELECT 
     provider,
     COUNT(*) AS requests_last_hour,
     MAX(synced_at) AS last_successful_sync
   FROM external_ads_data
   WHERE synced_at > NOW() - INTERVAL '1 hour'
   GROUP BY provider;
   ```

3. **Check provider status pages**:
   - Facebook Ads: https://developers.facebook.com/status
   - Google Ads: https://ads-developers.googleblog.com/
   - TikTok Ads: https://ads.tiktok.com/help/
   - Zalo OA: https://developers.zalo.me/

4. **Check cron job logs**:
   ```sql
   SELECT 
     job_name,
     last_run_at,
     status,
     error_message,
     duration_seconds
   FROM scheduled_jobs
   WHERE job_name = 'sync-external-ads'
   ORDER BY last_run_at DESC
   LIMIT 10;
   ```

5. **Immediate fix**:
   ```bash
   # Manually trigger sync via API
   curl -X POST http://localhost:3000/api/cron/sync-external-ads \
     -H "Authorization: Bearer ${CRON_SECRET}"
   
   # Or trigger sync for specific provider
   curl -X POST http://localhost:3000/api/cron/sync-external-ads?provider=facebook \
     -H "Authorization: Bearer ${CRON_SECRET}"
   ```

**Escalation**:
- **Warning**: Notify Marketing team
- **Critical**: Page on-call Backend engineer + Email Marketing Manager

---

### 8. StaleDataCritical

**Alert**: Data not refreshed for `> 48 hours`

**Tác động**:
- Dashboards show outdated information
- Business decisions based on stale data
- Loss of trust in Intelligence Layer

**Troubleshooting Steps**:

1. **Identify stale data source**:
   ```bash
   # Check Prometheus metric
   curl -s 'http://localhost:9090/api/v1/query?query=intelligence_last_data_refresh_timestamp_seconds' | jq
   ```

2. **Check cron job status**:
   ```sql
   SELECT 
     job_name,
     schedule,
     last_run_at,
     next_run_at,
     status,
     error_message
   FROM scheduled_jobs
   WHERE job_name LIKE '%refresh%'
   ORDER BY last_run_at DESC;
   ```

3. **Check data pipeline health**:
   ```bash
   # Check if data pipeline containers are running
   docker ps | grep data-pipeline
   
   # Check pipeline logs
   docker logs data-pipeline-worker --tail=100
   ```

4. **Immediate fix**:
   ```sql
   -- Manually trigger data refresh
   -- Option 1: Refresh specific materialized view
   REFRESH MATERIALIZED VIEW CONCURRENTLY mv_executive_summary;
   
   -- Option 2: Refresh all Intelligence MVs
   REFRESH MATERIALIZED VIEW CONCURRENTLY mv_forecast_accuracy;
   REFRESH MATERIALIZED VIEW CONCURRENTLY mv_customer_item_interactions;
   REFRESH MATERIALIZED VIEW CONCURRENTLY mv_campaign_performance;
   ```

5. **Re-enable cron job** (if disabled):
   ```sql
   UPDATE scheduled_jobs
   SET enabled = true
   WHERE job_name LIKE '%refresh%';
   ```

**Escalation**:
- **Warning**: Notify Data Engineering team
- **Critical**: Page on-call Data Engineer + Email Engineering Manager

---

## Common Troubleshooting Scenarios

### Scenario 1: All Forecasts Suddenly Low Accuracy

**Symptoms**:
- Revenue, churn, and demand forecast accuracy all drop simultaneously
- Alerts firing for multiple forecast types

**Root Cause**:
- Upstream data pipeline issue (sessions, bookings, or revenue data not flowing)
- Database table corruption
- Timezone mismatch

**Resolution**:
1. Check upstream data pipeline health
2. Verify data freshness in `sessions`, `bookings`, `revenue` tables
3. Check for timezone issues (all timestamps should be UTC)

---

### Scenario 2: Cache Hit Rate Suddenly Drops to 0%

**Symptoms**:
- Cache hit rate drops from 90%+ to 0%
- All API requests go to database
- API latency increases significantly

**Root Cause**:
- Redis crashed or out of memory
- Cache keys changed (code deployment with cache key format change)
- Network partition between app and Redis

**Resolution**:
1. Check Redis container status: `docker ps | grep redis`
2. Check Redis memory: `docker exec -it redis redis-cli INFO memory`
3. Restart Redis if necessary: `docker restart redis`
4. Verify cache key format in code hasn't changed

---

### Scenario 3: Materialized Views Not Refreshing

**Symptoms**:
- MVs last_refresh timestamp stuck at old value
- MV refresh job shows status = 'running' for hours

**Root Cause**:
- MV refresh job stuck due to table lock
- Long-running transaction blocking refresh
- Database connection leak

**Resolution**:
1. Cancel stuck refresh job: `SELECT pg_cancel_backend(pid) FROM pg_stat_activity WHERE query LIKE '%REFRESH%';`
2. Kill blocking transactions
3. Manually trigger CONCURRENT refresh (non-blocking)

---

## Escalation Procedures

### Level 1: On-Call Engineer (First Responder)

**Response Time**: < 15 minutes for Critical, < 1 hour for Warning

**Responsibilities**:
- Acknowledge alert in PagerDuty/Slack
- Follow runbook procedures
- Attempt immediate mitigation
- Escalate if unable to resolve within 30 minutes

**Escalation Criteria**:
- Unable to identify root cause within 30 minutes
- Multiple critical alerts firing simultaneously
- Data corruption or loss detected
- Service-wide outage

---

### Level 2: Team Lead / Senior Engineer

**Response Time**: < 30 minutes after escalation

**Responsibilities**:
- Coordinate with multiple teams if needed
- Make architectural decisions (e.g., failover, rollback)
- Approve destructive actions (e.g., database restore)
- Communicate with stakeholders

**Escalation Criteria**:
- Requires cross-team coordination
- Potential data loss
- Requires production configuration changes
- Service outage > 1 hour

---

### Level 3: Engineering Manager / CTO

**Response Time**: < 1 hour after escalation

**Responsibilities**:
- Executive decision-making
- Customer communication
- Vendor escalation (e.g., cloud provider, SaaS vendors)
- Post-incident review planning

**Escalation Criteria**:
- Service outage > 4 hours
- Customer-impacting data corruption
- Security incident
- Requires external vendor escalation

---

## Monitoring Stack

### Components

| Component | Purpose | Port | Access |
|-----------|---------|------|--------|
| **Prometheus** | Metrics collection & storage | 9090 | http://localhost:9090 |
| **Grafana** | Metrics visualization | 3001 | http://localhost:3001 |
| **Alertmanager** | Alert routing & notification | 9093 | http://localhost:9093 |
| **Node Exporter** | System metrics | 9100 | http://localhost:9100 |
| **Postgres Exporter** | Database metrics | 9187 | http://localhost:9187 |

### Key Dashboards

1. **Intelligence Layer - Performance & Health** (`intelligence-layer-main`)
   - Forecast accuracy trends
   - Cache hit rates
   - API latency percentiles
   - Request volume
   - Error rates
   - MV refresh durations

2. **Database Performance** (built-in Grafana template)
   - Connection pool usage
   - Query performance
   - Table bloat
   - Index usage

---

## Metrics Reference

### Forecast Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `intelligence_forecast_accuracy` | Gauge | Forecast accuracy percentage (0-100) |
| `intelligence_forecast_requests_total` | Counter | Total forecast requests |
| `intelligence_forecast_duration_seconds` | Histogram | Forecast generation time |

### Cache Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `intelligence_cache_hits_total` | Counter | Cache hits by type |
| `intelligence_cache_misses_total` | Counter | Cache misses by type |
| `intelligence_cache_evictions_total` | Counter | Cache evictions (memory pressure) |

### API Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `intelligence_api_requests_total` | Counter | API requests by endpoint & status |
| `intelligence_api_duration_seconds` | Histogram | API response time distribution |
| `intelligence_api_errors_total` | Counter | API errors by type |

### Database Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `intelligence_db_query_duration_seconds` | Histogram | Database query time distribution |
| `intelligence_db_pool_active_connections` | Gauge | Active database connections |
| `intelligence_db_pool_max_connections` | Gauge | Maximum connection pool size |
| `intelligence_mv_refresh_duration_seconds` | Gauge | MV refresh time by MV name |
| `intelligence_mv_refresh_errors_total` | Counter | MV refresh failures |

### Recommendation Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `intelligence_recommendation_relevance_score` | Gauge | Recommendation relevance (0-1) |
| `intelligence_recommendation_requests_total` | Counter | Recommendation requests by type |
| `intelligence_recommendation_cache_size` | Gauge | Number of cached recommendations |

### External API Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `intelligence_external_api_requests_total` | Counter | External API requests by provider |
| `intelligence_external_api_latency_seconds` | Histogram | External API latency |
| `intelligence_external_api_sync_errors_total` | Counter | External API sync failures |

---

## Post-Incident Review Template

After resolving a critical incident, complete a Post-Incident Review (PIR):

**Template**: `docs/PIR_YYYY_MM_DD_<incident_name>.md`

**Required Sections**:
1. **Summary**: One-sentence description of the incident
2. **Impact**: Customer impact, duration, affected services
3. **Root Cause**: Technical root cause analysis
4. **Timeline**: Chronological sequence of events
5. **Resolution**: How the issue was resolved
6. **Action Items**: Preventive measures and follow-up tasks
7. **Lessons Learned**: What went well, what didn't

**Distribution**: Share PIR with Engineering team, Management, and relevant stakeholders

---

## Contact Information

| Team | Slack Channel | Email | On-Call |
|------|--------------|-------|---------|
| **DevOps** | `#bella-erp-devops` | devops@example.com | PagerDuty: `bella-erp-devops` |
| **Backend** | `#bella-erp-backend` | backend@example.com | PagerDuty: `bella-erp-backend` |
| **Database** | `#bella-erp-database` | dba@example.com | PagerDuty: `bella-erp-dba` |
| **Data Science** | `#bella-erp-data-science` | data-science@example.com | No on-call (business hours only) |
| **Marketing** | `#bella-erp-marketing` | marketing@example.com | No on-call |

**Emergency Contacts**:
- CTO: cto@example.com | +84-XXX-XXX-XXX
- Engineering Manager: eng-manager@example.com | +84-XXX-XXX-XXX

---

**Version History**:

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-06-22 | DevOps Team | Initial runbook for Intelligence Layer monitoring |

---

**Related Documents**:
- [Intelligence Layer Roadmap](./INTELLIGENCE_LAYER_ROADMAP.md)
- [Intelligence Layer Phase 7 README](./INTELLIGENCE_LAYER_PHASE_7_README.md)
- [Performance Optimization Guide](./PERFORMANCE_OPTIMIZATION_GUIDE.md) (to be created in Task #1)
