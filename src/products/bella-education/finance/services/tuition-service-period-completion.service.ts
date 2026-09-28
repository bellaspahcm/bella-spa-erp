import { PreschoolFinanceRepository } from '../repositories/preschool-finance.repository';
import type { BillingPeriod, TuitionServicePeriodCompletion } from '../domain/finance.types';

export interface TuitionServicePeriodCompletionRepository {
  getBillingPeriodById(tenantId: string, billingPeriodId: string): Promise<BillingPeriod | null>;
  getTuitionServicePeriodCompletion(
    tenantId: string,
    billingPeriodId: string,
  ): Promise<TuitionServicePeriodCompletion | null>;
  createTuitionServicePeriodCompletion(
    data: Omit<TuitionServicePeriodCompletion, 'id' | 'createdAt'>,
  ): Promise<TuitionServicePeriodCompletion>;
}

export interface CompleteTuitionServicePeriodInput {
  readonly tenantId: string;
  readonly billingPeriodId: string;
  readonly completedBy: string;
  readonly completedAt?: string;
}

export interface CompleteTuitionServicePeriodResult {
  readonly completion: TuitionServicePeriodCompletion;
  readonly alreadyCompleted: boolean;
}

export class TuitionServicePeriodCompletionService {
  constructor(
    private readonly repo: TuitionServicePeriodCompletionRepository = new PreschoolFinanceRepository(),
    private readonly now: () => Date = () => new Date(),
  ) {}

  async completePeriod(
    input: CompleteTuitionServicePeriodInput,
  ): Promise<CompleteTuitionServicePeriodResult> {
    const billingPeriod = await this.repo.getBillingPeriodById(input.tenantId, input.billingPeriodId);
    if (!billingPeriod) {
      throw new Error(`PRESCHOOL_TUITION_SERVICE_PERIOD_NOT_FOUND: Billing period ${input.billingPeriodId} not found in tenant.`);
    }
    if (billingPeriod.status !== 'ACTIVE') {
      throw new Error(`PRESCHOOL_TUITION_SERVICE_PERIOD_NOT_ACTIVE: Billing period ${input.billingPeriodId} is not ACTIVE.`);
    }

    const existing = await this.repo.getTuitionServicePeriodCompletion(input.tenantId, input.billingPeriodId);
    if (existing) {
      return {
        completion: existing,
        alreadyCompleted: true,
      };
    }

    const completion = await this.repo.createTuitionServicePeriodCompletion({
      tenantId: input.tenantId,
      billingPeriodId: input.billingPeriodId,
      completedAt: input.completedAt ?? this.now().toISOString(),
      completedBy: input.completedBy,
    });

    return {
      completion,
      alreadyCompleted: false,
    };
  }
}
