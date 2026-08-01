import { DomainEvent } from './DomainEvent';
import { domainEventBus } from './DomainEventBus';
import { eventBus } from '@/platform/capability-platform/event-bus';

describe('DomainEventBus', () => {
  const dummyEvent: DomainEvent = {
    eventId: 'test-event-123',
    eventType: 're.test.dummy_event',
    aggregateId: 'agg-123',
    aggregateType: 'DummyAggregate',
    tenantId: 'tenant-abc',
    occurredAt: new Date(),
    version: 1,
    correlationId: 'corr-xyz',
    payload: { key: 'value', actorId: 'user-456', actorName: 'John Doe' },
  };

  it('should register subscriber and receive published events synchronously', async () => {
    const mockHandler = jest.fn();
    const unsubscribe = domainEventBus.subscribe('re.test.dummy_event', mockHandler);

    await domainEventBus.publish(dummyEvent);

    expect(mockHandler).toHaveBeenCalledTimes(1);
    expect(mockHandler).toHaveBeenCalledWith(dummyEvent);

    unsubscribe();
  });

  it('should propagate errors from subscribers to halt transaction flow', async () => {
    const errorHandling = jest.fn().mockImplementation(() => {
      throw new Error('Transaction failure simulation');
    });

    const unsubscribe = domainEventBus.subscribe('re.test.dummy_event', errorHandling);

    await expect(domainEventBus.publish(dummyEvent)).rejects.toThrow('Transaction failure simulation');

    unsubscribe();
  });

  it('should bridge published events to the platform EventBus', async () => {
    const platformSpy = jest.spyOn(eventBus, 'publish');

    const unsubscribe = domainEventBus.subscribe('re.test.dummy_event', () => {});
    await domainEventBus.publish(dummyEvent);

    expect(platformSpy).toHaveBeenCalled();
    const lastCall = platformSpy.mock.calls[platformSpy.mock.calls.length - 1][0];
    expect(lastCall.id).toBe(dummyEvent.eventId);
    expect(lastCall.eventType).toBe(dummyEvent.eventType);
    expect(lastCall.resourceType).toBe(dummyEvent.aggregateType);
    expect(lastCall.resourceId).toBe(dummyEvent.aggregateId);

    unsubscribe();
    platformSpy.mockRestore();
  });
});
