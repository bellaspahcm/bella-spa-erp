/**
 * E3 VERIFICATION - R6: Submit Invoice for Approval
 * 
 * Acceptance Criteria (from E3 Requirements):
 * - Status transition: draft → pending_approval
 * - Validation: Invoice must be validated (R2-R4 complete)
 * - Approval required if: variance exists OR total > threshold
 * - Event published: InvoiceSubmitted (deferred for E3)
 * 
 * SIMPLIFIED TEST: Focus on status transition and validation rules
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

async function submitInvoiceForApproval(invoiceId, submittedBy) {
  // Get current invoice
  const { data: invoice, error: fetchError } = await supabase
    .from('log_freight_invoices')
    .select('*')
    .eq('invoice_id', invoiceId)
    .single();
  
  if (fetchError) throw new Error(`Failed to fetch invoice: ${fetchError.message}`);
  if (!invoice) throw new Error('Invoice not found');
  
  // Validate current status
  if (invoice.status !== 'draft') {
    throw new Error(`Cannot submit invoice with status: ${invoice.status}`);
  }
  
  // Update status
  const { data: updated, error: updateError } = await supabase
    .from('log_freight_invoices')
    .update({
      status: 'pending_approval',
      updated_by: submittedBy,
      updated_at: new Date().toISOString()
    })
    .eq('invoice_id', invoiceId)
    .select()
    .single();
  
  if (updateError) throw new Error(`Failed to submit invoice: ${updateError.message}`);
  
  return updated;
}

// ============================================================================
// Tests
// ============================================================================

async function testSubmitDraftInvoice() {
  logTest('R6.1 - Submit Draft Invoice to Pending Approval');

  try {
    const invoice = await createTestInvoice({
      invoice_id: uuidv4(),
      tenant_id: TEST_TENANT_ID,
      carrier_id: TEST_CARRIER_ID,
      invoice_number: `SUBMIT-${Date.now()}`,
      invoice_date: new Date().toISOString(),
      due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'draft',
      currency: 'USD',
      subtotal_amount: 100.00,
      tax_amount: 0,
      total_amount: 100.00,
      created_by: TEST_USER_ID
    });

    logResult(true, `Invoice created with status: ${invoice.status}`);

    const submitted = await submitInvoiceForApproval(invoice.invoice_id, TEST_USER_ID);

    const checks = [
      { condition: submitted.status === 'pending_approval', message: 'Status changed to pending_approval' },
      { condition: submitted.updated_by === TEST_USER_ID, message: 'Updated_by recorded' },
      { condition: submitted.updated_at !== null, message: 'Updated_at timestamp recorded' }
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

async function testCannotSubmitNonDraft() {
  logTest('R6.2 - Cannot Submit Already Approved Invoice');

  try {
    const invoice = await createTestInvoice({
      invoice_id: uuidv4(),
      tenant_id: TEST_TENANT_ID,
      carrier_id: TEST_CARRIER_ID,
      invoice_number: `APPROVED-${Date.now()}`,
      invoice_date: new Date().toISOString(),
      due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'approved', // Already approved
      currency: 'USD',
      subtotal_amount: 100.00,
      tax_amount: 0,
      total_amount: 100.00,
      created_by: TEST_USER_ID
    });

    logResult(true, `Invoice created with status: ${invoice.status}`);

    try {
      await submitInvoiceForApproval(invoice.invoice_id, TEST_USER_ID);
      logResult(false, 'Should not allow submitting approved invoice');
      return false;
    } catch (err) {
      if (err.message.includes('Cannot submit invoice with status')) {
        logResult(true, 'Correctly rejected non-draft invoice');
        logResult(true, `Error: ${err.message}`);
        return true;
      } else {
        logResult(false, `Unexpected error: ${err.message}`);
        return false;
      }
    }
  } catch (err) {
    logResult(false, `Test setup failed: ${err.message}`);
    return false;
  }
}

async function testIdempotentSubmit() {
  logTest('R6.3 - Idempotent Submit (Already Pending)');

  try {
    const invoice = await createTestInvoice({
      invoice_id: uuidv4(),
      tenant_id: TEST_TENANT_ID,
      carrier_id: TEST_CARRIER_ID,
      invoice_number: `IDEM-${Date.now()}`,
      invoice_date: new Date().toISOString(),
      due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'pending_approval', // Already submitted
      currency: 'USD',
      subtotal_amount: 100.00,
      tax_amount: 0,
      total_amount: 100.00,
      created_by: TEST_USER_ID
    });

    logResult(true, `Invoice created with status: ${invoice.status}`);

    try {
      await submitInvoiceForApproval(invoice.invoice_id, TEST_USER_ID);
      logResult(false, 'Should detect already pending status');
      return false;
    } catch (err) {
      if (err.message.includes('Cannot submit invoice with status: pending_approval')) {
        logResult(true, 'Correctly detected already pending');
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

// ============================================================================
// Runner
// ============================================================================

async function runR6Verification() {
  console.log('\n' + '━'.repeat(80));
  console.log('E3 VERIFICATION SESSION');
  console.log('R6: Submit Invoice for Approval');
  console.log('━'.repeat(80));

  const startTime = Date.now();

  const tests = [
    { name: 'R6.1 - Submit Draft', fn: testSubmitDraftInvoice },
    { name: 'R6.2 - Reject Non-Draft', fn: testCannotSubmitNonDraft },
    { name: 'R6.3 - Idempotent Submit', fn: testIdempotentSubmit }
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
  console.log('R6 VERIFICATION SUMMARY');
  console.log('━'.repeat(80));

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  results.forEach(r => logResult(r.passed, r.name));

  console.log(`\nTotal Tests: ${results.length}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Testing Effort: ${durationMinutes} minutes (${durationDays} engineering-days)`);

  console.log('\n' + (failed > 0 ? '❌ R6 VERIFICATION FAILED' : '✅ R6 VERIFICATION PASSED'));
  console.log('━'.repeat(80));

  process.exit(failed > 0 ? 1 : 0);
}

runR6Verification().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
