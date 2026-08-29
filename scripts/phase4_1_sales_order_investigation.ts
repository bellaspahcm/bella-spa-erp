#!/usr/bin/env tsx
/**
 * Phase 4.1: SALES_ORDER Schema & Provenance Investigation
 * READ-ONLY analysis to classify document_date provenance
 * 
 * Investigation: 208 SALES_ORDER transactions (31% of F1 POSTED)
 * Goal: Classify as PROVABLE, INFERABLE, or UNKNOWABLE
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  console.error('   Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  console.log('═'.repeat(80));
  console.log('🎯 Phase 4.1: SALES_ORDER Schema & Provenance Investigation');
  console.log('📊 Target: 208 SALES_ORDER transactions (31% of F1 POSTED)');
  console.log('🔒 Mode: READ-ONLY (no mutations)');
  console.log('═'.repeat(80));

  // Step 1: Check if we have SALES_ORDER transactions
  console.log('\n🔍 Step 1: Verify SALES_ORDER Transaction Count');
  console.log('─'.repeat(80));
  
  const { count: f1Count, error: f1Error } = await supabase
    .from('finance_transactions')
    .select('*', { count: 'exact', head: true })
    .eq('source_type', 'SALES_ORDER')
    .eq('lifecycle_state', 'POSTED');

  if (f1Error) {
    console.error(`❌ Error: ${f1Error.message}`);
    console.error(`   Details: ${JSON.stringify(f1Error, null, 2)}`);
    return;
  }

  console.log(`✅ Found ${f1Count || 0} SALES_ORDER transactions in F1`);

  if (!f1Count || f1Count === 0) {
    console.log('\n⚠️  WARNING: No SALES_ORDER transactions found');
    console.log('   Investigation cannot proceed');
    return;
  }

  // Step 2: Sample SALES_ORDER transactions to get source_id examples
  console.log('\n🔍 Step 2: Sample SALES_ORDER Transactions');
  console.log('─'.repeat(80));
  
  const { data: f1Samples, error: f1SampleError } = await supabase
    .from('finance_transactions')
    .select('id, source_id, source_type, posted_at, created_at, tenant_id')
    .eq('source_type', 'SALES_ORDER')
    .eq('lifecycle_state', 'POSTED')
    .order('created_at', { ascending: true })
    .limit(5);

  if (f1SampleError) {
    console.error(`❌ Error: ${f1SampleError.message}`);
  } else if (f1Samples && f1Samples.length > 0) {
    console.table(f1Samples);
    console.log(`\n📝 Sample source_ids: ${f1Samples.map(f => f.source_id).join(', ')}`);
  }

  // Step 3: Try to check if source table exists by querying it
  console.log('\n🔍 Step 3: Attempt to Query Source Table');
  console.log('─'.repeat(80));
  
  // Try different possible table names
  const possibleTables = [
    'sales_orders',
    'orders', 
    'spa_orders',
    'bookings',
    'spa_bookings',
    'service_orders'
  ];

  let foundTable: string | null = null;
  let foundData: any[] | null = null;

  for (const tableName of possibleTables) {
    console.log(`   Trying table: ${tableName}...`);
    
    try {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .limit(1);

      if (!error) {
        console.log(`   ✅ Table "${tableName}" exists!`);
        foundTable = tableName;
        foundData = data;
        break;
      } else {
        console.log(`   ❌ Table "${tableName}" not found or no access`);
      }
    } catch (err) {
      console.log(`   ❌ Table "${tableName}" not found`);
    }
  }

  if (!foundTable) {
    console.log('\n❌ CRITICAL FINDING: No source table found for SALES_ORDER');
    console.log('');
    console.log('Classification: UNKNOWABLE (no source table)');
    console.log('');
    console.log('Impact:');
    console.log('  - 208 SALES_ORDER records (31% of F1 POSTED)');
    console.log('  - Total UNKNOWABLE increases from 234 (35%) to 442 (65%)');
    console.log('');
    console.log('Recommendation:');
    console.log('  - document_date = NULL for SALES_ORDER');
    console.log('  - backfill_classification = "UNKNOWABLE"');
    console.log('  - backfill_reason = "SALES_ORDER: No source table exists"');
    console.log('');
    console.log('Next Steps:');
    console.log('  1. Document finding in PHASE4_SALES_ORDER_INVESTIGATION.md');
    console.log('  2. Update PHASE3_BACKFILL_POLICY.md impact estimate');
    console.log('  3. Proceed to Phase 4.2: AP_PAYMENT investigation');
    console.log('  4. Do NOT create M-F1-DATES migration proposal until all investigations complete');
    console.log('');
    return;
  }

  // Step 4: Inspect schema of found table
  console.log(`\n🔍 Step 4: Schema Inspection for "${foundTable}"`);
  console.log('─'.repeat(80));
  
  const { data: schemaData, error: schemaError } = await supabase.rpc('exec_sql', {
    sql_query: `
      SELECT 
          column_name,
          data_type,
          is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = '${foundTable}'
      ORDER BY ordinal_position;
    `
  });

  if (schemaError) {
    console.log(`⚠️  Cannot inspect schema: ${schemaError.message}`);
    console.log(`   Trying sample data instead...`);
    
    if (foundData && foundData.length > 0) {
      console.log('\n📋 Sample Record Structure:');
      console.log(JSON.stringify(foundData[0], null, 2));
      
      console.log('\n📅 Date Fields Found:');
      const dateFields = Object.keys(foundData[0]).filter(key => {
        const value = foundData[0][key];
        return typeof value === 'string' && (
          value.match(/^\d{4}-\d{2}-\d{2}/) || 
          key.toLowerCase().includes('date') ||
          key.toLowerCase().includes('time') ||
          key.toLowerCase().includes('at')
        );
      });
      
      dateFields.forEach(field => {
        console.log(`   - ${field}: ${foundData[0][field]}`);
      });
    }
  } else {
    console.table(schemaData);
  }

  // Step 5: Analyze linkage and date field availability
  console.log(`\n🔍 Step 5: F1 → ${foundTable} Linkage Analysis`);
  console.log('─'.repeat(80));
  
  if (f1Samples && f1Samples.length > 0 && foundTable) {
    const sourceIds = f1Samples.map(f => f.source_id);
    
    const { data: linkedRecords, error: linkError } = await supabase
      .from(foundTable)
      .select('*')
      .in('id', sourceIds);

    if (linkError) {
      console.error(`❌ Linkage check error: ${linkError.message}`);
    } else {
      console.log(`✅ Linked records found: ${linkedRecords?.length || 0} / ${sourceIds.length}`);
      
      if (linkedRecords && linkedRecords.length > 0) {
        console.log('\n📋 Sample Linked Record:');
        console.log(JSON.stringify(linkedRecords[0], null, 2));
        
        // Identify date fields
        console.log('\n📅 Date Fields Available:');
        const dateFields = Object.keys(linkedRecords[0]).filter(key => {
          const value = linkedRecords[0][key];
          return typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}/);
        });
        
        if (dateFields.length === 0) {
          console.log('   ❌ No date fields found (only system metadata?)');
          console.log('   Classification: UNKNOWABLE');
        } else {
          dateFields.forEach(field => {
            const isSystemMetadata = ['created_at', 'updated_at', 'deleted_at'].includes(field);
            const marker = isSystemMetadata ? '⚠️ ' : '✅';
            console.log(`   ${marker} ${field}: ${linkedRecords[0][field]}`);
          });
        }
      }
    }
  }

  // Final Classification
  console.log('\n🎯 Step 6: Provenance Classification');
  console.log('═'.repeat(80));
  console.log('');
  console.log('Based on investigation:');
  console.log('');
  console.log('📝 Manual Review Required:');
  console.log('   1. Review date fields identified above');
  console.log('   2. Determine which date = TT99 "Ngày chứng từ" (document date)');
  console.log('   3. Check if semantic is explicit or requires inference');
  console.log('   4. Verify completeness (NULL percentage)');
  console.log('');
  console.log('Classification Criteria:');
  console.log('');
  console.log('✅ PROVABLE:');
  console.log('   - Has explicit business date field (e.g., order_date)');
  console.log('   - Clear document date semantic');
  console.log('   - Completeness > 95%');
  console.log('');
  console.log('🟡 INFERABLE:');
  console.log('   - Has business date field');
  console.log('   - Requires policy assumption');
  console.log('   - Completeness > 80%');
  console.log('');
  console.log('❌ UNKNOWABLE:');
  console.log('   - Only system metadata dates (created_at/updated_at)');
  console.log('   - Low completeness (< 50%)');
  console.log('   - Ambiguous semantic');
  console.log('');

  console.log('\n✅ Phase 4.1 Investigation Complete');
  console.log('═'.repeat(80));
  console.log('');
  console.log('📋 Next Steps:');
  console.log('   1. Document findings in PHASE4_SALES_ORDER_INVESTIGATION.md');
  console.log('   2. Classify as PROVABLE/INFERABLE/UNKNOWABLE');
  console.log('   3. Update PHASE3_BACKFILL_POLICY.md if needed');
  console.log('   4. Proceed to Phase 4.2: AP_PAYMENT investigation');
  console.log('');
  console.log('🔒 Reminder: NO migrations executed (READ-ONLY investigation)');
  console.log('');
}

main().catch(console.error);
