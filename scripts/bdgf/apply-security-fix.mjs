#!/usr/bin/env node
import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  
  try {
    await client.connect();
    console.log('╔════════════════════════════════════════════════════════════════════════════════╗');
    console.log('║ APPLYING R3 SECURITY FIX                                                      ║');
    console.log('╚════════════════════════════════════════════════════════════════════════════════╝\n');
    
    const fixSQL = fs.readFileSync('supabase/migrations/20260820120000_fix_executor_privileges.sql', 'utf8');
    
    console.log('Applying security fix...\n');
    await client.query(fixSQL);
    await client.query("INSERT INTO supabase_migrations.schema_migrations(version, name, statements) VALUES('20260820120000', 'fix_executor_privileges', ARRAY['Security fix']) ON CONFLICT DO NOTHING");
    
    console.log('✅ Security fix applied\n');
    console.log('═══════════════════════════════════════════════════════════════════════════════');
    console.log('VERIFICATION:\n');
    
    // Verify CREATEDB removed
    const createdbResult = await client.query(`
      SELECT rolcreatedb FROM pg_roles WHERE rolname = 'bella_migration_executor'
    `);
    console.log(`1. CREATEDB: ${createdbResult.rows[0].rolcreatedb ? '❌ STILL HAS' : '✅ REMOVED'}`);
    
    // Verify approvals privileges
    const approvalsPriv = await client.query(`
      SELECT privilege_type FROM information_schema.table_privileges 
      WHERE grantee = 'bella_migration_executor' 
        AND table_schema = 'migration_governance' 
        AND table_name = 'approvals'
      ORDER BY privilege_type
    `);
    
    console.log('\n2. Privileges on migration_governance.approvals:');
    if (approvalsPriv.rows.length > 0) {
      const dangerous = approvalsPriv.rows.filter(r => ['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE'].includes(r.privilege_type));
      if (dangerous.length > 0) {
        console.log('   ❌ STILL HAS DANGEROUS PRIVILEGES:');
        dangerous.forEach(r => console.log(`      - ${r.privilege_type}`));
      } else {
        console.log('   ✅ Only safe privileges:');
        approvalsPriv.rows.forEach(r => console.log(`      - ${r.privilege_type}`));
      }
    }
    
    // Verify audit privileges
    const auditPriv = await client.query(`
      SELECT privilege_type FROM information_schema.table_privileges 
      WHERE grantee = 'bella_migration_executor' 
        AND table_schema = 'migration_governance' 
        AND table_name = 'role_usage_audit'
      ORDER BY privilege_type
    `);
    
    console.log('\n3. Privileges on migration_governance.role_usage_audit:');
    auditPriv.rows.forEach(r => console.log(`   - ${r.privilege_type}`));
    
    const hasDangerousAudit = auditPriv.rows.find(r => ['UPDATE', 'DELETE', 'TRUNCATE'].includes(r.privilege_type));
    if (hasDangerousAudit) {
      console.log('   ⚠️  Has unnecessary privileges (UPDATE/DELETE/TRUNCATE)');
    } else {
      console.log('   ✅ Correct (SELECT, INSERT only)');
    }
    
    console.log('\n═══════════════════════════════════════════════════════════════════════════════');
    console.log('✅ R3 SECURITY FIX COMPLETE\n');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
