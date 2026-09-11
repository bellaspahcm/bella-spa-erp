/**
 * Reset passwords for test users used in P1.3 tenant isolation tests
 * Uses Supabase Admin API (service-role) to update auth.users
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env.local explicitly
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceRole) {
  console.error('Missing environment variables:');
  console.error('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl);
  console.error('SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceRole ? '[SET]' : '[MISSING]');
  process.exit(1);
}

const TEST_PASSWORD = 'Test123456!';

const TEST_USERS = [
  {
    email: 'loadtest-realestate@test.local',
    id: 'dd08794e-3b6a-4f19-9a5e-4bc0a4a26484',
  },
  {
    email: 'loadtest-healthcare@test.local',
    id: '8fe4018a-d667-4368-8edf-5b7478814a0b',
  },
];

async function main() {
  const supabase = createClient(supabaseUrl, supabaseServiceRole, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  console.log('Resetting test user passwords...\n');

  for (const user of TEST_USERS) {
    console.log(`Resetting password for ${user.email}...`);

    const { data, error } = await supabase.auth.admin.updateUserById(user.id, {
      password: TEST_PASSWORD,
    });

    if (error) {
      console.error(`❌ Failed to reset ${user.email}:`, error);
    } else {
      console.log(`✅ Password reset for ${user.email}`);
    }
  }

  console.log('\n✅ Password reset complete');
  console.log(`\nTest password: ${TEST_PASSWORD}`);
  console.log('\nYou can now run: npm run test:bella-land:tenant-isolation');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
