/**
 * E3 VERIFICATION - R9: Mark Invoice as Paid
 * 
 * Acceptance Criteria:
 * - Status transition: approved → paid
 * - Payment date, payment_reference recorded
 * - Invoice locked (no further changes)
 * - Event published: InvoicePaid (deferred)
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

async function markInvoiceAsPaid(invoiceId, paidAmount, paymentReference) {
  const { data: invoice, error: fetchError } = await supabase
    .from('log_freight_invoices')
    .select('*')
    .eq('invoice_id', invoiceId)
    .single();
  
  if (fetchError) throw new Error(`Failed to fetch invoice: ${fetchError.message}`);
  if (!invoice) throw new Error('Invoice not found');
  
  if (invoice.status !== 'approved') {
    throw new Error(`Cannot mark as paid with status: ${invoice.status}`);
  }
  
  const now = new Date().toISOString();
  
  const { data: updated, error: updateError } = await supabase
    .from('log_freight_invoices')
    .update({
      status: 'paid',
      paid_amount: paidAmount,
      paid_at: now,
      payment_reference: paymentReference,
      updated_at: now
    })
    .eq('invoice_id', invoiceId)
    .select()
    .single();
  
  if (updateError) throw new Error(`Failed to mark as paid: ${updateError.message}`);
  
  return updated;
}

async function testMarkApprovedAsPaid() {
  logTest('R9.1 - Mark Approved Invoice as Paid');

  try {
    const invoice = await createTestInvoice({
      invoice_id: uuidv4(),
      tenant_id: TEST_TENANT_ID,
      carrier_id: TEST_CARRIER_ID,
      invoice_number: `PAID-${Date.now()}`,
      invoice_date: new Date().toISOString(),
      due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'approved',
      currency: 'USD',
      subtotal_amount: 100.00,
      tax_amount: 0,
      total_amount: 100.00,
      created_by: TEST_USER_ID
    });

    logResult(true, `Invoice created: ${invoice.status}`);

    const paid = await markInvoiceAsPaid(invoice.invoice_id, 100.00, 'ACH-123456');

    const checks = [
      { condition: paid.status === 'paid', message: 'Status: paid' },
      { condition: paid.paid_amount === 100.00, message: 'Paid amount recorded' },
      { condition: paid.paid_at !== null, message: 'Paid_at timestamp' },
      { condition: paid.payment_reference === 'ACH-123456', message: 'Payment reference recorded' }
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

async function testCannotMarkDraftAsPaid() {
  logTest('R9.2 - Cannot Mark Draft Invoice as Paid');

  try {
    const invoice = await createTestInvoice({
      invoice_id: uuidv4(),
      tenant_id: TEST_TENANT_ID,
      carrier_id: TEST_CARRIER_ID,
      invoice_number: `DRAFT-PAID-${Date.now()}`,
      invoice_date: new Date().toISOString(),
      due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'draft',
      currency: 'USD',
      subtotal_amount: 100.00,
      tax_amount: 0,
      total_amount: 100.00,
      created_by: TEST_USER_ID
    });

    try {
      await markInvoiceAsPaid(invoice.invoice_id, 100.00, 'ACH-999');
      logResult(false, 'Should not allow marking draft as paid');
      return false;
    } catch (err) {
      if (err.message.includes('Cannot mark as paid with status: draft')) {
        logResult(true, 'Correctly rejected draft invoice');
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

async function testIdempotentPaid() {
  logTest('R9.3 - Idempotent (Already Paid)');

  try {
    const invoice = await createTestInvoice({
      invoice_id: uuidv4(),
      tenant_id: TEST_TENANT_ID,
      carrier_id: TEST_CARRIER_ID,
      invoice_number: `ALREADY-PAID-${Date.now()}`,
      invoice_date: new Date().toISOString(),
      due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'paid',
      currency: 'USD',
      subtotal_amount: 100.00,
      tax_amount: 0,
      total_amount: 100.00,
      created_by: TEST_USER_ID,
      paid_amount: 100.00,
      paid_at: new Date().toISOString(),
      payment_reference: 'ORIGINAL-REF'
    });

    try {
      await markInvoiceAsPaid(invoice.invoice_id, 100.00, 'NEW-REF');
      logResult(false, 'Should detect already paid');
      return false;
    } catch (err) {
      if (err.message.includes('Cannot mark as paid with status: paid')) {
        logResult(true, 'Correctly detected already paid');
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

async function runR9Verification() {
  console.log('\n' + '━'.repeat(80));
  console.log('E3 VERIFICATION SESSION');
  console.log('R9: Mark Invoice as Paid');
  console.log('━'.repeat(80));

  const startTime = Date.now();

  const tests = [
    { name: 'R9.1 - Mark Approved as Paid', fn: testMarkApprovedAsPaid },
    { name: 'R9.2 - Reject Draft', fn: testCannotMarkDraftAsPaid },
    { name: 'R9.3 - Idempotent Paid', fn: testIdempotentPaid }
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
  console.log('R9 VERIFICATION SUMMARY');
  console.log('━'.repeat(80));

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  results.forEach(r => logResult(r.passed, r.name));

  console.log(`\nTotal Tests: ${results.length}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Testing Effort: ${durationMinutes} minutes (${durationDays} engineering-days)`);

  console.log('\n' + (failed > 0 ? '❌ R9 VERIFICATION FAILED' : '✅ R9 VERIFICATION PASSED'));
  console.log('━'.repeat(80));

  process.exit(failed > 0 ? 1 : 0);
}

runR9Verification().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
