/**
 * Detailed Live Schema Inspection - re_reservations
 * 
 * Goal: Build evidence matrix for minimal safe fix
 * NOT: Normalize entire migration history
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

interface ColumnInfo {
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
  udt_name: string;
}

interface EnumValue {
  enumlabel: string;
}

interface ConstraintInfo {
  constraint_name: string;
  constraint_type: string;
  column_name: string;
  foreign_table_name: string | null;
  check_clause: string | null;
}

interface IndexInfo {
  indexname: string;
  indexdef: string;
}

async function inspectLiveSchema() {
  console.log('\n🔍 Live Schema Inspection - re_reservations\n');
  console.log('═'.repeat(80));

  console.log('\n📋 GOAL: Build evidence matrix for minimal safe fix');
  console.log('   NOT: Normalize entire migration history');
  console.log('   Separate: Reservation workflow vs migration governance');

  // Step 1: Columns
  console.log('\n' + '━'.repeat(80));
  console.log('STEP 1: Column Structure');
  console.log('━'.repeat(80));

  const { data: columns, error: colError } = await supabase
    .rpc('exec_sql', {
      sql: `
        SELECT 
          column_name,
          data_type,
          is_nullable,
          column_default,
          udt_name
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 're_reservations'
        ORDER BY ordinal_position;
      `
    }) as { data: ColumnInfo[] | null; error: any };

  if (colError) {
    console.log('\n⚠️  Cannot query columns directly via RPC');
    console.log('   Attempting alternative inspection...\n');
    
    // Try direct table query to infer structure
    const { data: sample, error: sampleError } = await supabase
      .from('re_reservations')
      .select('*')
      .limit(1);

    if (sampleError) {
      console.error('❌ Cannot inspect table:', sampleError.message);
    } else {
      console.log('✅ Table accessible');
      if (sample && sample.length > 0) {
        console.log('\n📊 Inferred columns from sample:');
        Object.keys(sample[0]).forEach(col => {
          console.log(`   - ${col}: ${typeof sample[0][col]}`);
        });
      } else {
        console.log('\n✅ Table empty (0 rows)');
        console.log('   Cannot infer full schema from data');
      }
    }
  } else if (columns) {
    console.log(`\n✅ Found ${columns.length} columns:\n`);
    
    columns.forEach(col => {
      const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
      const defaultVal = col.column_default ? ` DEFAULT ${col.column_default}` : '';
      console.log(`   ${col.column_name.padEnd(25)} ${col.data_type.padEnd(20)} ${nullable.padEnd(10)}${defaultVal}`);
    });
  }

  // Step 2: Enum types (if status is enum)
  console.log('\n' + '━'.repeat(80));
  console.log('STEP 2: Enum Types');
  console.log('━'.repeat(80));

  const { data: enums, error: enumError } = await supabase
    .rpc('exec_sql', {
      sql: `
        SELECT 
          t.typname as enum_name,
          e.enumlabel as enum_value
        FROM pg_type t 
        JOIN pg_enum e ON t.oid = e.enumtypid  
        WHERE t.typname LIKE '%reservation%'
        ORDER BY t.typname, e.enumsortorder;
      `
    }) as { data: any[] | null; error: any };

  if (enumError) {
    console.log('\n⚠️  Cannot query enums via RPC');
    console.log('   Checking if status column exists...\n');
    
    const { data: statusCheck } = await supabase
      .from('re_reservations')
      .select('status')
      .limit(0);
    
    if (statusCheck !== null) {
      console.log('✅ Status column exists (type inspection requires direct DB access)');
    }
  } else if (enums && enums.length > 0) {
    console.log('\n✅ Enum types found:\n');
    
    const grouped = enums.reduce((acc: any, curr: any) => {
      if (!acc[curr.enum_name]) acc[curr.enum_name] = [];
      acc[curr.enum_name].push(curr.enum_value);
      return acc;
    }, {});

    Object.entries(grouped).forEach(([name, values]) => {
      console.log(`   ${name}:`);
      (values as string[]).forEach(v => console.log(`      - '${v}'`));
      console.log('');
    });
  } else {
    console.log('\n⚠️  No reservation enum types found');
    console.log('   Status might be TEXT with CHECK constraint');
  }

  // Step 3: Constraints
  console.log('\n' + '━'.repeat(80));
  console.log('STEP 3: Constraints');
  console.log('━'.repeat(80));

  const { data: constraints, error: conError } = await supabase
    .rpc('exec_sql', {
      sql: `
        SELECT 
          tc.constraint_name,
          tc.constraint_type,
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          cc.check_clause
        FROM information_schema.table_constraints AS tc 
        LEFT JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        LEFT JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
        LEFT JOIN information_schema.check_constraints AS cc
          ON cc.constraint_name = tc.constraint_name
        WHERE tc.table_schema = 'public' 
          AND tc.table_name = 're_reservations'
        ORDER BY tc.constraint_type, tc.constraint_name;
      `
    }) as { data: ConstraintInfo[] | null; error: any };

  if (conError || !constraints) {
    console.log('\n⚠️  Cannot query constraints via RPC');
    console.log('   (Requires direct DB access for full constraint inspection)');
  } else {
    console.log(`\n✅ Found ${constraints.length} constraints:\n`);
    
    const byType = constraints.reduce((acc: any, curr) => {
      if (!acc[curr.constraint_type]) acc[curr.constraint_type] = [];
      acc[curr.constraint_type].push(curr);
      return acc;
    }, {});

    Object.entries(byType).forEach(([type, items]) => {
      console.log(`   ${type}:`);
      (items as ConstraintInfo[]).forEach(c => {
        if (c.constraint_type === 'FOREIGN KEY') {
          console.log(`      ${c.constraint_name}: ${c.column_name} → ${c.foreign_table_name}`);
        } else if (c.constraint_type === 'CHECK') {
          console.log(`      ${c.constraint_name}: ${c.check_clause}`);
        } else {
          console.log(`      ${c.constraint_name}: ${c.column_name || '(multiple)'}`);
        }
      });
      console.log('');
    });
  }

  // Step 4: Indexes
  console.log('\n' + '━'.repeat(80));
  console.log('STEP 4: Indexes');
  console.log('━'.repeat(80));

  const { data: indexes, error: idxError } = await supabase
    .rpc('exec_sql', {
      sql: `
        SELECT indexname, indexdef
        FROM pg_indexes
        WHERE schemaname = 'public' AND tablename = 're_reservations'
        ORDER BY indexname;
      `
    }) as { data: IndexInfo[] | null; error: any };

  if (idxError || !indexes) {
    console.log('\n⚠️  Cannot query indexes via RPC');
  } else {
    console.log(`\n✅ Found ${indexes.length} indexes:\n`);
    indexes.forEach(idx => {
      console.log(`   ${idx.indexname}:`);
      console.log(`      ${idx.indexdef}\n`);
    });
  }

  // Step 5: Current service expectations
  console.log('\n' + '━'.repeat(80));
  console.log('STEP 5: Service Contract Requirements');
  console.log('━'.repeat(80));

  console.log('\n📋 From ReservationService (src/platform/real-estate/engines/reservation.service.ts):');
  console.log('');
  console.log('   Required fields:');
  console.log('      - id (UUID)');
  console.log('      - tenant_id (UUID, NOT NULL)');
  console.log('      - product_id (UUID, NOT NULL)');
  console.log('      - customer_id (UUID, NOT NULL)');
  console.log('      - status (reservation_status enum: pending_deposit | deposited | converted_to_contract | cancelled)');
  console.log('      - deposit_amount (NUMERIC, DEFAULT 0)');
  console.log('      - reserved_at (TIMESTAMPTZ)');
  console.log('      - created_at (TIMESTAMPTZ)');
  console.log('      - updated_at (TIMESTAMPTZ)');
  console.log('');
  console.log('   Optional fields (used by service):');
  console.log('      - user_id (UUID, nullable)');
  console.log('      - deposited_at (TIMESTAMPTZ, nullable)');
  console.log('      - converted_at (TIMESTAMPTZ, nullable)');
  console.log('      - cancelled_at (TIMESTAMPTZ, nullable)');
  console.log('      - created_by (UUID, nullable)');
  console.log('      - updated_by (UUID, nullable)');
  console.log('      - notes (TEXT, nullable)');
  console.log('      - metadata (JSONB, nullable)');

  // Step 6: Generate evidence matrix
  console.log('\n' + '━'.repeat(80));
  console.log('STEP 6: Evidence Matrix Preparation');
  console.log('━'.repeat(80));

  console.log('\n⚠️  Full matrix requires direct DB schema inspection');
  console.log('   Recommended: Run these queries via Supabase Dashboard SQL Editor:\n');

  console.log('   -- Check status column type');
  console.log('   SELECT data_type, udt_name, is_nullable');
  console.log('   FROM information_schema.columns');
  console.log(`   WHERE table_name = 're_reservations' AND column_name = 'status';\n`);

  console.log('   -- Check if deposit_amount exists');
  console.log('   SELECT column_name');
  console.log('   FROM information_schema.columns');
  console.log(`   WHERE table_name = 're_reservations' AND column_name = 'deposit_amount';\n`);

  console.log('   -- Check user_id NOT NULL constraint');
  console.log('   SELECT is_nullable');
  console.log('   FROM information_schema.columns');
  console.log(`   WHERE table_name = 're_reservations' AND column_name = 'user_id';\n`);

  console.log('   -- List ALL columns');
  console.log('   SELECT column_name, data_type, is_nullable, column_default');
  console.log('   FROM information_schema.columns');
  console.log(`   WHERE table_name = 're_reservations'`);
  console.log('   ORDER BY ordinal_position;');

  // Step 7: Record count
  console.log('\n' + '━'.repeat(80));
  console.log('STEP 7: Data Safety Check');
  console.log('━'.repeat(80));

  const { count, error: countError } = await supabase
    .from('re_reservations')
    .select('*', { count: 'exact', head: true });

  if (countError) {
    console.error('\n❌ Cannot count records:', countError.message);
  } else {
    console.log(`\n✅ Current record count: ${count}`);
    if (count === 0) {
      console.log('   🟢 Safe to modify schema (no data to migrate)');
    } else {
      console.log(`   ⚠️  Data exists - schema changes require careful migration`);
    }
  }

  // Summary
  console.log('\n' + '═'.repeat(80));
  console.log('📊 INSPECTION SUMMARY');
  console.log('═'.repeat(80));

  console.log('\n✅ Completed partial inspection via Supabase client');
  console.log('⚠️  Full schema details require direct DB access or Dashboard');
  console.log('');
  console.log('📋 Next Steps:');
  console.log('   1. Run suggested SQL queries via Dashboard');
  console.log('   2. Build live vs service evidence matrix');
  console.log('   3. Identify minimal safe fix');
  console.log('   4. Apply targeted schema changes only');
  console.log('   5. Test reservation creation immediately');
  console.log('');
  console.log('🎯 Goal: Smallest fix to unblock workflow, NOT perfect schema');
  console.log('📝 Track: Migration governance debt separately');

  console.log('\n' + '═'.repeat(80) + '\n');
}

inspectLiveSchema().catch((err) => {
  console.error('\n❌ Inspection failed:', err);
  process.exit(1);
});
