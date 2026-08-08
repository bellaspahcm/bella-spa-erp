'use client';

import React, { useState } from 'react';
import {
  FileText,
  Building2,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Plus,
  Eye,
  AlertCircle,
} from 'lucide-react';

// ─── Hospital Insurance Contract Types ───────────────────────────────────────
interface InsuranceContract {
  id: string;
  contractNo: string;
  insurer: string;
  type: 'bhyt' | 'commercial' | 'corporate';
  coveredServices: string[];
  coverageRate: number; // percentage
  annualCap: number;
  validFrom: string;
  validTo: string;
  status: 'active' | 'expiring' | 'expired' | 'draft';
  totalClaimed: number;
  totalApproved: number;
  claimsCount: number;
}

const MOCK_CONTRACTS: InsuranceContract[] = [
  {
    id: 'cnt-001',
    contractNo: 'BHYT-2026-HCM-0145',
    insurer: 'Bảo hiểm Y tế Xã hội (BHXH TP.HCM)',
    type: 'bhyt',
    coveredServices: ['Khám bệnh nội trú', 'Phẫu thuật', 'Thuốc thiết yếu', 'Cận lâm sàng', 'Điều dưỡng'],
    coverageRate: 80,
    annualCap: 5_000_000_000,
    validFrom: '2026-01-01',
    validTo: '2026-12-31',
    status: 'active',
    totalClaimed: 1_245_000_000,
    totalApproved: 1_100_000_000,
    claimsCount: 342,
  },
  {
    id: 'cnt-002',
    contractNo: 'TM-2026-BVL-0088',
    insurer: 'Bảo Việt Life Insurance',
    type: 'commercial',
    coveredServices: ['Phòng VIP', 'Phẫu thuật tim mạch', 'Ung thư', 'ICU nâng cao'],
    coverageRate: 100,
    annualCap: 2_000_000_000,
    validFrom: '2026-03-01',
    validTo: '2027-02-28',
    status: 'active',
    totalClaimed: 380_000_000,
    totalApproved: 375_000_000,
    claimsCount: 45,
  },
  {
    id: 'cnt-003',
    contractNo: 'DN-2026-FPT-0023',
    insurer: 'FPT Corporation — Gói khám chữa bệnh nhân viên',
    type: 'corporate',
    coveredServices: ['Khám sức khỏe định kỳ', 'Cấp cứu', 'Nội trú ngắn ngày'],
    coverageRate: 90,
    annualCap: 500_000_000,
    validFrom: '2026-01-15',
    validTo: '2026-07-14',
    status: 'expired',
    totalClaimed: 120_000_000,
    totalApproved: 108_000_000,
    claimsCount: 28,
  },
  {
    id: 'cnt-004',
    contractNo: 'TM-2026-PVI-0101',
    insurer: 'PVI Insurance — Gói cao cấp Premium',
    type: 'commercial',
    coveredServices: ['Toàn bộ dịch vụ nội trú', 'Chuyên gia quốc tế', 'Phòng suite'],
    coverageRate: 100,
    annualCap: 10_000_000_000,
    validFrom: '2026-06-01',
    validTo: '2026-11-30',
    status: 'expiring',
    totalClaimed: 890_000_000,
    totalApproved: 880_000_000,
    claimsCount: 78,
  },
];

