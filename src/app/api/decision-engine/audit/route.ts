/**
 * Decision Engine Audit Trail API (Sprint 1)
 * 
 * Query decision_audit_log table for audit trail, compliance, and analysis.
 * Supports filtering, pagination, and search.
 * 
 * GET /api/decision-engine/audit
 * 
 * @module API/DecisionEngine/Audit
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/types/supabase';

export const dynamic = 'force-dynamic';

/**
 * GET /api/decision-engine/audit
 * 
 * Query parameters:
 * - tenantId: Filter by tenant (required for non-super-admins)
 * - decisionType: Filter by type (payroll, booking, etc.) (optional)
 * - provider: Filter by provider (optional)
 * - status: Filter by status (success, error, warning) (optional)
 * - dateFrom: ISO timestamp start (optional)
 * - dateTo: ISO timestamp end (optional)
 * - search: Search in decision_id (optional)
 * - page: Page number (default: 1)
 * - limit: Results per page (default: 25, max: 100)
 * 
 * Returns:
 * - data: Array of audit log entries
 * - pagination: { page, limit, total, totalPages, hasMore }
 * 
 * @example
 * ```typescript
 * // Get all decisions for tenant
 * fetch('/api/decision-engine/audit?tenantId=xxx&page=1&limit=25')
 * 
 * // Filter by decision type
 * fetch('/api/decision-engine/audit?tenantId=xxx&decisionType=payroll')
 * 
 * // Filter by status
 * fetch('/api/decision-engine/audit?tenantId=xxx&status=error')
 * 
 * // Date range filter
 * fetch('/api/decision-engine/audit?tenantId=xxx&dateFrom=2026-06-01&dateTo=2026-06-30')
 * 
 * // Search by decision ID
 * fetch('/api/decision-engine/audit?tenantId=xxx&search=decision-123')
 * ```
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const searchParams = request.nextUrl.searchParams;

    // Auth check
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse query parameters
    const tenantId = searchParams.get('tenantId');
    const decisionType = searchParams.get('decisionType');
    const provider = searchParams.get('provider');
    const status = searchParams.get('status');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(
      parseInt(searchParams.get('limit') || '25', 10),
      100
    );

    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: 'tenantId is required' },
        { status: 400 }
      );
    }

    // Build query
    let query = supabase
      .from('decision_audit_log')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    // Apply filters
    if (decisionType) {
      query = query.eq('decision_type', decisionType);
    }

    if (provider) {
      query = query.eq('provider', provider);
    }

    if (status) {
      query = query.eq('status', status);
    }

    if (dateFrom) {
      query = query.gte('created_at', dateFrom);
    }

    if (dateTo) {
      query = query.lte('created_at', dateTo);
    }

    if (search) {
      query = query.ilike('decision_id', `%${search}%`);
    }

    // Pagination
    const offset = (page - 1) * limit;
    query = query.range(offset, offset + limit - 1);

    // Execute query
    const { data, error, count } = await query;

    if (error) {
      console.error('[Decision Audit API] Database error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    // Build pagination metadata
    const total = count || 0;
    const totalPages = Math.ceil(total / limit);
    const hasMore = page < totalPages;

    return NextResponse.json({
      success: true,
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore,
      },
      filters: {
        tenantId,
        decisionType,
        provider,
        status,
        dateFrom,
        dateTo,
        search,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Decision Audit API] Unexpected error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
