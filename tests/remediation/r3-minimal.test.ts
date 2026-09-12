/**
 * R3 Minimal Test - Verify basic setup
 */

import { createClient } from '@/lib/supabase-server';

const TEST_TENANT = '88888888-8888-8888-8888-888888888888';

test('Can query persons', async () => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('persons')
    .select('id')
    .eq('tenant_id', TEST_TENANT)
    .limit(1);

  console.log('Persons query:', { data, error });
  expect(error).toBeNull();
  expect(data).toBeDefined();
});

test('Can create party', async () => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('party_parties')
    .insert({
      tenant_id: TEST_TENANT,
      party_type: 'person',
      display_name: 'Test Party',
    })
    .select()
    .single();

  console.log('Party insert:', { data, error });
  expect(error).toBeNull();
  expect(data).toBeDefined();

  // Cleanup
  if (data) {
    await supabase.from('party_parties').delete().eq('id', data.id);
  }
});
