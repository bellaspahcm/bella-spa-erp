import type { SupabaseClient } from '@supabase/supabase-js';

import { enqueueWithAutoClient } from '@/lib/accounting-outbox';
import type { Database } from '@/types/database.types';

import type { BeautySpaSessionFinanceOutboxPort } from './service';

type CompletedSessionFinanceInput = Parameters<BeautySpaSessionFinanceOutboxPort['enqueueCompletedSession']>[0];

export class BeautySpaAccountingOutboxPort implements BeautySpaSessionFinanceOutboxPort {
  public constructor(private readonly supabase: SupabaseClient<Database>) {}

  public async enqueueCompletedSession(input: CompletedSessionFinanceInput): Promise<void> {
    const earnedRevenueAmount = input.financeHandoff.earnedRevenueAmount;
    const deferredRevenueAmount = input.financeHandoff.deferredRevenueAmount ?? 0;
    const receivableAmount = input.financeHandoff.receivableAmount ?? Math.max(0, earnedRevenueAmount - deferredRevenueAmount);
    const commissionAmount = input.financeHandoff.commissionAmount ?? 0;
    const description = input.financeHandoff.description
      ?? `Beauty V2 completed service ${input.appointment.serviceId}`;
    const performerId = input.completedSession.actualPerformerId ?? input.performerId;

    const enqueued = await enqueueWithAutoClient(
      this.supabase,
      {
        tenantId: input.completedSession.tenantId,
        eventType: 'SESSION_DONE',
        referenceType: 'BEAUTY_SESSION',
        referenceId: input.completedSession.id,
        payload: {
          sourceSystem: 'BEAUTY_V2',
          businessSourceType: 'BEAUTY_SESSION_DONE',
          appointmentId: input.appointment.id,
          customerId: input.appointment.customerId,
          serviceId: input.appointment.serviceId,
          branchId: input.appointment.branchId,
          ktvId: performerId,
          performerId,
          earnedRevenueAmount,
          deferredRevenueAmount,
          receivableAmount,
          commissionAmount,
          description,
        },
      },
      '[BeautySpaV2Finance]',
    );

    if (!enqueued) {
      throw new Error(`Failed to enqueue Beauty SESSION_DONE accounting event for session ${input.completedSession.id}.`);
    }
  }
}
