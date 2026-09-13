/**
 * Inspect Deployed re_reservations Schema
 * 
 * Queries live database to determine actual deployed schema
 * Does NOT make assumptions about migration history
 */

import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function inspectDeployedSchema() {
  console.log('\n🔍 Inspecting Deployed re_reservations Schema\n');
  console.log('═'.repeat(70));

  // 1. Get table columns
  console.log('\n━'.repeat(70));
  console.log('TABLE COLUMNS');
  console.log('━'.repeat(70));

  const { data: columns, error: colError } = await supabase
    .rpc('exec_sql', {
      sql: `
        SELECT 
          column_name,
          data_type,
          is_nullable,
          column_default,
          character_maximum_length
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 're_reservations'
        ORDER BY ordinal_position;
      `
    });

  if (colError) {
    console.error('\n❌ Failed to fetch columns. Trying alternative method...');
    
    // Try direct query
    const { data: alt, error: altError } = await supabase
      .from('re_reservations')
      .select('*')
      .limit(0);
    
    if (altError) {
      console.error('Alternative method also failed:', altError.message);
    } else {
      console.log('\n⚠️  Cannot introspect schema via SQL. Using Supabase schema cache...');
      console.log('   Table exists and is queryable');
    }
  } else {
    console.log('\nDeployed Columns:');
    if (Array.isArray(columns)) {
      columns.forEach((col: any) => {
        const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
        console.log(`   - ${col.column_name.padEnd(20)} ${col.data_type.padEnd(20)} ${nullable}`);
        if (col.column_default) {
          console.log(`     DEFAULT: ${col.column_default}`);
        }
      });
    } else {
      console.log('   Columns data:', columns);
    }
  }

  // 2. Get enum types
  console.log('\n━'.repeat(70));
  console.log('ENUM TYPES (Reservation-related)');
  console.log('━'.repeat(70));

  const { data: enums, error: enumError } = await supabase
    .rpc('exec_sql', {
      sql: `
        SELECT 
          t.typname as enum_name,
          array_agg(e.enumlabel ORDER BY e.enumsortorder) as enum_values
        FROM pg_type t
        JOIN pg_enum e ON t.oid = e.enumtypid
        WHERE t.typname LIKE '%reservation%'
        GROUP BY t.typname
        ORDER BY t.typname;
      `
    });

  if (enumError) {
    console.error('\n⚠️  Cannot query enum types directly');
  } else if (Array.isArray(enums) && enums.length > 0) {
    enums.forEach((e: any) => {
      console.log(`\n   ${e.enum_name}:`);
      if (Array.isArray(e.enum_values)) {
        e.enum_values.forEach((v: string) => {
          console.log(`      - '${v}'`);
        });
      }
    });
  } else {
    console.log('\n   No reservation-related enums found (or exec_sql not available)');
  }

  // 3. Get constraints
  console.log('\n━'.repeat(70));
  console.log('CONSTRAINTS');
  console.log('━'.repeat(70));

  const { data: constraints, error: constError } = await supabase
    .rpc('exec_sql', {
      sql: `
        SELECT 
          conname as constraint_name,
          contype as constraint_type,
          pg_get_constraintdef(oid) as definition
        FROM pg_constraint
        WHERE conrelid = 'public.re_reservations'::regclass
        ORDER BY conname;
      `
    });

  if (constError) {
    console.error('\n⚠️  Cannot query constraints directly');
  } else if (Array.isArray(constraints) && constraints.length > 0) {
    constraints.forEach((c: any) => {
      const types: Record<string, string> = {
        'p': 'PRIMARY KEY',
        'f': 'FOREIGN KEY',
        'u': 'UNIQUE',
        'c': 'CHECK'
      };
      console.log(`\n   ${c.constraint_name} (${types[c.constraint_type] || c.constraint_type})`);
      console.log(`      ${c.definition}`);
    });
  } else {
    console.log('\n   No constraints found (or exec_sql not available)');
  }

  // 4. Sample data structure
  console.log('\n━'.repeat(70));
  console.log('SAMPLE RECORD STRUCTURE');
  console.log('━'.repeat(70));

  const { data: sample, error: sampleError } = await supabase
    .from('re_reservations')
    .select('*')
    .limit(1)
    .maybeSingle();

  if (sampleError) {
    console.log('\n   No sample records available');
  } else if (sample) {
    console.log('\n   Sample record fields:');
    Object.keys(sample).forEach(key => {
      const value = sample[key];
      const type = value === null ? 'null' : typeof value;
      console.log(`      ${key.padEnd(20)} ${type}`);
    });
  } else {
    console.log('\n   Table is empty (0 records)');
  }

  // 5. Try minimal insert to detect required fields
  console.log('\n━'.repeat(70));
  console.log('REQUIRED FIELDS DETECTION');
  console.log('━'.repeat(70));

  console.log('\n   Attempting minimal insert to identify NOT NULL columns...');

  const { data: tenant } = await supabase
    .from('tenants')
    .select('id')
    .limit(1)
    .single();

  if (!tenant) {
    console.log('   ⚠️  Cannot test: no tenants found');
  } else {
    // Try with only tenant_id
    const { error: e1 } = await supabase
      .from('re_reservations')
      .insert({ tenant_id: tenant.id })
      .select()
      .single();

    if (e1) {
      console.log(`\n   ❌ Insert failed: ${e1.message}`);
      console.log(`      Code: ${e1.code}`);
      
      // Extract required column from error message
      const match = e1.message.match(/column "([^"]+)".*not-null/i);
      if (match) {
        console.log(`\n      → Required column detected: ${match[1]}`);
      }
    } else {
      console.log('\n   ✅ Minimal insert succeeded (only tenant_id required)');
    }
  }

  // Summary
  console.log('\n' + '═'.repeat(70));
  console.log('📊 SCHEMA INSPECTION COMPLETE');
  console.log('═'.repeat(70));

  console.log('\n💡 Use this information to:');
  console.log('   1. Compare with migration files');
  console.log('   2. Identify schema drift');
  console.log('   3. Determine canonical schema');
  console.log('   4. Create forward migration if needed');

  console.log('\n' + '═'.repeat(70) + '\n');
}

inspectDeployedSchema().catch((err) => {
  console.error('\n❌ Unexpected error:', err);
  process.exit(1);
});
