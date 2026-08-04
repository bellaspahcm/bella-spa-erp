import { config } from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

config({ path: resolve(__dirname, '../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function inspectSchema() {
  // Try to insert a minimal customer to see what columns are required
  const testCustomer = {
    tenant_id: '6fbf594f-0da9-44be-9269-d24e42bcf50a',
    name: 'Test Customer', // Try 'name' instead of 'full_name'
    phone: '0900000001',
  };

  const { data, error } = await supabase
    .from('customers')
    .insert(testCustomer)
    .select();

  if (error) {
    console.log('❌ Error:', error);
    console.log('Trying with minimal fields...');
    
    // Try alternative field names
    const alternatives = [
      { tenant_id: testCustomer.tenant_id, customer_name: 'Test' },
      { tenant_id: testCustomer.tenant_id, name: 'Test' },
    ];

    for (const alt of alternatives) {
      const { error: altError } = await supabase
        .from('customers')
        .insert(alt)
        .select();
      
      if (!altError) {
        console.log('✅ Success with fields:', Object.keys(alt));
        return;
      }
      console.log('❌ Failed:', altError.message);
    }
  } else {
    console.log('✅ Success! Customer created:', data);
  }
}

inspectSchema();
