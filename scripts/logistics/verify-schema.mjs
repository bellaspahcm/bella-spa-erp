#!/usr/bin/env node

/**
 * Verify Logistics Schema
 * 
 * Week 3 Day 3 Gate A - Steps 2-4
 * 
 * Verifies:
 * - Step 2: 6 tables exist
 * - Step 3: RLS enabled on 5/5 data tables
 * - Step 4: RLS policies exist for tenant isolation
 */

import pg from 'pg';

const { Client } = pg;

const DB_URL = process.env.SUPABASE_DB_URL;

if (!DB_URL) {
  console.error('❌ Missing SUPABASE_DB_URL in environment');
  process.exit(1);
}

async function verifySchema() {
  const client = new Client({
    connectionString: DB_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    // ========================================================================
    // STEP 2: Verify 6 tables exist
    // ========================================================================
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  STEP 2: VERIFY TABLES EXIST');
    console.log('═══════════════════════════════════════════════════════════\n');

    const tablesQuery = `
      SELECT table_name, table_type
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name LIKE 'log_%'
      ORDER BY table_name
    `;

    const tablesResult = await client.query(tablesQuery);
    
    console.log(`📊 Query executed: ${tablesQuery.trim()}\n`);
    console.log(`✅ Found ${tablesResult.rows.length} logistics tables:\n`);
    
    const expectedTables = [
      'log_carriers',
      'log_idempotency_keys',
      'log_routes',
      'log_shipments',
      'log_tracking_events',
      'log_warehouses'
    ];

    tablesResult.rows.forEach((row, i) => {
      const status = expectedTables.includes(row.table_name) ? '✅' : '⚠️';
      console.log(`   ${status} ${i + 1}. ${row.table_name} (${row.table_type})`);
    });

    console.log();

    if (tablesResult.rows.length !== 6) {
      console.error(`❌ STEP 2 FAILED: Expected 6 tables, found ${tablesResult.rows.length}\n`);
      return false;
    }

    // Check all expected tables exist
    const foundTables = tablesResult.rows.map(r => r.table_name);
    const missingTables = expectedTables.filter(t => !foundTables.includes(t));
    
    if (missingTables.length > 0) {
      console.error(`❌ STEP 2 FAILED: Missing tables: ${missingTables.join(', ')}\n`);
      return false;
    }

    console.log('✅ STEP 2 PASS: All 6 tables exist\n');

    // ========================================================================
    // STEP 3: Verify RLS enabled
    // ========================================================================
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  STEP 3: VERIFY RLS ENABLED');
    console.log('═══════════════════════════════════════════════════════════\n');

    const rlsQuery = `
      SELECT tablename, rowsecurity
      FROM pg_tables 
      WHERE schemaname = 'public' 
        AND tablename LIKE 'log_%'
      ORDER BY tablename
    `;

    const rlsResult = await client.query(rlsQuery);
    
    console.log(`📊 Query executed: ${rlsQuery.trim()}\n`);
    console.log(`📋 RLS Status:\n`);

    const dataTables = [
      'log_carriers',
      'log_routes',
      'log_shipments',
      'log_tracking_events',
      'log_warehouses'
    ];

    let rlsEnabledCount = 0;
    let rlsFailures = [];

    rlsResult.rows.forEach((row, i) => {
      const shouldHaveRLS = dataTables.includes(row.tablename);
      const hasRLS = row.rowsecurity === true || row.rowsecurity === 't';
      
      let status = '✅';
      let note = '';
      
      if (shouldHaveRLS) {
        if (hasRLS) {
          rlsEnabledCount++;
          note = '(data table - RLS required)';
        } else {
          status = '❌';
          note = '(MISSING RLS!)';
          rlsFailures.push(row.tablename);
        }
      } else {
        // log_idempotency_keys should NOT have RLS
        if (!hasRLS) {
          note = '(stateless table - RLS not required)';
        } else {
          status = '⚠️';
          note = '(has RLS but not required)';
        }
      }

      console.log(`   ${status} ${i + 1}. ${row.tablename}: ${hasRLS ? 'ENABLED' : 'DISABLED'} ${note}`);
    });

    console.log();

    if (rlsEnabledCount !== 5) {
      console.error(`❌ STEP 3 FAILED: Expected 5/5 data tables with RLS, found ${rlsEnabledCount}/5`);
      if (rlsFailures.length > 0) {
        console.error(`   Tables missing RLS: ${rlsFailures.join(', ')}`);
      }
      console.log();
      return false;
    }

    console.log('✅ STEP 3 PASS: RLS enabled on 5/5 data tables\n');

    // ========================================================================
    // STEP 4: Verify RLS policies exist
    // ========================================================================
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  STEP 4: VERIFY RLS POLICIES EXIST');
    console.log('═══════════════════════════════════════════════════════════\n');

    const policiesQuery = `
      SELECT 
        schemaname,
        tablename,
        policyname,
        permissive,
        cmd,
        qual,
        with_check
      FROM pg_policies
      WHERE schemaname = 'public' 
        AND tablename LIKE 'log_%'
      ORDER BY tablename, policyname
    `;

    const policiesResult = await client.query(policiesQuery);
    
    console.log(`📊 Query executed: ${policiesQuery.trim()}\n`);
    console.log(`📋 Found ${policiesResult.rows.length} RLS policies:\n`);

    if (policiesResult.rows.length === 0) {
      console.error('❌ STEP 4 FAILED: No RLS policies found\n');
      return false;
    }

    // Group policies by table
    const policiesByTable = {};
    policiesResult.rows.forEach(policy => {
      if (!policiesByTable[policy.tablename]) {
        policiesByTable[policy.tablename] = [];
      }
      policiesByTable[policy.tablename].push(policy);
    });

    let policyFailures = [];

    dataTables.forEach((table, i) => {
      const policies = policiesByTable[table] || [];
      const status = policies.length > 0 ? '✅' : '❌';
      
      if (policies.length === 0) {
        policyFailures.push(table);
      }

      console.log(`   ${status} ${i + 1}. ${table}: ${policies.length} ${policies.length === 1 ? 'policy' : 'policies'}`);
      
      policies.forEach(p => {
        console.log(`      - ${p.policyname}`);
        console.log(`        Type: ${p.permissive} | Command: ${p.cmd}`);
      });
    });

    console.log();

    // Check minimum requirement: at least 5 policies (one per data table)
    if (policiesResult.rows.length < 5) {
      console.error(`❌ STEP 4 FAILED: Expected at least 5 policies, found ${policiesResult.rows.length}`);
      console.log();
      return false;
    }

    // Check each data table has at least one policy
    if (policyFailures.length > 0) {
      console.error(`❌ STEP 4 FAILED: Tables missing policies: ${policyFailures.join(', ')}`);
      console.log();
      return false;
    }

    console.log('✅ STEP 4 PASS: All data tables have tenant isolation policies\n');

    // ========================================================================
    // SUMMARY
    // ========================================================================
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  SCHEMA VERIFICATION SUMMARY');
    console.log('═══════════════════════════════════════════════════════════\n');

    console.log('✅ Step 2: 6/6 tables exist');
    console.log('✅ Step 3: 5/5 data tables have RLS enabled');
    console.log('✅ Step 4: All data tables have tenant isolation policies');
    console.log();
    console.log('🎉 ALL SCHEMA VERIFICATION STEPS PASSED\n');

    return true;

  } catch (error) {
    console.error('\n❌ VERIFICATION FAILED\n');
    console.error('Error:', error.message);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    return false;
  } finally {
    await client.end();
    console.log('🔌 Database connection closed\n');
  }
}

console.log('═══════════════════════════════════════════════════════════\n');
console.log('  WEEK 3 DAY 3 — GATE A — STEPS 2-4: SCHEMA VERIFICATION');
console.log('\n═══════════════════════════════════════════════════════════\n');

verifySchema().then((success) => {
  if (success) {
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log('  STEPS 2-4 COMPLETE — Proceed to Step 5 (Integration Tests)');
    console.log('\n═══════════════════════════════════════════════════════════\n');
    process.exit(0);
  } else {
    console.error('═══════════════════════════════════════════════════════════\n');
    console.error('  VERIFICATION FAILED — Fix issues before proceeding');
    console.error('\n═══════════════════════════════════════════════════════════\n');
    process.exit(1);
  }
}).catch((error) => {
  console.error('\n❌ FATAL ERROR:', error.message);
  process.exit(1);
});
