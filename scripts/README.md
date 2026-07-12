# Decision Engine Automation Scripts

This directory contains automation scripts for managing the Decision Engine Platform in production.

## Overview

| Script | Purpose | Frequency | Usage |
|--------|---------|-----------|-------|
| `cache-warmup.ts` | Preload rules into Redis cache | On-demand / Post-deploy | `npm run cache:warmup -- --env=production` |
| `health-check.ts` | Comprehensive health check | On-demand / Monitoring | `npm run health:check -- --env=production` |
| `collect-metrics.ts` | Collect and aggregate metrics | Cron: Every 5 minutes | `npm run metrics:collect` |
| `backup-database.sh` | Backup Decision Engine tables | Cron: Daily at 2 AM | `/path/to/backup-database.sh` |

## Prerequisites

### Environment Variables

Copy `.env.example` to `.env` and fill in the values:
```bash
cp scripts/.env.example .env
```

Required variables:
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Admin access key
- `REDIS_URL` - Redis connection string
- `DECISION_ENGINE_LOG_LEVEL` - Logging verbosity (info/debug)

### Dependencies

All TypeScript scripts use `tsx` for execution:
```bash
npm install -g tsx
# Or use via npm: npm run <script>
```

For database backup script, ensure `pg_dump` is installed:
```bash
# macOS
brew install postgresql

# Ubuntu/Debian
sudo apt-get install postgresql-client

# Windows
# Download from: https://www.postgresql.org/download/windows/
```

## Script Details

### 1. Cache Warmup (`cache-warmup.ts`)

**Purpose**: Preload active rules into Redis cache for fast cold-start performance.

**When to run**:
- After production deployment (warmup cache before traffic hits)
- After Redis restart
- When cache hit rate drops significantly

**Usage**:
```bash
# Production
npm run cache:warmup -- --env=production

# Staging
npm run cache:warmup -- --env=staging

# Local
npm run cache:warmup -- --env=local
```

**Expected output**:
```
[Cache Warmup] Starting for production environment...
[Cache Warmup] Loading 83 active rules into cache...
[Cache Warmup] Progress: 10/83 rules cached
[Cache Warmup] Progress: 20/83 rules cached
...
[Cache Warmup] ✅ Complete!
  Total rules: 83
  Cached: 83
  Failed: 0
  Duration: 1523ms
```

**Exit codes**:
- `0` - Success (all rules cached)
- `1` - Failure (some rules failed to cache)


### 2. Health Check (`health-check.ts`)

**Purpose**: Comprehensive health check of Decision Engine infrastructure.

**When to run**:
- Manual verification after deployment
- Scheduled monitoring (e.g., every 5 minutes via cron)
- Incident investigation

**Usage**:
```bash
# Production health check
npm run health:check -- --env=production

# Check exit code
echo $?  # 0 = healthy, 1 = critical, 2 = degraded
```

**Health checks performed**:
1. **Database** - Connects to Supabase and runs test query
2. **Redis** - Pings Redis instance
3. **Providers** - Counts active providers (expect ≥5)
4. **Rules** - Counts enabled rules (expect ≥50)

**Expected output (healthy)**:
```
[Health Check] Starting for production environment...
[Health Check] Checking database...
  ✅ Database: 23ms
[Health Check] Checking Redis...
  ✅ Redis: 12ms
[Health Check] Checking providers...
  ✅ Providers: 6 active
[Health Check] Checking rules...
  ✅ Rules: 83/95 enabled

[Health Check] Summary:
  Status: HEALTHY
  Healthy: 4/4 (100%)

✅ HEALTHY: All systems operational
```

**Exit codes**:
- `0` - Healthy (all checks passed)
- `1` - Critical (database or critical component failure)
- `2` - Degraded (non-critical component failure)

### 3. Metrics Collection (`collect-metrics.ts`)

**Purpose**: Collect and aggregate Decision Engine metrics from audit logs into time-series database.

**When to run**: Automatically via cron every 5 minutes

**Usage**:
```bash
# Manual run
npm run metrics:collect

# Cron setup (add to crontab)
*/5 * * * * cd /path/to/project && npm run metrics:collect >> /var/log/metrics.log 2>&1
```

**Metrics collected**:
- Total decisions (per provider)
- Average latency (per provider)
- P95 latency (per provider)
- Cache hit rate (per provider)
- Error rate (per provider)

**Expected output**:
```
[Metrics] Starting collection...
[Metrics] Collecting data from 2026-07-12T10:00:00.000Z to 2026-07-12T10:05:00.000Z
[Metrics] Processing 1,234 decisions
[Metrics] booking: 456 decisions, 0.58ms avg, 87.3% cache hit
[Metrics] discount: 312 decisions, 0.72ms avg, 92.1% cache hit
[Metrics] payroll: 189 decisions, 0.11ms avg, 95.8% cache hit
[Metrics] commission: 234 decisions, 0.27ms avg, 88.9% cache hit
[Metrics] inventory: 43 decisions, 0.15ms avg, 81.4% cache hit
[Metrics] ✅ Collection complete
```

**Storage**:
- Real-time: Redis (`metrics:<provider>:latest`, TTL 10 minutes)
- Historical: PostgreSQL `decision_metrics` table (retained for 1 year)


### 4. Database Backup (`backup-database.sh`)

**Purpose**: Backup critical Decision Engine tables to local storage and optionally S3.

**When to run**: Automatically via cron daily at 2 AM

**Usage**:
```bash
# Manual backup
SUPABASE_PROJECT_ID=your-project \
SUPABASE_DB_PASSWORD=your-password \
./scripts/backup-database.sh

# Cron setup (add to crontab)
0 2 * * * /path/to/scripts/backup-database.sh >> /var/log/backup.log 2>&1
```

