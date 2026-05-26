'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  GitCompareArrows,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Calendar,
  ArrowRight,
  HelpCircle,
  TrendingUp,
} from 'lucide-react';
import Link from 'next/link';
import { getReconciliationReport, getAccountingMode, syncLegacyToLedger, type ReconciliationRow } from '@/services/accounting-actions';
import { toast } from 'sonner';
import SkeletonLoader, { SkeletonTable } from '@/components/ui/SkeletonLoader';

const fmtVND = (n: number) =>
  new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(Number(n) || 0);

const STATUS_CONFIG = {
  MATCH: {
    label: 'Khớp',
    color: 'emerald',
    bg: 'bg-emerald-50 dark:bg-emerald-500/10',
    border: 'border-emerald-200 dark:border-emerald-500/30',
    text: 'text-emerald-700 dark:text-emerald-400',
    icon: CheckCircle2,
  },
  MINOR_DIFF: {
    label: 'Lệch nhẹ',
    color: 'amber',
    bg: 'bg-amber-50 dark:bg-amber-500/10',
    border: 'border-amber-200 dark:border-amber-500/30',
    text: 'text-amber-700 dark:text-amber-400',
    icon: AlertTriangle,
  },
  MAJOR_DIFF: {
    label: 'Lệch lớn',
    color: 'rose',
    bg: 'bg-rose-50 dark:bg-rose-500/10',
    border: 'border-rose-200 dark:border-rose-500/30',
    text: 'text-rose-700 dark:text-rose-400',
    icon: XCircle,
  },
};

