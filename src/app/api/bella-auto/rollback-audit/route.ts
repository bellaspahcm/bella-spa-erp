/**
 * GET /api/bella-auto/rollback-audit
 * Get rollback audit logs for dashboard
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPrimaryClient } from '@/lib/database/read-replica';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const supabase = getPrimaryClient();
    const { searchParams } = new URL(request.url);
    
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const limit = parseInt(searchParams.get('limit') || '100');

    let query = supabase
      .from('auto_rollback_audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (startDate) {
      query = query.gte('created_at', startDate);
    }

    if (endDate) {
      query = query.lte('created_at', endDate);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Failed to fetch audit logs:', error);
      return NextResponse.json(
        { error: 'Failed to fetch audit logs', details: error.message },
        { status: 500 }
      );
    }

    // Calculate statistics
    const stats = {
      totalRollbacks: data.length,
      successRate: data.filter(log => log.status === 'success').length / (data.length || 1) * 100,
      failedCount: data.filter(log => log.status === 'failed').length,
      byTransactionType: data.reduce((acc: Record<string, number>, log: any) => {
        const type = log.transaction_type || 'unknown';
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {}),
      recentActivity: data.slice(0, 10).map((log: any) => ({
        id: log.id,
        transactionId: log.transaction_id,
        transactionType: log.transaction_type,
        status: log.status,
        reason: log.rollback_reason,
        executedBy: log.metadata?.executed_by_email,
        executedAt: log.created_at,
        stepsRolledBack: log.steps_rolled_back,
        errorMessage: log.error_message,
      })),
    };

    return NextResponse.json({ 
      stats,
      logs: data.map((log: any) => ({
        id: log.id,
        transactionId: log.transaction_id,
        transactionType: log.transaction_type,
        entityType: log.entity_type,
        entityId: log.entity_id,
        status: log.status,
        reason: log.rollback_reason,
        executedBy: log.metadata?.executed_by_email,
        executedAt: log.created_at,
        stepsRolledBack: log.steps_rolled_back,
        errorMessage: log.error_message,
      })),
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
