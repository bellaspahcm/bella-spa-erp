/**
 * Check if current database connection has admin privileges
 * to create verification_executor role
 */
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function checkAdminAccess() {
  console.log('🔍 Checking database admin access...\n');
  
  const pool = new Pool({ connectionString: process.env.SUPABASE_DB_URL });

  try {
    // Check current role
    const currentRole = await pool.query('SELECT current_user, current_database()');
    console.log('Current User:', currentRole.rows[0].current_user);
    console.log('Current Database:', currentRole.rows[0].current_database);
    console.log('');
    
    // Check if can create roles
    const roleCheck = await pool.query(`
      SELECT 
        rolname,
        rolsuper,
        rolcreaterole
      FROM pg_roles
      WHERE rolname = current_user
    `);
    
    const role = roleCheck.rows[0];
    console.log('Role Attributes:');
    console.log('  Superuser:', role.rolsuper ? '✅ YES' : '❌ NO');
    console.log('  Can Create Roles:', role.rolcreaterole ? '✅ YES' : '❌ NO');
    console.log('');
    
    if (role.rolsuper || role.rolcreaterole) {
      console.log('✅ ADMIN ACCESS CONFIRMED — Can provision verification_executor');
      process.exit(0);
    } else {
      console.log('❌ INSUFFICIENT PRIVILEGES — Cannot create roles');
      console.log('');
      console.log('Action Required:');
      console.log('  - Use Supabase Dashboard → SQL Editor');
      console.log('  - SQL Editor runs with admin privileges');
      console.log('  - Copy provisioning script from:');
      console.log('    docs/security/VERIFICATION_EXECUTOR_SECURITY_SPEC.md');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  } finally {
    await pool.end();
  }
}

checkAdminAccess();
