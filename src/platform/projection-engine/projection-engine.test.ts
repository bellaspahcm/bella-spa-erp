import { projectionEngine, Projector } from './projection-engine';
import { eventBus, SystemEvent } from '../messaging/event-bus/event-bus';

describe('ProjectionEngine', () => {
  beforeEach(() => {
    projectionEngine.clear();
  });

  it('should register projector, link to event bus and receive projects', async () => {
    const mockProject = jest.fn();

    const dummyProjector: Projector = {
      name: 'TestProjector',
      eventNames: ['re.test.event_1'],
      project: mockProject,
    };

    const unsubscribe = projectionEngine.register(dummyProjector);

    const event: SystemEvent = {
      id: 'evt-100',
      name: 're.test.event_1',
      timestamp: new Date().toISOString(),
      payload: { data: 'test-payload' },
    };

    await eventBus.publish(event);

    expect(mockProject).toHaveBeenCalledTimes(1);
    expect(mockProject).toHaveBeenCalledWith(event);

    unsubscribe();
  });

  it('should prevent errors in one projector from affecting other projectors', async () => {
    const errorProjector: Projector = {
      name: 'ErrorProjector',
      eventNames: ['re.test.event_1'],
      project: () => {
        throw new Error('Simulation projection fail');
      },
    };

    const mockProject = jest.fn();
    const successProjector: Projector = {
      name: 'SuccessProjector',
      eventNames: ['re.test.event_1'],
      project: mockProject,
    };

    const unsub1 = projectionEngine.register(errorProjector);
    const unsub2 = projectionEngine.register(successProjector);

    const event: SystemEvent = {
      id: 'evt-100',
      name: 're.test.event_1',
      timestamp: new Date().toISOString(),
      payload: {},
    };

    // Should not throw exception upstream to eventBus publisher
    await expect(eventBus.publish(event)).resolves.not.toThrow();

    expect(mockProject).toHaveBeenCalledTimes(1);

    unsub1();
    unsub2();
  });
});
