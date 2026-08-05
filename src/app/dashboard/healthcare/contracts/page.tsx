'use client';

import React, { useState } from 'react';
import { FileText, Plus, Search, ArrowRight, Calendar, DollarSign, Shield, FileCheck, HelpCircle } from 'lucide-react';
import { toast } from 'sonner';
import { PremiumSelect } from '@/components/ui/PremiumSelect';

interface Contract {
  readonly id: string;
  readonly contractNumber: string;
  readonly patientName: string;
  readonly contractType: 'treatment_plan' | 'warranty' | 'membership' | 'spa_package';
  readonly status: 'draft' | 'pending_signature' | 'active' | 'suspended' | 'completed' | 'cancelled' | 'expired';
  readonly startDate: string;
  readonly endDate: string;
  readonly totalValue: number;
  readonly currency: string;
}

export default function ContractsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);

  // Form states
  const [patientName, setPatientName] = useState('Nguyễn Văn Hùng');
  const [contractType, setContractType] = useState<'treatment_plan' | 'warranty' | 'membership' | 'spa_package'>('treatment_plan');
  const [status, setStatus] = useState<Contract['status']>('draft');
  const [contractNumber, setContractNumber] = useState('HD-2026-003');
  const [totalValue, setTotalValue] = useState('15000000');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [contracts, setContracts] = useState<Contract[]>([
    {
      id: 'con-01',
      contractNumber: 'HD-2026-001',
      patientName: 'Nguyễn Văn Hùng',
      contractType: 'treatment_plan',
      status: 'active',
      startDate: '2026-06-01',
      endDate: '2026-12-01',
      totalValue: 35000000,
      currency: 'VND',
    },
    {
      id: 'con-02',
      contractNumber: 'HD-2026-002',
      patientName: 'Lê Thị Mai',
      contractType: 'membership',
      status: 'active',
      startDate: '2026-07-15',
      endDate: '2027-07-15',
      totalValue: 12000000,
      currency: 'VND',
    },
  ]);

  const patientOptions = [
    { value: 'Nguyễn Văn Hùng', label: 'Nguyễn Văn Hùng (GD4797921800124)' },
    { value: 'Lê Thị Mai', label: 'Lê Thị Mai (DN4797921800567)' },
    { value: 'Trần Minh Hoàng', label: 'Trần Minh Hoàng (CC037095000214)' },
  ];

  const typeOptions = [
    { value: 'treatment_plan', label: 'Phác đồ điều trị (Treatment Plan)' },
    { value: 'warranty', label: 'Thẻ bảo hành sứ/implant (Warranty)' },
    { value: 'membership', label: 'Hội viên VIP (Membership)' },
    { value: 'spa_package', label: 'Gói Spa đi kèm (Spa Package)' },
  ];

  const statusOptions = [
    { value: 'draft', label: 'Bản nháp (Draft)' },
    { value: 'pending_signature', label: 'Chờ ký duyệt (Pending)' },
    { value: 'active', label: 'Đang hiệu lực (Active)' },
    { value: 'completed', label: 'Hoàn tất (Completed)' },
  ];

  const handleRegisterContract = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contractNumber.trim() || !totalValue || !startDate || !endDate) {
      toast.error('Vui lòng nhập đầy đủ Số hợp đồng, Tổng trị giá và Thời hạn');
      return;
    }

    const newCon: Contract = {
      id: `con-${Date.now()}`,
      contractNumber,
      patientName,
      contractType,
      status,
      startDate,
      endDate,
      totalValue: Number(totalValue),
      currency: 'VND',
    };

    setContracts((prev) => [newCon, ...prev]);
    toast.success('🎉 Khởi tạo Hợp đồng / Kế hoạch mới thành công');
    
    // Reset form
    setContractNumber(`HD-2026-00${contracts.length + 4}`);
    setTotalValue('15000000');
    setStartDate('');
    setEndDate('');
    setShowAddModal(false);
  };

  const filtered = contracts.filter((c) => {
    const matchesSearch =
      c.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.contractNumber.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === 'all' || c.contractType === typeFilter;
    return matchesSearch && matchesType;
  });

  const getStatusBadge = (status: Contract['status']) => {
    switch (status) {
      case 'draft':
        return <span className="px-2 py-0.5 text-[10px] font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 rounded-md">BẢN NHÁP</span>;
      case 'pending_signature':
        return <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-50 text-amber-600 dark:bg-amber-950/20 dark:text-amber-400 border border-amber-100 rounded-md">CHỜ KÝ</span>;
      case 'active':
        return <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400 border border-emerald-100 rounded-md">ĐANG CHẠY</span>;
      case 'completed':
        return <span className="px-2 py-0.5 text-[10px] font-bold bg-blue-50 text-blue-600 dark:bg-blue-950/20 dark:text-blue-400 border border-blue-100 rounded-md">HOÀN TẤT</span>;
      default:
        return <span className="px-2 py-0.5 text-[10px] font-bold bg-slate-100 text-slate-500 rounded-md">{status.toUpperCase()}</span>;
    }
  };

  const getTypeLabel = (type: Contract['contractType']) => {
    switch (type) {
      case 'treatment_plan': return 'Phác đồ điều trị';
      case 'warranty': return 'Bảo hành dịch vụ';
      case 'membership': return 'Thẻ hội viên VIP';
      case 'spa_package': return 'Gói dịch vụ Spa';
    }
  };

  return (
    <div className="p-6 w-full space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-[24px] bg-white dark:bg-slate-950 border border-slate-300/85 dark:border-slate-850 shadow-[0_6px_24px_-2px_rgba(15,23,42,0.08),0_2px_6px_-1px_rgba(15,23,42,0.04)] dark:shadow-[0_6px_24px_rgba(0,0,0,0.4)] hover:shadow-[0_16px_36px_-4px_rgba(20,184,166,0.12),0_4px_12px_-2px_rgba(20,184,166,0.06)] hover:-translate-y-0.5 transition-all duration-300">
        <div className="flex items-center gap-3">
          <span className="p-2.5 rounded-xl bg-teal-500/10 text-teal-600 border border-teal-500/20 shadow-sm">
            <FileText className="w-5 h-5" />
          </span>
          <div className="text-left">
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              Kế hoạch điều trị & Hợp đồng (Contracts)
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Quản lý gói trị liệu dài hạn, cam kết bảo hành và điều khoản cam kết y tế của bệnh nhân
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all"
        >
          <Plus className="w-4 h-4" />
          Tạo hợp đồng mới
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-[16px] bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-[0_4px_12px_-1px_rgba(0,0,0,0.04)] dark:shadow-none">
        <div className="relative flex-grow max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo Số hợp đồng hoặc Tên bệnh nhân..."
            className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 dark:bg-slate-900 dark:border-slate-800 dark:text-white"
          />
        </div>

        {/* Type Filters */}
        <div className="flex items-center gap-2 overflow-x-auto">
          {[
            { value: 'all', label: 'Tất cả' },
            { value: 'treatment_plan', label: 'Phác đồ' },
            { value: 'warranty', label: 'Bảo hành' },
            { value: 'membership', label: 'Hội viên' },
            { value: 'spa_package', label: 'Gói dịch vụ' },
          ].map((tab) => (
            <button
              key={tab.value}
              onClick={() => setTypeFilter(tab.value)}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                typeFilter === tab.value
                  ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800 dark:hover:bg-slate-850'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table Wrapper */}
      <div className="rounded-[24px] bg-white dark:bg-slate-950 border border-slate-300/85 dark:border-slate-850 shadow-[0_6px_24px_-2px_rgba(15,23,42,0.08),0_2px_6px_-1px_rgba(15,23,42,0.04)] dark:shadow-[0_6px_24px_rgba(0,0,0,0.4)] hover:shadow-[0_16px_36px_-4px_rgba(20,184,166,0.12),0_4px_12px_-2px_rgba(20,184,166,0.06)] hover:-translate-y-0.5 transition-all duration-300 overflow-hidden">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="bg-slate-50/80 dark:bg-slate-900 border-b border-slate-150 dark:border-slate-800 text-slate-500 font-bold">
              <th className="p-4">Số Hợp Đồng</th>
              <th className="p-4">Bệnh nhân</th>
              <th className="p-4">Loại hợp đồng</th>
              <th className="p-4">Tổng giá trị</th>
              <th className="p-4">Thời hạn hiệu lực</th>
              <th className="p-4">Trạng thái</th>
              <th className="p-4 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium text-slate-700 dark:text-slate-300">
            {filtered.length > 0 ? (
              filtered.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50/40 dark:hover:bg-slate-900/30 transition-all">
                  <td className="p-4 font-mono font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <FileCheck className="w-3.5 h-3.5 text-teal-600" />
                    {c.contractNumber}
                  </td>
                  <td className="p-4 font-bold text-slate-900 dark:text-white">{c.patientName}</td>
                  <td className="p-4">{getTypeLabel(c.contractType)}</td>
                  <td className="p-4 font-bold text-slate-900 dark:text-white">
                    {c.totalValue.toLocaleString()} {c.currency}
                  </td>
                  <td className="p-4">
                    <span className="flex items-center gap-1.5 text-slate-500 font-mono">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      {c.startDate} → {c.endDate}
                    </span>
                  </td>
                  <td className="p-4">{getStatusBadge(c.status)}</td>
                  <td className="p-4 text-right">
                    <button className="text-teal-600 hover:text-teal-700 font-bold hover:underline inline-flex items-center gap-1">
                      Chi tiết <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="p-8 text-center text-slate-400">
                  Không tìm thấy hợp đồng nào
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-[24px] bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 text-left animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-teal-600" />
              Khởi tạo Hợp đồng / Kế hoạch mới
            </h3>

            <form onSubmit={handleRegisterContract} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-600 dark:text-slate-400">Bệnh nhân ký kết *</label>
                <PremiumSelect
                  options={patientOptions}
                  value={patientName}
                  onChange={setPatientName}
                  placeholder="Chọn bệnh nhân..."
                  buttonClassName="py-2.5 px-3 rounded-xl border border-slate-200 dark:bg-slate-900 dark:border-slate-800 dark:text-white focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-600 dark:text-slate-400">Loại kế hoạch điều trị *</label>
                <PremiumSelect
                  options={typeOptions}
                  value={contractType}
                  onChange={(val) => setContractType(val as any)}
                  placeholder="Loại hợp đồng..."
                  buttonClassName="py-2.5 px-3 rounded-xl border border-slate-200 dark:bg-slate-900 dark:border-slate-800 dark:text-white focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-bold text-slate-600 dark:text-slate-400">Số hợp đồng *</label>
                  <input
                    type="text"
                    required
                    value={contractNumber}
                    onChange={(e) => setContractNumber(e.target.value)}
                    placeholder="Ví dụ: HD-2026-001"
                    className="w-full p-2.5 rounded-xl border border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 dark:bg-slate-900 dark:border-slate-800 dark:text-white font-mono font-semibold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-600 dark:text-slate-400">Tổng giá trị (VND) *</label>
                  <input
                    type="number"
                    required
                    value={totalValue}
                    onChange={(e) => setTotalValue(e.target.value)}
                    placeholder="Nhập giá trị hợp đồng..."
                    className="w-full p-2.5 rounded-xl border border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 dark:bg-slate-900 dark:border-slate-800 dark:text-white font-bold text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-bold text-slate-600 dark:text-slate-400">Ngày bắt đầu *</label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 dark:bg-slate-900 dark:border-slate-800 dark:text-white font-medium"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-600 dark:text-slate-400">Ngày kết thúc *</label>
                  <input
                    type="date"
                    required
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 dark:bg-slate-900 dark:border-slate-800 dark:text-white font-medium"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-600 dark:text-slate-400">Trạng thái khởi tạo *</label>
                <PremiumSelect
                  options={statusOptions}
                  value={status}
                  onChange={(val) => setStatus(val as any)}
                  placeholder="Trạng thái..."
                  buttonClassName="py-2.5 px-3 rounded-xl border border-slate-200 dark:bg-slate-900 dark:border-slate-800 dark:text-white focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 font-bold rounded-xl transition-all"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl transition-all"
                >
                  Khởi tạo hợp đồng
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
