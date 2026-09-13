import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log('Finding cross-tenant products...\n');
  
  // Step 1: Find violations
  const { data: products } = await supabase
    .from('real_estate_products')
    .select(`
      id,
      tenant_id,
      project_id,
      project:real_estate_projects(tenant_id)
    `);
  
  if (!products) {
    console.log('No products found');
    return;
  }
  
  const violations = products.filter(p => 
    p.project && p.tenant_id !== (p.project as any).tenant_id
  );
  
  console.log(`Found ${violations.length} cross-tenant products`);
  
  if (violations.length === 0) {
    console.log('✅ No cleanup needed');
    return;
  }
  
  // Step 2: Delete them
  for (const v of violations) {
    console.log(`Deleting product ${v.id.substring(0, 8)}...`);
    await supabase.from('real_estate_products').delete().eq('id', v.id);
  }
  
  console.log(`\n✅ Deleted ${violations.length} products`);
}

main();
