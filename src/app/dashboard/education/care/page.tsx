/**
 * Bella Education — Child Healthcare, Nutrition & Daily Meals
 *
 * Full viewport width layout, daily meal menu, health records, allergy alerts, and nap logs.
 */

import Link from 'next/link';
import { 
  Heart, 
  Utensils, 
  Search, 
  ArrowLeft, 
  ShieldAlert, 
  Calendar, 
  CheckCircle2, 
  Sparkles,
  Clock,
  Activity
} from 'lucide-react';

const MEALS_MENU_TODAY = [
  {
    meal: 'Bữa Sáng (07:30 - 08:30)',
    title: 'Súp Cua Gà Ngô Ngọt & Sữa Hạt Sen',
    calories: '320 Kcal',
    allergiesNote: 'Thay súp lợn băm cho trẻ dị ứng hải sản (03 bé)',
    status: 'Hoàn Thành',
  },
  {
    meal: 'Bữa Trưa (11:00 - 12:00)',
    title: 'Cơm Tấm Bò Sốt Cam, Canh Bí Đao Sườn Thịt & Chuối Tiêu',
    calories: '480 Kcal',
    allergiesNote: 'Cắt nhỏ hoa quả cho Khối Nhà Trẻ N1',
    status: 'Đang Phục Vụ',
  },
  {
    meal: 'Bữa Xế (14:30 - 15:15)',
    title: 'Bánh Su Kem Phô Mai & Sữa Tươi Tiệt Trùng',
    calories: '210 Kcal',
    allergiesNote: 'Thay bánh không đường cho trẻ béo phì',
    status: 'Sẵn Sàng',
  },
];

const HEALTH_ALERTS = [
  {
    studentName: 'Nguyễn Minh An (Bé Bi)',
    className: 'Lớp Mầm A1',
    alertType: 'Dị ứng Thực phẩm',
    details: 'Dị ứng tôm cua hải sản. Ngứa mẩn đỏ nếu ăn trúng.',
    actionRequired: 'Cô chủ nhiệm & Bếp kiểm tra dán nhãn khay ăn riêng.',
    severity: 'Cao',
  },
  {
    studentName: 'Trần Bảo Ngọc (Bé Bắp)',
    className: 'Lớp Chồi B1',
    alertType: 'Uống Thuốc Theo Đơn Phụ Huynh',
    details: 'Sốt nhẹ 37.5°C. Phụ huynh gửi siro Hobezut uống lúc 13h00.',
    actionRequired: 'Cô y tế đo nhiệt độ trước khi cho uống.',
    severity: 'Trung bình',
  },
];

export default function CarePage() {
  return (
    <div className="w-full p-4 sm:p-6 lg:p-8 space-y-6 pb-12">
      {/* Header Banner */}
      <div className="w-full rounded-3xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-700/60 pb-5">
          <div className="flex items-center gap-3">
            <Link 
              href="/dashboard/education" 
              className="p-2.5 rounded-2xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition-colors shrink-0"
              title="Quay lại Dashboard"
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
                  Thực đơn 5 bữa tuần, theo dõi chỉ số BMI, lịch uống thuốc và nhật ký giấc ngủ
                </p>
              </div>
            </div>
          </div>

          <button className="inline-flex items-center justify-center gap-2 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white px-5 py-3 text-xs font-bold shadow-lg shadow-rose-500/20 transition-all active:scale-95 shrink-0">
            <Utensils className="w-4 h-4" />
            <span>Cập Nhật Thực Đơn Tuần</span>
          </button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
          <div className="p-4 rounded-2xl bg-rose-50/80 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-900/60">
            <p className="text-[11px] font-bold text-rose-600 dark:text-rose-400">Tổng Suất Ăn Hôm Nay</p>
            <p className="text-xl font-extrabold text-gray-900 dark:text-white mt-1">280 Khay</p>
          </div>
          <div className="p-4 rounded-2xl bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-900/60">
            <p className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">Trẻ Dị Ứng Cần Lưu Ý</p>
            <p className="text-xl font-extrabold text-gray-900 dark:text-white mt-1">12 Bé</p>
          </div>
          <div className="p-4 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-900/60">
            <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">Đơn Thuốc Phụ Huynh Gửi</p>
            <p className="text-xl font-extrabold text-gray-900 dark:text-white mt-1">05 Đơn</p>
          </div>
          <div className="p-4 rounded-2xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-900/60">
            <p className="text-[11px] font-bold text-amber-600 dark:text-amber-400">Tỷ Lệ Ngủ Trưa Đạt Chuẩn</p>
            <p className="text-xl font-extrabold text-gray-900 dark:text-white mt-1">98.5%</p>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Daily Meal Schedule */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-3xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 p-6 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700/60 pb-4">
              <h2 className="text-base font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
                <Utensils className="w-5 h-5 text-rose-500" />
                Thực Đơn Dinh Dưỡng Hôm Nay (Thứ Tư)
              </h2>
              <span className="text-xs font-bold text-slate-500">280 Suất Ăn</span>
            </div>

            <div className="space-y-4">
              {MEALS_MENU_TODAY.map((m, idx) => (
                <div key={idx} className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-700/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-rose-600 dark:text-rose-400">{m.meal}</span>
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                      {m.status}
                    </span>
                  </div>
                  <h3 className="text-sm font-extrabold text-gray-900 dark:text-white">{m.title}</h3>
                  <div className="flex items-center justify-between text-xs text-gray-500 pt-1">
                    <span>Năng lượng: <strong className="text-gray-800 dark:text-gray-200">{m.calories}</strong></span>
                    <span className="text-amber-600 dark:text-amber-400 font-semibold">{m.allergiesNote}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Health Alerts Sidebar */}
        <div className="space-y-6">
          <div className="rounded-3xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 p-6 shadow-sm space-y-5">
            <h2 className="text-base font-extrabold text-gray-900 dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-slate-700/60 pb-4">
              <ShieldAlert className="w-5 h-5 text-amber-500" />
              Cảnh Báo Y Tế & Thuốc
            </h2>

            <div className="space-y-4">
              {HEALTH_ALERTS.map((h, idx) => (
                <div key={idx} className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-extrabold text-gray-900 dark:text-white">{h.studentName}</h4>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300">
                      {h.alertType}
                    </span>
                  </div>
                  <p className="text-xs text-amber-900 dark:text-amber-300 leading-snug">{h.details}</p>
                  <p className="text-[11px] font-bold text-amber-700 dark:text-amber-400 pt-1 border-t border-amber-200/50">
                    👉 {h.actionRequired}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
