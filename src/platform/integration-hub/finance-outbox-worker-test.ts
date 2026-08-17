/**
 * N1 Test Mode — Finance Outbox Worker (Event-Filtered)
 * 
 * TEST-ONLY worker that processes specific event by event_id pattern
 * 
 * Usage:
 * ```bash
 * npx tsx src/platform/integration-hub/finance-outbox-worker-test.ts evt-n1-failure-isolation-123456
 * ```
 * 
 * Purpose: Isolate N1 test event from 366 backlog events
 */

import { FinanceOutboxWorker } from './finance-outbox-worker';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../types/database.types';
import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.local' });

// Validate environment
const FINANCE_OS_URL = 'http://localhost:3000/api/finance/v1/events';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL is required');
  process.exit(1);
}

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY is required');
  process.exit(1);
}

// Get event_id from command line
const eventId = process.argv[2];
if (!eventId) {
  console.error('❌ Usage: npx tsx finance-outbox-worker-test.ts <event_id>');
  console.error('   Example: npx tsx finance-outbox-worker-test.ts c55a5fd4-d72b-4058-a8e5-b10b4233dae1');
  process.exit(1);
}

console.log('🧪 N1 Test Mode Worker');
console.log(`   Event ID: ${eventId}`);
console.log(`   Finance OS: ${FINANCE_OS_URL}`);
console.log('');

// Create Supabase client
const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_KEY);

/**
 * Claim single event by exact event_id
 */
async function claimTestEvent(eventId: string): Promise<any | null> {
  console.log(`📌 Claiming event by event_id: ${eventId}`);
  
  // First, check if event exists and is PENDING
  const { data: checkEvent, error: checkError } = await supabase
    .from('finance_outbox_events')
    .select('*')
    .eq('event_id', eventId)
    .eq('status', 'PENDING')
    .single();
  
  if (checkError || !checkEvent) {
    console.log(`   Event not found or not PENDING`);
    return null;
  }
  
  // Manually claim this specific event
  const { data: claimed, error: claimError } = await supabase
    .from('finance_outbox_events')
    .update({
      status: 'PROCESSING',
      claimed_by: 'n1-test-worker',
      claimed_at: new Date().toISOString(),
      lease_expires_at: new Date(Date.now() + 60000).toISOString(),
    })
    .eq('id', checkEvent.id)
    .eq('status', 'PENDING')
    .select()
    .single();
  
  if (claimError || !claimed) {
    console.log(`   Failed to claim event:`, claimError?.message);
    return null;
  }
  
  console.log(`   ✅ Claimed event: ${claimed.event_id}`);
  
  return claimed;
}

/**
 * POST event to Finance OS
 */
async function postToFinanceOS(event: any): Promise<any> {
  console.log('📤 POSTing to Finance OS...');
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);
  
  try {
    // Check if failure injection enabled (for N1 test)
    const failureInjection = process.env.FINANCE_FAILURE_INJECTION === 'true';
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Tenant-ID': event.tenant_id,
      'X-Correlation-ID': event.payload.correlation_id || event.id,
    };
    
    // Add test failure injection header if enabled
    if (failureInjection) {
      headers['X-Test-Failure-Injection'] = 'true';
      console.log('   ⚠️  Failure injection enabled');
    }
    
    const response = await fetch(FINANCE_OS_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(event.payload),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(
        `Finance OS returned ${response.status}: ${errorBody.error || response.statusText}`
      );
    }
    
    const result = await response.json();
    console.log('   ✅ Finance OS response:', result.status);
    
    return result;
    
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * Mark event as processed
 */
async function markProcessed(eventId: string): Promise<void> {
  console.log('✅ Marking event as PROCESSED...');
  
  const { error } = await supabase.rpc('mark_finance_outbox_processed', {
    p_outbox_id: eventId,
  });
  
  if (error) {
    console.error('❌ Failed to mark processed:', error.message);
    throw error;
  }
  
  console.log('   ✅ Outbox status updated to PROCESSED');
}

/**
 * Mark event as failed
 */
async function markFailed(eventId: string, errorMsg: string): Promise<void> {
  console.log('❌ Marking event as FAILED...');
  
  const { error } = await supabase.rpc('mark_finance_outbox_failed', {
    p_outbox_id: eventId,
    p_error: errorMsg,
  });
  
  if (error) {
    console.error('❌ Failed to mark failed:', error.message);
    throw error;
  }
  
  console.log('   ✅ Outbox status updated (retry scheduled)');
}

/**
 * Main execution
 */
async function main() {
  const startTime = Date.now();
  
  try {
    // 1. Claim test event
    const event = await claimTestEvent(eventId);
    
    if (!event) {
      console.log('');
      console.log('❌ Test event not found or not PENDING');
      console.log('   Check that event exists and status = PENDING');
      process.exit(1);
    }
    
    console.log('');
    
    // 2. POST to Finance OS
    try {
      const result = await postToFinanceOS(event);
      
      // 3. Mark as processed
      await markProcessed(event.id);
      
      const duration = Date.now() - startTime;
      
      console.log('');
      console.log('═══════════════════════════════════════');
      console.log('✅ N1 Test Event Processed Successfully');
      console.log('═══════════════════════════════════════');
      console.log(`Event ID: ${event.event_id}`);
      console.log(`Outbox ID: ${event.id}`);
      console.log(`Finance Status: ${result.status}`);
      console.log(`Transaction ID: ${result.transaction_id || 'N/A'}`);
      console.log(`Duration: ${duration}ms`);
      console.log('═══════════════════════════════════════');
      
    } catch (error) {
      // Finance OS error
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      await markFailed(event.id, errorMsg);
      
      console.log('');
      console.log('═══════════════════════════════════════');
      console.log('❌ Finance OS Error');
      console.log('═══════════════════════════════════════');
      console.log(`Error: ${errorMsg}`);
      console.log(`Event will retry with exponential backoff`);
      console.log('═══════════════════════════════════════');
      
      process.exit(1);
    }
    
  } catch (error) {
    console.error('');
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

main();
