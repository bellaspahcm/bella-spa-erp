'use server';

import type { ContractStatus } from '../contexts/contract/domain/contract';

export interface PaymentMilestone {
  id: string;
  label: string;
  dueDateLabel: string;
  percentage: number;
  amountVnd: number;
  status: 'pending' | 'paid' | 'overdue';
  paidDate?: string;
}

export interface ContractRecord {
  id: string;
  contractNo: string;
  customerName: string;
  customerPhone: string;
  projectName: string;
  unitCode: string;
  totalValueVnd: number;
  vatRate: number;
  maintenanceFee: number;
  discount: number;
  finalValueVnd: number;
  status: ContractStatus | 'active' | 'completed' | 'terminated';
  createdAt: string;
  signedDate?: string;
  handoverDate?: string;
  milestones: PaymentMilestone[];
  saleName: string;
}

// ── In-memory store for demo (replace with Supabase in production) ──
const DEMO_CONTRACTS: ContractRecord[] = [
  {
    id: 'ctr-001',
    contractNo: 'HĐMB-2026-001',
    customerName: 'Nguyễn Văn An',
    customerPhone: '0901 234 567',
    projectName: 'Bella Residences',
    unitCode: 'Gold Tower A-1201',
    totalValueVnd: 4_500_000_000,
    vatRate: 10,
    maintenanceFee: 2,
    discount: 0,
    finalValueVnd: 5_040_000_000,
    status: 'active',
    createdAt: '2026-07-10',
    signedDate: '2026-07-15',
    saleName: 'Trần Minh Tuấn',
    milestones: [
      { id: 'ms-1', label: 'Đặt cọc', dueDateLabel: 'Ký HĐMB', percentage: 10, amountVnd: 504_000_000, status: 'paid', paidDate: '2026-07-15' },
      { id: 'ms-2', label: 'Đợt 2', dueDateLabel: '30 ngày sau ký', percentage: 20, amountVnd: 1_008_000_000, status: 'paid', paidDate: '2026-08-14' },
      { id: 'ms-3', label: 'Đợt 3', dueDateLabel: '90 ngày sau ký', percentage: 30, amountVnd: 1_512_000_000, status: 'pending' },
      { id: 'ms-4', label: 'Đợt 4', dueDateLabel: 'Bàn giao căn hộ', percentage: 30, amountVnd: 1_512_000_000, status: 'pending' },
      { id: 'ms-5', label: 'Đợt 5 — Sổ hồng', dueDateLabel: 'Nhận sổ hồng', percentage: 10, amountVnd: 504_000_000, status: 'pending' },
    ],
  },
  {
    id: 'ctr-002',
    contractNo: 'HĐMB-2026-002',
    customerName: 'Trần Thị Bình',
    customerPhone: '0912 345 678',
    projectName: 'Bella Residences',
    unitCode: 'Silver Tower B-0802',
    totalValueVnd: 3_200_000_000,
    vatRate: 10,
    maintenanceFee: 2,
    discount: 50_000_000,
    finalValueVnd: 3_474_000_000,
    status: 'draft',
    createdAt: '2026-07-28',
    saleName: 'Lê Thị Hoa',
    milestones: [
      { id: 'ms-6', label: 'Đặt cọc', dueDateLabel: 'Ký HĐMB', percentage: 10, amountVnd: 347_400_000, status: 'pending' },
      { id: 'ms-7', label: 'Đợt 2', dueDateLabel: '30 ngày sau ký', percentage: 20, amountVnd: 694_800_000, status: 'pending' },
      { id: 'ms-8', label: 'Đợt 3', dueDateLabel: '90 ngày sau ký', percentage: 30, amountVnd: 1_042_200_000, status: 'pending' },
      { id: 'ms-9', label: 'Đợt 4', dueDateLabel: 'Bàn giao căn hộ', percentage: 30, amountVnd: 1_042_200_000, status: 'pending' },
      { id: 'ms-10', label: 'Đợt 5 — Sổ hồng', dueDateLabel: 'Nhận sổ hồng', percentage: 10, amountVnd: 347_400_000, status: 'pending' },
    ],
  },
  {
    id: 'ctr-003',
    contractNo: 'HĐMB-2026-003',
    customerName: 'Phạm Đức Cường',
    customerPhone: '0933 111 222',
    projectName: 'Bella Premium',
    unitCode: 'Diamond-P2-1501',
    totalValueVnd: 8_000_000_000,
    vatRate: 10,
    maintenanceFee: 2,
    discount: 200_000_000,
    finalValueVnd: 8_560_000_000,
    status: 'completed',
    createdAt: '2025-11-01',
    signedDate: '2025-11-05',
    handoverDate: '2026-05-15',
    saleName: 'Nguyễn Thị Mai',
    milestones: [
      { id: 'ms-11', label: 'Đặt cọc', dueDateLabel: 'Ký HĐMB', percentage: 10, amountVnd: 856_000_000, status: 'paid', paidDate: '2025-11-05' },
      { id: 'ms-12', label: 'Đợt 2', dueDateLabel: '30 ngày sau ký', percentage: 20, amountVnd: 1_712_000_000, status: 'paid', paidDate: '2025-12-05' },
      { id: 'ms-13', label: 'Đợt 3', dueDateLabel: '90 ngày sau ký', percentage: 30, amountVnd: 2_568_000_000, status: 'paid', paidDate: '2026-02-05' },
      { id: 'ms-14', label: 'Đợt 4', dueDateLabel: 'Bàn giao', percentage: 30, amountVnd: 2_568_000_000, status: 'paid', paidDate: '2026-05-15' },
      { id: 'ms-15', label: 'Đợt 5 — Sổ hồng', dueDateLabel: 'Nhận sổ hồng', percentage: 10, amountVnd: 856_000_000, status: 'paid', paidDate: '2026-06-20' },
    ],
  },
];

