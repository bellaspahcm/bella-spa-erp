/**
 * GET /api/bella-auto/transactions
 * List transactions with filtering
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPrimaryClient } from '@/lib/database/read-replica';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const supabase = getPrimaryClient();
    const { searchParams } = new URL(request.url);
    
    const entityType = searchParams.get('entity_type');
    const entityId = searchParams.get('entity_id');
    const status = searchParams.get('status');
    const type = searchParams.get('type');
    const limit = parseInt(searchParams.get('limit') || '50');

    let query = supabase
      .from('auto_business_transactions')
      .select(`
        *,
        steps:auto_transaction_steps(count)
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (entityType && entityId) {
      query = query
        .eq('entity_type', entityType)
        .eq('entity_id', entityId);
    }

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    if (type && type !== 'all') {
      query = query.eq('transaction_type', type);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Failed to fetch transactions:', error);
      return NextResponse.json(
        { error: 'Failed to fetch transactions', details: error.message },
        { status: 500 }
      );
    }

    // Transform to include step count
    const transactions = data.map((tx: any) => ({
      id: tx.id,
      transactionType: tx.transaction_type,
      status: tx.status,
      entityType: tx.entity_type,
      entityId: tx.entity_id,
      createdAt: tx.created_at,
      createdBy: tx.metadata?.created_by_email,
      rollbackReason: tx.rollback_reason,
      rolledBackAt: tx.rolled_back_at,
      rolledBackBy: tx.metadata?.rolled_back_by_email,
      stepCount: tx.steps?.[0]?.count || 0,
    }));

    return NextResponse.json({ transactions });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
