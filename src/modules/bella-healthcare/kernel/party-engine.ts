import { partyEngine, type Party, type PartyRole } from '@/platform';

export interface CreatePatientInput {
  readonly displayName: string;
  readonly legalName?: string;
  readonly dob?: Date;
  readonly gender?: 'male' | 'female' | 'other';
  readonly bloodType?: string;
  readonly bhytNumber?: string;
  readonly nationalId?: string; // CCCD
}

export class HealthcarePartyEngine {
  /**
   * Đăng ký một bệnh nhân mới vào hệ thống Party.
   */
  async registerPatient(
    tenantId: string,
    input: CreatePatientInput,
    actorId: string
  ): Promise<Party> {
    const initialIdentifiers = [];
    if (input.bhytNumber) {
      initialIdentifiers.push({ type: 'bhyt', value: input.bhytNumber });
    }
    if (input.nationalId) {
      initialIdentifiers.push({ type: 'cccd', value: input.nationalId });
    }

    const initialRole: Omit<PartyRole, 'attributes'> & { attributes?: Record<string, unknown> } = {
      vertical: 'healthcare',
      roleType: 'patient',
      attributes: {
        registered_at: new Date().toISOString(),
      },
    };

    return partyEngine.register(
      tenantId,
      {
        partyType: 'person',
        displayName: input.displayName,
        legalName: input.legalName,
        dob: input.dob,
        gender: input.gender,
        bloodType: input.bloodType,
        initialRole,
        initialIdentifiers,
      },
      actorId
    );
  }

  /**
   * Tìm kiếm bệnh nhân theo số BHYT.
   */
  async findPatientByBhyt(tenantId: string, bhytNumber: string): Promise<Party | null> {
    return partyEngine.findByIdentifier(tenantId, 'bhyt', bhytNumber);
  }

  /**
   * Tìm kiếm bệnh nhân theo số CCCD.
   */
  async findPatientByNationalId(tenantId: string, cccd: string): Promise<Party | null> {
    return partyEngine.findByIdentifier(tenantId, 'cccd', cccd);
  }

  /**
   * Thiết lập quan hệ Người giám hộ (Guardian) giữa hai bệnh nhân (phổ biến cho Mẹ & Bé).
   */
  async assignGuardian(
    tenantId: string,
    childPartyId: string,
    guardianPartyId: string,
    actorId: string
  ): Promise<void> {
    await partyEngine.linkParties(
      tenantId,
      {
        sourcePartyId: childPartyId,
        targetPartyId: guardianPartyId,
        type: 'guardian_of',
        attributes: { linked_at: new Date().toISOString() },
      },
      actorId
    );
  }
}

export const healthcarePartyEngine = new HealthcarePartyEngine();
