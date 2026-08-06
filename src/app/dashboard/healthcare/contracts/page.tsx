'use client';

import React, { useState } from 'react';
import { FileCheck, ShieldCheck, CheckCircle2, Building2, Plus, Download } from 'lucide-react';
import { toast } from 'sonner';

export default function ContractsPage() {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [contracts, setContracts] = useState([
    {
      id: 'c-1',
      name: 'BHXH Việt Nam (Cổng Giám định BHYT Quốc Gia)',
      code: 'BHYT-GOV-79',
      type: 'Bảo Hiểm Y Tế Nhà Nước',
      status: 'active',
      coverageRate: '80% - 100%',
      claimsThisMonth: 128
    },
    {
      id: 'c-2',
      name: 'Bảo Hiểm Bảo Việt (BaoViet Care)',
      code: 'INS-BV-2026',
      type: 'Bảo Hiểm Tư Nhân / Bảo Lãnh Trực Tiếp',
      status: 'active',
      coverageRate: '100% Nội/Ngoại Trù',
      claimsThisMonth: 34
    },
    {
      id: 'c-3',
      name: 'Bảo Hiểm Insmart Direct Billing',
      code: 'INS-INSMART-09',
      type: 'Bảo Hiểm Tư Nhân',
      status: 'active',
      coverageRate: 'Theo hạn mức thẻ',
      claimsThisMonth: 19
    }
  ]);

  const [newContract, setNewContract] = useState({
    name: '',
    code: `INS-PARTNER-${Math.floor(10 + Math.random() * 90)}`,
    type: 'Bảo Hiểm Tư Nhân / Bảo Lãnh Trực Tiếp',
    coverageRate: '100% Quyền lợi Thẻ',
  });

  const handleCreateContractSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContract.name.trim()) {
      toast.error('Vui lòng nhập tên đơn vị bảo hiểm!');
      return;
    }

    const created = {
      id: `c-${Date.now()}`,
      name: newContract.name.trim(),
      code: newContract.code.trim(),
      type: newContract.type,
      status: 'active',
      coverageRate: newContract.coverageRate,
      claimsThisMonth: 0
    };

    setContracts([created, ...contracts]);
    setIsAddModalOpen(false);
    toast.success(`🎉 Đã thêm hợp đồng bảo hiểm bảo lãnh ${created.name} (${created.code})!`);
    setNewContract({ name: '', code: `INS-PARTNER-${Math.floor(10 + Math.random() * 90)}`, type: 'Bảo Hiểm Tư Nhân / Bảo Lãnh Trực Tiếp', coverageRate: '100% Quyền lợi Thẻ' });
  };

  return (
    <div className="p-6 md:p-8 w-full space-y-7 bg-transparent relative">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1 text-left">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
              <FileCheck className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              Hợp Đồng Bảo Hiểm Y Tế & Bảo Lãnh Viện Phí
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Quản lý Đối soát Quyết toán Cổng BHYT Quốc gia & Hợp đồng Bảo lãnh Viện phí Bảo hiểm Tư nhân (Insmart, BaoViet, Prudential...).
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="px-4 py-2.5 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 shadow-md flex items-center gap-2 cursor-pointer active:scale-95 transition-all w-fit"
        >
          <Plus className="w-4 h-4" />
          Thêm Hợp Đồng Bảo Hiểm
        </button>
      </div>

      {/* Contracts List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {contracts.map((c) => (
          <div key={c.id} className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 hover:border-blue-500/50 transition-all shadow-sm">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-600 font-black text-xs">
                {c.code}
              </span>
              <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 font-bold text-[10px] flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Đang Hiệu Lực
              </span>
            </div>

            <div>
              <h3 className="font-black text-slate-900 dark:text-white text-base">{c.name}</h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">{c.type}</p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-bold">Mức Bảo Lãnh / Hưởng:</span>
                <span className="font-bold text-emerald-600">{c.coverageRate}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-bold">Hồ Sơ Quyết Toán Tháng Này:</span>
                <span className="font-black text-slate-900 dark:text-white">{c.claimsThisMonth} hồ sơ</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal Thêm Hợp Đồng Bảo Hiểm Mới */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-[28px] border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-lg p-6 space-y-5 animate-in fade-in zoom-in duration-200 text-left">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-blue-600" />
                Khởi Tạo Hợp Đồng Bảo Hiểm / Bảo Lãnh Mới
              </h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold p-1 cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleCreateContractSubmit} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Tên Đơn Vị / Công Ty Bảo Hiểm *</label>
                <input
                  type="text"
                  required
                  placeholder="Thí dụ: Prudential Vietnam, Dai-ichi Life..."
                  value={newContract.name}
                  onChange={(e) => setNewContract({ ...newContract, name: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-950 font-bold text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Mã Hợp Đồng</label>
                  <input
                    type="text"
                    value={newContract.code}
                    onChange={(e) => setNewContract({ ...newContract, code: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-950 font-mono text-blue-600 font-bold"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Phân Loại Hợp Đồng</label>
                  <select
                    value={newContract.type}
                    onChange={(e) => setNewContract({ ...newContract, type: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-950 font-bold"
                  >
                    <option value="Bảo Hiểm Y Tế Nhà Nước">Bảo Hiểm Y Tế Nhà Nước (BHYT)</option>
                    <option value="Bảo Hiểm Tư Nhân / Bảo Lãnh Trực Tiếp">Bảo Hiểm Tư Nhân / Direct Billing</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Quyền Lợi & Mức Chi Trả Bảo Lãnh</label>
                <input
                  type="text"
                  required
                  value={newContract.coverageRate}
                  onChange={(e) => setNewContract({ ...newContract, coverageRate: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-950 font-semibold text-emerald-600"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button type="button" onClick={() => setIsAddModalOpen(false)} className="px-4 py-2 rounded-xl text-xs font-bold border border-slate-200 text-slate-600 hover:bg-slate-100 cursor-pointer">
                  Hủy Bỏ
                </button>
                <button type="submit" className="px-5 py-2 rounded-xl text-xs font-black bg-blue-600 hover:bg-blue-700 text-white shadow-md cursor-pointer active:scale-95 transition-all">
                  + Thêm Hợp Đồng
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
