/**
 * Inventory Forecast API
 * 
 * Calculates projected inventory usage based on upcoming bookings.
 * 
 * **Business Logic:**
 * 1. Query all active bookings with scheduled sessions in next 30 days
 * 2. For each booking, calculate product usage per session
 * 3. Aggregate total projected usage per product
 * 4. Compare with current stock levels
 * 5. Return items that will run out (with days until shortage)
 * 
 * **Example Response:**
 * ```json
 * {
 *   "success": true,
 *   "forecast": [
 *     {
 *       "productId": "prod-123",
 *       "productName": "Dầu massage",
 *       "currentStock": 25,
 *       "projectedUsage": 30,
 *       "shortage": 5,
 *       "daysUntilShortage": 15,
 *       "urgency": "high"
 *     }
 *   ],
 *   "totalBookings": 10,
 *   "forecastPeriodDays": 30
 * }
 * ```
 */

import { createClient } from '@/lib/supabase-server';
import { NextResponse } from 'next/server';

interface ForecastItem {
  productId: string;
  productName: string;
  currentStock: number;
  projectedUsage: number;
  shortage: number;
  daysUntilShortage: number;
  urgency: 'low' | 'medium' | 'high' | 'critical';
}

interface ForecastResponse {
  success: boolean;
  forecast: ForecastItem[];
  totalBookings: number;
  forecastPeriodDays: number;
  error?: string;
}

