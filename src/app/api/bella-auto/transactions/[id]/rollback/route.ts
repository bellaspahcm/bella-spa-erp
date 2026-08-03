/**
 * POST /api/bella-auto/transactions/[id]/rollback
 * Execute business rollback
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPrimaryClient } from '@/lib/database/read-replica';
import { BusinessRollbackEngine } from '../../../../../../lib/bella-auto/engines/BusinessRollbackEngine';

export const runtime = 'nodejs';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = getPrimaryClient();
    const { id } = params;
    const body = await request.json();
    const { reason, userId, userEmail } = body;

    // Validate inputs
    if (!reason || reason.trim().length < 10) {
      return NextResponse.json(
        { error: 'Rollback reason must be at least 10 characters' },
        { status: 400 }
      );
    }

    if (!userId || !userEmail) {
      return NextResponse.json(
        { error: 'User authentication required' },
        { status: 401 }
      );
    }

    // Fetch transaction to check status
    const { data: transaction, error: txError } = await supabase
      .from('auto_business_transactions')
      .select('*')
      .eq('id', id)
      .single();

    if (txError || !transaction) {
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      );
    }

    // Check if already rolled back
    if (transaction.status === 'rolled_back') {
      return NextResponse.json(
        { error: 'Transaction already rolled back' },
        { status: 400 }
      );
    }

    // Check if rollback is allowed
    if (transaction.status !== 'completed') {
      return NextResponse.json(
        { error: 'Only completed transactions can be rolled back' },
        { status: 400 }
      );
    }

    // Execute rollback using BusinessRollbackEngine
    const rollbackEngine = new BusinessRollbackEngine(supabase);
    
    const result = await rollbackEngine.executeRollback({
      transactionId: id,
      reason,
      executedBy: userId,
      executedByEmail: userEmail,
    });

    if (!result.success) {
      console.error('Rollback failed:', result.error);
      return NextResponse.json(
        { 
          error: 'Rollback execution failed', 
          details: result.error,
          partialSteps: result.completedSteps,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Transaction rolled back successfully',
      transactionId: id,
      stepsRolledBack: result.stepsRolledBack,
      completedAt: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Unexpected error during rollback:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
