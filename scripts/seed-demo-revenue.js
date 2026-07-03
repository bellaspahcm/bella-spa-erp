/**
 * Seed Demo Revenue Data for Intelligence Layer Testing
 * 
 * This script creates confirmed revenue records based on existing bookings
 * so that Intelligence Layer queries return meaningful data.
 * 
 * Usage: node scripts/seed-demo-revenue.js
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Load .env.local
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, '../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function seedRevenue() {
  console.log('💰 Seeding Demo Revenue Data\n');
  console.log('='.repeat(80));

  // Get first tenant
  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .select('id, name')
    .limit(1)
    .single();

  if (tenantError || !tenant) {
    console.error('❌ Failed to get tenant:', tenantError);
    return;
  }

  console.log(`✅ Tenant: ${tenant.name} (${tenant.id})\n`);

  // Get all bookings with deposits
  const { data: bookings, error: bookingsError } = await supabase
    .from('bookings')
    .select('id, booking_number, deposit_amount, full_price, created_at')
    .eq('tenant_id', tenant.id);

  if (bookingsError) {
    console.error('❌ Failed to get bookings:', bookingsError);
    return;
  }

  console.log(`Found ${bookings.length} bookings\n`);

  if (bookings.length === 0) {
    console.log('⚠️  No bookings to create revenue from');
    return;
  }

  // Create revenue records from deposits
  const revenueRecords = [];

  for (const booking of bookings) {
    // Create deposit revenue
    if (booking.deposit_amount > 0) {
      revenueRecords.push({
        tenant_id: tenant.id,
        booking_id: booking.id,
        amount: booking.deposit_amount,
        revenue_type: 'deposit',
        payment_method: 'cash',
        status: 'confirmed', // Important: must be confirmed!
        received_date: booking.created_at.split('T')[0], // Use booking creation date
        source_module: 'demo_seed',
        source_event_type: 'BOOKING_DEPOSIT_RECEIVED',
        reference_id: booking.booking_number,
        created_at: booking.created_at,
        updated_at: booking.created_at,
      });
    }

    // Create remaining payment revenue (simulating full payment)
    const remainingAmount = booking.full_price - booking.deposit_amount;
    if (remainingAmount > 0) {
      // Create payment 5 days after booking
      const paymentDate = new Date(booking.created_at);
      paymentDate.setDate(paymentDate.getDate() + 5);

      revenueRecords.push({
        tenant_id: tenant.id,
        booking_id: booking.id,
        amount: remainingAmount,
        revenue_type: 'service_revenue',
        payment_method: 'bank_transfer',
        status: 'confirmed',
        received_date: paymentDate.toISOString().split('T')[0],
        source_module: 'demo_seed',
        source_event_type: 'BOOKING_PAYMENT_RECEIVED',
        reference_id: booking.booking_number,
        created_at: paymentDate.toISOString(),
        updated_at: paymentDate.toISOString(),
      });
    }
  }

  console.log(`Creating ${revenueRecords.length} revenue records...\n`);

  // Insert revenue records
  const { data: insertedRevenue, error: insertError } = await supabase
    .from('revenue')
    .insert(revenueRecords)
    .select();

  if (insertError) {
    console.error('❌ Failed to insert revenue:', insertError);
    return;
  }

  console.log(`✅ Successfully created ${insertedRevenue.length} revenue records\n`);

  // Show summary
  const totalRevenue = revenueRecords.reduce((sum, r) => sum + r.amount, 0);
  console.log('📊 Summary:');
  console.log(`   Total Revenue: ${totalRevenue.toLocaleString('vi-VN')} VND`);
  console.log(`   Deposits: ${revenueRecords.filter(r => r.revenue_type === 'deposit').length}`);
  console.log(`   Payments: ${revenueRecords.filter(r => r.revenue_type === 'service_revenue').length}`);
  console.log('');

  // Create some demo expenses for financial health calculations
  console.log('Creating demo expenses...\n');

  const expenseRecords = [
    {
      tenant_id: tenant.id,
      expense_date: new Date().toISOString().split('T')[0],
      amount: totalRevenue * 0.15, // 15% operating expenses
      category: 'operating',
      description: 'Điện nước và mặt bằng tháng này',
      status: 'approved',
      payment_method: 'bank_transfer',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      tenant_id: tenant.id,
      expense_date: new Date().toISOString().split('T')[0],
      amount: totalRevenue * 0.08, // 8% marketing expenses
      category: 'marketing',
      description: 'Chi phí quảng cáo Facebook',
      status: 'approved',
      payment_method: 'cash',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  const { data: insertedExpenses, error: expenseError } = await supabase
    .from('expenses')
    .insert(expenseRecords)
    .select();

  if (expenseError) {
    console.error('⚠️  Failed to insert expenses:', expenseError);
  } else {
    console.log(`✅ Successfully created ${insertedExpenses.length} expense records\n`);
    const totalExpenses = expenseRecords.reduce((sum, e) => sum + e.amount, 0);
    console.log('📊 Expenses Summary:');
    console.log(`   Total Expenses: ${totalExpenses.toLocaleString('vi-VN')} VND`);
    console.log(`   Net Profit: ${(totalRevenue - totalExpenses).toLocaleString('vi-VN')} VND`);
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ Demo data seeding complete!');
  console.log('\nYou can now test Intelligence Layer APIs:');
  console.log(`   http://localhost:3000/api/intelligence/executive/monthly-revenue-summary?tenantId=${tenant.id}&period=month`);
}

seedRevenue().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
