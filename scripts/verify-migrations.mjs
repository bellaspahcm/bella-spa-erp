#!/usr/bin/env node
import { readFileSync } from 'fs';
import pg from 'pg';

const env = readFileSync('.env.local', 'utf-8');
const url = env.match(/SUPABASE_DB_URL=(.+)/)[1].trim();
const client = new pg.Client({connectionString: url, ssl: {rejectUnauthorized: false}});

await client.connect();

console.log('========================================');
console.log('🔍 Verifying Marketing Intelligence Schema');
console.log('========================================\n');

// Check tables
console.log('📊 Tables:');
const tables = await client.query(`
  SELECT table_name 
  FROM information_schema.tables 
  WHERE table_schema='public' 
    AND table_name IN ('external_ads_data', 'marketing_campaigns')
  ORDER BY table_name
`);
tables.rows.forEach(row => console.log('  ✓', row.table_name));

// Check materialized views
console.log('\n📊 Materialized Views:');
const mvs = await client.query(`
  SELECT matviewname, ispopulated 
  FROM pg_matviews 
  WHERE schemaname='public'
    AND matviewname IN ('mv_campaign_performance', 'mv_channel_performance')
  ORDER BY matviewname
`);
mvs.rows.forEach(row => console.log(`  ✓ ${row.matviewname} (populated: ${row.ispopulated})`));

// Check functions
console.log('\n📊 Functions:');
const funcs = await client.query(`
  SELECT routine_name 
  FROM information_schema.routines 
  WHERE routine_schema='public'
    AND routine_name IN (
      'has_external_mapping',
      'get_external_campaign_id',
      'refresh_marketing_materialized_views',
      'refresh_all_intelligence_materialized_views'
    )
  ORDER BY routine_name
`);
funcs.rows.forEach(row => console.log('  ✓', row.routine_name));

// Check cron jobs
console.log('\n📊 Cron Jobs:');
try {
  const crons = await client.query(`
    SELECT jobname, schedule, active 
    FROM cron.job 
    WHERE jobname LIKE '%campaign%' OR jobname LIKE '%channel%'
    ORDER BY jobname
  `);
  if (crons.rows.length > 0) {
    crons.rows.forEach(row => console.log(`  ✓ ${row.jobname} (${row.schedule}, active: ${row.active})`));
  } else {
    console.log('  (no matching cron jobs found)');
  }
} catch (err) {
  console.log('  ⚠️  Could not query cron.job (pg_cron extension may not be enabled)');
}

// Check indexes
console.log('\n📊 Indexes:');
const indexes = await client.query(`
  SELECT tablename, COUNT(*) as index_count
  FROM pg_indexes
  WHERE schemaname='public'
    AND tablename IN ('external_ads_data', 'marketing_campaigns', 
                      'mv_campaign_performance', 'mv_channel_performance')
  GROUP BY tablename
  ORDER BY tablename
`);
indexes.rows.forEach(row => console.log(`  ✓ ${row.tablename}: ${row.index_count} indexes`));

console.log('\n========================================');
console.log('✅ Migration verification complete!');
console.log('========================================\n');

await client.end();
