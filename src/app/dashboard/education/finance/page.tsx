/**
 * Bella Education — Tuition & Preschool Financial Management
 *
 * Full viewport width layout, tuition fee collection, meal plan bills, extracurricular invoices, and financial reports.
 */

import Link from 'next/link';
import { 
  CircleDollarSign, 
  Plus, 
  Search, 
  ArrowLeft, 
  CreditCard, 
  Receipt, 
  CheckCircle2, 
  Clock, 
  ArrowUpRight,
  PieChart
} from 'lucide-react';

const TUITION_INVOICES = [
  {
    id: 'INV-2026-0901',
    studentName: 'Nguyễn Minh An (Bé Bi)',
    className: 'Lớp Mầm A1',
    items: 'Học phí Tháng 9 + Tiền ăn (22 buổi) + Lớp vẽ Reggio',
    totalAmount: '6,850,000 VNĐ',
    dueDate: '10/09/2026',
    status: 'Đã Thống Kê - Chờ Thu',
    theme: {
      badgeBg: 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300',
      btnPrimary: 'bg-amber-600 hover:bg-amber-700 text-white',
    },
  },
  {
    id: 'INV-2026-0902',
    studentName: 'Trần Bảo Ngọc (Bé Bắp)',
    className: 'Lớp Chồi B1',
    items: 'Học phí Tháng 9 + Tiền ăn (22 buổi) + Tiếng Anh Montessori',
    totalAmount: '7,400,000 VNĐ',
    dueDate: '05/09/2026',
    status: 'Đã Thanh Toán',
    theme: {
      badgeBg: 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300',
      btnPrimary: 'bg-emerald-600 hover:bg-emerald-700 text-white',
    },
  },
  {
    id: 'INV-2026-0903',
    studentName: 'Phạm Hoàng Nam (Bé Bin)',
    className: 'Lớp Lá C1',
    items: 'Học phí Tháng 9 + Dã ngoại nông trại + Tiền xe bus đón tận nhà',
    totalAmount: '8,200,000 VNĐ',
    dueDate: '05/09/2026',
    status: 'Đã Thanh Toán',
    theme: {
      badgeBg: 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300',
      btnPrimary: 'bg-emerald-600 hover:bg-emerald-700 text-white',
    },
  },
  {
    id: 'INV-2026-0904',
    studentName: 'Vũ Khánh Linh (Bé Miu)',
    className: 'Lớp Nhà Trẻ N1',
    items: 'Học phí Tháng 9 + Phí nhập học đầu năm + Đồng phục mầm non',
    totalAmount: '9,150,000 VNĐ',
    dueDate: '12/09/2026',
    status: 'Đã Thống Kê - Chờ Thu',
    theme: {
      badgeBg: 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300',
      btnPrimary: 'bg-rose-600 hover:bg-rose-700 text-white',
    },
  },
];

export default function FinancePage() {
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
              <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 shrink-0">
                <CircleDollarSign className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                  Quản Lý Học Phí & Tài Chính Mầm Non
                </h1>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Tự động lập phiếu thu học phí, tiền ăn, dã ngoại và đối soát chuyển khoản QR
                </p>
              </div>
            </div>
          </div>

          <button className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-3 text-xs font-bold shadow-lg shadow-emerald-500/20 transition-all active:scale-95 shrink-0">
            <Receipt className="w-4 h-4" />
            <span>Tạo Phiếu Thu Học Phí Mới</span>
          </button>
        </div>

        {/* Financial KPI stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
          <div className="p-4 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-900/60">
            <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">Đã Thu Học Phí Tháng 9</p>
            <p className="text-xl font-extrabold text-gray-900 dark:text-white mt-1">1.840.000.000 VNĐ</p>
          </div>
          <div className="p-4 rounded-2xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-900/60">
            <p className="text-[11px] font-bold text-amber-600 dark:text-amber-400">Còn Phải Thu (Dự Kiến)</p>
            <p className="text-xl font-extrabold text-gray-900 dark:text-white mt-1">260.000.000 VNĐ</p>
          </div>
          <div className="p-4 rounded-2xl bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-900/60">
            <p className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">Chi Phí Bếp & Thực Phẩm</p>
            <p className="text-xl font-extrabold text-gray-900 dark:text-white mt-1">320.000.000 VNĐ</p>
          </div>
          <div className="p-4 rounded-2xl bg-rose-50/80 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-900/60">
            <p className="text-[11px] font-bold text-rose-600 dark:text-rose-400">Tỷ Lệ Thanh Toán Đúng Hạn</p>
            <p className="text-xl font-extrabold text-gray-900 dark:text-white mt-1">92.4%</p>
          </div>
        </div>
      </div>

      {/* Invoices List */}
      <div className="rounded-3xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 p-6 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-700/60 pb-4">
          <h2 className="text-base font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-emerald-500" />
            Danh Sách Phụ Huynh Đóng Học Phí Tháng 9/2026
          </h2>
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-gray-400" />
            <input
              type="text"
              placeholder="Tìm mã hóa đơn, tên bé, tên phụ huynh..."
              className="w-full pl-10 pr-4 py-2 text-xs rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {TUITION_INVOICES.map((inv) => (
            <div key={inv.id} className="p-6 rounded-3xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/50 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-extrabold text-gray-900 dark:text-white">{inv.studentName}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">{inv.className} • Mã HD: <strong className="text-gray-800 dark:text-gray-200">{inv.id}</strong></p>
                </div>
                <span className={`text-[11px] font-extrabold px-3 py-1 rounded-full ${inv.theme.badgeBg}`}>
                  {inv.status}
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 text-xs space-y-1">
                <p className="text-gray-400 font-medium">Chi tiết khoản thu:</p>
                <p className="font-semibold text-gray-800 dark:text-gray-200">{inv.items}</p>
              </div>

              <div className="flex items-center justify-between pt-1">
                <div>
                  <p className="text-[11px] text-gray-400">Tổng Số Tiền:</p>
                  <p className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400">{inv.totalAmount}</p>
                </div>
                <button className={`px-4 py-2.5 rounded-2xl text-xs font-bold shadow-md transition-all ${inv.theme.btnPrimary}`}>
                  Gửi Nhắc Đóng Học Phí QR
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
