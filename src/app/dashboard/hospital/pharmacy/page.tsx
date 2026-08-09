'use client';

import React, { useState, useEffect } from 'react';
import {
  Package,
  Pill,
  FlaskConical,
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Search,
  TrendingDown,
  ShieldAlert,
  RefreshCw,
  ChevronRight,
  User,
  Calendar,
  Clock,
  ArrowRight,
  Lock,
  ShieldCheck,
  Check,
  Activity,
  FileSpreadsheet,
  Trash2,
  AlertCircle
} from 'lucide-react';

// ─── TYPES ──────────────────────────────────────────────────────────────────
type MedicationState =
  | 'ORDERED'
  | 'PHARMACY_VERIFIED'
  | 'RESERVED'
  | 'DISPENSING'
  | 'DISPENSED'
  | 'DELIVERED'
  | 'RECEIVED_BY_WARD'
  | 'ADMINISTERED'
  | 'REJECTED'
  | 'HELD'
  | 'CANCELLED';

type OrderPriority = 'STAT' | 'NOW' | 'URGENT' | 'ROUTINE';

type StockStatus = 'NORMAL' | 'LOW' | 'CRITICAL' | 'STOCKOUT_RISK';

interface TimelineEvent {
  status: MedicationState;
  timestamp: string;
  user: string;
  note?: string;
}

interface BatchInfo {
  batchNumber: string;
  expiryDate: string;
  onHand: number;
  reserved: number;
  available: number;
  location: string;
}

interface DispenseOrder {
  id: string;
  patientName: string;
  patientMRN: string;
  patientAge: number;
  patientGender: 'Nam' | 'Nữ' | 'Khác';
  wardBed: string;
  encounterId: string;
  drugName: string;
  drugCode: string;
  dose: string;
  route: string;
  frequency: string;
  requestedBy: string;
  requestedAt: string;
  status: MedicationState;
  priority: OrderPriority;
  isNarcotics: boolean;
  allergies: string[];
  timeline: TimelineEvent[];
  selectedBatch?: string;
  witnessPharmacist?: string;
  dispensedQty?: number;
  slaMinutes: number; // SLA duration from request
}

interface WardStock {
  id: string;
  drugName: string;
  genericName: string;
  category: 'antibiotic' | 'controlled' | 'iv_fluid' | 'analgesic' | 'general';
  unit: string;
  onHand: number;
  reserved: number;
  available: number; // onHand - reserved
  pendingOrders: number;
  minStock: number;
  wardId: string;
  wardName: string;
  lastDispensed: string;
  isNarcotics: boolean;
  batches: BatchInfo[];
}

interface DisposalRecord {
  id: string;
  drugName: string;
  batchNumber: string;
  qtyReturned: number;
  qtyWasted: number;
  witnessPharmacist: string;
  reportedBy: string;
  reason: string;
  timestamp: string;
}

