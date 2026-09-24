/**
 * GET /api/bella-auto/transactions/[id]
 * Get transaction detail with all steps
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPrimaryClient } from '@/lib/database/read-replica';
import type { Database, Json } from '@/types/database.types';

export const runtime = 'nodejs';

type TransactionStep = Database['public']['Tables']['auto_transaction_steps']['Row'];

function getMetadataString(metadata: Json | null, key: string): string | undefined {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return undefined;
  }

  const value = metadata[key];
  return typeof value === 'string' ? value : undefined;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = getPrimaryClient();
    const { id } = params;

    // Fetch transaction with all steps
    const { data: transaction, error: txError } = await supabase
      .from('auto_business_transactions')
      .select('*')
      .eq('id', id)
      .single();

    if (txError) {
      console.error('Failed to fetch transaction:', txError);
      return NextResponse.json(
        { error: 'Transaction not found', details: txError.message },
        { status: 404 }
      );
    }

    // Fetch all steps
    const { data: steps, error: stepsError } = await supabase
      .from('auto_transaction_steps')
      .select('*')
      .eq('transaction_id', id)
      .order('sequence', { ascending: true });

    if (stepsError) {
      console.error('Failed to fetch steps:', stepsError);
      return NextResponse.json(
        { error: 'Failed to fetch steps', details: stepsError.message },
        { status: 500 }
      );
    }

    // Transform response
    const detail = {
      id: transaction.id,
      transactionType: transaction.transaction_type,
      status: transaction.status,
      entityType: transaction.entity_type,
      entityId: transaction.entity_id,
      createdAt: transaction.created_at,
      createdBy: getMetadataString(transaction.metadata, 'created_by_email'),
      rollbackReason: transaction.rollback_reason,
      rolledBackAt: transaction.rolled_back_at,
      rolledBackBy: getMetadataString(transaction.metadata, 'rolled_back_by_email'),
      metadata: transaction.metadata,
      steps: (steps ?? []).map((step: TransactionStep) => ({
        id: step.id,
        stepOrder: step.sequence,
        actionType: step.action,
        targetTable: step.entity_type,
        targetRecordId: step.entity_id,
        beforeSnapshot: step.snapshot_before,
        afterSnapshot: step.snapshot_after,
        status: step.status,
        executedAt: step.executed_at,
        errorMessage: step.error_message,
      })),
    };

    return NextResponse.json({ transaction: detail });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
