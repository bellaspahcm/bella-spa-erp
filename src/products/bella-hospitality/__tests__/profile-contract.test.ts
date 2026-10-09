import {
  HOSPITALITY_PROFILE_IDS,
  resolveHospitalityProfileContract,
  validateHospitalityTenantProfile,
} from '../profile-contract';

describe('Bella Hospitality profile contract', () => {
  it('resolves all governed Hospitality tenant profiles', () => {
    expect(HOSPITALITY_PROFILE_IDS).toEqual([
      'hotel',
      'homestay',
      'serviced_apartment',
      'short_stay_rental',
    ]);

    for (const profileId of HOSPITALITY_PROFILE_IDS) {
      const contract = resolveHospitalityProfileContract(profileId);
      expect(contract).toEqual(expect.objectContaining({
        id: profileId,
        displayName: expect.any(String),
        description: expect.any(String),
        capabilities: expect.arrayContaining([
          'property_rooms',
          'guest_reservations',
          'front_office_stays',
          'folios',
          'housekeeping',
          'maintenance',
        ]),
        defaults: expect.objectContaining({
          frontDeskMode: expect.any(String),
          housekeepingCadence: expect.any(String),
          maintenancePriority: expect.any(String),
        }),
      }));
    }
  });

  it('rejects unknown or incompatible Hospitality profile configuration', () => {
    expect(resolveHospitalityProfileContract('villa')).toBeNull();
    expect(validateHospitalityTenantProfile('villa', {})).toEqual({
      success: false,
      error: 'Hospitality profile không được hỗ trợ.',
    });

    expect(validateHospitalityTenantProfile('hotel', {
      channelManagerMode: 'ota',
    })).toEqual({
      success: false,
      error: 'Hospitality config không hỗ trợ: channelManagerMode.',
    });

    expect(validateHospitalityTenantProfile('short_stay_rental', {
      frontDeskMode: 'full_service',
    })).toEqual({
      success: false,
      error: 'Hospitality frontDeskMode không tương thích với profile đã chọn.',
    });
  });
});
