#!/usr/bin/env node
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pg from 'pg';

const { Client } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Colors
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
};

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSuccess(msg) { log('green', msg); }
function logInfo(msg) { log('cyan', msg); }
function logWarning(msg) { log('yellow', msg); }
function logError(msg) { log('red', msg); }

logInfo('========================================');
logInfo('🚀 Intelligence Layer - All Migrations');
logInfo('========================================');
console.log('');

// Load DB URL
const envPath = join(projectRoot, '.env.local');
const envContent = readFileSync(envPath, 'utf-8');
const DB_URL = envContent.match(/SUPABASE_DB_URL=(.+)/)?.[1]?.trim();

if (!DB_URL) {
  logError('❌ SUPABASE_DB_URL not found in .env.local');
  process.exit(1);
}

logSuccess('✓ Database URL loaded');
console.log('');

// All Intelligence Layer migrations in correct order
const migrations = [
  // Phase 1 & 2: Operational Intelligence (Foundation)
  {
    name: '20260622150000_add_tenants_metadata.sql',
    description: 'Add metadata JSONB to tenants',
    phase: 'Phase 1',
  },
  {
    name: '20260622163000_create_booking_service_items.sql',
    description: 'Booking service items tracking',
    phase: 'Phase 1',
  },
  {
    name: '20260622164000_create_product_sales.sql',
    description: 'Product sales tracking',
    phase: 'Phase 1',
  },
  {
    name: '20260622165000_create_salary_adjustments.sql',
    description: 'Salary adjustments tracking',
    phase: 'Phase 1',
  },
  {
    name: '20260622170000_extend_salary_records_commission.sql',
    description: 'Extend salary_records with commission fields',
    phase: 'Phase 1',
  },
  {
    name: '20260622171000_extend_users_position_tier.sql',
    description: 'Add position/tier to users',
    phase: 'Phase 1',
  },
  {
    name: '20260622172000_extend_tenants_commission_config.sql',
    description: 'Add commission config to tenants',
    phase: 'Phase 1',
  },
  
  // Phase 2: Materialized Views
  {
    name: '20260622180000_create_mv_ktv_performance_summary.sql',
    description: 'KTV Performance Summary MV',
    phase: 'Phase 2',
  },
  {
    name: '20260622181000_create_mv_inventory_status.sql',
    description: 'Inventory Status MV',
    phase: 'Phase 2',
  },
  {
    name: '20260622182000_create_mv_session_analytics.sql',
    description: 'Session Analytics MV',
    phase: 'Phase 2',
  },
  {
    name: '20260622183000_create_mv_refresh_jobs.sql',
    description: 'MV Refresh Cron Jobs (Phase 1 & 2)',
    phase: 'Phase 2',
  },
  
  // Phase 3: Marketing Intelligence (already applied, just need to record)
  {
    name: '20260622200000_create_external_ads_data.sql',
    description: 'External Ads Data Table',
    phase: 'Phase 3 (record only)',
  },
  {
    name: '20260622201000_create_marketing_campaigns.sql',
    description: 'Marketing Campaigns Table',
    phase: 'Phase 3 (record only)',
  },
  {
    name: '20260622202000_create_mv_campaign_performance.sql',
    description: 'Campaign Performance MV',
    phase: 'Phase 3 (record only)',
  },
  {
    name: '20260622203000_create_mv_channel_performance.sql',
    description: 'Channel Performance MV',
    phase: 'Phase 3 (record only)',
  },
  {
    name: '20260622204000_create_mv_marketing_refresh_jobs.sql',
    description: 'Marketing MV Refresh Jobs',
    phase: 'Phase 3 (record only)',
  },
];

// Track results
const results = [];
let successCount = 0;
let failCount = 0;
let skippedCount = 0;
let recordedCount = 0;

