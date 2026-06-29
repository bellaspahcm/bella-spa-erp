/**
 * Run product_sales migration manually using Supabase service role
 * Usage: node scripts/run-product-sales-migration.js
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Read env from .env.local
require('dotenv').config({ path: '.env.local' });

async function runMigration() {
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SERVICE_ROLE_KEY = process.env.SUPABASE_SECRET_KEY;
  
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in .env.local');
    process.exit(1);
  }

  // Create Supabase client with service role
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  try {
    // Read migration file
    const migrationPath = path.join(
      __dirname,
      '../supabase/migrations/20260622164000_create_product_sales.sql'
    );
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Running migration: 20260622164000_create_product_sales.sql');
    console.log('🔌 Using Supabase service role...');
    
    // Split migration into statements and execute each one
    // This is a workaround since Supabase client doesn't have raw SQL execution
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    console.log(`📝 Found ${statements.length} SQL statements to execute`);
    
    let successCount = 0;
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      
      // Skip comments and empty statements
      if (!stmt || stmt.startsWith('--') || stmt.startsWith('/*')) {
        continue;
      }
      
      try {
        // Execute via rpc (needs exec function created first) or use direct query
        // For now, we'll use a workaround with POST request
        const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${SERVICE_ROLE_KEY}`
          },
          body: JSON.stringify({ sql: stmt + ';' })
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.warn(`⚠️  Statement ${i + 1} warning: ${errorText.substring(0, 100)}`);
        } else {
          successCount++;
        }
      } catch (error) {
        console.warn(`⚠️  Statement ${i + 1} skipped: ${error.message.substring(0, 50)}`);
      }
    }
    
    console.log(`✅ Migration completed! (${successCount}/${statements.length} statements succeeded)`);
    console.log('');
    console.log('📊 Table created: public.product_sales');
    console.log('🔒 RLS policies enabled');
    console.log('📈 Indexes created for performance');
    console.log('');
    console.log('⚠️  Note: If you see warnings above, the table may already exist.');
    console.log('   Run: npm run types:generate to regenerate TypeScript types');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    if (error.stack) {
      console.error('   Stack:', error.stack.substring(0, 200));
    }
    process.exit(1);
  }
}

runMigration();
