'use client';

import React, { useState } from 'react';
import {
  CircleDollarSign,
  FileText,
  CheckCircle2,
  Clock,
  CreditCard,
  Building2,
  Wallet,
  BarChart3,
  AlertCircle,
  ChevronRight,
  Receipt,
} from 'lucide-react';

// ─── Inpatient Billing Types ─────────────────────────────────────────────────
interface InpatientBill {
  id: string;
  patientName: string;
  admissionNo: string;
  wardBed: string;
  admittedAt: string;
  dischargedAt: string | null;
  daysStayed: number;
  roomCharges: number;
  medicationCharges: number;
  procedureCharges: number;
  labImagingCharges: number;
  nursingCharges: number;
  totalAmount: number;
  bhytCoverage: number;
  patientPays: number;
  depositPaid: number;
  status: 'open' | 'pending_discharge' | 'finalized' | 'paid';
  insuranceCode: string | null;
}

const MOCK_BILLS: InpatientBill[] = [
  {
    id: 'bill-001',
    patientName: 'Nguyễn Văn Hoàng',
    admissionNo: 'ADM-2026-0892',
    wardBed: 'ICU-BED-01',
    admittedAt: '2026-08-03T08:00:00Z',
    dischargedAt: null,
    daysStayed: 5,
    roomCharges: 5_000_000,
    medicationCharges: 3_200_000,
    procedureCharges: 8_500_000,
    labImagingCharges: 2_100_000,
    nursingCharges: 1_500_000,
    totalAmount: 20_300_000,
    bhytCoverage: 14_210_000,
    patientPays: 6_090_000,
    depositPaid: 5_000_000,
    status: 'open',
    insuranceCode: 'BHYT-HA-123456',
  },
  {
    id: 'bill-002',
    patientName: 'Lê Thị Hương',
    admissionNo: 'ADM-2026-0887',
    wardBed: 'NGOAI-BED-03',
    admittedAt: '2026-08-01T10:00:00Z',
    dischargedAt: '2026-08-07T14:00:00Z',
    daysStayed: 6,
    roomCharges: 3_600_000,
    medicationCharges: 1_800_000,
    procedureCharges: 12_000_000,
    labImagingCharges: 900_000,
    nursingCharges: 1_200_000,
    totalAmount: 19_500_000,
    bhytCoverage: 15_600_000,
    patientPays: 3_900_000,
    depositPaid: 3_900_000,
    status: 'finalized',
    insuranceCode: 'BHYT-HCM-789012',
  },
  {
    id: 'bill-003',
    patientName: 'Trần Đức Mạnh',
    admissionNo: 'ADM-2026-0901',
    wardBed: 'NOI-BED-07',
    admittedAt: '2026-08-06T14:30:00Z',
    dischargedAt: null,
    daysStayed: 2,
    roomCharges: 1_200_000,
    medicationCharges: 650_000,
    procedureCharges: 0,
    labImagingCharges: 1_450_000,
    nursingCharges: 600_000,
    totalAmount: 3_900_000,
    bhytCoverage: 0,
    patientPays: 3_900_000,
    depositPaid: 2_000_000,
    status: 'open',
    insuranceCode: null,
  },
];

