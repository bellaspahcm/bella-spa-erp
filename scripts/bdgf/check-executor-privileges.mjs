#!/usr/bin/env node
/**
 * Check bella_migration_executor privileges
 * CRITICAL: Verify executor cannot modify approval table
 */

import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';

dotenv.config();

async function checkPrivileges() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  
  try {
    await client.connect();
    console.log('╔════════════════════════════════════════════════════════════════════════════════╗');
    console.log('║ CRITICAL SECURITY CHECK: bella_migration_executor Privileges                  ║');
    console.log('╚════════════════════════════════════════════════════════════════════════════════╝\n');
    
    // Check CREATEDB
    const createdbResult = await client.query(`
      SELECT rolcreatedb FROM pg_roles WHERE rolname = 'bella_migration_executor'
    `);
    
    console.log('🔴 ISSUE #1: CREATEDB Privilege');
    console.log(`   Current: ${createdbResult.rows[0].rolcreatedb ? '✅ HAS CREATEDB (UNNECESSARY)' : '❌ NO CREATEDB (CORRECT)'}`);
    console.log(`   Risk: ${createdbResult.rows[0].rolcreatedb ? 'Executor can create new databases' : 'None'}`);
    console.log();
    
    // Check privileges on migration_governance.approvals
    const approvalsPrivResult = await client.query(`
      SELECT privilege_type
      FROM information_schema.table_privileges
      WHERE grantee = 'bella_migration_executor'
        AND table_schema = 'migration_governance'
        AND table_name = 'approvals'
      ORDER BY privilege_type
    `);
    
    console.log('🔴 ISSUE #2: Privileges on migration_governance.approvals');
    if (approvalsPrivResult.rows.length > 0) {
      console.log('   Current privileges:');
      approvalsPrivResult.rows.forEach(row => {
        const dangerous = ['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE'].includes(row.privilege_type);
        console.log(`     ${dangerous ? '⚠️ ' : '  '} ${row.privilege_type} ${dangerous ? '(DANGEROUS)' : ''}`);
      });
      
      const hasUpdate = approvalsPrivResult.rows.find(r => r.privilege_type === 'UPDATE');
      const hasDelete = approvalsPrivResult.rows.find(r => r.privilege_type === 'DELETE');
      const hasInsert = approvalsPrivResult.rows.find(r => r.privilege_type === 'INSERT');
      
      if (hasUpdate || hasDelete || hasInsert) {
        console.log('\n   🚨 CRITICAL: Executor can modify approval table');
        console.log('   Risk: Executor → sửa approval → tạo điều kiện hợp lệ → bypass R2');
        console.log('   Violation: "Người thực thi không được tự quyết định quyền được thực thi"');
      }
    } else {
      console.log('   ✅ No privileges on approvals table');
    }
    console.log();
    
    // Check privileges on migration_governance.role_usage_audit
    const auditPrivResult = await client.query(`
      SELECT privilege_type
      FROM information_schema.table_privileges
      WHERE grantee = 'bella_migration_executor'
        AND table_schema = 'migration_governance'
        AND table_name = 'role_usage_audit'
      ORDER BY privilege_type
    `);
    
    console.log('✅ Privileges on migration_governance.role_usage_audit (should have INSERT):');
    if (auditPrivResult.rows.length > 0) {
      auditPrivResult.rows.forEach(row => {
        console.log(`     - ${row.privilege_type}`);
      });
    } else {
      console.log('   ⚠️  No privileges (executor cannot audit)');
    }
    console.log();
    
    console.log('═══════════════════════════════════════════════════════════════════════════════');
    console.log('RECOMMENDATION:');
    console.log('  1. REVOKE CREATEDB from bella_migration_executor');
    console.log('  2. REVOKE INSERT, UPDATE, DELETE on migration_governance.approvals');
    console.log('  3. GRANT SELECT only on migration_governance.approvals (for verify_approval)');
    console.log('  4. Keep INSERT on migration_governance.role_usage_audit (for auditing)');
    console.log('═══════════════════════════════════════════════════════════════════════════════\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

checkPrivileges();
