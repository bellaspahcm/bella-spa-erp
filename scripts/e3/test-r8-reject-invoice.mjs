/**
 * E3 VERIFICATION - R8: Reject Invoice
 * 
 * Acceptance Criteria:
 * - Status transition: pending_approval → rejected
 * - Rejection reason required
 * - Event published: InvoiceRejected (deferred)
 */

import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY not set');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const TEST_TENANT_ID = 'da9e610b-88c5-4901-8ab9-5439f4931467';
const TEST_CARRIER_ID = uuidv4();
const TEST_USER_ID = uuidv4();
const TEST_REVIEWER_ID = uuidv4();

function logTest(name) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`TEST: ${name}`);
  console.log('='.repeat(80));
}

function logResult(passed, message) {
  console.log(`${passed ? '✅' : '❌'} ${message}`);
}

async function createTestInvoice(data) {
  const { data: result, error } = await supabase.from('log_freight_invoices').insert(data).select().single();
  if (error) throw new Error(`Failed to create invoice: ${error.message}`);
  return result;
}

async function rejectInvoice(invoiceId, rejectedBy, reason) {
  const { data: invoice, error: fetchError } = await supabase
    .from('log_freight_invoices')
    .select('*')
    .eq('invoice_id', invoiceId)
    .single();
  
  if (fetchError) throw new Error(`Failed to fetch invoice: ${fetchError.message}`);
  if (!invoice) throw new Error('Invoice not found');
  
  if (invoice.status !== 'pending_approval') {
    throw new Error(`Cannot reject invoice with status: ${invoice.status}`);
  }
  
  if (!reason) {
    throw new Error('Rejection reason is required');
  }
  
  const now = new Date().toISOString();
  
  const { data: updated, error: updateError } = await supabase
    .from('log_freight_invoices')
    .update({
      status: 'rejected',
      rejected_by: rejectedBy,
      rejected_at: now,
      rejection_reason: reason,
      updated_by: rejectedBy,
      updated_at: now
    })
    .eq('invoice_id', invoiceId)
    .select()
    .single();
  
  if (updateError) throw new Error(`Failed to reject invoice: ${updateError.message}`);
  
  return updated;
}

async function testRejectPendingInvoice() {
  logTest('R8.1 - Reject Pending Invoice with Reason');

  try {
    const invoice = await createTestInvoice({
      invoice_id: uuidv4(),
      tenant_id: TEST_TENANT_ID,
      carrier_id: TEST_CARRIER_ID,
      invoice_number: `REJECT-${Date.now()}`,
      invoice_date: new Date().toISOString(),
      due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'pending_approval',
      currency: 'USD',
      subtotal_amount: 100.00,
      tax_amount: 0,
      total_amount: 100.00,
      created_by: TEST_USER_ID
    });

    logResult(true, `Invoice created: ${invoice.status}`);

    const rejected = await rejectInvoice(invoice.invoice_id, TEST_REVIEWER_ID, 'Excessive variance detected');

    const checks = [
      { condition: rejected.status === 'rejected', message: 'Status: rejected' },
      { condition: rejected.rejected_by === TEST_REVIEWER_ID, message: 'Rejected_by recorded' },
      { condition: rejected.rejected_at !== null, message: 'Rejected_at timestamp' },
      { condition: rejected.rejection_reason === 'Excessive variance detected', message: 'Rejection reason recorded' },
      { condition: rejected.updated_by === TEST_REVIEWER_ID, message: 'Updated_by recorded' }
    ];

    let allPassed = true;
    for (const check of checks) {
      logResult(check.condition, check.message);
      if (!check.condition) allPassed = false;
    }

    return allPassed;
  } catch (err) {
    logResult(false, `Test failed: ${err.message}`);
    return false;
  }
}

async function testRejectRequiresReason() {
  logTest('R8.2 - Rejection Requires Reason');

  try {
    const invoice = await createTestInvoice({
      invoice_id: uuidv4(),
      tenant_id: TEST_TENANT_ID,
      carrier_id: TEST_CARRIER_ID,
      invoice_number: `NO-REASON-${Date.now()}`,
      invoice_date: new Date().toISOString(),
      due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'pending_approval',
      currency: 'USD',
      subtotal_amount: 100.00,
      tax_amount: 0,
      total_amount: 100.00,
      created_by: TEST_USER_ID
    });

    try {
      await rejectInvoice(invoice.invoice_id, TEST_REVIEWER_ID, null); // No reason
      logResult(false, 'Should require rejection reason');
      return false;
    } catch (err) {
      if (err.message.includes('Rejection reason is required')) {
        logResult(true, 'Correctly required rejection reason');
        return true;
      } else {
        logResult(false, `Unexpected error: ${err.message}`);
        return false;
      }
    }
  } catch (err) {
    logResult(false, `Test failed: ${err.message}`);
    return false;
  }
}

async function testCannotRejectApproved() {
  logTest('R8.3 - Cannot Reject Already Approved Invoice');

  try {
    const invoice = await createTestInvoice({
      invoice_id: uuidv4(),
      tenant_id: TEST_TENANT_ID,
      carrier_id: TEST_CARRIER_ID,
      invoice_number: `APPROVED-${Date.now()}`,
      invoice_date: new Date().toISOString(),
      due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'approved',
      currency: 'USD',
      subtotal_amount: 100.00,
      tax_amount: 0,
      total_amount: 100.00,
      created_by: TEST_USER_ID
    });

    try {
      await rejectInvoice(invoice.invoice_id, TEST_REVIEWER_ID, 'Test reason');
      logResult(false, 'Should not allow rejecting approved invoice');
      return false;
    } catch (err) {
      if (err.message.includes('Cannot reject invoice with status: approved')) {
        logResult(true, 'Correctly rejected approved invoice');
        return true;
      } else {
        logResult(false, `Unexpected error: ${err.message}`);
        return false;
      }
    }
  } catch (err) {
    logResult(false, `Test failed: ${err.message}`);
    return false;
  }
}

async function runR8Verification() {
  console.log('\n' + '━'.repeat(80));
  console.log('E3 VERIFICATION SESSION');
  console.log('R8: Reject Invoice');
  console.log('━'.repeat(80));

  const startTime = Date.now();

  const tests = [
    { name: 'R8.1 - Reject with Reason', fn: testRejectPendingInvoice },
    { name: 'R8.2 - Require Reason', fn: testRejectRequiresReason },
    { name: 'R8.3 - Reject Approved', fn: testCannotRejectApproved }
  ];

  const results = [];
  for (const test of tests) {
    const result = await test.fn();
    results.push({ name: test.name, passed: result });
  }

  const endTime = Date.now();
  const durationMinutes = ((endTime - startTime) / 1000 / 60).toFixed(4);
  const durationDays = (parseFloat(durationMinutes) / 60 / 8).toFixed(4);

  console.log('\n' + '━'.repeat(80));
  console.log('R8 VERIFICATION SUMMARY');
  console.log('━'.repeat(80));

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  results.forEach(r => logResult(r.passed, r.name));

  console.log(`\nTotal Tests: ${results.length}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Testing Effort: ${durationMinutes} minutes (${durationDays} engineering-days)`);

  console.log('\n' + (failed > 0 ? '❌ R8 VERIFICATION FAILED' : '✅ R8 VERIFICATION PASSED'));
  console.log('━'.repeat(80));

  process.exit(failed > 0 ? 1 : 0);
}

runR8Verification().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
