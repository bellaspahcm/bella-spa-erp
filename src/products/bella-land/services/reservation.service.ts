/**
 * BELLA LAND — RESERVATION PRODUCT SERVICE
 *
 * Coordinates transactional holds (reservations) for property units.
 * Consumes the public IReservationContract, enforcing manifest validations.
 *
 * @module src/products/bella-land/services/reservation.service
 */

import { IReservationContract } from '../../../platform/real-estate/contracts/reservation.contract';
import { bellaLandManifest } from '../manifest';

export interface ReserveUnitDTO {
  tenantId: string;
  productId: string;
  userId: string;
  customerId: string;
  durationMinutes: number;
}

export class ReservationProductService {
  constructor(private readonly reservationContract: IReservationContract) {}

  private assertCapability(capabilityId: string) {
    const capabilities = bellaLandManifest.capabilities || [];
    if (!capabilities.includes(capabilityId)) {
      throw new Error(`MANIFEST_VIOLATION: Capability '${capabilityId}' is not enabled in product manifest.`);
    }
  }

  private assertWorkflow(workflowId: string) {
    const workflows = bellaLandManifest.workflows || [];
    if (!workflows.includes(workflowId)) {
      throw new Error(`MANIFEST_VIOLATION: Workflow '${workflowId}' is not enabled in product manifest.`);
    }
  }

  /**
   * Puts a product unit on hold reservation.
   */
  async reserveProduct(dto: ReserveUnitDTO): Promise<{ success: boolean; reservationId: string; expiresAt: string }> {
    this.assertCapability('sales_reservation_command');
    this.assertWorkflow('property_sales_lifecycle');

    if (!dto.tenantId) throw new Error('TENANT_ISOLATION_VIOLATION: tenantId is required');
    if (!dto.productId) throw new Error('PRODUCT_BOUNDARY_VIOLATION: productId is required');

    const res = await this.reservationContract.reserveProduct({
      tenantId: dto.tenantId,
      productId: dto.productId,
      userId: dto.userId,
      customerId: dto.customerId,
      durationMinutes: dto.durationMinutes
    });

    if (!res.success || !res.reservationId || !res.expiresAt) {
      throw new Error(`Reservation failed: ${res.error || 'Unknown error'}`);
    }

    return {
      success: true,
      reservationId: res.reservationId,
      expiresAt: res.expiresAt
    };
  }

  /**
   * Releases an active hold.
   */
  async releaseProduct(tenantId: string, productId: string, reservationId: string): Promise<void> {
    this.assertCapability('sales_reservation_command');
    this.assertWorkflow('property_sales_lifecycle');

    if (!tenantId) throw new Error('TENANT_ISOLATION_VIOLATION: tenantId is required');
    if (!productId) throw new Error('PRODUCT_BOUNDARY_VIOLATION: productId is required');

    await this.reservationContract.releaseProduct(tenantId, productId, reservationId);
  }
}
