#!/usr/bin/env node
import { readFileSync } from 'fs';
import pg from 'pg';

const env = readFileSync('.env.local', 'utf-8');
const url = env.match(/SUPABASE_DB_URL=(.+)/)[1].trim();
const client = new pg.Client({connectionString: url, ssl: {rejectUnauthorized: false}});

await client.connect();

console.log('========================================');
console.log('🔍 Checking Intelligence Layer Migrations');
console.log('========================================\n');

// Intelligence Layer Phase 1 & 2 migrations (from file list)
const intelligenceMigrations = [
  // Phase 1 & 2: Operational Intelligence
  '20260622150000_add_tenants_metadata.sql',
  '20260622163000_create_booking_service_items.sql',
  '20260622164000_create_product_sales.sql',
  '20260622165000_create_salary_adjustments.sql',
  '20260622170000_extend_salary_records_commission.sql',
  '20260622171000_extend_users_position_tier.sql',
  '20260622172000_extend_tenants_commission_config.sql',
  '20260622180000_create_mv_ktv_performance_summary.sql',
  '20260622181000_create_mv_inventory_status.sql',
  '20260622182000_create_mv_session_analytics.sql',
  '20260622183000_create_mv_refresh_jobs.sql',
  
  // Phase 3: Marketing Intelligence (already done)
  '20260622200000_create_external_ads_data.sql',
  '20260622201000_create_marketing_campaigns.sql',
  '20260622202000_create_mv_campaign_performance.sql',
  '20260622203000_create_mv_channel_performance.sql',
  '20260622204000_create_mv_marketing_refresh_jobs.sql',
];

console.log('📋 Intelligence Layer Migrations:\n');

for (const migration of intelligenceMigrations) {
  const version = migration.replace('.sql', '');
  
  // Check if migration exists in Supabase migration history
  const res = await client.query(`
    SELECT version, name 
    FROM supabase_migrations.schema_migrations 
    WHERE version = $1
  `, [version]);
  
  const status = res.rows.length > 0 ? '✅ Applied' : '❌ Not applied';
  const color = res.rows.length > 0 ? '\x1b[32m' : '\x1b[31m';
  
  console.log(`${color}${status}\x1b[0m ${migration}`);
}

console.log('\n========================================');
console.log('📊 Summary');
console.log('========================================\n');

// Count applied vs not applied
const applied = [];
const notApplied = [];

for (const migration of intelligenceMigrations) {
  const version = migration.replace('.sql', '');
  const res = await client.query(`
    SELECT version FROM supabase_migrations.schema_migrations WHERE version = $1
  `, [version]);
  
  if (res.rows.length > 0) {
    applied.push(migration);
  } else {
    notApplied.push(migration);
  }
}

console.log(`✅ Applied: ${applied.length}/${intelligenceMigrations.length}`);
console.log(`❌ Not Applied: ${notApplied.length}/${intelligenceMigrations.length}`);

if (notApplied.length > 0) {
  console.log('\n❌ Migrations that need to be applied:');
  notApplied.forEach(m => console.log(`  - ${m}`));
}

await client.end();
