/**
 * GET /api/bella-auto/rules/analytics - Rule execution analytics
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

    // Get execution logs
    let logsQuery = supabase
      .from('auto_rule_execution_log')
      .select('*')
      .order('executed_at', { ascending: false })
      .limit(1000);

    if (startDate) logsQuery = logsQuery.gte('executed_at', startDate);
    if (endDate) logsQuery = logsQuery.lte('executed_at', endDate);

    const { data: logs, error: logsError } = await logsQuery;

    if (logsError) {
      return NextResponse.json(
        { error: 'Failed to fetch analytics' },
        { status: 500 }
      );
    }

    // Calculate stats
    const totalExecutions = logs.length;
    const successCount = logs.filter((l: any) => l.status === 'success').length;
    const failedCount = logs.filter((l: any) => l.status === 'failed').length;
    
    const byRule = logs.reduce((acc: any, log: any) => {
      const ruleId = log.rule_id;
      if (!acc[ruleId]) {
        acc[ruleId] = { total: 0, success: 0, failed: 0, avgTime: 0, times: [] };
      }
      acc[ruleId].total++;
      if (log.status === 'success') acc[ruleId].success++;
      if (log.status === 'failed') acc[ruleId].failed++;
      if (log.execution_time_ms) acc[ruleId].times.push(log.execution_time_ms);
      return acc;
    }, {});

    // Calculate avg execution time per rule
    Object.keys(byRule).forEach((ruleId) => {
      const times = byRule[ruleId].times;
      if (times.length > 0) {
        byRule[ruleId].avgTime = times.reduce((a: number, b: number) => a + b, 0) / times.length;
      }
    });

    const stats = {
      totalExecutions,
      successRate: totalExecutions > 0 ? (successCount / totalExecutions) * 100 : 0,
      failedCount,
      byRule,
      recentExecutions: logs.slice(0, 20).map((log: any) => ({
        id: log.id,
        ruleId: log.rule_id,
        entityType: log.entity_type,
        entityId: log.entity_id,
        status: log.status,
        executionTime: log.execution_time_ms,
        executedAt: log.executed_at,
        errorMessage: log.error_message,
      })),
    };

    return NextResponse.json({ analytics: stats });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
