/**
 * Supabase Blood Bank Repository
 * 
 * Constitution Scope:
 * - Law 11: Zero any types allowed
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { IBloodBankRepository } from './blood-bank.repository.interface';
import { BloodCrossmatch, CrossmatchStatus } from '../domain/blood-crossmatch.entity';
import { BloodComponent, BloodUnitStatus, TransfusionVerificationSnapshot } from '../domain/blood-component.vo';

export class SupabaseBloodBankRepository implements IBloodBankRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async findCrossmatchById(tenantId: string, id: string): Promise<BloodCrossmatch | null> {
    const { data, error } = await this.supabase
      .from('hc_blood_crossmatch_records')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    const crossmatch = new BloodCrossmatch(
      data.id,
      data.tenant_id,
      data.encounter_id,
      data.blood_unit_id,
      data.status as CrossmatchStatus
    );

    // Populate crossmatch properties
    crossmatch.setCrossmatchData({
      crossmatchedBy: data.crossmatched_by,
      crossmatchedAt: data.crossmatched_at,
      approvedBy: data.approved_by,
      approvedAt: data.approved_at,
      emergencyOverride: null, // Immutable audit in DB via transfusion verification if overridden
    });

    return crossmatch;
  }

  async saveCrossmatch(crossmatch: BloodCrossmatch): Promise<void> {
    const { error } = await this.supabase
      .from('hc_blood_crossmatch_records')
      .update({
        status: crossmatch.status,
        crossmatched_by: crossmatch.crossmatchedBy,
        crossmatched_at: crossmatch.crossmatchedAt,
        approved_by: crossmatch.approvedBy,
        approved_at: crossmatch.approvedAt,
        updated_at: new Date().toISOString(),
      })
      .eq('id', crossmatch.id)
      .eq('tenant_id', crossmatch.tenantId);

    if (error) {
      throw new Error(`Failed to update crossmatch: ${error.message}`);
    }
  }

  async findBloodUnitById(tenantId: string, id: string): Promise<BloodComponent | null> {
    const { data, error } = await this.supabase
      .from('hc_blood_units')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return {
      id: data.id,
      tenantId: data.tenant_id,
      unitNumber: data.unit_number,
      bloodType: data.blood_type as 'A' | 'B' | 'AB' | 'O',
      rhFactor: data.rh_factor as 'POSITIVE' | 'NEGATIVE',
      componentType: data.component_type as 'RBC',
      status: data.status as BloodUnitStatus,
      expiryDate: data.expiry_date,
      version: 1,
    };
  }

  async saveBloodUnitStatus(
    tenantId: string,
    unitId: string,
    status: BloodUnitStatus,
    expectedStatus?: BloodUnitStatus
  ): Promise<boolean> {
    let query = this.supabase
      .from('hc_blood_units')
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', unitId)
      .eq('tenant_id', tenantId);

    if (expectedStatus) {
      query = query.eq('status', expectedStatus);
    }

    const { data, error } = await query.select();

    return !error && data && data.length > 0;
  }

  async saveTransfusionVerification(
    tenantId: string,
    encounterId: string,
    bloodUnitId: string,
    crossmatchId: string,
    data: TransfusionVerificationSnapshot,
    verifiedByA: string,
    verifiedByB: string
  ): Promise<string> {
    const { data: inserted, error } = await this.supabase
      .from('hc_transfusion_verifications')
      .insert({
        tenant_id: tenantId,
        encounter_id: encounterId,
        blood_unit_id: bloodUnitId,
        crossmatch_id: crossmatchId,
        verification_data: data as Record<string, unknown>,
        verified_by_clinician_a: verifiedByA,
        verified_by_clinician_b: verifiedByB,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to record transfusion verification: ${error.message}`);
    }

    return inserted.id;
  }

  async createTransfusionRecord(
    tenantId: string,
    encounterId: string,
    bloodUnitId: string,
    verificationId: string,
    startedAt: string
  ): Promise<string> {
    const { data: inserted, error } = await this.supabase
      .from('hc_transfusion_records')
      .insert({
        tenant_id: tenantId,
        encounter_id: encounterId,
        blood_unit_id: bloodUnitId,
        verification_id: verificationId,
        started_at: startedAt,
        status: 'started',
        reaction_occurred: false,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create transfusion record: ${error.message}`);
    }

    return inserted.id;
  }

  async getTransfusionRecord(
    tenantId: string,
    transfusionId: string
  ): Promise<{ id: string; encounterId: string; bloodUnitId: string; status: string } | null> {
    const { data, error } = await this.supabase
      .from('hc_transfusion_records')
      .select('id, encounter_id, blood_unit_id, status')
      .eq('tenant_id', tenantId)
      .eq('id', transfusionId)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return {
      id: data.id,
      encounterId: data.encounter_id,
      bloodUnitId: data.blood_unit_id,
      status: data.status,
    };
  }

  async completeTransfusionRecord(
    tenantId: string,
    transfusionId: string,
    completedAt: string
  ): Promise<void> {
    const { error } = await this.supabase
      .from('hc_transfusion_records')
      .update({
        status: 'completed',
        completed_at: completedAt,
        updated_at: new Date().toISOString(),
      })
      .eq('id', transfusionId)
      .eq('tenant_id', tenantId);

    if (error) {
      throw new Error(`Failed to complete transfusion record: ${error.message}`);
    }
  }

  async abortTransfusionWithReaction(
    tenantId: string,
    transfusionId: string,
    unitId: string,
    encounterId: string,
    completedAt: string,
    reactionDetails: string
  ): Promise<void> {
    // Step 1: abort the transfusion record
    const { error: txError } = await this.supabase
      .from('hc_transfusion_records')
      .update({
        status: 'aborted',
        completed_at: completedAt,
        reaction_occurred: true,
        reaction_details: reactionDetails,
        updated_at: new Date().toISOString(),
      })
      .eq('id', transfusionId)
      .eq('tenant_id', tenantId);

    if (txError) {
      throw new Error(`Failed to abort transfusion record: ${txError.message}`);
    }

    // Step 2: reject the blood unit
    const { error: unitError } = await this.supabase
      .from('hc_blood_units')
      .update({
        status: 'REJECTED',
        updated_at: new Date().toISOString(),
      })
      .eq('id', unitId)
      .eq('tenant_id', tenantId);

    if (unitError) {
      throw new Error(`Failed to reject blood unit after reaction: ${unitError.message}`);
    }
    // Encounter lock is implicit: isEncounterLocked queries reaction_occurred=true
    // on hc_transfusion_records, which is already set in Step 1 above.
  }

  async isEncounterLocked(tenantId: string, encounterId: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('hc_transfusion_records')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('encounter_id', encounterId)
      .eq('reaction_occurred', true)
      .limit(1);

    if (error || !data) {
      return false;
    }

    return data.length > 0;
  }
}
