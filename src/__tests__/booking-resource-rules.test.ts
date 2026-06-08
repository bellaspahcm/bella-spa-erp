import {
  buildBookingResourcePayload,
  normalizeBookingResourceStatus,
  normalizeBookingResourceType,
} from '@/lib/business-rules/booking-resource';

describe('booking resource business rules', () => {
  it('normalizes resource type, status, capacity, and tenant ownership', () => {
    expect(buildBookingResourcePayload({
      name: ' Giường Facial 01 ',
      resource_type: 'ROOM',
      status: 'maintenance',
      capacity: '2',
      location_note: ' Tầng 2 ',
      metadata: { has_shower: true },
    }, { tenantId: 'tenant-1' })).toEqual({
      success: true,
      payload: {
        tenant_id: 'tenant-1',
        branch_tenant_id: null,
        name: 'Giường Facial 01',
        resource_type: 'room',
        status: 'maintenance',
        capacity: 2,
        location_note: 'Tầng 2',
        metadata: { has_shower: true },
      },
    });

    expect(normalizeBookingResourceType('laser')).toBe('bed');
    expect(normalizeBookingResourceStatus('busy')).toBe('available');
  });

  it('fails closed before database writes when required resource fields are missing', () => {
    expect(buildBookingResourcePayload({ name: 'Room 1' })).toEqual({
      success: false,
      error: 'Thiếu chi nhánh sở hữu tài nguyên đặt lịch.',
    });

    expect(buildBookingResourcePayload({ name: '' }, { tenantId: 'tenant-1' })).toEqual({
      success: false,
      error: 'Tên tài nguyên đặt lịch không được để trống.',
    });
  });
});
