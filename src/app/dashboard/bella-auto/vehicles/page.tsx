'use client';

import React, { useState, useTransition, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Car,
  Search,
  PlusCircle,
  Download,
  Upload,
  ChevronDown,
  AlertCircle,
  X,
  CheckCircle2,
  ArrowRight,
  Info,
  Fuel,
  Cog,
  MapPin,
  Calendar,
} from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase-client';
import { AutoInventoryProvider, type VehicleInventoryItem } from '@/modules/bella-auto/services/AutoInventoryProvider';
import { VehicleStatusMachineService, type VehicleStatus } from '@/modules/bella-auto/services/VehicleStatusMachineService';
import { useEffect } from 'react';

// Status configuration
const STATUS_CONFIG: Record<VehicleStatus, { label: string; bg: string; color: string; border: string }> = {
  in_transit: { label: 'Đang Vận Chuyển', bg: 'bg-amber-50', color: 'text-amber-700', border: 'border-amber-200' },
  arrived: { label: 'Đã Về Kho', bg: 'bg-blue-50', color: 'text-blue-700', border: 'border-blue-200' },
  allocated: { label: 'Đã Phân Bổ', bg: 'bg-purple-50', color: 'text-purple-700', border: 'border-purple-200' },
  delivered: { label: 'Đã Giao Xe', bg: 'bg-green-50', color: 'text-green-700', border: 'border-green-200' },
  sold: { label: 'Đã Bán', bg: 'bg-emerald-50', color: 'text-emerald-700', border: 'border-emerald-200' },
};

// ── Add Vehicle Modal ─────────────────────────────────────────────────────────
function AddVehicleModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({
    vin: '', colorExterior: '', modelYear: new Date().getFullYear().toString(),
    listPrice: '', chassisNumber: '', engineNumber: '', locationNote: '',
    expectedArrivalDate: '',
  });
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (form.vin.length !== 17) { toast.error('Số VIN phải đúng 17 ký tự'); return; }
    if (!form.colorExterior) { toast.error('Vui lòng nhập màu ngoại thất'); return; }

      startTransition(async () => {
        try {
          const supabase = createClient();
          await new Promise(r => setTimeout(r, 900)); // Demo delay
          toast.success(`Đã thêm xe VIN ${form.vin} vào kho thành công!`);
          onSuccess();
          onClose();
        } catch (error) {
          console.error('Failed to add vehicle:', error);
          toast.error('Không thể thêm xe');
        }
      });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200/60 dark:border-slate-800 w-full max-w-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white">Nhập Xe Mới Vào Kho</h2>
            <p className="text-xs text-slate-400 font-semibold mt-0.5">Trạng thái khởi đầu: Đang Vận Chuyển (In Transit)</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center hover:bg-slate-200 transition-colors">
            <X className="w-4 h-4 text-slate-600" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-2">Số VIN (17 ký tự) *</label>
              <input
                maxLength={17}
                value={form.vin}
                onChange={e => setForm(f => ({ ...f, vin: e.target.value.toUpperCase() }))}
                placeholder="WBAHF3C01L7D34567"
                className={`w-full px-4 py-3 rounded-xl border outline-none font-mono font-bold text-sm tracking-widest transition-all ${form.vin.length === 17 ? 'border-emerald-400 bg-emerald-50/30' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950'}`}
              />
              <span className={`text-xs mt-1 block font-semibold ${form.vin.length === 17 ? 'text-emerald-500' : 'text-slate-400'}`}>{form.vin.length}/17 ký tự</span>
            </div>
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-2">Màu Ngoại Thất *</label>
              <input value={form.colorExterior} onChange={e => setForm(f => ({ ...f, colorExterior: e.target.value }))} placeholder="Alpine White" className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 outline-none text-sm font-semibold" />
            </div>
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-2">Năm Sản Xuất *</label>
              <input type="number" value={form.modelYear} onChange={e => setForm(f => ({ ...f, modelYear: e.target.value }))} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 outline-none text-sm font-semibold" />
            </div>
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-2">Giá Niêm Yết (VND) *</label>
              <input type="number" value={form.listPrice} onChange={e => setForm(f => ({ ...f, listPrice: e.target.value }))} placeholder="2439000000" className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 outline-none text-sm font-semibold" />
            </div>
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-2">Số Khung</label>
              <input value={form.chassisNumber} onChange={e => setForm(f => ({ ...f, chassisNumber: e.target.value }))} placeholder="KHG7834" className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 outline-none text-sm font-semibold" />
            </div>
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-2">Số Máy</label>
              <input value={form.engineNumber} onChange={e => setForm(f => ({ ...f, engineNumber: e.target.value }))} placeholder="B48A20T0-1234" className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 outline-none text-sm font-semibold" />
            </div>
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-2">Vị Trí Kho / Showroom</label>
              <input value={form.locationNote} onChange={e => setForm(f => ({ ...f, locationNote: e.target.value }))} placeholder="Cảng Cát Lái" className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 outline-none text-sm font-semibold" />
            </div>
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-2">Ngày Dự Kiến Về</label>
              <input type="date" value={form.expectedArrivalDate} onChange={e => setForm(f => ({ ...f, expectedArrivalDate: e.target.value }))} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 outline-none text-sm font-semibold" />
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold text-sm hover:bg-slate-50 transition-colors">Hủy</button>
            <button type="submit" disabled={isPending} className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-bold text-sm transition-colors flex items-center justify-center gap-2">
              {isPending ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <PlusCircle className="w-4 h-4" />}
              {isPending ? 'Đang thêm...' : 'Thêm vào kho'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ── Status Transition Popover ─────────────────────────────────────────────────
function StatusChip({ 
  vehicle, 
  onTransitioned, 
  isOpen, 
  onToggle 
}: { 
  vehicle: VehicleInventoryItem; 
  onTransitioned: () => void;
  isOpen: boolean;
  onToggle: (vehicleId: string) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const cfg = STATUS_CONFIG[vehicle.status];
  const allowed = VehicleStatusMachineService.allowedTransitions(vehicle.status);

  const handleTransition = (toStatus: VehicleStatus) => {
    onToggle('');
    startTransition(async () => {
      await new Promise(r => setTimeout(r, 600));
      toast.success(`Đã chuyển xe ${vehicle.vin.slice(-6)} → ${STATUS_CONFIG[toStatus].label}`);
      onTransitioned();
    });
  };

  // Tính vị trí dropdown ngay tại thời điểm click (getBoundingClientRect đã là viewport coords)
  const handleToggle = () => {
    if (!allowed.length) return;
    onToggle(vehicle.id);
  };

  // Close dropdown when clicking outside
  React.useEffect(() => {
    if (!isOpen) return;
    
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(`[data-dropdown-id="${vehicle.id}"]`)) {
        onToggle('');
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, vehicle.id, onToggle]);

  return (
    <div className="relative" data-dropdown-id={vehicle.id}>
      <button
        ref={buttonRef}
        onClick={handleToggle}
        disabled={isPending || allowed.length === 0}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${cfg.bg} ${cfg.color} ${cfg.border} ${allowed.length > 0 ? 'hover:brightness-95 cursor-pointer' : 'cursor-default'}`}
      >
        {isPending
          ? <span className="w-3 h-3 border border-current/40 border-t-current rounded-full animate-spin" />
          : <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
        }
        {cfg.label}
        {allowed.length > 0 && !isPending && <ChevronDown className="w-3 h-3 opacity-60" />}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.96 }}
            transition={{ duration: 0.12 }}
            className="absolute z-50 top-full mt-1 left-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl p-2 min-w-44"
          >
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 px-2 pb-1.5">Chuyển sang</p>
            {allowed.map(s => (
              <button
                key={s}
                onClick={() => handleTransition(s)}
                className="w-full flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-left transition-colors"
              >
                <ArrowRight className="w-3 h-3 text-slate-400" />
                <span className={`text-xs font-bold ${STATUS_CONFIG[s].color}`}>{STATUS_CONFIG[s].label}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function VehicleInventoryPage() {
  const [vehicles, setVehicles] = useState<VehicleInventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<VehicleStatus | 'all'>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleInventoryItem | null>(null);
  const [openDropdownId, setOpenDropdownId] = useState<string>('');

  // Fetch vehicles from Supabase
  useEffect(() => {
    const fetchVehicles = async () => {
      try {
        setIsLoading(true);
        const supabase = createClient();
        
        if (!supabase) {
          console.error('Supabase client not initialized');
          setIsLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from('auto_vehicles')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Failed to fetch vehicles:', error);
          toast.error('Không thể tải danh sách xe');
          setVehicles([]);
        } else {
          setVehicles(data || []);
        }
      } catch (error) {
        console.error('Failed to fetch vehicles:', error);
        toast.error('Không thể tải danh sách xe');
        setVehicles([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchVehicles();
  }, []);

  // Handle dropdown toggle - close others when opening one
  const handleDropdownToggle = useCallback((vehicleId: string) => {
    setOpenDropdownId(prev => prev === vehicleId ? '' : vehicleId);
  }, []);

  // Import CSV handler
  const handleImportCSV = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,.xlsx';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      await new Promise(r => setTimeout(r, 1200));
      toast.success(`Đã nhập ${file.name} — Đang xử lý hàng loạt VIN...`);
    };
    input.click();
  }, []);

  const handleExportCSV = () => {
    const headers = ['VIN', 'Thương Hiệu', 'Dòng Xe', 'Phiên Bản', 'Năm', 'Màu Ngoại Thất', 'Trạng Thái', 'Giá Niêm Yết', 'Vị Trí'];
    const rows = filtered.map(v => [v.vin, v.brandName, v.modelName, v.variantName, v.modelYear, v.colorExterior, STATUS_CONFIG[v.status].label, v.listPrice, v.locationNote ?? '']);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `bella-auto-inventory-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success('Đã xuất danh sách kho xe!');
  };

  const filtered = vehicles.filter(v => {
    const matchSearch = !search || v.vin.includes(search.toUpperCase()) || (v.modelName ?? '').toLowerCase().includes(search.toLowerCase()) || (v.variantName ?? '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || v.status === statusFilter;
    return matchSearch && matchStatus;
  });

  // Summary counts
  const counts = vehicles.reduce((acc, v) => {
    acc[v.status] = (acc[v.status] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex-1 overflow-auto bg-slate-50/50 dark:bg-slate-950 p-6 md:p-10">
        <div className="flex items-center justify-center h-96">
          <div className="text-center space-y-3">
            <div className="w-12 h-12 border-4 border-cyan-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">Đang tải danh sách xe...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto bg-slate-50/50 dark:bg-slate-950 p-6 md:p-10 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 border-b border-slate-200/60 dark:border-slate-800 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
            <Car className="w-8 h-8 text-indigo-600" />
            Kho Xe & Số Khung VIN
          </h1>
          <p className="text-sm text-muted-foreground font-semibold mt-1">
            Vehicle Lifecycle Center — Quản lý trạng thái vòng đời từng số khung xe
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={handleImportCSV} className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-bold hover:bg-slate-50 transition-all text-xs">
            <Upload className="w-4 h-4" /> Nhập CSV/Excel
          </button>
          <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all text-xs shadow-sm">
            <PlusCircle className="w-4 h-4" /> Nhập Xe Mới
          </button>
        </div>
      </div>

      {/* Status Summary Pills */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => setStatusFilter('all')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-bold transition-all ${statusFilter === 'all' ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-400'}`}
        >
          Tất cả <span className="bg-current/10 rounded-md px-1.5 py-0.5">{vehicles.length}</span>
        </button>
        {(Object.keys(STATUS_CONFIG) as VehicleStatus[]).map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-bold transition-all ${statusFilter === s ? `${STATUS_CONFIG[s].bg} ${STATUS_CONFIG[s].color} ${STATUS_CONFIG[s].border}` : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-500 hover:border-slate-400'}`}
          >
            {STATUS_CONFIG[s].label}
            {(counts[s] ?? 0) > 0 && <span className={`rounded-md px-1.5 py-0.5 ${statusFilter === s ? 'bg-current/10' : 'bg-slate-100 dark:bg-slate-800'}`}>{counts[s] ?? 0}</span>}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="flex flex-col md:flex-row md:items-center gap-3">
        <div className="relative flex-1 max-w-sm group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors w-4 h-4" />
          <input
            type="text"
            placeholder="Tìm VIN, dòng xe, phiên bản..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all text-sm font-semibold"
          />
        </div>
        <button onClick={handleExportCSV} className="flex items-center gap-2 px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-50 transition-all text-xs">
          <Download className="w-4 h-4" /> Xuất Excel
        </button>
      </div>

      {/* Table */}
      <div className={`bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-3xl shadow-sm ${openDropdownId ? 'overflow-visible' : 'overflow-hidden'}`}>
        <div className={openDropdownId ? "overflow-x-auto overflow-y-visible" : "overflow-x-auto"}>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200/60 dark:border-slate-800 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                <th className="py-4 px-5">Xe & Phiên Bản</th>
                <th className="py-4 px-5">Số VIN / Số Khung</th>
                <th className="py-4 px-5">Màu Sắc</th>
                <th className="py-4 px-5">Trạng Thái</th>
                <th className="py-4 px-5">Vị Trí</th>
                <th className="py-4 px-5 text-right">Giá Niêm Yết</th>
                <th className="py-4 px-5">Chi Tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.length > 0 ? filtered.map((vehicle, idx) => (
                <motion.tr
                  key={vehicle.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: idx * 0.04 }}
                  className="hover:bg-slate-50/50 dark:hover:bg-slate-950/20 transition-all text-sm"
                >
                  <td className="py-4 px-5">
                    <div className="font-bold text-slate-900 dark:text-white">{vehicle.brandName} {vehicle.modelName}</div>
                    <div className="text-xs text-slate-400 font-semibold">{vehicle.variantName} · {vehicle.modelYear}</div>
                  </td>
                  <td className="py-4 px-5">
                    <div className="font-mono font-bold text-xs tracking-widest text-indigo-600 dark:text-indigo-400">{vehicle.vin}</div>
                    {vehicle.chassisNumber && <div className="text-[10px] text-slate-400 font-mono mt-0.5">Khung: {vehicle.chassisNumber}</div>}
                  </td>
                  <td className="py-4 px-5">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full border border-slate-200 bg-slate-100" />
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">{vehicle.colorExterior}</span>
                    </div>
                    {vehicle.colorInterior && <div className="text-[10px] text-slate-400 mt-0.5 font-semibold">Nội thất: {vehicle.colorInterior}</div>}
                  </td>
                  <td className="py-4 px-5 overflow-visible">
                    <StatusChip 
                      vehicle={vehicle} 
                      onTransitioned={() => {
                        // Refetch vehicles after status transition
                        const fetchVehicles = async () => {
                          const supabase = createClient();
                          const { data } = await supabase.from('auto_vehicles').select('*').order('created_at', { ascending: false });
                          if (data) setVehicles(data);
                        };
                        fetchVehicles();
                      }}
                      isOpen={openDropdownId === vehicle.id}
                      onToggle={handleDropdownToggle}
                    />
                  </td>
                  <td className="py-4 px-5">
                    {vehicle.locationNote ? (
                      <div className="flex items-start gap-1.5">
                        <MapPin className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />
                        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 leading-relaxed">{vehicle.locationNote}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-300 font-semibold italic">—</span>
                    )}
                    {vehicle.expectedArrivalDate && (
                      <div className="flex items-center gap-1 mt-1">
                        <Calendar className="w-3 h-3 text-amber-500" />
                        <span className="text-[10px] text-amber-600 font-bold">Dự kiến: {vehicle.expectedArrivalDate}</span>
                      </div>
                    )}
                  </td>
                  <td className="py-4 px-5 text-right">
                    <span className="font-black text-slate-900 dark:text-white text-sm">
                      {(vehicle.listPrice / 1_000_000_000).toFixed(3)}B
                    </span>
                    <span className="text-[10px] text-slate-400 block">đồng</span>
                  </td>
                  <td className="py-4 px-5">
                    <button
                      onClick={() => setSelectedVehicle(vehicle === selectedVehicle ? null : vehicle)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 hover:text-indigo-600 text-slate-500 transition-all"
                    >
                      <Info className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </motion.tr>
              )) : (
                <tr>
                  <td colSpan={7} className="py-20 text-center">
                    <AlertCircle className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                    <p className="text-slate-400 font-bold italic text-sm">Không tìm thấy xe nào khớp với điều kiện lọc</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Detail Drawer */}
        <AnimatePresence>
          {selectedVehicle && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="border-t border-slate-100 dark:border-slate-800 overflow-hidden"
            >
              <div className="p-6 bg-slate-50/50 dark:bg-slate-950/20 grid grid-cols-2 md:grid-cols-4 gap-6">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Số Máy</p>
                  <p className="font-mono font-bold text-xs text-slate-700 dark:text-slate-200">{selectedVehicle.engineNumber ?? '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Giá Vốn</p>
                  <p className="font-bold text-xs text-slate-700 dark:text-slate-200">{(selectedVehicle.costPrice / 1_000_000).toLocaleString('vi-VN')} tr.đ</p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Ngày Về Kho</p>
                  <p className="font-bold text-xs text-slate-700 dark:text-slate-200">{selectedVehicle.actualArrivalDate ?? '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Lần Cập Nhật</p>
                  <p className="font-bold text-xs text-slate-700 dark:text-slate-200">{new Date(selectedVehicle.updatedAt).toLocaleDateString('vi-VN')}</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Add Modal */}
      <AnimatePresence>
        {showAddModal && (
          <AddVehicleModal
            onClose={() => setShowAddModal(false)}
            onSuccess={() => {
              // Refetch vehicles after adding
              const fetchVehicles = async () => {
                const supabase = createClient();
                const { data } = await supabase.from('auto_vehicles').select('*').order('created_at', { ascending: false });
                if (data) setVehicles(data);
              };
              fetchVehicles();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