// ─── CONFIGURATIONS ─────────────────────────────────────────────────────────
const STATE_CONFIG: Record<MedicationState, { label: string; bg: string; text: string; border: string }> = {
  ORDERED: { label: 'Chờ duyệt lâm sàng', bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
  PHARMACY_VERIFIED: { label: 'Đã duyệt lâm sàng', bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200' },
  RESERVED: { label: 'Đã giữ tồn kho', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  DISPENSING: { label: 'Đang chuẩn bị', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  DISPENSED: { label: 'Đã cấp phát', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  DELIVERED: { label: 'Đang vận chuyển', bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  RECEIVED_BY_WARD: { label: 'Khoa đã nhận', bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200' },
  ADMINISTERED: { label: 'Đã dùng cho BN', bg: 'bg-emerald-600 text-white', text: 'text-white', border: 'border-emerald-700' },
  REJECTED: { label: 'Đã từ chối', bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
  HELD: { label: 'Tạm ngưng', bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
  CANCELLED: { label: 'Đã hủy y lệnh', bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-300' },
};

const PRIORITY_CONFIG: Record<OrderPriority, { label: string; bg: string; text: string }> = {
  STAT: { label: 'STAT - KHẨN', bg: 'bg-rose-600 animate-pulse text-white', text: 'text-white' },
  NOW: { label: 'NOW - NGAY', bg: 'bg-orange-500 text-white', text: 'text-white' },
  URGENT: { label: 'URGENT - GẤP', bg: 'bg-amber-400 text-slate-900', text: 'text-slate-900' },
  ROUTINE: { label: 'ROUTINE', bg: 'bg-slate-100 text-slate-700', text: 'text-slate-700' },
};

const STOCK_STATUS_CONFIG: Record<StockStatus, { label: string; bg: string; text: string; border: string }> = {
  NORMAL: { label: 'Bình thường', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  LOW: { label: 'Tồn kho thấp', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  CRITICAL: { label: 'Nghiêm trọng', bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
  STOCKOUT_RISK: { label: 'Nguy cơ hết kho', bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
};

const CATEGORY_CONFIG = {
  antibiotic: { label: 'Kháng sinh', color: 'bg-amber-100 text-amber-800 border-amber-300' },
  controlled: { label: 'Thuốc kiểm soát đặc biệt', color: 'bg-rose-100 text-rose-800 border-rose-300' },
  iv_fluid: { label: 'Dịch truyền IV', color: 'bg-blue-100 text-blue-800 border-blue-300' },
  analgesic: { label: 'Giảm đau', color: 'bg-purple-100 text-purple-800 border-purple-300' },
  general: { label: 'Thuốc thường', color: 'bg-slate-100 text-slate-700 border-slate-300' },
};

// ─── INITIAL MOCK DATA ──────────────────────────────────────────────────────
const INITIAL_WARD_STOCKS: WardStock[] = [
  {
    id: 'ws-001',
    drugName: 'Meropenem 1g/20ml',
    genericName: 'Meropenem',
    category: 'antibiotic',
    unit: 'Lọ',
    onHand: 8,
    reserved: 6,
    available: 2,
    pendingOrders: 2,
    minStock: 20,
    wardId: 'ward-icu',
    wardName: 'Khoa ICU',
    lastDispensed: '2026-08-08T14:30:00Z',
    isNarcotics: false,
    batches: [
      { batchNumber: 'MER-260801', expiryDate: '2028-08-15', onHand: 5, reserved: 4, available: 1, location: 'Tủ lạnh thuốc tiêm A1' },
      { batchNumber: 'MER-261205', expiryDate: '2028-12-20', onHand: 3, reserved: 2, available: 1, location: 'Tủ lạnh thuốc tiêm A2' },
    ],
  },
  {
    id: 'ws-002',
    drugName: 'Morphine 10mg/ml',
    genericName: 'Morphine Sulfate',
    category: 'controlled',
    unit: 'Ống',
    onHand: 5,
    reserved: 2,
    available: 3,
    pendingOrders: 1,
    minStock: 10,
    wardId: 'ward-icu',
    wardName: 'Khoa ICU',
    lastDispensed: '2026-08-08T12:00:00Z',
    isNarcotics: true,
    batches: [
      { batchNumber: 'MOR-260201', expiryDate: '2027-02-10', onHand: 2, reserved: 1, available: 1, location: 'Két sắt Độc Dược S1' },
      { batchNumber: 'MOR-260904', expiryDate: '2027-09-05', onHand: 3, reserved: 1, available: 2, location: 'Két sắt Độc Dược S1' },
    ],
  },
  {
    id: 'ws-003',
    drugName: 'NaCl 0.9% 500ml',
    genericName: 'Sodium Chloride',
    category: 'iv_fluid',
    unit: 'Túi',
    onHand: 45,
    reserved: 5,
    available: 40,
    pendingOrders: 0,
    minStock: 30,
    wardId: 'ward-general',
    wardName: 'Khoa Nội Tổng Hợp',
    lastDispensed: '2026-08-08T13:45:00Z',
    isNarcotics: false,
    batches: [
      { batchNumber: 'NACL-270101', expiryDate: '2029-01-01', onHand: 45, reserved: 5, available: 40, location: 'Kệ dịch truyền C3' },
    ],
  },
  {
    id: 'ws-004',
    drugName: 'Paracetamol IV 1g/100ml',
    genericName: 'Acetaminophen',
    category: 'analgesic',
    unit: 'Chai',
    onHand: 12,
    reserved: 4,
    available: 8,
    pendingOrders: 1,
    minStock: 20,
    wardId: 'ward-surgery',
    wardName: 'Khoa Ngoại',
    lastDispensed: '2026-08-08T10:00:00Z',
    isNarcotics: false,
    batches: [
      { batchNumber: 'PARA-260502', expiryDate: '2027-05-18', onHand: 4, reserved: 2, available: 2, location: 'Kệ B1' },
      { batchNumber: 'PARA-261011', expiryDate: '2027-10-30', onHand: 8, reserved: 2, available: 6, location: 'Kệ B2' },
    ],
  },
  {
    id: 'ws-005',
    drugName: 'Vancomycin 500mg',
    genericName: 'Vancomycin HCl',
    category: 'antibiotic',
    unit: 'Lọ',
    onHand: 24,
    reserved: 2,
    available: 22,
    pendingOrders: 0,
    minStock: 15,
    wardId: 'ward-icu',
    wardName: 'Khoa ICU',
    lastDispensed: '2026-08-08T08:00:00Z',
    isNarcotics: false,
    batches: [
      { batchNumber: 'VAN-260715', expiryDate: '2028-07-15', onHand: 24, reserved: 2, available: 22, location: 'Tủ lạnh thuốc tiêm A3' },
    ],
  },
];

const INITIAL_DISPENSE_ORDERS: DispenseOrder[] = [
  {
    id: 'do-001',
    patientName: 'Nguyễn Văn Hoàng',
    patientMRN: 'PAT-001',
    patientAge: 62,
    patientGender: 'Nam',
    wardBed: 'ICU-BED-01',
    encounterId: 'ENC-2026-008',
    drugName: 'Meropenem 1g/20ml',
    drugCode: 'DRUG-MER-01',
    dose: '1g',
    route: 'IV',
    frequency: 'Q8H',
    requestedBy: 'BS. Trần Minh Khoa',
    requestedAt: '2026-08-08T21:00:00Z',
    status: 'ORDERED',
    priority: 'STAT',
    isNarcotics: false,
    allergies: ['Penicillin', 'Sulfonamides'],
    slaMinutes: 15,
    timeline: [
      { status: 'ORDERED', timestamp: '2026-08-08T21:00:00Z', user: 'BS. Trần Minh Khoa', note: 'Chỉ định liều khẩn cấp do nhiễm khuẩn nặng.' },
    ],
  },
  {
    id: 'do-002',
    patientName: 'Lê Thị Hương',
    patientMRN: 'PAT-002',
    patientAge: 45,
    patientGender: 'Nữ',
    wardBed: 'NGOAI-BED-03',
    encounterId: 'ENC-2026-009',
    drugName: 'Paracetamol IV 1g/100ml',
    drugCode: 'DRUG-PARA-01',
    dose: '1g',
    route: 'IV Drip',
    frequency: 'Q6H',
    requestedBy: 'BS. Phạm Quốc Việt',
    requestedAt: '2026-08-08T20:30:00Z',
    status: 'PHARMACY_VERIFIED',
    priority: 'URGENT',
    isNarcotics: false,
    allergies: ['Aspirin'],
    slaMinutes: 30,
    timeline: [
      { status: 'ORDERED', timestamp: '2026-08-08T20:30:00Z', user: 'BS. Phạm Quốc Việt', note: 'Giảm sốt và giảm đau sau phẫu thuật.' },
      { status: 'PHARMACY_VERIFIED', timestamp: '2026-08-08T20:45:00Z', user: 'DS. Nguyễn Thị Mai', note: 'Lâm sàng duyệt: Đủ điều kiện và đúng chỉ định.' },
    ],
  },
  {
    id: 'do-003',
    patientName: 'Trần Đức Mạnh',
    patientMRN: 'PAT-003',
    patientAge: 58,
    patientGender: 'Nam',
    wardBed: 'NOI-BED-07',
    encounterId: 'ENC-2026-010',
    drugName: 'NaCl 0.9% 500ml',
    drugCode: 'DRUG-NACL-01',
    dose: '500ml',
    route: 'IV Drip',
    frequency: 'TID',
    requestedBy: 'BS. Nguyễn Thu Hà',
    requestedAt: '2026-08-08T19:00:00Z',
    status: 'RECEIVED_BY_WARD',
    priority: 'ROUTINE',
    isNarcotics: false,
    allergies: [],
    slaMinutes: 120,
    timeline: [
      { status: 'ORDERED', timestamp: '2026-08-08T19:00:00Z', user: 'BS. Nguyễn Thu Hà', note: 'Truyền dịch bù nước bù điện giải.' },
      { status: 'PHARMACY_VERIFIED', timestamp: '2026-08-08T19:15:00Z', user: 'DS. Nguyễn Thị Mai', note: 'Duyệt y lệnh truyền dịch.' },
      { status: 'RESERVED', timestamp: '2026-08-08T19:16:00Z', user: 'Hệ thống tự động', note: 'Giữ kho thành công từ Shelf C3.' },
      { status: 'DISPENSING', timestamp: '2026-08-08T19:20:00Z', user: 'DS. Trần Văn Sơn', note: 'Chuẩn bị dịch truyền.' },
      { status: 'DISPENSED', timestamp: '2026-08-08T19:30:00Z', user: 'DS. Trần Văn Sơn', note: 'Batch: NACL-270101, Số lượng: 1 túi.' },
      { status: 'DELIVERED', timestamp: '2026-08-08T19:45:00Z', user: 'NV. Nguyễn Văn Hùng', note: 'Đã vận chuyển tới trạm điều dưỡng khoa Nội.' },
      { status: 'RECEIVED_BY_WARD', timestamp: '2026-08-08T19:55:00Z', user: 'ĐD. Lê Thị Lan', note: 'Khoa Nội xác nhận đã nhận túi NaCl 0.9%.' },
    ],
  },
  {
    id: 'do-004',
    patientName: 'Phạm Hùng Anh',
    patientMRN: 'PAT-004',
    patientAge: 70,
    patientGender: 'Nam',
    wardBed: 'ICU-BED-02',
    encounterId: 'ENC-2026-011',
    drugName: 'Morphine 10mg/ml',
    drugCode: 'DRUG-MOR-01',
    dose: '2mg',
    route: 'IV Push',
    frequency: 'PRN',
    requestedBy: 'BS. Lê Hoàng Nam',
    requestedAt: '2026-08-08T21:10:00Z',
    status: 'ORDERED',
    priority: 'NOW',
    isNarcotics: true,
    allergies: [],
    slaMinutes: 15,
    timeline: [
      { status: 'ORDERED', timestamp: '2026-08-08T21:10:00Z', user: 'BS. Lê Hoàng Nam', note: 'Chỉ định giảm đau PRN thuốc kiểm soát đặc biệt.' },
    ],
  },
];

const INITIAL_DISPOSAL_RECORDS: DisposalRecord[] = [
  {
    id: 'disp-001',
    drugName: 'Morphine 10mg/ml',
    batchNumber: 'MOR-260201',
    qtyReturned: 0,
    qtyWasted: 1,
    witnessPharmacist: 'DS. Trần Văn Sơn',
    reportedBy: 'DS. Nguyễn Thị Mai',
    reason: 'Bỏ ống thuốc dư lượng sau tiêm của bệnh nhân Phạm Hùng Anh',
    timestamp: '2026-08-08T15:20:00Z',
  },
];

// Helper to determine Stock Status
const getStockStatus = (stock: WardStock): StockStatus => {
  const ratio = stock.available / stock.minStock;
  if (stock.available === 0) return 'STOCKOUT_RISK';
  if (ratio <= 0.25) return 'CRITICAL';
  if (ratio <= 0.5) return 'LOW';
  return 'NORMAL';
};

export default function HospitalPharmacyPage() {
  const [activeTab, setActiveTab] = useState<'dispense' | 'stock' | 'narcotic'>('dispense');
  const [searchTerm, setSearchTerm] = useState('');
  const [orders, setOrders] = useState<DispenseOrder[]>(INITIAL_DISPENSE_ORDERS);
  const [stocks, setStocks] = useState<WardStock[]>(INITIAL_WARD_STOCKS);
  const [disposalLogs, setDisposalLogs] = useState<DisposalRecord[]>(INITIAL_DISPOSAL_RECORDS);

  // Filter States
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [stateFilter, setStateFilter] = useState<string>('ALL');

  // Expanded Timelines for cards
  const [expandedTimelines, setExpandedTimelines] = useState<Record<string, boolean>>({});

  // Active timers for count down (updated every second)
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  // Dispensing Verification Modal State
  const [verificationOrder, setVerificationOrder] = useState<DispenseOrder | null>(null);
  const [checkedItems, setCheckedItems] = useState({
    patient: false,
    order: false,
    allergy: false,
    route: false,
  });
  const [selectedBatchNumber, setSelectedBatchNumber] = useState<string>('');
  const [dispenseQty, setDispenseQty] = useState<number>(1);
  const [destinationWard, setDestinationWard] = useState<string>('Khoa ICU');
  // Controlled Drug fields
  const [witnessPharmacist, setWitnessPharmacist] = useState<string>('DS. Trần Văn Sơn');
  const [witnessPIN, setWitnessPIN] = useState<string>('');
  const [witnessError, setWitnessError] = useState<string>('');

  // Drug Disposal Form state
  const [disposalDrug, setDisposalDrug] = useState<string>('Morphine 10mg/ml');
  const [disposalBatch, setDisposalBatch] = useState<string>('MOR-260201');
  const [disposalReturnQty, setDisposalReturnQty] = useState<number>(0);
  const [disposalWasteQty, setDisposalWasteQty] = useState<number>(1);
  const [disposalWitness, setDisposalWitness] = useState<string>('DS. Trần Văn Sơn');
  const [disposalWitnessPIN, setDisposalWitnessPIN] = useState<string>('');
  const [disposalReason, setDisposalReason] = useState<string>('');
  const [disposalError, setDisposalError] = useState<string>('');

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Handler to toggle timeline expansion
  const toggleTimeline = (orderId: string) => {
    setExpandedTimelines((prev) => ({
      ...prev,
      [orderId]: !prev[orderId],
    }));
  };

  // State Transitions helper
  const advanceOrderState = (orderId: string, nextState: MedicationState, note?: string) => {
    setOrders((prevOrders) =>
      prevOrders.map((order) => {
        if (order.id !== orderId) return order;

        const newEvent: TimelineEvent = {
          status: nextState,
          timestamp: new Date().toISOString(),
          user: 'DS. Nguyễn Thị Mai', // Mock active user
          note: note,
        };

        // If reserved, update reservation counts
        if (nextState === 'RESERVED') {
          setStocks((prevStocks) =>
            prevStocks.map((st) => {
              if (st.drugName === order.drugName) {
                const newRes = st.reserved + 1;
                return {
                  ...st,
                  reserved: newRes,
                  available: Math.max(0, st.onHand - newRes),
                };
              }
              return st;
            })
          );
        }

        // If dispensed, deduct inventory
        if (nextState === 'DISPENSED') {
          setStocks((prevStocks) =>
            prevStocks.map((st) => {
              if (st.drugName === order.drugName) {
                const batchNum = order.selectedBatch || 'MER-260801';
                const updatedBatches = st.batches.map((b) => {
                  if (b.batchNumber === batchNum) {
                    const newOnHand = Math.max(0, b.onHand - (order.dispensedQty || 1));
                    const newRes = Math.max(0, b.reserved - (order.dispensedQty || 1));
                    return {
                      ...b,
                      onHand: newOnHand,
                      reserved: newRes,
                      available: Math.max(0, newOnHand - newRes),
                    };
                  }
                  return b;
                });
                const totalOnHand = updatedBatches.reduce((acc, curr) => acc + curr.onHand, 0);
                const totalReserved = updatedBatches.reduce((acc, curr) => acc + curr.reserved, 0);
                return {
                  ...st,
                  batches: updatedBatches,
                  onHand: totalOnHand,
                  reserved: totalReserved,
                  available: Math.max(0, totalOnHand - totalReserved),
                };
              }
              return st;
            })
          );
        }

        return {
          ...order,
          status: nextState,
          timeline: [...order.timeline, newEvent],
        };
      })
    );
  };

  const handleOpenDispenseModal = (order: DispenseOrder) => {
    setVerificationOrder(order);
    setCheckedItems({
      patient: false,
      order: false,
      allergy: false,
      route: false,
    });
    // Autoselect batch based on FEFO (earliest expiry first)
    const matchingStock = stocks.find((s) => s.drugName === order.drugName);
    if (matchingStock && matchingStock.batches.length > 0) {
      // Sort batches by expiryDate ascending
      const sortedBatches = [...matchingStock.batches].sort(
        (a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime()
      );
      setSelectedBatchNumber(sortedBatches[0].batchNumber);
    } else {
      setSelectedBatchNumber('');
    }
    setDispenseQty(1);
    setWitnessPIN('');
    setWitnessError('');
    setDestinationWard(order.wardBed.split('-')[0] === 'ICU' ? 'Khoa ICU' : 'Khoa Ngoại');
  };

  const handleConfirmDispense = () => {
    if (!verificationOrder) return;

    // Dual witness check for narcotics
    if (verificationOrder.isNarcotics) {
      if (!witnessPIN) {
        setWitnessError('Vui lòng nhập mã PIN xác thực của dược sĩ giám sát.');
        return;
      }
      if (witnessPIN !== '1234') {
        setWitnessError('Mã PIN không đúng (Gợi ý: Nhập "1234" để kiểm thử).');
        return;
      }
    }

    // Set batch and qty values onto order
    setOrders((prev) =>
      prev.map((o) =>
        o.id === verificationOrder.id
          ? {
              ...o,
              selectedBatch: selectedBatchNumber,
              dispensedQty: dispenseQty,
              witnessPharmacist: verificationOrder.isNarcotics ? witnessPharmacist : undefined,
            }
          : o
      )
    );

    const witnessNote = verificationOrder.isNarcotics
      ? ` Đồng duyệt bởi: ${witnessPharmacist}.`
      : '';
    advanceOrderState(
      verificationOrder.id,
      'DISPENSED',
      `Cấp phát thành công Batch: ${selectedBatchNumber}, Số lượng: ${dispenseQty} ${
        verificationOrder.isNarcotics ? 'ống' : 'lọ/chai'
      }.${witnessNote} Chuyển vận chuyển đến ${destinationWard}.`
    );

    setVerificationOrder(null);
  };

  const handleDisposalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setDisposalError('');

    if (!disposalWitnessPIN) {
      setDisposalError('Vui lòng nhập mã PIN xác nhận của người giám sát.');
      return;
    }
    if (disposalWitnessPIN !== '1234') {
      setDisposalError('Mã PIN không đúng (Thử dùng: "1234").');
      return;
    }
    if (disposalReturnQty < 0 || disposalWasteQty < 0) {
      setDisposalError('Số lượng không thể âm.');
      return;
    }
    if (disposalReturnQty === 0 && disposalWasteQty === 0) {
      setDisposalError('Vui lòng nhập số lượng trả lại hoặc hủy bỏ.');
      return;
    }

    const newDisposal: DisposalRecord = {
      id: `disp-${Date.now()}`,
      drugName: disposalDrug,
      batchNumber: disposalBatch,
      qtyReturned: disposalReturnQty,
      qtyWasted: disposalWasteQty,
      witnessPharmacist: disposalWitness,
      reportedBy: 'DS. Nguyễn Thị Mai',
      reason: disposalReason || 'Ghi nhận hao hụt định kỳ',
      timestamp: new Date().toISOString(),
    };

    setDisposalLogs((prev) => [newDisposal, ...prev]);

    // Adjust stock inventory back if returned
    if (disposalReturnQty > 0) {
      setStocks((prevStocks) =>
        prevStocks.map((st) => {
          if (st.drugName === disposalDrug) {
            const updatedBatches = st.batches.map((b) => {
              if (b.batchNumber === disposalBatch) {
                const newOnHand = b.onHand + disposalReturnQty;
                return {
                  ...b,
                  onHand: newOnHand,
                  available: Math.max(0, newOnHand - b.reserved),
                };
              }
              return b;
            });
            const totalOnHand = updatedBatches.reduce((acc, curr) => acc + curr.onHand, 0);
            return {
              ...st,
              batches: updatedBatches,
              onHand: totalOnHand,
              available: Math.max(0, totalOnHand - st.reserved),
            };
          }
          return st;
        })
      );
    }

    // Reset Form
    setDisposalReturnQty(0);
    setDisposalWasteQty(0);
    setDisposalReason('');
    setDisposalWitnessPIN('');
  };

  // Filter orders
  const filteredOrders = orders.filter((order) => {
    const matchesSearch =
      order.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.drugName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPriority = priorityFilter === 'ALL' ? true : order.priority === priorityFilter;
    const matchesState = stateFilter === 'ALL' ? true : order.status === stateFilter;
    return matchesSearch && matchesPriority && matchesState;
  });

  const filteredStocks = stocks.filter(
    (s) =>
      s.drugName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.wardName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const lowStockItems = stocks.filter((s) => s.available <= s.minStock);
  const criticalStockItems = stocks.filter((s) => s.available <= s.minStock * 0.25);
  const pendingOrders = orders.filter((o) => o.status === 'ORDERED' || o.status === 'PHARMACY_VERIFIED');

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 select-none">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-950 via-teal-950 to-cyan-950 rounded-2xl p-6 text-white shadow-2xl relative overflow-hidden border border-emerald-500/20">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-emerald-800/10 via-transparent to-transparent pointer-events-none" />
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
          <div>
            <div className="flex items-center space-x-2 text-emerald-400 mb-1">
              <Package className="w-5 h-5 shrink-0" />
              <span className="text-xs font-bold uppercase tracking-widest">
                Bella Hospital • Inpatient Pharmacy & Dispensing Engine
              </span>
            </div>
            <h1 className="text-3xl font-black tracking-tight text-white !text-white">
              Kho Dược Nội Trú & Cấp Phát
            </h1>
            <p className="text-emerald-200/80 text-sm mt-1 max-w-xl leading-relaxed">
              Hệ thống cấp phát thuốc khép kín theo y lệnh MAR. Kiểm soát thuốc độc hại và tối ưu chuỗi cung ứng lâm sàng.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-4 shrink-0 w-full md:w-auto">
            <div className="text-center bg-white/5 backdrop-blur-md rounded-xl p-3 border border-white/10 hover:border-emerald-500/30 transition-all duration-300">
              <div className="text-3xl font-black text-emerald-400">{pendingOrders.length}</div>
              <div className="text-[10px] text-emerald-200/70 font-bold uppercase tracking-wider mt-1">Y lệnh chờ cấp</div>
            </div>
            <div className="text-center bg-white/5 backdrop-blur-md rounded-xl p-3 border border-white/10 hover:border-amber-500/30 transition-all duration-300">
              <div className="text-3xl font-black text-amber-400">{lowStockItems.length}</div>
              <div className="text-[10px] text-amber-200/70 font-bold uppercase tracking-wider mt-1">Sắp hết tồn kho</div>
            </div>
            <div className="text-center bg-white/5 backdrop-blur-md rounded-xl p-3 border border-white/10 hover:border-rose-500/30 transition-all duration-300">
              <div className="text-3xl font-black text-rose-400">
                {stocks.filter((s) => s.isNarcotics).length}
              </div>
              <div className="text-[10px] text-rose-200/70 font-bold uppercase tracking-wider mt-1">Thuốc kiểm soát</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tầng Cảnh báo tồn kho nâng cao (Exceptions First) */}
      {lowStockItems.length > 0 && (
        <div className="bg-white border border-amber-200 rounded-xl p-5 shadow-md space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
              <span className="font-bold text-slate-800 text-sm">Cảnh báo tồn kho lâm sàng & Nguy cơ cạn kiệt</span>
            </div>
            <span className="text-[10px] bg-amber-50 text-amber-700 font-bold px-2 py-0.5 rounded border border-amber-200">
              Exception-First View
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {lowStockItems.map((s) => {
              const status = getStockStatus(s);
              const cfg = STOCK_STATUS_CONFIG[status];
              const shortage = s.pendingOrders > s.available ? s.pendingOrders - s.available : 0;
              return (
                <div key={s.id} className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-bold text-slate-800 text-xs truncate max-w-[170px]" title={s.drugName}>
                        {s.drugName}
                      </div>
                      <div className="text-[10px] text-slate-500">{s.wardName}</div>
                    </div>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                      {cfg.label}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1 text-center py-1 bg-white border border-slate-100 rounded text-[10px]">
                    <div>
                      <div className="text-slate-800 font-bold">{s.onHand}</div>
                      <div className="text-slate-500 text-[8px]">Thực tế</div>
                    </div>
                    <div>
                      <div className="text-blue-600 font-bold">{s.reserved}</div>
                      <div className="text-slate-500 text-[8px]">Giữ trước</div>
                    </div>
                    <div>
                      <div className="text-emerald-600 font-bold">{s.available}</div>
                      <div className="text-slate-500 text-[8px]">Khả dụng</div>
                    </div>
                  </div>
                  {shortage > 0 && (
                    <div className="text-[9px] text-rose-700 font-bold bg-rose-50 border border-rose-200 px-2 py-1 rounded flex items-center justify-between">
                      <span>Dự kiến thiếu hụt:</span>
                      <span className="bg-rose-600 text-white font-black px-1.5 py-0.5 rounded">{shortage} {s.unit}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-1">
        {[
          { key: 'dispense', label: 'Cấp Phát Theo Y Lệnh', icon: ClipboardList },
          { key: 'stock', label: 'Tồn Kho Khoa Phòng', icon: Package },
          { key: 'narcotic', label: 'Thuốc Kiểm Soát Đặc Biệt', icon: ShieldAlert },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key as typeof activeTab)}
            className={`py-3 px-5 text-sm font-bold flex items-center space-x-2 border-b-2 transition-all duration-200 ${
              activeTab === key
                ? 'border-emerald-600 text-emerald-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Icon className="w-4 h-4 shrink-0" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* Search & Filter Controls */}
      <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:max-w-md">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder={
              activeTab === 'dispense'
                ? 'Tìm theo tên bệnh nhân hoặc tên thuốc...'
                : 'Tìm theo tên thuốc hoặc khoa phòng...'
            }
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 pr-4 py-2 w-full border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white"
          />
        </div>

        {activeTab === 'dispense' && (
          <div className="flex gap-2 w-full md:w-auto">
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="text-xs font-bold border border-slate-300 rounded-lg px-2.5 py-2 bg-slate-50 text-slate-700"
            >
              <option value="ALL">Tất cả ưu tiên</option>
              <option value="STAT">STAT (Khẩn)</option>
              <option value="NOW">NOW (Ngay)</option>
              <option value="URGENT">URGENT (Gấp)</option>
              <option value="ROUTINE">ROUTINE (Thường)</option>
            </select>

            <select
              value={stateFilter}
              onChange={(e) => setStateFilter(e.target.value)}
              className="text-xs font-bold border border-slate-300 rounded-lg px-2.5 py-2 bg-slate-50 text-slate-700"
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="ORDERED">Chờ duyệt lâm sàng</option>
              <option value="PHARMACY_VERIFIED">Đã duyệt lâm sàng</option>
              <option value="RESERVED">Đã giữ tồn kho</option>
              <option value="DISPENSING">Đang chuẩn bị</option>
              <option value="DISPENSED">Đã cấp phát</option>
              <option value="DELIVERED">Đang giao</option>
              <option value="RECEIVED_BY_WARD">Khoa đã nhận</option>
              <option value="ADMINISTERED">Đã dùng cho BN</option>
            </select>
          </div>
        )}
      </div>

      {/* Tab Content */}
      {activeTab === 'dispense' && (
        <div className="space-y-4">
          {filteredOrders.length === 0 ? (
            <div className="text-center p-12 text-slate-400 bg-white rounded-xl border border-slate-100 shadow-sm">
              Không tìm thấy y lệnh thuốc nào phù hợp với bộ lọc.
            </div>
          ) : (
            filteredOrders.map((order) => {
              const isUrgent = order.priority === 'STAT' || order.priority === 'NOW';
              const stateCfg = STATE_CONFIG[order.status];
              const priorityCfg = PRIORITY_CONFIG[order.priority];
              const isNarcotics = order.isNarcotics;

              // Calculate remaining SLA time
              const reqTime = new Date(order.requestedAt).getTime();
              const slaDeadline = reqTime + order.slaMinutes * 60000;
              const remainingMs = slaDeadline - currentTime.getTime();
              const remainingMins = Math.ceil(remainingMs / 60000);
              const isOverdue = remainingMins <= 0;

              return (
                <div
                  key={order.id}
                  className={`bg-white rounded-xl border shadow-sm p-5 flex flex-col gap-4 transition-all hover:shadow-md ${
                    isUrgent ? 'border-rose-300 bg-rose-50/10' : 'border-slate-200'
                  }`}
                >
                  {/* Tầng 1: Thông tin bệnh nhân & Ưu tiên */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
                    <div className="flex items-center space-x-2.5">
                      <span className={`text-[10px] font-black px-2.5 py-1 rounded ${priorityCfg.bg}`}>
                        {priorityCfg.label}
                      </span>
                      {isNarcotics && (
                        <span className="text-[10px] font-black bg-rose-100 text-rose-700 px-2 py-0.5 rounded border border-rose-300">
                          THUỐC KIỂM SOÁT
                        </span>
                      )}
                      <span className="font-extrabold text-slate-900">{order.patientName}</span>
                      <span className="text-xs text-slate-500">
                        ({order.patientGender} · {order.patientAge}T) · Bed: {order.wardBed}
                      </span>
                    </div>
                    {/* SLA countdown timer */}
                    {(order.status !== 'DISPENSED' && order.status !== 'DELIVERED' && order.status !== 'RECEIVED_BY_WARD' && order.status !== 'ADMINISTERED') && (
                      <div className={`text-xs font-bold flex items-center space-x-1.5 px-3 py-1 rounded-full ${
                        isOverdue ? 'bg-rose-50 text-rose-600 animate-pulse' : 'bg-amber-50 text-amber-700'
                      }`}>
                        <Clock className="w-3.5 h-3.5" />
                        <span>
                          {isOverdue
                            ? `Quá hạn SLA ${Math.abs(remainingMins)} phút`
                            : `Hạn SLA: Còn ${remainingMins} phút`}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Tầng 2: Chi tiết y lệnh thuốc */}
                  <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center space-x-2">
                        <Pill className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span className="font-bold text-emerald-900 text-md">{order.drugName}</span>
                        <span className="text-xs text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                          Liều: {order.dose} · {order.route} · Tần suất: {order.frequency}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500">
                        Chỉ định bởi: <strong className="text-slate-700">{order.requestedBy}</strong> lúc{' '}
                        {new Date(order.requestedAt).toLocaleString('vi-VN')} · Encounter: {order.encounterId}
                      </div>
                      {order.allergies.length > 0 && (
                        <div className="text-[11px] font-bold text-rose-600 bg-rose-50 px-2 py-1 rounded border border-rose-100 inline-block">
                          ⚠ Dị ứng: {order.allergies.join(', ')}
                        </div>
                      )}
                    </div>

                    {/* Tiến trình trạng thái (State machine actions) */}
                    <div className="flex items-center gap-2 shrink-0">
                      {order.status === 'ORDERED' && (
                        <button
                          onClick={() => advanceOrderState(order.id, 'PHARMACY_VERIFIED', 'Xác nhận lâm sàng y lệnh thành công.')}
                          className="flex items-center space-x-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2 rounded-lg text-xs font-bold transition-all"
                        >
                          <ShieldCheck className="w-4 h-4" />
                          <span>Duyệt lâm sàng</span>
                        </button>
                      )}
                      {order.status === 'PHARMACY_VERIFIED' && (
                        <button
                          onClick={() => advanceOrderState(order.id, 'RESERVED', 'Giữ chỗ số lượng trong tủ thuốc tủ trực.')}
                          className="flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 rounded-lg text-xs font-bold transition-all"
                        >
                          <Package className="w-4 h-4" />
                          <span>Giữ tồn kho</span>
                        </button>
                      )}
                      {order.status === 'RESERVED' && (
                        <button
                          onClick={() => advanceOrderState(order.id, 'DISPENSING', 'Bắt đầu quá trình soạn chia liều.')}
                          className="flex items-center space-x-1.5 bg-amber-500 hover:bg-amber-600 text-white px-3.5 py-2 rounded-lg text-xs font-bold transition-all"
                        >
                          <RefreshCw className="w-4 h-4" />
                          <span>Chuẩn bị thuốc</span>
                        </button>
                      )}
                      {(order.status === 'DISPENSING' || order.status === 'ORDERED' || order.status === 'PHARMACY_VERIFIED' || order.status === 'RESERVED') && (
                        <button
                          onClick={() => handleOpenDispenseModal(order)}
                          className="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-lg text-xs font-bold shadow-sm transition-all"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Cấp phát an toàn</span>
                        </button>
                      )}
                      {order.status === 'DISPENSED' && (
                        <button
                          onClick={() => advanceOrderState(order.id, 'DELIVERED', 'Chuyển cho hộ lý/vận chuyển chuyển thuốc đến ICU/Ngoại.')}
                          className="flex items-center space-x-1.5 bg-purple-600 hover:bg-purple-700 text-white px-3.5 py-2 rounded-lg text-xs font-bold transition-all"
                        >
                          <ArrowRight className="w-4 h-4" />
                          <span>Giao thuốc đi</span>
                        </button>
                      )}
                      {order.status === 'DELIVERED' && (
                        <button
                          onClick={() => advanceOrderState(order.id, 'RECEIVED_BY_WARD', 'Điều dưỡng tủ trực khoa ICU xác nhận đã nhận.')}
                          className="flex items-center space-x-1.5 bg-teal-600 hover:bg-teal-700 text-white px-3.5 py-2 rounded-lg text-xs font-bold transition-all"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Khoa nhận</span>
                        </button>
                      )}
                      {order.status === 'RECEIVED_BY_WARD' && (
                        <button
                          onClick={() => advanceOrderState(order.id, 'ADMINISTERED', 'Điều dưỡng đã kiểm tra 5 quy luật an toàn và truyền cho BN.')}
                          className="flex items-center space-x-1.5 bg-emerald-700 hover:bg-emerald-800 text-white px-3.5 py-2 rounded-lg text-xs font-bold transition-all"
                        >
                          <Activity className="w-4 h-4" />
                          <span>Nursing dùng thuốc</span>
                        </button>
                      )}
                      {order.status === 'ADMINISTERED' && (
                        <span className="flex items-center space-x-1 text-emerald-800 bg-emerald-100 border border-emerald-300 px-3 py-1.5 rounded-lg text-xs font-bold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Hoàn thành dùng thuốc</span>
                        </span>
                      )}
                      
                      {/* Cancel/Hold button for pending statuses */}
                      {['ORDERED', 'PHARMACY_VERIFIED', 'RESERVED', 'DISPENSING'].includes(order.status) && (
                        <button
                          onClick={() => {
                            const reason = prompt('Nhập lý do tạm ngưng:');
                            if (reason) advanceOrderState(order.id, 'HELD', reason);
                          }}
                          className="text-xs font-bold text-slate-500 hover:text-slate-700 border border-slate-200 hover:bg-slate-50 px-2.5 py-2 rounded-lg transition-all"
                        >
                          Tạm ngưng
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Tầng 3: Stepper trực quan trạng thái */}
                  <div className="bg-slate-50 border border-slate-100 rounded-lg px-4 py-3">
                    <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold">
                      {[
                        { key: 'ORDERED', label: 'Chỉ định' },
                        { key: 'PHARMACY_VERIFIED', label: 'Duyệt y lệnh' },
                        { key: 'RESERVED', label: 'Giữ kho' },
                        { key: 'DISPENSED', label: 'Đã cấp phát' },
                        { key: 'DELIVERED', label: 'Đang chuyển' },
                        { key: 'RECEIVED_BY_WARD', label: 'Khoa nhận' },
                        { key: 'ADMINISTERED', label: 'Đã dùng (MAR)' },
                      ].map((step, idx, arr) => {
                        const statesList = arr.map((s) => s.key);
                        const currentIdx = statesList.indexOf(order.status);
                        const stepIdx = statesList.indexOf(step.key);

                        const isCompleted = currentIdx >= stepIdx && order.status !== 'REJECTED' && order.status !== 'HELD';
                        const isActive = order.status === step.key;

                        return (
                          <React.Fragment key={step.key}>
                            <div className="flex flex-col items-center space-y-1 relative z-10">
                              <div
                                className={`w-5 h-5 rounded-full flex items-center justify-center border-2 font-bold ${
                                  isActive
                                    ? 'bg-emerald-600 border-emerald-600 text-white'
                                    : isCompleted
                                    ? 'bg-emerald-100 border-emerald-500 text-emerald-700'
                                    : 'bg-white border-slate-200 text-slate-400'
                                }`}
                              >
                                {isCompleted && !isActive ? '✓' : idx + 1}
                              </div>
                              <span className={isActive ? 'text-emerald-800 font-black' : isCompleted ? 'text-slate-600' : 'text-slate-400'}>
                                {step.label}
                              </span>
                            </div>
                            {idx < arr.length - 1 && (
                              <div
                                className={`flex-1 h-0.5 mx-1 ${
                                  currentIdx > stepIdx ? 'bg-emerald-500' : 'bg-slate-200'
                                }`}
                              />
                            )}
                          </React.Fragment>
                        );
                      })}
                    </div>
                  </div>

                  {/* Audit Trail Timeline */}
                  <div>
                    <button
                      onClick={() => toggleTimeline(order.id)}
                      className="text-xs font-bold text-slate-600 hover:text-emerald-700 flex items-center space-x-1"
                    >
                      <span>📋 Lịch sử quy trình & Audit Trail</span>
                      <ChevronRight className={`w-3.5 h-3.5 transform transition-transform ${expandedTimelines[order.id] ? 'rotate-90' : ''}`} />
                    </button>

                    {expandedTimelines[order.id] && (
                      <div className="mt-3 bg-slate-900 text-slate-300 rounded-xl p-4 font-mono text-[11px] space-y-2 border border-slate-800">
                        <div className="text-slate-500 border-b border-slate-800 pb-1.5 mb-1.5 flex justify-between font-bold">
                          <span>TRẠNG THÁI</span>
                          <span>THỜI GIAN · NHÂN SỰ</span>
                        </div>
                        {order.timeline.map((evt, i) => (
                          <div key={i} className="flex justify-between items-start gap-4">
                            <span className="text-emerald-400 font-bold shrink-0">
                              [{evt.status}]
                            </span>
                            <div className="text-right">
                              <span className="text-slate-400 font-semibold">{new Date(evt.timestamp).toLocaleTimeString('vi-VN')} </span>
                              <span className="text-slate-500">({evt.user})</span>
                              {evt.note && <div className="text-slate-400 text-[10px] mt-0.5 italic">{evt.note}</div>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {activeTab === 'stock' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-bold text-slate-600 uppercase">Tên thuốc</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-slate-600 uppercase">Phân loại</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-slate-600 uppercase">Khoa phòng</th>
                  <th className="text-center px-4 py-3 text-xs font-bold text-slate-600 uppercase">Tồn kho / Tối thiểu</th>
                  <th className="text-center px-4 py-3 text-xs font-bold text-slate-600 uppercase">Khả dụng / Giữ chỗ</th>
                  <th className="text-center px-4 py-3 text-xs font-bold text-slate-600 uppercase">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStocks.map((s) => {
                  const status = getStockStatus(s);
                  const cfg = CATEGORY_CONFIG[s.category];
                  const statusCfg = STOCK_STATUS_CONFIG[status];
                  const hasShortage = s.pendingOrders > s.available;

                  return (
                    <React.Fragment key={s.id}>
                      <tr className={status === 'STOCKOUT_RISK' ? 'bg-rose-50/20' : status === 'CRITICAL' ? 'bg-amber-50/20' : ''}>
                        <td className="px-4 py-3">
                          <div className="font-bold text-slate-800">{s.drugName}</div>
                          <div className="text-xs text-slate-500">{s.genericName}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded border ${cfg.color}`}>
                            {cfg.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-700 text-xs font-bold">{s.wardName}</td>
                        <td className="px-4 py-3 text-center">
                          <span className="font-extrabold text-slate-900">{s.onHand}</span>
                          <span className="text-slate-400 text-xs font-medium"> / {s.minStock} {s.unit}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="font-extrabold text-emerald-700">{s.available}</span>
                          <span className="text-slate-400 text-xs font-medium"> / {s.reserved}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border}`}>
                            {statusCfg.label}
                          </span>
                        </td>
                      </tr>
                      {/* Expansion row displaying batch details */}
                      <tr className="bg-slate-50/30">
                        <td colSpan={6} className="px-4 py-2 border-t border-slate-100">
                          <div className="text-xs text-slate-600 flex flex-wrap gap-4 items-center justify-between">
                            <div className="flex gap-4">
                              <strong>Lô & Hạn dùng (FEFO):</strong>
                              {s.batches.map((b) => (
                                <span key={b.batchNumber} className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                  Lô: <strong className="text-slate-700">{b.batchNumber}</strong> (HSD: {b.expiryDate} · Khả dụng: {b.available}/{b.onHand})
                                </span>
                              ))}
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  alert(`Tính năng điều chuyển thuốc ${s.drugName} đang được chuyển giao.`);
                                }}
                                className="text-[10px] font-black text-emerald-700 hover:text-emerald-900 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200 transition-colors"
                              >
                                Điều chuyển kho
                              </button>
                              <button
                                onClick={() => {
                                  alert(`Yêu cầu bổ sung tồn kho cho ${s.drugName} đã được gửi.`);
                                }}
                                className="text-[10px] font-black text-amber-700 hover:text-amber-900 bg-amber-50 px-2.5 py-1 rounded border border-amber-200 transition-colors"
                              >
                                Yêu cầu bổ sung
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'narcotic' && (
        <div className="space-y-6">
          <div className="bg-rose-950/10 border border-rose-500/20 rounded-xl p-5 flex items-start space-x-3">
            <ShieldAlert className="w-6 h-6 text-rose-600 mt-0.5 shrink-0" />
            <div>
              <h3 className="font-extrabold text-rose-900 text-sm">Chính sách Quản lý Độc dược nhóm kiểm soát kép</h3>
              <p className="text-xs text-rose-700/90 mt-1 leading-relaxed">
                Tất cả thuốc nhóm gây nghiện, hướng thần (Morphine, Fentanyl, v.v.) bắt buộc phải xác nhận kép
                (Dual-Pharmacist Witness). Bất kỳ dư lượng thuốc bỏ đi hoặc thuốc trả lại phải được khai báo tiêu hủy
                có người làm chứng và lưu vết Audit Log phục vụ thanh kiểm tra của Sở Y Tế.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Cột 1 & 2: Controlled Drugs Stock & Timelines */}
            <div className="lg:col-span-2 space-y-4">
              <h3 className="font-extrabold text-slate-800 text-sm flex items-center space-x-2">
                <Lock className="w-4 h-4 text-rose-600" />
                <span>Theo dõi tồn kho Độc Dược Két Sắt S1</span>
              </h3>

              {stocks
                .filter((s) => s.isNarcotics)
                .map((s) => (
                  <div key={s.id} className="bg-white border border-rose-200 rounded-xl p-5 shadow-sm space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center space-x-2">
                          <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                          <span className="font-bold text-slate-900">{s.drugName}</span>
                          <span className="text-[10px] font-black bg-rose-100 text-rose-700 px-2 py-0.5 rounded border border-rose-200">
                            KIỂM SOÁT ĐẶC BIỆT
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 mt-1">Vị trí: Két độc dược tủ trực khoa ICU</div>
                      </div>
                      <div className="text-right">
                        <div className="font-black text-slate-900">{s.available} / {s.onHand} {s.unit} khả dụng</div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          Yêu cầu tối thiểu: {s.minStock} {s.unit}
                        </div>
                      </div>
                    </div>

                    {/* Supply chain lifecycle visualization */}
                    <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                      <div className="text-[10px] font-black text-slate-400 uppercase mb-2">Quy trình cấp phát & Dòng cung ứng độc dược</div>
                      <div className="flex items-center justify-between text-[9px] text-slate-500 font-bold">
                        <div className="flex flex-col items-center">
                          <span className="text-slate-700 font-black">1. Stored</span>
                          <span className="text-slate-400">Két sắt S1</span>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
                        <div className="flex flex-col items-center">
                          <span className="text-emerald-700 font-black">2. Dispensed</span>
                          <span className="text-slate-400">Xác thực kép</span>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
                        <div className="flex flex-col items-center">
                          <span className="text-purple-700 font-black">3. Delivered</span>
                          <span className="text-slate-400">Hộp khóa chuyên dụng</span>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
                        <div className="flex flex-col items-center">
                          <span className="text-teal-700 font-black">4. Administered</span>
                          <span className="text-slate-400">Điều dưỡng tiêm</span>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
                        <div className="flex flex-col items-center">
                          <span className="text-rose-700 font-black">5. Waste Log</span>
                          <span className="text-slate-400">Tiêu hủy vỏ</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

              {/* Disposal logs list */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
                <h3 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">
                  Nhật ký tiêu hủy & Trả lại thuốc kiểm soát đặc biệt
                </h3>
                <div className="space-y-2">
                  {disposalLogs.map((log) => (
                    <div key={log.id} className="bg-slate-50 rounded-lg p-3 text-xs border border-slate-200 space-y-1 font-mono">
                      <div className="flex justify-between font-bold text-slate-800">
                        <span>{log.drugName} (Lô: {log.batchNumber})</span>
                        <span className="text-slate-400">{new Date(log.timestamp).toLocaleString('vi-VN')}</span>
                      </div>
                      <div className="text-slate-600">
                        Hủy bỏ dư lượng: <strong className="text-rose-700">{log.qtyWasted} ống</strong> · Trả lại kho: <strong className="text-emerald-700">{log.qtyReturned} ống</strong>
                      </div>
                      <div className="text-[10px] text-slate-500">
                        Người báo cáo: {log.reportedBy} · Người làm chứng: {log.witnessPharmacist}
                      </div>
                      <div className="text-[10px] text-slate-400 italic">
                        Lý do: {log.reason}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Cột 3: Form Báo cáo tiêu hủy hao hụt */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="font-extrabold text-slate-800 text-sm flex items-center space-x-1.5">
                  <Trash2 className="w-4 h-4 text-rose-600" />
                  <span>Khai báo hao hụt / Tiêu hủy thuốc</span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-1">Khai báo thuốc dư thừa sau tiêm hoặc thuốc bị hư hại.</p>
              </div>

              <form onSubmit={handleDisposalSubmit} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Tên thuốc độc hại:</label>
                  <select
                    value={disposalDrug}
                    onChange={(e) => setDisposalDrug(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-rose-500 bg-slate-50 font-bold"
                  >
                    <option value="Morphine 10mg/ml">Morphine 10mg/ml</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Mã Lô thuốc:</label>
                  <select
                    value={disposalBatch}
                    onChange={(e) => setDisposalBatch(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-rose-500 bg-slate-50"
                  >
                    <option value="MOR-260201">MOR-260201 (Hạn: 02/2027)</option>
                    <option value="MOR-260904">MOR-260904 (Hạn: 09/2027)</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Trả lại (hộp/ống):</label>
                    <input
                      type="number"
                      min={0}
                      value={disposalReturnQty}
                      onChange={(e) => setDisposalReturnQty(parseInt(e.target.value) || 0)}
                      className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-center font-bold focus:ring-2 focus:ring-rose-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Tiêu hủy/Hao hụt:</label>
                    <input
                      type="number"
                      min={0}
                      value={disposalWasteQty}
                      onChange={(e) => setDisposalWasteQty(parseInt(e.target.value) || 0)}
                      className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-center font-bold focus:ring-2 focus:ring-rose-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Dược sĩ làm chứng:</label>
                  <select
                    value={disposalWitness}
                    onChange={(e) => setDisposalWitness(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-rose-500 bg-slate-50"
                  >
                    <option value="DS. Trần Văn Sơn">DS. Trần Văn Sơn</option>
                    <option value="DS. Phạm Minh Châu">DS. Phạm Minh Châu</option>
                    <option value="DS. Nguyễn Hoàng Hải">DS. Nguyễn Hoàng Hải</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">PIN của người làm chứng:</label>
                  <input
                    type="password"
                    maxLength={4}
                    placeholder="Mã PIN 4 số"
                    value={disposalWitnessPIN}
                    onChange={(e) => setDisposalWitnessPIN(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs focus:ring-2 focus:ring-rose-500 text-center font-bold font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Lý do hao hụt / tiêu hủy:</label>
                  <textarea
                    rows={2}
                    value={disposalReason}
                    onChange={(e) => setDisposalReason(e.target.value)}
                    placeholder="Nhập lý do chi tiết..."
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-rose-500"
                  />
                </div>

                {disposalError && (
                  <div className="text-[11px] text-rose-600 font-bold bg-rose-50 p-2 rounded border border-rose-100">
                    {disposalError}
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full bg-rose-600 hover:bg-rose-700 text-white py-2 rounded-xl text-xs font-bold shadow-md transition-all flex items-center justify-center space-x-1"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Xác nhận tiêu hủy thuốc</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ── DISPENSING VERIFICATION MODAL (SAFETY GATE) ──────────────────────── */}
      {verificationOrder && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-teal-800 to-emerald-800 px-6 py-4 text-white">
              <div className="flex items-center space-x-2 text-teal-200 text-xs font-bold uppercase tracking-wider mb-1">
                <ShieldCheck className="w-4 h-4" />
                <span>Quy trình kiểm tra an toàn cấp phát (Dispensing Gate)</span>
              </div>
              <div className="text-xl font-black">{verificationOrder.drugName}</div>
              <div className="text-teal-100 text-xs mt-0.5">
                Bệnh nhân: {verificationOrder.patientName} · Giường: {verificationOrder.wardBed} · MRN: {verificationOrder.patientMRN}
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              
              {/* Allergy Warning Alert Box */}
              {verificationOrder.allergies.some((a) =>
                verificationOrder.drugName.toLowerCase().includes(a.toLowerCase().slice(0, 5)) ||
                (a.toLowerCase() === 'penicillin' && verificationOrder.drugName.toLowerCase().includes('meropenem'))
              ) && (
                <div className="flex items-start space-x-3 bg-rose-50 border border-rose-400 rounded-xl p-4 animate-pulse">
                  <AlertCircle className="w-6 h-6 text-rose-600 mt-0.5 shrink-0" />
                  <div>
                    <h4 className="text-xs font-black text-rose-800 uppercase">🔴 CẢNH BÁO DỊ ỨNG CHÉO NGHIÊM TRỌNG</h4>
                    <p className="text-xs text-rose-700 mt-1 leading-relaxed">
                      Bệnh nhân dị ứng với <strong className="underline">Penicillin</strong>. Thuốc cấp phát là <strong className="underline">Meropenem</strong> (Nhóm Carbapenem có khả năng dị ứng chéo cao). Hãy rà soát hồ sơ lâm sàng của bác sĩ trước khi nhấn cấp phát.
                    </p>
                  </div>
                </div>
              )}

              {/* Patient Profile Context Bar */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
                <div className="text-[10px] text-slate-400 font-bold uppercase">Hồ sơ người bệnh (Encounter Context)</div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                  <div>
                    <span className="text-slate-400 font-medium">Bệnh nhân: </span>
                    <strong className="text-slate-700">{verificationOrder.patientName}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 font-medium">Giới tính/Tuổi: </span>
                    <strong className="text-slate-700">{verificationOrder.patientGender}/{verificationOrder.patientAge}T</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 font-medium">Mã MRN: </span>
                    <strong className="text-slate-700">{verificationOrder.patientMRN}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 font-medium">Encounter: </span>
                    <strong className="text-slate-700">{verificationOrder.encounterId}</strong>
                  </div>
                </div>
              </div>

              {/* Step 1: Safety checklist */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Bước 1: Tích xác nhận 5 luật an toàn dược:</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <button
                    onClick={() => setCheckedItems((p) => ({ ...p, patient: !p.patient }))}
                    className={`flex items-center space-x-2.5 px-3 py-2.5 rounded-lg border text-left text-xs transition-all ${
                      checkedItems.patient ? 'bg-teal-50 border-teal-300 font-bold text-teal-800' : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${checkedItems.patient ? 'bg-teal-600 border-teal-600 text-white' : 'border-slate-300 bg-white'}`}>
                      {checkedItems.patient && <Check className="w-3 h-3" />}
                    </div>
                    <span>Đúng Bệnh nhân ({verificationOrder.patientName})</span>
                  </button>

                  <button
                    onClick={() => setCheckedItems((p) => ({ ...p, order: !p.order }))}
                    className={`flex items-center space-x-2.5 px-3 py-2.5 rounded-lg border text-left text-xs transition-all ${
                      checkedItems.order ? 'bg-teal-50 border-teal-300 font-bold text-teal-800' : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${checkedItems.order ? 'bg-teal-600 border-teal-600 text-white' : 'border-slate-300 bg-white'}`}>
                      {checkedItems.order && <Check className="w-3 h-3" />}
                    </div>
                    <span>Đúng Thuốc & Hàm lượng ({verificationOrder.drugName})</span>
                  </button>

                  <button
                    onClick={() => setCheckedItems((p) => ({ ...p, allergy: !p.allergy }))}
                    className={`flex items-center space-x-2.5 px-3 py-2.5 rounded-lg border text-left text-xs transition-all ${
                      checkedItems.allergy ? 'bg-teal-50 border-teal-300 font-bold text-teal-800' : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${checkedItems.allergy ? 'bg-teal-600 border-teal-600 text-white' : 'border-slate-300 bg-white'}`}>
                      {checkedItems.allergy && <Check className="w-3 h-3" />}
                    </div>
                    <span>Đã soát dị ứng & Tương tác thuốc</span>
                  </button>

                  <button
                    onClick={() => setCheckedItems((p) => ({ ...p, route: !p.route }))}
                    className={`flex items-center space-x-2.5 px-3 py-2.5 rounded-lg border text-left text-xs transition-all ${
                      checkedItems.route ? 'bg-teal-50 border-teal-300 font-bold text-teal-800' : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${checkedItems.route ? 'bg-teal-600 border-teal-600 text-white' : 'border-slate-300 bg-white'}`}>
                      {checkedItems.route && <Check className="w-3 h-3" />}
                    </div>
                    <span>Đúng Đường dùng ({verificationOrder.route})</span>
                  </button>
                </div>
              </div>

              {/* Step 2: Batch FEFO and Qty */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Bước 2: Chọn Số Lô & Quản lý FEFO:</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">Mã Lô khả dụng (FEFO ưu tiên):</label>
                    <select
                      value={selectedBatchNumber}
                      onChange={(e) => setSelectedBatchNumber(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500 bg-slate-50"
                    >
                      {stocks
                        .find((s) => s.drugName === verificationOrder.drugName)
                        ?.batches.map((b, i) => (
                          <option key={b.batchNumber} value={b.batchNumber}>
                            Lô: {b.batchNumber} (HSD: {b.expiryDate}) {i === 0 ? ' [FEFO ƯU TIÊN]' : ''}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">Số lượng cấp phát thực tế:</label>
                    <input
                      type="number"
                      min={1}
                      value={dispenseQty}
                      onChange={(e) => setDispenseQty(parseInt(e.target.value) || 1)}
                      className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-center font-bold focus:ring-2 focus:ring-emerald-500 bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Step 3: Controlled substance Dual verification */}
              {verificationOrder.isNarcotics && (
                <div className="bg-rose-50/50 border border-rose-300 rounded-xl p-4 space-y-3">
                  <div className="flex items-center space-x-2 text-rose-800 text-xs font-black">
                    <Lock className="w-4 h-4 text-rose-600" />
                    <span>Duyệt kép kiểm soát Độc Dược (Narcotics Double Sign)</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-1">Dược sĩ giám sát (Witness):</label>
                      <select
                        value={witnessPharmacist}
                        onChange={(e) => setWitnessPharmacist(e.target.value)}
                        className="w-full border border-slate-300 bg-white rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-rose-500"
                      >
                        <option value="DS. Trần Văn Sơn">DS. Trần Văn Sơn</option>
                        <option value="DS. Phạm Minh Châu">DS. Phạm Minh Châu</option>
                        <option value="DS. Nguyễn Hoàng Hải">DS. Nguyễn Hoàng Hải</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-1">Nhập mã PIN dược sĩ giám sát:</label>
                      <input
                        type="password"
                        maxLength={4}
                        placeholder="Mã PIN 4 số"
                        value={witnessPIN}
                        onChange={(e) => setWitnessPIN(e.target.value)}
                        className="w-full border border-slate-300 bg-white rounded-lg px-3 py-1.5 text-xs text-center font-black tracking-widest font-mono focus:ring-2 focus:ring-rose-500"
                      />
                    </div>
                  </div>
                  {witnessError && (
                    <div className="text-[10px] text-rose-700 font-bold bg-rose-100/50 p-2 rounded">
                      {witnessError}
                    </div>
                  )}
                </div>
              )}

              {/* Step 4: Destination */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">Khoa / Phòng tiếp nhận:</label>
                <input
                  type="text"
                  value={destinationWard}
                  onChange={(e) => setDestinationWard(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs bg-slate-50 text-slate-700 font-bold focus:outline-none"
                />
              </div>

            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 px-6 py-4 flex gap-3 border-t border-slate-200">
              <button
                onClick={() => setVerificationOrder(null)}
                className="flex-1 px-4 py-2.5 text-xs font-bold text-slate-600 bg-slate-200 hover:bg-slate-300 rounded-xl transition-all"
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleConfirmDispense}
                disabled={
                  !checkedItems.patient ||
                  !checkedItems.order ||
                  !checkedItems.allergy ||
                  !checkedItems.route
                }
                className={`flex-1 px-4 py-2.5 text-xs font-bold rounded-xl flex items-center justify-center space-x-1.5 transition-all ${
                  checkedItems.patient &&
                  checkedItems.order &&
                  checkedItems.allergy &&
                  checkedItems.route
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md'
                    : 'bg-slate-300 text-slate-500 cursor-not-allowed'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Hoàn tất cấp phát dược</span>
              </button>
            </div>
            {(!checkedItems.patient || !checkedItems.order || !checkedItems.allergy || !checkedItems.route) && (
              <p className="text-[10px] text-center text-slate-400 pb-3 bg-slate-50">
                Hãy tích kiểm tra cả 4 luật an toàn lâm sàng để mở khóa nút cấp phát.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
