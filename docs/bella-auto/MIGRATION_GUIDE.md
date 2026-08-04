# Bella Auto - Migration Guide

**Version:** 1.0  
**Last Updated:** 2026-08-04  
**Target Audience:** Database Administrators, DevOps Engineers, Backend Developers

---

## Table of Contents

1. [Overview](#overview)
2. [Pre-requisites](#pre-requisites)
3. [Migration Strategy](#migration-strategy)
4. [Step-by-Step Instructions](#step-by-step-instructions)
5. [Rollback Procedures](#rollback-procedures)
6. [Verification Checklist](#verification-checklist)
7. [Troubleshooting](#troubleshooting)

---

## Overview

This guide covers the database migration process for **Bella Auto module** from initial setup to production deployment.

### Migration Files

Bella Auto migrations are located in `supabase/migrations/` with timestamps `202608*`:

```
20260803200800_create_bella_auto_foundation.sql      - Phase 0: Brands, Models, Variants
20260803210000_create_auto_vehicles.sql              - Phase 1: Vehicle Inventory
20260803220000_create_auto_customer_extension.sql    - Phase 2: Customer Extensions
20260803230000_create_auto_journeys.sql              - Phase 3: Customer Journey
20260803240000_create_auto_leads_bookings.sql        - Phase 4: Lead & Booking
20260803250000_bella_auto_phase5_nps_csi.sql         - Phase 5: NPS & CSI
20260803260000_bella_auto_phase6_service_center.sql  - Phase 6: Workshop
20260803270000_bella_auto_phase7_trade_in_center.sql - Phase 7: Trade-In
20260803280000_bella_auto_phase8_finance_center.sql  - Phase 8: Finance
20260803290000_bella_auto_phase9_ai_center.sql       - Phase 9: AI Recommendations
20260803300000_bella_auto_phase10_mobile_workforce.sql - Phase 10: Mobile
20260803310000_bella_auto_phase11_business_rollback.sql - Phase 11: Event Sourcing
20260803320000_bella_auto_phase12_temporal_history.sql - Phase 12: Audit Trail
20260804000000_bella_auto_phase13_rule_engine.sql     - Phase 13: Rule Engine
20260804020000_bella_auto_performance_indexes.sql     - Performance Optimization
20260804310000_create_auto_deposits_tracking.sql      - Deposit Tracking
20260804320000_analytics_rpcs.sql                     - Analytics RPCs
20260804360000_migrate_workshop_schema.sql            - Workshop Schema Migration
```

**Total:** 18 migration files

---

## Pre-requisites

### 1. Software Requirements

```bash
# Required tools
- PostgreSQL 15+ (Supabase uses Postgres 15.1)
- Supabase CLI v1.50+
- Node.js 18+ (for type generation)
- Git (for version control)
```

### 2. Environment Setup

```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Link project
supabase link --project-ref YOUR_PROJECT_REF
```

### 3. Database Backup

**⚠️ CRITICAL: Always backup before running migrations**

```bash
# Backup via Supabase CLI
supabase db dump --data-only > backup-$(date +%Y%m%d).sql

# Or via Supabase Dashboard
# Settings > Database > Backups > Create backup
```

---

## Migration Strategy

### Architectural Principles

1. **Fully Additive** - No DROP, no ALTER on existing tables
2. **Idempotent** - Safe to re-run (uses `IF NOT EXISTS`)
3. **Tenant Isolated** - All tables have `tenant_id` + RLS policies
4. **Zero Downtime** - No locks on core tables
5. **Backward Compatible** - Old columns kept for transition period

### Migration Order

Migrations MUST be applied in chronological order (by timestamp) to satisfy foreign key dependencies:

```
Foundation → Inventory → Sales → Workshop → Analytics
```

---

## Step-by-Step Instructions

### Step 1: Verify Current State

```bash
# Check current migration status
supabase migration list

# Output should show all applied migrations with checkmarks
```

### Step 2: Run Bella Auto Foundation (Phase 0)

```bash
# Apply foundation migration
supabase db push --include-all

# Verify tables created
supabase db reset --no-seed
psql $DATABASE_URL -c "\dt auto_*"
```

**Expected Output:**
```
 Schema | Name           | Type  | Owner
--------+----------------+-------+--------
 public | auto_brands    | table | postgres
 public | auto_models    | table | postgres
 public | auto_variants  | table | postgres
```

### Step 3: Run Phase 1-7 (Core Module)

```bash
# Push all migrations
supabase db push

# Generate TypeScript types
npm run supabase:gen-types

# Verify types generated
cat src/types/database.types.ts | grep "auto_"
```

### Step 4: Run Analytics & Workshop Migrations

```bash
# Apply analytics RPCs
supabase db push

# Test RPC functions
supabase db execute "SELECT * FROM get_auto_inventory_trend('YOUR_TENANT_ID')"
```

### Step 5: Seed Demo Data (Optional)

```sql
-- Insert demo brands
INSERT INTO auto_brands (tenant_id, name, country_of_origin)
VALUES
  ('YOUR_TENANT_ID', 'Toyota', 'Japan'),
  ('YOUR_TENANT_ID', 'Honda', 'Japan'),
  ('YOUR_TENANT_ID', 'Mercedes-Benz', 'Germany');

-- Insert demo models
INSERT INTO auto_models (tenant_id, brand_id, name, segment)
SELECT 
  'YOUR_TENANT_ID',
  id,
  'Camry',
  'Sedan'
FROM auto_brands WHERE name = 'Toyota';
```

---

## Rollback Procedures

### Emergency Rollback

**⚠️ Only if migration fails mid-way**

```bash
# Restore from backup
psql $DATABASE_URL < backup-20260804.sql

# Or via Supabase Dashboard
# Settings > Database > Backups > Restore
```

### Selective Table Rollback

```sql
-- Drop specific tables (in reverse order)
DROP TABLE IF EXISTS auto_deposits CASCADE;
DROP TABLE IF EXISTS auto_bookings CASCADE;
DROP TABLE IF EXISTS auto_leads CASCADE;
-- ... continue in reverse FK order
```

---

## Verification Checklist

### Post-Migration Checks

- [ ] All `auto_*` tables exist
- [ ] RLS policies active (`SELECT * FROM pg_policies WHERE tablename LIKE 'auto_%'`)
- [ ] Indexes created (`SELECT * FROM pg_indexes WHERE tablename LIKE 'auto_%'`)
- [ ] Foreign keys valid (`SELECT * FROM information_schema.table_constraints WHERE constraint_type = 'FOREIGN KEY'`)
- [ ] RPC functions exist (`SELECT * FROM pg_proc WHERE proname LIKE '%auto%'`)
- [ ] TypeScript types generated
- [ ] Build passes (`npm run build`)
- [ ] No console errors when loading dashboard

### Performance Checks

```sql
-- Check table sizes
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE tablename LIKE 'auto_%'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Check index usage
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan AS index_scans
FROM pg_stat_user_indexes
WHERE tablename LIKE 'auto_%'
ORDER BY idx_scan ASC;
```

---

## Troubleshooting

### Issue 1: Migration fails with "relation already exists"

**Cause:** Migration already partially applied

**Solution:**
```bash
# Check which tables exist
psql $DATABASE_URL -c "\dt auto_*"

# Skip to next migration
supabase migration list  # Find last successful migration
supabase db push --include-all --from <timestamp>
```

### Issue 2: Foreign key constraint violation

**Cause:** Missing parent records

**Solution:**
```sql
-- Check which FKs are missing
SELECT conname, conrelid::regclass, confrelid::regclass
FROM pg_constraint
WHERE contype = 'f' AND conrelid::regclass::text LIKE 'auto_%';

-- Insert missing parent records
-- Example: If auto_models.brand_id references missing brand
INSERT INTO auto_brands (tenant_id, name) VALUES ('...', 'Missing Brand');
```

### Issue 3: RLS policy blocks queries

**Cause:** `app.current_tenant_id` not set

**Solution:**
```sql
-- Set tenant context
SET app.current_tenant_id = 'YOUR_TENANT_ID';

-- Or disable RLS temporarily (DEV ONLY)
ALTER TABLE auto_brands DISABLE ROW LEVEL SECURITY;
```

### Issue 4: Type generation fails

**Cause:** Supabase CLI version mismatch

**Solution:**
```bash
# Update Supabase CLI
npm install -g supabase@latest

# Regenerate types
npm run supabase:gen-types
```

---

## Additional Resources

- [Supabase Migration Docs](https://supabase.com/docs/guides/cli/local-development#database-migrations)
- [PostgreSQL Foreign Keys](https://www.postgresql.org/docs/current/ddl-constraints.html#DDL-CONSTRAINTS-FK)
- [Row Level Security Guide](https://supabase.com/docs/guides/auth/row-level-security)

---

**Last Updated:** 2026-08-04  
**Maintainer:** Bella ERP Development Team
