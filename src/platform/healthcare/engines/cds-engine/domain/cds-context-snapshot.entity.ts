export class CdsContextSnapshot {
  constructor(
    readonly id: string,
    readonly tenantId: string,
    readonly encounterId: string,
    readonly patientId: string,
    readonly allergies: unknown[],
    readonly activeMedications: unknown[],
    readonly labResults: unknown[],
    readonly vitalSigns: unknown[],
    readonly diagnoses: unknown[],
    readonly activeOrders: unknown[],
    readonly lastProcessedEventAt: string | null,
    readonly lastEventId: string | null,
    readonly lastEventSequence: number | null,
    readonly projectionVersion: number,
    private readonly storedStatus: 'FRESH' | 'STALE' | 'UNAVAILABLE' | 'ERROR',
    readonly projectionError: string | null
  ) {}

  /**
   * Evaluates the effective status dynamically at query-time (H8-08 Freshness Rule)
   * If last processed event age > 300s, status escalates to STALE.
   */
  get effectiveStatus(): 'FRESH' | 'STALE' | 'UNAVAILABLE' | 'ERROR' {
    if (this.storedStatus === 'ERROR') return 'ERROR';
    if (this.storedStatus === 'UNAVAILABLE') return 'UNAVAILABLE';
    if (!this.lastProcessedEventAt) return 'UNAVAILABLE';

    const ageMs = Date.now() - new Date(this.lastProcessedEventAt).getTime();
    if (ageMs > 300000) { // 300 seconds
      return 'STALE';
    }
    return this.storedStatus;
  }
}
