const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://lvnvkpyxtuilhrabtlwv.supabase.co', 'PLACEHOLDER_SUPABASE_ANON_KEY');

async function checkData() {
  console.log('--- Checking Customers with name containing "Diệu" ---');
  const { data: customers, error: custError } = await supabase
    .from('customers')
    .select('*')
    .ilike('name_mother', '%Diệu%');
  
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
      .select('*')
      .in('customer_id', customerIds);
    
    if (bookError) {
      console.error('Error fetching bookings:', bookError);
    } else {
      console.log('Bookings found:', JSON.stringify(bookings, null, 2));
      
      const bookingIds = bookings.map(b => b.id);
      console.log('\n--- Checking Revenue for these bookings ---');
      const { data: revenues, error: revError } = await supabase
        .from('revenue')
        .select('*')
        .in('booking_id', bookingIds);
      
      if (revError) {
        console.error('Error fetching revenues:', revError);
      } else {
        console.log('Revenues found:', JSON.stringify(revenues, null, 2));
      }
    }
  }
}

checkData();
