import { StateMachine, Transition, TransitionContext } from '@/platform/state-machine/state-machine';

export type DepositState = 'DRAFT' | 'PAID' | 'CANCELLED';
export type DepositEvent = 'PAY' | 'CANCEL';

export interface DepositProps {
  readonly id: string;
  readonly tenantId: string;
  readonly productId: string;
  readonly customerId: string;
  readonly depositAmount: number;
  state: DepositState;
}

export class DepositAggregate {
  private readonly fsm: StateMachine<DepositState, DepositEvent>;

  private static transitions: Transition<DepositState, DepositEvent>[] = [
    { from: 'DRAFT', event: 'PAY', to: 'PAID' },
    { from: ['DRAFT', 'PAID'], event: 'CANCEL', to: 'CANCELLED' },
  ];

  constructor(private readonly props: DepositProps) {
    if (!props.id) throw new Error('Deposit ID is required');
    if (!props.tenantId) throw new Error('Tenant ID is required');
    if (!props.productId) throw new Error('Product ID is required');
    if (!props.customerId) throw new Error('Customer ID is required');
    if (props.depositAmount < 0) throw new Error('Deposit amount cannot be negative');

    this.fsm = new StateMachine<DepositState, DepositEvent>(props.state, DepositAggregate.transitions);
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

  public get depositAmount(): number {
    return this.props.depositAmount;
  }

  public get state(): DepositState {
    return this.fsm.getState();
  }

  public async transition(event: DepositEvent, context: TransitionContext): Promise<void> {
    const { newState } = await this.fsm.transition(event, context);
    this.props.state = newState;
  }
}
