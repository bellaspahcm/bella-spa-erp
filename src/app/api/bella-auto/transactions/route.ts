/**
 * GET /api/bella-auto/transactions
 * List transactions with filtering
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPrimaryClient } from '@/lib/database/read-replica';
import type { Database, Json } from '@/types/database.types';

export const runtime = 'nodejs';

type BusinessTransactionStatus = Database['public']['Enums']['auto_business_transaction_status'];
type BusinessTransactionType = Database['public']['Enums']['auto_business_transaction_type'];

const BUSINESS_TRANSACTION_STATUSES: readonly BusinessTransactionStatus[] = [
  'pending',
  'committed',
  'rolled_back',
  'failed',
];

const BUSINESS_TRANSACTION_TYPES: readonly BusinessTransactionType[] = [
  'vehicle_delivery',
  'service_complete',
  'trade_in_approval',
  'loan_disbursement',
  'deposit_payment',
  'quotation_approval',
  'test_drive_complete',
  'warranty_claim_approval',
];

const BUSINESS_TRANSACTION_STATUS_SET: ReadonlySet<string> = new Set(BUSINESS_TRANSACTION_STATUSES);
const BUSINESS_TRANSACTION_TYPE_SET: ReadonlySet<string> = new Set(BUSINESS_TRANSACTION_TYPES);

function isBusinessTransactionStatus(value: string): value is BusinessTransactionStatus {
  return BUSINESS_TRANSACTION_STATUS_SET.has(value);
}

function isBusinessTransactionType(value: string): value is BusinessTransactionType {
  return BUSINESS_TRANSACTION_TYPE_SET.has(value);
}

function getMetadataString(metadata: Json | null, key: string): string | undefined {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return undefined;
  }

  const value = metadata[key];
  return typeof value === 'string' ? value : undefined;
}

function getStepCount(value: object): number {
  if (!('steps' in value)) {
    return 0;
  }

  const steps = value.steps;
  if (!Array.isArray(steps)) {
    return 0;
  }

  const firstStep = steps[0];
  if (!firstStep || typeof firstStep !== 'object' || !('count' in firstStep)) {
    return 0;
  }

  return typeof firstStep.count === 'number' ? firstStep.count : 0;
}

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
      if (!isBusinessTransactionStatus(status)) {
        return NextResponse.json(
          { error: `Invalid transaction status: ${status}` },
          { status: 400 }
        );
      }
      query = query.eq('status', status);
    }

    if (type && type !== 'all') {
      if (!isBusinessTransactionType(type)) {
        return NextResponse.json(
          { error: `Invalid transaction type: ${type}` },
          { status: 400 }
        );
      }
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
    const transactions = (data ?? []).map((tx) => ({
      id: tx.id,
      transactionType: tx.transaction_type,
      status: tx.status,
      entityType: tx.entity_type,
      entityId: tx.entity_id,
      createdAt: tx.created_at,
      createdBy: getMetadataString(tx.metadata, 'created_by_email'),
      rollbackReason: tx.rollback_reason,
      rolledBackAt: tx.rolled_back_at,
      rolledBackBy: getMetadataString(tx.metadata, 'rolled_back_by_email'),
      stepCount: getStepCount(tx),
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
