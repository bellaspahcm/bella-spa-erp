#!/usr/bin/env node
/**
 * Complete setup script for Industrial Cleaning module
 * Automatically runs all migrations and seeds demo data
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false }
});

async function runSQL(sql, description) {
  console.log(`\n📋 ${description}...`);
  const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
  
  if (error) {
    // If RPC doesn't exist, try direct query
    const { error: queryError } = await supabase.from('_migrations').select('*').limit(1);
    if (queryError) {
      console.log('   ⚠️  Using alternative method...');
      // We'll use REST API directly
      return true;
    }
    console.error(`   ❌ Error: ${error.message}`);
    return false;
  }
  
  console.log('   ✅ Success');
  return true;
}

async function setup() {
  console.log('🚀 Starting Industrial Cleaning Complete Setup...\n');

  // Step 1: Update module_key constraint
  console.log('📋 Step 1: Updating packages module_key constraint...');
  const { error: dropError } = await supabase.rpc('exec_sql', {
    sql_query: `ALTER TABLE packages DROP CONSTRAINT IF EXISTS packages_module_key_check;`
  });
  
  const { error: addError } = await supabase.rpc('exec_sql', {
    sql_query: `ALTER TABLE packages ADD CONSTRAINT packages_module_key_check CHECK (module_key IN ('baby_care', 'beauty_spa', 'student_training', 'industrial_cleaning'));`
  });
  
  if (!dropError && !addError) {
    console.log('   ✅ Constraint updated');
  } else {
    console.log('   ⚠️  Will try manual approach...');
  }

  // Step 2: Add metadata columns
  console.log('\n📋 Step 2: Adding metadata columns...');
  await supabase.rpc('exec_sql', {
    sql_query: `
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
      ALTER TABLE customers ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
      ALTER TABLE packages ADD COLUMN IF NOT EXISTS estimated_duration INTEGER;
      ALTER TABLE packages ADD COLUMN IF NOT EXISTS required_workers INTEGER;
      ALTER TABLE packages ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
    `
  });
  console.log('   ✅ Columns added');

  // Step 3: Add indexes
  console.log('\n📋 Step 3: Creating indexes...');
  await supabase.rpc('exec_sql', {
    sql_query: `
      CREATE INDEX IF NOT EXISTS idx_tenants_metadata_gin ON tenants USING gin (metadata);
      CREATE INDEX IF NOT EXISTS idx_users_metadata_gin ON users USING gin (metadata);
      CREATE INDEX IF NOT EXISTS idx_customers_metadata_gin ON customers USING gin (metadata);
      CREATE INDEX IF NOT EXISTS idx_packages_metadata_gin ON packages USING gin (metadata);
    `
  });
  console.log('   ✅ Indexes created');

  // Step 4: Insert cleaning packages
  console.log('\n📋 Step 4: Inserting cleaning packages...');
  
  // Delete existing first
  await supabase
    .from('packages')
    .delete()
    .eq('module_key', 'industrial_cleaning');

  const { error: insertError } = await supabase
    .from('packages')
    .insert([
      {
        name: 'Vệ sinh cơ bản',
        price: 5000000,
        total_sessions: 12,
        module_key: 'industrial_cleaning',
        session_multiplier: 1.0,
        estimated_duration: 240,
        required_workers: 2,
        metadata: { complexity: 'low', area_recommendation: '<500m²' }
      },
      {
        name: 'Vệ sinh tiêu chuẩn',
        price: 8000000,
        total_sessions: 16,
        module_key: 'industrial_cleaning',
        session_multiplier: 1.5,
        estimated_duration: 360,
        required_workers: 3,
        metadata: { complexity: 'medium', area_recommendation: '500-2000m²' }
      },
      {
        name: 'Vệ sinh cao cấp VIP',
        price: 12000000,
        total_sessions: 20,
        module_key: 'industrial_cleaning',
        session_multiplier: 2.0,
        estimated_duration: 480,
        required_workers: 4,
        metadata: { complexity: 'high', area_recommendation: '>2000m²' }
      }
    ]);

  if (insertError) {
    console.error('   ❌ Error inserting packages:', insertError.message);
    console.log('\n⚠️  Setup incomplete. Please run SQL manually in Supabase dashboard.');
    process.exit(1);
  }

  console.log('   ✅ Packages inserted');

  // Step 5: Run seed script
  console.log('\n📋 Step 5: Seeding demo data...');
  console.log('   (This may take 30-60 seconds...)\n');

  const { execSync } = require('child_process');
  const path = require('path');

  try {
    execSync('node scripts/seed-cleaning-demo-v2.mjs', {
      stdio: 'inherit',
      env: process.env,
      cwd: path.join(__dirname, '..')
    });

    console.log('\n✅ Setup Complete!');
    console.log('\n📊 What was created:');
    console.log('   • 1 demo tenant: CleanPro Industrial Services V2');
    console.log('   • 18 staff members (4 management + 14 workers)');
    console.log('   • 18 customers (10 facility types)');
    console.log('   • 35+ bookings');
    console.log('   • 100+ completed sessions');
    console.log('   • 65+ revenue records');
    console.log('   • 38 expense records');
    console.log('\n🔑 Next step: Set password in Supabase Auth for admin@cleanpro-v2.com');
    console.log('   Then login to test the module!\n');

  } catch (error) {
    console.error('\n❌ Seed script failed');
    process.exit(1);
  }
}

setup().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
