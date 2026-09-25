/* eslint-disable @next/next/no-img-element */
'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import PremiumExportButton from '@/components/ui/PremiumExportButton';
import { PremiumSelect } from '@/components/ui/PremiumSelect';
import { cn } from '@/lib/utils';
import {
  Calendar as CalendarIcon,
  CalendarDays,
  Plus,
  ChevronLeft,
  ChevronRight,
  Clock,
  Search,
  Filter,
  UserCheck,
  RotateCw,
  AlertTriangle,
  Scissors,
  CheckCircle2,
  PhoneCall,
  Flame,
  MoreVertical,
  UserPlus
} from 'lucide-react';
import type { Database } from '@/types/database.types';

export type BookingsViewMode = 'calendar' | 'timeline';

interface HaircutBookingsViewProps {
  view: BookingsViewMode;
  onViewChange: (v: BookingsViewMode) => void;
  selectedDate: Date;
  onSelectedDateChange: (d: Date) => void;
  sessions: unknown[];
  ktvs: unknown[];
  isSyncing: boolean;
  onSessionSelect: (session: unknown) => void;
  onEmptySlotClick: (hour: number, ktvId?: string) => void;
  onCreateClick: () => void;
}

const STYLIST_AVATARS: Record<string, string> = {
  'unassigned': '',
  'minh': 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
  'linh': 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=120&auto=format&fit=crop&q=80',
  'nam': 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80',
  'an': 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&auto=format&fit=crop&q=80',
};

const CUSTOMER_AVATARS: Record<string, string> = {
  'Nguyễn Hoàng Anh': 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=120&auto=format&fit=crop&q=80',
  'Lê Quốc Bảo': 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=120&auto=format&fit=crop&q=80',
  'Phạm Thu Hà': 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&auto=format&fit=crop&q=80',
  'Trần Thị Mai': 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=120&auto=format&fit=crop&q=80',
  'Vũ Minh Đức': 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&auto=format&fit=crop&q=80',
  'Hoàng Tuấn': 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80',
  'Lê Anh Dũng': 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=120&auto=format&fit=crop&q=80',
  'Bùi Thị Ngọc': 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
  'Đỗ Thị Nga': 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=120&auto=format&fit=crop&q=80',
  'Trần Minh Quân': 'https://images.unsplash.com/photo-1501196354995-cbb51c65aaea?w=120&auto=format&fit=crop&q=80',
  'Phạm Nguyễn Khoa': 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=120&auto=format&fit=crop&q=80',
  'Nguyễn Văn Hải': 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80',
};

