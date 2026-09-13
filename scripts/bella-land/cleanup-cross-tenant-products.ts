/**
 * Cleanup products with cross-tenant project references
 * (Created during A9/A10 testing before Layer 5 enforcement)
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  console.log('🧹 Cleaning up cross-tenant product references\n');

  // Find products with cross-tenant projects
  const { data: violations, error: queryError } = await supabase
    .rpc('exec_sql', {
      sql_query: `
        SELECT 
          prod.id as product_id,
          prod.tenant_id as product_tenant,
          prod.project_id,
          proj.tenant_id as project_tenant
        FROM real_estate_products prod
        JOIN real_estate_projects proj ON prod.project_id = proj.id
        WHERE prod.tenant_id != proj.tenant_id
      `
    });

  if (queryError) {
    console.error('❌ Error querying violations:', queryError);
    process.exit(1);
  }

  if (!violations || violations.length === 0) {
    console.log('✅ No cross-tenant references found. Database clean.');
    return;
  }

  console.log(`⚠️  Found ${violations.length} product(s) with cross-tenant references:\n`);
  violations.forEach((v: any, i: number) => {
    console.log(`${i + 1}. Product ${v.product_id.substring(0, 8)}...`);
    console.log(`   Product tenant: ${v.product_tenant.substring(0, 8)}...`);
    console.log(`   Project tenant: ${v.project_tenant.substring(0, 8)}...`);
  });

  console.log('\nDeleting invalid products...\n');

  // Delete products with cross-tenant references
  const productIds = violations.map((v: any) => v.product_id);

  const { error: deleteError } = await supabase
    .from('real_estate_products')
    .delete()
    .in('id', productIds);

  if (deleteError) {
    console.error('❌ Error deleting products:', deleteError);
    process.exit(1);
  }

  console.log(`✅ Deleted ${productIds.length} product(s) with cross-tenant references`);
  console.log('\n✅ Database clean. Ready to apply Layer 5 constraint.');
}

main().catch(console.error);
