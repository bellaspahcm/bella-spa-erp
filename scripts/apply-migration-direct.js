/**
 * Apply migration directly to database using executor connection
 */

const { readFileSync, existsSync } = require('fs');
const { resolve } = require('path');
const { Client } = require('pg');

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return {};
  
  const text = readFileSync(filePath, 'utf8');
  const vars = {};
  
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (!match) continue;
    
    const key = match[1];
    const rawValue = match[2].trim();
    const value = (
      (rawValue.startsWith('"') && rawValue.endsWith('"')) ||
      (rawValue.startsWith("'") && rawValue.endsWith("'"))
    ) ? rawValue.slice(1, -1) : rawValue;
    
    vars[key] = value;
  }
  
  return vars;
}

async function main() {
  const envLocalPath = resolve(process.cwd(), '.env.local');
  const envLocal = loadEnvFile(envLocalPath);
  
  const connectionString = envLocal.DATABASE_EXECUTOR_URL;
  
  if (!connectionString) {
    console.error('❌ DATABASE_EXECUTOR_URL not found in .env.local');
    process.exit(1);
  }
  
  console.log('🔧 Applying Migration: fix_real_estate_projects_anon_privilege\n');
  
  const migrationPath = resolve(process.cwd(), 'supabase/migrations/20260906010000_fix_real_estate_projects_anon_privilege.sql');
  const migrationSQL = readFileSync(migrationPath, 'utf8');
  
  console.log('Migration SQL:');
  console.log('─'.repeat(60));
  console.log(migrationSQL);
  console.log('─'.repeat(60));
  console.log('');
  
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('✅ Connected\n');
    
    console.log('Executing migration...');
    const result = await client.query(migrationSQL);
    console.log('✅ Migration applied successfully\n');
    
    if (result.length > 0 && result[0].rows) {
      console.log('Result:', result[0].rows);
    }
    
    // Verify privilege was granted
    console.log('Verifying privilege grant...');
    const verifySQL = `
      SELECT grantee, privilege_type
      FROM information_schema.role_table_grants
      WHERE table_schema = 'public'
        AND table_name = 'real_estate_projects'
        AND grantee = 'anon';
    `;
    
    const verifyResult = await client.query(verifySQL);
    
    if (verifyResult.rows.length > 0) {
      console.log('✅ Privileges granted to anon:');
      verifyResult.rows.forEach(row => {
        console.log(`   - ${row.privilege_type}`);
      });
      console.log('');
    } else {
      console.log('⚠️  No privileges found for anon role (may need connection pool refresh)\n');
    }
    
    console.log('=== Migration Complete ===\n');
    console.log('Next: Rerun E2E tests to verify fix');
    
  } catch (err) {
    console.error('❌ Error:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
