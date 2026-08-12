/**
 * Bed Engine Domain Events
 *
 * @module platform/healthcare/engines/bed-engine/events
 */

export interface BedAllocatedPayload {
  bedId: string;
  tenantId: string;
  wardId: string;
  bedCode: string;
  bedType: string;
  patientPartyId: string;
  admissionId: string;
  encounterId: string;
  allocatedAt: string;
  dailyRate: number;
}

export interface BedReleasedPayload {
  bedId: string;
  tenantId: string;
  wardId: string;
  bedCode: string;
  reason: string;
  releasedAt: string;
}

export interface BedTransferredPayload {
  tenantId: string;
  fromBedId: string;
  toBedId: string;
  patientPartyId: string;
  admissionId: string;
  encounterId: string;
  transferredAt: string;
}

export const BED_EVENT_TYPES = {
  BED_ALLOCATED: 'hos.bed.allocated.v1',
  BED_RELEASED: 'hos.bed.released.v1',
  BED_TRANSFERRED: 'hos.bed.transferred.v1',
} as const;
