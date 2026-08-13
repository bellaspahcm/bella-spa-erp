/**
 * BELLA HOSPITAL — BED OCCUPANCY READ-MODEL PROJECTION
 *
 * Read-Model Projection isolating dashboard queries from write-model tables
 * in compliance with Law 17 (Read-Model Projection Isolation):
 * - Does not lock write-model tables during dashboard queries
 * - Asynchronously projects bed state changes for high-performance dashboard rendering
 *
 * @module src/products/bella-hospital/projections/bed-occupancy.projection
 */

export interface BedOccupancySummaryViewDTO {
  departmentId: string;
  departmentName: string;
  totalBeds: number;
  occupiedBeds: number;
  availableBeds: number;
  occupancyRatePercentage: number;
  lastUpdatedAt: string;
}

export class BedOccupancyReadModelProjection {
  private readonly projectionCache = new Map<string, BedOccupancySummaryViewDTO>();

  /**
   * Updates projection asynchronously upon bed status domain event
   */
  async projectBedStateChange(event: { departmentId: string; departmentName: string; totalBeds: number; occupiedBeds: number; timestamp: string }): Promise<void> {
    const availableBeds = Math.max(0, event.totalBeds - event.occupiedBeds);
    const occupancyRatePercentage = event.totalBeds > 0 ? Math.round((event.occupiedBeds / event.totalBeds) * 100) : 0;

    this.projectionCache.set(event.departmentId, {
      departmentId: event.departmentId,
      departmentName: event.departmentName,
      totalBeds: event.totalBeds,
      occupiedBeds: event.occupiedBeds,
      availableBeds,
      occupancyRatePercentage,
      lastUpdatedAt: event.timestamp
    });
  }

  /**
   * Reads high-speed projection view without touching write-model DB tables
   */
  async getBedOccupancySummary(departmentId: string): Promise<BedOccupancySummaryViewDTO | null> {
    return this.projectionCache.get(departmentId) || null;
  }
}
