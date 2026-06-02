'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DollarSign, TrendingUp, Calendar as CalendarIcon,
  ChevronLeft, ChevronRight, RefreshCw, Award, Star,
  Clock, CheckCircle2, AlertCircle, Send, X
} from 'lucide-react';
import { getKTVEarnings, getKTVLeaderboard } from '@/services/ktv-actions';
import { getKtvSalaryForConfirmation, ktvConfirmSalary, ktvDisputeSalary } from '@/modules/hr-salary/actions/base-salary-actions';
import { createClient } from '@/lib/supabase-client';
import { formatCurrency, getLocalDateString } from '@/lib/utils';
import { toast } from 'sonner';
import Link from 'next/link';
import type { Database } from '@/types/database.types';

type KTVEarnings = Awaited<ReturnType<typeof getKTVEarnings>>;
type KTVLeaderboardEntry = Awaited<ReturnType<typeof getKTVLeaderboard>>[number];
type KtvSalaryData = NonNullable<Awaited<ReturnType<typeof getKtvSalaryForConfirmation>>>;
type SessionLogRow = Database['public']['Tables']['session_logs']['Row'];
type EarningsSessionDetail = Pick<
  SessionLogRow,
  'id' | 'completed_date' | 'session_number' | 'completed_by_ktv_id'
> & {
  bookings: {
    package_name: string | null;
    ktv_commission: number | null;
    assigned_ktv_id: string | null;
    customers: {
      name_mother: string | null;
    } | null;
  } | null;
};

