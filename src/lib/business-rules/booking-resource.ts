import { parseIntegerInput } from '@/lib/utils';
import type { Json } from '@/types/database.types';

export const BOOKING_RESOURCE_TYPES = ['bed', 'room', 'machine', 'chair', 'other'] as const;
export const BOOKING_RESOURCE_STATUSES = ['available', 'in_use', 'maintenance', 'inactive'] as const;

export type BookingResourceType = (typeof BOOKING_RESOURCE_TYPES)[number];
export type BookingResourceStatus = (typeof BOOKING_RESOURCE_STATUSES)[number];

export type BookingResourceInput = {
  tenant_id?: string | null;
  branch_tenant_id?: string | null;
  name?: string | null;
  resource_type?: string | null;
  status?: string | null;
  capacity?: number | string | null;
  location_note?: string | null;
  metadata?: Json | null;
};

export type BookingResourcePayload = {
  tenant_id: string;
  branch_tenant_id: string | null;
  name: string;
  resource_type: BookingResourceType;
  status: BookingResourceStatus;
  capacity: number;
  location_note: string | null;
  metadata: Json;
};

export type BookingResourceRuleResult =
  | { success: true; payload: BookingResourcePayload }
  | { success: false; error: string };

function normalizeText(value: unknown) {
  return String(value ?? '').trim();
}

function isPlainJsonObject(value: unknown): value is Record<string, Json | undefined> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function normalizeBookingResourceType(
  value: string | null | undefined,
  fallback: BookingResourceType = 'bed',
): BookingResourceType {
  const normalized = value?.trim().toLowerCase();
  return BOOKING_RESOURCE_TYPES.includes(normalized as BookingResourceType)
    ? normalized as BookingResourceType
    : fallback;
}

export function normalizeOptionalBookingResourceType(value: string | null | undefined) {
  if (!value?.trim()) return null;
  return normalizeBookingResourceType(value);
}

export function normalizeBookingResourceStatus(
  value: string | null | undefined,
  fallback: BookingResourceStatus = 'available',
): BookingResourceStatus {
  const normalized = value?.trim().toLowerCase();
  return BOOKING_RESOURCE_STATUSES.includes(normalized as BookingResourceStatus)
    ? normalized as BookingResourceStatus
    : fallback;
}

export function buildBookingResourcePayload(
  input: BookingResourceInput,
  options: { tenantId?: string | null } = {},
): BookingResourceRuleResult {
  const tenantId = normalizeText(options.tenantId ?? input.tenant_id);
  if (!tenantId) {
    return { success: false, error: 'Thiếu chi nhánh sở hữu tài nguyên đặt lịch.' };
  }

  const name = normalizeText(input.name);
  if (!name) {
    return { success: false, error: 'Tên tài nguyên đặt lịch không được để trống.' };
  }

  return {
    success: true,
    payload: {
      tenant_id: tenantId,
      branch_tenant_id: normalizeText(input.branch_tenant_id) || null,
      name,
      resource_type: normalizeBookingResourceType(input.resource_type),
      status: normalizeBookingResourceStatus(input.status),
      capacity: parseIntegerInput(input.capacity, { min: 1, max: 20, fallback: 1 }),
      location_note: normalizeText(input.location_note) || null,
      metadata: isPlainJsonObject(input.metadata) ? input.metadata : {},
    },
  };
}
