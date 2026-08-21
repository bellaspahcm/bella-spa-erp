/**
 * E3 VERIFICATION - R4: Detect Duplicate Invoice
 * 
 * Acceptance Criteria:
 * - Detect duplicate invoices (same carrier + invoice_number)
 * - Flag or reject duplicate submissions
 * - Enforce uniqueness constraint
 * 
 * SIMPLIFIED TEST: Focus on duplicate detection at creation time
 * Schema has UNIQUE constraint: (tenant_id, carrier_id, invoice_number)
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

// Use existing tenant
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

// ============================================================================
// Tests
// ============================================================================

async function testFirstInvoiceCreates() {
  logTest('R4.1 - First Invoice with Unique Number Creates Successfully');

  try {
    const invoiceNumber = `DUP-TEST-${Date.now()}`;
    
    const invoice = await createTestInvoice({
      invoice_id: uuidv4(),
      tenant_id: TEST_TENANT_ID,
      carrier_id: TEST_CARRIER_ID,
      invoice_number: invoiceNumber,
      invoice_date: new Date().toISOString(),
      due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'draft',
      currency: 'USD',
      subtotal_amount: 100.00,
      tax_amount: 0,
      total_amount: 100.00,
      created_by: TEST_USER_ID
    });

    logResult(true, `Invoice created: ${invoice.invoice_number}`);
    logResult(true, `Invoice ID: ${invoice.invoice_id}`);

    return { passed: true, invoice };
  } catch (err) {
    logResult(false, `Test failed: ${err.message}`);
    return { passed: false };
  }
}

async function testDuplicateInvoiceRejected(existingInvoice) {
  logTest('R4.2 - Duplicate Invoice (Same Carrier + Number) Rejected');

  try {
    // Attempt to create invoice with SAME carrier_id and invoice_number
    await createTestInvoice({
      invoice_id: uuidv4(), // Different ID
      tenant_id: TEST_TENANT_ID,
      carrier_id: existingInvoice.carrier_id, // SAME carrier
      invoice_number: existingInvoice.invoice_number, // SAME number
      invoice_date: new Date().toISOString(),
      due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'draft',
      currency: 'USD',
      subtotal_amount: 200.00, // Different amount
      tax_amount: 0,
      total_amount: 200.00,
      created_by: TEST_USER_ID
    });

    // If we get here, duplicate was NOT rejected (BUG!)
    logResult(false, 'Duplicate invoice was ALLOWED (CONSTRAINT FAILURE)');
    return false;
  } catch (err) {
    // Expected: constraint violation error
    if (err.message.includes('unique') || err.message.includes('duplicate') || err.message.includes('log_freight_invoices_unique_invoice_number')) {
      logResult(true, 'Duplicate correctly rejected by unique constraint');
      logResult(true, `Error: ${err.message}`);
      return true;
    } else {
      logResult(false, `Unexpected error: ${err.message}`);
      return false;
    }
  }
}

async function testDifferentCarrierAllowed(existingInvoice) {
  logTest('R4.3 - Same Invoice Number with Different Carrier Allowed');

  try {
    const differentCarrierId = uuidv4(); // DIFFERENT carrier
    
    const invoice = await createTestInvoice({
      invoice_id: uuidv4(),
      tenant_id: TEST_TENANT_ID,
      carrier_id: differentCarrierId, // DIFFERENT carrier
      invoice_number: existingInvoice.invoice_number, // SAME number
      invoice_date: new Date().toISOString(),
      due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'draft',
      currency: 'USD',
      subtotal_amount: 150.00,
      tax_amount: 0,
      total_amount: 150.00,
      created_by: TEST_USER_ID
    });

    logResult(true, `Invoice created with different carrier: ${invoice.invoice_id}`);
    logResult(true, 'Same number with different carrier correctly allowed');
    return true;
  } catch (err) {
    logResult(false, `Should allow same number with different carrier: ${err.message}`);
    return false;
  }
}

async function testDifferentTenantIsolation(existingInvoice) {
  logTest('R4.4 - Same Carrier + Number in Different Tenant Allowed (Tenant Isolation)');

  try {
    const differentTenantId = uuidv4(); // DIFFERENT tenant
    
    const invoice = await createTestInvoice({
      invoice_id: uuidv4(),
      tenant_id: differentTenantId, // DIFFERENT tenant
      carrier_id: existingInvoice.carrier_id, // SAME carrier
      invoice_number: existingInvoice.invoice_number, // SAME number
      invoice_date: new Date().toISOString(),
      due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'draft',
      currency: 'USD',
      subtotal_amount: 175.00,
      tax_amount: 0,
      total_amount: 175.00,
      created_by: TEST_USER_ID
    });

    logResult(true, `Invoice created in different tenant: ${invoice.invoice_id}`);
    logResult(true, 'Tenant isolation correctly enforced (unique per tenant)');
    return true;
  } catch (err) {
    logResult(false, `Should allow same carrier+number in different tenant: ${err.message}`);
    return false;
  }
}

// ============================================================================
// Runner
// ============================================================================

async function runR4Verification() {
  console.log('\n' + '━'.repeat(80));
  console.log('E3 VERIFICATION SESSION');
  console.log('R4: Detect Duplicate Invoice');
  console.log('━'.repeat(80));

  const startTime = Date.now();

  // R4.1: Create first invoice
  const result1 = await testFirstInvoiceCreates();
  if (!result1.passed) {
    console.error('\n❌ Cannot proceed - failed to create test invoice');
    process.exit(1);
  }

  const existingInvoice = result1.invoice;

  // R4.2: Attempt duplicate
  const result2 = await testDuplicateInvoiceRejected(existingInvoice);

  // R4.3: Different carrier allowed
  const result3 = await testDifferentCarrierAllowed(existingInvoice);

  // R4.4: Tenant isolation
  const result4 = await testDifferentTenantIsolation(existingInvoice);

  const endTime = Date.now();
  const durationMinutes = ((endTime - startTime) / 1000 / 60).toFixed(4);
  const durationDays = (parseFloat(durationMinutes) / 60 / 8).toFixed(4);

  console.log('\n' + '━'.repeat(80));
  console.log('R4 VERIFICATION SUMMARY');
  console.log('━'.repeat(80));

  const results = [
    { name: 'R4.1 - First Invoice Creates', passed: result1.passed },
    { name: 'R4.2 - Duplicate Rejected', passed: result2 },
    { name: 'R4.3 - Different Carrier Allowed', passed: result3 },
    { name: 'R4.4 - Tenant Isolation', passed: result4 }
  ];

  results.forEach(r => logResult(r.passed, r.name));

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  console.log(`\nTotal Tests: ${results.length}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Testing Effort: ${durationMinutes} minutes (${durationDays} engineering-days)`);

  console.log('\n' + (failed > 0 ? '❌ R4 VERIFICATION FAILED' : '✅ R4 VERIFICATION PASSED'));
  console.log('━'.repeat(80));

  process.exit(failed > 0 ? 1 : 0);
}

runR4Verification().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
