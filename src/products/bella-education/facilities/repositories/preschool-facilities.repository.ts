/**
 * Bella Preschool OS — Preschool Facilities Persistence Repository
 * File: src/products/bella-education/facilities/repositories/preschool-facilities.repository.ts
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { 
  Facility, 
  FacilityZone, 
  FacilityAsset, 
  InspectionSchedule, 
  InspectionLog, 
  MaintenanceJob, 
  OutOfServiceLog,
  OperationalStatus,
  RestrictionScope,
  InspectionResult,
  JobStatus
} from '../domain/facilities.types';

export class PreschoolFacilitiesRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  // --- Facilities ---
  async createFacility(facility: Omit<Facility, 'id' | 'createdAt'>): Promise<Facility> {
    const { data, error } = await this.supabase
      .from('edu_fac_facilities')
      .insert({
        tenant_id: facility.tenantId,
        name: facility.name,
        code: facility.code,
        address: facility.address,
      })
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(`Failed to create facility: ${error?.message}`);
    }

    return this.mapFacility(data);
  }

  async getFacility(tenantId: string, id: string): Promise<Facility | null> {
    const { data } = await this.supabase
      .from('edu_fac_facilities')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .maybeSingle();

    return data ? this.mapFacility(data) : null;
  }

  // --- Zones ---
  async createZone(zone: Omit<FacilityZone, 'id' | 'createdAt'>): Promise<FacilityZone> {
    const { data, error } = await this.supabase
      .from('edu_fac_zones')
      .insert({
        tenant_id: zone.tenantId,
        facility_id: zone.facilityId,
        name: zone.name,
        zone_type: zone.zoneType,
        max_occupancy: zone.maxOccupancy,
        operational_status: zone.operationalStatus || 'OPERATIONAL',
        restriction_scope: zone.restrictionScope || 'ZONE',
      })
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(`Failed to create facility zone: ${error?.message}`);
    }

    return this.mapZone(data);
  }

  async getZone(tenantId: string, id: string): Promise<FacilityZone | null> {
    const { data } = await this.supabase
      .from('edu_fac_zones')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .maybeSingle();

    return data ? this.mapZone(data) : null;
  }

  async updateZoneStatus(tenantId: string, id: string, status: OperationalStatus, restrictionScope: RestrictionScope): Promise<FacilityZone> {
    const { data, error } = await this.supabase
      .from('edu_fac_zones')
      .update({
        operational_status: status,
        restriction_scope: restrictionScope,
      })
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(`Failed to update zone status: ${error?.message}`);
    }

    return this.mapZone(data);
  }

  // --- Assets ---
  async createAsset(asset: Omit<FacilityAsset, 'id' | 'createdAt'>): Promise<FacilityAsset> {
    const { data, error } = await this.supabase
      .from('edu_fac_assets')
      .insert({
        tenant_id: asset.tenantId,
        zone_id: asset.zoneId,
        name: asset.name,
        asset_category: asset.assetCategory,
        serial_number: asset.serialNumber,
        inspection_interval_days: asset.inspectionIntervalDays,
        operational_status: asset.operationalStatus || 'OPERATIONAL',
        restriction_scope: asset.restrictionScope || 'ASSET_ONLY',
      })
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(`Failed to create asset: ${error?.message}`);
    }

    return this.mapAsset(data);
  }

  async getAsset(tenantId: string, id: string): Promise<FacilityAsset | null> {
    const { data } = await this.supabase
      .from('edu_fac_assets')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .maybeSingle();

    return data ? this.mapAsset(data) : null;
  }

  async updateAssetStatus(tenantId: string, id: string, status: OperationalStatus, restrictionScope: RestrictionScope, lastInspectedAt?: string): Promise<FacilityAsset> {
    const updatePayload: any = {
      operational_status: status,
      restriction_scope: restrictionScope,
    };
    if (lastInspectedAt) {
      updatePayload.last_inspected_at = lastInspectedAt;
    }

    const { data, error } = await this.supabase
      .from('edu_fac_assets')
      .update(updatePayload)
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(`Failed to update asset status: ${error?.message}`);
    }

    return this.mapAsset(data);
  }

  // --- Inspection Schedules & Logs ---
  async createInspectionSchedule(sched: Omit<InspectionSchedule, 'id' | 'createdAt'>): Promise<InspectionSchedule> {
    const { data, error } = await this.supabase
      .from('edu_fac_inspection_schedules')
      .insert({
        tenant_id: sched.tenantId,
        zone_id: sched.zoneId,
        asset_id: sched.assetId,
        title: sched.title,
        frequency: sched.frequency,
        checklist_schema: sched.checklistSchema,
        next_due_date: sched.nextDueDate,
      })
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(`Failed to create inspection schedule: ${error?.message}`);
    }

    return this.mapSchedule(data);
  }

  async recordInspectionLog(log: Omit<InspectionLog, 'id' | 'createdAt'>): Promise<InspectionLog> {
    const { data, error } = await this.supabase
      .from('edu_fac_inspection_logs')
      .insert({
        tenant_id: log.tenantId,
        schedule_id: log.scheduleId,
        zone_id: log.zoneId,
        asset_id: log.assetId,
        inspector_party_id: log.inspectorPartyId,
        inspection_date: log.inspectionDate,
        result_status: log.resultStatus,
        checklist_answers: log.checklistAnswers,
        remarks: log.remarks,
        restriction_scope: log.restrictionScope,
      })
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(`Failed to record inspection log: ${error?.message}`);
    }

    return this.mapInspectionLog(data);
  }

  async listInspectionLogs(tenantId: string, zoneId: string): Promise<InspectionLog[]> {
    const { data } = await this.supabase
      .from('edu_fac_inspection_logs')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('zone_id', zoneId)
      .order('created_at', { ascending: false });

    return (data || []).map(d => this.mapInspectionLog(d));
  }

  // --- Out of Service Audit Logs ---
  async recordOutOfServiceLog(log: Omit<OutOfServiceLog, 'id' | 'createdAt'>): Promise<OutOfServiceLog> {
    const { data, error } = await this.supabase
      .from('edu_fac_out_of_service_logs')
      .insert({
        tenant_id: log.tenantId,
        entity_type: log.entityType,
        entity_id: log.entityId,
        reason: log.reason,
        restriction_scope: log.restrictionScope,
        initiated_by_party_id: log.initiatedByPartyId,
      })
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(`Failed to record out of service log: ${error?.message}`);
    }

    return this.mapOutOfServiceLog(data);
  }

  async resolveOutOfServiceLog(tenantId: string, logId: string, restoredByPartyId: string): Promise<OutOfServiceLog> {
    const { data, error } = await this.supabase
      .from('edu_fac_out_of_service_logs')
      .update({
        restored_by_party_id: restoredByPartyId,
        restored_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId)
      .eq('id', logId)
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(`Failed to resolve out of service log: ${error?.message}`);
    }

    return this.mapOutOfServiceLog(data);
  }

  async getLatestActiveOutOfServiceLog(tenantId: string, entityType: 'ASSET' | 'ZONE', entityId: string): Promise<OutOfServiceLog | null> {
    const { data } = await this.supabase
      .from('edu_fac_out_of_service_logs')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .is('restored_at', null)
      .order('created_at', { ascending: false })
      .maybeSingle();

    return data ? this.mapOutOfServiceLog(data) : null;
  }

  // --- List Query Methods ---
  async listFacilities(tenantId: string): Promise<Facility[]> {
    const { data } = await this.supabase
      .from('edu_fac_facilities')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    return (data || []).map(d => this.mapFacility(d));
  }

  async listZones(tenantId: string, facilityId?: string): Promise<FacilityZone[]> {
    let query = this.supabase
      .from('edu_fac_zones')
      .select('*')
      .eq('tenant_id', tenantId);

    if (facilityId) {
      query = query.eq('facility_id', facilityId);
    }

    const { data } = await query.order('created_at', { ascending: false });
    return (data || []).map(d => this.mapZone(d));
  }

  async listAssets(tenantId: string, zoneId?: string): Promise<FacilityAsset[]> {
    let query = this.supabase
      .from('edu_fac_assets')
      .select('*')
      .eq('tenant_id', tenantId);

    if (zoneId) {
      query = query.eq('zone_id', zoneId);
    }

    const { data } = await query.order('created_at', { ascending: false });
    return (data || []).map(d => this.mapAsset(d));
  }

  async listMaintenanceJobs(tenantId: string, zoneId?: string): Promise<MaintenanceJob[]> {
    let query = this.supabase
      .from('edu_fac_maintenance_jobs')
      .select('*')
      .eq('tenant_id', tenantId);

    if (zoneId) {
      query = query.eq('zone_id', zoneId);
    }

    const { data } = await query.order('created_at', { ascending: false });
    return (data || []).map(d => ({
      id: d.id,
      tenantId: d.tenant_id,
      zoneId: d.zone_id,
      assetId: d.asset_id,
      title: d.title,
      priority: d.priority,
      status: d.status,
      reportedByPartyId: d.reported_by_party_id,
      assignedTechnicianPartyId: d.assigned_technician_party_id,
      completionNotes: d.completion_notes,
      verifiedByPartyId: d.verified_by_party_id,
      createdAt: d.created_at,
      updatedAt: d.updated_at,
    }));
  }

  // --- Data Mappers ---
  private mapFacility(d: any): Facility {
    return {
      id: d.id,
      tenantId: d.tenant_id,
      name: d.name,
      code: d.code,
      address: d.address,
      createdAt: d.created_at,
    };
  }

  private mapZone(d: any): FacilityZone {
    return {
      id: d.id,
      tenantId: d.tenant_id,
      facilityId: d.facility_id,
      name: d.name,
      zoneType: d.zone_type,
      maxOccupancy: d.max_occupancy,
      operationalStatus: d.operational_status,
      restrictionScope: d.restriction_scope,
      createdAt: d.created_at,
    };
  }

  private mapAsset(d: any): FacilityAsset {
    return {
      id: d.id,
      tenantId: d.tenant_id,
      zoneId: d.zone_id,
      name: d.name,
      assetCategory: d.asset_category,
      serialNumber: d.serial_number,
      inspectionIntervalDays: d.inspection_interval_days,
      lastInspectedAt: d.last_inspected_at,
      operationalStatus: d.operational_status,
      restrictionScope: d.restriction_scope,
      createdAt: d.created_at,
    };
  }

  private mapSchedule(d: any): InspectionSchedule {
    return {
      id: d.id,
      tenantId: d.tenant_id,
      zoneId: d.zone_id,
      assetId: d.asset_id,
      title: d.title,
      frequency: d.frequency,
      checklistSchema: d.checklist_schema || [],
      nextDueDate: d.next_due_date,
      createdAt: d.created_at,
    };
  }

  private mapInspectionLog(d: any): InspectionLog {
    return {
      id: d.id,
      tenantId: d.tenant_id,
      scheduleId: d.schedule_id,
      zoneId: d.zone_id,
      assetId: d.asset_id,
      inspectorPartyId: d.inspector_party_id,
      inspectionDate: d.inspection_date,
      resultStatus: d.result_status,
      checklistAnswers: d.checklist_answers || [],
      remarks: d.remarks,
      restrictionScope: d.restriction_scope,
      createdAt: d.created_at,
    };
  }

  private mapOutOfServiceLog(d: any): OutOfServiceLog {
    return {
      id: d.id,
      tenantId: d.tenant_id,
      entityType: d.entity_type,
      entityId: d.entity_id,
      reason: d.reason,
      restrictionScope: d.restriction_scope,
      initiatedByPartyId: d.initiated_by_party_id,
      restoredByPartyId: d.restored_by_party_id,
      createdAt: d.created_at,
      restoredAt: d.restored_at,
    };
  }
}
