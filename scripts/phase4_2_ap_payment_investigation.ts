#!/usr/bin/env tsx
/**
 * Phase 4.2: AP_PAYMENT Schema & Provenance Investigation
 * READ-ONLY analysis to classify document_date provenance
 * 
 * Investigation: 74 AP_PAYMENT transactions (11% of F1 POSTED)
 * Goal: Classify as PROVABLE, INFERABLE, or UNKNOWABLE
 * 
 * FROZEN BOUNDARY:
 * ✅ READ-ONLY
 * ❌ NO migrations, NO mutations, NO SPA business data changes
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  console.log('═'.repeat(80));
  console.log('🔍 Phase 4.2: AP_PAYMENT Schema & Provenance Investigation');
  console.log('📊 Target: 74 AP_PAYMENT transactions (11% of F1 POSTED)');
  console.log('🔒 Mode: READ-ONLY (no mutations)');
  console.log('═'.repeat(80));

  // Step 1: Check if we have AP_PAYMENT transactions
  console.log('\n📋 Step 1: Verify AP_PAYMENT Transaction Count');
  console.log('─'.repeat(80));
  
  const { count: f1Count, error: f1Error } = await supabase
    .from('finance_transactions')
    .select('*', { count: 'exact', head: true })
    .eq('source_type', 'AP_PAYMENT')
    .eq('status', 'POSTED');

  if (f1Error) {
    console.error(`❌ Error: ${f1Error.message}`);
    return;
  }

  console.log(`✅ Found ${f1Count || 0} AP_PAYMENT transactions in F1`);

  if (!f1Count || f1Count === 0) {
    console.log('\n⚠️  WARNING: No AP_PAYMENT transactions found');
    console.log('   Investigation cannot proceed');
    return;
  }

  // Step 2: Sample AP_PAYMENT transactions
  console.log('\n📋 Step 2: Sample AP_PAYMENT Transactions');
  console.log('─'.repeat(80));
  
  const { data: f1Samples, error: f1SampleError } = await supabase
    .from('finance_transactions')
    .select('id, source_id, tenant_id, posted_at, created_at')
    .eq('source_type', 'AP_PAYMENT')
    .eq('status', 'POSTED')
    .order('created_at', { ascending: true })
    .limit(10);

  if (f1SampleError) {
    console.error(`❌ Error: ${f1SampleError.message}`);
  } else if (f1Samples && f1Samples.length > 0) {
    console.log(`✅ Sample ${f1Samples.length} AP_PAYMENT F1 records`);
    console.log('\n📝 Sample source_ids:');
    f1Samples.slice(0, 5).forEach(r => {
      console.log(`   ${r.source_id} (tenant: ${r.tenant_id})`);
    });

    // Analyze source_id format
    const firstSourceId = f1Samples[0].source_id;
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(firstSourceId);
    const isCustomString = !isUUID;

    console.log(`\n🔍 source_id Format Analysis:`);
    console.log(`   First source_id: ${firstSourceId}`);
    console.log(`   Format: ${isUUID ? '✅ UUID' : '⚠️  Custom string'}`);
    
    if (isCustomString) {
      console.log(`\n⚠️  WARNING: Custom string format detected (like SALES_ORDER)`);
      console.log(`   This may indicate test/demo data`);
      console.log(`   Type compatibility with UUID tables may fail`);
    }
  }

  // Step 3: Try to find payments table
  console.log('\n📋 Step 3: Search for Payments Source Table');
  console.log('─'.repeat(80));
  
  const paymentTableCandidates = [
    'finance_payments',
    'ap_payments',
    'payments',
    'accounts_payable_payments',
    'vendor_payments'
  ];

  let foundTable: string | null = null;
  let foundData: any[] | null = null;

  for (const tableName of paymentTableCandidates) {
    try {
      console.log(`   Trying: ${tableName}...`);
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
        console.log(`   ❌ ${tableName}: ${error.message}`);
      }
    } catch (err) {
      console.log(`   ❌ ${tableName}: not found`);
    }
  }

  if (!foundTable) {
    console.log('\n❌ CRITICAL FINDING: No payments source table found');
    console.log('');
    console.log('Classification: UNKNOWABLE (no source table)');
    console.log('');
    console.log('Impact:');
    console.log('  - 74 AP_PAYMENT records (11% of F1 POSTED)');
    console.log('  - Total UNKNOWABLE increases from 442 (65%) to 516 (76%)');
    console.log('');
    console.log('Recommendation:');
    console.log('  - document_date = NULL for AP_PAYMENT');
    console.log('  - backfill_classification = "UNKNOWABLE"');
    console.log('  - backfill_reason = "AP_PAYMENT: No source table exists"');
    return;
  }

  console.log(`\n✅ Using table: ${foundTable}`);

  // Step 4: Inspect schema
  console.log(`\n📋 Step 4: Schema Inspection for "${foundTable}"`);
  console.log('─'.repeat(80));
  
  if (foundData && foundData.length > 0) {
    const sampleRecord = foundData[0];
    const allFields = Object.keys(sampleRecord);
    
    console.log(`\n📝 Sample ${foundTable} Schema:`);
    console.log(`   Total fields: ${allFields.length}`);
    
    // Identify date fields
    const dateFields = allFields.filter(key => {
      const value = sampleRecord[key];
      return value && typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}/);
    });

    console.log(`\n📅 Date Fields Found (${dateFields.length}):`);
    
    if (dateFields.length === 0) {
      console.log('   ❌ No date fields found');
    } else {
      const systemMetadataFields = ['created_at', 'updated_at', 'deleted_at'];
      const businessDateFields = dateFields.filter(f => !systemMetadataFields.includes(f));

      dateFields.forEach(field => {
        const isSystemMetadata = systemMetadataFields.includes(field);
        const marker = isSystemMetadata ? '⚠️  SYSTEM' : '✅ BUSINESS';
        console.log(`   ${marker}: ${field} = ${sampleRecord[field]}`);
      });

      console.log(`\n📊 Date Field Classification:`);
      console.log(`   Business date fields: ${businessDateFields.length}`);
      console.log(`   System metadata fields: ${dateFields.filter(f => systemMetadataFields.includes(f)).length}`);
    }

    // Check if id field is UUID
    const idField = sampleRecord['id'];
    const idIsUUID = idField && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idField);
    
    console.log(`\n🔍 Primary Key Format:`);
    console.log(`   id: ${idField}`);
    console.log(`   Format: ${idIsUUID ? '✅ UUID' : '⚠️  Custom string'}`);
  }

  // Step 5: Attempt linkage verification
  console.log(`\n📋 Step 5: F1 → ${foundTable} Linkage Verification`);
  console.log('─'.repeat(80));
  
  if (f1Samples && f1Samples.length > 0 && foundTable) {
    const sourceIds = f1Samples.map(f => f.source_id);
    
    try {
      const { data: linkedRecords, error: linkError } = await supabase
        .from(foundTable)
        .select('*')
        .in('id', sourceIds);

      if (linkError) {
        console.error(`❌ Linkage check error: ${linkError.message}`);
        
        // Check if it's a type mismatch error
        if (linkError.message.includes('invalid input syntax for type uuid')) {
          console.log('\n⚠️  TYPE MISMATCH DETECTED');
          console.log(`   ${foundTable}.id is UUID type`);
          console.log(`   AP_PAYMENT source_id is custom string`);
          console.log('   → Similar to SALES_ORDER (test/demo data pattern)');
          console.log('');
          console.log('Classification: UNKNOWABLE (type incompatibility)');
          console.log('');
          console.log('Recommendation:');
          console.log('  - Possible test/demo data like SALES_ORDER');
          console.log('  - Investigate source_id generation code');
          console.log('  - Consider cleanup evaluation (Phase 4.x)');
        }
      } else {
        console.log(`✅ Linked records found: ${linkedRecords?.length || 0} / ${sourceIds.length}`);
        
        const matchRate = linkedRecords ? (linkedRecords.length / sourceIds.length) * 100 : 0;
        console.log(`   Match rate: ${matchRate.toFixed(1)}%`);
        
        if (linkedRecords && linkedRecords.length > 0) {
          console.log('\n📋 Sample Linked Record:');
          console.log(JSON.stringify(linkedRecords[0], null, 2));
          
          // Identify date fields in linked records
          const linkedDateFields = Object.keys(linkedRecords[0]).filter(key => {
            const value = linkedRecords[0][key];
            return value && typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}/);
          });
          
          if (linkedDateFields.length === 0) {
            console.log('\n❌ No date fields found in linked records');
            console.log('   Classification: UNKNOWABLE (no date provenance)');
          } else {
            console.log('\n📅 Date Fields Available:');
            const systemMetadata = ['created_at', 'updated_at', 'deleted_at'];
            linkedDateFields.forEach(field => {
              const isSystemMetadata = systemMetadata.includes(field);
              const marker = isSystemMetadata ? '⚠️ ' : '✅';
              console.log(`   ${marker} ${field}: ${linkedRecords[0][field]}`);
            });
          }

          // Check if this links to SPA production data
          console.log('\n🔍 Production Data Check:');
          const hasTenantId = 'tenant_id' in linkedRecords[0];
          const tenantId = linkedRecords[0].tenant_id;
          console.log(`   Has tenant_id: ${hasTenantId ? '✅' : '❌'}`);
          if (hasTenantId) {
            console.log(`   tenant_id: ${tenantId}`);
            
            // Check if it's the same test tenant as SALES_ORDER
            const isSalesOrderTestTenant = tenantId === '5eb84dd2-fd42-4fe7-af44-a60fc9c8fb83';
            if (isSalesOrderTestTenant) {
              console.log(`   ⚠️  Same test tenant as SALES_ORDER`);
            }
          }

          // Check for SPA-related fields
          const spaRelatedFields = ['booking_id', 'service_id', 'customer_id', 'staff_id'];
          const hasSpaFields = spaRelatedFields.some(f => f in linkedRecords[0]);
          if (hasSpaFields) {
            console.log('\n⚠️  SPA-RELATED FIELDS DETECTED');
            console.log('   This may link to SPA production data');
            console.log('   Fields found:', spaRelatedFields.filter(f => f in linkedRecords[0]));
            console.log('');
            console.log('🛑 REPORT ONLY — NO AUTOMATIC PROCESSING');
            console.log('   Human Architect review required before classification');
          }
        } else {
          console.log('\n❌ No linked records found (0% match rate)');
          console.log('   All source_ids are orphans');
          console.log('   Classification: UNKNOWABLE (no source linkage)');
        }
      }
    } catch (err) {
      console.error(`❌ Exception during linkage check: ${err}`);
    }
  }

  // Step 6: Provenance Classification
  console.log('\n📋 Step 6: Provenance Classification');
  console.log('═'.repeat(80));
  console.log('');
  console.log('Based on investigation:');
  console.log('');
  console.log('📝 Classification Criteria:');
  console.log('');
  console.log('✅ PROVABLE:');
  console.log('   - Table exists with UUID linkage');
  console.log('   - Has explicit business date field');
  console.log('   - Clear document date semantic');
  console.log('   - Completeness > 95%');
  console.log('   - 100% linkage match rate');
  console.log('');
  console.log('🟡 INFERABLE:');
  console.log('   - Table exists with partial linkage');
  console.log('   - Has business date field');
  console.log('   - Requires policy assumption');
  console.log('   - Completeness > 80%');
  console.log('');
  console.log('❌ UNKNOWABLE:');
  console.log('   - No table exists, OR');
  console.log('   - Type incompatibility (custom string like SALES_ORDER), OR');
  console.log('   - Only system metadata dates, OR');
  console.log('   - Low match rate (< 50%), OR');
  console.log('   - Links to SPA production data (requires Human Architect review)');
  console.log('');

  console.log('\n✅ Phase 4.2 Investigation Complete');
  console.log('═'.repeat(80));
  console.log('');
  console.log('📋 Next Steps:');
  console.log('   1. Document findings in PHASE4_2_AP_PAYMENT_INVESTIGATION.md');
  console.log('   2. Classify as PROVABLE/INFERABLE/UNKNOWABLE');
  console.log('   3. If SPA linkage detected: Human Architect review required');
  console.log('   4. Update PHASE3_BACKFILL_POLICY.md if needed');
  console.log('   5. Proceed to Phase 4.3: SPA_BOOKING investigation');
  console.log('');
  console.log('🔒 Reminder: NO migrations executed (READ-ONLY investigation)');
  console.log('');
}

main().catch(console.error);