export default function ReconciliationPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rows, setRows] = useState<ReconciliationRow[]>([]);

  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const [accountingMode, setAccountingMode] = useState<'SIMPLE' | 'PROFESSIONAL'>('SIMPLE');
  const [syncing, setSyncing] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);

  // Khởi tạo ngày tháng an toàn sau khi mount ở Client để tránh Hydration Mismatch về múi giờ
  useEffect(() => {
    const d = new Date();
    d.setDate(1);
    setFromDate(d.toISOString().slice(0, 10));
    setToDate(new Date().toISOString().slice(0, 10));

    // Đọc cấu hình chế độ kế toán
    getAccountingMode()
      .then((mode) => setAccountingMode(mode))
      .catch((err) => console.error('Lỗi khi đọc chế độ kế toán:', err));
  }, []);

  const fetchData = async (fromStr: string, toStr: string) => {
    if (!fromStr || !toStr) return;
    setRefreshing(true);
    try {
      const data = await getReconciliationReport(fromStr, toStr);
      setRows(data || []);
    } catch (err: any) {
      console.error('Error fetching reconciliation:', err);
      toast.error(err?.message || 'Không thể tải báo cáo đối soát.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await syncLegacyToLedger();
      if (res.success) {
        toast.success(`Đồng bộ thành công! Đã hạch toán ${res.syncedRevenueCount} doanh thu, ${res.syncedExpenseCount} chi phí, và ${res.syncedSalaryCount} bảng lương KTV.`);
        setAccountingMode('PROFESSIONAL');
        setShowSyncModal(false);
        if (fromDate && toDate) {
          fetchData(fromDate, toDate);
        }
      }
    } catch (err: any) {
      console.error('Error during migration:', err);
      toast.error(err?.message || 'Có lỗi xảy ra trong quá trình đồng bộ kế toán.');
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    if (fromDate && toDate) {
      fetchData(fromDate, toDate);
    }
  }, [fromDate, toDate]);

  const totalChecks = rows.length;
  const matchCount = rows.filter((r) => r.status === 'MATCH').length;
  const minorDiffCount = rows.filter((r) => r.status === 'MINOR_DIFF').length;
  const majorDiffCount = rows.filter((r) => r.status === 'MAJOR_DIFF').length;
  const matchRate = totalChecks > 0 ? (matchCount / totalChecks) * 100 : 0;
  const biggestDiff = rows.reduce(
    (max, r) => (Math.abs(r.diff_amount) > Math.abs(max.diff_amount) ? r : max),
    rows[0] || { diff_amount: 0, category_label: '—' } as ReconciliationRow
  );

  return (
    <div className="space-y-8 relative">
      {refreshing && (
        <div className="absolute top-0 right-0 flex items-center gap-1.5 text-xs font-semibold text-primary dark:text-[#A67D44] animate-pulse">
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          <span>Đang tính đối soát...</span>
        </div>
      )}

      {/* ── INTRO BANNER ── */}
      <div className="p-6 md:p-8 bg-white dark:bg-[#1C1B19] rounded-[2.5rem] border border-[#FFE4E6] dark:border-[#3E3A35]/50 shadow-sm flex items-start gap-4">
        <div className="w-12 h-12 rounded-2xl bg-pink-50 dark:bg-[#5D1C34]/30 flex items-center justify-center text-primary dark:text-[#A67D44] shrink-0">
          <GitCompareArrows className="w-6 h-6 text-primary" />
        </div>
        <div className="flex-1">
          <h4 className="text-base font-black text-slate-900 dark:text-[#EFE9E1] uppercase tracking-wider">
            Đối soát chéo: Finance cũ ↔ Accounting Ledger
          </h4>
          <p className="text-xs font-medium text-slate-500 dark:text-[#CDBCAB]/70 mt-1 leading-relaxed">
            So sánh sum doanh thu/chi phí giữa
            <strong className="text-slate-700 dark:text-[#EFE9E1]"> nguồn cũ </strong>
            (bảng <code>revenue</code> + <code>expenses</code> + <code>salary_records</code>) với
            <strong className="text-slate-700 dark:text-[#EFE9E1]"> nguồn mới </strong>
            (sổ cái kế toán <code>journal_entries</code> qua Outbox Pattern). Mục đích: chạy
            song song 1 tháng để verify accounting engine ghi đúng, sau khi match 100% thì
            deprecate UI Finance cũ.
          </p>
          <p className="text-2xs text-amber-700 dark:text-amber-400 mt-2 italic">
            ⓘ Lệch &lt; 1 VND = MATCH · Lệch &lt; 1% = MINOR_DIFF · Lệch ≥ 1% = MAJOR_DIFF cần điều tra.
          </p>
        </div>
      </div>

      {/* ── DUAL-MODE ACCOUNTING BANNER ── */}
      {accountingMode === 'SIMPLE' ? (
        <div className="p-6 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 rounded-[2rem] border border-amber-200 dark:border-amber-500/20 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h5 className="text-xs font-black text-amber-800 dark:text-amber-300 uppercase tracking-wider">
                Hệ thống kế toán đang ở chế độ Đơn giản (Legacy Finance)
              </h5>
              <p className="text-3xs font-medium text-amber-700/80 dark:text-amber-400/70 mt-1 max-w-2xl leading-relaxed">
                Bella Spa ERP hiện vận hành song song sổ sách cũ. Để kích hoạt hạch toán kép chuyên nghiệp chuẩn Thông tư 133, vui lòng click nút bên dưới để tự động đồng bộ lịch sử thu/chi/lương vào sổ cái kế toán mới và chuyển đổi chế độ.
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowSyncModal(true)}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 text-white text-3xs font-black uppercase tracking-widest transition-all shadow-md shrink-0 self-start md:self-auto cursor-pointer"
          >
            Đồng bộ & Kích hoạt Kế toán Chuyên nghiệp
          </button>
        </div>
      ) : (
        <div className="px-6 py-4 bg-emerald-50/40 dark:bg-emerald-500/10 rounded-2xl border border-emerald-200 dark:border-emerald-500/30 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 animate-pulse" />
          <span className="text-3xs font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest">
            Đã kích hoạt chế độ Kế toán Chuyên nghiệp (Thông tư 133)
          </span>
        </div>
      )}

      {/* ── FILTER + SUMMARY ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Date filter */}
        <div className="lg:col-span-2 bg-white dark:bg-[#1C1B19] rounded-2xl border border-[#FFE4E6] dark:border-[#3E3A35]/50 p-5 shadow-sm">
          <p className="text-3xs font-black text-slate-400 dark:text-[#CDBCAB]/60 uppercase tracking-widest mb-3">Kỳ đối soát</p>
          <div className="flex items-center gap-2 flex-wrap">
            <Calendar className="w-4 h-4 text-primary dark:text-[#A67D44]" />
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 dark:bg-[#11100F] border border-slate-100 dark:border-[#3E3A35]/50 rounded-xl text-2xs font-bold outline-none text-slate-800 dark:text-[#EFE9E1]"
            />
            <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 dark:bg-[#11100F] border border-slate-100 dark:border-[#3E3A35]/50 rounded-xl text-2xs font-bold outline-none text-slate-800 dark:text-[#EFE9E1]"
            />
          </div>
        </div>

        {/* Match rate */}
        <div className={`rounded-2xl border p-5 ${matchRate === 100 ? 'bg-emerald-50/40 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30' : matchRate >= 66 ? 'bg-amber-50/40 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30' : 'bg-rose-50/40 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/30'}`}>
          <p className="text-3xs font-black uppercase tracking-widest opacity-70 mb-2">Tỷ lệ khớp</p>
          <p className={`text-2xl font-mono font-black ${matchRate === 100 ? 'text-emerald-600 dark:text-emerald-400' : matchRate >= 66 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'}`}>
            {matchRate.toFixed(0)}%
          </p>
          <p className="text-3xs text-slate-500 mt-1">
            {matchCount}/{totalChecks} chỉ tiêu
          </p>
        </div>

        {/* Counts */}
        <div className="bg-white dark:bg-[#1C1B19] rounded-2xl border border-[#FFE4E6] dark:border-[#3E3A35]/50 p-5 shadow-sm">
          <p className="text-3xs font-black text-slate-400 dark:text-[#CDBCAB]/60 uppercase tracking-widest mb-2">Phân loại</p>
          <div className="space-y-1 text-2xs">
            <p className="flex items-center justify-between"><span className="text-emerald-600">✓ Khớp</span><strong className="font-mono">{matchCount}</strong></p>
            <p className="flex items-center justify-between"><span className="text-amber-600">⚠ Lệch nhẹ</span><strong className="font-mono">{minorDiffCount}</strong></p>
            <p className="flex items-center justify-between"><span className="text-rose-600">✕ Lệch lớn</span><strong className="font-mono">{majorDiffCount}</strong></p>
          </div>
        </div>

        {/* Biggest diff */}
        <div className="bg-white dark:bg-[#1C1B19] rounded-2xl border border-[#FFE4E6] dark:border-[#3E3A35]/50 p-5 shadow-sm">
          <p className="text-3xs font-black text-slate-400 dark:text-[#CDBCAB]/60 uppercase tracking-widest mb-2">Lệch lớn nhất</p>
          <p className="text-xs font-bold text-slate-700 dark:text-[#CDBCAB] truncate">{biggestDiff?.category_label || '—'}</p>
          <p className={`text-sm font-mono font-black mt-1 ${Math.abs(biggestDiff?.diff_amount || 0) > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
            {fmtVND(biggestDiff?.diff_amount || 0)}
          </p>
        </div>
      </div>

      {/* ── COMPARISON TABLE ── */}
      <div className="bg-white dark:bg-[#1C1B19] rounded-[2.5rem] border border-[#FFE4E6] dark:border-[#3E3A35]/50 p-6 md:p-8 shadow-sm">
        <h4 className="text-sm font-black text-slate-900 dark:text-[#EFE9E1] uppercase tracking-wider mb-6 flex items-center gap-2">
          <GitCompareArrows className="w-4 h-4 text-primary dark:text-[#A67D44]" />
          Bảng so sánh chi tiết
        </h4>

        {loading ? (
          <SkeletonTable />
        ) : rows.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <HelpCircle className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <p className="text-xs font-bold uppercase tracking-wider">Chưa có dữ liệu đối soát cho kỳ này</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="text-left bg-slate-50 dark:bg-[#11100F]/40 border-b border-slate-200 dark:border-[#3E3A35]/40">
                  <th className="px-4 py-4 text-3xs font-black text-slate-400 dark:text-[#CDBCAB]/60 uppercase tracking-widest">Chỉ tiêu</th>
                  <th className="px-4 py-4 text-3xs font-black text-blue-500 dark:text-blue-400 uppercase tracking-widest text-right">Nguồn cũ (Legacy)</th>
                  <th className="px-4 py-4 text-3xs font-black text-pink-500 dark:text-pink-400 uppercase tracking-widest text-right">Nguồn mới (Ledger)</th>
                  <th className="px-4 py-4 text-3xs font-black text-slate-400 dark:text-[#CDBCAB]/60 uppercase tracking-widest text-right">Chênh lệch</th>
                  <th className="px-4 py-4 text-3xs font-black text-slate-400 dark:text-[#CDBCAB]/60 uppercase tracking-widest text-right">% lệch</th>
                  <th className="px-4 py-4 text-3xs font-black text-slate-400 dark:text-[#CDBCAB]/60 uppercase tracking-widest text-center">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#3E3A35]/20 font-sans text-xs">
                {rows.map((row, idx) => {
                  // Chuẩn hóa status và fallback an toàn tránh crash render
                  const statusKey = (row.status || '').toUpperCase() as keyof typeof STATUS_CONFIG;
                  const cfg = STATUS_CONFIG[statusKey] || STATUS_CONFIG.MAJOR_DIFF;
                  const StatusIcon = cfg?.icon || XCircle;

                  return (
                    <motion.tr
                      key={row.category}
                      whileHover={{ backgroundColor: 'rgba(244,63,94,0.02)' }}
                      className="transition-colors"
                    >
                      <td className="px-4 py-4 font-bold text-slate-900 dark:text-[#EFE9E1]">
                        {row.category_label}
                        <p className="text-3xs text-slate-400 font-mono mt-0.5">{row.category}</p>
                      </td>
                      <td className="px-4 py-4 text-right font-mono font-bold text-blue-700 dark:text-blue-300">
                        {fmtVND(row.legacy_amount)}
                      </td>
                      <td className="px-4 py-4 text-right font-mono font-bold text-pink-700 dark:text-pink-300">
                        {fmtVND(row.ledger_amount)}
                      </td>
                      <td className={`px-4 py-4 text-right font-mono font-black ${Math.abs(Number(row.diff_amount)) < 1 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                        {Number(row.diff_amount) > 0 ? '+' : ''}{fmtVND(row.diff_amount)}
                      </td>
                      <td className={`px-4 py-4 text-right font-mono font-bold ${Number(row.diff_percent) === 0 ? 'text-emerald-500' : Number(row.diff_percent) < 1 ? 'text-amber-500' : 'text-rose-500'}`}>
                        {Number(row.diff_percent).toFixed(2)}%
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-4xs font-black uppercase tracking-wider border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                          <StatusIcon className="w-3 h-3" />
                          {cfg.label}
                        </span>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Action links ── */}
        {majorDiffCount > 0 && (
          <div className="mt-6 p-4 rounded-2xl bg-amber-50/60 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1 text-xs text-amber-800 dark:text-amber-200">
              <p className="font-bold mb-2">Phát hiện {majorDiffCount} chỉ tiêu lệch lớn (≥1%). Để điều tra:</p>
              <div className="flex flex-wrap gap-2 mt-2">
                <Link
                  href="/dashboard/accounting/journals"
                  className="px-3 py-1.5 rounded-lg bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 text-3xs font-black uppercase tracking-widest hover:bg-amber-200 transition-colors"
                >
                  → Xem Journal Ledger
                </Link>
                <Link
                  href="/dashboard/finance"
                  className="px-3 py-1.5 rounded-lg bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 text-3xs font-black uppercase tracking-widest hover:bg-amber-200 transition-colors"
                >
                  → Xem Finance UI cũ
                </Link>
                <Link
                  href="/dashboard/accounting/outbox?status=DEAD"
                  className="px-3 py-1.5 rounded-lg bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 text-3xs font-black uppercase tracking-widest hover:bg-amber-200 transition-colors"
                >
                  → Outbox DEAD events
                </Link>
              </div>
              <p className="text-3xs mt-3 italic">
                Nguyên nhân thường gặp: outbox event chưa được worker xử lý / journal entry bị CANCELED không-đúng / thiếu COA account cho category mới.
              </p>
            </div>
          </div>
        )}

        {matchRate === 100 && totalChecks > 0 && (
          <div className="mt-6 p-4 rounded-2xl bg-emerald-50/60 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <p className="text-xs text-emerald-800 dark:text-emerald-200">
              <strong>Khớp 100% trong kỳ này.</strong> Khi duy trì 100% trong 30 ngày liên tiếp,
              có thể deprecate UI Finance cũ và switch hoàn toàn sang Accounting Ledger.
            </p>
          </div>
        )}
      </div>

      {/* ── SYNC & MIGRATION MODAL ── */}
      {showSyncModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#1C1B19] rounded-[2rem] border border-[#FFE4E6] dark:border-[#3E3A35]/50 shadow-2xl p-6 md:p-8 max-w-md w-full relative z-50 animate-in zoom-in-95 duration-200">
            <h4 className="text-sm font-black text-slate-900 dark:text-[#EFE9E1] uppercase tracking-wider mb-4 flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-primary" />
              Kích hoạt Kế toán Chuyên nghiệp
            </h4>
            <div className="space-y-3 text-2xs text-slate-600 dark:text-[#CDBCAB]/80 leading-relaxed font-medium">
              <p>
                Hệ thống sẽ thực hiện các thao tác tự động sau:
              </p>
              <ul className="list-disc pl-4 space-y-1.5">
                <li>Quét toàn bộ dữ liệu lịch sử các khoản thu, chi và bảng lương KTV đã xác nhận.</li>
                <li>Tự động tạo các bút toán kép hạch toán thẳng vào Sổ Nhật Ký Chung của Sổ Cái mới.</li>
                <li>Kích hoạt chế độ <strong>Kế toán Chuyên nghiệp (Thông tư 133)</strong> cho chi nhánh này.</li>
                <li className="text-amber-600 dark:text-amber-400 font-bold">Khóa đóng băng các màn hình Legacy Finance cũ để ngăn chặn việc nhập liệu trùng lặp.</li>
              </ul>
              <p className="text-3xs italic text-slate-400 mt-2">
                ⓘ Quá trình này được chạy an toàn (Idempotent) nên không lo bị trùng lặp bút toán nếu đồng bộ lại.
              </p>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                disabled={syncing}
                onClick={() => setShowSyncModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-[#11100F] border border-slate-200 dark:border-[#3E3A35]/50 hover:bg-slate-200 text-slate-700 dark:text-[#CDBCAB] text-3xs font-black uppercase tracking-widest transition-colors cursor-pointer"
              >
                Hủy
              </button>
              <button
                disabled={syncing}
                onClick={handleSync}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 disabled:from-slate-400 disabled:to-slate-400 text-white text-3xs font-black uppercase tracking-widest transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
              >
                {syncing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Đang đồng bộ...
                  </>
                ) : (
                  'Bắt đầu đồng bộ'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