export function HaircutBookingsView({
  view,
  onViewChange,
  selectedDate,
  onSelectedDateChange,
  sessions,
  ktvs,
  isSyncing,
  onSessionSelect,
  onEmptySlotClick,
  onCreateClick,
}: HaircutBookingsViewProps) {
  const [activeTaxonomy, setActiveTaxonomy] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('Tất cả trạng thái');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const taxonomyOptions = [
    { id: 'all', label: 'Tất cả' },
    { id: 'cut', label: 'Cắt tóc' },
    { id: 'styling', label: 'Gội & Styling' },
    { id: 'perm', label: 'Uốn' },
    { id: 'color', label: 'Nhuộm' },
    { id: 'care', label: 'Phục hồi' },
    { id: 'combo', label: 'Combo' },
  ];

  const statusOptions = [
    { value: 'Tất cả trạng thái', label: 'Tất cả trạng thái' },
    { value: 'Đang phục vụ', label: 'Đang phục vụ' },
    { value: 'Đã xác nhận', label: 'Đã xác nhận' },
    { value: 'Chờ khách', label: 'Chờ khách' },
    { value: 'Chờ phân KTV', label: 'Chờ phân KTV' },
    { value: 'Đã hoàn thành', label: 'Đã hoàn thành' },
    { value: 'Trễ lịch', label: 'Trễ lịch' },
  ];

  // Stylist columns matching screenshot
  const stylists = [
    { id: 'unassigned', name: 'Chưa phân công', isUnassigned: true, count: 2, capacity: '2 khách chờ phân KTV', avatar: '' },
    { id: 'minh', name: 'Minh Nguyễn', count: 6, capacity: '72%', statusColor: 'bg-emerald-500', avatar: STYLIST_AVATARS['minh'] },
    { id: 'linh', name: 'Linh Trần', count: 4, capacity: '48%', statusColor: 'bg-emerald-500', avatar: STYLIST_AVATARS['linh'] },
    { id: 'nam', name: 'Nam Lê', count: 7, capacity: '86%', statusColor: 'bg-amber-500', avatar: STYLIST_AVATARS['nam'] },
    { id: 'an', name: 'An Phạm', count: 5, capacity: '60%', statusColor: 'bg-emerald-500', avatar: STYLIST_AVATARS['an'] },
  ];

  // Hardcoded mockup schedule grid items matching target UI screenshot
  const timelineGridData: Record<string, Record<string, Array<{ id: string; name: string; service: string; time: string; status: string; statusLabel: string; style: string }>>> = {
    '08:00': {
      'unassigned': [],
      'minh': [{ id: 'b1', name: 'Nguyễn Hoàng Anh', service: 'Cắt + Styling', time: '08:00 - 08:45', status: 'in_service', statusLabel: 'Đang phục vụ', style: 'bg-emerald-50/90 border-emerald-200 text-emerald-900' }],
      'linh': [],
      'nam': [],
      'an': [{ id: 'b2', name: 'Hoàng Tuấn', service: 'Gội đầu + Massage', time: '08:00 - 08:45', status: 'confirmed', statusLabel: 'Đã xác nhận', style: 'bg-emerald-50/70 border-emerald-200 text-emerald-900' }],
    },
    '08:30': {
      'unassigned': [{ id: 'b3', name: 'Lê Quốc Bảo', service: 'Cắt tóc nam', time: '08:30 - 09:15', status: 'unassigned', statusLabel: 'Chờ phân KTV', style: 'bg-amber-50/90 border-amber-200 text-amber-900' }],
      'minh': [],
      'linh': [{ id: 'b4', name: 'Phạm Thu Hà', service: 'Nhuộm thời trang', time: '08:30 - 09:30', status: 'in_service', statusLabel: 'Đang phục vụ', style: 'bg-sky-50/90 border-sky-200 text-sky-900' }],
      'nam': [],
      'an': [],
    },
    '09:00': {
      'unassigned': [],
      'minh': [{ id: 'b5', name: 'Trần Thị Mai', service: 'Uốn + Phục hồi', time: '09:00 - 09:45', status: 'confirmed', statusLabel: 'Đã xác nhận', style: 'bg-blue-50/90 border-blue-200 text-blue-900' }],
      'linh': [],
      'nam': [{ id: 'b6', name: 'Vũ Minh Đức', service: 'Cắt tóc nam', time: '09:00 - 09:30', status: 'late', statusLabel: 'Trễ 15 phút', style: 'bg-rose-50/90 border-rose-200 text-rose-900' }],
      'an': [],
    },
    '09:30': {
      'unassigned': [],
      'minh': [],
      'linh': [],
      'nam': [],
      'an': [],
    },
    '10:00': {
      'unassigned': [{ id: 'b7', name: 'Nguyễn Thị Hương', service: 'Nhuộm tóc', time: '10:00 - 10:45', status: 'unassigned', statusLabel: 'Chờ phân KTV', style: 'bg-amber-50/90 border-amber-200 text-amber-900' }],
      'minh': [{ id: 'b8', name: 'Lê Anh Dũng', service: 'Cắt + Tạo kiểu', time: '10:00 - 10:45', status: 'confirmed', statusLabel: 'Đã xác nhận', style: 'bg-blue-50/90 border-blue-200 text-blue-900' }],
      'linh': [],
      'nam': [{ id: 'b9', name: 'Trần Minh Quân', service: 'Uốn + Nhuộm', time: '10:00 - 11:00', status: 'in_service', statusLabel: 'Đang phục vụ', style: 'bg-sky-50/90 border-sky-200 text-sky-900' }],
      'an': [],
    },
    '10:30': {
      'unassigned': [],
      'minh': [],
      'linh': [{ id: 'b10', name: 'Đỗ Thị Nga', service: 'Phục hồi tóc', time: '10:15 - 11:00', status: 'confirmed', statusLabel: 'Đã xác nhận', style: 'bg-blue-50/90 border-blue-200 text-blue-900' }],
      'nam': [],
      'an': [{ id: 'b11', name: 'Phạm Nguyễn Khoa', service: 'Cắt tóc nam', time: '10:30 - 11:15', status: 'confirmed', statusLabel: 'Đã xác nhận', style: 'bg-blue-50/90 border-blue-200 text-blue-900' }],
    },
    '11:00': {
      'unassigned': [],
      'minh': [{ id: 'b12', name: 'Bùi Thị Ngọc', service: 'Cắt + Gội', time: '11:00 - 11:45', status: 'waiting', statusLabel: 'Chờ khách', style: 'bg-purple-50/90 border-purple-200 text-purple-900' }],
      'linh': [],
      'nam': [],
      'an': [],
    },
    '11:30': {
      'unassigned': [],
      'minh': [],
      'linh': [{ id: 'b13', name: 'Nguyễn Văn Hải', service: 'Gội đầu + Massage', time: '11:30 - 12:15', status: 'completed', statusLabel: 'Đã hoàn thành', style: 'bg-slate-100/90 border-slate-200 text-slate-700' }],
      'nam': [],
      'an': [],
    },
  };

  const hoursList = ['08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00'];

  const weekDays = [
    { label: 'T2', date: 21 },
    { label: 'T3', date: 22 },
    { label: 'T4', date: 23 },
    { label: 'T5', date: 24 },
    { label: 'T6', date: 25, active: true },
    { label: 'T7', date: 26 },
    { label: 'CN', date: 27 },
  ];

  return (
    <div className="flex-1 overflow-auto bg-slate-50/60 p-4 sm:p-6 md:p-8 relative min-h-screen text-slate-800">
      {/* Top Progress Line */}
      <AnimatePresence>
        {isSyncing && (
          <motion.div
            initial={{ opacity: 0, scaleX: 0 }}
            animate={{ opacity: 1, scaleX: 1 }}
            exit={{ opacity: 0 }}
            className="absolute top-0 left-0 right-0 h-1 bg-primary origin-left z-50"
            transition={{ duration: 0.5 }}
          />
        )}
      </AnimatePresence>

      {/* Header Section */}
      <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl font-serif">
            Lịch hẹn
          </h1>
          <p className="text-slate-500 font-medium text-xs sm:text-sm mt-1">
            Điều phối lịch & kỹ thuật viên theo thời gian thực
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Toggle View Mode */}
          <div className="flex items-center bg-slate-200/70 p-1 rounded-xl">
            <button
              onClick={() => onViewChange('timeline')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition',
                view === 'timeline' ? 'bg-primary text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              )}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              <span>Timeline KTV</span>
            </button>
            <button
              onClick={() => onViewChange('calendar')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition',
                view === 'calendar' ? 'bg-primary text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              )}
            >
              <CalendarIcon className="w-3.5 h-3.5" />
              <span>Lịch tháng</span>
            </button>
          </div>

          <PremiumExportButton />

          {/* CTA Add Booking */}
          <button
            onClick={onCreateClick}
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 font-bold text-xs sm:text-sm text-white shadow-sm transition hover:opacity-90 active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Đặt lịch mới</span>
          </button>
        </div>
      </div>

      {/* Compact Date Ribbon */}
      <div className="bg-white rounded-2xl p-3 border border-slate-100 shadow-sm mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-slate-50 rounded-xl p-1 border border-slate-200/60">
            <button
              onClick={() => {
                const prev = new Date(selectedDate);
                prev.setDate(prev.getDate() - 1);
                onSelectedDateChange(prev);
              }}
              className="p-1.5 hover:bg-white rounded-lg transition text-slate-600"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                const next = new Date(selectedDate);
                next.setDate(next.getDate() + 1);
                onSelectedDateChange(next);
              }}
              className="p-1.5 hover:bg-white rounded-lg transition text-slate-600"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900 capitalize">
              Thứ Sáu, 25 Tháng 9, 2026
            </h2>
            <span className="text-[10px] font-extrabold text-primary tracking-widest uppercase">
              HAIRCUT SHOP COORDINATOR
            </span>
          </div>
        </div>

        {/* Days Strip */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {weekDays.map((d, i) => (
            <button
              key={i}
              className={cn(
                'flex flex-col items-center justify-center w-10 h-11 rounded-xl text-xs transition font-bold',
                d.active
                  ? 'bg-primary text-white shadow-xs'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/50'
              )}
            >
              <span className="text-[9px] uppercase font-extrabold opacity-80">{d.label}</span>
              <span className="text-sm font-black">{d.date}</span>
            </button>
          ))}
          <button
            onClick={() => onSelectedDateChange(new Date())}
            className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs ml-1 transition"
          >
            Hôm nay
          </button>
        </div>
      </div>

      {/* Operational KPI Summary Chips */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {/* Chip 1 */}
        <div className="bg-white rounded-2xl p-3 border border-slate-100 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xl font-black text-slate-900">28</span>
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">
                  ↑ 12%
                </span>
              </div>
              <p className="text-[11px] font-medium text-slate-400">Tổng lịch hôm nay</p>
            </div>
          </div>
        </div>

        {/* Chip 2 */}
        <div className="bg-white rounded-2xl p-3 border border-slate-100 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xl font-black text-slate-900">8</span>
              <p className="text-[11px] font-medium text-slate-400">Sắp tới</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-300" />
        </div>

        {/* Chip 3 */}
        <div className="bg-white rounded-2xl p-3 border border-slate-100 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-50 text-primary flex items-center justify-center shrink-0">
              <Scissors className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xl font-black text-slate-900">3</span>
              <p className="text-[11px] font-medium text-slate-400">Đang phục vụ</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-300" />
        </div>

        {/* Chip 4: Exception alert */}
        <div className="bg-white rounded-2xl p-3 border border-amber-200/80 shadow-sm flex items-center justify-between bg-gradient-to-r from-amber-50/40 to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100/80 text-amber-700 flex items-center justify-center shrink-0">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xl font-black text-slate-900">2</span>
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-rose-100 text-rose-700 border border-rose-200">
                  Cần xử lý
                </span>
              </div>
              <p className="text-[11px] font-bold text-amber-800">Chưa phân KTV</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-amber-500" />
        </div>
      </div>

      {/* Haircut Taxonomy Filter Bar */}
      <div className="bg-white rounded-2xl p-3 border border-slate-100 shadow-sm mb-5 flex flex-wrap items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
          <input
            type="text"
            placeholder="Tìm khách hàng, SĐT, dịch vụ..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200/60 rounded-xl outline-none text-xs font-medium text-slate-700 focus:border-primary"
          />
        </div>

        {/* Taxonomy Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          {taxonomyOptions.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTaxonomy(item.id)}
              className={cn(
                'px-3 py-1.5 rounded-xl text-xs font-bold transition-all',
                activeTaxonomy === item.id
                  ? 'bg-primary text-white shadow-xs'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/50'
              )}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Status Dropdown */}
        <div className="w-44">
          <PremiumSelect
            value={statusFilter}
            options={statusOptions}
            onChange={(val) => setStatusFilter(val)}
            placeholder="Tất cả trạng thái"
          />
        </div>
      </div>

      {/* Timeline Grid Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <div className="min-w-[900px]">
            {/* Header Stylists Row */}
            <div className="grid grid-cols-[80px_repeat(5,1fr)] bg-slate-50/80 border-b border-slate-200">
              <div className="p-3 text-center text-xs font-extrabold text-slate-400 uppercase tracking-wider flex items-center justify-center border-r border-slate-200/60">
                Giờ
              </div>

              {stylists.map((st) => (
                <div
                  key={st.id}
                  className={cn(
                    'p-3 flex items-center gap-3 border-r border-slate-200/60 last:border-r-0',
                    st.isUnassigned ? 'bg-amber-50/50' : 'bg-slate-50/50'
                  )}
                >
                  {st.isUnassigned ? (
                    <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 font-bold text-sm">
                      <UserPlus className="w-5 h-5 text-emerald-700" />
                    </div>
                  ) : (
                    <div className="w-9 h-9 rounded-full overflow-hidden border border-slate-200 shrink-0 bg-slate-200">
                      <img src={st.avatar} alt={st.name} className="w-full h-full object-cover" />
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <h3 className="text-xs font-extrabold text-slate-900 truncate">{st.name}</h3>
                      {st.isUnassigned && (
                        <span className="w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center">
                          {st.count}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] font-medium text-slate-500 mt-0.5">
                      {!st.isUnassigned && (
                        <span className={cn('w-2 h-2 rounded-full', st.statusColor)} />
                      )}
                      <span className="truncate">
                        {st.isUnassigned ? st.capacity : `${st.count} lịch • ${st.capacity}`}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Grid Hours Rows */}
            <div className="relative">
              {/* NOW LINE at 09:15 */}
              <div className="absolute left-0 right-0 top-[110px] z-30 pointer-events-none flex items-center">
                <div className="bg-rose-500 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded-r-md shadow-xs flex items-center gap-1">
                  <span>09:15</span>
                  <span>BÂY GIỜ</span>
                </div>
                <div className="flex-1 border-b-2 border-dashed border-rose-500" />
              </div>

              {hoursList.map((hour, hIdx) => (
                <div
                  key={hour}
                  className="grid grid-cols-[80px_repeat(5,1fr)] min-h-[96px] border-b border-slate-100 hover:bg-slate-50/20 transition"
                >
                  {/* Time column */}
                  <div className="p-2 text-center text-xs font-bold text-slate-400 border-r border-slate-200/60 bg-slate-50/30 flex items-start justify-center pt-3">
                    {hour}
                  </div>

                  {/* 5 Stylist Columns */}
                  {stylists.map((st) => {
                    const bookings = timelineGridData[hour]?.[st.id] || [];

                    return (
                      <div
                        key={st.id}
                        className={cn(
                          'p-1.5 border-r border-slate-200/60 last:border-r-0 relative group/cell min-h-[96px]',
                          st.isUnassigned ? 'bg-amber-50/10' : ''
                        )}
                        onClick={() => {
                          if (bookings.length === 0) {
                            onEmptySlotClick(parseInt(hour.split(':')[0], 10), st.id);
                          }
                        }}
                      >
                        {bookings.length > 0 ? (
                          <div className="space-y-1.5">
                            {bookings.map((b) => (
                              <div
                                key={b.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onSessionSelect(b);
                                }}
                                className={cn(
                                  'p-2 rounded-xl border text-xs cursor-pointer shadow-2xs hover:shadow-sm transition-all',
                                  b.style
                                )}
                              >
                                <div className="flex items-center gap-2 mb-1">
                                  <div className="w-6 h-6 rounded-full overflow-hidden border border-slate-200 shrink-0 bg-slate-200">
                                    <img
                                      src={
                                        CUSTOMER_AVATARS[b.name] ||
                                        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80'
                                      }
                                      alt={b.name}
                                      className="w-full h-full object-cover"
                                    />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <h4 className="font-extrabold text-slate-900 text-xs truncate">
                                      {b.name}
                                    </h4>
                                    <p className="text-[10px] font-semibold text-slate-600 truncate">
                                      {b.service}
                                    </p>
                                  </div>
                                  <MoreVertical className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                </div>

                                <div className="flex items-center justify-between text-[10px] font-medium pt-0.5 border-t border-slate-200/40 mt-1">
                                  <span className="text-slate-500 font-semibold">{b.time}</span>
                                  <span
                                    className={cn(
                                      'font-bold flex items-center gap-1',
                                      b.status === 'in_service' && 'text-emerald-700',
                                      b.status === 'confirmed' && 'text-blue-700',
                                      b.status === 'unassigned' && 'text-amber-800',
                                      b.status === 'waiting' && 'text-purple-700',
                                      b.status === 'completed' && 'text-slate-600',
                                      b.status === 'late' && 'text-rose-700 font-extrabold'
                                    )}
                                  >
                                    {b.status === 'in_service' && <Scissors className="w-3 h-3" />}
                                    {b.status === 'confirmed' && <PhoneCall className="w-3 h-3" />}
                                    {b.status === 'unassigned' && <AlertTriangle className="w-3 h-3" />}
                                    {b.status === 'completed' && <CheckCircle2 className="w-3 h-3" />}
                                    {b.status === 'late' && <Flame className="w-3 h-3" />}
                                    {b.statusLabel}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/cell:opacity-100 transition cursor-pointer">
                            <span className="text-[10px] font-bold text-slate-400 bg-white/80 border border-slate-200 px-2 py-1 rounded-md shadow-2xs">
                              + Đặt lịch
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
