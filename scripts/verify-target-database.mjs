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

console.log('=== OPTION A: VERIFY TARGET DATABASE ===\n');
console.log('Mode: READ-ONLY INVESTIGATION (no mutations)\n');

const { Client } = pg;
const client = new Client({ connectionString: DATABASE_URL });

const investigations = [
  {
    section: '1. DATABASE IDENTITY',
    queries: [
      {
        name: 'Database connection info',
        sql: `SELECT 
          current_database() AS database_name,
          current_user AS connected_as,
          inet_server_addr() AS server_ip,
          version() AS postgres_version;`
      },
      {
        name: 'Supabase project metadata',
        sql: `SELECT 
          setting AS project_ref
        FROM pg_settings 
        WHERE name = 'app.settings.project_ref'
        UNION ALL
        SELECT setting FROM pg_settings WHERE name LIKE '%supabase%'
        LIMIT 5;`
      }
    ]
  },
  {
    section: '2. MIGRATION HISTORY',
    queries: [
      {
        name: 'Supabase migrations applied',
        sql: `SELECT 
          version,
          name,
          inserted_at
        FROM supabase_migrations.schema_migrations
        ORDER BY version DESC
        LIMIT 20;`
      },
      {
        name: 'Check for Migration 05 artifacts',
        sql: `SELECT 
          table_name,
          table_type
        FROM information_schema.tables
        WHERE table_schema = 'migration_evidence'
        ORDER BY table_name;`
      }
    ]
  },
  {
    section: '3. SCHEMA IDENTITY - public.tenants',
    queries: [
      {
        name: 'tenants table structure',
        sql: `SELECT 
          column_name,
          data_type,
          is_nullable,
          column_default
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'tenants'
        ORDER BY ordinal_position;`
      },
      {
        name: 'tenants table constraints',
        sql: `SELECT 
          constraint_name,
          constraint_type
        FROM information_schema.table_constraints
        WHERE table_schema = 'public'
          AND table_name = 'tenants';`
      },
      {
        name: 'tenants table indexes',
        sql: `SELECT 
          indexname,
          indexdef
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'tenants';`
      }
    ]
  },
  {
    section: '4. RUNTIME REGISTRY STATE',
    queries: [
      {
        name: 'runtime_tenant_registry 5 records',
        sql: `SELECT 
          tenant_id,
          tenant_name,
          is_active,
          created_at
        FROM runtime_tenant_registry
        ORDER BY created_at;`
      },
      {
        name: 'runtime_tenant_registry column types',
        sql: `SELECT 
          column_name,
          data_type,
          character_maximum_length,
          is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'runtime_tenant_registry'
        ORDER BY ordinal_position;`
      }
    ]
  },
  {
    section: '5. RUNTIME CHILD TABLES STATE',
    queries: [
      {
        name: 'Child tables row counts',
        sql: `SELECT 
          'runtime_outbox' AS table_name,
          COUNT(*) AS row_count
        FROM runtime_outbox
        UNION ALL
        SELECT 'runtime_idempotency_registry', COUNT(*)
        FROM runtime_idempotency_registry
        UNION ALL
        SELECT 'runtime_audit_log', COUNT(*)
        FROM runtime_audit_log
        UNION ALL
        SELECT 'runtime_quarantine', COUNT(*)
        FROM runtime_quarantine;`
      }
    ]
  },
  {
    section: '6. CANONICAL IDENTITY CHECK',
    queries: [
      {
        name: 'Check if public.tenants exists',
        sql: `SELECT 
          EXISTS(
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'tenants'
          ) AS tenants_table_exists;`
      },
      {
        name: 'Sample tenants records (if exists)',
        sql: `SELECT 
          id,
          name,
          CASE 
            WHEN EXISTS(
              SELECT 1 FROM information_schema.columns 
              WHERE table_schema = 'public' 
              AND table_name = 'tenants' 
              AND column_name = 'slug'
            ) THEN 'HAS_SLUG_COLUMN'
            ELSE 'NO_SLUG_COLUMN'
          END AS slug_status,
          created_at
        FROM public.tenants
        WHERE name LIKE '%test%' OR name LIKE '%e2e%'
        ORDER BY created_at DESC
        LIMIT 10;`
      }
    ]
  },
  {
    section: '7. AUTH/USER IDENTITY',
    queries: [
      {
        name: 'Check auth.users for e2e test users',
        sql: `SELECT 
          id,
          email,
          created_at
        FROM auth.users
        WHERE email LIKE '%e2e%' OR email LIKE '%test%'
        ORDER BY created_at DESC
        LIMIT 10;`
      },
      {
        name: 'Check public.users structure',
        sql: `SELECT 
          column_name,
          data_type
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'users'
          AND column_name IN ('id', 'tenant_id', 'email')
        ORDER BY ordinal_position;`
      }
    ]
  }
];

async function runInvestigation() {
  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    // Extract connection details
    const urlMatch = DATABASE_URL.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
    if (urlMatch) {
      console.log('Connection details:');
      console.log(`  User: ${urlMatch[1]}`);
      console.log(`  Host: ${urlMatch[3]}`);
      console.log(`  Port: ${urlMatch[4]}`);
      console.log(`  Database: ${urlMatch[5]}`);
      console.log('');
    }

    for (const investigation of investigations) {
      console.log(`${'='.repeat(70)}`);
      console.log(investigation.section);
      console.log(`${'='.repeat(70)}\n`);

      for (const query of investigation.queries) {
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
    console.log('INVESTIGATION COMPLETE');
    console.log(`${'='.repeat(70)}\n`);
    console.log('READ-ONLY investigation finished (0 mutations)');
    console.log('');
    console.log('⏸️  AWAITING HUMAN ANALYSIS');
    console.log('');
    console.log('Key questions to answer:');
    console.log('1. Is this the correct target database for Migration 05?');
    console.log('2. What is the current migration state?');
    console.log('3. Why are there 5 records in runtime_tenant_registry?');
    console.log('4. Does public.tenants schema match design expectations?');
    console.log('5. Are these test fixtures or production data?');

  } catch (err) {
    console.error('❌ Investigation error:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runInvestigation();
