/**
 * Integration Test Setup
 * Cleans retail tables before tests
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function cleanRetailTables() {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase credentials');
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  
  // Truncate tables in correct order (respecting foreign keys)
  await supabase.from('retail_sale_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('retail_sales').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('retail_inventory_movements').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('retail_product_batches').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('retail_product_variants').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('retail_products').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('retail_customers').delete().neq('id', '00000000-0000-0000-0000-000000000000');
}
