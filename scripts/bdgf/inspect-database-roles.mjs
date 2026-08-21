#!/usr/bin/env node
/**
 * BDGF — INSPECT DATABASE ROLES & PRIVILEGES
 * 
 * Purpose: Understand current credential → role → privilege chain BEFORE R3 changes
 * Phase: R3 Remediation (Database Role Separation)
 * 
 * Inspects:
 *   1. Current connection identity (who am I?)
 *   2. Current role privileges (what can I do?)
 *   3. Existing database roles
 *   4. Mutation capability test (non-destructive)
 * 
 * Usage:
 *   node scripts/bdgf/inspect-database-roles.mjs
 */

import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';

dotenv.config();

async function inspectRoles() {
  console.log('╔══════════════════════════════════════════════════════════════════════════════╗');
  console.log('║ BDGF — INSPECT DATABASE ROLES & PRIVILEGES                                   ║');
  console.log('╠══════════════════════════════════════════════════════════════════════════════╣');
  console.log('║ Purpose: Understand CURRENT credential → role → privilege chain             ║');
  console.log('║ Phase: R3 Remediation (BEFORE making changes)                               ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════════╝\n');

  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  try {
    await client.connect();
    console.log('✅ Database connection established\n');

    // ========================================================================
    // CHECK 1: Current Connection Identity
    // ========================================================================
    console.log('CHECK 1: Current Connection Identity\n');
    
    const identityResult = await client.query(`
      SELECT 
        current_user as role,
        current_database() as database,
        inet_server_addr() as server_addr,
        inet_server_port() as server_port,
        version() as postgres_version
    `);
    
    const identity = identityResult.rows[0];
    console.log('Current Identity:');
    console.log(`  Role: ${identity.role}`);
    console.log(`  Database: ${identity.database}`);
    console.log(`  Server: ${identity.server_addr}:${identity.server_port}`);
    console.log(`  PostgreSQL: ${identity.postgres_version.split(',')[0]}`);
    console.log();

    // ========================================================================
    // CHECK 2: Role Membership
    // ========================================================================
    console.log('CHECK 2: Role Membership\n');
    
    const membershipResult = await client.query(`
      SELECT 
        r.rolname as role_name,
        r.rolsuper as is_superuser,
        r.rolcreatedb as can_create_db,
        r.rolcreaterole as can_create_role
      FROM pg_roles r
      WHERE r.rolname = current_user
    `);
    
    if (membershipResult.rows.length > 0) {
      const role = membershipResult.rows[0];
      console.log('Role Attributes:');
      console.log(`  Superuser: ${role.is_superuser ? '✅ YES' : '❌ NO'}`);
      console.log(`  Can Create DB: ${role.can_create_db ? '✅ YES' : '❌ NO'}`);
      console.log(`  Can Create Role: ${role.can_create_role ? '✅ YES' : '❌ NO'}`);
    } else {
      console.log('⚠️  Role information not available');
    }
    console.log();

    // ========================================================================
    // CHECK 3: Table Privileges (Sample)
    // ========================================================================
    console.log('CHECK 3: Table Privileges (Sample: public.tenants)\n');
    
    const privilegesResult = await client.query(`
      SELECT 
        privilege_type
      FROM information_schema.table_privileges
      WHERE grantee = current_user
        AND table_schema = 'public'
        AND table_name = 'tenants'
      ORDER BY privilege_type
    `);
    
    if (privilegesResult.rows.length > 0) {
      console.log('Privileges on public.tenants:');
      privilegesResult.rows.forEach(row => {
        console.log(`  - ${row.privilege_type}`);
      });
    } else {
      console.log('  No explicit privileges found (may inherit from role or PUBLIC)');
    }
    console.log();

    // ========================================================================
    // CHECK 4: Schema Creation Privilege
    // ========================================================================
    console.log('CHECK 4: Schema Creation Privilege\n');
    
    const schemaPrivResult = await client.query(`
      SELECT 
        has_schema_privilege(current_user, 'public', 'CREATE') as can_create_in_public,
        has_database_privilege(current_user, current_database(), 'CREATE') as can_create_schema
    `);
    
    const schemaPriv = schemaPrivResult.rows[0];
    console.log('Schema Privileges:');
    console.log(`  Can CREATE in public schema: ${schemaPriv.can_create_in_public ? '✅ YES' : '❌ NO'}`);
    console.log(`  Can CREATE new schemas: ${schemaPriv.can_create_schema ? '✅ YES' : '❌ NO'}`);
    console.log();

    // ========================================================================
    // CHECK 5: Existing Roles (bella_* pattern)
    // ========================================================================
    console.log('CHECK 5: Existing Bella Roles\n');
    
    const bellaRolesResult = await client.query(`
      SELECT rolname, rolsuper
      FROM pg_roles
      WHERE rolname LIKE 'bella_%'
      ORDER BY rolname
    `);
    
    if (bellaRolesResult.rows.length > 0) {
      console.log('Existing bella_* roles:');
      bellaRolesResult.rows.forEach(role => {
        console.log(`  - ${role.rolname} (superuser: ${role.rolsuper})`);
      });
    } else {
      console.log('  No bella_* roles found');
    }
    console.log();

    // ========================================================================
    // CHECK 6: NON-DESTRUCTIVE Mutation Test
    // ========================================================================
    console.log('CHECK 6: Non-Destructive Mutation Capability Test\n');
    
    console.log('Testing DDL capability (CREATE SCHEMA):');
    try {
      await client.query('BEGIN');
      await client.query('CREATE SCHEMA IF NOT EXISTS test_r3_capability');
      await client.query('ROLLBACK');
      console.log('  ✅ Can CREATE SCHEMA (rolled back)');
    } catch (error) {
      console.log(`  ❌ Cannot CREATE SCHEMA: ${error.message}`);
    }
    
    console.log('\nTesting DML capability (INSERT):');
    try {
      await client.query('BEGIN');
      // Try to insert into a test table (will rollback)
      await client.query(`
        CREATE TEMP TABLE test_r3_insert (id int);
        INSERT INTO test_r3_insert VALUES (1);
      `);
      await client.query('ROLLBACK');
      console.log('  ✅ Can INSERT (rolled back)');
    } catch (error) {
      console.log(`  ❌ Cannot INSERT: ${error.message}`);
    }
    console.log();

    // ========================================================================
    // CHECK 7: Production Environment Detection
    // ========================================================================
    console.log('CHECK 7: Production Environment Detection\n');
    
    const prodTenantsResult = await client.query(`
      SELECT COUNT(*) as count
      FROM public.tenants
      WHERE name NOT LIKE 'test-%' 
        AND name NOT LIKE 'demo-%'
    `);
    
    const prodTenantCount = parseInt(prodTenantsResult.rows[0].count);
    if (prodTenantCount > 0) {
      console.log(`  ⚠️  ${prodTenantCount} non-test tenants found → Likely PRODUCTION database`);
    } else {
      console.log(`  ℹ️  Only test/demo tenants found → Likely DEVELOPMENT database`);
    }
    console.log();

    // ========================================================================
    // SUMMARY
    // ========================================================================
    console.log('╔══════════════════════════════════════════════════════════════════════════════╗');
    console.log('║ INSPECTION SUMMARY                                                           ║');
    console.log('╠══════════════════════════════════════════════════════════════════════════════╣');
    console.log(`║ Current Role: ${identity.role.padEnd(62)}║`);
    console.log(`║ Connection: ${(identity.database + '@' + identity.server_addr).padEnd(64)}║`);
    console.log('║                                                                              ║');
    console.log('║ MUTATION CAPABILITY:                                                         ║');
    console.log('║ - Schema creation: Testing above                                            ║');
    console.log('║ - DML operations: Testing above                                             ║');
    console.log('║                                                                              ║');
    console.log('║ ⚠️  IMPORTANT: These are CURRENT privileges (BEFORE R3)                     ║');
    console.log('║                                                                              ║');
    console.log('║ NEXT STEPS:                                                                  ║');
    console.log('║ 1. Create bella_developer role (READ ONLY)                                  ║');
    console.log('║ 2. Create bella_migration_executor role (AUTHORIZED MUTATION)               ║');
    console.log('║ 3. Distribute credentials appropriately                                     ║');
    console.log('║ 4. Test that developer credentials CANNOT mutate                            ║');
    console.log('╚══════════════════════════════════════════════════════════════════════════════╝\n');

  } catch (error) {
    console.error('\n❌ Inspection error:');
    console.error(error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

inspectRoles();
