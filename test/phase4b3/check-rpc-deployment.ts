/**
 * Check if Phase 4B.3 RPC functions are deployed
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const REQUIRED_RPCS = [
  'query_tables',
  'query_table_exists',
  'query_columns',
  'query_primary_key',
  'query_foreign_keys',
  'query_rls_status',
  'query_rls_policies',
];

async function checkRPCDeployment() {
  console.log('🔍 Checking Phase 4B.3 RPC Function Deployment\n');

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing environment variables:');
    console.error('   - SUPABASE_URL:', supabaseUrl ? '✅' : '❌');
    console.error('   - SUPABASE_SERVICE_ROLE_KEY:', supabaseKey ? '✅' : '❌');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('📡 Connected to:', supabaseUrl);
  console.log('\n📋 Checking 7 required RPC functions:\n');

  let deployed = 0;
  let missing = 0;

  for (const rpcName of REQUIRED_RPCS) {
    try {
      // Try to call with minimal valid input
      const { error } = await supabase.rpc(rpcName as any, {
        schema_name: 'public',
        table_name: 'test',
      });

      if (error) {
        // Check if it's a "function does not exist" error
        if (error.message.includes('does not exist')) {
          console.log(`  ❌ ${rpcName} - NOT DEPLOYED`);
          missing++;
        } else {
          // Function exists but returned an error (which is fine for this check)
          console.log(`  ✅ ${rpcName} - DEPLOYED`);
          deployed++;
        }
      } else {
        console.log(`  ✅ ${rpcName} - DEPLOYED`);
        deployed++;
      }
    } catch (err) {
      console.log(`  ❌ ${rpcName} - ERROR:`, err instanceof Error ? err.message : String(err));
      missing++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`📊 DEPLOYMENT STATUS`);
  console.log('='.repeat(60));
  console.log(`Deployed: ${deployed}/${REQUIRED_RPCS.length}`);
  console.log(`Missing: ${missing}/${REQUIRED_RPCS.length}`);

  if (deployed === REQUIRED_RPCS.length) {
    console.log('\n✅ ALL RPC FUNCTIONS DEPLOYED — Ready for testing');
    process.exit(0);
  } else {
    console.log('\n❌ RPC FUNCTIONS NOT FULLY DEPLOYED');
    console.log('\n📝 To deploy, run the migration:');
    console.log('   supabase/migrations/20260825120000_phase4b3_verification_rpc.sql');
    console.log('\nOptions:');
    console.log('   1. Supabase Dashboard → SQL Editor → paste migration');
    console.log('   2. supabase db push (if Docker running)');
    console.log('   3. Manual execution via psql');
    process.exit(1);
  }
}

checkRPCDeployment();
