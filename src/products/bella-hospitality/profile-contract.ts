export const HOSPITALITY_PROFILE_IDS = [
  'hotel',
  'homestay',
  'serviced_apartment',
  'short_stay_rental',
] as const;

export const HOSPITALITY_FRONT_DESK_MODES = [
  'full_service',
  'scheduled',
  'self_check_in',
] as const;

export const HOSPITALITY_HOUSEKEEPING_CADENCES = [
  'daily',
  'on_request',
  'turnover_only',
] as const;

export const HOSPITALITY_MAINTENANCE_PRIORITIES = [
  'standard',
  'guest_blocking_first',
  'owner_approval_required',
] as const;

export type HospitalityProfileId = (typeof HOSPITALITY_PROFILE_IDS)[number];
export type HospitalityFrontDeskMode = (typeof HOSPITALITY_FRONT_DESK_MODES)[number];
export type HospitalityHousekeepingCadence = (typeof HOSPITALITY_HOUSEKEEPING_CADENCES)[number];
export type HospitalityProfileMaintenancePriority = (typeof HOSPITALITY_MAINTENANCE_PRIORITIES)[number];
export type HospitalityMaintenancePriority = HospitalityProfileMaintenancePriority;

export type HospitalityTenantConfiguration = {
  frontDeskMode: HospitalityFrontDeskMode;
  housekeepingCadence: HospitalityHousekeepingCadence;
  maintenancePriority: HospitalityProfileMaintenancePriority;
};

export type HospitalityProfileContract = {
  id: HospitalityProfileId;
  displayName: string;
  description: string;
  capabilities: readonly string[];
  supportedConfiguration: {
    frontDeskMode: readonly HospitalityFrontDeskMode[];
    housekeepingCadence: readonly HospitalityHousekeepingCadence[];
    maintenancePriority: readonly HospitalityProfileMaintenancePriority[];
  };
  defaults: HospitalityTenantConfiguration;
};

export type HospitalityTenantProfile = {
  profileId: HospitalityProfileId;
  displayName: string;
  description: string;
  capabilities: string[];
  configuration: HospitalityTenantConfiguration;
};

export type HospitalityProfileValidationResult =
  | { success: true; profile: HospitalityTenantProfile }
  | { success: false; error: string };

