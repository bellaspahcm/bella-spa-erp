'use client';

import React, { useState } from 'react';
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
} from 'lucide-react';

// ─── Inpatient Pharmacy Types ───────────────────────────────────────────────
interface WardStock {
  id: string;
  drugName: string;
  genericName: string;
  category: 'antibiotic' | 'controlled' | 'iv_fluid' | 'analgesic' | 'general';
  unit: string;
  currentStock: number;
  minStock: number;
  wardId: string;
  wardName: string;
  lastDispensed: string;
  isNarcotics: boolean;
}

interface DispenseOrder {
  id: string;
  patientName: string;
  wardBed: string;
  drugName: string;
  dose: string;
  route: string;
  frequency: string;
  requestedBy: string;
  requestedAt: string;
  status: 'pending' | 'dispensed' | 'cancelled';
  isUrgent: boolean;
}

// ─── Mock Data ───────────────────────────────────────────────────────────────
const MOCK_WARD_STOCKS: WardStock[] = [
  {
    id: 'ws-001',
    drugName: 'Meropenem 1g/20ml',
    genericName: 'Meropenem',
    category: 'antibiotic',
    unit: 'Lọ',
    currentStock: 8,
    minStock: 20,
    wardId: 'ward-icu',
    wardName: 'Khoa ICU',
    lastDispensed: '2026-08-08T14:30:00Z',
    isNarcotics: false,
  },
  {
    id: 'ws-002',
    drugName: 'Morphine 10mg/ml',
    genericName: 'Morphine Sulfate',
    category: 'controlled',
    unit: 'Ống',
    currentStock: 5,
    minStock: 10,
    wardId: 'ward-icu',
    wardName: 'Khoa ICU',
    lastDispensed: '2026-08-08T12:00:00Z',
    isNarcotics: true,
  },
  {
    id: 'ws-003',
    drugName: 'NaCl 0.9% 500ml',
    genericName: 'Sodium Chloride',
    category: 'iv_fluid',
    unit: 'Túi',
    currentStock: 45,
    minStock: 30,
    wardId: 'ward-general',
    wardName: 'Khoa Nội Tổng Hợp',
    lastDispensed: '2026-08-08T13:45:00Z',
    isNarcotics: false,
  },
  {
    id: 'ws-004',
    drugName: 'Paracetamol IV 1g/100ml',
    genericName: 'Acetaminophen',
    category: 'analgesic',
    unit: 'Chai',
    currentStock: 12,
    minStock: 20,
    wardId: 'ward-surgery',
    wardName: 'Khoa Ngoại',
    lastDispensed: '2026-08-08T10:00:00Z',
    isNarcotics: false,
  },
  {
    id: 'ws-005',
    drugName: 'Vancomycin 500mg',
    genericName: 'Vancomycin HCl',
    category: 'antibiotic',
    unit: 'Lọ',
    currentStock: 24,
    minStock: 15,
    wardId: 'ward-icu',
    wardName: 'Khoa ICU',
    lastDispensed: '2026-08-08T08:00:00Z',
    isNarcotics: false,
  },
];

const MOCK_DISPENSE_ORDERS: DispenseOrder[] = [
  {
    id: 'do-001',
    patientName: 'Nguyễn Văn Hoàng',
    wardBed: 'ICU-BED-01',
    drugName: 'Meropenem 1g/20ml',
    dose: '1g',
    route: 'IV',
    frequency: 'Q8H',
    requestedBy: 'BS. Trần Minh Khoa',
    requestedAt: '2026-08-08T14:00:00Z',
    status: 'pending',
    isUrgent: true,
  },
  {
    id: 'do-002',
    patientName: 'Lê Thị Hương',
    wardBed: 'NGOAI-BED-03',
    drugName: 'Paracetamol IV 1g/100ml',
    dose: '1g',
    route: 'IV Drip',
    frequency: 'Q6H',
    requestedBy: 'BS. Phạm Quốc Việt',
    requestedAt: '2026-08-08T13:30:00Z',
    status: 'pending',
    isUrgent: false,
  },
  {
    id: 'do-003',
    patientName: 'Trần Đức Mạnh',
    wardBed: 'NOI-BED-07',
    drugName: 'NaCl 0.9% 500ml',
    dose: '500ml',
    route: 'IV Drip',
    frequency: 'TID',
    requestedBy: 'BS. Nguyễn Thu Hà',
    requestedAt: '2026-08-08T12:00:00Z',
    status: 'dispensed',
    isUrgent: false,
  },
];

