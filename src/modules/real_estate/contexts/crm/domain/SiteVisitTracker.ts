import { StateMachine, Transition, TransitionContext } from '@/platform/state-machine/state-machine';

export type VisitStatus = 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
export type VisitEvent = 'COMPLETE' | 'CANCEL' | 'RECORD_NO_SHOW';

export interface SiteVisitProps {
  readonly id: string;
  readonly tenantId: string;
  readonly leadId: string;
  readonly visitDate: Date;
  status: VisitStatus;
  feedback?: string;
}

export class SiteVisitTracker {
  private readonly fsm: StateMachine<VisitStatus, VisitEvent>;

  private static transitions: Transition<VisitStatus, VisitEvent>[] = [
    { from: 'SCHEDULED', event: 'COMPLETE', to: 'COMPLETED' },
    { from: 'SCHEDULED', event: 'CANCEL', to: 'CANCELLED' },
    { from: 'SCHEDULED', event: 'RECORD_NO_SHOW', to: 'NO_SHOW' },
  ];

  constructor(private readonly props: SiteVisitProps) {
    if (!props.id) throw new Error('Site visit ID is required');
    if (!props.tenantId) throw new Error('Tenant ID is required');
    if (!props.leadId) throw new Error('Lead ID is required');
    if (!props.visitDate) throw new Error('Visit date is required');

    this.fsm = new StateMachine<VisitStatus, VisitEvent>(props.status, SiteVisitTracker.transitions);
  }

  public get id(): string {
    return this.props.id;
  }

  public get tenantId(): string {
    return this.props.tenantId;
  }

  public get leadId(): string {
    return this.props.leadId;
  }

  public get visitDate(): Date {
    return this.props.visitDate;
  }

  public get status(): VisitStatus {
    return this.fsm.getState();
  }

  public get feedback(): string | undefined {
    return this.props.feedback;
  }

  public async transition(event: VisitEvent, context: TransitionContext): Promise<void> {
    const { newState } = await this.fsm.transition(event, context);
    this.props.status = newState;

    if (event === 'COMPLETE' && context.payload?.feedback) {
      this.props.feedback = context.payload.feedback as string;
    }
  }
}
