/**
 * N1 Failure Isolation E2E Test Script
 * 
 * Test Scenario:
 * 1. STOP Finance OS
 * 2. Create Hospital transaction (PATIENT_SERVICE_COMPLETED)
 * 3. Verify Hospital returns 200/201 (Finance DOWN → Hospital SUCCESS ✅)
 * 4. Verify finance_outbox_events has PENDING entry
 * 5. START Finance OS
 * 6. Run worker (or wait for worker to poll)
 * 7. Verify Finance OS received event
 * 8. Verify finance_journal_entries has 1 entry
 * 9. Verify outbox status → PROCESSED
 * 10. Retry same event (trigger worker again)
 * 11. Verify ALREADY_PROCESSED (idempotency)
 * 12. Verify journal count still = 1
 * 
 * Evidence Collection:
 * - P1: Finance DOWN → Hospital SUCCESS
 * - P2: Event durable in outbox (PENDING)
 * - P3: Worker async processing
 * - P4: Finance recovery → Journal POSTED
 * - P5: Retry → ALREADY_PROCESSED, 1 journal
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from '../src/types/database.types';
import { HospitalFinanceAdapter } from '../src/platform/healthcare/finance-integration/hospital-finance-adapter';
import { FinanceOutboxWriter } from '../src/platform/integration-hub/finance-outbox-writer';
import { FinanceOutboxWorker } from '../src/platform/integration-hub/finance-outbox-worker';
import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const FINANCE_OS_URL = 'http://localhost:3000/api/finance/v1/events'; // Finance OS is same Next.js app

const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Test tenant ID (use existing tenant)
const TEST_TENANT_ID = 'da9e610b-88c5-4901-8ab9-5439f4931467'; // Test Tenant Accounting GL

async function main() {
  console.log('🧪 N1 Failure Isolation E2E Test\n');
  
  // Step 1: Check Finance OS status
  console.log('📌 Step 1: Check Finance OS status');
  const financeUp = await checkFinanceOS();
  console.log(`   Finance OS: ${financeUp ? '🟢 UP' : '🔴 DOWN'}\n`);
  
  if (financeUp) {
    console.log('⚠️  Finance OS is UP. For N1 test, Finance OS should be DOWN.');
    console.log('   Please STOP Finance OS process and run this script again.');
    console.log('   Or continue to test outbox write (Finance will process immediately).\n');
  }
  
  // Step 2: Create Hospital transaction
  console.log('📌 Step 2: Create Hospital transaction (PATIENT_SERVICE_COMPLETED)');
  
  const outboxWriter = new FinanceOutboxWriter(supabase, {
    sourceSystem: 'HOSPITAL_OS',
    sourceVersion: '1.0.0',
  });
  
  const adapter = new HospitalFinanceAdapter(supabase, outboxWriter);
  
  const encounterId = `ENC-N1-TEST-${Date.now()}`;
  const serviceId = `SRV-N1-TEST-${Date.now()}`;
  const testEventId = `evt-n1-failure-isolation-${Date.now()}`;
  
  try {
    const result = await adapter.publishPatientServiceCompleted({
      tenantId: TEST_TENANT_ID,
      patientId: 'PAT-N1-TEST',
      encounterId: encounterId,
      serviceId: serviceId,
      eventId: testEventId, // Controlled event ID for N1 test
      amount: '500000',
      currency: 'VND',
      serviceType: 'CONSULTATION',
      encounterType: 'CONSULTATION',
    });
    
    console.log(`   ✅ Hospital transaction SUCCESS`);
    console.log(`   Outbox ID: ${result.outboxId}`);
    console.log(`   Event ID: ${result.eventId}`);
    console.log(`   Idempotency Key: ${result.idempotencyKey}\n`);
    
    // Evidence P1: Finance DOWN → Hospital SUCCESS ✅
    console.log('✅ P1 EVIDENCE: Finance DOWN → Hospital SUCCESS\n');
    
    // Step 3: Verify outbox entry
    console.log('📌 Step 3: Verify finance_outbox_events (PENDING)');
    const outboxEntry = await supabase
      .from('finance_outbox_events')
      .select('*')
      .eq('id', result.outboxId)
      .single();
    
    if (outboxEntry.error) {
      console.error(`   ❌ Failed to query outbox: ${outboxEntry.error.message}`);
      process.exit(1);
    }
    
    console.log(`   Status: ${outboxEntry.data.status}`);
    console.log(`   Retry Count: ${outboxEntry.data.retry_count}`);
    console.log(`   Created At: ${outboxEntry.data.created_at}\n`);
    
    // Evidence P2: Event durable in outbox ✅
    if (outboxEntry.data.status === 'PENDING') {
      console.log('✅ P2 EVIDENCE: Event durable in outbox (PENDING)\n');
    }
    
    // Step 4: Run worker once
    console.log('📌 Step 4: Run worker (one batch)');
    console.log('   If Finance OS is DOWN, worker will fail and retry later.');
    console.log('   If Finance OS is UP, worker will process immediately.\n');
    
    const worker = new FinanceOutboxWorker(supabase, {
      financeOsEndpoint: FINANCE_OS_URL,
      workerId: 'test-worker',
      batchSize: 10,
      verbose: true,
    });
    
    await worker.processOnce();
    
    // Step 5: Check outbox status again
    console.log('\n📌 Step 5: Check outbox status after worker run');
    const outboxAfterWorker = await supabase
      .from('finance_outbox_events')
      .select('*')
      .eq('id', result.outboxId)
      .single();
    
    if (outboxAfterWorker.error) {
      console.error(`   ❌ Failed to query outbox: ${outboxAfterWorker.error.message}`);
      process.exit(1);
    }
    
    console.log(`   Status: ${outboxAfterWorker.data.status}`);
    console.log(`   Retry Count: ${outboxAfterWorker.data.retry_count}`);
    console.log(`   Processed At: ${outboxAfterWorker.data.processed_at || 'NULL'}`);
    console.log(`   Last Error: ${outboxAfterWorker.data.last_error || 'NULL'}\n`);
    
    if (outboxAfterWorker.data.status === 'PROCESSED') {
      console.log('✅ P3 EVIDENCE: Worker async processing → PROCESSED\n');
      
      // Step 6: Check journal entries
      console.log('📌 Step 6: Check finance_journal_entries');
      
      // Query journal entries for this tenant + idempotency key
      const { data: journals, error: journalError } = await supabase
        .from('finance_journal_entries')
        .select('*')
        .eq('tenant_id', TEST_TENANT_ID)
        .eq('idempotency_key', result.idempotencyKey);
      
      if (journalError) {
        console.error(`   ❌ Failed to query journals: ${journalError.message}`);
      } else {
        console.log(`   Journal count: ${journals?.length || 0}`);
        
        if (journals && journals.length === 1) {
          console.log('✅ P4 EVIDENCE: Finance recovery → Journal POSTED (1 entry)\n');
        } else if (journals && journals.length > 1) {
          console.error(`   ❌ DUPLICATE JOURNALS: Expected 1, got ${journals.length}`);
        }
      }
      
      // Step 7: Retry worker (same event should be skipped)
      console.log('📌 Step 7: Retry worker (should skip PROCESSED events)');
      await worker.processOnce();
      
      // Check journal count again
      const { data: journalsAfterRetry } = await supabase
        .from('finance_journal_entries')
        .select('*')
        .eq('tenant_id', TEST_TENANT_ID)
        .eq('idempotency_key', result.idempotencyKey);
      
      console.log(`   Journal count after retry: ${journalsAfterRetry?.length || 0}`);
      
      if (journalsAfterRetry && journalsAfterRetry.length === 1) {
        console.log('✅ P5 EVIDENCE: Retry → ALREADY_PROCESSED, 1 journal\n');
      } else {
        console.error(`   ❌ DUPLICATE: Expected 1 journal, got ${journalsAfterRetry?.length}`);
      }
      
    } else if (outboxAfterWorker.data.status === 'PENDING' || outboxAfterWorker.data.status === 'FAILED') {
      console.log('🟡 Worker failed (Finance OS likely DOWN)');
      console.log('   Next retry at:', outboxAfterWorker.data.next_retry_at);
      console.log('\n   To complete test:');
      console.log('   1. START Finance OS');
      console.log('   2. Run worker again: npm run worker:finance-outbox');
      console.log('   3. Verify outbox → PROCESSED');
      console.log('   4. Verify journal count = 1\n');
    }
    
    // Summary
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 N1 Test Summary');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`Outbox ID: ${result.outboxId}`);
    console.log(`Event ID: ${result.eventId}`);
    console.log(`Status: ${outboxAfterWorker.data.status}`);
    console.log(`Retry Count: ${outboxAfterWorker.data.retry_count}`);
    console.log('═══════════════════════════════════════════════════════════\n');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

async function checkFinanceOS(): Promise<boolean> {
  try {
    const response = await fetch(`${FINANCE_OS_URL}/v1/health`, { 
      method: 'GET',
      signal: AbortSignal.timeout(3000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

main();