const TYPE_CONFIG = {
  bhyt:       { label: 'BHYT Xã hội', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  commercial: { label: 'Bảo hiểm thương mại', color: 'bg-purple-100 text-purple-800 border-purple-200' },
  corporate:  { label: 'Hợp đồng doanh nghiệp', color: 'bg-teal-100 text-teal-800 border-teal-200' },
};

const STATUS_CONFIG = {
  active:   { label: 'Đang hiệu lực', color: 'bg-emerald-100 text-emerald-800', icon: CheckCircle2 },
  expiring: { label: 'Sắp hết hạn',   color: 'bg-amber-100 text-amber-800',   icon: Clock },
  expired:  { label: 'Đã hết hạn',    color: 'bg-rose-100 text-rose-800',     icon: AlertCircle },
  draft:    { label: 'Bản nháp',      color: 'bg-slate-100 text-slate-700',   icon: FileText },
};

const fmt = (n: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(n);

export default function HospitalContractsPage() {
  const [filter, setFilter] = useState<'all' | 'bhyt' | 'commercial' | 'corporate'>('all');

  const filtered = MOCK_CONTRACTS.filter((c) => filter === 'all' || c.type === filter);
  const activeContracts = MOCK_CONTRACTS.filter((c) => c.status === 'active').length;
  const expiringContracts = MOCK_CONTRACTS.filter((c) => c.status === 'expiring').length;
  const totalApproved = MOCK_CONTRACTS.reduce((s, c) => s + c.totalApproved, 0);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-teal-900 via-cyan-900 to-blue-900 rounded-2xl p-6 text-white shadow-xl">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center space-x-2 text-teal-300 mb-1">
              <ShieldCheck className="w-5 h-5" />
              <span className="text-xs font-semibold uppercase tracking-wider">
                Bella Hospital • Insurance & Corporate Contract Management
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold">Hợp Đồng Bảo Hiểm Bệnh Viện</h1>
            <p className="text-teal-100 text-sm mt-1">
              Quản lý hợp đồng BHYT xã hội, bảo hiểm thương mại, hợp đồng doanh nghiệp và theo dõi bồi thường.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center bg-white/10 rounded-xl px-4 py-3 border border-white/20">
              <div className="text-2xl font-black text-emerald-300">{activeContracts}</div>
              <div className="text-[10px] text-emerald-200 font-semibold">Hợp đồng hiệu lực</div>
            </div>
            <div className="text-center bg-white/10 rounded-xl px-4 py-3 border border-white/20">
              <div className="text-2xl font-black text-amber-300">{expiringContracts}</div>
              <div className="text-[10px] text-amber-200 font-semibold">Sắp hết hạn</div>
            </div>
            <div className="text-center bg-white/10 rounded-xl px-4 py-3 border border-white/20">
              <div className="text-lg font-black text-teal-200">{fmt(totalApproved)}</div>
              <div className="text-[10px] text-teal-300 font-semibold">Đã bồi thường</div>
            </div>
          </div>
        </div>
      </div>

      {/* Expiring Alert */}
      {expiringContracts > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 flex items-start space-x-3">
          <Clock className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
          <div>
            <div className="font-bold text-amber-800 text-sm">Hợp đồng sắp hết hạn</div>
            <div className="text-xs text-amber-700 mt-1">
              {MOCK_CONTRACTS.filter((c) => c.status === 'expiring').map((c) => c.insurer).join(', ')} — Cần gia hạn trước ngày hết hạn.
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {[
            { key: 'all',        label: 'Tất cả' },
            { key: 'bhyt',       label: 'BHYT' },
            { key: 'commercial', label: 'Bảo hiểm TM' },
            { key: 'corporate',  label: 'Doanh nghiệp' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key as typeof filter)}
              className={`px-4 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                filter === key
                  ? 'bg-teal-700 text-white border-teal-700'
                  : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <button className="flex items-center space-x-1.5 px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-semibold shadow transition-all">
          <Plus className="w-3.5 h-3.5" />
          <span>Thêm hợp đồng mới</span>
        </button>
      </div>

      {/* Contract List */}
      <div className="space-y-4">
        {filtered.map((contract) => {
          const typeCfg = TYPE_CONFIG[contract.type];
          const statusCfg = STATUS_CONFIG[contract.status];
          const StatusIcon = statusCfg.icon;
          const approvalRate = contract.totalClaimed > 0
            ? Math.round((contract.totalApproved / contract.totalClaimed) * 100)
            : 0;

          return (
            <div
              key={contract.id}
              className={`bg-white border rounded-xl shadow-sm p-5 ${
                contract.status === 'expiring' ? 'border-amber-300' : 
                contract.status === 'expired' ? 'border-slate-200 opacity-70' : 'border-slate-200'
              }`}
            >
              <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded border ${typeCfg.color}`}>
                      {typeCfg.label}
                    </span>
                    <span className={`flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded ${statusCfg.color}`}>
                      <StatusIcon className="w-3 h-3" />
                      {statusCfg.label}
                    </span>
                  </div>
                  <div>
                    <div className="font-bold text-slate-900">{contract.insurer}</div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      Số HĐ: {contract.contractNo} · Bảo hiểm {contract.coverageRate}% · Hạn mức: {fmt(contract.annualCap)}/năm
                    </div>
                    <div className="text-xs text-slate-500">
                      Hiệu lực: {contract.validFrom} → {contract.validTo}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {contract.coveredServices.map((s) => (
                      <span key={s} className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full border border-slate-200">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="shrink-0 flex flex-col items-end gap-3">
                  <div className="text-right">
                    <div className="text-xs text-slate-500">Đã yêu cầu / Đã duyệt</div>
                    <div className="font-bold text-slate-900 text-sm">
                      {fmt(contract.totalClaimed)} / <span className="text-emerald-700">{fmt(contract.totalApproved)}</span>
                    </div>
                    <div className="text-xs text-slate-500">{contract.claimsCount} lượt bồi thường · Tỷ lệ duyệt: {approvalRate}%</div>
                  </div>
                  <button className="flex items-center space-x-1.5 text-xs font-semibold text-teal-700 hover:text-teal-900 bg-teal-50 hover:bg-teal-100 border border-teal-200 px-3 py-1.5 rounded-lg transition-all">
                    <Eye className="w-3.5 h-3.5" />
                    <span>Xem chi tiết bồi thường</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