export async function fetchContractsAction(): Promise<{ success: boolean; data?: ContractRecord[]; error?: string }> {
  try {
    return { success: true, data: DEMO_CONTRACTS };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, error: msg };
  }
}

export async function signContractAction(contractId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const contract = DEMO_CONTRACTS.find(c => c.id === contractId);
    if (!contract) throw new Error(`Contract ${contractId} not found`);
    if (contract.status !== 'draft') throw new Error(`Cannot sign contract in status: ${contract.status}`);
    contract.status = 'active';
    contract.signedDate = new Date().toISOString().split('T')[0];
    // Mark first milestone as paid
    if (contract.milestones[0]) contract.milestones[0].status = 'paid';
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, error: msg };
  }
}

export async function recordMilestonePaymentAction(
  contractId: string,
  milestoneId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const contract = DEMO_CONTRACTS.find(c => c.id === contractId);
    if (!contract) throw new Error(`Contract ${contractId} not found`);
    const ms = contract.milestones.find(m => m.id === milestoneId);
    if (!ms) throw new Error(`Milestone ${milestoneId} not found`);
    if (ms.status === 'paid') throw new Error('Milestone already paid');
    ms.status = 'paid';
    ms.paidDate = new Date().toISOString().split('T')[0];
    // Check if all paid → completed
    const allPaid = contract.milestones.every(m => m.status === 'paid');
    if (allPaid) contract.status = 'completed';
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, error: msg };
  }
}

export async function createContractAction(
  data: Omit<ContractRecord, 'id' | 'contractNo' | 'status' | 'createdAt' | 'finalValueVnd' | 'milestones'>
): Promise<{ success: boolean; data?: ContractRecord; error?: string }> {
  try {
    const finalValue = Math.round(data.totalValueVnd * (1 + data.vatRate / 100 + data.maintenanceFee / 100) - data.discount);
    const newId = `ctr-${String(DEMO_CONTRACTS.length + 1).padStart(3, '0')}`;
    const newNo = `HĐMB-2026-${String(DEMO_CONTRACTS.length + 1).padStart(3, '0')}`;
    
    // Generate milestones
    const milestones: PaymentMilestone[] = [
      { id: `ms-${newId}-1`, label: 'Đặt cọc', dueDateLabel: 'Ký HĐMB', percentage: 10, amountVnd: Math.round(finalValue * 0.1), status: 'pending' },
      { id: `ms-${newId}-2`, label: 'Đợt 2', dueDateLabel: '30 ngày sau ký', percentage: 20, amountVnd: Math.round(finalValue * 0.2), status: 'pending' },
      { id: `ms-${newId}-3`, label: 'Đợt 3', dueDateLabel: '90 ngày sau ký', percentage: 30, amountVnd: Math.round(finalValue * 0.3), status: 'pending' },
      { id: `ms-${newId}-4`, label: 'Đợt 4', dueDateLabel: 'Bàn giao căn hộ', percentage: 30, amountVnd: Math.round(finalValue * 0.3), status: 'pending' },
      { id: `ms-${newId}-5`, label: 'Đợt 5 — Sổ hồng', dueDateLabel: 'Nhận sổ hồng', percentage: 10, amountVnd: Math.round(finalValue * 0.1), status: 'pending' },
    ];

    const newContract: ContractRecord = {
      id: newId,
      contractNo: newNo,
      ...data,
      finalValueVnd: finalValue,
      status: 'draft',
      createdAt: new Date().toISOString().split('T')[0],
      milestones,
    };

    DEMO_CONTRACTS.push(newContract);
    return { success: true, data: newContract };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, error: msg };
  }
}
