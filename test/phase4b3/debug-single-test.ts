/**
 * Debug single test execution
 */
import { verifyMigration } from '../../src/platform/migration-governance/verification/index.js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function debugTest() {
  console.log('🔍 Debug Test T1 Execution\n');
  
  // Use HTTP URL for Supabase adapter, not PostgreSQL connection string
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  console.log('Supabase URL:', supabaseUrl);
  console.log('Service Role Key:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ Set' : '❌ Missing');
  
  try {
    const result = await verifyMigration({
      migration_id: 'debug-t1',
      migration_file: 'test/phase4b3/declarations/t1.yaml',
      commit_sha: 'test-debug',
      approval_id: 'test-approval',
      environment: 'test',
      database_url: supabaseUrl!,
    });

    console.log('\n📊 RESULT:');
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('\n❌ ERROR:', error);
    if (error instanceof Error) {
      console.error('Message:', error.message);
      console.error('Stack:', error.stack);
    }
  }
}

debugTest();
