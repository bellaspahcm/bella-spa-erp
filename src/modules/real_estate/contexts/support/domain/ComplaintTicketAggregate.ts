import { StateMachine, Transition, TransitionContext } from '@/platform/state-machine/state-machine';

export type TicketState =
  | 'NEW'
  | 'ASSIGNED'
  | 'INVESTIGATING'
  | 'RESOLVED'
  | 'CLOSED'
  | 'REOPENED'
  | 'CANCELLED';

export type TicketEvent =
  | 'ASSIGN'
  | 'INVESTIGATE'
  | 'RESOLVE'
  | 'CLOSE'
  | 'REOPEN'
  | 'CANCEL';

export type TicketPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type TicketCategory = 'SERVICE_QUALITY' | 'BILLING' | 'TECHNICAL' | 'GENERAL';

export interface ComplaintTicketProps {
  readonly id: string;
  readonly tenantId: string;
  readonly ticketNumber: string;
  readonly customerId: string;
  readonly customerName: string;
  readonly subject: string;
  readonly description: string;
  readonly priority: TicketPriority;
  readonly category: TicketCategory;
  state: TicketState;
  assignedAgentId?: string;
  assignedAgentName?: string;
  resolutionNotes?: string;
  readonly createdAt: string;
  updatedAt: string;
}

export class ComplaintTicketAggregate {
  private readonly fsm: StateMachine<TicketState, TicketEvent>;

  private static transitions: Transition<TicketState, TicketEvent>[] = [
    { from: 'NEW', event: 'ASSIGN', to: 'ASSIGNED' },
    { from: 'REOPENED', event: 'ASSIGN', to: 'ASSIGNED' },
    { from: 'ASSIGNED', event: 'INVESTIGATE', to: 'INVESTIGATING' },
    { from: 'INVESTIGATING', event: 'RESOLVE', to: 'RESOLVED' },
    { from: 'RESOLVED', event: 'CLOSE', to: 'CLOSED' },
    { from: 'CLOSED', event: 'REOPEN', to: 'REOPENED' },
    { from: 'RESOLVED', event: 'REOPEN', to: 'REOPENED' },
    {
      from: ['NEW', 'ASSIGNED', 'INVESTIGATING'],
      event: 'CANCEL',
      to: 'CANCELLED',
    },
  ];

  constructor(private readonly props: ComplaintTicketProps) {
    if (!props.id) throw new Error('Ticket ID is required');
    if (!props.tenantId) throw new Error('Tenant ID is required');
    if (!props.ticketNumber) throw new Error('Ticket number is required');
    if (!props.customerId) throw new Error('Customer ID is required');

    this.fsm = new StateMachine<TicketState, TicketEvent>(props.state, ComplaintTicketAggregate.transitions, {
      resourceType: 'complaint_ticket',
      resourceId: props.id,
    });
  }

  public get id(): string {
    return this.props.id;
  }

  public get tenantId(): string {
    return this.props.tenantId;
  }

  public get ticketNumber(): string {
    return this.props.ticketNumber;
  }

  public get customerId(): string {
    return this.props.customerId;
  }

  public get customerName(): string {
    return this.props.customerName;
  }

  public get subject(): string {
    return this.props.subject;
  }

  public get description(): string {
    return this.props.description;
  }

  public get priority(): TicketPriority {
    return this.props.priority;
  }

  public get category(): TicketCategory {
    return this.props.category;
  }

  public get state(): TicketState {
    return this.fsm.getState();
  }

  public get assignedAgentId(): string | undefined {
    return this.props.assignedAgentId;
  }

  public get assignedAgentName(): string | undefined {
    return this.props.assignedAgentName;
  }

  public get resolutionNotes(): string | undefined {
    return this.props.resolutionNotes;
  }

  public get createdAt(): string {
    return this.props.createdAt;
  }

  public get updatedAt(): string {
    return this.props.updatedAt;
  }

  /**
   * Transition the complaint ticket state using platform FSM
   */
  public async transition(event: TicketEvent, context: TransitionContext): Promise<void> {
    const { newState } = await this.fsm.transition(event, context);
    this.props.state = newState;
    this.props.updatedAt = new Date().toISOString();

    if (event === 'ASSIGN' && context.payload?.assignedAgentId) {
      this.props.assignedAgentId = context.payload.assignedAgentId as string;
      this.props.assignedAgentName = (context.payload.assignedAgentName as string) ?? 'Support Agent';
    }

    if (event === 'RESOLVE' && context.payload?.resolutionNotes) {
      this.props.resolutionNotes = context.payload.resolutionNotes as string;
    }
  }
}
