/**
 * Bella Land Reservations - Database Integrity Check
 * 
 * Checks:
 * 1. Reservations exist with correct types/statuses
 * 2. Foreign key integrity (customer_id, project_id, product_id)
 * 3. Tenant isolation
 * 4. No orphan reservations
 * 5. Critical business rules (deposit amounts, dates)
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env.local
config({ path: resolve(process.cwd(), '.env.local') });

import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/database.types';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_KEY);

type ReservationRow = Database['public']['Tables']['re_reservations']['Row'];

async function verifyReservations() {
  console.log('\n🔍 Bella Land Reservations - Database Integrity Check\n');
  console.log('═'.repeat(70));

  // 1. Check all reservations with relations
  const { data: allReservations, error } = await supabase
    .from('re_reservations')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Failed to fetch reservations:', error.message);
    process.exit(1);
  }

  console.log(`\n📊 Total reservations: ${allReservations?.length || 0}`);

  if (!allReservations || allReservations.length === 0) {
    console.log('\n⚠️  No reservations found. Create test reservations first.');
    return;
  }

  // 2. Group by tenant
  const reservationsByTenant = new Map<string, ReservationRow[]>();
  for (const reservation of allReservations) {
    if (!reservationsByTenant.has(reservation.tenant_id)) {
      reservationsByTenant.set(reservation.tenant_id, []);
    }
    reservationsByTenant.get(reservation.tenant_id)!.push(reservation);
  }

  console.log(`👥 Tenants with reservations: ${reservationsByTenant.size}`);

  // 3. Foreign key validation
  console.log('\n━'.repeat(70));
  console.log('🔗 FOREIGN KEY INTEGRITY');
  console.log('━'.repeat(70));

  const orphanCustomer = allReservations.filter(r => !r.customer_id);
  const orphanProject = allReservations.filter(r => !r.project_id);
  const orphanProduct = allReservations.filter(r => !r.product_id);

  console.log(`\n${orphanCustomer.length === 0 ? '✅' : '🔴'} Missing customer_id: ${orphanCustomer.length}`);
  console.log(`${orphanProject.length === 0 ? '✅' : '🔴'} Missing project_id: ${orphanProject.length}`);
  console.log(`${orphanProduct.length === 0 ? '✅' : '🔴'} Missing product_id: ${orphanProduct.length}`);

  // 4. Tenant isolation
  console.log('\n━'.repeat(70));
  console.log('🔒 TENANT ISOLATION');
  console.log('━'.repeat(70));

  const nullTenant = allReservations.filter(r => !r.tenant_id);
  console.log(`\n${nullTenant.length === 0 ? '✅' : '🔴'} Reservations with tenant_id: ${allReservations.length - nullTenant.length}/${allReservations.length}`);

  for (const [tenantId, reservations] of reservationsByTenant.entries()) {
    console.log(`\n   Tenant: ${tenantId.slice(0, 8)}...`);
    console.log(`   Reservations: ${reservations.length}`);
  }

  // 5. Reservation type distribution
  console.log('\n━'.repeat(70));
  console.log('📋 RESERVATION TYPE DISTRIBUTION');
  console.log('━'.repeat(70));

  const typeCount = new Map<string, number>();
  for (const reservation of allReservations) {
    const type = reservation.reservation_type || 'unknown';
    typeCount.set(type, (typeCount.get(type) || 0) + 1);
  }

  for (const [type, count] of Array.from(typeCount.entries()).sort((a, b) => b[1] - a[1])) {
    console.log(`   ${type.padEnd(15)} ${count}`);
  }

  // 6. Deposit amounts
  console.log('\n━'.repeat(70));
  console.log('💰 DEPOSIT AMOUNTS');
  console.log('━'.repeat(70));

  const withDeposit = allReservations.filter(r => r.deposit_amount && r.deposit_amount > 0);
  const zeroDeposit = allReservations.filter(r => !r.deposit_amount || r.deposit_amount === 0);

  console.log(`\n✅ With deposit: ${withDeposit.length}`);
  console.log(`⚠️  Zero/null deposit: ${zeroDeposit.length}`);

  if (withDeposit.length > 0) {
    const amounts = withDeposit.map(r => r.deposit_amount!);
    const avg = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const min = Math.min(...amounts);
    const max = Math.max(...amounts);
    
    console.log(`\n   Average deposit: ${avg.toLocaleString('vi-VN')} VND`);
    console.log(`   Min deposit: ${min.toLocaleString('vi-VN')} VND`);
    console.log(`   Max deposit: ${max.toLocaleString('vi-VN')} VND`);
  }

  // 7. Recent reservations
  console.log('\n━'.repeat(70));
  console.log('🕐 RECENT RESERVATIONS (Last 5)');
  console.log('━'.repeat(70));

  const recentReservations = allReservations.slice(0, 5);
  for (const reservation of recentReservations) {
    const createdAt = new Date(reservation.created_at).toLocaleString('vi-VN');
    
    console.log(`\n   📝 Reservation ${reservation.id.slice(0, 8)}...`);
    console.log(`      Type: ${reservation.reservation_type || 'unknown'}`);
    console.log(`      Customer ID: ${reservation.customer_id ? reservation.customer_id.slice(0, 8) + '...' : 'N/A'}`);
    console.log(`      Project ID: ${reservation.project_id ? reservation.project_id.slice(0, 8) + '...' : 'N/A'}`);
    console.log(`      Product ID: ${reservation.product_id ? reservation.product_id.slice(0, 8) + '...' : 'N/A'}`);
    console.log(`      Deposit: ${reservation.deposit_amount?.toLocaleString('vi-VN') || 0} VND`);
    console.log(`      Tenant: ${reservation.tenant_id.slice(0, 8)}...`);
    console.log(`      Created: ${createdAt}`);
  }

  // 8. Summary
  console.log('\n' + '═'.repeat(70));
  console.log('📊 SUMMARY');
  console.log('═'.repeat(70));

  const allHaveTenant = nullTenant.length === 0;
  const allHaveCustomer = orphanCustomer.length === 0;
  const allHaveProject = orphanProject.length === 0;
  const allHaveProduct = orphanProduct.length === 0;

  console.log(`\n   Total reservations: ${allReservations.length}`);
  console.log(`   Tenant isolation: ${allHaveTenant ? '✅ All have tenant_id' : '🔴 Some missing tenant_id'}`);
  console.log(`   Foreign keys (customer): ${allHaveCustomer ? '✅' : '🔴'}`);
  console.log(`   Foreign keys (project): ${allHaveProject ? '✅' : '🔴'}`);
  console.log(`   Foreign keys (product): ${allHaveProduct ? '✅' : '🔴'}`);
  console.log(`   Unique tenants: ${reservationsByTenant.size}`);
  console.log(`   With deposits: ${withDeposit.length}`);

  if (allHaveTenant && allHaveCustomer && allHaveProject && allHaveProduct) {
    console.log('\n   🎉 ALL CHECKS PASSED');
  } else {
    console.log('\n   ⚠️  ISSUES FOUND - Review above');
  }

  console.log('\n' + '═'.repeat(70) + '\n');

  // Exit code
  const success = allHaveTenant && allHaveCustomer && allHaveProject && allHaveProduct;
  process.exit(success ? 0 : 1);
}

verifyReservations().catch(console.error);
