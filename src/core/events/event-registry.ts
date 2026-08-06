/**
 * Event Contract Registry for Platform-wide Versioned Events
 * ZERO `any` allowed.
 */

export interface EventContract {
  readonly eventType: string; // e.g. "healthcare.encounter.started.v1"
  readonly schemaVersion: string;
  readonly description: string;
  readonly payloadSchema: Readonly<Record<string, unknown>>;
}

export class EventContractRegistry {
  private contracts = new Map<string, EventContract>();

  register(contract: EventContract): void {
    if (this.contracts.has(contract.eventType)) {
      throw new Error(`[EventRegistry] Event Contract '${contract.eventType}' is already registered.`);
    }
    this.contracts.set(contract.eventType, contract);
  }

  get(eventType: string): EventContract | undefined {
    return this.contracts.get(eventType);
  }

  has(eventType: string): boolean {
    return this.contracts.has(eventType);
  }

  getContracts(): readonly EventContract[] {
    return Array.from(this.contracts.values());
  }
}

export const platformEventRegistry = new EventContractRegistry();
