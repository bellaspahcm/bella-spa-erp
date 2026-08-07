import {
  getAppointmentsAction,
  updateAppointmentStatusAction,
  createAppointmentAction,
  sendAppointmentReminderAction
} from '@/services/healthcare/appointments-actions';

const mockSingle = jest.fn();
const mockSelect = jest.fn();
const mockUpdate = jest.fn();
const mockInsert = jest.fn();
const mockEq = jest.fn();
const mockOrder = jest.fn();

const mockSupabase = {
  from: jest.fn(() => ({
    select: mockSelect,
    update: mockUpdate,
    insert: mockInsert,
    eq: mockEq,
    order: mockOrder,
    single: mockSingle,
    maybeSingle: mockSingle,
  })),
};

// Chainable mock setup
const getChain = () => ({
  eq: mockEq,
  order: mockOrder,
  single: mockSingle,
  maybeSingle: mockSingle,
  select: mockSelect,
});

mockSelect.mockImplementation(getChain);
mockUpdate.mockImplementation(getChain);
mockInsert.mockImplementation(getChain);
mockEq.mockImplementation(getChain);
mockOrder.mockResolvedValue({ data: [], error: null });
mockSingle.mockResolvedValue({ data: null, error: null });

jest.mock('@/lib/supabase-dev-bypass-server', () => ({
  createDevelopmentBypassClient: jest.fn(() => Promise.resolve(mockSupabase)),
}));

jest.mock('@/services/user-actions', () => ({
  getCurrentUser: jest.fn(() => Promise.resolve({ tenant_id: 'test-tenant-id' })),
}));

describe('Healthcare Appointments Server Actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockOrder.mockResolvedValue({ data: [], error: null });
    mockSingle.mockResolvedValue({ data: null, error: null });
  });

  it('should fetch appointments successfully', async () => {
    const mockData = [
      {
        appointment_code: 'APP-8801',
        patient_name: 'Trần Minh Hoàng',
        patient_phone: '0908 123 456',
        specialty: 'Khoa Tim Mạch',
        doctor_name: 'BS. CKII Nguyễn Văn Minh',
        appointment_date: '2026-08-07',
        slot_time: '08:30 - 09:00',
        status: 'confirmed',
        channel: 'online_website',
        qr_code: 'QR-APP-8801',
        reminder_sent: true,
        notes: 'Bệnh nhân tái khám',
      },
    ];

    mockSelect.mockReturnValueOnce({
      eq: jest.fn().mockReturnValueOnce({
        order: jest.fn().mockResolvedValueOnce({ data: mockData, error: null }),
      }),
    });

    const result = await getAppointmentsAction();

    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(1);
    expect(result.data?.[0].id).toBe('APP-8801');
    expect(result.data?.[0].patientName).toBe('Trần Minh Hoàng');
  });

  it('should filter appointments by date successfully', async () => {
    const mockData = [
      {
        appointment_code: 'APP-8802',
        patient_name: 'Lê Thị Mai',
        patient_phone: '0908 123 456',
        specialty: 'Khoa Tim Mạch',
        doctor_name: 'BS. CKII Nguyễn Văn Minh',
        appointment_date: '2026-08-07',
        slot_time: '08:30 - 09:00',
        status: 'confirmed',
        channel: 'online_website',
        qr_code: 'QR-APP-8802',
        reminder_sent: true,
        notes: 'Bệnh nhân tái khám',
      },
    ];

    const mockEqChain = {
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockResolvedValueOnce({ data: mockData, error: null }),
    };

    mockSelect.mockReturnValueOnce({
      eq: jest.fn().mockReturnValueOnce(mockEqChain),
    });

    const result = await getAppointmentsAction('2026-08-07');

    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(1);
    expect(result.data?.[0].id).toBe('APP-8802');
    expect(result.data?.[0].patientName).toBe('Lê Thị Mai');
  });

  it('should create an appointment successfully', async () => {
    const mockCreatedRow = {
      appointment_code: 'APP-8806',
      patient_name: 'Nguyễn Văn A',
      patient_phone: '0900111222',
      specialty: 'Khoa Nhi',
      doctor_name: 'BS. Test',
      appointment_date: '2026-08-07',
      slot_time: '08:00 - 08:30',
      status: 'confirmed',
      channel: 'online_website',
      qr_code: 'QR-APP-1234',
      reminder_sent: true,
      notes: 'New notes',
    };

    mockInsert.mockReturnValueOnce({
      select: jest.fn().mockReturnValueOnce({
        single: jest.fn().mockResolvedValueOnce({ data: mockCreatedRow, error: null }),
      }),
    });

    const result = await createAppointmentAction({
      patientName: 'Nguyễn Văn A',
      patientPhone: '0900111222',
      specialty: 'Khoa Nhi',
      doctorName: 'BS. Test',
      slotTime: '08:00 - 08:30',
      notes: 'New notes',
    });

    expect(result.success).toBe(true);
    expect(result.data?.id).toBe('APP-8806');
    expect(result.data?.patientName).toBe('Nguyễn Văn A');
  });

  it('should update appointment status successfully', async () => {
    mockUpdate.mockReturnValueOnce({
      eq: jest.fn().mockReturnValueOnce({
        eq: jest.fn().mockResolvedValueOnce({ error: null }),
      }),
    });

    const result = await updateAppointmentStatusAction('APP-8801', 'checked_in');

    expect(result.success).toBe(true);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'checked_in' })
    );
  });

  it('should send appointment reminder successfully', async () => {
    mockUpdate.mockReturnValueOnce({
      eq: jest.fn().mockReturnValueOnce({
        eq: jest.fn().mockResolvedValueOnce({ error: null }),
      }),
    });

    const result = await sendAppointmentReminderAction('APP-8801');

    expect(result.success).toBe(true);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ reminder_sent: true })
    );
  });
});
