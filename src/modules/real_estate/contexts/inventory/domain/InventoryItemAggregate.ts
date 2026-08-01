import { StateMachine, Transition, TransitionContext } from '@/platform/state-machine/state-machine';
import { DomainEvent } from '../../shared/domain-event-bus/DomainEvent';

export type InventoryState =
  | 'OFF_MARKET'
  | 'AVAILABLE'
  | 'HELD'
  | 'BOOKED'
  | 'RESERVED'
  | 'DEPOSITED'
  | 'CONTRACT_SIGNED'
  | 'LOCKED'
  | 'BLOCKED'
  | 'TRANSFERRED'
  | 'HANDED_OVER'
  | 'CANCELLED'
  | 'RETURNED';

export type InventoryEvent =
  | 'ACTIVATE'
  | 'DEACTIVATE'
  | 'HOLD'
  | 'RELEASE'
  | 'BOOK'
  | 'APPROVE_BOOKING'
  | 'DEPOSIT'
  | 'SIGN_CONTRACT'
  | 'LOCK'
  | 'BLOCK'
  | 'UNLOCK'
  | 'TRANSFER'
  | 'HAND_OVER'
  | 'CANCEL'
  | 'RETURN'
  | 'RESET';

export interface InventoryItemProps {
  readonly id: string;
  readonly tenantId: string;
  readonly productId: string; // Ref to ProductCatalog
  state: InventoryState;
  readonly notes?: string;
}

export class InventoryItemAggregate {
  private readonly fsm: StateMachine<InventoryState, InventoryEvent>;
  private changes: DomainEvent[] = [];

  private static transitions: Transition<InventoryState, InventoryEvent>[] = [
    { from: 'OFF_MARKET', event: 'ACTIVATE', to: 'AVAILABLE' },
    { from: 'AVAILABLE', event: 'DEACTIVATE', to: 'OFF_MARKET' },
    { from: 'AVAILABLE', event: 'HOLD', to: 'HELD' },
    { from: 'HELD', event: 'RELEASE', to: 'AVAILABLE' },
    { from: ['AVAILABLE', 'HELD'], event: 'BOOK', to: 'BOOKED' },
    { from: 'BOOKED', event: 'APPROVE_BOOKING', to: 'RESERVED' },
    { from: 'RESERVED', event: 'DEPOSIT', to: 'DEPOSITED' },
    { from: 'DEPOSITED', event: 'SIGN_CONTRACT', to: 'CONTRACT_SIGNED' },
    { from: ['AVAILABLE', 'HELD', 'RESERVED'], event: 'LOCK', to: 'LOCKED' },
    { from: ['AVAILABLE', 'HELD'], event: 'BLOCK', to: 'BLOCKED' },
    { from: ['LOCKED', 'BLOCKED'], event: 'UNLOCK', to: 'AVAILABLE' },
    { from: 'CONTRACT_SIGNED', event: 'TRANSFER', to: 'TRANSFERRED' },
    { from: 'TRANSFERRED', event: 'HAND_OVER', to: 'HANDED_OVER' },
    { from: ['BOOKED', 'RESERVED', 'DEPOSITED'], event: 'CANCEL', to: 'CANCELLED' },
    { from: ['CONTRACT_SIGNED', 'TRANSFERRED', 'HANDED_OVER'], event: 'RETURN', to: 'RETURNED' },
    { from: ['CANCELLED', 'RETURNED'], event: 'RESET', to: 'AVAILABLE' },
  ];

  constructor(private readonly props: InventoryItemProps) {
    if (!props.id) throw new Error('Inventory Item ID is required');
    if (!props.tenantId) throw new Error('Tenant ID is required');
    if (!props.productId) throw new Error('Product catalog ref ID is required');
    this.fsm = new StateMachine<InventoryState, InventoryEvent>(props.state, InventoryItemAggregate.transitions);
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

  public get state(): InventoryState {
    return this.fsm.getState();
  }

  public getUncommittedChanges(): DomainEvent[] {
    return [...this.changes];
  }

  public clearChanges(): void {
    this.changes = [];
  }

  private recordEvent(eventType: string, context: TransitionContext, payload: Record<string, unknown> = {}): void {
    const domainEvent: DomainEvent = {
      eventId: `${eventType}-${this.id}-${Date.now()}`,
      eventType,
      aggregateId: this.id,
      aggregateType: 'InventoryItemAggregate',
      tenantId: this.tenantId,
      occurredAt: new Date(),
      version: 1,
      correlationId: context.correlationId,
      payload: {
        productId: this.productId,
        actorId: context.actor.userId,
        actorName: context.actor.userName || 'System',
        ...payload,
      },
    };
    this.changes.push(domainEvent);
  }

  /**
   * Transition transactional states
   */
  public async handleEvent(event: InventoryEvent, context: TransitionContext): Promise<void> {
    const fromState = this.state;
    const canRun = await this.fsm.can(event, context);
    if (!canRun) {
      throw new Error(`State machine guard blocks event "${event}" from state "${fromState}"`);
    }

    const { newState, events: hookEvents } = await this.fsm.transition(event, context);
    
    // Auto record status change event
    const eventType = `re.inventory.item.${event.toLowerCase()}`;
    this.recordEvent(eventType, context, {
      fromState,
      toState: newState,
      hookEvents: hookEvents.map(e => (e as { eventType?: string })?.eventType ?? String(e)),
    });
  }
}
