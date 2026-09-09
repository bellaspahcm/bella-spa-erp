/**
 * Bella Preschool OS — Facility & Zone Management Service
 * File: src/products/bella-education/facilities/services/facility-zone.service.ts
 *
 * Provides Zone & Asset Master Lifecycle Management, Encapsulated State Transitions,
 * and Read-Only ZoneAvailabilityContract Publishing.
 */

import { PreschoolFacilitiesRepository } from '../repositories/preschool-facilities.repository';
import { 
  Facility, 
  FacilityZone, 
  FacilityAsset, 
  ZoneAvailabilityDTO, 
  OperationalStatus, 
  RestrictionScope 
} from '../domain/facilities.types';

export class FacilityZoneService {
  constructor(private readonly repo: PreschoolFacilitiesRepository) {}

  async createFacility(facility: Omit<Facility, 'id' | 'createdAt'>): Promise<Facility> {
    return this.repo.createFacility(facility);
  }

  async createZone(zone: Omit<FacilityZone, 'id' | 'createdAt'>): Promise<FacilityZone> {
    return this.repo.createZone(zone);
  }

  async createAsset(asset: Omit<FacilityAsset, 'id' | 'createdAt'>): Promise<FacilityAsset> {
    return this.repo.createAsset(asset);
  }

  // --- Encapsulated State Transition Methods (No Generic Update API) ---

  /**
   * Places an asset or zone under inspection state.
   */
  async markUnderInspection(tenantId: string, entityType: 'ASSET' | 'ZONE', entityId: string): Promise<void> {
    if (entityType === 'ZONE') {
      const z = await this.repo.getZone(tenantId, entityId);
      if (!z) throw new Error(`Zone ${entityId} not found in tenant ${tenantId}`);
      await this.repo.updateZoneStatus(tenantId, entityId, 'UNDER_INSPECTION', z.restrictionScope);
    } else {
      const a = await this.repo.getAsset(tenantId, entityId);
      if (!a) throw new Error(`Asset ${entityId} not found in tenant ${tenantId}`);
      await this.repo.updateAssetStatus(tenantId, entityId, 'UNDER_INSPECTION', a.restrictionScope);
    }
  }

  /**
   * Places an asset or zone out of service with an explicit reason and restriction scope.
   */
  async placeOutOfService(
    tenantId: string, 
    entityType: 'ASSET' | 'ZONE', 
    entityId: string, 
    reason: string, 
    restrictionScope: RestrictionScope,
    initiatedByPartyId: string
  ): Promise<void> {
    if (entityType === 'ZONE') {
      const z = await this.repo.getZone(tenantId, entityId);
      if (!z) throw new Error(`Zone ${entityId} not found in tenant ${tenantId}`);
      await this.repo.updateZoneStatus(tenantId, entityId, 'OUT_OF_SERVICE', restrictionScope);
    } else {
      const a = await this.repo.getAsset(tenantId, entityId);
      if (!a) throw new Error(`Asset ${entityId} not found in tenant ${tenantId}`);
      await this.repo.updateAssetStatus(tenantId, entityId, 'OUT_OF_SERVICE', restrictionScope);

      // If restriction scope is ZONE, propagate OUT_OF_SERVICE to containing zone
      if (restrictionScope === 'ZONE') {
        await this.repo.updateZoneStatus(tenantId, a.zoneId, 'OUT_OF_SERVICE', 'ZONE');
      }
    }

    // Record audit log
    await this.repo.recordOutOfServiceLog({
      tenantId,
      entityType,
      entityId,
      reason,
      restrictionScope,
      initiatedByPartyId,
    });
  }

  /**
   * Restores an asset or zone to OPERATIONAL status ONLY when an independent safety re-inspection yields PASS.
   */
  async passRestorationInspection(
    tenantId: string, 
    entityType: 'ASSET' | 'ZONE', 
    entityId: string, 
    restoredByPartyId: string
  ): Promise<void> {
    const activeLog = await this.repo.getLatestActiveOutOfServiceLog(tenantId, entityType, entityId);
    if (activeLog) {
      await this.repo.resolveOutOfServiceLog(tenantId, activeLog.id, restoredByPartyId);
    }

    if (entityType === 'ZONE') {
      await this.repo.updateZoneStatus(tenantId, entityId, 'OPERATIONAL', 'ZONE');
    } else {
      const a = await this.repo.getAsset(tenantId, entityId);
      if (a) {
        await this.repo.updateAssetStatus(tenantId, entityId, 'OPERATIONAL', 'ASSET_ONLY', new Date().toISOString());
        // If parent zone was OUT_OF_SERVICE due to this asset, check if zone can be restored
        const zoneLog = await this.repo.getLatestActiveOutOfServiceLog(tenantId, 'ZONE', a.zoneId);
        if (zoneLog) {
          await this.repo.resolveOutOfServiceLog(tenantId, zoneLog.id, restoredByPartyId);
          await this.repo.updateZoneStatus(tenantId, a.zoneId, 'OPERATIONAL', 'ZONE');
        } else {
          // If no direct zone log, check if any remaining assets in the zone are non-OPERATIONAL
          const zoneAssets = await this.repo.listAssets(tenantId, a.zoneId);
          const hasUnhealthyAssets = zoneAssets.some(
            asset => asset.id !== entityId && asset.operationalStatus !== 'OPERATIONAL'
          );
          if (!hasUnhealthyAssets) {
            await this.repo.updateZoneStatus(tenantId, a.zoneId, 'OPERATIONAL', 'ZONE');
          }
        }
      }
    }
  }

  /**
   * Public Contract Exporter: Returns read-only availability DTO for P3/P8 consumption.
   * P9 Facilities publishes availability truth ONLY; P3/P8 owns classroom activity scheduling.
   */
  async getZoneAvailability(tenantId: string, zoneId: string): Promise<ZoneAvailabilityDTO> {
    const zone = await this.repo.getZone(tenantId, zoneId);
    if (!zone) {
      throw new Error(`Zone ${zoneId} not found in tenant ${tenantId}`);
    }

    const isAvailable = zone.operationalStatus === 'OPERATIONAL';
    const activeLog = await this.repo.getLatestActiveOutOfServiceLog(tenantId, 'ZONE', zoneId);

    return {
      zoneId: zone.id,
      operationalStatus: zone.operationalStatus,
      availableForScheduling: isAvailable,
      restrictionReason: activeLog?.reason || (isAvailable ? undefined : 'Zone is under maintenance or inspection'),
      restrictionScope: zone.restrictionScope,
      evidenceRef: activeLog?.id,
      evaluatedAt: new Date().toISOString(),
    };
  }
}
