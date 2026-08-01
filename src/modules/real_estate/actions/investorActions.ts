'use server';

export interface InvestorInteractionRecord {
  id: string;
  type: 'call' | 'viewing' | 'email' | 'meeting' | 'whatsapp';
  notes: string;
  date: string;
  staffName: string;
}

export interface InvestorRecord {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  cccd: string;
  budgetMin: number;
  budgetMax: number;
  interestedProjects: string[];
  status: 'lead' | 'contacted' | 'negotiating' | 'closed_won' | 'closed_lost';
  source: 'facebook' | 'zalo' | 'referral' | 'website' | 'event' | 'cold_call';
  saleOwner: string;
  createdAt: string;
  lastContactedAt?: string;
  interactions: InvestorInteractionRecord[];
  note?: string;
}

const DEMO_INVESTORS: InvestorRecord[] = [
  {
    id: 'inv-001',
    fullName: 'Lê Văn Chánh',
    phone: '0901 234 567',
    email: 'le.chanh@gmail.com',
    cccd: '079080012345',
    budgetMin: 3_000_000_000,
    budgetMax: 5_000_000_000,
    interestedProjects: ['Bella Residences'],
    status: 'negotiating',
    source: 'facebook',
    saleOwner: 'Trần Minh Tuấn',
    createdAt: '2026-06-15',
    lastContactedAt: '2026-07-30',
    note: 'Ưu tiên căn view sông, tầng cao. Sẵn sàng đặt cọc nếu giá hợp lý.',
    interactions: [
      { id: 'int-1', type: 'call', notes: 'Khách hàng liên hệ từ quảng cáo Facebook, quan tâm dự án Bella Residences.', date: '2026-06-15T09:00:00Z', staffName: 'Trần Minh Tuấn' },
      { id: 'int-2', type: 'viewing', notes: 'Tham quan thực tế căn A-1201. Khách thích view, muốn xem thêm bảng giá chi tiết.', date: '2026-06-22T14:30:00Z', staffName: 'Trần Minh Tuấn' },
      { id: 'int-3', type: 'meeting', notes: 'Họp tư vấn tài chính, ngân hàng hỗ trợ 70% vay. Cần duyệt hồ sơ vay.', date: '2026-07-10T10:00:00Z', staffName: 'Trần Minh Tuấn' },
      { id: 'int-4', type: 'call', notes: 'Cập nhật tình trạng hồ sơ vay ngân hàng. Dự kiến ký HĐMB tuần tới.', date: '2026-07-30T16:00:00Z', staffName: 'Trần Minh Tuấn' },
    ],
  },
  {
    id: 'inv-002',
    fullName: 'Phạm Thị Diễm',
    phone: '0912 345 678',
    email: 'phamthidiem@hotmail.com',
    cccd: '001080054321',
    budgetMin: 5_000_000_000,
    budgetMax: 10_000_000_000,
    interestedProjects: ['Bella Premium'],
    status: 'contacted',
    source: 'referral',
    saleOwner: 'Lê Thị Hoa',
    createdAt: '2026-07-01',
    lastContactedAt: '2026-07-25',
    interactions: [
      { id: 'int-5', type: 'email', notes: 'Gửi brochure dự án Bella Premium kèm chính sách ưu đãi.', date: '2026-07-01T08:30:00Z', staffName: 'Lê Thị Hoa' },
      { id: 'int-6', type: 'call', notes: 'Khách hỏi thêm về chính sách ký gửi và cho thuê sinh lời.', date: '2026-07-25T11:00:00Z', staffName: 'Lê Thị Hoa' },
    ],
  },
  {
    id: 'inv-003',
    fullName: 'Hoàng Minh Đức',
    phone: '0933 111 222',
    email: 'hmduc@company.vn',
    cccd: '036070078900',
    budgetMin: 10_000_000_000,
    budgetMax: 20_000_000_000,
    interestedProjects: ['Bella Premium', 'Bella Sky'],
    status: 'lead',
    source: 'event',
    saleOwner: 'Nguyễn Thị Mai',
    createdAt: '2026-07-28',
    interactions: [],
  },
  {
    id: 'inv-004',
    fullName: 'Vũ Thị Thanh Hà',
    phone: '0909 888 777',
    email: 'vtha@gmail.com',
    cccd: '048070011111',
    budgetMin: 2_000_000_000,
    budgetMax: 4_000_000_000,
    interestedProjects: ['Bella Residences'],
    status: 'closed_won',
    source: 'website',
    saleOwner: 'Trần Minh Tuấn',
    createdAt: '2026-04-01',
    lastContactedAt: '2026-07-15',
    note: 'Đã ký HĐMB căn B-0802. Đang hoàn thiện hồ sơ pháp lý.',
    interactions: [
      { id: 'int-7', type: 'call', notes: 'Khách hàng lần đầu liên hệ qua website.', date: '2026-04-01T10:00:00Z', staffName: 'Trần Minh Tuấn' },
      { id: 'int-8', type: 'viewing', notes: 'Tham quan căn mẫu, rất hài lòng.', date: '2026-04-10T14:00:00Z', staffName: 'Trần Minh Tuấn' },
      { id: 'int-9', type: 'meeting', notes: 'Đàm phán giá và chính sách. Chốt giá final.', date: '2026-07-10T09:00:00Z', staffName: 'Trần Minh Tuấn' },
    ],
  },
];

export async function fetchInvestorsAction(): Promise<{ success: boolean; data?: InvestorRecord[]; error?: string }> {
  try {
    return { success: true, data: DEMO_INVESTORS };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, error: msg };
  }
}

export async function addInvestorInteractionAction(
  investorId: string,
  interaction: Omit<InvestorInteractionRecord, 'id' | 'date'>
): Promise<{ success: boolean; error?: string }> {
  try {
    const investor = DEMO_INVESTORS.find(i => i.id === investorId);
    if (!investor) throw new Error(`Investor ${investorId} not found`);
    investor.interactions.push({
      ...interaction,
      id: `int-${Date.now()}`,
      date: new Date().toISOString(),
    });
    investor.lastContactedAt = new Date().toISOString().split('T')[0];
    if (investor.status === 'lead') investor.status = 'contacted';
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, error: msg };
  }
}

export async function updateInvestorStatusAction(
  investorId: string,
  status: InvestorRecord['status']
): Promise<{ success: boolean; error?: string }> {
  try {
    const investor = DEMO_INVESTORS.find(i => i.id === investorId);
    if (!investor) throw new Error(`Investor ${investorId} not found`);
    investor.status = status;
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, error: msg };
  }
}

export async function createInvestorAction(
  data: Omit<InvestorRecord, 'id' | 'status' | 'createdAt' | 'interactions'>
): Promise<{ success: boolean; data?: InvestorRecord; error?: string }> {
  try {
    const newId = `inv-${String(DEMO_INVESTORS.length + 1).padStart(3, '0')}`;
    const newInvestor: InvestorRecord = {
      id: newId,
      status: 'lead',
      createdAt: new Date().toISOString().split('T')[0],
      interactions: [],
      ...data,
    };
    DEMO_INVESTORS.push(newInvestor);
    return { success: true, data: newInvestor };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, error: msg };
  }
}
