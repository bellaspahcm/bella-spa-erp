/**
 * E7: Permission Diagnosis
 * 
 * Purpose: Identify exact role and privileges before granting
 * Method: Read-only inspection of current user and grants
 * Status: NO MODIFICATIONS
 */

import { Client } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_EXECUTOR_URL || process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ Missing DATABASE_URL');
  process.exit(1);
}

const client = new Client({ connectionString });

async function diagnosisQuery(title: string, query: string): Promise<any[]> {
  console.log(`\n${'═'.repeat(67)}`);
  console.log(title);
  console.log('═'.repeat(67));
  
  try {
    const result = await client.query(query);
    return result.rows;
  } catch (error: any) {
    console.error(`❌ Error: ${error.message}`);
    return [];
  }
}

async function permissionDiagnosis() {
  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  E7: PERMISSION DIAGNOSIS                                     ║');
  console.log('║  Date: 2026-08-24                                             ║');
  console.log('║  Status: READ-ONLY (NO MODIFICATIONS)                         ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  console.log('Connection String:', connectionString?.replace(/:[^:@]+@/, ':***@'));

  await client.connect();

  try {
    // 1. Identify connection role
    const roleData = await diagnosisQuery(
      '1. IDENTIFY CONNECTION ROLE',
      'SELECT current_user, session_user, current_role'
    );
    
    if (roleData.length > 0) {
      console.log('\nConnection role:');
      console.table(roleData);
    }

    // 2. Check schema privileges
    const schemaPrivs = await diagnosisQuery(
      '2. CHECK SCHEMA PRIVILEGES',
      `SELECT
        has_schema_privilege(current_user, 'supabase_migrations', 'USAGE') AS has_usage,
        has_schema_privilege(current_user, 'supabase_migrations', 'CREATE') AS has_create`
    );
    
    if (schemaPrivs.length > 0) {
      console.log('\nSchema privileges:');
      console.table(schemaPrivs);
      
      const hasUsage = schemaPrivs[0].has_usage;
      console.log(hasUsage ? '✅ USAGE granted' : '❌ USAGE missing');
    }

    // 3. Check table privileges
    const tablePrivs = await diagnosisQuery(
      '3. CHECK TABLE PRIVILEGES',
      `SELECT
        has_table_privilege(current_user, 'supabase_migrations.schema_migrations', 'SELECT') AS has_select,
        has_table_privilege(current_user, 'supabase_migrations.schema_migrations', 'INSERT') AS has_insert,
        has_table_privilege(current_user, 'supabase_migrations.schema_migrations', 'UPDATE') AS has_update,
        has_table_privilege(current_user, 'supabase_migrations.schema_migrations', 'DELETE') AS has_delete`
    );
    
    if (tablePrivs.length > 0) {
      console.log('\nTable privileges:');
      console.table(tablePrivs);
      
      const hasSelect = tablePrivs[0].has_select;
      console.log(hasSelect ? '✅ SELECT granted' : '❌ SELECT missing');
    }

    // 4. Inspect existing grants on table
    const existingTableGrants = await diagnosisQuery(
      '4. EXISTING TABLE GRANTS',
      `SELECT
        grantee,
        privilege_type,
        table_schema,
        table_name
      FROM information_schema.role_table_grants
      WHERE table_schema = 'supabase_migrations'
        AND table_name = 'schema_migrations'
      ORDER BY grantee, privilege_type`
    );
    
    if (existingTableGrants.length > 0) {
      console.log('\nExisting table grants:');
      console.table(existingTableGrants);
    } else {
      console.log('\n⚠️  No table grants found for supabase_migrations.schema_migrations');
    }

    // 5. Inspect existing schema grants
    const existingSchemaGrants = await diagnosisQuery(
      '5. EXISTING SCHEMA GRANTS',
      `SELECT
        grantee,
        privilege_type
      FROM information_schema.role_schema_grants
      WHERE schema_name = 'supabase_migrations'
      ORDER BY grantee, privilege_type`
    );
    
    if (existingSchemaGrants.length > 0) {
      console.log('\nExisting schema grants:');
      console.table(existingSchemaGrants);
    } else {
      console.log('\n⚠️  No schema grants found for supabase_migrations');
    }

    // Summary
    console.log('\n╔═══════════════════════════════════════════════════════════════╗');
    console.log('║  DIAGNOSIS SUMMARY                                            ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝\n');

    if (roleData.length > 0 && schemaPrivs.length > 0 && tablePrivs.length > 0) {
      const currentRole = roleData[0].current_user;
      const hasUsage = schemaPrivs[0].has_usage;
      const hasSelect = tablePrivs[0].has_select;

      console.log(`Connection role:       ${currentRole}`);
      console.log(`Schema USAGE:          ${hasUsage ? '✅ GRANTED' : '❌ MISSING'}`);
      console.log(`Table SELECT:          ${hasSelect ? '✅ GRANTED' : '❌ MISSING'}`);
      console.log('');

      if (!hasUsage || !hasSelect) {
        console.log('🔴 MINIMUM PRIVILEGES REQUIRED FOR E7 READ-ONLY AUDIT:');
        console.log('');
        if (!hasUsage) {
          console.log(`GRANT USAGE ON SCHEMA supabase_migrations TO ${currentRole};`);
        }
        if (!hasSelect) {
          console.log(`GRANT SELECT ON supabase_migrations.schema_migrations TO ${currentRole};`);
        }
        console.log('');
        console.log('⚠️  These are read-only privileges for E7 forensic audit only.');
        console.log('⚠️  Do NOT grant INSERT/UPDATE/DELETE — E7 must not modify data.');
        console.log('');
        console.log('After granting, retry: npx tsx scripts/e7_execute_audit_pg.ts');
      } else {
        console.log('✅ All required privileges present.');
        console.log('');
        console.log('Permission error may be due to connection caching or other issue.');
        console.log('Retry: npx tsx scripts/e7_execute_audit_pg.ts');
      }
    }

    console.log('\n' + '═'.repeat(67) + '\n');
    console.log('⚠️  STOP: Do not execute GRANT yet.');
    console.log('Share this output with Human Architect for review.');
    console.log('Only grant after confirming:');
    console.log('  - Correct role identified');
    console.log('  - Minimal privilege required');
    console.log('  - Read-only access only');
    console.log('  - No security boundary violation');
    console.log('\n' + '═'.repeat(67) + '\n');

  } finally {
    await client.end();
  }
}

// Execute
permissionDiagnosis().catch(error => {
  console.error('❌ Diagnosis failed:', error);
  process.exit(1);
});
