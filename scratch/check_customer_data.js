const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://lvnvkpyxtuilhrabtlwv.supabase.co', 'PLACEHOLDER_SUPABASE_ANON_KEY');

async function checkData() {
  console.log('--- Checking Customers with name "Bích Liên" or phone "0989567567" ---');
  const { data: customers, error: custError } = await supabase
    .from('customers')
    .select('*')
    .or('name_mother.ilike.%Bích Liên%,phone.eq.0989567567');
  
  if (custError) {
    console.error('Error fetching customers:', custError);
    return;
  }
  
  console.log('Customers found:', JSON.stringify(customers, null, 2));
  
  if (customers && customers.length > 0) {
    const customerIds = customers.map(c => c.id);
    console.log('\n--- Checking Bookings for these customers ---');
    const { data: bookings, error: bookError } = await supabase
      .from('bookings')
      .select('*, customers(name_mother)')
      .in('customer_id', customerIds);
    
    if (bookError) {
      console.error('Error fetching bookings:', bookError);
    } else {
      console.log('Bookings found:', JSON.stringify(bookings, null, 2));
    }
  }
}

checkData();
