#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
});

async function main() {
  console.log('🔍 Checking tenants table schema...\n');
  
  const { data, error } = await supabase
    .from('tenants')
    .select('*')
    .limit(1);

  if (error) {
    console.error('❌ Error:', error);
  } else {
    console.log('✅ Sample tenant:', data);
    if (data && data.length > 0) {
      console.log('\n📋 Available columns:');
      Object.keys(data[0]).forEach(col => console.log(`  - ${col}`));
    }
  }
}

main();
