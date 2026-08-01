import { StateMachine, Transition, TransitionContext } from './StateMachine';
import { DomainEvent } from '../domain-event-bus/DomainEvent';

type TestState = 'DRAFT' | 'PENDING' | 'APPROVED' | 'CANCELLED';
type TestEvent = 'SUBMIT' | 'APPROVE' | 'CANCEL' | 'REOPEN';

describe('StateMachine', () => {
  const mockContext: TransitionContext = {
    tenantId: 'tenant-123',
    correlationId: 'corr-456',
    actor: { userId: 'user-789' },
  };

  const createDummyEvent = (name: string): DomainEvent => ({
    eventId: `${name}-id`,
    eventType: `re.test.${name}`,
    aggregateId: 'agg-123',
    aggregateType: 'TestAggregate',
    tenantId: 'tenant-123',
    occurredAt: new Date(),
    version: 1,
    correlationId: 'corr-456',
    payload: {},
  });

  const transitions: Transition<TestState, TestEvent>[] = [
    {
      from: 'DRAFT',
      event: 'SUBMIT',
      to: 'PENDING',
      onExit: async () => [createDummyEvent('exited_draft')],
      onEnter: async () => [createDummyEvent('entered_pending')],
    },
    {
      from: 'PENDING',
      event: 'APPROVE',
      to: 'APPROVED',
      guard: (ctx) => ctx.actor.userId === 'admin-user',
    },
    {
      from: ['DRAFT', 'PENDING'],
      event: 'CANCEL',
      to: 'CANCELLED',
    },
  ];

  it('should initialize with starting state', () => {
    const fsm = new StateMachine<TestState, TestEvent>('DRAFT', transitions);
    expect(fsm.getState()).toBe('DRAFT');
  });

  it('should list valid events from current state', () => {
    const fsm = new StateMachine<TestState, TestEvent>('DRAFT', transitions);
    expect(fsm.getValidEvents()).toEqual(['SUBMIT', 'CANCEL']);
  });

  it('should transition to next state and collect enter/exit events', async () => {
    const fsm = new StateMachine<TestState, TestEvent>('DRAFT', transitions);
    const result = await fsm.transition('SUBMIT', mockContext);

    expect(result.newState).toBe('PENDING');
    expect(fsm.getState()).toBe('PENDING');
    expect(result.events.length).toBe(2);
    expect(result.events[0].eventType).toBe('re.test.exited_draft');
    expect(result.events[1].eventType).toBe('re.test.entered_pending');
  });

  it('should block transition and throw error if transition is not defined', async () => {
    const fsm = new StateMachine<TestState, TestEvent>('DRAFT', transitions);
    await expect(fsm.transition('APPROVE', mockContext)).rejects.toThrow(
      'Invalid transition: cannot trigger event "APPROVE" from state "DRAFT"'
    );
  });

  it('should check if transition can run', async () => {
    const adminContext = { ...mockContext, actor: { userId: 'admin-user' } };
    const fsm = new StateMachine<TestState, TestEvent>('PENDING', transitions);
    expect(await fsm.can('APPROVE', adminContext)).toBe(true);
  });

  it('should reject transition if guard fails', async () => {
    const fsm = new StateMachine<TestState, TestEvent>('PENDING', transitions);
    // User is user-789, not admin-user
    expect(await fsm.can('APPROVE', mockContext)).toBe(false);
    await expect(fsm.transition('APPROVE', mockContext)).rejects.toThrow(
      'Transition guard rejected event "APPROVE" from state "PENDING"'
    );
  });

  it('should allow transition if guard passes', async () => {
    const adminContext: TransitionContext = {
      ...mockContext,
      actor: { userId: 'admin-user' },
    };
    const fsm = new StateMachine<TestState, TestEvent>('PENDING', transitions);
    expect(await fsm.can('APPROVE', adminContext)).toBe(true);
    const result = await fsm.transition('APPROVE', adminContext);
    expect(result.newState).toBe('APPROVED');
  });
});
