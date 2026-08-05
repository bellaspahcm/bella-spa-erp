'use client';

import React, { useState } from 'react';
import { FileText, Plus, Search, ArrowRight, Calendar, DollarSign, Shield, FileCheck, HelpCircle, Stethoscope } from 'lucide-react';
import { toast } from 'sonner';
import { PremiumSelect } from '@/components/ui/PremiumSelect';

interface ContractItem {
  name: string;
  quantity: string;
}

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
  readonly services?: ContractItem[];
}

export default function ContractsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);

  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [editingContract, setEditingContract] = useState<Contract | null>(null);

  // Add Service Modal state
  const [showAddServiceModal, setShowAddServiceModal] = useState(false);
  const [serviceSelectName, setServiceSelectName] = useState('Trám răng Composite cao cấp');
  const [customServiceName, setCustomServiceName] = useState('');
  const [serviceQuantity, setServiceQuantity] = useState('1 Răng');

  const commonContractServices = [
    { value: 'Trám răng Composite cao cấp', label: 'Trám răng Composite cao cấp' },
    { value: 'Cấy ghép trụ Implant Nobel Biocare', label: 'Cấy ghép trụ Implant Nobel Biocare' },
    { value: 'Bọc mão răng sứ Zirconia', label: 'Bọc mão răng sứ Zirconia chính hãng' },
    { value: 'Tẩy trắng răng Laser Whitening', label: 'Tẩy trắng răng Laser Whitening 2 hàm' },
    { value: 'Lấy cao răng & Đánh bóng', label: 'Lấy cao răng & Đánh bóng chuyên sâu' },
    { value: 'Nhổ răng khôn mọc lệch #38', label: 'Nhổ răng khôn mọc lệch #38' },
    { value: 'Gói bảo hành răng sứ / Implant 10 năm', label: 'Gói bảo hành răng sứ / Implant 10 năm' },
    { value: 'custom', label: '✍️ Nhập tên dịch vụ / điều khoản khác...' },
  ];

  // Edit form states
  const [editPatientName, setEditPatientName] = useState('');
  const [editContractType, setEditContractType] = useState<Contract['contractType']>('treatment_plan');
  const [editStatus, setEditStatus] = useState<Contract['status']>('draft');
  const [editContractNumber, setEditContractNumber] = useState('');
  const [editTotalValue, setEditTotalValue] = useState('');
  const [editStartDate, setEditStartDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');

  const handleOpenDetail = (contract: Contract) => {
    setSelectedContract(contract);
  };

  const handleOpenEditModal = (contract: Contract) => {
    setEditingContract(contract);
    setEditPatientName(contract.patientName);
    setEditContractType(contract.contractType);
    setEditStatus(contract.status);
    setEditContractNumber(contract.contractNumber);
    setEditTotalValue(String(contract.totalValue));
    setEditStartDate(contract.startDate);
    setEditEndDate(contract.endDate);
  };
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
      services: [
        { name: 'Trám răng Composite cao cấp (#36, #37)', quantity: '2 Răng' },
        { name: 'Cấy ghép trụ Implant Nobel Biocare', quantity: '1 Trụ' },
        { name: 'Gói bảo hành răng sứ / Implant 10 năm', quantity: 'Bảo hành 100%' },
      ],
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
      services: [
        { name: 'Thẻ Hội viên VIP Chăm sóc răng định kỳ', quantity: '1 Năm' },
        { name: 'Tẩy trắng răng Laser Whitening', quantity: '2 Lần' },
      ],
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

  const handleSaveEditContract = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingContract) return;

    if (!editContractNumber.trim() || !editTotalValue || !editStartDate || !editEndDate) {
      toast.error('Vui lòng nhập đầy đủ thông tin hợp đồng');
      return;
    }

    const updated: Contract = {
      ...editingContract,
      contractNumber: editContractNumber,
      patientName: editPatientName,
      contractType: editContractType,
      status: editStatus,
      totalValue: Number(editTotalValue),
      startDate: editStartDate,
      endDate: editEndDate,
    };

    setContracts((prev) => prev.map((c) => (c.id === editingContract.id ? updated : c)));
    if (selectedContract?.id === editingContract.id) {
      setSelectedContract(updated);
    }
    setEditingContract(null);
    toast.success(`🎉 Đã cập nhật thành công hợp đồng ${editContractNumber}`);
  };

  const handleConfirmAddService = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContract) return;

    const finalName = serviceSelectName === 'custom' ? customServiceName.trim() : serviceSelectName;
    if (!finalName) {
      toast.error('Vui lòng chọn hoặc nhập tên dịch vụ');
      return;
    }
    if (!serviceQuantity.trim()) {
      toast.error('Vui lòng nhập số lượng hoặc phạm vi cam kết');
      return;
    }

    const newService = { name: finalName, quantity: serviceQuantity.trim() };
    const currentServices = selectedContract.services || [];
    const updatedServices = [...currentServices, newService];
    const updatedContract = { ...selectedContract, services: updatedServices };

    setSelectedContract(updatedContract);
    setContracts((prev) => prev.map((c) => (c.id === selectedContract.id ? updatedContract : c)));
    toast.success('🎉 Đã thêm dịch vụ vào phạm vi hợp đồng');
    setShowAddServiceModal(false);
  };

  const handlePrintContract = () => {
    toast.success('🖨️ Đang mở cửa sổ in Hợp đồng cam kết y tế...');
    setTimeout(() => {
      window.print();
    }, 200);
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
        <div className="flex items-center gap-2 overflow-x-auto md:overflow-visible py-2 px-1 shrink-0 scrollbar-none">
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
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg border transition-all whitespace-nowrap ${
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
                    <button
                      onClick={() => handleOpenDetail(c)}
                      className="px-3.5 py-1.5 rounded-xl bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400 border border-teal-200/80 dark:border-teal-800/50 hover:bg-teal-600 hover:text-white dark:hover:bg-teal-600 dark:hover:text-white hover:border-teal-600 font-extrabold text-xs shadow-sm hover:shadow-teal-500/20 active:scale-95 transition-all duration-200 inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>Chi tiết</span>
                      <ArrowRight className="w-3.5 h-3.5" />
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

      {/* Contract Detail Modal */}
      {selectedContract && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-2xl rounded-[28px] bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 md:p-8 space-y-6 text-left relative max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300 flex items-center justify-center font-black">
                  <FileCheck className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
                      Hợp đồng {selectedContract.contractNumber}
                    </h2>
                    {getStatusBadge(selectedContract.status)}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Loại: <span className="font-semibold text-slate-700 dark:text-slate-300">{getTypeLabel(selectedContract.contractType)}</span>
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedContract(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-850 dark:hover:bg-slate-800 flex items-center justify-center text-slate-500 font-bold transition-all"
              >
                ✕
              </button>
            </div>

            {/* Main Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 space-y-2">
                <p className="text-[10px] font-black text-slate-400 uppercase">Bệnh nhân ký kết</p>
                <p className="text-sm font-extrabold text-slate-900 dark:text-white">{selectedContract.patientName}</p>
                <p className="text-[11px] text-slate-500 font-mono">Mã số BN: PAT-2026-88</p>
              </div>

              <div className="p-4 rounded-2xl bg-teal-50/60 dark:bg-teal-950/20 border border-teal-100 dark:border-teal-900/30 space-y-2">
                <p className="text-[10px] font-black text-teal-700 dark:text-teal-400 uppercase">Tổng giá trị Hợp đồng</p>
                <p className="text-xl font-black text-teal-700 dark:text-teal-300">
                  {selectedContract.totalValue.toLocaleString()} {selectedContract.currency}
                </p>
                <p className="text-[11px] text-teal-600/80 font-semibold">Đã thanh toán đợt 1: 50% (Cam kết bảo hành)</p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 space-y-2">
                <p className="text-[10px] font-black text-slate-400 uppercase">Thời hạn hiệu lực</p>
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-teal-600" />
                  {selectedContract.startDate} đến {selectedContract.endDate}
                </p>
                <p className="text-[11px] text-slate-500">Thời hạn cam kết: 6 tháng (Có điều khoản gia hạn)</p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 space-y-2">
                <p className="text-[10px] font-black text-slate-400 uppercase">Đơn vị quản lý</p>
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Chi nhánh Bella Medical Clinic - Q1</p>
                <p className="text-[11px] text-slate-500">Bác sĩ phụ trách: BS. Lê Minh</p>
              </div>
            </div>

            {/* Scope & Included Services */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                  Phạm vi dịch vụ & Cam kết y tế
                </h3>
                <button
                  onClick={() => {
                    setServiceSelectName('Trám răng Composite cao cấp');
                    setCustomServiceName('');
                    setServiceQuantity('1 Răng');
                    setShowAddServiceModal(true);
                  }}
                  className="flex items-center gap-1 px-3 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-300 font-extrabold text-xs rounded-xl transition-all cursor-pointer"
                >
                  + Thêm dịch vụ
                </button>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 space-y-2 text-xs">
                {selectedContract.services && selectedContract.services.length > 0 ? (
                  selectedContract.services.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800 last:border-0"
                    >
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {idx + 1}. {item.name}
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">{item.quantity}</span>
                        <button
                          onClick={() => {
                            const updatedServices = selectedContract.services?.filter((_, i) => i !== idx);
                            const updatedContract = { ...selectedContract, services: updatedServices };
                            setSelectedContract(updatedContract);
                            setContracts((prev) => prev.map((c) => (c.id === selectedContract.id ? updatedContract : c)));
                            toast.info(`Đã xóa "${item.name}" khỏi phạm vi dịch vụ`);
                          }}
                          className="text-slate-400 hover:text-rose-600 transition-colors"
                          title="Xóa dịch vụ này"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-400 italic">Chưa có dịch vụ nào trong phạm vi hợp đồng. Nhấp nút "+ Thêm dịch vụ" ở trên để bổ sung.</p>
                )}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={handlePrintContract}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-850 dark:hover:bg-slate-800 font-bold text-xs text-slate-700 dark:text-slate-300 rounded-xl transition-all cursor-pointer"
              >
                🖨️ In hợp đồng
              </button>
              <button
                onClick={() => handleOpenEditModal(selectedContract)}
                className="px-4 py-2.5 bg-teal-50 text-teal-600 hover:bg-teal-100 dark:bg-teal-950/40 dark:text-teal-400 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                ✏️ Sửa hợp đồng
              </button>
              <button
                onClick={() => setSelectedContract(null)}
                className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-all active:scale-95"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* Edit Modal */}
      {editingContract && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-[24px] bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 text-left animate-in zoom-in-95 duration-150">
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <FileCheck className="w-5 h-5 text-teal-600" />
              Chỉnh sửa Hợp đồng {editingContract.contractNumber}
            </h3>

            <form onSubmit={handleSaveEditContract} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-600 dark:text-slate-400">Bệnh nhân ký kết *</label>
                <PremiumSelect
                  options={patientOptions}
                  value={editPatientName}
                  onChange={setEditPatientName}
                  placeholder="Chọn bệnh nhân..."
                  buttonClassName="py-2.5 px-3 rounded-xl border border-slate-200 dark:bg-slate-900 dark:border-slate-800 dark:text-white focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-600 dark:text-slate-400">Loại phác đồ / Hợp đồng *</label>
                <PremiumSelect
                  options={typeOptions}
                  value={editContractType}
                  onChange={(val) => setEditContractType(val as any)}
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
                    value={editContractNumber}
                    onChange={(e) => setEditContractNumber(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 dark:bg-slate-900 dark:border-slate-800 dark:text-white font-mono font-semibold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-600 dark:text-slate-400">Tổng giá trị (VND) *</label>
                  <input
                    type="number"
                    required
                    value={editTotalValue}
                    onChange={(e) => setEditTotalValue(e.target.value)}
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
                    value={editStartDate}
                    onChange={(e) => setEditStartDate(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 dark:bg-slate-900 dark:border-slate-800 dark:text-white font-medium"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-600 dark:text-slate-400">Ngày kết thúc *</label>
                  <input
                    type="date"
                    required
                    value={editEndDate}
                    onChange={(e) => setEditEndDate(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 dark:bg-slate-900 dark:border-slate-800 dark:text-white font-medium"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-600 dark:text-slate-400">Trạng thái hợp đồng *</label>
                <PremiumSelect
                  options={statusOptions}
                  value={editStatus}
                  onChange={(val) => setEditStatus(val as any)}
                  placeholder="Trạng thái..."
                  buttonClassName="py-2.5 px-3 rounded-xl border border-slate-200 dark:bg-slate-900 dark:border-slate-800 dark:text-white focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingContract(null)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 font-bold rounded-xl transition-all"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl shadow-md transition-all active:scale-95"
                >
                  Lưu thay đổi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Service Modal */}
      {showAddServiceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-[28px] bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 md:p-8 text-left space-y-6 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 flex items-center justify-center font-black">
                  <Stethoscope className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                    Bổ sung Dịch vụ & Cam kết y tế
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Thêm dịch vụ hoặc phác đồ điều trị vào hợp đồng
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAddServiceModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-850 dark:hover:bg-slate-800 flex items-center justify-center text-slate-500 font-bold transition-all"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmAddService} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-600 dark:text-slate-400">Chọn dịch vụ y tế / điều khoản *</label>
                <PremiumSelect
                  options={commonContractServices}
                  value={serviceSelectName}
                  onChange={setServiceSelectName}
                  placeholder="Chọn dịch vụ..."
                  buttonClassName="py-2.5 px-3 rounded-xl border border-slate-200 dark:bg-slate-900 dark:border-slate-800 dark:text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              {serviceSelectName === 'custom' && (
                <div className="space-y-1 animate-in fade-in duration-150">
                  <label className="font-bold text-slate-600 dark:text-slate-400">Nhập tên dịch vụ tùy chỉnh *</label>
                  <input
                    type="text"
                    required
                    value={customServiceName}
                    onChange={(e) => setCustomServiceName(e.target.value)}
                    placeholder="VD: Bọc mão răng sứ Zirconia chính hãng..."
                    className="w-full p-2.5 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:bg-slate-900 dark:border-slate-800 dark:text-white font-medium"
                  />
                </div>
              )}

              <div className="space-y-1">
                <label className="font-bold text-slate-600 dark:text-slate-400">Số lượng / Phạm vi cam kết *</label>
                <input
                  type="text"
                  required
                  value={serviceQuantity}
                  onChange={(e) => setServiceQuantity(e.target.value)}
                  placeholder="VD: 2 Răng, 1 Trụ, Bảo hành 10 năm..."
                  className="w-full p-2.5 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:bg-slate-900 dark:border-slate-800 dark:text-white font-semibold text-emerald-700 dark:text-emerald-400"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddServiceModal(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 font-bold rounded-xl transition-all"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-all active:scale-95"
                >
                  + Thêm vào Hợp đồng
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Print CSS Rules */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #printable-contract-document,
          #printable-contract-document * {
            visibility: visible !important;
          }
          #printable-contract-document {
            display: block !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 24px !important;
            background: white !important;
            color: black !important;
            box-shadow: none !important;
            border: none !important;
          }
        }
      `}</style>

      {/* Printable Medical Contract Document Layout (Only visible when printing) */}
      <div id="printable-contract-document" className="hidden print:block font-serif text-black p-8 max-w-4xl mx-auto bg-white text-xs leading-relaxed">
        {/* Print Header */}
        <div className="text-center space-y-1 border-b-2 border-black pb-4 mb-6">
          <p className="font-bold text-xs uppercase tracking-wider">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
          <p className="font-semibold text-xs italic">Độc lập - Tự do - Hạnh phúc</p>
          <div className="w-24 h-0.5 bg-black mx-auto my-2" />
          <h1 className="text-lg font-bold text-black uppercase mt-4">
            HỢP ĐỒNG KHÁM BỆNH, ĐIỀU TRỊ & CAM KẾT BẢO HÀNH Y TẾ
          </h1>
          <p className="text-xs font-mono">
            Số hợp đồng: <strong>{selectedContract?.contractNumber || 'HD-2026-001'}</strong> | Ngày khởi tạo: {new Date().toLocaleDateString('vi-VN')}
          </p>
        </div>

        {/* Parties */}
        <div className="space-y-4 mb-6">
          <div>
            <p className="font-bold uppercase text-xs">BÊN A (CƠ SỞ Y TẾ / PHÒNG KHÁM):</p>
            <p className="font-semibold">HỆ THỐNG PHÒNG KHÁM BELLA MEDICAL CLINIC</p>
            <p>Địa chỉ: Chi nhánh Bella Medical - Q1, TP. Hồ Chí Minh</p>
            <p>Hotline hỗ trợ & Bảo hành: 1900-BELLA-ERP | Bác sĩ phụ trách: BS. Lê Minh</p>
          </div>

          <div>
            <p className="font-bold uppercase text-xs">BÊN B (BỆNH NHÂN KÝ KẾT):</p>
            <p className="font-semibold">Họ và tên: {selectedContract?.patientName || 'Nguyễn Văn Hùng'}</p>
            <p>Mã bệnh nhân: PAT-2026-88</p>
          </div>
        </div>

        {/* Scope of Treatment Table */}
        <div className="space-y-2 mb-6">
          <p className="font-bold uppercase text-xs">ĐIỀU I: PHẠM VI DỊCH VỤ & CAM KẾT ĐIỀU TRỊ Y TẾ</p>
          <table className="w-full border-collapse border border-black text-left text-xs">
            <thead>
              <tr className="bg-gray-100 border-b border-black">
                <th className="border border-black p-2 w-12 text-center">STT</th>
                <th className="border border-black p-2">Tên Dịch Vụ / Phác Đồ Điều Trị</th>
                <th className="border border-black p-2 w-36 text-center">Số Lượng / Cam Kết</th>
              </tr>
            </thead>
            <tbody>
              {selectedContract?.services && selectedContract.services.length > 0 ? (
                selectedContract.services.map((item, idx) => (
                  <tr key={idx} className="border-b border-black">
                    <td className="border border-black p-2 text-center">{idx + 1}</td>
                    <td className="border border-black p-2 font-semibold">{item.name}</td>
                    <td className="border border-black p-2 text-center font-bold">{item.quantity}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="border border-black p-4 text-center italic">Phạm vi điều trị theo chỉ định trực tiếp của Bác sĩ</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Financial & Validity */}
        <div className="space-y-2 mb-6">
          <p className="font-bold uppercase text-xs">ĐIỀU II: GIÁ TRỊ HỢP ĐỒNG & THỜI HẠN HIỆU LỰC</p>
          <p>1. Tổng chi phí hợp đồng cam kết: <strong>{selectedContract?.totalValue.toLocaleString() || '35.000.000'} VND</strong></p>
          <p>2. Thời hạn cam kết bảo hành & hiệu lực: từ ngày <strong>{selectedContract?.startDate || '2026-06-01'}</strong> đến ngày <strong>{selectedContract?.endDate || '2026-12-01'}</strong>.</p>
        </div>

        {/* Commitment Terms */}
        <div className="space-y-2 mb-8">
          <p className="font-bold uppercase text-xs">ĐIỀU III: ĐIỀU KHOẢN CAM KẾT & QUYỀN LỢI BỆNH NHÂN</p>
          <p>- Bên A cam kết thực hiện đúng quy trình chuẩn Y khoa và bảo hành dịch vụ theo phạm vi hợp đồng.</p>
          <p>- Bên B cam kết tuân thủ dặn dò của Bác sĩ phụ trách và tái khám đúng hẹn.</p>
        </div>

        {/* Signatures */}
        <div className="grid grid-cols-2 text-center gap-8 pt-6">
          <div>
            <p className="font-bold uppercase text-xs">ĐẠI DIỆN BÊN B (BỆNH NHÂN)</p>
            <p className="text-[10px] italic text-gray-500 mb-16">(Ký và ghi rõ họ tên)</p>
            <p className="font-bold">{selectedContract?.patientName}</p>
          </div>
          <div>
            <p className="font-bold uppercase text-xs">ĐẠI DIỆN BÊN A (PHÒNG KHÁM BELLA)</p>
            <p className="text-[10px] italic text-gray-500 mb-16">(Ký tên & Đóng dấu y tế)</p>
            <p className="font-bold">BS. Lê Minh</p>
          </div>
        </div>
      </div>
    </div>
  );
}
