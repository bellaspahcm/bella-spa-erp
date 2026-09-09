'use client';

/**
 * Bella Education — Child Care & Wellbeing Operational Workspace
 * 
 * Deep Domain Architecture:
 * - Real-Time Care Operations + Exception Management
 * - Semantic KPI Categories: Operations Workload, Action Required (Risk/Queue), Care Quality
 * - Sub-Workspace Tabs:
 *   1. Tổng Quan Vận Hành (Today Care & Exceptions)
 *   2. Dinh Dưỡng & Thực Đơn (Nutrition & Menu Engine)
 *   3. Y Tế & Quy Trình Uống Thuốc (Medication Administration Audit Trail Workflow)
 *   4. Theo Dõi Giấc Ngủ (Sleep Compliance Engine)
 *   5. Tăng Trưởng & Chỉ Số BMI (Growth & Health Trends)
 * - Allergy x Menu Conflict Detection & Alternative Meal Verification Workflow
 * - Governed Medication Administration State Machine: RECEIVED ➔ VERIFIED ➔ SCHEDULED ➔ ADMINISTERED
 */

import { useState } from 'react';
import Link from 'next/link';
import {
  Heart,
  Utensils,
  ArrowLeft,
  ShieldAlert,
  Calendar,
  CheckCircle2,
  Sparkles,
  Clock,
  Activity,
  Pill,
  Moon,
  AlertTriangle,
  FileSpreadsheet,
  Plus,
  Check,
  UserCheck,
  ChevronRight,
  ShieldCheck,
  Info,
  Layers,
  Search,
  Filter
} from 'lucide-react';

type MedicationOrder = {
  id: string;
  studentName: string;
  className: string;
  medicineName: string;
  dosage: string;
  scheduledTime: string;
  noteFromParent: string;
  tempCheckRequired: boolean;
  status: 'RECEIVED' | 'VERIFIED' | 'SCHEDULED' | 'ADMINISTERED' | 'REJECTED';
  administeredBy?: string;
  administeredAt?: string;
};

type DietaryException = {
  id: string;
  studentName: string;
  className: string;
  allergyType: string;
  severity: 'HIGH' | 'MEDIUM';
  conflictDish: string;
  substituteDish: string;
  kitchenVerified: boolean;
  teacherVerified: boolean;
};