**Tables backed up**:
- `policy_registry` - All rule definitions
- `decision_audit_logs` - Decision history
- `decision_metrics` - Performance metrics
- `rule_version_history` - Rule change history
- `workflow_definitions` - Workflow configurations
- `workflow_executions` - Workflow execution logs

**Backup retention**:
- Local: Last 7 days
- S3 (optional): Indefinite (or configure lifecycle policy)

**Expected output**:
```
[Backup] Starting Decision Engine database backup at 20260712_020000
[Backup] Dumping Decision Engine tables...
[Backup] ✅ Backup completed: decision_engine_20260712_020000.dump (12.3M)
[Backup] Cleaning up old backups (>7 days)...
[Backup] Remaining backups: 7
[Backup] Uploading to S3...
[Backup] ✅ Uploaded to s3://bella-spa-backups/decision-engine/
[Backup] All done!
[Backup] Backup location: /var/backups/bella-spa/decision_engine_20260712_020000.dump
[Backup] Restore command:
  PGPASSWORD=$SUPABASE_DB_PASSWORD pg_restore -h db.your-project.supabase.co -U postgres -d postgres -c /var/backups/bella-spa/decision_engine_20260712_020000.dump
```

**Restoration**:
```bash
# List available backups
ls -lh /var/backups/bella-spa/decision_engine_*.dump

# Restore from backup
PGPASSWORD=$SUPABASE_DB_PASSWORD pg_restore \
  -h db.your-project.supabase.co \
  -U postgres \
  -d postgres \
  -c /var/backups/bella-spa/decision_engine_20260712_020000.dump
```

## Integration with CI/CD

### GitHub Actions

The deployment workflow (`.github/workflows/decision-engine-deploy.yml`) automatically:
1. Runs tests on every push
2. Deploys to staging on PR
3. Deploys to production on merge to main
4. Runs cache warmup after production deploy
5. Notifies Slack of deployment status

**Secrets required** (configure in GitHub repo settings):
- `VERCEL_TOKEN` - Vercel API token
- `VERCEL_ORG_ID` - Vercel organization ID
- `VERCEL_PROJECT_ID` - Vercel project ID
- `REDIS_URL` - Production Redis URL
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase admin key
- `SLACK_WEBHOOK` - Slack webhook for notifications

### Vercel Cron Jobs

To run metrics collection automatically, add to `vercel.json`:
```json
{
  "crons": [{
    "path": "/api/cron/collect-metrics",
    "schedule": "*/5 * * * *"
  }]
}
```

Create API route at `src/app/api/cron/collect-metrics/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function GET(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    const { stdout, stderr } = await execAsync('npm run metrics:collect');
    return NextResponse.json({ 
      success: true, 
      output: stdout,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Metrics collection failed:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
```

## Troubleshooting

### Cache Warmup Fails

**Symptom**: Script exits with error "Failed to load rules"

**Solutions**:
1. Verify Supabase credentials are correct
2. Check `policy_registry` table exists
3. Verify network connectivity to Supabase
4. Check Supabase dashboard for service status

### Health Check Reports Degraded

**Symptom**: Exit code 2, some checks failing

**Solutions**:
1. Check which component failed (database/redis/providers/rules)
2. Review logs for specific error messages
3. Follow Production Runbook troubleshooting section

### Metrics Collection Returns No Data

**Symptom**: "No decisions in last 5 minutes"

**Possible causes**:
1. System is idle (no actual traffic)
2. Decision Engine not writing to audit logs
3. Time range issue (check system clock sync)

### Backup Script Permission Denied

**Symptom**: "pg_dump: command not found" or "Permission denied"

**Solutions**:
```bash
# Make script executable
chmod +x scripts/backup-database.sh

# Install PostgreSQL client tools
# macOS: brew install postgresql
# Ubuntu: sudo apt-get install postgresql-client

# Verify pg_dump available
which pg_dump
```

## Monitoring Script Health

### Script Execution Logs

All scripts log to stdout/stderr. Capture logs when running via cron:
```bash
# Crontab entry with logging
*/5 * * * * cd /path/to/project && npm run metrics:collect >> /var/log/decision-engine/metrics.log 2>&1
0 2 * * * /path/to/scripts/backup-database.sh >> /var/log/decision-engine/backup.log 2>&1
```

### Alert on Script Failure

Create monitoring for script exit codes:
```bash
#!/bin/bash
# wrapper-with-alert.sh

SCRIPT_NAME=$1
SCRIPT_CMD=$2

$SCRIPT_CMD
EXIT_CODE=$?

if [ $EXIT_CODE -ne 0 ]; then
  # Send alert to Slack
  curl -X POST $SLACK_WEBHOOK_URL \
    -H 'Content-Type: application/json' \
    -d "{\"text\":\"❌ Script failed: $SCRIPT_NAME (exit code: $EXIT_CODE)\"}"
fi

exit $EXIT_CODE
```

Usage in cron:
```bash
*/5 * * * * /path/to/wrapper-with-alert.sh "Metrics Collection" "npm run metrics:collect"
```

## Related Documentation

- **Production Runbook**: `../docs/DECISION_ENGINE_PRODUCTION_RUNBOOK.md` (comprehensive guide)
- **Monitoring Setup**: `../monitoring/README.md` (alert rules, load testing)
- **Architecture**: `../docs/DECISION_ENGINE_PLATFORM_ARCHITECTURE.md` (system design)

## Support

For issues or questions:
- Check Production Runbook Section 3 (Troubleshooting)
- Review script logs in `/var/log/decision-engine/`
- Contact DevOps team via Slack `#decision-engine`
