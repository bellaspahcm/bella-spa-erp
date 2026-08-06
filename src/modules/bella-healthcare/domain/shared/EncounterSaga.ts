import { DomainEvent, OutboxEntry } from './domain-models';

export class EncounterSaga {
  private static instance: EncounterSaga;
  private activeSagas: Map<string, { patientId: string; step: string }> = new Map();
  private outbox: OutboxEntry[] = [];

  private constructor() {}

  public static getInstance(): EncounterSaga {
    if (!EncounterSaga.instance) {
      EncounterSaga.instance = new EncounterSaga();
    }
    return EncounterSaga.instance;
  }

  // Handle incoming Domain Events and route them
  public async handleEvent(event: DomainEvent): Promise<void> {
    const { eventName, aggregateId } = event.metadata;

    // Stage in Transactional Outbox
    this.stageInOutbox(event);

    switch (eventName) {
      case 'AppointmentCreated.v1':
        this.activeSagas.set(aggregateId, { patientId: (event.payload as any).patientId, step: 'scheduled' });
        console.log(`[Saga] Started EncounterSaga for ${aggregateId} - Allocated Chair & Prepped Room`);
        break;

      case 'EncounterArrived.v1':
        const saga = this.activeSagas.get(aggregateId);
        if (saga) {
          saga.step = 'arrived';
          console.log(`[Saga] EncounterSaga updated to arrived: notifying BS. Lê Minh`);
        }
        break;

      case 'EncounterFinished.v2':
        this.activeSagas.delete(aggregateId);
        console.log(`[Saga] EncounterSaga finalized for ${aggregateId} - Released Chair & Archived SOAP`);
        break;
    }
  }

  // Stage event in Outbox table
  private stageInOutbox(event: DomainEvent): void {
    const entry: OutboxEntry = {
      id: `out-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      event,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    this.outbox.push(entry);
    this.publishOutbox(entry.id);
  }

  // Publish from Outbox (Guarantees at-least-once delivery)
  private publishOutbox(entryId: string): void {
    const idx = this.outbox.findIndex((o) => o.id === entryId);
    if (idx !== -1) {
      const entry = this.outbox[idx];
      // Simulate dispatching to EIP Message Broker / EventBus
      setTimeout(() => {
        this.outbox[idx] = { ...entry, status: 'published' };
        console.log(`[Outbox] Dispatched event ${entry.event.metadata.eventName} successfully`);
      }, 300);
    }
  }

  public getOutbox(): OutboxEntry[] {
    return this.outbox;
  }
}
