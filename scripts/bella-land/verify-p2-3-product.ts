#!/usr/bin/env tsx
/**
 * P2.3 B10 — Independent DB Verification
 * 
 * Verify product was created with correct tenant_id and project_id
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables
config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function verifyProduct(productCode: string) {
  console.log('═══════════════════════════════════════════════════════');
  console.log('P2.3 B10 — Independent DB Verification');
  console.log('═══════════════════════════════════════════════════════\n');

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌ Missing Supabase credentials');
    console.error('   Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  console.log(`🔍 Querying product: ${productCode}\n`);

  const { data: products, error } = await supabase
    .from('real_estate_products')
    .select('*')
    .eq('product_code', productCode)
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) {
    console.error('❌ Query failed:', error.message);
    process.exit(1);
  }

  if (!products || products.length === 0) {
    console.error('❌ Product not found in database');
    console.error(`   Product code: ${productCode}`);
    process.exit(1);
  }

  const product = products[0];

  console.log('✅ Product found in database\n');
  console.log('📋 Product Details:');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`   ID:           ${product.id}`);
  console.log(`   Product Code: ${product.product_code}`);
  console.log(`   Product Type: ${product.product_type}`);
  console.log(`   Status:       ${product.status}`);
  console.log(`   Block:        ${product.block || 'N/A'}`);
  console.log(`   Floor:        ${product.floor || 'N/A'}`);
  console.log(`   Area:         ${product.area || 'N/A'} m²`);
  console.log(`   Unit Price:   ${product.unit_price?.toLocaleString() || 'N/A'} VND`);
  console.log(`   Created:      ${product.created_at}`);
  console.log('═══════════════════════════════════════════════════════\n');

  // B10 Acceptance Criteria
  const EXPECTED_TENANT_ID = '1a6643da-3806-4793-a301-7a6d60b0d888';
  const EXPECTED_PROJECT_ID = '47685225-5b46-4cbc-a191-2426e6873cb7';

  console.log('🎯 B10 Acceptance Verification:');
  console.log('═══════════════════════════════════════════════════════');

  let allPass = true;

  // Check tenant_id
  if (product.tenant_id === EXPECTED_TENANT_ID) {
    console.log(`✅ tenant_id:  ${product.tenant_id}`);
  } else {
    console.log(`❌ tenant_id:  ${product.tenant_id}`);
    console.log(`   Expected:   ${EXPECTED_TENANT_ID}`);
    allPass = false;
  }

  // Check project_id
  if (product.project_id === EXPECTED_PROJECT_ID) {
    console.log(`✅ project_id: ${product.project_id}`);
  } else {
    console.log(`❌ project_id: ${product.project_id}`);
    console.log(`   Expected:   ${EXPECTED_PROJECT_ID}`);
    allPass = false;
  }

  // Check product_code
  if (product.product_code === productCode) {
    console.log(`✅ product_code: ${product.product_code}`);
  } else {
    console.log(`❌ product_code: ${product.product_code}`);
    console.log(`   Expected:    ${productCode}`);
    allPass = false;
  }

  // Check data integrity
  console.log(`✅ Data integrity: ${product.block ? 'block set' : 'no block'}, ${product.floor ? 'floor set' : 'no floor'}, ${product.area ? 'area set' : 'no area'}`);

  console.log('═══════════════════════════════════════════════════════\n');

  if (allPass) {
    console.log('🎉 B10 VERIFICATION: PASS');
    console.log('   All acceptance criteria met\n');
    process.exit(0);
  } else {
    console.log('❌ B10 VERIFICATION: FAIL');
    console.log('   Some criteria not met\n');
    process.exit(1);
  }
}

// Main
const productCode = process.argv[2];

if (!productCode) {
  console.error('Usage: npx tsx scripts/bella-land/verify-p2-3-product.ts <product-code>');
  console.error('Example: npx tsx scripts/bella-land/verify-p2-3-product.ts P2.3-PREVIEW-20260911-001');
  process.exit(1);
}

verifyProduct(productCode).catch((err) => {
  console.error('❌ Unexpected error:', err);
  process.exit(1);
});
