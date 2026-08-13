/**
 * Bitemporal Clock Value Object — Phase H9 Temporal Engine
 *
 * Encapsulates valid_time (when event occurred) and transaction_time (when system recorded it).
 * Enforces Law 11 zero `any` types.
 *
 * @module platform/healthcare/engines/temporal-engine/domain/bitemporal-clock.vo
 */

import type { TimeDimension } from '../../../contracts/temporal-engine.contract';

export class BitemporalClock {
  public readonly validTime: string;
  public readonly transactionTime: string;

  constructor(validTime: string, transactionTime?: string) {
    this.validTime = BitemporalClock.validateIsoTimestamp(validTime, 'validTime');
    this.transactionTime = transactionTime
      ? BitemporalClock.validateIsoTimestamp(transactionTime, 'transactionTime')
      : new Date().toISOString();
  }

  private static validateIsoTimestamp(isoString: string, fieldName: string): string {
    const timestamp = Date.parse(isoString);
    if (isNaN(timestamp)) {
      throw new Error(`Invalid ISO timestamp provided for ${fieldName}: ${isoString}`);
    }
    return new Date(timestamp).toISOString();
  }

  public isLateArriving(): boolean {
    return new Date(this.transactionTime).getTime() - new Date(this.validTime).getTime() > 60_000;
  }

  public getTimestampForDimension(dimension: TimeDimension): string {
    return dimension === 'TRANSACTION_TIME' ? this.transactionTime : this.validTime;
  }
}
