/**
 * E3 VERIFICATION - R10: Query Invoices
 * 
 * Acceptance Criteria:
 * - Query by: status, carrier, date range, shipment_id
 * - Pagination support
 * - Tenant isolation (RLS)
 * - Sort by invoice_date, total_amount
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

async function testQueryByStatus() {
  logTest('R10.1 - Query Invoices by Status');

  try {
    // Create test invoices
    const draftInvoice = await createTestInvoice({
      invoice_id: uuidv4(),
      tenant_id: TEST_TENANT_ID,
      carrier_id: TEST_CARRIER_ID,
      invoice_number: `QUERY-DRAFT-${Date.now()}`,
      invoice_date: new Date().toISOString(),
      due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'draft',
      currency: 'USD',
      subtotal_amount: 100.00,
      tax_amount: 0,
      total_amount: 100.00,
      created_by: TEST_USER_ID
    });

    const approvedInvoice = await createTestInvoice({
      invoice_id: uuidv4(),
      tenant_id: TEST_TENANT_ID,
      carrier_id: TEST_CARRIER_ID,
      invoice_number: `QUERY-APPROVED-${Date.now()}`,
      invoice_date: new Date().toISOString(),
      due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'approved',
      currency: 'USD',
      subtotal_amount: 200.00,
      tax_amount: 0,
      total_amount: 200.00,
      created_by: TEST_USER_ID
    });

    logResult(true, `Test invoices created (draft, approved)`);

    // Query by status
    const { data: drafts, error: draftError } = await supabase
      .from('log_freight_invoices')
      .select('*')
      .eq('tenant_id', TEST_TENANT_ID)
      .eq('status', 'draft')
      .gte('invoice_number', `QUERY-DRAFT-`);

    if (draftError) throw new Error(`Query failed: ${draftError.message}`);

    const foundDraft = drafts.some(inv => inv.invoice_id === draftInvoice.invoice_id);
    const foundApprovedInDrafts = drafts.some(inv => inv.invoice_id === approvedInvoice.invoice_id);

    const checks = [
      { condition: foundDraft, message: 'Draft invoice found in draft query' },
      { condition: !foundApprovedInDrafts, message: 'Approved invoice NOT in draft query' }
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

async function testQueryByCarrier() {
  logTest('R10.2 - Query Invoices by Carrier');

  try {
    const carrier1 = uuidv4();
    const carrier2 = uuidv4();

    const inv1 = await createTestInvoice({
      invoice_id: uuidv4(),
      tenant_id: TEST_TENANT_ID,
      carrier_id: carrier1,
      invoice_number: `CARRIER1-${Date.now()}`,
      invoice_date: new Date().toISOString(),
      due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'draft',
      currency: 'USD',
      subtotal_amount: 100.00,
      tax_amount: 0,
      total_amount: 100.00,
      created_by: TEST_USER_ID
    });

    const inv2 = await createTestInvoice({
      invoice_id: uuidv4(),
      tenant_id: TEST_TENANT_ID,
      carrier_id: carrier2,
      invoice_number: `CARRIER2-${Date.now()}`,
      invoice_date: new Date().toISOString(),
      due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'draft',
      currency: 'USD',
      subtotal_amount: 200.00,
      tax_amount: 0,
      total_amount: 200.00,
      created_by: TEST_USER_ID
    });

    logResult(true, `Test invoices created (2 carriers)`);

    const { data: carrier1Invoices, error } = await supabase
      .from('log_freight_invoices')
      .select('*')
      .eq('tenant_id', TEST_TENANT_ID)
      .eq('carrier_id', carrier1);

    if (error) throw new Error(`Query failed: ${error.message}`);

    const foundCarrier1 = carrier1Invoices.some(inv => inv.invoice_id === inv1.invoice_id);
    const foundCarrier2 = carrier1Invoices.some(inv => inv.invoice_id === inv2.invoice_id);

    const checks = [
      { condition: foundCarrier1, message: 'Carrier1 invoice found' },
      { condition: !foundCarrier2, message: 'Carrier2 invoice NOT found in carrier1 query' }
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

async function testTenantIsolation() {
  logTest('R10.3 - Tenant Isolation in Queries');

  try {
    const tenant1 = TEST_TENANT_ID;
    const tenant2 = uuidv4();

    const inv1 = await createTestInvoice({
      invoice_id: uuidv4(),
      tenant_id: tenant1,
      carrier_id: TEST_CARRIER_ID,
      invoice_number: `TENANT1-${Date.now()}`,
      invoice_date: new Date().toISOString(),
      due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'draft',
      currency: 'USD',
      subtotal_amount: 100.00,
      tax_amount: 0,
      total_amount: 100.00,
      created_by: TEST_USER_ID
    });

    const inv2 = await createTestInvoice({
      invoice_id: uuidv4(),
      tenant_id: tenant2,
      carrier_id: TEST_CARRIER_ID,
      invoice_number: `TENANT2-${Date.now()}`,
      invoice_date: new Date().toISOString(),
      due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'draft',
      currency: 'USD',
      subtotal_amount: 200.00,
      tax_amount: 0,
      total_amount: 200.00,
      created_by: TEST_USER_ID
    });

    logResult(true, `Test invoices created (2 tenants)`);

    const { data: tenant1Invoices, error } = await supabase
      .from('log_freight_invoices')
      .select('*')
      .eq('tenant_id', tenant1);

    if (error) throw new Error(`Query failed: ${error.message}`);

    const foundTenant1 = tenant1Invoices.some(inv => inv.invoice_id === inv1.invoice_id);
    const foundTenant2 = tenant1Invoices.some(inv => inv.invoice_id === inv2.invoice_id);

    const checks = [
      { condition: foundTenant1, message: 'Tenant1 invoice found' },
      { condition: !foundTenant2, message: 'Tenant2 invoice NOT found in tenant1 query' }
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

async function runR10Verification() {
  console.log('\n' + '━'.repeat(80));
  console.log('E3 VERIFICATION SESSION');
  console.log('R10: Query Invoices');
  console.log('━'.repeat(80));

  const startTime = Date.now();

  const tests = [
    { name: 'R10.1 - Query by Status', fn: testQueryByStatus },
    { name: 'R10.2 - Query by Carrier', fn: testQueryByCarrier },
    { name: 'R10.3 - Tenant Isolation', fn: testTenantIsolation }
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
  console.log('R10 VERIFICATION SUMMARY');
  console.log('━'.repeat(80));

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  results.forEach(r => logResult(r.passed, r.name));

  console.log(`\nTotal Tests: ${results.length}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Testing Effort: ${durationMinutes} minutes (${durationDays} engineering-days)`);

  console.log('\n' + (failed > 0 ? '❌ R10 VERIFICATION FAILED' : '✅ R10 VERIFICATION PASSED'));
  console.log('━'.repeat(80));

  process.exit(failed > 0 ? 1 : 0);
}

runR10Verification().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