const HOSPITALITY_PROFILE_CONTRACTS: Record<HospitalityProfileId, HospitalityProfileContract> = {
  hotel: {
    id: 'hotel',
    displayName: 'Hotel',
    description: 'Full-service hotel operations with front desk, room turnover, and guest-blocking maintenance.',
    capabilities: ['property_rooms', 'guest_reservations', 'front_office_stays', 'folios', 'housekeeping', 'maintenance'],
    supportedConfiguration: {
      frontDeskMode: ['full_service', 'scheduled'],
      housekeepingCadence: ['daily', 'on_request'],
      maintenancePriority: ['standard', 'guest_blocking_first'],
    },
    defaults: {
      frontDeskMode: 'full_service',
      housekeepingCadence: 'daily',
      maintenancePriority: 'guest_blocking_first',
    },
  },
  homestay: {
    id: 'homestay',
    displayName: 'Homestay',
    description: 'Owner-operated accommodation with scheduled guest handling and lighter housekeeping cadence.',
    capabilities: ['property_rooms', 'guest_reservations', 'front_office_stays', 'folios', 'housekeeping', 'maintenance'],
    supportedConfiguration: {
      frontDeskMode: ['scheduled', 'self_check_in'],
      housekeepingCadence: ['on_request', 'turnover_only'],
      maintenancePriority: ['standard', 'owner_approval_required'],
    },
    defaults: {
      frontDeskMode: 'scheduled',
      housekeepingCadence: 'turnover_only',
      maintenancePriority: 'owner_approval_required',
    },
  },
  serviced_apartment: {
    id: 'serviced_apartment',
    displayName: 'Serviced Apartment',
    description: 'Apartment-style stays with scheduled service, recurring housekeeping, and standard maintenance handling.',
    capabilities: ['property_rooms', 'guest_reservations', 'front_office_stays', 'folios', 'housekeeping', 'maintenance'],
    supportedConfiguration: {
      frontDeskMode: ['scheduled', 'self_check_in'],
      housekeepingCadence: ['daily', 'on_request'],
      maintenancePriority: ['standard', 'guest_blocking_first'],
    },
    defaults: {
      frontDeskMode: 'scheduled',
      housekeepingCadence: 'on_request',
      maintenancePriority: 'standard',
    },
  },
  short_stay_rental: {
    id: 'short_stay_rental',
    displayName: 'Short-stay Rental',
    description: 'Short-stay rental operations optimized for self check-in and turnover-based housekeeping.',
    capabilities: ['property_rooms', 'guest_reservations', 'front_office_stays', 'folios', 'housekeeping', 'maintenance'],
    supportedConfiguration: {
      frontDeskMode: ['self_check_in'],
      housekeepingCadence: ['turnover_only'],
      maintenancePriority: ['standard', 'owner_approval_required'],
    },
    defaults: {
      frontDeskMode: 'self_check_in',
      housekeepingCadence: 'turnover_only',
      maintenancePriority: 'standard',
    },
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function includesValue<T extends string>(values: readonly T[], value: unknown): value is T {
  return typeof value === 'string' && values.includes(value as T);
}

export function isHospitalityProfileId(value: unknown): value is HospitalityProfileId {
  return includesValue(HOSPITALITY_PROFILE_IDS, value);
}

export function getHospitalityProfileContract(
  profileId: HospitalityProfileId,
): HospitalityProfileContract {
  return HOSPITALITY_PROFILE_CONTRACTS[profileId];
}

export function resolveHospitalityProfileContract(
  profileId: unknown,
): HospitalityProfileContract | null {
  return isHospitalityProfileId(profileId)
    ? getHospitalityProfileContract(profileId)
    : null;
}

export function validateHospitalityTenantProfile(
  profileId: unknown,
  configuration: unknown,
): HospitalityProfileValidationResult {
  const contract = resolveHospitalityProfileContract(profileId);
  if (!contract) {
    return { success: false, error: 'Hospitality profile không được hỗ trợ.' };
  }

  const source = isRecord(configuration) ? configuration : {};
  const unsupportedKeys = Object.keys(source).filter((key) => ![
    'frontDeskMode',
    'housekeepingCadence',
    'maintenancePriority',
  ].includes(key));
  if (unsupportedKeys.length > 0) {
    return {
      success: false,
      error: `Hospitality config không hỗ trợ: ${unsupportedKeys.join(', ')}.`,
    };
  }

  const frontDeskMode = source.frontDeskMode ?? contract.defaults.frontDeskMode;
  const housekeepingCadence = source.housekeepingCadence ?? contract.defaults.housekeepingCadence;
  const maintenancePriority = source.maintenancePriority ?? contract.defaults.maintenancePriority;

  if (!includesValue(contract.supportedConfiguration.frontDeskMode, frontDeskMode)) {
    return { success: false, error: 'Hospitality frontDeskMode không tương thích với profile đã chọn.' };
  }
  if (!includesValue(contract.supportedConfiguration.housekeepingCadence, housekeepingCadence)) {
    return { success: false, error: 'Hospitality housekeepingCadence không tương thích với profile đã chọn.' };
  }
  if (!includesValue(contract.supportedConfiguration.maintenancePriority, maintenancePriority)) {
    return { success: false, error: 'Hospitality maintenancePriority không tương thích với profile đã chọn.' };
  }

  return {
    success: true,
    profile: {
      profileId: contract.id,
      displayName: contract.displayName,
      description: contract.description,
      capabilities: [...contract.capabilities],
      configuration: {
        frontDeskMode,
        housekeepingCadence,
        maintenancePriority,
      },
    },
  };
}