// Execute migrations
async function applyMigrations() {
  const client = new Client({
    connectionString: DB_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    logInfo('🔌 Connecting to database...');
    await client.connect();
    logSuccess('✓ Connected');
    console.log('');

    logInfo('📦 Processing migrations...');
    console.log('');

    for (const migration of migrations) {
      const migrationPath = join(projectRoot, 'supabase', 'migrations', migration.name);
      const version = migration.name.replace('.sql', '');

      logInfo('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      logInfo(`${migration.phase}: ${migration.name}`);
      logInfo(`Description: ${migration.description}`);
      console.log('');

      // Check if already applied
      const checkRes = await client.query(`
        SELECT version FROM supabase_migrations.schema_migrations WHERE version = $1
      `, [version]);

      if (checkRes.rows.length > 0) {
        logWarning(`   ⏭  Already recorded in migration history`);
        skippedCount++;
        results.push({
          migration: migration.name,
          success: true,
          skipped: true,
        });
        console.log('');
        continue;
      }

      // Check if file exists
      if (!existsSync(migrationPath)) {
        logError(`❌ Migration file not found: ${migrationPath}`);
        failCount++;
        results.push({
          migration: migration.name,
          success: false,
          error: 'File not found',
        });
        console.log('');
        continue;
      }

      // Read SQL content
      const sql = readFileSync(migrationPath, 'utf-8');

      // For Phase 3 migrations, just record them (already applied manually)
      if (migration.phase.includes('record only')) {
        logInfo(`🔧 Recording migration in history (already applied manually)`);
        
        try {
          await client.query(`
            INSERT INTO supabase_migrations.schema_migrations (version, statements, name)
            VALUES ($1, ARRAY['-- Applied manually via scripts/apply-marketing-migrations.mjs'], $2)
            ON CONFLICT DO NOTHING
          `, [version, migration.description]);
          
          logSuccess(`   ✓ Recorded in migration history`);
          recordedCount++;
          results.push({
            migration: migration.name,
            success: true,
            recorded: true,
          });
        } catch (error) {
          logError(`   ✗ Failed to record: ${error.message}`);
          failCount++;
          results.push({
            migration: migration.name,
            success: false,
            error: error.message,
          });
        }
      } else {
        // For Phase 1 & 2 migrations, execute them
        logInfo(`🔧 Executing: ${migration.description}`);
        
        try {
          const startTime = Date.now();
          await client.query(sql);
          const duration = Date.now() - startTime;

          // Record in migration history
          await client.query(`
            INSERT INTO supabase_migrations.schema_migrations (version, statements, name)
            VALUES ($1, ARRAY['-- Applied via scripts/apply-all-intelligence-migrations.mjs'], $2)
            ON CONFLICT DO NOTHING
          `, [version, migration.description]);

          logSuccess(`   ✓ Success (${duration}ms)`);
          successCount++;
          results.push({
            migration: migration.name,
            success: true,
            duration,
          });
        } catch (error) {
          logError(`   ✗ Failed: ${error.message}`);
          if (error.detail) {
            logError(`     Detail: ${error.detail}`);
          }
          if (error.hint) {
            logWarning(`     Hint: ${error.hint}`);
          }
          
          failCount++;
          results.push({
            migration: migration.name,
            success: false,
            error: error.message,
          });
        }
      }

      console.log('');
    }
  } catch (error) {
    logError(`❌ Connection error: ${error.message}`);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Run migrations
await applyMigrations();

// Summary
logInfo('========================================');
logInfo('📊 MIGRATION SUMMARY');
logInfo('========================================');
console.log('');
console.log(`Total Migrations: ${migrations.length}`);
logSuccess(`✓ Applied: ${successCount}`);
logInfo(`📝 Recorded: ${recordedCount} (Phase 3 - already applied manually)`);
logWarning(`⏭  Skipped: ${skippedCount} (already in history)`);
if (failCount > 0) {
  logError(`✗ Failed: ${failCount}`);
}
console.log('');

// Detailed results
if (failCount > 0) {
  logWarning('Failed migrations:');
  for (const result of results) {
    if (!result.success) {
      logError(`  ✗ ${result.migration}: ${result.error}`);
    }
  }
  console.log('');
}

// Exit code
if (failCount > 0) {
  logError('❌ Some migrations failed. Please check errors above.');
  process.exit(1);
} else {
  logSuccess('✅ All Intelligence Layer migrations processed successfully!');
  
  console.log('');
  logInfo('🧪 Next steps:');
  logInfo('  1. Run: node scripts/verify-all-intelligence-migrations.mjs');
  logInfo('  2. Test: npm.cmd run dev and verify APIs work');
  logInfo('  3. Commit and push changes');

  process.exit(0);
}
