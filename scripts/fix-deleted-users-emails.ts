/**
 * One-time script to fix emails of soft-deleted users
 * Archives emails of users with resignation_date to free them for reuse
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function fixDeletedUsersEmails() {
  console.log('🔍 Finding soft-deleted users with non-archived emails...\n');
  
  // Find users with resignation_date but email not archived
  const { data: deletedUsers, error } = await supabase
    .from('users')
    .select('id, full_name, email, resignation_date')
    .not('resignation_date', 'is', null)
    .not('email', 'like', '%.deleted.%');
  
  if (error) {
    console.error('❌ Error querying users:', error);
    process.exit(1);
  }
  
  if (!deletedUsers || deletedUsers.length === 0) {
    console.log('✅ No users need fixing. All emails are properly archived.');
    return;
  }
  
  console.log(`Found ${deletedUsers.length} users to fix:\n`);
  
  for (const user of deletedUsers) {
    const timestamp = Date.now();
    const archivedEmail = user.email 
      ? `${timestamp}.deleted.${user.email}`
      : `${timestamp}.deleted@archived.local`;
    
    console.log(`📧 ${user.full_name || 'Unknown'}`);
    console.log(`   Old email: ${user.email}`);
    console.log(`   New email: ${archivedEmail}`);
    console.log(`   Resignation date: ${user.resignation_date}\n`);
    
    const { error: updateError } = await supabase
      .from('users')
      .update({ email: archivedEmail })
      .eq('id', user.id);
    
    if (updateError) {
      console.error(`   ❌ Failed to update: ${updateError.message}\n`);
    } else {
      console.log(`   ✅ Email archived successfully\n`);
    }
  }
  
  console.log('✅ All done! Original emails are now free for reuse.');
}

fixDeletedUsersEmails().catch(console.error);
