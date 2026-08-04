/**
 * Reset user password
 * Usage: npx tsx scripts/reset-user-password.ts EMAIL NEW_PASSWORD
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

config({ path: resolve(__dirname, '../.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function main() {
  const userEmail = process.argv[2];
  const newPassword = process.argv[3];

  if (!userEmail || !newPassword) {
    console.error('❌ Usage: npx tsx scripts/reset-user-password.ts EMAIL NEW_PASSWORD');
    console.error('   Example: npx tsx scripts/reset-user-password.ts auto.test@bellaspa.vn NewPass123!');
    process.exit(1);
  }

  if (newPassword.length < 6) {
    console.error('❌ Password must be at least 6 characters');
    process.exit(1);
  }

  console.log(`🔐 Resetting password for: ${userEmail}\n`);

  // Find user
  const { data: authUsers, error: listError } = await supabase.auth.admin.listUsers();

  if (listError) {
    console.error('❌ Failed to list users:', listError.message);
    process.exit(1);
  }

  const authUser = authUsers.users.find(u => u.email === userEmail);

  if (!authUser) {
    console.error(`❌ User not found: ${userEmail}`);
    process.exit(1);
  }

  // Update password
  const { data, error } = await supabase.auth.admin.updateUserById(
    authUser.id,
    { password: newPassword }
  );

  if (error) {
    console.error('❌ Failed to reset password:', error.message);
    process.exit(1);
  }

  console.log('✅ Password reset successfully!');
  console.log(`   Email: ${userEmail}`);
  console.log(`   New password: ${newPassword}`);
  console.log('\n🎉 You can now login with the new password.');
}

main();
