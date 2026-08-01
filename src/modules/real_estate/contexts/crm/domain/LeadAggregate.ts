import { StateMachine, Transition, TransitionContext } from '@/platform/state-machine/state-machine';

export type LeadState =
  | 'NEW'
  | 'ASSIGNED'
  | 'CONTACTED'
  | 'QUALIFIED'
  | 'VISIT_SCHEDULED'
  | 'NEGOTIATING'
  | 'CONVERTED'
  | 'LOST';

export type LeadEvent =
  | 'ASSIGN'
  | 'CONTACT'
  | 'QUALIFY'
  | 'SCHEDULE_VISIT'
  | 'NEGOTIATE'
  | 'CONVERT'
  | 'LOSE';

export interface LeadProps {
  readonly id: string;
  readonly tenantId: string;
  readonly name: string;
  readonly phone: string;
  state: LeadState;
  assignedTo?: string;
  lostReason?: string;
}

export class LeadAggregate {
  private readonly fsm: StateMachine<LeadState, LeadEvent>;

  private static transitions: Transition<LeadState, LeadEvent>[] = [
    { from: 'NEW', event: 'ASSIGN', to: 'ASSIGNED' },
    { from: 'ASSIGNED', event: 'CONTACT', to: 'CONTACTED' },
    { from: 'CONTACTED', event: 'QUALIFY', to: 'QUALIFIED' },
    { from: 'QUALIFIED', event: 'SCHEDULE_VISIT', to: 'VISIT_SCHEDULED' },
    { from: 'VISIT_SCHEDULED', event: 'NEGOTIATE', to: 'NEGOTIATING' },
    { from: 'NEGOTIATING', event: 'CONVERT', to: 'CONVERTED' },
    {
      from: ['NEW', 'ASSIGNED', 'CONTACTED', 'QUALIFIED', 'VISIT_SCHEDULED', 'NEGOTIATING'],
      event: 'LOSE',
      to: 'LOST',
    },
  ];

  constructor(private readonly props: LeadProps) {
    if (!props.id) throw new Error('Lead ID is required');
    if (!props.tenantId) throw new Error('Tenant ID is required');
    if (!props.name) throw new Error('Lead name is required');
    if (!props.phone) throw new Error('Lead phone is required');

    this.fsm = new StateMachine<LeadState, LeadEvent>(props.state, LeadAggregate.transitions);
  }

  public get id(): string {
    return this.props.id;
  }

  public get tenantId(): string {
    return this.props.tenantId;
  }

  public get name(): string {
    return this.props.name;
  }

  public get phone(): string {
    return this.props.phone;
  }

  public get state(): LeadState {
    return this.fsm.getState();
  }

  public get assignedTo(): string | undefined {
    return this.props.assignedTo;
  }

  public get lostReason(): string | undefined {
    return this.props.lostReason;
  }

  public async transition(event: LeadEvent, context: TransitionContext): Promise<void> {
    const { newState } = await this.fsm.transition(event, context);
    this.props.state = newState;

    if (event === 'ASSIGN' && context.payload?.assignedTo) {
      this.props.assignedTo = context.payload.assignedTo as string;
    }
    if (event === 'LOSE' && context.payload?.lostReason) {
      this.props.lostReason = context.payload.lostReason as string;
    }
  }
}