export async function GET(request: Request): Promise<Response> {
  try {
    const { searchParams } = new URL(request.url);
    const daysParam = searchParams.get('days');
    const forecastDays = daysParam ? parseInt(daysParam, 10) : 30;

    if (forecastDays < 1 || forecastDays > 90) {
      return NextResponse.json<ForecastResponse>(
        { success: false, forecast: [], totalBookings: 0, forecastPeriodDays: 0, error: 'Forecast days must be between 1 and 90' },
        { status: 400 }
      );
    }

    let tenantId: string | null = null;

    // ── Development mock bypass ──────────────────────────────────────────────
    if (process.env.NODE_ENV === 'development') {
      const { headers } = await import('next/headers');
      const reqHeaders = await headers();
      const mockEmail = reqHeaders.get('x-mock-user-email');
      const { getSupabaseAdminUrl, getSupabaseAdminKey } = await import('@/lib/supabase-admin-env');
      const adminUrl = getSupabaseAdminUrl();
      const adminKey = getSupabaseAdminKey();

      if (mockEmail && adminUrl && adminKey) {
        const { createClient: createSupabaseJsClient } = await import('@supabase/supabase-js');
        const admin = createSupabaseJsClient(adminUrl, adminKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });

        const { data: mockUserProfile } = await admin
          .from('users')
          .select('tenant_id')
          .eq('email', mockEmail)
          .single();

        if (mockUserProfile?.tenant_id) {
          tenantId = mockUserProfile.tenant_id;
        }
      }
    }
    // ── End dev bypass ───────────────────────────────────────────────────────

    const supabase = await createClient();

    if (!tenantId) {
      // 1. Get current user's tenant
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return NextResponse.json<ForecastResponse>(
          { success: false, forecast: [], totalBookings: 0, forecastPeriodDays: 0, error: 'Unauthorized' },
          { status: 401 }
        );
      }

      const { data: profile } = await supabase
        .from('users')
        .select('tenant_id')
        .eq('id', user.id)
        .single();

      if (!profile?.tenant_id) {
        return NextResponse.json<ForecastResponse>(
          { success: false, forecast: [], totalBookings: 0, forecastPeriodDays: 0, error: 'Tenant not found' },
          { status: 404 }
        );
      }

      tenantId = profile.tenant_id;
    }
    const today = new Date();
    const forecastEndDate = new Date(today);
    forecastEndDate.setDate(today.getDate() + forecastDays);

    // 2. Query upcoming bookings with scheduled sessions
    const { data: bookings, error: bookingsError } = await supabase
      .from('bookings')
      .select(`
        id,
        package_id,
        total_sessions,
        completed_sessions,
        packages (
          id,
          name,
          product_usage
        )
      `)
      .eq('tenant_id', tenantId)
      .in('status', ['in_progress', 'booked'])
      .not('package_id', 'is', null);

    if (bookingsError) {
      console.error('[Forecast] Error fetching bookings:', bookingsError);
      return NextResponse.json<ForecastResponse>(
        { success: false, forecast: [], totalBookings: 0, forecastPeriodDays: 0, error: bookingsError.message },
        { status: 500 }
      );
    }

    // 3. Calculate projected usage per product
    const productUsageMap = new Map<string, { name: string; quantity: number }>();

    for (const booking of bookings || []) {
      const remainingSessions = (booking.total_sessions || 0) - (booking.completed_sessions || 0);
      if (remainingSessions <= 0) continue;

      const pkg = booking.packages as { id?: string; name?: string; product_usage?: Record<string, number> | null } | null;
      if (!pkg?.product_usage) continue;

      // product_usage format: { "product-id": quantity_per_session }
      const productUsage = pkg.product_usage as Record<string, number>;

      for (const [productId, qtyPerSession] of Object.entries(productUsage)) {
        const totalQty = qtyPerSession * remainingSessions;
        const existing = productUsageMap.get(productId);
        
        if (existing) {
          existing.quantity += totalQty;
        } else {
          // We'll fetch product name later
          productUsageMap.set(productId, { name: '', quantity: totalQty });
        }
      }
    }

    if (productUsageMap.size === 0) {
      // No projected usage
      return NextResponse.json<ForecastResponse>({
        success: true,
        forecast: [],
        totalBookings: bookings?.length || 0,
        forecastPeriodDays: forecastDays,
      });
    }

    // 4. Fetch current stock levels and product names
    const productIds = Array.from(productUsageMap.keys());
    const { data: inventory, error: inventoryError } = await supabase
      .from('inventory_items')
      .select('id, name, stock_level')
      .eq('tenant_id', tenantId)
      .in('id', productIds);

    if (inventoryError) {
      console.error('[Forecast] Error fetching inventory:', inventoryError);
      return NextResponse.json<ForecastResponse>(
        { success: false, forecast: [], totalBookings: 0, forecastPeriodDays: 0, error: inventoryError.message },
        { status: 500 }
      );
    }

    // 5. Calculate shortages and urgency
    const forecast: ForecastItem[] = [];

    for (const item of inventory || []) {
      const usage = productUsageMap.get(item.id);
      if (!usage) continue;

      const currentStock = Number(item.stock_level || 0);
      const projectedUsage = usage.quantity;
      const shortage = Math.max(0, projectedUsage - currentStock);

      if (shortage > 0) {
        // Calculate days until shortage (assuming linear usage)
        const usagePerDay = projectedUsage / forecastDays;
        const daysUntilShortage = currentStock / usagePerDay;

        // Determine urgency
        let urgency: 'low' | 'medium' | 'high' | 'critical';
        if (daysUntilShortage <= 3) {
          urgency = 'critical';
        } else if (daysUntilShortage <= 7) {
          urgency = 'high';
        } else if (daysUntilShortage <= 14) {
          urgency = 'medium';
        } else {
          urgency = 'low';
        }

        forecast.push({
          productId: item.id,
          productName: item.name,
          currentStock,
          projectedUsage,
          shortage,
          daysUntilShortage: Math.floor(daysUntilShortage),
          urgency,
        });
      }
    }

    // 6. Sort by urgency (critical first)
    const urgencyOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    forecast.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency]);

    return NextResponse.json<ForecastResponse>({
      success: true,
      forecast,
      totalBookings: bookings?.length || 0,
      forecastPeriodDays: forecastDays,
    });

  } catch (err) {
    console.error('[Forecast] Unexpected error:', err);
    return NextResponse.json<ForecastResponse>(
      { success: false, forecast: [], totalBookings: 0, forecastPeriodDays: 0, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
