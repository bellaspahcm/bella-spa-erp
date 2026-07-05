/**
 * Decision Engine Audit API
 * 
 * Returns audit trail for Decision Engine decisions.
 * Consumed by BI Dashboard, debugging, and compliance systems.
 * 
 * GET /api/decision/audit?decisionId=...&decisionType=...&tenantId=...
 * 
 * @module API/Decision/Audit
 */

import { NextRequest, NextResponse } from 'next/server';
import { auditTrail, type AuditQuery } from '@/lib/decision-engine/observability';

export const dynamic = 'force-dynamic';

/**
 * GET /api/decision/audit
 * 
 * Query parameters:
 * - decisionId: Filter by decision ID (optional)
 * - decisionType: Filter by decision type (optional)
 * - tenantId: Filter by tenant ID (optional)
 * - userId: Filter by user ID (optional)
 * - startTime: ISO timestamp (optional)
 * - endTime: ISO timestamp (optional)
 * - approved: Filter by approval status (optional, boolean)
 * - requiresManualReview: Filter by manual review requirement (optional, boolean)
 * - failed: Filter by error status (optional, boolean)
 * - limit: Limit results (optional, default: 100)
 * - offset: Offset for pagination (optional, default: 0)
 * 
 * Returns:
 * - records: Array of audit records
 * - stats: Statistics about audit trail
 * 
 * @example
 * ```typescript
 * // Get specific decision
 * const response = await fetch('/api/decision/audit?decisionId=dec-123');
 * const { records } = await response.json();
 * 
 * // Get all failed decisions
 * const response = await fetch('/api/decision/audit?failed=true');
 * 
 * // Get decisions requiring manual review
 * const response = await fetch('/api/decision/audit?requiresManualReview=true&tenantId=tenant-123');
 * 
 * // Paginate through audit trail
 * const response = await fetch('/api/decision/audit?limit=50&offset=100');
 * ```
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    // Parse query parameters
    const decisionId = searchParams.get('decisionId') || undefined;
    const decisionType = searchParams.get('decisionType') || undefined;
    const tenantId = searchParams.get('tenantId') || undefined;
    const userId = searchParams.get('userId') || undefined;

    const startTime = searchParams.get('startTime')
      ? new Date(searchParams.get('startTime')!)
      : undefined;

    const endTime = searchParams.get('endTime')
      ? new Date(searchParams.get('endTime')!)
      : undefined;

    const approved = searchParams.get('approved')
      ? searchParams.get('approved') === 'true'
      : undefined;

    const requiresManualReview = searchParams.get('requiresManualReview')
      ? searchParams.get('requiresManualReview') === 'true'
      : undefined;

    const failed = searchParams.get('failed')
      ? searchParams.get('failed') === 'true'
      : undefined;

    const limit = searchParams.get('limit')
      ? parseInt(searchParams.get('limit')!, 10)
      : 100;

    const offset = searchParams.get('offset')
      ? parseInt(searchParams.get('offset')!, 10)
      : 0;

    const query: AuditQuery = {
      decisionId,
      decisionType,
      tenantId,
      userId,
      startTime,
      endTime,
      approved,
      requiresManualReview,
      failed,
      limit,
      offset,
    };

    // Get audit records
    const records = auditTrail.query(query);

    // Get audit trail stats
    const stats = auditTrail.getStats();

    return NextResponse.json({
      success: true,
      query: {
        ...query,
        startTime: startTime?.toISOString(),
        endTime: endTime?.toISOString(),
      },
      records,
      stats,
      meta: {
        totalRecordsInMemory: auditTrail.count(),
        recordsReturned: records.length,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[Decision Audit API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/decision/audit/export
 * 
 * Export audit records as JSON file.
 * 
 * Body:
 * - Same as GET query parameters
 * 
 * Returns:
 * - JSON file download
 * 
 * @example
 * ```typescript
 * const response = await fetch('/api/decision/audit/export', {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify({
 *     tenantId: 'tenant-123',
 *     startTime: '2026-06-01T00:00:00Z',
 *     endTime: '2026-06-30T23:59:59Z',
 *   }),
 * });
 * 
 * const blob = await response.blob();
 * const url = window.URL.createObjectURL(blob);
 * const a = document.createElement('a');
 * a.href = url;
 * a.download = 'audit-trail.json';
 * a.click();
 * ```
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const query: AuditQuery = {
      decisionId: body.decisionId,
      decisionType: body.decisionType,
      tenantId: body.tenantId,
      userId: body.userId,
      startTime: body.startTime ? new Date(body.startTime) : undefined,
      endTime: body.endTime ? new Date(body.endTime) : undefined,
      approved: body.approved,
      requiresManualReview: body.requiresManualReview,
      failed: body.failed,
      limit: body.limit,
      offset: body.offset,
    };

    // Export as JSON
    const json = auditTrail.exportJSON(query);

    return new NextResponse(json, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="decision-audit-${Date.now()}.json"`,
      },
    });
  } catch (error) {
    console.error('[Decision Audit Export API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
