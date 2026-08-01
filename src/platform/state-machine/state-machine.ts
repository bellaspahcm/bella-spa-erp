/**
 * @fileoverview Platform State Machine Engine
 *
 * Generic finite state machine with:
 * - Typed state/event generics
 * - Transition guards (sync & async)
 * - onExit/onEnter lifecycle hooks
 * - AuditHook integration — automatic audit trail on every transition
 *
 * @module platform/state-machine
 */

// ─────────────────────────────────────────────────────────────────────────────
// Core Types
// ─────────────────────────────────────────────────────────────────────────────

export interface TransitionContext {
  readonly tenantId: string;
  readonly correlationId: string;
  readonly actor: {
    readonly userId: string;
    readonly userName?: string;
    readonly roles?: string[];
  };
  readonly payload?: Record<string, unknown>;
}

/**
 * AuditHook — called after every successful transition.
 * Inject your audit persistence logic here (DB, event bus, log stream...).
 */
export type AuditHook<TState extends string, TEvent extends string> = (params: {
  tenantId: string;
  resourceType: string;
  resourceId: string;
  fromState: TState;
  toState: TState;
  event: TEvent;
  context: TransitionContext;
  timestamp: string;
}) => void | Promise<void>;

export interface StateMachineOptions<TState extends string, TEvent extends string> {
  /** Resource type label for audit trail (e.g. 'lead', 'apartment', 'contract') */
  resourceType?: string;
  /** Resource ID for audit trail */
  resourceId?: string;
  /** Hook called after each successful transition */
  auditHook?: AuditHook<TState, TEvent>;
}

export interface Transition<TState extends string, TEvent extends string> {
  readonly from: TState | TState[];
  readonly event: TEvent;
  readonly to: TState;
  readonly guard?: (context: TransitionContext) => boolean | Promise<boolean>;
  readonly onExit?: (context: TransitionContext) => Promise<unknown[]>;
  readonly onEnter?: (context: TransitionContext) => Promise<unknown[]>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Errors
// ─────────────────────────────────────────────────────────────────────────────

export class InvalidTransitionError extends Error {
  constructor(
    public readonly from: string,
    public readonly event: string
  ) {
    super(`Invalid transition: cannot trigger event "${event}" from state "${from}"`);
    this.name = 'InvalidTransitionError';
    Object.setPrototypeOf(this, InvalidTransitionError.prototype);
  }
}

export class GuardRejectedError extends Error {
  constructor(
    public readonly event: string,
    public readonly fromState: string
  ) {
    super(`Transition guard rejected event "${event}" from state "${fromState}"`);
    this.name = 'GuardRejectedError';
    Object.setPrototypeOf(this, GuardRejectedError.prototype);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// State Machine
// ─────────────────────────────────────────────────────────────────────────────

export class StateMachine<TState extends string, TEvent extends string> {
  private readonly resourceType: string;
  private readonly resourceId: string;
  private readonly auditHook?: AuditHook<TState, TEvent>;

  constructor(
    private currentState: TState,
    private readonly transitions: Transition<TState, TEvent>[],
    options: StateMachineOptions<TState, TEvent> = {}
  ) {
    this.resourceType = options.resourceType ?? 'unknown';
    this.resourceId = options.resourceId ?? 'unknown';
    this.auditHook = options.auditHook;
  }

  public getState(): TState {
    return this.currentState;
  }

  public getValidEvents(): TEvent[] {
    return this.transitions
      .filter((t) => {
        if (Array.isArray(t.from)) {
          return t.from.includes(this.currentState);
        }
        return t.from === this.currentState;
      })
      .map((t) => t.event);
  }

  public async can(event: TEvent, context: TransitionContext): Promise<boolean> {
    const transition = this.findTransition(event);
    if (!transition) return false;

    if (transition.guard) {
      try {
        return await transition.guard(context);
      } catch (err) {
        console.error(
          '[StateMachine Guard Error] Guard failed for event %s from state %s:',
          event,
          this.currentState,
          err
        );
        return false;
      }
    }

    return true;
  }

  public async transition(
    event: TEvent,
    context: TransitionContext
  ): Promise<{ newState: TState; events: unknown[] }> {
    const transition = this.findTransition(event);

    if (!transition) {
      throw new InvalidTransitionError(this.currentState, event);
    }

    if (transition.guard) {
      const allowed = await transition.guard(context);
      if (!allowed) {
        throw new GuardRejectedError(event, this.currentState);
      }
    }

    const emittedEvents: unknown[] = [];
    const fromState = this.currentState;

    // 1. Exit hook of outgoing state
    if (transition.onExit) {
      const exitEvents = await transition.onExit(context);
      emittedEvents.push(...exitEvents);
    }

    this.currentState = transition.to;

    // 2. Enter hook of new state
    if (transition.onEnter) {
      const enterEvents = await transition.onEnter(context);
      emittedEvents.push(...enterEvents);
    }

    // 3. Fire audit hook (non-blocking, errors must not disrupt main flow)
    if (this.auditHook) {
      try {
        await this.auditHook({
          tenantId: context.tenantId,
          resourceType: this.resourceType,
          resourceId: this.resourceId,
          fromState,
          toState: this.currentState,
          event,
          context,
          timestamp: new Date().toISOString(),
        });
      } catch (auditErr) {
        console.error(
          '[StateMachine AuditHook Error] Audit hook failed for event %s (non-fatal):',
          event,
          auditErr
        );
      }
    }

    return { newState: this.currentState, events: emittedEvents };
  }

  // ─── Private ───────────────────────────────────────────────────────────────

  private findTransition(event: TEvent): Transition<TState, TEvent> | undefined {
    return this.transitions.find((t) => {
      const matchFrom = Array.isArray(t.from)
        ? t.from.includes(this.currentState)
        : t.from === this.currentState;
      return matchFrom && t.event === event;
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Builder Helper
// ─────────────────────────────────────────────────────────────────────────────

/**
 * StateMachineBuilder — fluent API for constructing state machines
 *
 * @example
 * const sm = new StateMachineBuilder<ApartmentState, ApartmentEvent>('available')
 *   .withResourceType('apartment', apartmentId)
 *   .withAuditHook(auditEngine.record.bind(auditEngine))
 *   .addTransition({ from: 'available', event: 'RESERVE', to: 'reserved' })
 *   .build();
 */
export class StateMachineBuilder<TState extends string, TEvent extends string> {
  private readonly transitions: Transition<TState, TEvent>[] = [];
  private options: StateMachineOptions<TState, TEvent> = {};

  constructor(private readonly initialState: TState) {}

  withResourceType(resourceType: string, resourceId: string): this {
    this.options = { ...this.options, resourceType, resourceId };
    return this;
  }

  withAuditHook(hook: AuditHook<TState, TEvent>): this {
    this.options = { ...this.options, auditHook: hook };
    return this;
  }

  addTransition(transition: Transition<TState, TEvent>): this {
    this.transitions.push(transition);
    return this;
  }

  build(): StateMachine<TState, TEvent> {
    return new StateMachine(this.initialState, this.transitions, this.options);
  }
}
