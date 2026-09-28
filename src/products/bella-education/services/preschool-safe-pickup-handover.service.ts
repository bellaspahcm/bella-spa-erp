import type { SupabaseClient } from '@supabase/supabase-js';

const AUTHORIZED_STATUS = 'authorized';

type BellaEducationClient = SupabaseClient;

interface HandoverEventRow {
  readonly id: string;
  readonly tenant_id: string;
  readonly student_party_id: string;
  readonly guardian_party_id: string;
  readonly pickup_authorization_id: string;
  readonly handed_over_at: string;
  readonly handed_over_by: string;
  readonly created_at: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function hasStringField(value: Record<string, unknown>, field: keyof HandoverEventRow): boolean {
  return typeof value[field] === 'string';
}

function isHandoverEventRow(value: unknown): value is HandoverEventRow {
  if (!isRecord(value)) return false;

  return (
    hasStringField(value, 'id')
    && hasStringField(value, 'tenant_id')
    && hasStringField(value, 'student_party_id')
    && hasStringField(value, 'guardian_party_id')
    && hasStringField(value, 'pickup_authorization_id')
    && hasStringField(value, 'handed_over_at')
    && hasStringField(value, 'handed_over_by')
    && hasStringField(value, 'created_at')
  );
}

export interface RecordPreschoolHandoverInput {
  readonly tenantId: string;
  readonly studentPartyId: string;
  readonly guardianPartyId: string;
  readonly pickupAuthorizationId: string;
  readonly operatorUserId: string;
}

export interface PreschoolHandoverDTO {
  readonly id: string;
  readonly tenantId: string;
  readonly studentPartyId: string;
  readonly guardianPartyId: string;
  readonly pickupAuthorizationId: string;
  readonly handedOverAt: string;
  readonly handedOverBy: string;
}

export class PreschoolSafePickupHandoverService {
  constructor(private readonly supabase: BellaEducationClient) {}

  async recordHandover(input: RecordPreschoolHandoverInput): Promise<PreschoolHandoverDTO> {
    await this.assertPartyBelongsToTenant(input.tenantId, input.studentPartyId, 'Student');
    await this.assertPartyBelongsToTenant(input.tenantId, input.guardianPartyId, 'Guardian');
    await this.assertActiveAuthorization(input);

    const existingToday = await this.findTodayHandover(input.tenantId, input.studentPartyId);
    if (existingToday) {
      if (
        existingToday.guardian_party_id !== input.guardianPartyId
        || existingToday.pickup_authorization_id !== input.pickupAuthorizationId
      ) {
        throw new Error('STUDENT_ALREADY_HANDED_OVER_TODAY');
      }

      return this.toDTO(existingToday);
    }

    const { data, error } = await this.supabase
      .from('edu_preschool_pickup_handover_events')
      .insert({
        tenant_id: input.tenantId,
        student_party_id: input.studentPartyId,
        guardian_party_id: input.guardianPartyId,
        pickup_authorization_id: input.pickupAuthorizationId,
        handed_over_by: input.operatorUserId,
      })
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to record Preschool handover: ${error.message}`);
    }
    if (!isHandoverEventRow(data)) {
      throw new Error('Failed to read Preschool handover after insert');
    }

    return this.toDTO(data);
  }

  async getLatestHandovers(
    tenantId: string,
    studentPartyIds: readonly string[],
  ): Promise<Map<string, PreschoolHandoverDTO>> {
    const uniqueStudentPartyIds = [...new Set(studentPartyIds)].filter(Boolean);
    const handoversByStudent = new Map<string, PreschoolHandoverDTO>();

    if (uniqueStudentPartyIds.length === 0) {
      return handoversByStudent;
    }

    const { data, error } = await this.supabase
      .from('edu_preschool_pickup_handover_events')
      .select('*')
      .eq('tenant_id', tenantId)
      .in('student_party_id', uniqueStudentPartyIds)
      .order('handed_over_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to load Preschool handovers: ${error.message}`);
    }

    const rows: unknown[] = Array.isArray(data) ? data : [];
    for (const row of rows) {
      if (!isHandoverEventRow(row)) {
        continue;
      }
      if (!handoversByStudent.has(row.student_party_id)) {
        handoversByStudent.set(row.student_party_id, this.toDTO(row));
      }
    }

    return handoversByStudent;
  }

  private async assertPartyBelongsToTenant(
    tenantId: string,
    partyId: string,
    label: 'Student' | 'Guardian',
  ): Promise<void> {
    const { data, error } = await this.supabase
      .from('party_parties')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('id', partyId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to validate ${label} Party: ${error.message}`);
    }
    if (!data) {
      throw new Error(`${label.toUpperCase()}_PARTY_NOT_FOUND_FOR_TENANT`);
    }
  }

  private async assertActiveAuthorization(input: RecordPreschoolHandoverInput): Promise<void> {
    const { data, error } = await this.supabase
      .from('edu_preschool_pickup_authorizations')
      .select('id')
      .eq('id', input.pickupAuthorizationId)
      .eq('tenant_id', input.tenantId)
      .eq('student_party_id', input.studentPartyId)
      .eq('guardian_party_id', input.guardianPartyId)
      .eq('status', AUTHORIZED_STATUS)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to validate Preschool pickup authorization: ${error.message}`);
    }
    if (!data) {
      throw new Error('ACTIVE_PICKUP_AUTHORIZATION_NOT_FOUND');
    }
  }

  private async findTodayHandover(tenantId: string, studentPartyId: string): Promise<HandoverEventRow | null> {
    const { start, end } = this.todayHoChiMinhWindow();
    const { data, error } = await this.supabase
      .from('edu_preschool_pickup_handover_events')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('student_party_id', studentPartyId)
      .gte('handed_over_at', start)
      .lt('handed_over_at', end)
      .order('handed_over_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to read current Preschool handover state: ${error.message}`);
    }

    return isHandoverEventRow(data) ? data : null;
  }

  private todayHoChiMinhWindow(): { start: string; end: string } {
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    const start = new Date(`${today}T00:00:00+07:00`);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

    return {
      start: start.toISOString(),
      end: end.toISOString(),
    };
  }

  private toDTO(row: HandoverEventRow): PreschoolHandoverDTO {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      studentPartyId: row.student_party_id,
      guardianPartyId: row.guardian_party_id,
      pickupAuthorizationId: row.pickup_authorization_id,
      handedOverAt: row.handed_over_at,
      handedOverBy: row.handed_over_by,
    };
  }
}
