import { createClient } from '@/lib/supabase-server';
import { LabOrder, type LabOrderStatus, type SafetyState } from '../domain/lab-order.entity';
import { Specimen } from '../domain/specimen.entity';
import { LabResult } from '../domain/lab-result.entity';
import { ILaboratoryRepository, ConcurrencyViolationError } from './laboratory-repository.interface';
import type { Database } from '@/types/database.types';

type LabOrderRow = Database['public']['Tables']['hc_lab_orders']['Row'];
type LabOrderInsert = Database['public']['Tables']['hc_lab_orders']['Insert'];

export class SupabaseLaboratoryRepository implements ILaboratoryRepository {
  private readonly TABLE = 'hc_lab_orders';

  constructor(private readonly supabase: Awaited<ReturnType<typeof createClient>>) {}

  public async findById(tenantId: string, id: string): Promise<LabOrder | null> {
    const { data, error } = await this.supabase
      .from(this.TABLE)
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw error;
    }
    if (!data) {
      return null;
    }

    return this.mapToDomain(data);
  }

  public async findByClinicalOrderId(tenantId: string, clinicalOrderId: string): Promise<LabOrder[]> {
    const { data, error } = await this.supabase
      .from(this.TABLE)
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('clinical_order_id', clinicalOrderId);

    if (error) {
      throw error;
    }

    return (data || []).map((row) => this.mapToDomain(row));
  }

  public async save(labOrder: LabOrder): Promise<void> {
    const dbRow = this.mapToDb(labOrder);

    // 1. Check if record exists
    const { data: existing, error: checkError } = await this.supabase
      .from(this.TABLE)
      .select('result_value, verified_at')
      .eq('tenant_id', labOrder.tenantId)
      .eq('id', labOrder.id)
      .maybeSingle();

    if (checkError) {
      throw checkError;
    }

    if (!existing) {
      // 2. Perform insert
      const { error: insertError } = await this.supabase
        .from(this.TABLE)
        .insert(dbRow);

      if (insertError) {
        throw insertError;
      }
    } else {
      // 3. Perform update with concurrency checks
      let query = this.supabase
        .from(this.TABLE)
        .update(dbRow)
        .eq('tenant_id', labOrder.tenantId)
        .eq('id', labOrder.id);

      // Concurrency Gate (Directive 4):
      // - If we are verifying (and DB was not verified yet), ensure verified_at is still null
      if (labOrder.status === 'VERIFIED' && existing.verified_at === null) {
        query = query.is('verified_at', null);
      }
      // - If we are recording results (and DB was not resulted yet), ensure result_value is still null
      else if (labOrder.status === 'RESULTED' && existing.result_value === null) {
        query = query.is('result_value', null);
      }

      const { data, error, status } = await query.select();

      if (error) {
        throw error;
      }

      // If no rows were updated, it means another transaction updated it first
      if (!data || data.length === 0) {
        throw new ConcurrencyViolationError(
          `Optimistic concurrency violation: LabOrder ${labOrder.id} has already been updated or verified.`
        );
      }
    }
  }

  // =========================================================================
  // Mapper logic (Anti-Corruption Layer)
  // =========================================================================

  private mapToDomain(row: LabOrderRow): LabOrder {
    // Determine status from fields, using STATUS: prefix mapping (ACL strategy)
    let status: LabOrderStatus = 'ORDERED';
    let realTubeColor = '';

    if (row.tube_color && row.tube_color.startsWith('STATUS:')) {
      const parts = row.tube_color.substring(7).split('|');
      status = parts[0] as LabOrderStatus;
      realTubeColor = parts[1] || '';
    } else {
      // Fallback legacy mapping
      if (row.verified_at) {
        status = 'VERIFIED';
      } else if (row.result_value !== null) {
        status = 'RESULTED';
      } else if (row.sample_type !== null) {
        status = 'PROCESSING';
      }
      realTubeColor = row.tube_color || '';
    }

    // Determine safety state
    let safetyState: SafetyState = 'NORMAL';
    if (row.is_panic_value) {
      safetyState = row.doctor_notified ? 'ACKNOWLEDGED' : 'ESCALATION_REQUIRED';
    }

    // Specimen sub-entity
    let specimen: Specimen | undefined;
    if (row.sample_type || realTubeColor || status !== 'ORDERED') {
      specimen = Specimen.create({
        sampleType: row.sample_type || 'Unknown Sample',
        tubeColor: realTubeColor,
        collectedAt: row.created_at ? new Date(row.created_at) : undefined,
        receivedAt: row.created_at ? new Date(row.created_at) : undefined,
        processingAt: row.created_at ? new Date(row.created_at) : undefined,
      });
    }

    // LabResult sub-entity
    let result: LabResult | undefined;
    if (row.result_value !== null) {
      result = LabResult.create({
        value: row.result_value,
        unit: row.result_unit || '',
        referenceRange: row.reference_range || '',
        assessment: row.is_panic_value ? 'CRITICAL' : (row.is_abnormal ? 'ABNORMAL' : 'NORMAL'),
        verifiedAt: row.verified_at ? new Date(row.verified_at) : undefined,
        verifiedBy: row.verified_by || undefined,
      });
    }

    return LabOrder.create({
      id: row.id,
      tenantId: row.tenant_id,
      encounterId: row.encounter_id,
      clinicalOrderId: row.clinical_order_id,
      patientId: row.encounter_id,
      testCode: row.test_code,
      testName: row.test_name,
      status,
      safetyState,
      specimen,
      result,
      version: row.verified_at ? 2 : 1,
      escalationRequired: Boolean(row.is_panic_value && !row.doctor_notified),
      acknowledgedBy: row.doctor_notified ? (row.verified_by || 'system') : undefined,
      acknowledgedAt: row.doctor_notified_time ? new Date(row.doctor_notified_time) : undefined,
    });
  }

  private mapToDb(aggregate: LabOrder): LabOrderInsert {
    const row: LabOrderInsert = {
      id: aggregate.id,
      tenant_id: aggregate.tenantId,
      encounter_id: aggregate.encounterId,
      clinical_order_id: aggregate.clinicalOrderId,
      test_code: aggregate.testCode,
      test_name: aggregate.testName,
    };

    if (aggregate.specimen) {
      row.sample_type = aggregate.specimen.sampleType;
      row.tube_color = `STATUS:${aggregate.status}|${aggregate.specimen.tubeColor}`;
    } else {
      row.tube_color = `STATUS:${aggregate.status}|`;
    }

    if (aggregate.result) {
      row.result_value = aggregate.result.value;
      row.result_unit = aggregate.result.unit;
      row.reference_range = aggregate.result.referenceRange;
      row.is_abnormal = aggregate.result.isAbnormal;
      row.is_panic_value = aggregate.result.isPanicValue;
      row.verified_at = aggregate.result.verifiedAt?.toISOString() || null;
      row.verified_by = aggregate.result.verifiedBy || null;
    }

    // Map safety state to legacy columns
    if (aggregate.safetyState === 'ACKNOWLEDGED') {
      row.doctor_notified = true;
      row.doctor_notified_time = aggregate.acknowledgedAt?.toISOString() || new Date().toISOString();
    } else if (aggregate.safetyState === 'ESCALATION_REQUIRED') {
      row.doctor_notified = false;
      row.doctor_notified_time = null;
    } else {
      row.doctor_notified = undefined;
    }

    return row;
  }
}
