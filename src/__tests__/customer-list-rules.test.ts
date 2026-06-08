import {
  isActiveCareBooking,
  selectCustomerDisplayBooking,
} from '@/app/dashboard/customers/customer-list-rules';

describe('customer list booking display rules', () => {
  it('prioritizes an active care package over a newer completed package', () => {
    const displayBooking = selectCustomerDisplayBooking([
      {
        package_name: 'Gói Thông Tắc Tia Sữa (Lẻ)',
        status: 'completed',
        is_in_care: false,
        total_sessions: 1,
        completed_sessions: 1,
        created_at: '2026-06-08T10:00:00.000Z',
      },
      {
        package_name: 'Tắm Bé Chuẩn Y Khoa Tại Nhà',
        status: 'in_progress',
        is_in_care: true,
        total_sessions: 15,
        completed_sessions: 3,
        created_at: '2026-06-01T10:00:00.000Z',
      },
    ]);

    expect(displayBooking?.package_name).toBe('Tắm Bé Chuẩn Y Khoa Tại Nhà');
    expect(isActiveCareBooking(displayBooking)).toBe(true);
  });

  it('treats booked package bookings as active even before the first session starts', () => {
    const displayBooking = selectCustomerDisplayBooking([
      {
        package_name: 'Tắm Bé Chuẩn Y Khoa Tại Nhà',
        status: 'booked',
        is_in_care: false,
        total_sessions: 15,
        completed_sessions: 0,
        created_at: '2026-06-01T10:00:00.000Z',
      },
    ]);

    expect(displayBooking?.package_name).toBe('Tắm Bé Chuẩn Y Khoa Tại Nhà');
    expect(isActiveCareBooking(displayBooking)).toBe(true);
  });

  it('does not mark completed packages as active care packages', () => {
    const displayBooking = selectCustomerDisplayBooking([
      {
        package_name: 'Gói Thông Tắc Tia Sữa (Lẻ)',
        status: 'completed',
        is_in_care: false,
        total_sessions: 1,
        completed_sessions: 1,
        created_at: '2026-06-08T10:00:00.000Z',
      },
    ]);

    expect(displayBooking?.package_name).toBe('Gói Thông Tắc Tia Sữa (Lẻ)');
    expect(isActiveCareBooking(displayBooking)).toBe(false);
  });
});
