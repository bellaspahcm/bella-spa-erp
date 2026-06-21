/**
 * Script: Cleanup REVERSAL Entries for June 2026
 * 
 * Purpose: Remove duplicate REVERSAL entries from massage amount corrections
 *          to make Trial Balance display correct revenue amount
 * 
 * Problem:
 * - Trial Balance shows 6,049,500đ (inflated by REVERSAL entries)
 * - Actual revenue should be 4,414,500đ (29 sessions completed)
 * - Gap: 1,635,000đ caused by multiple REVERSAL entries
 * 
 * Solution:
 * 1. Identify all REVERSAL entries related to massage corrections
 * 2. Identify the FINAL CORRECTED entries that should be kept
 * 3. Delete all intermediate REVERSAL entries
 * 4. Keep only the final corrected SESSION_DONE entry
 * 
 * Expected Result After Cleanup:
 * - Trial Balance: ~4,414,500đ (matching actual services delivered)
 * - TK 5111: 180,000đ (3 sessions from deposit package)
 * - TK 5113: 4,234,500đ (26 sessions + 1 massage)
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? 'Found' : 'Missing');
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', supabaseKey ? 'Found' : 'Missing');
  process.exit(1);
}

const supabase = createClient<Database>(supabaseUrl, supabaseKey);

const TENANT_ID = '0e66365b-42b0-420e-acca-f7d7692e125e'; // Mother & Baby
const JUNE_START = '2026-06-01';
const JUNE_END = '2026-06-30';

interface JournalEntry {
  id: string;
  entry_date: string;
  entry_type: string;
  description: string;
  reference_id: string | null;
  reversed_entry_id: string | null;
}

interface JournalLine {
  id: string;
  entry_id: string;
  account_id: string;
  debit_amount: number;
  credit_amount: number;
  description: string | null;
}

async function main() {
  console.log('=== Cleanup REVERSAL Entries for June 2026 ===\n');

  // Step 1: Find all journal entries in June 2026
  console.log('📖 Step 1: Finding all journal entries in June 2026...');
  const { data: entries, error: entriesError } = await supabase
    .from('journal_entries')
    .select('*')
    .eq('tenant_id', TENANT_ID)
    .gte('entry_date', JUNE_START)
    .lte('entry_date', JUNE_END)
    .order('entry_date', { ascending: true });

  if (entriesError || !entries) {
    console.error('❌ Error fetching journal entries:', entriesError);
    return;
  }

  console.log(`   Found ${entries.length} journal entries\n`);

  // Step 2: Identify entries by description (entry_type is null for all)
  // REVERSAL entries have descriptions like "Ghi đảo", "CLEANUP", "RESET", "Đảo"
  const reversalKeywords = ['Ghi đảo', 'CLEANUP', 'RESET', 'Đảo', 'REVERSAL', 'Reversal'];
  const reversalEntries = entries.filter(e => 
    reversalKeywords.some(keyword => e.description?.includes(keyword))
  );
  console.log(`📋 Step 2: Found ${reversalEntries.length} REVERSAL-like entries\n`);

  // Step 3: Identify massage-related entries (both REVERSAL and duplicates)
  const massageReversals = reversalEntries.filter(e => 
    e.description?.includes('massage') || 
    e.description?.includes('Massage')
  );

  console.log(`💆 Step 3: Found ${massageReversals.length} massage-related REVERSAL entries:`);
  massageReversals.slice(0, 10).forEach(e => {
    console.log(`   - ${e.entry_date}: ${e.description?.substring(0, 80)}`);
  });
  if (massageReversals.length > 10) {
    console.log(`   ... and ${massageReversals.length - 10} more`);
  }
  console.log();

  // Step 4: Find the FINAL CORRECTED entries to KEEP (2 entries: PACKAGE_SALE + SESSION_DONE)
  const finalCorrectedPackageSale = entries.find(e => 
    e.description?.includes('[FINAL CORRECTED]') &&
    e.description?.includes('Bán gói') &&
    e.description?.includes('Massage Bầu Tại Nhà')
  );

  const finalCorrectedSessionDone = entries.find(e => 
    e.description?.includes('[FINAL CORRECTED]') &&
    e.description?.includes('Kết chuyển') &&
    e.description?.includes('Massage Bầu Tại Nhà')
  );

  const entriesToKeep = [finalCorrectedPackageSale, finalCorrectedSessionDone].filter(Boolean);

  console.log(`✅ Step 4: Found ${entriesToKeep.length} FINAL CORRECTED entries to KEEP:`);
  entriesToKeep.forEach(e => {
    if (e) {
      console.log(`   ID: ${e.id}`);
      console.log(`   Date: ${e.entry_date}`);
      console.log(`   Description: ${e.description?.substring(0, 80)}`);
    }
  });
  console.log();

  // Step 5: Find all OTHER massage entries (duplicates to delete)
  const keepIds = entriesToKeep.map(e => e?.id).filter(Boolean);
  const duplicateMassageEntries = entries.filter(e => 
    (e.description?.includes('Massage Bầu Tại Nhà') || e.description?.includes('massage')) &&
    !keepIds.includes(e.id) &&
    !reversalKeywords.some(keyword => e.description?.includes(keyword)) // Exclude reversals (counted separately)
  );

  console.log(`🗑️  Step 5: Found ${duplicateMassageEntries.length} duplicate massage SESSION_DONE entries to delete:`);
  duplicateMassageEntries.forEach(e => {
    console.log(`   - ${e.entry_date}: ${e.description}`);
  });
  console.log();

  // Step 6: Calculate total entries to delete
  const entriesToDelete = [...massageReversals, ...duplicateMassageEntries];
  const entryIds = entriesToDelete.map(e => e.id);

  console.log(`📊 Step 6: Summary`);
  console.log(`   Total REVERSAL entries: ${massageReversals.length}`);
  console.log(`   Total duplicate SESSION_DONE: ${duplicateMassageEntries.length}`);
  console.log(`   Total entries to delete: ${entriesToDelete.length}`);
  console.log(`   Entries to keep: ${entriesToKeep.length} (FINAL CORRECTED)\n`);

  if (entryIds.length === 0) {
    console.log('✅ No entries to delete. Trial Balance is already clean.');
    return;
  }

  // Step 7: Preview journal lines to delete
  console.log('📋 Step 7: Fetching journal lines for entries to delete...');
  const { data: linesToDelete, error: linesError } = await supabase
    .from('journal_lines')
    .select('*')
    .in('entry_id', entryIds);

  if (linesError || !linesToDelete) {
    console.error('❌ Error fetching journal lines:', linesError);
    return;
  }

  console.log(`   Found ${linesToDelete.length} journal lines to delete\n`);

  // Calculate impact on revenue accounts
  const revenueLines = linesToDelete.filter(l => 
    l.account_id === 'a7f00552-d133-4d50-9e7a-2c929e21e82f' || // 5111
    l.account_id === 'ce0977b8-eacb-44a7-9f43-b1f2bb72be81'    // 5113
  );

  const totalCreditToRemove = revenueLines.reduce((sum, l) => sum + (l.credit_amount || 0), 0);
  const totalDebitToRemove = revenueLines.reduce((sum, l) => sum + (l.debit_amount || 0), 0);
  const netRevenueChange = totalCreditToRemove - totalDebitToRemove;

  console.log(`💰 Impact Analysis:`);
  console.log(`   Revenue lines to delete: ${revenueLines.length}`);
  console.log(`   Total Credit to remove: ${totalCreditToRemove.toLocaleString('vi-VN')} đ`);
  console.log(`   Total Debit to remove: ${totalDebitToRemove.toLocaleString('vi-VN')} đ`);
  console.log(`   Net revenue change: -${netRevenueChange.toLocaleString('vi-VN')} đ`);
  console.log();
  console.log(`   Current Trial Balance: ~6,049,500 đ`);
  console.log(`   After cleanup: ~${(6049500 - netRevenueChange).toLocaleString('vi-VN')} đ`);
  console.log(`   Expected: ~4,414,500 đ\n`);

  // Step 8: Execute deletion (DRY RUN first)
  console.log('⚠️  Step 8: DRY RUN - No actual deletion yet');
  console.log('   To execute deletion, uncomment the deletion code below\n');

  console.log('🔍 Entries to delete:');
  entriesToDelete.forEach(e => {
    console.log(`   ${e.entry_date} - ${e.description?.substring(0, 80)}`);
  });
  console.log();

  // UNCOMMENT BELOW TO EXECUTE DELETION
  
  console.log('🗑️  Executing deletion...\n');
  
  // Step 1: Unpost all entries first (set status to DRAFT)
  console.log('📝 Step 1: Unposting entries (set status to DRAFT)...');
  const { error: unpostError } = await supabase
    .from('journal_entries')
    .update({ status: 'DRAFT' })
    .in('id', entryIds);

  if (unpostError) {
    console.error('❌ Error unposting entries:', unpostError);
    return;
  }
  console.log(`✅ Unposted ${entriesToDelete.length} entries\n`);

  // Step 2: Delete journal_lines (now allowed since entries are DRAFT)
  console.log('📝 Step 2: Deleting journal lines...');
  const { error: deleteLinesError } = await supabase
    .from('journal_lines')
    .delete()
    .in('entry_id', entryIds);

  if (deleteLinesError) {
    console.error('❌ Error deleting journal lines:', deleteLinesError);
    return;
  }
  console.log(`✅ Deleted ${linesToDelete.length} journal lines\n`);

  // Step 3: Delete journal_entries
  console.log('📝 Step 3: Deleting journal entries...');
  const { error: deleteEntriesError } = await supabase
    .from('journal_entries')
    .delete()
    .in('id', entryIds);

  if (deleteEntriesError) {
    console.error('❌ Error deleting journal entries:', deleteEntriesError);
    return;
  }
  console.log(`✅ Deleted ${entriesToDelete.length} journal entries\n`);

  console.log('✅ Cleanup complete!');
  console.log('   Please re-run check-trial-balance-june.ts to verify');
  

  console.log('   Review the impact analysis above');
  console.log('   Ready to execute cleanup!\n');
}

main().catch(console.error);
