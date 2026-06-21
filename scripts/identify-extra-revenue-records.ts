/**
 * Identify the 3 extra revenue records (390k, 500k, 300k on June 8-9)
 */
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../src/types/database.types';
import { requireSupabaseAdminEnv } from '../src/lib/supabase-admin-env';

// Load .env.local
config({ path: '.env.local' });

const { url, adminKey } = requireSupabaseAdminEnv();
const supabase = createClient<Database>(url, adminKey);

async function identifyExtraRevenue() {
  console.log('\n=== Identifying Extra Revenue Records ===\n');

  // Get revenue records from June 8-9 with amounts 390k, 500k, 300k
  const suspectAmounts = [390000, 500000, 300000];
  
  const { data: revenues, error } = await supabase
    .from('revenue')
    .select(`
      id,
      amount,
      received_date,
      status,
      revenue_type,
      notes,
      booking_id,
      tenant_id
    `)
    .gte('received_date', '2026-06-07')
    .lte('received_date', '2026-06-09')
    .in('amount', suspectAmounts)
    .eq('status', 'confirmed')
    .order('received_date', { ascending: true });

  if (error) {
    console.error('❌ Error finding revenue records:', error.message);
    return;
  }

  if (!revenues || revenues.length === 0) {
    console.log('❌ No matching revenue records found');
    return;
  }

  console.log(`📊 Found ${revenues.length} suspect revenue record(s):\n`);

  for (const revenue of revenues) {
    console.log(`💰 Revenue ID: ${revenue.id}`);
    console.log(`   Amount: ${revenue.amount?.toLocaleString('vi-VN')} đ`);
    console.log(`   Date: ${revenue.received_date}`);
    console.log(`   Type: ${revenue.revenue_type}`);
    console.log(`   Status: ${revenue.status}`);
    console.log(`   Notes: ${revenue.notes || '(none)'}`);
    console.log(`   Tenant: ${revenue.tenant_id}`);
    console.log('');

    if (revenue.booking_id) {
      // Get booking details
      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .select('id, booking_number, package_name, full_price, discount_percent, status, customer_id, tenant_id')
        .eq('id', revenue.booking_id)
        .single();

      if (bookingError) {
        console.error('   ❌ Error finding booking:', bookingError.message);
      } else if (booking) {
        console.log('   📋 Booking Details:');
        console.log(`      Booking Number: ${booking.booking_number}`);
        console.log(`      Package: ${booking.package_name || '(no package)'}`);
        console.log(`      Full Price: ${booking.full_price?.toLocaleString('vi-VN')} đ`);
        console.log(`      Discount: ${booking.discount_percent}%`);
        console.log(`      Status: ${booking.status}`);
        console.log(`      Customer ID: ${booking.customer_id}`);
        console.log(`      Tenant: ${booking.tenant_id}`);
        console.log('');

        // Check if this is a demo/test booking
        if (booking.tenant_id !== revenue.tenant_id) {
          console.log('      ⚠️  TENANT MISMATCH! Booking and revenue have different tenants');
        }

        // Get customer details
        const { data: customer, error: customerError } = await supabase
          .from('customers')
          .select('id, full_name, phone, tenant_id')
          .eq('id', booking.customer_id)
          .single();

        if (customerError) {
          console.error('      ❌ Error finding customer:', customerError.message);
        } else if (customer) {
          console.log('      👤 Customer:');
          console.log(`         Name: ${customer.full_name}`);
          console.log(`         Phone: ${customer.phone || '(no phone)'}`);
          console.log(`         Tenant: ${customer.tenant_id}`);
          console.log('');

          // Check if customer name suggests demo/test
          const lowerName = (customer.full_name || '').toLowerCase();
          if (
            lowerName.includes('demo') ||
            lowerName.includes('test') ||
            lowerName.includes('thử nghiệm') ||
            customer.id.startsWith('BSP-DEMO-')
          ) {
            console.log('      🚫 DEMO/TEST CUSTOMER DETECTED!');
            console.log(`         DELETE THIS REVENUE RECORD: ${revenue.id}`);
          }
        }

        // Check for sessions
        const { data: sessions, error: sessionError } = await supabase
          .from('session_logs')
          .select('id, session_number, status, created_at')
          .eq('booking_id', booking.id)
          .order('session_number', { ascending: true });

        if (!sessionError && sessions && sessions.length > 0) {
          console.log(`      📝 Found ${sessions.length} session(s):`);
          sessions.forEach(s => {
            console.log(`         Session ${s.session_number}: ${s.status}`);
          });
          console.log('');
        }
      }
    } else {
      console.log('   ⚠️  No booking_id - this is a standalone revenue record');
      console.log('');
    }

    console.log('   ─'.repeat(40));
    console.log('');
  }

  // Summary
  console.log('\n=== Summary ===\n');
  const totalExtra = revenues.reduce((sum, r) => sum + (r.amount || 0), 0);
  console.log(`Total extra revenue: ${totalExtra.toLocaleString('vi-VN')} đ`);
  console.log(`Number of records: ${revenues.length}`);
  console.log('');
  console.log('🔧 Action needed:');
  console.log('   1. Identify which records are from demo/test customers');
  console.log('   2. Delete or mark them as invalid');
  console.log('   3. Re-verify total revenue = 9,499,500đ');
}

identifyExtraRevenue()
  .then(() => {
    console.log('\n✅ Identification complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });
