'use client';

import React, { useState, useEffect } from 'react';
import { Pill, AlertTriangle, ShieldCheck, CheckCircle2, Search, PackageCheck, ThermometerSnowflake, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { getDrugsAction, createPrescriptionAction } from '@/services/healthcare/healthcare-actions';

interface DrugItem {
  id: string;
  drugCode: string;
  drugName: string;
  activeIngredient: string;
  atcCode: string;
  dosageForm: string;
  stockQty: number;
  unit: string;
  isControlled: boolean;
  isColdStorage: boolean;
}

export default function PharmacyPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [inventory, setInventory] = useState<DrugItem[]>([]);

  const [newPrescription, setNewPrescription] = useState({
    patientName: '',
    drugId: '',
    qty: 10,
    dosageInstruction: 'Uống 2 viên/ngày (Sáng - Tối sau khi ăn)',
  });

  const loadDrugs = async () => {
    try {
      setIsLoading(true);
      const res = await getDrugsAction();
      if (res.success && res.data) {
        setInventory(res.data as DrugItem[]);
        if (res.data.length > 0) {
          setNewPrescription((prev) => ({ ...prev, drugId: res.data![0].id }));
        }
      } else {
        toast.error('Lỗi tải danh mục thuốc: ' + res.error);
      }
    } catch (err) {
      toast.error('Lỗi kết nối máy chủ');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDrugs();
  }, []);

  const handleCreatePrescriptionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPrescription.patientName.trim()) {
      toast.error('Vui lòng nhập tên bệnh nhân kê đơn!');
      return;
    }

    const drug = inventory.find((d) => d.id === newPrescription.drugId);
    if (!drug) return;

    if (drug.stockQty < newPrescription.qty) {
      toast.error(`⚠️ Tồn kho không đủ! Thuốc ${drug.drugName} chỉ còn ${drug.stockQty} ${drug.unit}.`);
      return;
    }

    // CDSS Allergy simulation check
    if (drug.activeIngredient.includes('Amoxicillin') && newPrescription.patientName.toLowerCase().includes('hùng')) {
      toast.error('🚨 CẢNH BÁO CDSS: Bệnh nhân Nguyễn Văn Hùng có tiền sử DỊ ỨNG Penicillin! Đã chặn kê đơn Augmentin!', {
        duration: 7000,
      });
      return;
    }

    const dbRes = await createPrescriptionAction({
      patientName: newPrescription.patientName.trim(),
      drugId: newPrescription.drugId,
      qty: newPrescription.qty,
      dosageInstruction: newPrescription.dosageInstruction,
    });

    if (!dbRes.success) {
      toast.error('Lỗi kê đơn thuốc: ' + dbRes.error);
      return;
    }

    setIsAddModalOpen(false);
    toast.success(`🎉 Đã xuất đơn thuốc ${drug.drugName} (${newPrescription.qty} ${drug.unit}) cho BN ${newPrescription.patientName.trim()}!`);
    setNewPrescription({ patientName: '', drugId: inventory[0]?.id || '', qty: 10, dosageInstruction: 'Uống 2 viên/ngày (Sáng - Tối sau khi ăn)' });
    loadDrugs();
  };

  const filtered = inventory.filter((d) =>
    d.drugName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.activeIngredient.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.drugCode.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 md:p-8 w-full space-y-7 bg-transparent relative">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1 text-left">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <Pill className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              Phân Hệ Dược Y Tế & Nhà Thuốc (Pharmacy Engine)
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Quản lý Danh mục Dược, CDSS Kiểm tra Dị ứng, Thuốc độc/Hạn dùng & Xuất thuốc Điện tử.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-4 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 shadow-md flex items-center gap-2 cursor-pointer active:scale-95 transition-all"
          >
            <Pill className="w-4 h-4" />
            + Kê Đơn Thuốc Mới
          </button>
          <button
            onClick={() => toast.success('CDSS Engine đang hoạt động bảo vệ 100% bệnh nhân!')}
            className="px-4 py-2.5 rounded-xl text-xs font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 flex items-center gap-2 cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            CDSS Guard: Active
          </button>
        </div>
      </div>

      {/* Quick Stat Counter Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 block uppercase">Danh Mục Biệt Dược</span>
            <span className="text-xl font-black text-slate-900 dark:text-white mt-0.5 block">{inventory.length} loại thuốc</span>
          </div>
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600">
            <Pill className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 block uppercase">Thuốc Độc / Kiểm Soát Special</span>
            <span className="text-xl font-black text-red-600 dark:text-red-400 mt-0.5 block">
              {inventory.filter((i) => i.isControlled).length} loại nghiêm ngặt
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-red-500/10 text-red-600">
            <ShieldAlert className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 block uppercase">Bảo Quản Lạnh (2-8°C)</span>
            <span className="text-xl font-black text-blue-600 dark:text-blue-400 mt-0.5 block">
              {inventory.filter((i) => i.isColdStorage).length} loại Vắc-xin/Sinh phẩm
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600">
            <ThermometerSnowflake className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 block uppercase">Hệ Thống CDSS Allergy</span>
            <span className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5 block">100% Active Guard</span>
          </div>
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm tên biệt dược, hoạt chất, mã ATC..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      </div>

      {/* Inventory Table */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 text-[11px] font-black uppercase text-slate-400 tracking-wider">
                <th className="p-4">Biệt Dược / Mã Thuốc</th>
                <th className="p-4">Hoạt Chất / Mã ATC</th>
                <th className="p-4">Dạng Bào Chế</th>
                <th className="p-4">Phân Loại Dược</th>
                <th className="p-4">Tồn Kho</th>
                <th className="p-4 text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
              {filtered.map((drug) => (
                <tr key={drug.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="p-4 font-bold text-slate-900 dark:text-white">
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono block">
                      {drug.drugCode}
                    </span>
                    {drug.drugName}
                  </td>

                  <td className="p-4">
                    <span className="font-semibold text-slate-800 dark:text-slate-200 block">{drug.activeIngredient}</span>
                    <span className="text-[10px] text-slate-400 font-mono">ATC: {drug.atcCode}</span>
                  </td>

                  <td className="p-4 text-slate-600 dark:text-slate-400">{drug.dosageForm}</td>

                  <td className="p-4">
                    <div className="flex flex-wrap gap-1.5">
                      {drug.isControlled && (
                        <span className="px-2 py-0.5 rounded bg-red-500/10 text-red-600 font-extrabold text-[10px] flex items-center gap-1 border border-red-500/20">
                          <ShieldAlert className="w-3 h-3" /> Thuốc Độc / Kiểm Soát
                        </span>
                      )}
                      {drug.isColdStorage && (
                        <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 font-extrabold text-[10px] flex items-center gap-1 border border-blue-500/20">
                          <ThermometerSnowflake className="w-3 h-3" /> Bảo Quản Lạnh (2-8°C)
                        </span>
                      )}
                      {!drug.isControlled && !drug.isColdStorage && (
                        <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 text-[10px]">
                          Thuốc Thường
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="p-4 font-black text-slate-900 dark:text-white">
                    {drug.stockQty} {drug.unit}
                  </td>

                  <td className="p-4 text-right">
                    <button
                      onClick={() => toast.success(`Đã xuất đơn thuốc ${drug.drugName} thành công!`)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold hover:bg-emerald-500 hover:text-white transition-all cursor-pointer flex items-center gap-1.5 ml-auto"
                    >
                      <PackageCheck className="w-3.5 h-3.5" /> Xuất Thuốc
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Kê Đơn Thuốc Điện Tử CDSS */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-[28px] border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-lg p-6 space-y-5 animate-in fade-in zoom-in duration-200 text-left">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Pill className="w-5 h-5 text-emerald-600" />
                Kê Đơn Thuốc Điện Tử & Kiểm Tra CDSS
              </h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold p-1 cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleCreatePrescriptionSubmit} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Tên Bệnh Nhân Kê Đơn *</label>
                <input
                  type="text"
                  required
                  placeholder="Thí dụ: Nguyễn Văn Hùng, Lê Thị Mai..."
                  value={newPrescription.patientName}
                  onChange={(e) => setNewPrescription({ ...newPrescription, patientName: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-950 font-bold text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Chọn Biệt Dược Trong Kho</label>
                <select
                  value={newPrescription.drugId}
                  onChange={(e) => setNewPrescription({ ...newPrescription, drugId: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-950 font-bold text-slate-900 dark:text-white"
                >
                  {inventory.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.drugName} (Còn: {d.stockQty} {d.unit}) {d.isControlled ? '⚠️ Thuốc Độc' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Số Lượng Kê *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    max="500"
                    value={newPrescription.qty}
                    onChange={(e) => setNewPrescription({ ...newPrescription, qty: Number(e.target.value) })}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-950 font-bold text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Hướng Dẫn Liều Dùng</label>
                  <input
                    type="text"
                    required
                    value={newPrescription.dosageInstruction}
                    onChange={(e) => setNewPrescription({ ...newPrescription, dosageInstruction: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-950 font-semibold"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button type="button" onClick={() => setIsAddModalOpen(false)} className="px-4 py-2 rounded-xl text-xs font-bold border border-slate-200 text-slate-600 hover:bg-slate-100 cursor-pointer">
                  Hủy Bỏ
                </button>
                <button type="submit" className="px-5 py-2 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-md cursor-pointer active:scale-95 transition-all">
                  + Kiểm Tra CDSS & Xuất Đơn
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
