export const MOCK_CUSTOMERS = [
  { id: '1', name_mother: 'Nguyễn Thu Thủy', name_baby: 'Gia Bảo', phone: '0901234567', address: 'Quận 7, TP.HCM', status: 'active', dob_baby: '2026-04-15' },
  { id: '2', name_mother: 'Trần Thị Mai', name_baby: 'Minh Anh', phone: '0987654321', address: 'Quận 2, TP.HCM', status: 'active', dob_baby: '2026-05-02' },
  { id: '3', name_mother: 'Lê Diệu Linh', name_baby: 'Chờ sinh', phone: '0912334455', address: 'Quận 1, TP.HCM', status: 'deposit', dob_expected: '2026-05-25', deposit_amount: '2,000,000đ', package_name: 'Mẹ Bầu Toàn Diện' },
  { id: '4', name_mother: 'Phạm Hải Yến', name_baby: 'Chưa có', phone: '0933445566', address: 'Quận Bình Thạnh, TP.HCM', status: 'lead', dob_expected: '2026-08-15' },
];

export const MOCK_SERVICES = [
  { 
    id: 's1', 
    name: 'Mẹ Bầu Toàn Diện', 
    price: '15,500,000đ', 
    duration: '90 phút/buổi', 
    sessions: 15,
    details: ['Massage body đá nóng', 'Chăm sóc da mặt thảo dược', 'Gội đầu dưỡng sinh'],
    offer: 'Tặng 01 buổi massage Foot',
    status: 'active'
  },
  { 
    id: 's2', 
    name: 'Phục Hồi Sau Sinh', 
    price: '18,200,000đ', 
    duration: '120 phút/buổi', 
    sessions: 20,
    details: ['Xông hơ toàn thân', 'Massage bụng giảm eo', 'Chăm sóc vết mổ/vết khâu'],
    offer: 'Giảm 10% khi đăng ký nhóm 2 người',
    status: 'active'
  },
  { 
    id: 's3', 
    name: 'Chăm Sóc Bé Pro', 
    price: '12,000,000đ', 
    duration: '60 phút/buổi', 
    sessions: 10,
    details: ['Tắm bé chuẩn y khoa', 'Massage bé giúp ngủ ngon', 'Vệ sinh rốn/mắt/mũi'],
    offer: 'Tặng bộ set quà tặng sơ sinh',
    status: 'active'
  },
];

export const MOCK_BOOKINGS = [
  {
    id: 'b1',
    customer_id: '1',
    booking_number: 'BK-001',
    package_name: 'Mẹ Bầu Toàn Diện',
    status: 'in_progress',
    total_sessions: 15,
    completed_sessions: 9,
    deposit_amount: '2,000,000đ',
    full_price: '15,500,000đ',
    start_date: '2026-05-01',
    customers: {
      name_mother: 'Nguyễn Thu Thủy',
      phone: '0901234567'
    }
  },
  {
    id: 'b2',
    customer_id: '2',
    booking_number: 'BK-002',
    package_name: 'Phục Hồi Sau Sinh',
    status: 'in_progress',
    total_sessions: 20,
    completed_sessions: 13,
    deposit_amount: '3,000,000đ',
    full_price: '18,200,000đ',
    start_date: '2026-05-05',
    customers: {
      name_mother: 'Trần Thị Mai',
      phone: '0987654321'
    }
  },
  {
    id: 'b3',
    customer_id: '3',
    booking_number: 'BK-003',
    package_name: 'Mẹ Bầu Toàn Diện',
    status: 'booked',
    total_sessions: 15,
    completed_sessions: 1,
    deposit_amount: '2,000,000đ',
    full_price: '15,500,000đ',
    start_date: '2026-05-20',
    customers: {
      name_mother: 'Lê Diệu Linh',
      phone: '0912334455'
    }
  }
];

export const MOCK_DASHBOARD_STATS = {
  totalCustomers: 128,
  todayBookings: 12,
  totalRevenue: '1.2B',
  avgRating: '4.9'
};

export const MOCK_TOP_KTVS = [
  { name: 'Nguyễn Thị Hoa', sessions: 45, rating: '5.0', status: 'Xuất Sắc', bonus: '+2,000k' },
  { name: 'Lê Thu Hà', sessions: 38, rating: '4.9', status: 'Xuất Sắc', bonus: '+1,500k' },
  { name: 'Phạm Minh Tuyết', sessions: 32, rating: '4.8', status: 'Tốt', bonus: '+1,200k' },
];

export const MOCK_SESSIONS = [
  { id: 'sl1', booking_id: 'b1', session_number: 1, type: 'Massage body', ktv: 'Lê Hoa', status: 'completed', date: '2026-05-01' },
  { id: 'sl2', booking_id: 'b1', session_number: 2, type: 'Chăm sóc da mặt', ktv: 'Lê Hoa', status: 'completed', date: '2026-05-04' },
  { id: 'sl3', booking_id: 'b1', session_number: 3, type: 'Gội đầu dưỡng sinh', ktv: 'Trần Tâm', status: 'completed', date: '2026-05-08' },
  { id: 'sl4', booking_id: 'b1', session_number: 9, type: 'Massage body', ktv: 'Chờ phân công', status: 'scheduled', date: '2026-05-15' },
];
