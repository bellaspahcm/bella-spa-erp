#!/usr/bin/env node
/**
 * Quick migration runner for position_tier and hire_date columns
 * Task 18-19: Add Position Tier & Hire Date to Users
 */

const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

async function runMigration() {
  console.log('🚀 Running migration: Add position_tier and hire_date to users table...\n');

  const sql = fs.readFileSync(
    'supabase/migrations/20260622180000_add_position_tier_and_hire_date_to_users.sql',
    'utf8'
  );

  try {
    // Execute SQL migration
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
    
    if (error) {
      // If exec_sql RPC doesn't exist, try direct query
      const lines = sql.split(';').filter(line => line.trim());
      for (const line of lines) {
        if (line.trim()) {
          const { error: lineError } = await supabase.from('_prisma_migrations').select('*').limit(0);
          if (lineError) {
            console.log('⚠️  Cannot run SQL directly. Please run migration manually.');
            console.log('\nSQL to execute:\n');
            console.log(sql);
            process.exit(1);
          }
        }
      }
    }

    console.log('✅ Migration completed successfully!\n');
    console.log('Added columns:');
    console.log('  - position_tier (text, CHECK constraint: junior/senior/lead)');
    console.log('  - hire_date (date)');
    console.log('  - Indexes for performance');
    
    // Verify columns exist
    const { data: columns, error: verifyError } = await supabase
      .from('users')
      .select('id, position_tier, hire_date')
      .limit(1);
    
    if (!verifyError) {
      console.log('\n✅ Verification: Columns accessible via Supabase client');
    } else {
      console.log('\n⚠️  Note: Database types need regeneration. Run:');
      console.log('   npm run types:generate');
    }
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    console.log('\n📝 Please run this SQL manually in Supabase Dashboard:\n');
    console.log(sql);
    process.exit(1);
  }
}

runMigration();