const STATUS_CONFIG = {
  open:              { label: 'Đang điều trị',  color: 'bg-blue-100 text-blue-800 border-blue-200' },
  pending_discharge: { label: 'Chờ chốt viện phí', color: 'bg-amber-100 text-amber-800 border-amber-200' },
  finalized:         { label: 'Đã chốt',        color: 'bg-purple-100 text-purple-800 border-purple-200' },
  paid:              { label: 'Đã thanh toán',  color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
};

const fmt = (n: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n);

export default function HospitalBillingPage() {
  const [activeTab, setActiveTab] = useState<'inpatient' | 'stats'>('inpatient');
  const [selected, setSelected] = useState<string | null>(null);

  const selectedBill = MOCK_BILLS.find((b) => b.id === selected);
  const totalRevenue = MOCK_BILLS.reduce((s, b) => s + b.totalAmount, 0);
  const bhytTotal = MOCK_BILLS.reduce((s, b) => s + b.bhytCoverage, 0);
  const openBills = MOCK_BILLS.filter((b) => b.status === 'open').length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-900 via-purple-900 to-slate-900 rounded-2xl p-6 text-white shadow-xl">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center space-x-2 text-indigo-300 mb-1">
              <CircleDollarSign className="w-5 h-5" />
              <span className="text-xs font-semibold uppercase tracking-wider">
                Bella Hospital • Inpatient Billing & Insurance Management
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold">Viện Phí Nội Trú & Thanh Toán</h1>
            <p className="text-indigo-100 text-sm mt-1">
              Quản lý viện phí theo ngày nằm viện, chi phí thuốc, thủ thuật, cận lâm sàng và giám định BHYT.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center bg-white/10 rounded-xl px-4 py-3 border border-white/20">
              <div className="text-xl font-black text-indigo-200">{fmt(totalRevenue)}</div>
              <div className="text-[10px] text-indigo-300 font-semibold">Tổng viện phí</div>
            </div>
            <div className="text-center bg-white/10 rounded-xl px-4 py-3 border border-white/20">
              <div className="text-xl font-black text-emerald-300">{fmt(bhytTotal)}</div>
              <div className="text-[10px] text-emerald-200 font-semibold">BHYT chi trả</div>
            </div>
            <div className="text-center bg-white/10 rounded-xl px-4 py-3 border border-white/20">
              <div className="text-2xl font-black text-amber-300">{openBills}</div>
              <div className="text-[10px] text-amber-200 font-semibold">Đang điều trị</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-1">
        {[
          { key: 'inpatient', label: 'Hồ sơ viện phí bệnh nhân', icon: FileText },
          { key: 'stats',     label: 'Tổng hợp doanh thu viện phí', icon: BarChart3 },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key as typeof activeTab)}
            className={`py-3 px-5 text-sm font-semibold flex items-center space-x-2 border-b-2 transition-all ${
              activeTab === key
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Icon className="w-4 h-4" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {activeTab === 'inpatient' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Bill List */}
          <div className="lg:col-span-1 space-y-3">
            {MOCK_BILLS.map((bill) => {
              const cfg = STATUS_CONFIG[bill.status];
              return (
                <button
                  key={bill.id}
                  onClick={() => setSelected(bill.id === selected ? null : bill.id)}
                  className={`w-full text-left bg-white border rounded-xl p-4 shadow-sm hover:shadow-md transition-all ${
                    selected === bill.id ? 'border-indigo-500 ring-2 ring-indigo-200' : 'border-slate-200'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-bold text-slate-800 text-sm">{bill.patientName}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${cfg.color}`}>
                      {cfg.label}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 space-y-0.5">
                    <div>{bill.admissionNo} · {bill.wardBed}</div>
                    <div>{bill.daysStayed} ngày · {bill.insuranceCode ? `BHYT: ${bill.insuranceCode}` : 'Tự túc'}</div>
                  </div>
                  <div className="mt-2 pt-2 border-t border-slate-100 flex justify-between items-center">
                    <span className="text-xs text-slate-500">Tổng viện phí</span>
                    <span className="font-black text-indigo-700 text-sm">{fmt(bill.totalAmount)}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Bill Detail */}
          <div className="lg:col-span-2">
            {selectedBill ? (
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-slate-900 text-lg">{selectedBill.patientName}</h3>
                    <p className="text-xs text-slate-500">{selectedBill.admissionNo} · Giường: {selectedBill.wardBed}</p>
                  </div>
                  <span className={`text-xs font-bold px-2 py-1 rounded border ${STATUS_CONFIG[selectedBill.status].color}`}>
                    {STATUS_CONFIG[selectedBill.status].label}
                  </span>
                </div>

                {/* Cost Breakdown */}
                <div className="bg-slate-50 rounded-xl p-4 space-y-2">
                  <h4 className="font-bold text-slate-700 text-sm mb-3">Chi tiết viện phí</h4>
                  {[
                    { label: `Phòng/Giường (${selectedBill.daysStayed} ngày)`, amount: selectedBill.roomCharges, icon: Building2 },
                    { label: 'Thuốc & Vật tư nội trú', amount: selectedBill.medicationCharges, icon: Receipt },
                    { label: 'Thủ thuật & Phẫu thuật', amount: selectedBill.procedureCharges, icon: FileText },
                    { label: 'Xét nghiệm & Hình ảnh', amount: selectedBill.labImagingCharges, icon: BarChart3 },
                    { label: 'Phí điều dưỡng & Chăm sóc', amount: selectedBill.nursingCharges, icon: Wallet },
                  ].map(({ label, amount, icon: Icon }) => (
                    <div key={label} className="flex justify-between items-center text-sm">
                      <div className="flex items-center space-x-2 text-slate-600">
                        <Icon className="w-3.5 h-3.5 text-slate-400" />
                        <span>{label}</span>
                      </div>
                      <span className="font-semibold text-slate-800">{fmt(amount)}</span>
                    </div>
                  ))}
                  <div className="pt-2 border-t border-slate-200 flex justify-between font-bold text-slate-900">
                    <span>Tổng cộng</span>
                    <span className="text-indigo-700">{fmt(selectedBill.totalAmount)}</span>
                  </div>
                </div>

                {/* Insurance & Payment */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                    <div className="text-xs font-bold text-emerald-700 mb-1">BHYT chi trả</div>
                    <div className="text-lg font-black text-emerald-800">{fmt(selectedBill.bhytCoverage)}</div>
                    {selectedBill.insuranceCode && (
                      <div className="text-[10px] text-emerald-600 mt-1">{selectedBill.insuranceCode}</div>
                    )}
                  </div>
                  <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3">
                    <div className="text-xs font-bold text-indigo-700 mb-1">Bệnh nhân thanh toán</div>
                    <div className="text-lg font-black text-indigo-800">{fmt(selectedBill.patientPays)}</div>
                    <div className="text-[10px] text-indigo-600 mt-1">
                      Đã đặt cọc: {fmt(selectedBill.depositPaid)}
                    </div>
                  </div>
                </div>

                {selectedBill.patientPays > selectedBill.depositPaid && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center space-x-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    <div className="text-xs text-amber-800">
                      <strong>Còn lại:</strong> {fmt(selectedBill.patientPays - selectedBill.depositPaid)}
                    </div>
                  </div>
                )}

                <div className="flex justify-end space-x-3">
                  <button className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors flex items-center space-x-1.5">
                    <FileText className="w-3.5 h-3.5" />
                    <span>Xuất hóa đơn</span>
                  </button>
                  {selectedBill.status === 'open' && (
                    <button className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-colors shadow flex items-center space-x-1.5">
                      <CreditCard className="w-3.5 h-3.5" />
                      <span>Chốt viện phí & Thanh toán</span>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-slate-50 border border-slate-200 rounded-xl h-full min-h-[300px] flex items-center justify-center">
                <div className="text-center text-slate-400">
                  <CircleDollarSign className="w-10 h-10 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">Chọn hồ sơ bệnh nhân để xem chi tiết viện phí</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'stats' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Tổng viện phí tháng này', value: fmt(totalRevenue), icon: CircleDollarSign, color: 'text-indigo-700', bg: 'bg-indigo-50 border-indigo-200' },
            { label: 'BHYT chi trả', value: fmt(bhytTotal), icon: CheckCircle2, color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
            { label: 'Tự túc (bệnh nhân trả)', value: fmt(totalRevenue - bhytTotal), icon: Wallet, color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
            { label: 'Hồ sơ đang điều trị', value: `${openBills} bệnh nhân`, icon: Clock, color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className={`rounded-xl border p-5 ${bg}`}>
              <Icon className={`w-6 h-6 mb-2 ${color}`} />
              <div className={`text-xl font-black ${color}`}>{value}</div>
              <div className="text-xs text-slate-600 mt-1">{label}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
