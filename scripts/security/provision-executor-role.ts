/**
 * Provision verification_executor role
 * 
 * Executes Steps 1-5 from VERIFICATION_EXECUTOR_SECURITY_SPEC.md
 * 
 * WARNING: This script creates a new database role. 
 * Run only once or will fail if role already exists.
 */
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import { randomBytes } from 'crypto';

dotenv.config({ path: '.env.local' });

async function provisionRole() {
  console.log('🔐 Provisioning verification_executor Role\n');
  console.log('Reference: docs/security/VERIFICATION_EXECUTOR_SECURITY_SPEC.md');
  console.log('Steps: 1-5\n');
  
  const pool = new Pool({ connectionString: process.env.SUPABASE_DB_URL });

  try {
    // Generate secure password
    const password = randomBytes(32).toString('base64');
    console.log('✅ Step 0: Generated secure password (32 bytes)\n');
    
    // Step 1: Create role
    console.log('▶ Step 1: Create verification_executor role...');
    await pool.query(`
      CREATE ROLE verification_executor WITH 
        LOGIN 
        PASSWORD '${password}'
        NOSUPERUSER 
        NOCREATEDB 
        NOCREATEROLE 
        NOREPLICATION 
        INHERIT
    `);
    console.log('  ✅ Role created\n');
    
    // Step 2: Grant schema privileges
    console.log('▶ Step 2: Grant schema privileges...');
    await pool.query(`
      GRANT USAGE ON SCHEMA public TO verification_executor;
      REVOKE CREATE ON SCHEMA public FROM verification_executor;
    `);
    console.log('  ✅ USAGE granted, CREATE revoked\n');
    
    // Step 3: Grant table privileges
    console.log('▶ Step 3: Grant table privileges...');
    await pool.query(`
      -- Read-only on application tables
      GRANT SELECT ON ALL TABLES IN SCHEMA public TO verification_executor;
      
      -- Apply to future tables
      ALTER DEFAULT PRIVILEGES IN SCHEMA public
        GRANT SELECT ON TABLES TO verification_executor;
      
      -- Explicitly deny writes
      REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA public FROM verification_executor;
      
      ALTER DEFAULT PRIVILEGES IN SCHEMA public
        REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLES FROM verification_executor;
    `);
    console.log('  ✅ SELECT granted on all tables\n');
    console.log('  ✅ INSERT/UPDATE/DELETE/TRUNCATE revoked\n');
    
    // Step 4: Create evidence table
    console.log('▶ Step 4: Create verification_evidence table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS verification_evidence (
        id BIGSERIAL PRIMARY KEY,
        verification_id UUID NOT NULL UNIQUE,
        migration_id TEXT NOT NULL,
        commit_sha TEXT NOT NULL,
        approval_id TEXT,
        environment TEXT NOT NULL,
        overall_result TEXT NOT NULL CHECK (overall_result IN ('PASS', 'WARNING', 'FAIL', 'ERROR')),
        deployment_eligible BOOLEAN NOT NULL,
        evidence_json JSONB NOT NULL,
        execution_time_ms INTEGER,
        timestamp TIMESTAMPTZ DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS idx_verification_evidence_migration 
        ON verification_evidence(migration_id);
      CREATE INDEX IF NOT EXISTS idx_verification_evidence_commit 
        ON verification_evidence(commit_sha);
      CREATE INDEX IF NOT EXISTS idx_verification_evidence_timestamp 
        ON verification_evidence(timestamp DESC);
      
      COMMENT ON TABLE verification_evidence IS 'Phase 4B.3 Verification Evidence - Immutable audit trail';
    `);
    console.log('  ✅ Evidence table created with indexes\n');
    
    // Step 5: Grant evidence table privileges
    console.log('▶ Step 5: Grant evidence table privileges...');
    await pool.query(`
      -- Append-only access
      GRANT INSERT, SELECT ON verification_evidence TO verification_executor;
      REVOKE UPDATE, DELETE, TRUNCATE ON verification_evidence FROM verification_executor;
      
      -- Sequence usage
      GRANT USAGE ON SEQUENCE verification_evidence_id_seq TO verification_executor;
    `);
    console.log('  ✅ INSERT+SELECT granted on evidence table\n');
    console.log('  ✅ UPDATE/DELETE/TRUNCATE revoked\n');
    
    console.log('='.repeat(60));
    console.log('✅ PROVISIONING COMPLETE\n');
    console.log('verification_executor role configured with:');
    console.log('  - Read-only access to application tables');
    console.log('  - Append-only access to verification_evidence');
    console.log('  - No superuser or RLS bypass privileges');
    console.log('  - No schema modification privileges\n');
    
    console.log('📝 IMPORTANT: Save connection string securely:');
    console.log('');
    console.log('DATABASE_EXECUTOR_URL=postgresql://verification_executor:' + password + '@' + extractHost() + '?sslmode=require');
    console.log('');
    console.log('⚠️  Store this in:');
    console.log('  1. GitHub Secrets: gh secret set DATABASE_EXECUTOR_URL');
    console.log('  2. .env.local (local testing only, DO NOT COMMIT)');
    console.log('');
    console.log('Next Step: Run security verification');
    console.log('  npx tsx scripts/security/verify-executor-role.ts');
    
  } catch (error) {
    if (error instanceof Error && error.message.includes('already exists')) {
      console.error('❌ Role verification_executor already exists');
      console.error('');
      console.error('If you need to recreate:');
      console.error('  1. DROP ROLE verification_executor; (admin access required)');
      console.error('  2. Re-run this script');
      console.error('');
      console.error('Or skip to verification:');
      console.error('  npx tsx scripts/security/verify-executor-role.ts');
    } else {
      console.error('❌ Error:', error instanceof Error ? error.message : String(error));
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

function extractHost(): string {
  const url = process.env.SUPABASE_DB_URL || '';
  const match = url.match(/@([^:]+):(\d+)\//);
  if (match) {
    return `${match[1]}:${match[2]}/postgres`;
  }
  return 'HOST:5432/DATABASE';
}

provisionRole();
