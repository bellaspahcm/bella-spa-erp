# Bella ERP Infrastructure Documentation

## 📚 Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Environment Setup](#environment-setup)
4. [CI/CD Pipeline](#cicd-pipeline)
5. [Database Management](#database-management)
6. [Performance & Scaling](#performance--scaling)
7. [Monitoring & Alerts](#monitoring--alerts)
8. [Disaster Recovery](#disaster-recovery)
9. [Security](#security)
10. [Runbooks](#runbooks)

---

## Overview

Bella ERP infrastructure được triển khai trên:
- **Frontend & API**: Vercel Edge Network
- **Database**: Supabase (PostgreSQL)
- **Caching**: Redis (Upstash)
- **CI/CD**: GitHub Actions
- **Monitoring**: Sentry, Vercel Analytics

**Production URL**: https://bella-erp.com  
**Staging URL**: https://bella-erp-staging.vercel.app

---

## Architecture

### High-Level Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         Users (Vietnam)                          │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
                    ┌────────────────┐
                    │  Cloudflare    │  (Optional WAF)
                    │  DNS + DDoS    │
                    └────────┬───────┘
                             │
                             ▼
                ┌────────────────────────┐
                │   Vercel Edge Network   │
                │   (Singapore Region)    │
                │   - CDN Caching         │
                │   - Load Balancing      │
                │   - Auto-scaling        │
                └────────┬───────────────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
         ▼               ▼               ▼
    ┌────────┐      ┌────────┐     ┌────────┐
    │Lambda 1│      │Lambda 2│     │Lambda N│
    │ API    │      │ API    │     │ API    │
    └───┬────┘      └───┬────┘     └───┬────┘
        │               │               │
        └───────────────┼───────────────┘
                        │
        ┌───────────────┼───────────────┐
        │               │               │
        ▼               ▼               ▼
┌───────────────┐  ┌──────────┐  ┌────────────┐
│ Supabase      │  │  Redis   │  │   Sentry   │
│ Primary DB    │  │  Cache   │  │  Errors    │
│ (PostgreSQL)  │  │          │  │            │
└───────┬───────┘  └──────────┘  └────────────┘
        │
        ▼
┌───────────────┐
│ Supabase      │
│ Read Replica  │
│ (Analytics)   │
└───────────────┘
```

### Key Components

| Component | Purpose | Provider | Region |
|-----------|---------|----------|--------|
| **Frontend** | Next.js App Router | Vercel | Singapore (sin1) |
| **API** | Server Actions + API Routes | Vercel Serverless | Singapore (sin1) |
| **Database** | PostgreSQL with RLS | Supabase | Singapore |
| **Read Replica** | Analytics queries | Supabase | Singapore |
| **Cache** | Rate limiting, sessions | Upstash Redis | Singapore |
| **CDN** | Static assets, API cache | Vercel Edge | Global |
| **Monitoring** | Error tracking | Sentry | Cloud |
| **CI/CD** | Automated testing & deploy | GitHub Actions | Cloud |

---

## Environment Setup

### 📋 Quick Start

1. **Clone repository:**
```bash
git clone https://github.com/bella-erp/bella-spa-erp.git
cd bella-spa-erp
```

2. **Install dependencies:**
```bash
npm install
```

3. **Setup local environment:**
```bash
cp .env.example .env.local
# Edit .env.local with your Supabase credentials
```

4. **Run development server:**
```bash
npm run dev
```

### Environment Configuration

| Environment | Branch | Auto-Deploy | URL |
|-------------|--------|-------------|-----|
| **Development** | `feature/*` | No | `localhost:3000` |
| **Staging** | `develop` | Yes | `bella-erp-staging.vercel.app` |
| **Production** | `main` | Manual | `bella-erp.com` |

**Detailed Guide**: [Production Environment Setup](./PRODUCTION_ENVIRONMENT_SETUP.md)

**Environment Variables**:
- [`.env.staging`](../../.env.staging) - Staging configuration
- [`.env.production`](../../.env.production) - Production configuration

---

## CI/CD Pipeline

### Automated Workflows

#### 1. Continuous Integration (Every Commit)

**Workflow**: `.github/workflows/ci-tests.yml`

```
On: push, pull_request
├─ Lint & Type Check (2 min)
├─ Unit & Integration Tests (5 min)
├─ Security Scanning (3 min)
│  ├─ npm audit
│  ├─ Semgrep SAST
│  ├─ Gitleaks secrets
│  └─ Trivy vulnerabilities
├─ Build Test (5 min)
└─ E2E Smoke Tests (5 min)
```

**Total Time**: ~15-20 minutes

#### 2. Staging Deployment (Auto)

**Workflow**: `.github/workflows/deploy-staging.yml`

```
On: push to develop
├─ Run CI tests
├─ Deploy to Vercel Staging
├─ Run smoke tests on staging
└─ Notify team (Slack)
```

**Total Time**: ~20 minutes

#### 3. Production Deployment (Manual)

**Workflow**: `.github/workflows/deploy-production.yml`

```
On: workflow_dispatch (manual trigger)
├─ Pre-deployment validation
│  ├─ Full test suite
│  ├─ Security audit
│  ├─ Database migration check
│  └─ API compatibility check
├─ Deploy to Vercel Production (requires approval)
├─ Health check + smoke tests
└─ Post-deployment monitoring
```

**Total Time**: ~30 minutes

**Detailed Guide**: [CI/CD Pipeline Documentation](./CI_CD_PIPELINE.md)

---

## Database Management

### Supabase PostgreSQL Setup

**Production Database:**
- **Instance**: `bella-erp-prod`
- **Region**: Singapore (ap-southeast-1)
- **Plan**: Pro ($25/month)
- **Compute**: 2 CPU, 4 GB RAM
- **Storage**: 8 GB (auto-scaling)
- **Connections**: 500 max (with pooler: 10K)

**Read Replica** (Analytics):
- **Instance**: `bella-erp-prod-read`
- **Replication Lag**: ~100ms
- **Use For**: Reports, dashboards, exports

### Database Operations

**1. Migrations (Zero Downtime):**
```bash
# Create migration
supabase migration new add_column_to_table

# Test locally
supabase db reset && supabase db push

# Deploy to staging
supabase db push --db-url $STAGING_DATABASE_URL

# Deploy to production (with backup!)
supabase db push --db-url $PRODUCTION_DATABASE_URL
```

**2. Backups:**
- **Automatic**: Daily at 2 AM UTC
- **Retention**: 7 days
- **Manual**: Supabase Dashboard → Backups → Create

**3. Read Replica Routing:**
```typescript
import { db } from '@/lib/database/read-replica';

// Write operations → Primary
await db.primary.from('bookings').insert(data);

// Analytics → Replica
await db.replica.from('sessions').select('*').gte('created_at', startDate);
```

**Detailed Guides**:
- [Database Replication Setup](./DATABASE_REPLICATION_SETUP.md)
- [Zero-Downtime Migrations](./DATABASE_MIGRATIONS_ZERO_DOWNTIME.md)

---

## Performance & Scaling

### Auto-Scaling Configuration

**Vercel Serverless Functions:**
- **Concurrent Executions**: 1000 max (Pro plan)
- **Auto-scale**: 0 → 1000 based on traffic
- **Cold Start**: ~500ms (first request)
- **Warm Execution**: ~50ms
- **Memory**: 1 GB (default), 3 GB (cron jobs)
- **Timeout**: 10 seconds (API), 5 minutes (cron)

**Database Connection Pooling:**
- **Primary**: 100 connections max
- **Replica**: 50 connections max
- **Pooler Mode**: Transaction (10K connections)

### CDN Caching Strategy

| Resource Type | Cache Duration | Revalidation |
|---------------|----------------|--------------|
| **Static Assets** | 1 year | Immutable (content hash) |
| **Public API** | 5 minutes | Stale-while-revalidate (10 min) |
| **Private API** | No cache | Always fresh |
| **Webhooks** | No cache | Always fresh |

**Edge Regions:**
- Primary: Singapore (sin1) - ~30ms to Vietnam
- Secondary: Tokyo (hnd1) - ~80ms to Vietnam

**Detailed Guides**:
- [Load Balancing & Auto-scaling](./LOAD_BALANCING_AND_AUTOSCALING.md)
- [CDN Caching Strategy](./CDN_CACHING_STRATEGY.md)

---

## Monitoring & Alerts

### Health Checks

**Endpoints:**
- `/api/health` - Application health
- `/api/health/replica` - Database replica lag
- `/api/health/ready` - Readiness probe
- `/api/health/live` - Liveness probe

**Monitoring Frequency:**
- **External**: Every 1 minute (UptimeRobot)
- **Internal**: Every 5 minutes (Vercel Cron)

### Key Metrics

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| **Uptime** | 99.9% | < 99% |
| **Response Time (P95)** | < 500ms | > 1000ms |
| **Error Rate** | < 0.1% | > 1% |
| **Database Replica Lag** | < 500ms | > 5000ms |
| **CPU Usage** | < 70% | > 90% |
| **Memory Usage** | < 80% | > 95% |

### Alert Channels

**Slack Webhooks:**
- `#infrastructure-alerts` - Health check failures, high error rates
- `#deployments` - Deployment status, rollbacks
- `#security-alerts` - Security scan findings

**Sentry:**
- Error tracking with source maps
- Performance monitoring
- Release tracking

### Monitoring Cron Jobs

**`/api/cron/monitor-replica`** - Every 5 minutes
- Check replication lag
- Alert if > 5 seconds

**`/api/cron/health-check`** - Every 1 minute
- Ping application health
- Alert if unhealthy for 3+ checks

---

## Disaster Recovery

### Backup Strategy

**Database Backups:**
- **Frequency**: Daily at 2 AM UTC
- **Retention**: 7 days
- **Type**: Full snapshot
- **Size**: ~2 GB (compressed)

**Application Backups:**
- **Git Repository**: All code in GitHub
- **Vercel Deployments**: Last 100 deployments retained
- **Environment Variables**: Stored in Vercel + 1Password

### Recovery Procedures

**Scenario 1: Application Bug (Code Only)**
- **RTO**: < 5 minutes
- **Procedure**: Vercel instant rollback
- **Data Loss**: None

**Scenario 2: Database Migration Failure**
- **RTO**: < 20 minutes
- **Procedure**: Revert migration + rollback code
- **Data Loss**: < 5 minutes (replication lag)

**Scenario 3: Database Corruption**
- **RTO**: < 60 minutes
- **Procedure**: Restore from backup + replay transactions
- **Data Loss**: Up to 24 hours (last backup)

**Detailed Guide**: [Rollback Procedures](./ROLLBACK_PROCEDURES.md)

### Business Continuity

**Recovery Time Objective (RTO)**: < 15 minutes  
**Recovery Point Objective (RPO)**: < 5 minutes

**Disaster Scenarios**:
- Region outage → Failover to Tokyo region (manual)
- Complete outage → Static error page from Edge
- Data loss → Restore from backup + replay accounting outbox

---

## Security

### Infrastructure Security

**Network Security:**
- HTTPS only (TLS 1.3)
- HSTS enabled (1 year)
- CSP headers configured
- Permissions-Policy restricted

**Database Security:**
- Row Level Security (RLS) enabled
- Service role key in environment secrets only
- Connection pooling with timeout
- Encrypted at rest (AES-256)

**API Security:**
- Rate limiting (5 tiers: 60/min → unlimited)
- Circuit breaker for Redis failures
- HMAC signatures for webhooks
- API key authentication

**CI/CD Security:**
- Semgrep SAST scanning
- Trivy vulnerability scanning
- Gitleaks secret detection
- npm audit for dependencies

### Security Scanning

**Automated (Every Commit):**
```bash
npm run security:audit    # Dependency vulnerabilities
npm run security:secrets  # Secret leaks
npm run lint              # Code quality
```

**Manual (Quarterly):**
- Penetration testing
- Security audit
- Dependency updates

---

## Runbooks

### Common Operations

#### Deploy to Production

1. Ensure all tests pass on staging
2. Create GitHub release with version tag
3. Navigate to Actions → Deploy to Production
4. Trigger workflow with version tag
5. Approve deployment (requires approval)
6. Monitor for 15 minutes

**Detailed**: [Production Deployment Guide](./PRODUCTION_DEPLOYMENT.md)

#### Rollback Production

```bash
# Instant rollback via CLI
./scripts/emergency-rollback.sh "reason-for-rollback"

# OR via Vercel Dashboard
# Navigate to Deployments → Previous → Promote to Production
```

**Detailed**: [Rollback Procedures](./ROLLBACK_PROCEDURES.md)

#### Database Migration

```bash
# 1. Create migration
supabase migration new migration_name

# 2. Write SQL (backward compatible!)
# Edit supabase/migrations/YYYYMMDD_migration_name.sql

# 3. Validate migration
./scripts/validate-migration.sh YYYYMMDD_migration_name.sql

# 4. Test locally
supabase db reset && supabase db push

# 5. Deploy to staging
supabase db push --db-url $STAGING_DATABASE_URL

# 6. Deploy to production (with backup!)
# Supabase Dashboard → Create Backup first
supabase db push --db-url $PRODUCTION_DATABASE_URL
```

**Detailed**: [Database Migrations](./DATABASE_MIGRATIONS_ZERO_DOWNTIME.md)

#### Scale Up Resources

**Vercel (Serverless):**
- Auto-scales automatically (0 → 1000 functions)
- No manual intervention needed

**Database:**
1. Supabase Dashboard → Settings → Compute
2. Upgrade compute tier (2 CPU → 4 CPU)
3. Apply changes (15 min downtime)

**Read Replica:**
1. Enable read replica in Supabase
2. Update environment variables
3. Deploy code changes to use replica

---

## Emergency Contacts

**Incident Response Team:**

| Role | Name | Contact | Availability |
|------|------|---------|--------------|
| **On-Call Engineer** | [TBD] | [Phone] | 24/7 |
| **Database Admin** | [TBD] | [Phone] | Business hours |
| **DevOps Lead** | [TBD] | [Phone] | Business hours |
| **CTO** | [TBD] | [Phone] | Escalation only |

**External Support:**
- **Vercel Support**: support@vercel.com (Pro plan - 24h response)
- **Supabase Support**: support@supabase.com (Pro plan - 24h response)

---

## Additional Resources

### Documentation

- [Production Environment Setup](./PRODUCTION_ENVIRONMENT_SETUP.md)
- [Database Replication Setup](./DATABASE_REPLICATION_SETUP.md)
- [CDN Caching Strategy](./CDN_CACHING_STRATEGY.md)
- [Load Balancing & Auto-scaling](./LOAD_BALANCING_AND_AUTOSCALING.md)
- [Database Migrations - Zero Downtime](./DATABASE_MIGRATIONS_ZERO_DOWNTIME.md)
- [Rollback Procedures](./ROLLBACK_PROCEDURES.md)

### Scripts

- [`scripts/validate-migration.sh`](../../scripts/validate-migration.sh) - Validate migration files
- [`scripts/emergency-rollback.sh`](../../scripts/emergency-rollback.sh) - Emergency rollback

### External Links

- [Vercel Documentation](https://vercel.com/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Next.js Documentation](https://nextjs.org/docs)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)

---

## Change Log

| Date | Version | Changes |
|------|---------|---------|
| 2026-06-18 | 1.0 | Initial infrastructure documentation |

---

**Last Updated**: 2026-06-18  
**Maintained By**: DevOps Team  
**Review Frequency**: Quarterly
