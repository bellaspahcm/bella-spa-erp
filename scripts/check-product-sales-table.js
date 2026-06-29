/**
 * Check if product_sales table exists
 * Usage: node scripts/check-product-sales-table.js
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function checkTable() {
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SERVICE_ROLE_KEY = process.env.SUPABASE_SECRET_KEY;
  
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('❌ Missing environment variables');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  console.log('🔍 Checking if product_sales table exists...\n');

  try {
    // Try to query the table
    const { data, error } = await supabase
      .from('product_sales')
      .select('id')
      .limit(1);

    if (error) {
      if (error.code === '42P01') {
        console.log('❌ Table product_sales does NOT exist');
        console.log('\n📋 To create the table, you need to run the migration:');
        console.log('\nOption 1: Supabase Dashboard (Recommended)');
        console.log('  1. Go to: https://supabase.com/dashboard/project/lvnvkpyxtuilhrabtlwv/sql');
        console.log('  2. Copy content from: supabase/migrations/20260622164000_create_product_sales.sql');
        console.log('  3. Paste and click "Run"');
        console.log('\nOption 2: Supabase CLI');
        console.log('  npx supabase db push --db-url $env:SUPABASE_DB_URL');
        console.log('\nOption 3: Direct psql (if installed)');
        console.log('  psql $env:SUPABASE_DB_URL -f supabase/migrations/20260622164000_create_product_sales.sql');
        process.exit(1);
      }
      throw error;
    }

    console.log('✅ Table product_sales EXISTS!');
    console.log(`   Query returned ${data ? data.length : 0} rows`);
    console.log('\n🎉 You can now:');
    console.log('  1. Run: npm run types:generate');
    console.log('  2. Uncomment server actions in: src/modules/product-sales/actions/product-sales-actions.ts');
    console.log('  3. Continue with Task 16');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkTable();