export default function CarePage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'nutrition' | 'medication' | 'sleep' | 'growth'>('overview');
  const [selectedDate, setSelectedDate] = useState('Thứ Tư, 09/09/2026');

  // Interactive Medication Orders State Machine
  const [medicationOrders, setMedicationOrders] = useState<MedicationOrder[]>([
    {
      id: 'MED-001',
      studentName: 'Trần Bảo Ngọc (Bé Bắp)',
      className: 'Lớp Chồi B1',
      medicineName: 'Siro Ho Hobezut',
      dosage: '5 ml',
      scheduledTime: '13:00',
      noteFromParent: 'Sốt nhẹ 37.5°C buổi sáng. Uống sau khi ăn trưa xong.',
      tempCheckRequired: true,
      status: 'SCHEDULED',
    },
    {
      id: 'MED-002',
      studentName: 'Lê Hoàng Nam (Bé Tí)',
      className: 'Lớp Mầm A2',
      medicineName: 'Men vi sinh BioGaia',
      dosage: '5 giọt',
      scheduledTime: '11:30',
      noteFromParent: 'Trộn cùng 2 thìa canh cháo trước bữa ăn trưa.',
      tempCheckRequired: false,
      status: 'ADMINISTERED',
      administeredBy: 'Y tế Nguyễn Thị Hoa',
      administeredAt: '11:32',
    },
    {
      id: 'MED-003',
      studentName: 'Phạm Đức Anh',
      className: 'Lớp Lá C1',
      medicineName: 'Thuốc xịt mũi Xysal',
      dosage: '2 nhát xịt/bên',
      scheduledTime: '14:00',
      noteFromParent: 'Xịt sau khi trẻ ngủ dậy vệ sinh cá nhân.',
      tempCheckRequired: false,
      status: 'VERIFIED',
    },
  ]);

  // Dietary Exceptions x Allergy Conflict Data
  const [dietaryExceptions, setDietaryExceptions] = useState<DietaryException[]>([
    {
      id: 'EX-01',
      studentName: 'Nguyễn Minh An (Bé Bi)',
      className: 'Lớp Mầm A1',
      allergyType: 'Dị ứng Tôm/Cua Hải sản',
      severity: 'HIGH',
      conflictDish: 'Súp Cua Gà Ngô Ngọt (Bữa Sáng)',
      substituteDish: 'Súp Lợn Băm Nấm Hương',
      kitchenVerified: true,
      teacherVerified: true,
    },
    {
      id: 'EX-02',
      studentName: 'Đỗ Thùy Anh',
      className: 'Lớp Chồi B2',
      allergyType: 'Bất dung nạp Lactose (Sữa bò)',
      severity: 'HIGH',
      conflictDish: 'Bánh Su Kem Phô Mai & Sữa Tươi (Bữa Xế)',
      substituteDish: 'Bánh Yến Mạch & Sữa Hạt Đậu Nành',
      kitchenVerified: true,
      teacherVerified: false,
    },
    {
      id: 'EX-03',
      studentName: 'Vũ Quốc Bảo',
      className: 'Lớp Nhà Trẻ N1',
      allergyType: 'Thức ăn nguyên khối (Cần xay nhuyễn)',
      severity: 'MEDIUM',
      conflictDish: 'Cơm Tấm Bò Sốt Cam (Bữa Trưa)',
      substituteDish: 'Cháo Bò Băm Cắt Nhỏ Củ Quả',
      kitchenVerified: true,
      teacherVerified: true,
    },
  ]);

  const handleAdministerMedication = (id: string) => {
    setMedicationOrders((prev) =>
      prev.map((m) =>
        m.id === id
          ? {
              ...m,
              status: 'ADMINISTERED',
              administeredBy: 'Y tế Nguyễn Thị Hoa',
              administeredAt: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
            }
          : m
      )
    );
  };

  return (
    <div className="w-full p-4 sm:p-6 lg:p-8 space-y-6 pb-12">
      {/* ── UNIFIED PAGE HEADER ── */}
      <div className="w-full rounded-3xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-700/60 pb-5">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/education"
              className="p-2.5 rounded-2xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition-colors shrink-0"
              title="Quay lại Dashboard Education"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 shrink-0">
                <Heart className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                  Chăm Sóc Dinh Dưỡng & Sức Khỏe Mầm Non
                </h1>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Vận hành dinh dưỡng 5 bữa tuần, theo dõi chỉ số y tế, quy trình uống thuốc có kiểm soát & nhật ký giấc ngủ
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0 self-end md:self-auto">
            <div className="relative">
              <input
                type="text"
                disabled
                value={selectedDate}
                className="bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-xs font-bold text-slate-700 dark:text-slate-200 rounded-2xl px-4 py-2.5"
              />
            </div>
            <button className="inline-flex items-center justify-center gap-2 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white px-5 py-2.5 text-xs font-bold shadow-lg shadow-rose-500/20 transition-all active:scale-95 cursor-pointer">
              <Plus className="w-4 h-4" />
              <span>Ghi Nhận Chăm Sóc Mới</span>
            </button>
          </div>
        </div>

        {/* ── SEMANTIC OPERATIONAL KPI CARDS ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Category 1: Operations Workload */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-700/60 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                1. Operations Workload
              </span>
              <Utensils className="w-4 h-4 text-rose-500" />
            </div>
            <div>
              <p className="text-2xl font-extrabold text-slate-900 dark:text-white">280 Suất Ăn</p>
              <p className="text-[11px] font-semibold text-slate-500 mt-0.5">
                277 suất tiêu chuẩn • <strong className="text-rose-600 dark:text-rose-400">3 suất đặc biệt</strong>
              </p>
            </div>
          </div>

          {/* Category 2: Risk / Dietary Alerts */}
          <div className="p-4 rounded-2xl bg-rose-50/70 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-900/60 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                2. Risk / Allergy Alerts
              </span>
              <ShieldAlert className="w-4 h-4 text-rose-600" />
            </div>
            <div>
              <p className="text-2xl font-extrabold text-rose-900 dark:text-rose-200">12 Trẻ Dị Ứng</p>
              <p className="text-[11px] font-semibold text-rose-700 dark:text-rose-300 mt-0.5">
                🔴 Đã dán nhãn khay ăn riêng tại bếp
              </p>
            </div>
          </div>

          {/* Category 3: Work Queue / Medication */}
          <div className="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-900/60 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                3. Medication Queue
              </span>
              <Pill className="w-4 h-4 text-indigo-600" />
            </div>
            <div>
              <p className="text-2xl font-extrabold text-indigo-900 dark:text-indigo-200">05 Đơn Thuốc</p>
              <p className="text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 mt-0.5">
                1/5 đã uống • 4 đơn chờ giờ quy định
              </p>
            </div>
          </div>

          {/* Category 4: Care Quality / Sleep Compliance */}
          <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-900/60 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                4. Quality / Sleep
              </span>
              <Moon className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-extrabold text-emerald-900 dark:text-emerald-200">98.5% Đạt Chuẩn</p>
              <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 mt-0.5">
                Giấc ngủ trưa 120 phút (12:00 ➔ 14:00)
              </p>
            </div>
          </div>
        </div>

        {/* ── WORKSPACE TABS NAVIGATION ── */}
        <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-700/60 overflow-x-auto pb-1">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2.5 text-xs font-extrabold rounded-2xl transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'overview'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Tổng Quan Vận Hành
          </button>
          <button
            onClick={() => setActiveTab('nutrition')}
            className={`px-4 py-2.5 text-xs font-extrabold rounded-2xl transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'nutrition'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Utensils className="w-3.5 h-3.5" />
            Dinh Dưỡng & Thực Đơn Bữa Ăn
          </button>
          <button
            onClick={() => setActiveTab('medication')}
            className={`px-4 py-2.5 text-xs font-extrabold rounded-2xl transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'medication'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Pill className="w-3.5 h-3.5" />
            Y Tế & Quy Trình Uống Thuốc ({medicationOrders.filter((m) => m.status !== 'ADMINISTERED').length})
          </button>
          <button
            onClick={() => setActiveTab('sleep')}
            className={`px-4 py-2.5 text-xs font-extrabold rounded-2xl transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'sleep'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Moon className="w-3.5 h-3.5" />
            Theo Dõi Giấc Ngủ Trưa
          </button>
          <button
            onClick={() => setActiveTab('growth')}
            className={`px-4 py-2.5 text-xs font-extrabold rounded-2xl transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'growth'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            Tăng Trưởng & BMI
          </button>
        </div>
      </div>

      {/* ── TAB CONTENT 1: OVERVIEW & REAL-TIME CARE OPERATIONS ── */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Daily Meal Schedule & Exception Breakdown */}
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-3xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 p-6 shadow-sm space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700/60 pb-4">
                <h2 className="text-base font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
                  <Utensils className="w-5 h-5 text-rose-500" />
                  Vận Hành Dinh Dưỡng & Khay Ăn Đặc Biệt Hôm Nay
                </h2>
                <span className="text-xs font-bold text-slate-500">280 Suất Phục Vụ</span>
              </div>

              <div className="space-y-4">
                {/* Breakfast */}
                <div className="p-5 rounded-3xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-700/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-extrabold text-rose-600 dark:text-rose-400">Bữa Sáng (07:30 - 08:30)</span>
                      <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        280 Suất (277 Tiêu chuẩn • 3 Đặc biệt)
                      </span>
                    </div>
                    <span className="text-xs font-extrabold px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200">
                      ✓ Hoàn Thành
                    </span>
                  </div>
                  <h3 className="text-sm font-extrabold text-gray-900 dark:text-white">
                    Súp Cua Gà Ngô Ngọt & Sữa Hạt Sen (320 Kcal)
                  </h3>

                  {/* Exception Visibility */}
                  <div className="p-3 rounded-2xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200/60 text-xs space-y-1">
                    <span className="font-extrabold text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                      Xử lý ngoại lệ dị ứng hải sản (03 bé):
                    </span>
                    <p className="text-amber-800 dark:text-amber-400 text-[11px]">
                      ✓ Bếp đổi sang Súp Lợn Băm • Dán nhãn màu đỏ khay riêng • Cô chủ nhiệm xác nhận an toàn trước khi trẻ ăn.
                    </p>
                  </div>
                </div>

                {/* Lunch */}
                <div className="p-5 rounded-3xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-700/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-extrabold text-rose-600 dark:text-rose-400">Bữa Trưa (11:00 - 12:00)</span>
                      <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        280 Suất (279 Tiêu chuẩn • 1 Đặc biệt)
                      </span>
                    </div>
                    <span className="text-xs font-extrabold px-3 py-1 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200">
                      ● Đang Phục Vụ
                    </span>
                  </div>
                  <h3 className="text-sm font-extrabold text-gray-900 dark:text-white">
                    Cơm Tấm Bò Sốt Cam, Canh Bí Đao Sườn Thịt & Chuối Tiêu (480 Kcal)
                  </h3>

                  <div className="p-3 rounded-2xl bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200/60 text-xs space-y-1">
                    <span className="font-extrabold text-indigo-900 dark:text-indigo-300 flex items-center gap-1.5">
                      <Info className="w-3.5 h-3.5 text-indigo-500" />
                      Chế biến đặc biệt cho Khối Nhà Trẻ N1:
                    </span>
                    <p className="text-indigo-800 dark:text-indigo-400 text-[11px]">
                      ✓ Thịt bò băm nhỏ • Chuối tiêu cắt lát tròn 0.5cm • Đã kiểm định độ mềm thực phẩm.
                    </p>
                  </div>
                </div>

                {/* Afternoon Snack */}
                <div className="p-5 rounded-3xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-700/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-extrabold text-rose-600 dark:text-rose-400">Bữa Xế (14:30 - 15:15)</span>
                      <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        280 Suất
                      </span>
                    </div>
                    <span className="text-xs font-extrabold px-3 py-1 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                      Sẵn Sàng
                    </span>
                  </div>
                  <h3 className="text-sm font-extrabold text-gray-900 dark:text-white">
                    Bánh Su Kem Phô Mai & Sữa Tươi Tiệt Trùng (210 Kcal)
                  </h3>
                </div>
              </div>
            </div>
          </div>

          {/* Side Exception Panel: Health & Medication Queue */}
          <div className="space-y-6">
            <div className="rounded-3xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 p-6 shadow-sm space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700/60 pb-4">
                <h2 className="text-base font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
                  <Pill className="w-5 h-5 text-indigo-500" />
                  Quy Trình Cho Uống Thuốc Hôm Nay
                </h2>
                <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                  {medicationOrders.filter((m) => m.status !== 'ADMINISTERED').length} Đơn Cần Thực Hiện
                </span>
              </div>

              <div className="space-y-4">
                {medicationOrders.map((m) => (
                  <div
                    key={m.id}
                    className={`p-4 rounded-2xl border ${
                      m.status === 'ADMINISTERED'
                        ? 'bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-200/60'
                        : 'bg-indigo-50/60 dark:bg-indigo-950/30 border-indigo-200/60'
                    } space-y-2.5`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-extrabold text-slate-900 dark:text-white">{m.studentName}</h4>
                        <span className="text-[10px] font-bold text-slate-500">{m.className}</span>
                      </div>
                      <span
                        className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full ${
                          m.status === 'ADMINISTERED'
                            ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                            : 'bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300'
                        }`}
                      >
                        {m.status === 'ADMINISTERED' ? '✓ Đã Uống Thuốc' : `⏰ Lịch: ${m.scheduledTime}`}
                      </span>
                    </div>

                    <div className="text-xs text-slate-700 dark:text-slate-300 space-y-1">
                      <p>
                        Thuốc: <strong>{m.medicineName}</strong> (Liều: {m.dosage})
                      </p>
                      <p className="text-[11px] text-slate-500 italic">"{m.noteFromParent}"</p>
                    </div>

                    {m.status === 'ADMINISTERED' ? (
                      <div className="pt-2 border-t border-emerald-200/60 text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold flex items-center justify-between">
                        <span>Xác nhận lúc: {m.administeredAt}</span>
                        <span>Bởi: {m.administeredBy}</span>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleAdministerMedication(m.id)}
                        className="w-full mt-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs transition-all shadow-sm cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Xác Nhận Đã Cho Uống Thuốc</span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB CONTENT 2: NUTRITION & MENU ENGINE ── */}
      {activeTab === 'nutrition' && (
        <div className="rounded-3xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <Utensils className="w-5 h-5 text-rose-500" />
              Bảng Thực Đơn Dinh Dưỡng Tuần (Thứ 2 ➔ Thứ 6)
            </h3>
            <button className="px-4 py-2.5 rounded-2xl bg-rose-600 text-white font-extrabold text-xs hover:bg-rose-700 transition-colors">
              + Lập Thực Đơn Tuần Mới
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-5 rounded-3xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 space-y-3">
              <span className="text-xs font-extrabold text-rose-600">Thứ Hai</span>
              <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">Cháo Thịt Bò Bí Đỏ & Sữa Chua</h4>
              <p className="text-xs text-slate-500">Tổng năng lượng: 980 Kcal (Protein 42g, Calo đạt chuẩn)</p>
            </div>
            <div className="p-5 rounded-3xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 space-y-3">
              <span className="text-xs font-extrabold text-rose-600">Thứ Ba</span>
              <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">Nui Cua Đồng Cá Tháp & Nước Ép Táo</h4>
              <p className="text-xs text-slate-500">Tổng năng lượng: 1,020 Kcal (Canxi & Vitamin A)</p>
            </div>
            <div className="p-5 rounded-3xl bg-rose-50/80 dark:bg-rose-950/40 border border-rose-200 space-y-3">
              <span className="text-xs font-extrabold text-rose-600">Thứ Tư (Hôm Nay)</span>
              <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">Súp Cua Gà & Cơm Tấm Bò Sốt Cam</h4>
              <p className="text-xs text-slate-600 dark:text-slate-300 font-semibold">Tổng năng lượng: 1,010 Kcal • 3 khay dị ứng riêng</p>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB CONTENT 3: MEDICATION WORKFLOW AUDIT TRAIL ── */}
      {activeTab === 'medication' && (
        <div className="rounded-3xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 p-6 sm:p-8 shadow-sm space-y-6">
          <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <Pill className="w-5 h-5 text-indigo-500" />
            Nhật Ký & Audit Trail Uống Thuốc Phụ Huynh Gửi
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-500 dark:text-slate-400 uppercase tracking-wider font-extrabold">
                <tr>
                  <th className="p-3.5 rounded-l-2xl">Mã Đơn</th>
                  <th className="p-3.5">Học Sinh</th>
                  <th className="p-3.5">Tên Thuốc & Liều Dùng</th>
                  <th className="p-3.5">Lịch Chỉ Định</th>
                  <th className="p-3.5">Ghi Chú Phụ Huynh</th>
                  <th className="p-3.5 rounded-r-2xl">Trạng Thái & Người Xác Nhận</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {medicationOrders.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/40">
                    <td className="p-3.5 font-bold text-slate-900 dark:text-white">{m.id}</td>
                    <td className="p-3.5 font-extrabold text-indigo-600 dark:text-indigo-400">{m.studentName} ({m.className})</td>
                    <td className="p-3.5 font-bold text-slate-800 dark:text-slate-200">{m.medicineName} ({m.dosage})</td>
                    <td className="p-3.5 font-semibold text-slate-600">{m.scheduledTime}</td>
                    <td className="p-3.5 text-slate-500 italic">{m.noteFromParent}</td>
                    <td className="p-3.5">
                      {m.status === 'ADMINISTERED' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-emerald-100 text-emerald-800">
                          ✓ Đã cho uống lúc {m.administeredAt} ({m.administeredBy})
                        </span>
                      ) : (
                        <button
                          onClick={() => handleAdministerMedication(m.id)}
                          className="px-3 py-1 rounded-xl bg-indigo-600 text-white font-bold text-[11px] hover:bg-indigo-700 transition-colors cursor-pointer"
                        >
                          Xác Nhận Uống
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB CONTENT 4: SLEEP TRACKING ── */}
      {activeTab === 'sleep' && (
        <div className="rounded-3xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 p-6 sm:p-8 shadow-sm space-y-6">
          <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <Moon className="w-5 h-5 text-emerald-500" />
            Nhật Ký Giấc Ngủ Trưa Theo Định Mức Chuẩn (12:00 ➔ 14:00)
          </h3>

          <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 text-xs space-y-1">
            <span className="font-extrabold text-emerald-900 dark:text-emerald-300">
              Định nghĩa Đạt Chuẩn Giấc Ngủ Mầm Non:
            </span>
            <p className="text-emerald-800 dark:text-emerald-400">
              ✓ Thời lượng giấc ngủ tối thiểu 105–120 phút • Giật mình/thức giấc dưới 2 lần • Nhiệt độ phòng ngủ duy trì 25-26°C.
            </p>
          </div>
        </div>
      )}

      {/* ── TAB CONTENT 5: GROWTH ANALYTICS ── */}
      {activeTab === 'growth' && (
        <div className="rounded-3xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 p-6 sm:p-8 shadow-sm space-y-6">
          <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-amber-500" />
            Báo Cáo Tăng Trưởng Chiều Cao, Cân Nặng & Chỉ Số BMI Trẻ
          </h3>
          <p className="text-xs text-slate-500">Đợt đo kiểm định kỳ Học kỳ I — Tháng 09/2026</p>
        </div>
      )}
    </div>
  );
}
