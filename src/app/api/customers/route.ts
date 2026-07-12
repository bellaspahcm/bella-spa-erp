import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

/**
 * Calculate customer tier based on status and completed bookings
 * Logic from archive-old-decision-engine/lib/rules/booking-approval-rules.ts
 */
function calculateCustomerTier(
  status: string | null,
  completedBookingsCount: number = 0
): 'vip' | 'loyal' | 'new' {
  if (status === 'vip') return 'vip';
  if (completedBookingsCount >= 5) return 'loyal';
  return 'new';
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const tenantId = searchParams.get('tenant_id');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';

    if (!tenantId) {
      return NextResponse.json(
        { error: 'tenant_id is required' },
        { status: 400 }
      );
    }

    const supabase = createClient();

    // First, query customers
    let customerQuery = supabase
      .from('customers')
      .select('id, name_mother, phone, status, loyalty_points')
      .eq('tenant_id', tenantId)
      .limit(limit);

    if (search) {
      customerQuery = customerQuery.or(`name_mother.ilike.%${search}%,phone.ilike.%${search}%`);
    }

    const { data: customersData, error: customersError } = await customerQuery.order('name_mother');

    if (customersError) {
      console.error('[API /api/customers] Error:', customersError);
      return NextResponse.json(
        { error: customersError.message },
        { status: 500 }
      );
    }

    // For each customer, get completed bookings count
    const customers = await Promise.all(
      (customersData || []).map(async (customer: any) => {
        const { count } = await supabase
          .from('bookings')
          .select('*', { count: 'exact', head: true })
          .eq('customer_id', customer.id)
          .eq('status', 'completed');

        return {
          id: customer.id,
          name: customer.name_mother, // UI expects "name"
          name_baby: null, // Optional field
          phone: customer.phone,
          tier: calculateCustomerTier(customer.status, count || 0),
          total_spending: customer.loyalty_points || 0, // Use loyalty_points as proxy
        };
      })
    );

    return NextResponse.json({ customers });
  } catch (error) {
    console.error('[API /api/customers] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
