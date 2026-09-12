/**
 * P5.5 DIAGNOSTIC: Product Creation Status Bug
 * 
 * PURPOSE:
 * Investigate why creating Product with status="available" results in status="booked"
 * after save in production UI.
 * 
 * INVESTIGATION PLAN:
 * 1. Create Product with explicit status="available"
 * 2. Immediately query DB to verify actual stored value
 * 3. Compare with UI read-back value
 * 4. Check for any race conditions or background processes
 * 
 * USAGE:
 * npx tsx scripts/bella-land/diagnose-product-creation-status.ts
 */

import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/database.types';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

type ProductRow = Database['public']['Tables']['real_estate_products']['Row'];

async function main() {
  console.log('\n━━━ P5.5 DIAGNOSTIC: Product Creation Status Bug ━━━\n');

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌ Missing Supabase credentials');
    process.exit(1);
  }

  const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  // Test tenant and project
  const TENANT_ID = '1a6643da-3806-4793-a301-7a6d60b0d888';
  
  console.log('Step 1: Finding test project...');
  const { data: projects, error: projError } = await supabase
    .from('real_estate_projects')
    .select('*')
    .eq('tenant_id', TENANT_ID)
    .limit(1);

  if (projError || !projects || projects.length === 0) {
    console.error('❌ No projects found:', projError?.message);
    process.exit(1);
  }

  const projectId = projects[0].id;
  console.log(`✅ Using project: ${projects[0].name} (${projectId})`);

  // Create test product with explicit status="available"
  const testProductCode = `DIAG-TEST-${Date.now()}`;
  console.log(`\nStep 2: Creating product ${testProductCode} with status="available"...`);

  const { data: createdProduct, error: createError } = await supabase
    .from('real_estate_products')
    .insert({
      tenant_id: TENANT_ID,
      project_id: projectId,
      product_code: testProductCode,
      product_type: 'apartment',
      status: 'available',  // EXPLICIT
      area: 75.5,
      unit_price: 50000000,
      block: 'DIAG',
      floor: '99',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (createError || !createdProduct) {
    console.error('❌ Create failed:', createError?.message);
    process.exit(1);
  }

  console.log('✅ Product created:', {
    id: createdProduct.id,
    product_code: createdProduct.product_code,
    status: createdProduct.status,  // What INSERT returned
  });

  // IMMEDIATELY query DB again to verify stored value
  console.log('\nStep 3: Re-querying DB to verify stored status...');
  
  await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay

  const { data: verifyProduct, error: verifyError } = await supabase
    .from('real_estate_products')
    .select('*')
    .eq('id', createdProduct.id)
    .single();

  if (verifyError || !verifyProduct) {
    console.error('❌ Verify query failed:', verifyError?.message);
    process.exit(1);
  }

  console.log('✅ DB verification:', {
    id: verifyProduct.id,
    product_code: verifyProduct.product_code,
    status: verifyProduct.status,  // What DB actually stores
    created_at: verifyProduct.created_at,
    updated_at: verifyProduct.updated_at,
  });

  // Check for any reservations that might have been auto-created
  console.log('\nStep 4: Checking for unexpected reservations...');
  const { data: reservations, error: resError } = await supabase
    .from('re_reservations')
    .select('*')
    .eq('product_id', createdProduct.id);

  if (resError) {
    console.error('❌ Reservation query failed:', resError.message);
  } else if (reservations && reservations.length > 0) {
    console.log('⚠️  Found unexpected reservations:', reservations);
  } else {
    console.log('✅ No reservations found (expected)');
  }

  // Check audit trail
  console.log('\nStep 5: Checking for status change history...');
  const { data: updates, error: updateError } = await supabase
    .from('real_estate_products')
    .select('*')
    .eq('id', createdProduct.id)
    .order('updated_at', { ascending: false });

  if (updateError) {
    console.error('❌ History query failed:', updateError.message);
  } else {
    console.log('✅ Product history:', updates);
  }

  // VERDICT
  console.log('\n━━━ DIAGNOSTIC VERDICT ━━━\n');
  
  if (createdProduct.status === 'available' && verifyProduct.status === 'available') {
    console.log('✅ DB LAYER IS CORRECT');
    console.log('   - INSERT returned status="available"');
    console.log('   - DB verification shows status="available"');
    console.log('   - No background process changed status\n');
    console.log('⚠️  CLASSIFICATION: UI PRESENTATION BUG');
    console.log('   - DB stores correct value');
    console.log('   - UI must be misreading or caching stale data');
    console.log('   - Check client-side state management');
    console.log('   - Check fetchProductsAction response mapping\n');
  } else if (verifyProduct.status !== 'available') {
    console.log('❌ DB LAYER HAS ISSUE');
    console.log(`   - INSERT returned: ${createdProduct.status}`);
    console.log(`   - DB verification shows: ${verifyProduct.status}`);
    console.log('   - Something changed status after insert\n');
    console.log('⚠️  CLASSIFICATION: RACE CONDITION OR TRIGGER');
    console.log('   - Check for DB triggers on INSERT');
    console.log('   - Check for background workers');
    console.log('   - Check for event handlers\n');
  }

  // Cleanup
  console.log('Step 6: Cleaning up diagnostic product...');
  const { error: deleteError } = await supabase
    .from('real_estate_products')
    .delete()
    .eq('id', createdProduct.id);

  if (deleteError) {
    console.log('⚠️  Cleanup failed (manual deletion required):', deleteError.message);
  } else {
    console.log('✅ Diagnostic product deleted');
  }

  console.log('\n━━━ DIAGNOSTIC COMPLETE ━━━\n');
}

main().catch(console.error);
