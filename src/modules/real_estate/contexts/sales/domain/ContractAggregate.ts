import { StateMachine, Transition, TransitionContext } from '@/platform/state-machine/state-machine';

export type ContractState = 'DRAFT' | 'PENDING_APPROVAL' | 'ACTIVE' | 'TERMINATED';
export type ContractEvent = 'SUBMIT' | 'ACTIVATE' | 'TERMINATE';

export interface Installment {
  readonly installmentNumber: number;
  readonly dueDate: Date;
  readonly percentage: number;
  readonly amount: number;
  readonly milestoneLabel: string;
}

export interface ContractProps {
  readonly id: string;
  readonly tenantId: string;
  readonly productId: string;
  readonly customerId: string;
  readonly contractPrice: number;
  state: ContractState;
  installments: Installment[];
}

export class ContractAggregate {
  private readonly fsm: StateMachine<ContractState, ContractEvent>;

  private static transitions: Transition<ContractState, ContractEvent>[] = [
    { from: 'DRAFT', event: 'SUBMIT', to: 'PENDING_APPROVAL' },
    { from: 'PENDING_APPROVAL', event: 'ACTIVATE', to: 'ACTIVE' },
    { from: ['DRAFT', 'PENDING_APPROVAL', 'ACTIVE'], event: 'TERMINATE', to: 'TERMINATED' },
  ];

  constructor(private readonly props: ContractProps) {
    if (!props.id) throw new Error('Contract ID is required');
    if (!props.tenantId) throw new Error('Tenant ID is required');
    if (!props.productId) throw new Error('Product ID is required');
    if (!props.customerId) throw new Error('Customer ID is required');
    if (props.contractPrice <= 0) throw new Error('Contract price must be greater than zero');

    this.fsm = new StateMachine<ContractState, ContractEvent>(props.state, ContractAggregate.transitions);
  }

  public get id(): string {
    return this.props.id;
  }

  public get tenantId(): string {
    return this.props.tenantId;
  }

  public get productId(): string {
    return this.props.productId;
  }

  public get customerId(): string {
    return this.props.customerId;
  }

  public get contractPrice(): number {
    return this.props.contractPrice;
  }

  public get state(): ContractState {
    return this.fsm.getState();
  }

  public get installments(): Installment[] {
    return [...this.props.installments];
  }

  public async transition(event: ContractEvent, context: TransitionContext): Promise<void> {
    const { newState } = await this.fsm.transition(event, context);
    this.props.state = newState;
  }

  /**
   * Helper to generate standardized dynamic monthly installment schedules
   */
  public generatePaymentSchedule(installmentsCount: number, startFrom: Date): void {
    if (installmentsCount <= 0) {
      throw new Error('Installments count must be greater than zero');
    }

    const schedule: Installment[] = [];
    const equalPercent = 100 / installmentsCount;
    const baseInstallmentAmount = Math.floor(this.contractPrice / installmentsCount);

    let remainingAmount = this.contractPrice;

    for (let i = 1; i <= installmentsCount; i++) {
      const dueDate = new Date(startFrom);
      dueDate.setMonth(startFrom.getMonth() + (i - 1));

      const isLast = i === installmentsCount;
      const amount = isLast ? remainingAmount : baseInstallmentAmount;
      remainingAmount -= amount;

      schedule.push({
        installmentNumber: i,
        dueDate,
        percentage: parseFloat(equalPercent.toFixed(2)),
        amount,
        milestoneLabel: `Đợt ${i} - Thanh toán định kỳ tháng ${i}`,
      });
    }

    this.props.installments = schedule;
  }
}