const CATEGORY_CONFIG = {
  antibiotic:  { label: 'Kháng sinh',         color: 'bg-amber-100 text-amber-800 border-amber-300' },
  controlled:  { label: 'Thuốc kiểm soát đặc biệt', color: 'bg-rose-100 text-rose-800 border-rose-300' },
  iv_fluid:    { label: 'Dịch truyền IV',      color: 'bg-blue-100 text-blue-800 border-blue-300' },
  analgesic:   { label: 'Giảm đau',            color: 'bg-purple-100 text-purple-800 border-purple-300' },
  general:     { label: 'Thuốc thường',        color: 'bg-slate-100 text-slate-700 border-slate-300' },
};

export default function HospitalPharmacyPage() {
  const [activeTab, setActiveTab] = useState<'dispense' | 'stock' | 'narcotic'>('dispense');
  const [searchTerm, setSearchTerm] = useState('');
  const [orders, setOrders] = useState<DispenseOrder[]>(MOCK_DISPENSE_ORDERS);

  const handleDispense = (id: string) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === id ? { ...o, status: 'dispensed' as const } : o))
    );
  };

  const filteredStocks = MOCK_WARD_STOCKS.filter(
    (s) =>
      s.drugName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.wardName.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const lowStockItems = MOCK_WARD_STOCKS.filter((s) => s.currentStock < s.minStock);
  const pendingOrders = orders.filter((o) => o.status === 'pending');

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-cyan-900 rounded-2xl p-6 text-white shadow-xl">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center space-x-2 text-emerald-300 mb-1">
              <Package className="w-5 h-5" />
              <span className="text-xs font-semibold uppercase tracking-wider">
                Bella Hospital • Inpatient Pharmacy Management System
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold">Kho Dược Nội Trú & Cấp Phát</h1>
            <p className="text-emerald-100 text-sm mt-1">
              Quản lý tồn kho thuốc theo khoa phòng, cấp phát theo y lệnh MAR và kiểm soát thuốc đặc biệt nội trú.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center bg-white/10 rounded-xl px-4 py-3 border border-white/20">
              <div className="text-2xl font-black text-emerald-300">{pendingOrders.length}</div>
              <div className="text-[10px] text-emerald-200 font-semibold">Y lệnh chờ cấp</div>
            </div>
            <div className="text-center bg-white/10 rounded-xl px-4 py-3 border border-white/20">
              <div className="text-2xl font-black text-amber-300">{lowStockItems.length}</div>
              <div className="text-[10px] text-amber-200 font-semibold">Sắp hết tồn kho</div>
            </div>
            <div className="text-center bg-white/10 rounded-xl px-4 py-3 border border-white/20">
              <div className="text-2xl font-black text-rose-300">
                {MOCK_WARD_STOCKS.filter((s) => s.isNarcotics).length}
              </div>
              <div className="text-[10px] text-rose-200 font-semibold">Thuốc kiểm soát</div>
            </div>
          </div>
        </div>
      </div>

      {/* Low Stock Alert */}
      {lowStockItems.length > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 flex items-start space-x-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
          <div>
            <div className="font-bold text-amber-800 text-sm">Cảnh báo tồn kho thấp</div>
            <div className="text-xs text-amber-700 mt-1">
              {lowStockItems.map((s) => `${s.drugName} (${s.wardName}: còn ${s.currentStock}/${s.minStock} ${s.unit})`).join(' · ')}
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-1">
        {[
          { key: 'dispense', label: 'Cấp Phát Theo Y Lệnh', icon: ClipboardList },
          { key: 'stock',    label: 'Tồn Kho Khoa Phòng',   icon: Package },
          { key: 'narcotic', label: 'Thuốc Kiểm Soát Đặc Biệt', icon: ShieldAlert },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key as typeof activeTab)}
            className={`py-3 px-5 text-sm font-semibold flex items-center space-x-2 border-b-2 transition-all ${
              activeTab === key
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Icon className="w-4 h-4" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'dispense' && (
        <div className="space-y-4">
          {orders.map((order) => (
            <div
              key={order.id}
              className={`bg-white rounded-xl border shadow-sm p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${
                order.isUrgent ? 'border-rose-300 bg-rose-50/20' : 'border-slate-200'
              }`}
            >
              <div className="space-y-1.5">
                <div className="flex items-center space-x-2">
                  {order.isUrgent && (
                    <span className="text-[10px] font-black bg-rose-600 text-white px-2 py-0.5 rounded animate-pulse">
                      KHẨN
                    </span>
                  )}
                  <span className="font-bold text-slate-800">{order.patientName}</span>
                  <span className="text-xs text-slate-500">• Giường: {order.wardBed}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Pill className="w-4 h-4 text-emerald-600" />
                  <span className="font-semibold text-emerald-800">{order.drugName}</span>
                  <span className="text-xs text-slate-600">
                    {order.dose} · {order.route} · {order.frequency}
                  </span>
                </div>
                <div className="text-xs text-slate-500">
                  Chỉ định bởi: <span className="font-medium">{order.requestedBy}</span> lúc{' '}
                  {new Date(order.requestedAt).toLocaleString('vi-VN')}
                </div>
              </div>
              <div className="shrink-0">
                {order.status === 'pending' ? (
                  <button
                    onClick={() => handleDispense(order.id)}
                    className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-sm font-semibold shadow transition-all"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Xác nhận cấp phát</span>
                  </button>
                ) : (
                  <span className="flex items-center space-x-1.5 text-emerald-700 bg-emerald-100 px-3 py-1.5 rounded-lg text-xs font-bold border border-emerald-200">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Đã cấp phát</span>
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'stock' && (
        <div className="space-y-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm theo tên thuốc hoặc khoa..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 w-full border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-bold text-slate-600 uppercase">Tên thuốc</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-slate-600 uppercase">Nhóm</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-slate-600 uppercase">Khoa</th>
                  <th className="text-center px-4 py-3 text-xs font-bold text-slate-600 uppercase">Tồn kho</th>
                  <th className="text-center px-4 py-3 text-xs font-bold text-slate-600 uppercase">Tối thiểu</th>
                  <th className="text-center px-4 py-3 text-xs font-bold text-slate-600 uppercase">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStocks.map((s) => {
                  const isLow = s.currentStock < s.minStock;
                  const cfg = CATEGORY_CONFIG[s.category];
                  return (
                    <tr key={s.id} className={isLow ? 'bg-amber-50/40' : ''}>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-800">{s.drugName}</div>
                        <div className="text-xs text-slate-500">{s.genericName}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded border ${cfg.color}`}>
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-700 text-xs font-medium">{s.wardName}</td>
                      <td className="px-4 py-3 text-center font-bold text-slate-900">
                        {s.currentStock} {s.unit}
                      </td>
                      <td className="px-4 py-3 text-center text-slate-500 text-xs">{s.minStock} {s.unit}</td>
                      <td className="px-4 py-3 text-center">
                        {isLow ? (
                          <span className="flex items-center justify-center space-x-1 text-amber-700 font-bold text-[11px]">
                            <TrendingDown className="w-3.5 h-3.5" />
                            <span>Cần bổ sung</span>
                          </span>
                        ) : (
                          <span className="text-emerald-700 font-bold text-[11px]">✅ Đủ</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'narcotic' && (
        <div className="space-y-4">
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-start space-x-3">
            <ShieldAlert className="w-5 h-5 text-rose-600 mt-0.5 shrink-0" />
            <div className="text-sm text-rose-800">
              <strong>Quy định kiểm soát đặc biệt:</strong> Tất cả thuốc gây nghiện, hướng thần phải được ghi sổ kiểm soát kép. 
              Mỗi lần cấp phát cần chữ ký của 2 dược sĩ. Báo cáo hàng tháng gửi Sở Y Tế.
            </div>
          </div>
          {MOCK_WARD_STOCKS.filter((s) => s.isNarcotics || s.category === 'controlled').map((s) => (
            <div key={s.id} className="bg-white border border-rose-200 rounded-xl p-5 shadow-sm">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center space-x-2">
                    <ShieldAlert className="w-4 h-4 text-rose-600" />
                    <span className="font-bold text-slate-800">{s.drugName}</span>
                    <span className="text-[10px] font-black bg-rose-100 text-rose-700 px-2 py-0.5 rounded border border-rose-200">
                      KIỂM SOÁT ĐẶC BIỆT
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-1">Khoa: {s.wardName}</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-slate-900">{s.currentStock} / {s.minStock} {s.unit}</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Xuất lần cuối: {new Date(s.lastDispensed).toLocaleString('vi-VN')}
                  </div>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-rose-100 flex justify-end">
                <button className="flex items-center space-x-1.5 text-xs font-semibold text-rose-700 hover:text-rose-900 transition-colors">
                  <FlaskConical className="w-3.5 h-3.5" />
                  <span>Xem sổ kiểm soát</span>
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
