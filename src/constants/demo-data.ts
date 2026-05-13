export const DEMO_CUSTOMERS = [
  { id: 'c1', name_mother: 'Nguyễn Thị Hoa', phone: '0901234567', name_baby: 'Gia Bảo', address: 'Quận 7, TP.HCM', status: 'active', dob_baby: '2026-03-15' },
  { id: 'c2', name_mother: 'Trần Thu Hà', phone: '0987654321', name_baby: 'Minh Anh', address: 'Quận 2, TP.HCM', status: 'active', dob_baby: '2026-01-20' },
  { id: 'c3', name_mother: 'Lê Diệu Linh', phone: '0912334455', name_baby: 'Chờ sinh', address: 'Quận 1, TP.HCM', status: 'active', dob_expected: '2026-06-10' },
  { id: 'c4', name_mother: 'Phạm Hải Yến', phone: '0933445566', name_baby: 'Chưa có', address: 'Quận Bình Thạnh, TP.HCM', status: 'active', dob_expected: '2026-08-15' },
  { id: 'c5', name_mother: 'Vũ Bích Thủy', phone: '0944556677', name_baby: 'Thành Công', address: 'Quận Phú Nhuận, TP.HCM', status: 'active', dob_baby: '2026-02-12' },
];

export const DEMO_BOOKINGS = [
  { 
    id: 'b1', 
    booking_number: 'BK-2026-001', 
    status: 'in_progress', 
    deposit_amount: 2000000, 
    full_price: 15500000, 
    start_date: '2026-04-01', 
    total_sessions: 15, 
    completed_sessions: 8,
    customers: { name_mother: 'Nguyễn Thị Hoa', phone: '0901234567' }
  },
  { 
    id: 'b2', 
    booking_number: 'BK-2026-002', 
    status: 'in_progress', 
    deposit_amount: 3000000, 
    full_price: 18200000, 
    start_date: '2026-03-10', 
    total_sessions: 20, 
    completed_sessions: 12,
    customers: { name_mother: 'Trần Thu Hà', phone: '0987654321' }
  },
  { 
    id: 'b3', 
    booking_number: 'BK-2026-003', 
    status: 'booked', 
    deposit_amount: 2000000, 
    full_price: 15500000, 
    start_date: '2026-06-15', 
    total_sessions: 15, 
    completed_sessions: 0,
    customers: { name_mother: 'Lê Diệu Linh', phone: '0912334455' }
  },
];

export const DEMO_SESSIONS = [
  { id: 's1', assigned_date: '2026-05-12', status: 'scheduled', bookings: { package_id: 'Standard', customers: { name_mother: 'Nguyễn Thị Hoa' } } },
  { id: 's2', assigned_date: '2026-05-12', status: 'scheduled', bookings: { package_id: 'Premium', customers: { name_mother: 'Trần Thu Hà' } } },
  { id: 's3', assigned_date: '2026-05-13', status: 'scheduled', bookings: { package_id: 'Standard', customers: { name_mother: 'Phạm Hải Yến' } } },
  { id: 's4', assigned_date: '2026-05-13', status: 'scheduled', bookings: { package_id: 'Gold', customers: { name_mother: 'Vũ Bích Thủy' } } },
];

export const DEMO_TECH_TOP = [
  { name: 'Nguyễn Thị Hoa', sessions: 52, rating: '4.9', status: 'Xuất Sắc', bonus: '+2,000k' },
  { name: 'Lê Thu Hà', sessions: 48, rating: '4.8', status: 'Xuất Sắc', bonus: '+2,000k' },
  { name: 'Phạm Minh Tuyết', sessions: 42, rating: '4.7', status: 'Tốt', bonus: '+1,500k' },
];

export const DEMO_REVENUE = {
  totalBalance: 113400000,
  totalRevenueMonth: 156200000,
  totalExpenseMonth: 42800000,
};
