import { StateMachine, Transition, TransitionContext } from '@/platform/state-machine/state-machine';

export type BookingState = 'DRAFT' | 'PENDING_APPROVAL' | 'CONFIRMED' | 'CANCELLED';
export type BookingEvent = 'SUBMIT' | 'CONFIRM' | 'CANCEL';

export interface BookingProps {
  readonly id: string;
  readonly tenantId: string;
  readonly productId: string;
  readonly customerId: string;
  readonly bookingFee: number;
  state: BookingState;
}

export class BookingAggregate {
  private readonly fsm: StateMachine<BookingState, BookingEvent>;

  private static transitions: Transition<BookingState, BookingEvent>[] = [
    { from: 'DRAFT', event: 'SUBMIT', to: 'PENDING_APPROVAL' },
    { from: 'PENDING_APPROVAL', event: 'CONFIRM', to: 'CONFIRMED' },
    { from: ['DRAFT', 'PENDING_APPROVAL', 'CONFIRMED'], event: 'CANCEL', to: 'CANCELLED' },
  ];

  constructor(private readonly props: BookingProps) {
    if (!props.id) throw new Error('Booking ID is required');
    if (!props.tenantId) throw new Error('Tenant ID is required');
    if (!props.productId) throw new Error('Product ID is required');
    if (!props.customerId) throw new Error('Customer ID is required');
    if (props.bookingFee < 0) throw new Error('Booking fee cannot be negative');

    this.fsm = new StateMachine<BookingState, BookingEvent>(props.state, BookingAggregate.transitions);
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

  public get bookingFee(): number {
    return this.props.bookingFee;
  }

  public get state(): BookingState {
    return this.fsm.getState();
  }

  public async transition(event: BookingEvent, context: TransitionContext): Promise<void> {
    const { newState } = await this.fsm.transition(event, context);
    this.props.state = newState;
  }
}
