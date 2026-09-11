/**
 * Apply Layer 5 cross-entity enforcement migration
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  console.log('🔧 Applying Layer 5 Cross-Entity Enforcement Migration\n');
  console.log('=' .repeat(60));

  // Read migration SQL
  const migrationPath = path.join(
    process.cwd(),
    'supabase/migrations/20260911000001_layer5_cross_entity_enforcement.sql'
  );

  const sql = fs.readFileSync(migrationPath, 'utf-8');

  console.log('\n📄 Migration: 20260911000001_layer5_cross_entity_enforcement.sql');
  console.log('\nExecuting SQL...\n');

  try {
    // Execute migration
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    }

    console.log('✅ Migration applied successfully!\n');
    console.log('=' .repeat(60));
    console.log('\n🔒 Layer 5 Enforcement NOW ACTIVE:');
    console.log('   - Product.tenant_id MUST equal Project.tenant_id');
    console.log('   - Enforced by composite FK at database level');
    console.log('   - Cannot be bypassed (even by service_role with FK checks)');
    console.log('\n▶️  Ready to rerun P2.2 A1-A10');

  } catch (err) {
    console.error('❌ Error executing migration:', err);
    process.exit(1);
  }
}

main().catch(console.error);
