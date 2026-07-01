#!/usr/bin/env node
/**
 * Automated Marketing Intelligence Migrations
 * 
 * Applies 5 Marketing Intelligence migrations directly to Supabase PostgreSQL
 * using the 'pg' library (already installed in node_modules).
 * 
 * Usage:
 *   node scripts/apply-marketing-migrations.mjs [--dry-run]
 * 
 * Requirements:
 *   - SUPABASE_DB_URL in .env.local
 *   - pg library (already installed)
 */

import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pg from 'pg';

const { Client } = pg;

// Get script directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Colors for terminal output
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

// Parse args
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

logInfo('========================================');
logInfo('🚀 Marketing Intelligence Migrations');
logInfo('========================================');
console.log('');

// Load environment variables
const envPath = join(projectRoot, '.env.local');
if (!existsSync(envPath)) {
  logError('❌ .env.local not found!');
  process.exit(1);
}

logInfo('📂 Loading environment variables...');
const envContent = readFileSync(envPath, 'utf-8');
const DB_URL = envContent.match(/SUPABASE_DB_URL=(.+)/)?.[1]?.trim();

if (!DB_URL) {
  logError('❌ SUPABASE_DB_URL not found in .env.local');
  process.exit(1);
}

logSuccess('✓ Database URL loaded');
console.log('');

// Migration files in order
const migrations = [
  {
    name: '20260622200000_create_external_ads_data.sql',
    description: 'External Ads Data Table',
  },
  {
    name: '20260622201000_create_marketing_campaigns.sql',
    description: 'Marketing Campaigns Table',
  },
  {
    name: '20260622202000_create_mv_campaign_performance.sql',
    description: 'Campaign Performance Materialized View',
  },
  {
    name: '20260622203000_create_mv_channel_performance.sql',
    description: 'Channel Performance Materialized View',
  },
  {
    name: '20260622204000_create_mv_marketing_refresh_jobs.sql',
    description: 'Auto-Refresh Cron Jobs',
  },
];

// Track results
const results = [];
let successCount = 0;
let failCount = 0;

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

    logInfo('📦 Applying migrations...');
    console.log('');

    for (const migration of migrations) {
      const migrationPath = join(projectRoot, 'supabase', 'migrations', migration.name);

      logInfo('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      logInfo(`Migration: ${migration.name}`);
      logInfo(`Description: ${migration.description}`);
      console.log('');

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

      if (dryRun) {
        logWarning(`   [DRY RUN] Would execute SQL (${sql.length} chars)`);
        successCount++;
        results.push({
          migration: migration.name,
          success: true,
          dryRun: true,
        });
        console.log('');
        continue;
      }

      // Execute migration
      try {
        logInfo(`🔧 Executing: ${migration.description}`);
        
        const startTime = Date.now();
        await client.query(sql);
        const duration = Date.now() - startTime;

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
logSuccess(`✓ Success: ${successCount}`);
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
  logError('❌ Migration failed. Please check errors above.');
  process.exit(1);
} else {
  logSuccess('✅ All migrations applied successfully!');

  if (!dryRun) {
    console.log('');
    logInfo('🧪 Next steps:');
    logInfo('  1. Run: npm.cmd run test:marketing');
    logInfo('  2. Verify: Check Supabase Dashboard → Database → Tables');
    logInfo('  3. Test: Insert sample data and test APIs');
  }

  process.exit(0);
}
