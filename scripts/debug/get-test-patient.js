require('dotenv').config({ path: '.env.test' });
const { createClient } = require('@supabase/supabase-js');

const client = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function getPatient() {
  console.log('Fetching available patients (party_type = person)...\n');
  
  const { data, error } = await client
    .from('party_parties')
    .select('id, party_type, display_name')
    .eq('party_type', 'person')
    .limit(5);
  
  if (error) {
    console.log('❌ Error:', error.message);
  } else {
    console.log('✅ Available patients:');
    console.log(JSON.stringify(data, null, 2));
    
    if (data && data.length > 0) {
      console.log('\n📋 Use this patient_party_id for smoke test:');
      console.log(`  patient_party_id: '${data[0].id}'`);
      console.log(`  name: ${data[0].display_name || 'N/A'}`);
    } else {
      console.log('\n⚠️ No patients found. Need to create one first.');
    }
  }
}

getPatient();
