const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const { data: beds, error: bedErr } = await sb
    .from('hc_beds')
    .select('id, ward_id, status')
    .eq('tenant_id', 'c1e19d70-36ab-4a5f-a36c-92f7e7f6e05d')
    .limit(3);

  const { data: wards } = await sb
    .from('hc_wards')
    .select('id, name')
    .eq('tenant_id', 'c1e19d70-36ab-4a5f-a36c-92f7e7f6e05d')
    .limit(2);

  const { data: admissions, error: admErr } = await sb
    .from('hc_inpatient_admissions')
    .select('*')
    .eq('tenant_id', 'c1e19d70-36ab-4a5f-a36c-92f7e7f6e05d')
    .limit(1);

  console.log('BEDS:', JSON.stringify(beds, null, 2));
  if (bedErr) console.log('BED ERR:', bedErr.message);
  console.log('WARDS:', JSON.stringify(wards, null, 2));
  if (admissions && admissions[0]) {
    console.log('ADMISSION KEYS:', Object.keys(admissions[0]));
    console.log('bed_id nullable?', admissions[0].bed_id === null ? 'YES' : 'NO (' + admissions[0].bed_id + ')');
    console.log('ward_id:', admissions[0].ward_id);
  } else {
    console.log('No admissions:', admErr?.message);
  }
}

main().catch(console.error);
