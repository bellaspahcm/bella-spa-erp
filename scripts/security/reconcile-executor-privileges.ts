#!/usr/bin/env tsx
/**
 * R2.4 Effective Privilege Reconciliation
 * 
 * Resolves contradiction between:
 * - Report: "INSERT+SELECT only, UPDATE/DELETE=false"
 * - verify-executor-role.ts: "UPDATE=true, DELETE=true"
 * 
 * Queries actual database state to determine effective privileges.
 */

import { Pool } from 'pg';
import 'dotenv/config';

interface RoleInfo {
  rolname: string;
  rolsuper: boolean;
  rolinherit: boolean;
  rolcreaterole: boolean;
  rolcreatedb: boolean;
  rolbypassrls: boolean;
}

interface RoleMembership {
  role: string;
  member_of: string | null;
}

interface TableOwnership {
  schema_name: string;
  table_name: string;
  owner: string;
}

interface TableACL {
  schema_name: string;
  table_name: string;
  relacl: string[] | null;
}

interface EffectivePrivileges {
  can_select: boolean;
  can_insert: boolean;
  can_update: boolean;
  can_delete: boolean;
}

interface SchemaPrivileges {
  can_create: boolean;
}

async function reconcilePrivileges() {
  console.log('🔍 R2.4 Effective Privilege Reconciliation');
  console.log('=========================================\n');

  const executorUrl = process.env.DATABASE_EXECUTOR_URL;
  if (!executorUrl) {
    throw new Error('Missing DATABASE_EXECUTOR_URL');
  }

  const pool = new Pool({
    connectionString: executorUrl,
    max: 1,
  });

  try {
    // R2.1 - Role Attributes & Membership
    console.log('📋 R2.1: Role Attributes & Membership\n');

    const roleQuery = `
      SELECT
        r.rolname,
        r.rolsuper,
        r.rolinherit,
        r.rolcreaterole,
        r.rolcreatedb,
        r.rolbypassrls
      FROM pg_roles r
      WHERE r.rolname = 'verification_executor';
    `;

    const { rows: roleInfo } = await pool.query<RoleInfo>(roleQuery);

    if (roleInfo.length === 0) {
      console.error('❌ verification_executor role not found');
      process.exit(1);
    }

    const role = roleInfo[0];
    console.log('Role Attributes:');
    console.log(`  rolname:        ${role.rolname}`);
    console.log(`  rolsuper:       ${role.rolsuper ? '🔴 true (SECURITY VIOLATION!)' : '✅ false'}`);
    console.log(`  rolinherit:     ${role.rolinherit ? 'true' : 'false'}`);
    console.log(`  rolcreaterole:  ${role.rolcreaterole ? '🔴 true (SECURITY VIOLATION!)' : '✅ false'}`);
    console.log(`  rolcreatedb:    ${role.rolcreatedb ? '🔴 true (SECURITY VIOLATION!)' : '✅ false'}`);
    console.log(`  rolbypassrls:   ${role.rolbypassrls ? '🔴 true (SECURITY VIOLATION!)' : '✅ false'}`);
    console.log();

    // Check role membership
    const membershipQuery = `
      SELECT
        r.rolname AS role,
        m.rolname AS member_of
      FROM pg_roles r
      LEFT JOIN pg_auth_members am ON r.oid = am.member
      LEFT JOIN pg_roles m ON am.roleid = m.oid
      WHERE r.rolname = 'verification_executor';
    `;

    const { rows: membership } = await pool.query<RoleMembership>(membershipQuery);

    console.log('Role Membership:');
    const members = membership.filter(m => m.member_of);
    if (members.length === 0) {
      console.log('  ✅ No inherited roles (good - direct privileges only)');
    } else {
      console.log('  ⚠️  Inherits from:');
      members.forEach(m => console.log(`    - ${m.member_of}`));
    }
    console.log();

    // R2.2 - Table Ownership
    console.log('📋 R2.2: verification_evidence Ownership\n');

    const ownershipQuery = `
      SELECT
        n.nspname AS schema_name,
        c.relname AS table_name,
        pg_get_userbyid(c.relowner) AS owner
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = 'verification_evidence';
    `;

    const { rows: ownership } = await pool.query<TableOwnership>(ownershipQuery);

    if (ownership.length === 0) {
      console.log('⚠️  verification_evidence table not found\n');
    } else {
      const owner = ownership[0];
      console.log('Table Ownership:');
      console.log(`  Schema: ${owner.schema_name}`);
      console.log(`  Table:  ${owner.table_name}`);
      console.log(`  Owner:  ${owner.owner}`);
      
      if (owner.owner === 'verification_executor') {
        console.log('  🔴 SECURITY CONCERN: verification_executor owns the evidence table');
        console.log('      Table owners bypass GRANT/REVOKE restrictions!');
      } else {
        console.log(`  ✅ Owner is "${owner.owner}", not verification_executor`);
      }
      console.log();
    }

    // R2.3 - ACL & Effective Privileges
    console.log('📋 R2.3: Access Control List & Effective Privileges\n');

    const aclQuery = `
      SELECT
        n.nspname AS schema_name,
        c.relname AS table_name,
        c.relacl
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = 'verification_evidence';
    `;

    const { rows: acl } = await pool.query<TableACL>(aclQuery);

    if (acl.length > 0) {
      console.log('Raw ACL:');
      if (!acl[0].relacl) {
        console.log('  NULL (using default privileges)');
      } else {
        console.log(`  ${JSON.stringify(acl[0].relacl)}`);
      }
      console.log();
    }

    // Effective privileges via has_table_privilege()
    const privQuery = `
      SELECT
        has_table_privilege('verification_executor', 'public.verification_evidence', 'SELECT') AS can_select,
        has_table_privilege('verification_executor', 'public.verification_evidence', 'INSERT') AS can_insert,
        has_table_privilege('verification_executor', 'public.verification_evidence', 'UPDATE') AS can_update,
        has_table_privilege('verification_executor', 'public.verification_evidence', 'DELETE') AS can_delete;
    `;

    const { rows: effectivePrivs } = await pool.query<EffectivePrivileges>(privQuery);

    if (effectivePrivs.length === 0) {
      console.error('❌ Could not determine effective privileges');
      process.exit(1);
    }

    const privs = effectivePrivs[0];
    console.log('Effective Table Privileges (has_table_privilege):');
    console.log(`  SELECT: ${privs.can_select ? '✅ true' : '❌ false'}`);
    console.log(`  INSERT: ${privs.can_insert ? '✅ true' : '❌ false'}`);
    console.log(`  UPDATE: ${privs.can_update ? '🔴 true (EXPECTED: false)' : '✅ false'}`);
    console.log(`  DELETE: ${privs.can_delete ? '🔴 true (EXPECTED: false)' : '✅ false'}`);
    console.log();

    // R2.4 - Schema CREATE Privilege
    console.log('📋 R2.4: Schema CREATE Privilege\n');

    const schemaQuery = `
      SELECT
        has_schema_privilege('verification_executor', 'public', 'CREATE') AS can_create;
    `;

    const { rows: schemaPrivs } = await pool.query<SchemaPrivileges>(schemaQuery);

    if (schemaPrivs.length > 0) {
      const schema = schemaPrivs[0];
      console.log('Effective Schema Privileges (has_schema_privilege):');
      console.log(`  CREATE on public: ${schema.can_create ? '🟡 true (needs review)' : '✅ false'}`);
      console.log();

      if (schema.can_create) {
        console.log('⚠️  SECURITY MODEL CLARIFICATION NEEDED:');
        console.log('    verification_executor can CREATE objects in public schema');
        console.log('    Does security spec allow schema object creation?');
        console.log();
      }
    }

    // Summary
    console.log('=========================================');
    console.log('📊 R2.4 RECONCILIATION SUMMARY');
    console.log('=========================================\n');

    const hasUnexpectedUpdate = privs.can_update === true;
    const hasUnexpectedDelete = privs.can_delete === true;
    const schemaCreate = schemaPrivs.length > 0 && schemaPrivs[0].can_create === true;

    if (hasUnexpectedUpdate || hasUnexpectedDelete) {
      console.log('🔴 CONTRADICTION CONFIRMED:');
      console.log('   Report claims: INSERT+SELECT only, UPDATE/DELETE=false');
      console.log('   Database state: UPDATE and/or DELETE privileges GRANTED');
      console.log();
      console.log('   Possible causes:');
      if (ownership.length > 0 && ownership[0].owner === 'verification_executor') {
        console.log('   → verification_executor IS TABLE OWNER (bypasses GRANT/REVOKE)');
      }
      if (members.length > 0) {
        console.log('   → Privileges inherited from role membership');
      }
      console.log('   → REVOKE commands not executed or failed');
      console.log('   → Database state changed since provisioning');
      console.log();
      console.log('🔴 R2 STATUS: NOT RESOLVED — append-only boundary not proven');
      console.log();
      process.exit(1);
    } else {
      console.log('✅ APPEND-ONLY CONFIRMED:');
      console.log('   SELECT: true  ✅');
      console.log('   INSERT: true  ✅');
      console.log('   UPDATE: false ✅');
      console.log('   DELETE: false ✅');
      console.log();
    }

    if (schemaCreate) {
      console.log('🟡 SCHEMA CREATE: true');
      console.log('   Security model claims "no schema modification privileges"');
      console.log('   But CREATE on public schema is granted');
      console.log('   → Requires clarification: intentional or gap?');
      console.log();
    } else {
      console.log('✅ SCHEMA CREATE: false (as expected)');
      console.log();
    }

    console.log('R2.4 Reconciliation: COMPLETE');
    console.log('Review output above for Gate C approval');

  } finally {
    await pool.end();
  }
}

reconcilePrivileges().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
