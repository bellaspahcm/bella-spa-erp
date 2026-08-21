#!/usr/bin/env node
import pg from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load DATABASE_URL from .env
const envPath = join(__dirname, '..', '.env');
let DATABASE_URL;
try {
  const envContent = readFileSync(envPath, 'utf-8');
  const match = envContent.match(/DATABASE_URL=(.+)/);
  if (match) {
    DATABASE_URL = match[1].trim();
  }
} catch (err) {
  console.error('❌ Failed to load .env:', err.message);
  process.exit(1);
}

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not found in .env');
  process.exit(1);
}

console.log('=== DEEP READ-ONLY SCHEMA & FIXTURE RECONCILIATION ===\n');
console.log('Mode: READ-ONLY (no mutations, no amendments)\n');
console.log('Purpose: Understand schema drift between design and production\n');

const { Client } = pg;
const client = new Client({ connectionString: DATABASE_URL });

const reconciliation = [
  {
    section: '1. PUBLIC.TENANTS SCHEMA RECONCILIATION',
    queries: [
      {
        name: 'Identify tenant identifier columns (alternatives to slug)',
        sql: `SELECT 
          column_name,
          data_type,
          CASE 
            WHEN column_name ILIKE '%slug%' THEN '🎯 SLUG CANDIDATE'
            WHEN column_name ILIKE '%code%' THEN '🎯 CODE CANDIDATE'
            WHEN column_name ILIKE '%key%' THEN '🎯 KEY CANDIDATE'
            WHEN column_name ILIKE '%name%' AND column_name NOT LIKE '%tenant_name%' THEN '🎯 NAME CANDIDATE'
            WHEN column_name = 'id' THEN '🔑 PRIMARY KEY'
            ELSE 'other'
          END AS identifier_type
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'tenants'
          AND (
            column_name ILIKE '%slug%' 
            OR column_name ILIKE '%code%'
            OR column_name ILIKE '%key%'
            OR column_name = 'name'
            OR column_name = 'id'
          )
        ORDER BY ordinal_position;`
      },
      {
        name: 'Sample tenant records with potential identifiers',
        sql: `SELECT 
          id,
          name,
          status,
          created_at
        FROM public.tenants
        ORDER BY created_at DESC
        LIMIT 10;`
      },
      {
        name: 'Check for test/e2e tenants by name pattern',
        sql: `SELECT 
          id,
          name,
          status,
          created_at,
          CASE 
            WHEN name ILIKE '%test%' THEN '🧪 TEST'
            WHEN name ILIKE '%e2e%' THEN '🧪 E2E'
            WHEN name ILIKE '%demo%' THEN '🧪 DEMO'
            WHEN name ILIKE '%quarantine%' THEN '🧪 QUARANTINE'
            ELSE 'production'
          END AS tenant_type
        FROM public.tenants
        WHERE name ILIKE '%test%' 
          OR name ILIKE '%e2e%' 
          OR name ILIKE '%demo%'
          OR name ILIKE '%quarantine%'
        ORDER BY created_at;`
      }
    ]
  },
  {
    section: '2. FIXTURE → CANONICAL UUID MAPPING',
    queries: [
      {
        name: '5 TEXT fixtures in runtime_tenant_registry',
        sql: `SELECT 
          tenant_id AS text_fixture_id,
          tenant_name,
          created_at,
          CASE 
            WHEN tenant_id LIKE '%quarantine%' THEN '🗑️ TEST_ORPHAN (to delete)'
            WHEN tenant_id LIKE '%e2e%' THEN '🔄 TEST_FIXTURE (to replace)'
            ELSE 'unknown'
          END AS classification_05a
        FROM runtime_tenant_registry
        ORDER BY created_at;`
      },
      {
        name: 'Search for matching tenants by name pattern',
        sql: `SELECT 
          rtr.tenant_id AS runtime_text_id,
          rtr.tenant_name AS runtime_name,
          t.id AS potential_canonical_uuid,
          t.name AS canonical_name,
          CASE 
            WHEN t.id IS NULL THEN '❌ NO MATCH'
            ELSE '⚠️ POTENTIAL MATCH'
          END AS match_status
        FROM runtime_tenant_registry rtr
        LEFT JOIN public.tenants t ON (
          t.name ILIKE '%' || COALESCE(rtr.tenant_name, rtr.tenant_id) || '%'
          OR COALESCE(rtr.tenant_name, rtr.tenant_id) ILIKE '%' || t.name || '%'
        )
        ORDER BY rtr.created_at;`
      },
      {
        name: 'Check if migration 05-B canonical tenants already exist',
        sql: `SELECT 
          id,
          name,
          created_at,
          CASE 
            WHEN name ILIKE '%runtime%' THEN '🎯 MIGRATION 05-B PATTERN'
            WHEN name ILIKE '%tenant a%' AND name ILIKE '%e2e%' THEN '🎯 POTENTIAL TENANT A'
            WHEN name ILIKE '%tenant b%' AND name ILIKE '%e2e%' THEN '🎯 POTENTIAL TENANT B'
            WHEN name ILIKE '%attacker%' AND name ILIKE '%e2e%' THEN '🎯 POTENTIAL ATTACKER'
            ELSE 'other'
          END AS migration_pattern
        FROM public.tenants
        WHERE name ILIKE '%e2e%' 
          OR name ILIKE '%runtime%'
          OR name ILIKE '%test%'
        ORDER BY created_at DESC;`
      }
    ]
  },
  {
    section: '3. AUTH → USERS → TENANTS IDENTITY CHAIN',
    queries: [
      {
        name: 'E2E test users in auth.users',
        sql: `SELECT 
          id AS auth_user_id,
          email,
          created_at
        FROM auth.users
        WHERE email IN (
          'test-tenant-a@e2e.bella.test',
          'test-tenant-b@e2e.bella.test',
          'test-attacker@e2e.bella.test'
        )
        ORDER BY email;`
      },
      {
        name: 'E2E test users in public.users with tenant mapping',
        sql: `SELECT 
          u.id AS user_id,
          u.email,
          u.tenant_id AS mapped_tenant_uuid,
          t.name AS tenant_name,
          CASE 
            WHEN u.tenant_id IS NULL THEN '❌ NO TENANT MAPPING'
            WHEN t.id IS NULL THEN '❌ ORPHAN (tenant deleted)'
            WHEN u.tenant_id = t.id THEN '✅ VALID MAPPING'
            ELSE '❌ MISMATCH'
          END AS mapping_status
        FROM public.users u
        LEFT JOIN public.tenants t ON u.tenant_id = t.id
        WHERE u.email LIKE '%e2e.bella.test%'
        ORDER BY u.email;`
      },
      {
        name: 'Full identity chain for e2e users',
        sql: `SELECT 
          au.id AS auth_user_id,
          au.email,
          pu.id AS public_user_id,
          pu.tenant_id AS user_tenant_uuid,
          t.id AS tenant_uuid,
          t.name AS tenant_name,
          CASE 
            WHEN au.id IS NOT NULL AND pu.id IS NULL THEN '⚠️ auth exists, public.users missing'
            WHEN pu.id IS NOT NULL AND pu.tenant_id IS NULL THEN '⚠️ user exists, no tenant mapping'
            WHEN pu.tenant_id IS NOT NULL AND t.id IS NULL THEN '❌ tenant_id references non-existent tenant'
            WHEN au.id = pu.id AND pu.tenant_id = t.id THEN '✅ COMPLETE CHAIN'
            ELSE '❌ BROKEN CHAIN'
          END AS chain_status
        FROM auth.users au
        LEFT JOIN public.users pu ON au.id = pu.id
        LEFT JOIN public.tenants t ON pu.tenant_id = t.id
        WHERE au.email LIKE '%e2e.bella.test%'
        ORDER BY au.email;`
      }
    ]
  },
  {
    section: '4. MIGRATION HISTORY & STATE',
    queries: [
      {
        name: 'Check supabase_migrations schema structure',
        sql: `SELECT 
          table_name,
          column_name,
          data_type
        FROM information_schema.columns
        WHERE table_schema = 'supabase_migrations'
        ORDER BY table_name, ordinal_position;`
      },
      {
        name: 'Recent migrations (if schema_migrations exists)',
        sql: `SELECT 
          version,
          name,
          executed_at
        FROM supabase_migrations.schema_migrations
        ORDER BY version DESC
        LIMIT 30;`
      },
      {
        name: 'Check for migration_evidence schema (05-A/05-B artifact)',
        sql: `SELECT 
          schema_name
        FROM information_schema.schemata
        WHERE schema_name = 'migration_evidence';`
      },
      {
        name: 'Search for migration 05 related tables/schemas',
        sql: `SELECT 
          table_schema,
          table_name,
          table_type
        FROM information_schema.tables
        WHERE table_name LIKE '%migration%'
          OR table_name LIKE '%05%'
          OR table_schema LIKE '%migration%'
        ORDER BY table_schema, table_name;`
      }
    ]
  },
  {
    section: '5. RUNTIME SCHEMA STATE',
    queries: [
      {
        name: 'All runtime_* tables',
        sql: `SELECT 
          table_name,
          (SELECT COUNT(*) 
           FROM information_schema.columns 
           WHERE table_schema = 'public' 
           AND table_name = t.table_name) AS column_count
        FROM information_schema.tables t
        WHERE table_schema = 'public'
          AND table_name LIKE 'runtime_%'
        ORDER BY table_name;`
      },
      {
        name: 'runtime_tenant_registry FK constraints',
        sql: `SELECT 
          tc.constraint_name,
          tc.constraint_type,
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints tc
        LEFT JOIN information_schema.key_column_usage kcu 
          ON tc.constraint_name = kcu.constraint_name
        LEFT JOIN information_schema.constraint_column_usage ccu 
          ON ccu.constraint_name = tc.constraint_name
        WHERE tc.table_schema = 'public'
          AND tc.table_name = 'runtime_tenant_registry'
        ORDER BY tc.constraint_type, tc.constraint_name;`
      },
      {
        name: 'RLS policies on runtime tables',
        sql: `SELECT 
          tablename,
          policyname,
          CASE 
            WHEN qual LIKE '%::text%' THEN '⚠️ HAS TEXT CAST'
            WHEN qual LIKE '%get_auth_tenant_id%' THEN '✅ USES AUTH FUNCTION'
            ELSE 'other'
          END AS policy_pattern
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename LIKE 'runtime_%'
        ORDER BY tablename, policyname;`
      },
      {
        name: 'get_auth_tenant_id function signature',
        sql: `SELECT 
          proname AS function_name,
          pg_get_function_result(p.oid) AS return_type,
          pg_get_functiondef(p.oid) AS function_definition
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
          AND p.proname = 'get_auth_tenant_id';`
      }
    ]
  }
];

async function runReconciliation() {
  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    for (const section of reconciliation) {
      console.log(`${'='.repeat(70)}`);
      console.log(section.section);
      console.log(`${'='.repeat(70)}\n`);

      for (const query of section.queries) {
        console.log(`--- ${query.name} ---`);
        try {
          const result = await client.query(query.sql);
          
          if (result.rows.length === 0) {
            console.log('  (No results)');
          } else {
            console.table(result.rows);
          }
        } catch (err) {
          console.log(`  ⚠️  Query failed: ${err.message}`);
        }
        console.log('');
      }
    }

    console.log(`${'='.repeat(70)}`);
    console.log('RECONCILIATION COMPLETE');
    console.log(`${'='.repeat(70)}\n`);
    console.log('READ-ONLY reconciliation finished (0 mutations)');
    console.log('');
    console.log('⏸️  AWAITING HUMAN DECISION');
    console.log('');
    console.log('Evidence captured for:');
    console.log('A. Schema drift analysis (design vs production)');
    console.log('B. Fixture → Canonical UUID mapping possibilities');
    console.log('C. Identity chain completeness');
    console.log('D. Migration history state');
    console.log('E. Runtime schema contracts');

  } catch (err) {
    console.error('❌ Reconciliation error:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runReconciliation();
