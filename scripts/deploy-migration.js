#!/usr/bin/env node
/**
 * Auto-deploy migration to Supabase via REST API
 * Usage: node scripts/deploy-migration.js
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Missing env vars: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Extract project ref from URL
const PROJECT_REF = SUPABASE_URL.replace('https://', '').split('.')[0];
console.log(`📡 Project: ${PROJECT_REF}`);

// Read migration file
const MIGRATION_FILE = path.join(__dirname, '../supabase/migrations/20260802112935_partner_registration_system.sql');
const migrationSQL = fs.readFileSync(MIGRATION_FILE, 'utf8');

console.log(`📄 Migration file: ${MIGRATION_FILE}`);
console.log(`📦 Size: ${(migrationSQL.length / 1024).toFixed(2)} KB`);

// Execute SQL via REST API
async function executeMigration() {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      query: migrationSQL
    });

    const options = {
      hostname: `${PROJECT_REF}.supabase.co`,
      port: 443,
      path: '/rest/v1/rpc/exec_sql',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'Prefer': 'return=minimal'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log(`✅ Migration deployed successfully!`);
          console.log(`   Status: ${res.statusCode}`);
          resolve(data);
        } else {
          console.error(`❌ Deploy failed with status ${res.statusCode}`);
          console.error(`   Response: ${data}`);
          reject(new Error(`Status ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', (error) => {
      console.error('❌ Request error:', error.message);
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

// Alternative: Use psql command
async function executeViaPsql() {
  const { execSync } = require('child_process');
  
  const DB_URL = process.env.SUPABASE_DB_URL;
  if (!DB_URL) {
    throw new Error('SUPABASE_DB_URL not found in .env.local');
  }

  console.log('🔧 Deploying via psql...');
  
  try {
    const output = execSync(`psql "${DB_URL}" -f "${MIGRATION_FILE}"`, {
      encoding: 'utf8',
      stdio: 'pipe'
    });
    
    console.log('✅ Migration deployed successfully!');
    console.log(output);
    return output;
  } catch (error) {
    console.error('❌ psql error:', error.stderr || error.message);
    throw error;
  }
}

// Main
async function main() {
  console.log('🚀 Starting migration deployment...\n');

  try {
    // Try psql first (more reliable)
    if (process.env.SUPABASE_DB_URL) {
      await executeViaPsql();
    } else {
      console.log('⚠️  SUPABASE_DB_URL not found, trying REST API...');
      await executeMigration();
    }
    
    console.log('\n🎉 Done! Next steps:');
    console.log('   1. Verify: npx supabase migration list --linked');
    console.log('   2. Regen types: npm run db:types');
    console.log('   3. Build: npm run build');
    
  } catch (error) {
    console.error('\n💥 Deployment failed:', error.message);
    console.log('\n📝 Manual deployment:');
    console.log(`   1. Open: ${SUPABASE_URL.replace('.supabase.co', '')}.supabase.co/project/${PROJECT_REF}/sql/new`);
    console.log(`   2. Copy: ${MIGRATION_FILE}`);
    console.log('   3. Paste & Run');
    process.exit(1);
  }
}

main();
