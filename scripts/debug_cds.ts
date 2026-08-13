import { createClient } from '../src/lib/supabase-server';
import { CdsEngineService } from '../src/platform/healthcare/engines/cds-engine/cds-engine.service';
import { randomUUID } from 'crypto';

async function main() {
  const supabase = await createClient();
  
  console.log('--- 1. Deleting PARACETAMOL and WARFARIN interactions ---');
  const del1 = await supabase.from('hc_drug_interactions').delete().eq('drug_a_code', 'PARACETAMOL').eq('drug_b_code', 'WARFARIN');
  console.log('Delete 1:', del1);
  
  const del2 = await supabase.from('hc_drug_interactions').delete().eq('drug_a_code', 'WARFARIN').eq('drug_b_code', 'PARACETAMOL');
  console.log('Delete 2:', del2);
  
  console.log('--- 2. Inserting interaction ---');
  const ins = await supabase.from('hc_drug_interactions').insert({
    id: randomUUID(),
    drug_a_code: 'PARACETAMOL',
    drug_b_code: 'WARFARIN',
    severity: 'WARNING',
    enforcement: 'ACKNOWLEDGE',
    clinical_effect: 'May increase anticoagulation',
    evidence_level: 'B',
    kb_version: '1.0',
    is_active: true
  }).select().single();
  console.log('Insert:', ins);
}

main().catch(console.error);