type PackageSummary = {
  name: string;
  count: number;
  totalCommission: number;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getCountdown(publishedAt: string): string {
  const deadline = new Date(new Date(publishedAt).getTime() + 48 * 60 * 60 * 1000);
  const diff = deadline.getTime() - Date.now();
  if (diff <= 0) return 'Đã quá hạn (đang xử lý)';
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return `còn ${h}h ${m}m`;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    published:        { label: 'Chờ xác nhận', cls: 'bg-amber-50 text-amber-600 border-amber-200' },
    confirmed:        { label: 'Đã xác nhận',  cls: 'bg-blue-50 text-blue-600 border-blue-200' },
    disputed:         { label: 'Đã phản hồi',  cls: 'bg-rose-50 text-rose-600 border-rose-200' },
    finalized:        { label: 'Đã chốt sổ',   cls: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
    approved:         { label: 'Đã duyệt',      cls: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
    pending_approval: { label: 'Chờ duyệt',     cls: 'bg-amber-50 text-amber-600 border-amber-200' },
  };
  const s = map[status] ?? { label: 'Bản nháp', cls: 'bg-slate-50 text-slate-500 border-slate-200' };
  return (
    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${s.cls}`}>
      {s.label}
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function KTVEarningsPage() {
  const [earnings, setEarnings] = useState<KTVEarnings | null>(null);
  const [details, setDetails] = useState<EarningsSessionDetail[]>([]);
  const [leaderboardData, setLeaderboardData] = useState<KTVLeaderboardEntry | null>(null);
  const [salaryData, setSalaryData] = useState<KtvSalaryData | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [isLoading, setIsLoading] = useState(true);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showDisputeForm, setShowDisputeForm] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [countdown, setCountdown] = useState('');

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const earn = await getKTVEarnings(selectedMonth);
      setEarnings(earn);

      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const startOfMonth = `${selectedMonth}-01`;
        const nextMonth = getLocalDateString(new Date(new Date(startOfMonth).setMonth(new Date(startOfMonth).getMonth() + 1)));

        const { data: sessions } = await supabase
          .from('session_logs')
          .select(`id, completed_date, session_number, completed_by_ktv_id, bookings(package_name, ktv_commission, assigned_ktv_id, customers(name_mother))`)
          .eq('completed_by_ktv_id', user.id)
          .eq('status', 'completed')
          .gte('completed_date', startOfMonth)
          .lt('completed_date', nextMonth)
          .order('completed_date', { ascending: false });
        setDetails((sessions || []) as unknown as EarningsSessionDetail[]);

        const lb = await getKTVLeaderboard(selectedMonth);
        const myStats = lb.find((k) => k.ktv_id === user.id) || null;
        setLeaderboardData(myStats);

        const salary = await getKtvSalaryForConfirmation(`${selectedMonth}-01`);
        setSalaryData(salary);
      }
    } catch {
      toast.error('Lỗi khi tải dữ liệu thu nhập');
    } finally {
      setIsLoading(false);
    }
  }, [selectedMonth]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Countdown timer
  useEffect(() => {
    const publishedAt = salaryData?.record?.published_at;
    if (!publishedAt) return;
    const timer = setInterval(() => setCountdown(getCountdown(publishedAt)), 30000);
    setCountdown(getCountdown(publishedAt));
    return () => clearInterval(timer);
  }, [salaryData?.record?.published_at]);

  const changeMonth = (delta: number) => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const date = new Date(y, m - 1 + delta, 1);
    setSelectedMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
  };

  const handleConfirm = async () => {
    if (!salaryData?.record?.id) return;
    setIsSubmitting(true);
    const res = await ktvConfirmSalary(salaryData.record.id);
    if (res.success) {
      toast.success('Đã xác nhận bảng lương! Cảm ơn bạn.');
      setShowConfirmModal(false);
      await fetchData();
    } else {
      toast.error('Lỗi: ' + res.error);
    }
    setIsSubmitting(false);
  };

  const handleDispute = async () => {
    if (!salaryData?.record?.id || !disputeReason.trim()) {
      toast.error('Vui lòng nhập lý do phản hồi');
      return;
    }
    setIsSubmitting(true);
    const res = await ktvDisputeSalary(salaryData.record.id, disputeReason.trim());
    if (res.success) {
      toast.success('Đã gửi phản hồi đến Admin. Chờ Admin xem xét và điều chỉnh.');
      setShowDisputeForm(false);
      setDisputeReason('');
      await fetchData();
    } else {
      toast.error('Lỗi: ' + res.error);
    }
    setIsSubmitting(false);
  };

  const rec = salaryData?.record ?? null;
  const recStatus = rec?.status ?? 'draft';
  const pendingSalary = Boolean(rec && ['published', 'pending_approval'].includes(recStatus));
  const disputedSalary = recStatus === 'disputed';
  const confirmedSalary = Boolean(rec && ['confirmed', 'finalized', 'approved'].includes(recStatus));

  const packageSummary = details.reduce<PackageSummary[]>((acc, session) => {
    const packageName = session.bookings?.package_name || 'Dịch vụ khác / Khác';
    const commission = session.bookings?.ktv_commission || 0;
    
    const existing = acc.find(item => item.name === packageName);
    if (existing) {
      existing.count += 1;
      existing.totalCommission += commission;
    } else {
      acc.push({
        name: packageName,
        count: 1,
        totalCommission: commission
      });
    }
    return acc;
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 pb-24">

      {/* ── CONFIRMATION BANNER ─────────────────────────────────────────── */}
      <AnimatePresence>
        {(pendingSalary || disputedSalary || confirmedSalary) && rec && (
          <motion.div
            initial={{ y: -80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -80, opacity: 0 }}
            className={`w-full px-4 pt-12 pb-4 ${
              confirmedSalary ? 'bg-emerald-500' :
              disputedSalary  ? 'bg-rose-500' : 'bg-amber-500'
            }`}
          >
            <div className="max-w-lg mx-auto">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  {confirmedSalary
                    ? <CheckCircle2 className="w-6 h-6 text-white flex-shrink-0" />
                    : disputedSalary
                    ? <AlertCircle className="w-6 h-6 text-white flex-shrink-0" />
                    : <Clock className="w-6 h-6 text-white flex-shrink-0" />}
                  <div>
                    <p className="text-white font-black text-sm">
                      {confirmedSalary ? 'Bảng lương đã được xác nhận' :
                       disputedSalary  ? 'Đã gửi phản hồi — Chờ Admin xử lý' :
                       `Bảng lương tháng ${selectedMonth.split('-')[1]}/${selectedMonth.split('-')[0]} chờ xác nhận`}
                    </p>
                    {pendingSalary && (
                      <p className="text-white/80 text-[11px] font-medium mt-0.5">
                        Tự động xác nhận sau 48h — {countdown}
                      </p>
                    )}
                    {disputedSalary && rec.dispute_reason && (
                      <p className="text-white/80 text-[11px] font-medium mt-0.5 line-clamp-1">
                        Lý do: {rec.dispute_reason}
                      </p>
                    )}
                  </div>
                </div>
                {pendingSalary && (
                  <button
                    onClick={() => setShowConfirmModal(true)}
                    className="flex-shrink-0 bg-white text-amber-600 font-black text-[11px] uppercase tracking-widest px-4 py-2 rounded-xl hover:bg-amber-50 transition-colors"
                  >
                    Xem & Xác nhận
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <div className={`bg-slate-900 text-white px-6 ${pendingSalary || disputedSalary || confirmedSalary ? 'pt-6' : 'pt-12'} pb-20 rounded-b-[40px] relative overflow-hidden`}>
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 rounded-full blur-3xl -mr-32 -mt-32" />
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-8">
            <Link href="/ktv/dashboard" className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center backdrop-blur-md">
              <ChevronLeft className="w-6 h-6" />
            </Link>
            <div className="text-sm font-black uppercase tracking-[0.2em] text-white">Thu nhập & Thưởng</div>
            <button onClick={fetchData} className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center backdrop-blur-md">
              <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <div className="flex items-center justify-center gap-4 mb-6">
            <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
              <ChevronLeft className="w-5 h-5 opacity-40" />
            </button>
            <div className="bg-white/10 px-6 py-2 rounded-full backdrop-blur-md border border-white/10">
              <span className="text-sm font-black uppercase tracking-widest">
                Tháng {selectedMonth.split('-')[1]} / {selectedMonth.split('-')[0]}
              </span>
            </div>
            <button onClick={() => changeMonth(1)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
              <ChevronRight className="w-5 h-5 opacity-40" />
            </button>
          </div>
          <div className="text-center">
            <p className="text-white/40 text-[10px] font-black uppercase tracking-widest mb-2">Tổng hoa hồng nhận</p>
            <div className="text-5xl font-black text-white mb-2">{formatCurrency(earnings?.total || 0)}</div>
            <div className="inline-flex items-center gap-2 bg-emerald-500/20 text-emerald-400 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-500/30">
              <TrendingUp className="w-3.5 h-3.5" />
              +{earnings?.sessions || 0} ca hoàn thành
            </div>
          </div>
        </div>
      </div>

      {/* ── CONTENT ────────────────────────────────────────────────────────── */}
      <div className="px-6 -mt-10 relative z-20 space-y-6">

        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white p-5 rounded-[32px] shadow-sm border border-slate-100">
            <div className="w-10 h-10 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center mb-3">
              <Award className="w-5 h-5" />
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Thưởng KPI</p>
            <p className="text-lg font-black text-slate-900">{formatCurrency(leaderboardData?.total_kpi_bonus || 0)}</p>
          </div>
          <div className="bg-white p-5 rounded-[32px] shadow-sm border border-slate-100">
            <div className="w-10 h-10 bg-amber-50 text-amber-500 rounded-2xl flex items-center justify-center mb-3">
              <Star className="w-5 h-5" />
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Đánh giá TB</p>
            <p className="text-lg font-black text-slate-900">{Number(leaderboardData?.average_rating || 0).toFixed(1)} ⭐</p>
          </div>
        </div>

        {/* Salary status card (when record exists) */}
        {rec && (
          <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Bảng lương kỳ này</h3>
              <StatusBadge status={recStatus} />
            </div>
            <div className="space-y-2 text-sm">
              {[
                { label: 'Lương cứng',         value: rec.base_salary, color: 'text-slate-700' },
                { label: 'Hoa hồng ca làm',    value: rec.session_bonus, color: 'text-emerald-600', prefix: '+' },
                { label: 'Thưởng chất lượng',  value: rec.rating_bonus, color: 'text-amber-600', prefix: '+' },
                { label: 'Thưởng KPI',         value: rec.kpi_bonus, color: 'text-primary', prefix: '+' },
                { label: 'Phạt',               value: rec.violations_deduction, color: 'text-rose-500', prefix: '-' },
                { label: 'Tạm ứng',            value: rec.service_percentage_bonus, color: 'text-rose-500', prefix: '-' },
              ].map(({ label, value, color, prefix }) => (
                <div key={label} className="flex justify-between items-center py-1.5 border-b border-slate-50 last:border-0">
                  <span className="text-slate-500 font-medium">{label}</span>
                  <span className={`font-black ${color}`}>{prefix || ''}{formatCurrency(value || 0)}</span>
                </div>
              ))}
              {rec.notes && (
                <p className="text-[10px] text-amber-600 bg-amber-50 rounded-xl px-3 py-2 mt-2">{rec.notes}</p>
              )}
            </div>
            <div className="mt-4 pt-4 border-t-2 border-slate-100 flex justify-between items-center">
              <span className="font-black text-slate-400 uppercase text-[10px] tracking-widest">Tổng nhận</span>
              <span className="text-2xl font-black text-slate-900">{formatCurrency(rec.total_salary || 0)}</span>
            </div>

            {/* Action buttons */}
            {pendingSalary && (
              <div className="mt-4 flex gap-3">
                <button
                  onClick={() => setShowDisputeForm(true)}
                  className="flex-1 py-3 bg-rose-50 text-rose-600 font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-rose-100 transition-colors"
                >
                  Phản hồi sai sót
                </button>
                <button
                  onClick={() => setShowConfirmModal(true)}
                  className="flex-1 py-3 bg-emerald-500 text-white font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-emerald-600 transition-colors"
                >
                  Xác nhận chính xác
                </button>
              </div>
            )}
          </div>
        )}

        {/* Package Reconciliation Summary */}
        <section className="bg-white rounded-[32px] border border-slate-100 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Đối soát theo gói dịch vụ</h3>
            <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2.5 py-1 rounded-full border border-slate-100">
              {packageSummary.length} gói
            </span>
          </div>
          
          {packageSummary.length === 0 ? (
            <p className="text-slate-400 text-xs text-center py-4">Chưa ghi nhận ca làm việc nào trong tháng này</p>
          ) : (
            <div className="grid grid-cols-1 gap-2.5">
              {packageSummary.map((pkg) => (
                <div key={pkg.name} className="bg-slate-50/50 rounded-2xl p-4 border border-slate-100/80 flex items-center justify-between hover:border-primary/20 transition-all active:scale-[0.98]">
                  <div className="space-y-1">
                    <p className="text-xs font-black text-slate-800 line-clamp-1">{pkg.name}</p>
                    <div className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-600 px-2.5 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider border border-emerald-100">
                      {pkg.count} ca thực tế
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-black text-emerald-600">+{formatCurrency(pkg.totalCommission)}</p>
                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Tạm tính</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Session list */}
        <section>
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 px-2">Lịch sử ca làm việc</h3>
          {details.length === 0 ? (
            <div className="bg-white p-12 rounded-[40px] text-center border border-slate-100 shadow-sm">
              <p className="text-slate-400 text-sm">Chưa có dữ liệu cho tháng này</p>
            </div>
          ) : (
            <div className="space-y-3">
              {details.map((session) => {
                const isReassigned = session.completed_by_ktv_id && session.bookings && session.completed_by_ktv_id !== session.bookings.assigned_ktv_id;
                const completedDate = session.completed_date ? new Date(session.completed_date) : null;
                return (
                  <div key={session.id} className="bg-white p-4 rounded-3xl border border-slate-100 flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-slate-50 rounded-2xl flex flex-col items-center justify-center text-slate-400 border border-slate-100">
                        <span className="text-[10px] font-black">{completedDate ? completedDate.getDate() : '--'}</span>
                        <span className="text-[8px] font-black uppercase">{completedDate ? `Th${completedDate.getMonth() + 1}` : '--'}</span>
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-slate-900">{session.bookings?.customers?.name_mother}</h4>
                        <p className="text-[10px] text-slate-400 font-medium flex items-center gap-1.5">
                          {session.bookings?.package_name} • Buổi {session.session_number}
                          {isReassigned && (
                            <span className="bg-amber-100 text-amber-800 border border-amber-200 text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider flex items-center gap-0.5 leading-none">
                              🔄 Làm thay
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-emerald-500">+{formatCurrency(session.bookings?.ktv_commission || 0)}</p>
                      <p className="text-[8px] font-black text-slate-300 uppercase">Hoa hồng</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* ── CONFIRM MODAL ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showConfirmModal && rec && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 backdrop-blur-sm"
            onClick={(e) => e.target === e.currentTarget && setShowConfirmModal(false)}
          >
            <motion.div
              initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }}
              className="bg-white w-full max-w-lg rounded-t-[40px] p-8 pb-12"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-black text-slate-900">Xác nhận bảng lương</h2>
                <button onClick={() => setShowConfirmModal(false)} className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center">
                  <X className="w-4 h-4 text-slate-500" />
                </button>
              </div>
              <p className="text-slate-500 text-sm mb-6">
                Bạn xác nhận số liệu bảng lương tháng <strong>{selectedMonth.split('-')[1]}/{selectedMonth.split('-')[0]}</strong> là chính xác. Sau khi xác nhận, Admin sẽ tiến hành chốt sổ.
              </p>
              <div className="bg-emerald-50 rounded-2xl p-4 mb-6 text-center">
                <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">Tổng nhận</p>
                <p className="text-3xl font-black text-emerald-700">{formatCurrency(rec.total_salary || 0)}</p>
                <p className="text-[10px] text-emerald-500 mt-1">{rec.total_sessions || 0} buổi làm việc</p>
              </div>
              {!showDisputeForm && (
                <div className="flex gap-3">
                  <button
                    onClick={() => { setShowConfirmModal(false); setShowDisputeForm(true); }}
                    className="flex-1 py-4 bg-rose-50 text-rose-600 font-black text-xs uppercase tracking-widest rounded-2xl"
                  >
                    Có sai sót
                  </button>
                  <button
                    onClick={handleConfirm}
                    disabled={isSubmitting}
                    className="flex-1 py-4 bg-emerald-500 text-white font-black text-xs uppercase tracking-widest rounded-2xl disabled:opacity-60"
                  >
                    {isSubmitting ? 'Đang gửi...' : 'Xác nhận chính xác'}
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── DISPUTE FORM MODAL ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {showDisputeForm && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 backdrop-blur-sm"
            onClick={(e) => e.target === e.currentTarget && setShowDisputeForm(false)}
          >
            <motion.div
              initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }}
              className="bg-white w-full max-w-lg rounded-t-[40px] p-8 pb-12"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-black text-slate-900">Phản hồi sai sót</h2>
                <button onClick={() => setShowDisputeForm(false)} className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center">
                  <X className="w-4 h-4 text-slate-500" />
                </button>
              </div>
              <p className="text-slate-500 text-sm mb-4">
                Mô tả cụ thể sai sót bạn phát hiện. Admin sẽ xem xét và gửi lại bảng lương đã điều chỉnh.
              </p>
              <textarea
                value={disputeReason}
                onChange={(e) => setDisputeReason(e.target.value)}
                placeholder="VD: Thiếu 2 buổi gội đầu ngày 15 và 16/5 cho KH Nguyễn Thị A..."
                rows={4}
                className="w-full bg-slate-50 rounded-2xl px-4 py-3 text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-rose-200 resize-none mb-4"
              />
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDisputeForm(false)}
                  className="flex-1 py-4 bg-slate-100 text-slate-500 font-black text-xs uppercase tracking-widest rounded-2xl"
                >
                  Hủy
                </button>
                <button
                  onClick={handleDispute}
                  disabled={isSubmitting || !disputeReason.trim()}
                  className="flex-1 py-4 bg-rose-500 text-white font-black text-xs uppercase tracking-widest rounded-2xl disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  {isSubmitting ? 'Đang gửi...' : 'Gửi phản hồi'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── BOTTOM NAV ─────────────────────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-slate-100 px-8 py-4 flex justify-between items-center z-40">
        <Link href="/ktv/dashboard" className="text-slate-300 hover:text-primary flex flex-col items-center gap-1 transition-colors">
          <Clock className="w-6 h-6" />
          <span className="text-[10px] font-black uppercase">Lịch ca</span>
        </Link>
        <Link href="/ktv/earnings" className="text-primary flex flex-col items-center gap-1">
          <DollarSign className="w-6 h-6" />
          <span className="text-[10px] font-black uppercase">Thu nhập</span>
        </Link>
        <Link href="/ktv/leaderboard" className="text-slate-300 hover:text-primary flex flex-col items-center gap-1 transition-colors">
          <CalendarIcon className="w-6 h-6" />
          <span className="text-[10px] font-black uppercase">Cá nhân</span>
        </Link>
      </div>
    </div>
  );
}
