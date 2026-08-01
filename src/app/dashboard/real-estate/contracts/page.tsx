"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText, CheckCircle2, Clock, XCircle, AlertTriangle,
  ChevronDown, ChevronRight, Plus, RefreshCw, ArrowRight,
  Banknote, User, Building2, Calendar, Search, Filter,
  CheckCheck, BadgeCheck, TrendingUp
} from "lucide-react";
import { toast } from "sonner";
import {
  fetchContractsAction,
  signContractAction,
  recordMilestonePaymentAction,
  type ContractRecord,
  type PaymentMilestone,
} from "@/modules/real_estate/actions/contractActions";

function fmt(n: number) {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)} tỷ`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(0)} triệu`;
  return n.toLocaleString("vi-VN") + " đ";
}

const STATUS_CONFIG = {
  draft: { label: "Bản Thảo", icon: Clock, color: "bg-slate-100 text-slate-700 dark:bg-slate-800/60 dark:text-slate-300", dot: "bg-slate-400" },
  active: { label: "Đang Hiệu Lực", icon: CheckCircle2, color: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300", dot: "bg-blue-500" },
  completed: { label: "Hoàn Tất", icon: BadgeCheck, color: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300", dot: "bg-emerald-500" },
  terminated: { label: "Đã Hủy", icon: XCircle, color: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300", dot: "bg-rose-500" },
  signed: { label: "Đã Ký", icon: CheckCheck, color: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300", dot: "bg-emerald-500" },
  cancelled: { label: "Đã Hủy", icon: XCircle, color: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300", dot: "bg-rose-500" },
};

function StatusBadge({ status }: { status: ContractRecord["status"] }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${cfg.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function MilestoneRow({
  milestone,
  contractId,
  onPay,
}: {
  milestone: PaymentMilestone;
  contractId: string;
  onPay: (cid: string, mid: string) => void;
}) {
  const isPaid = milestone.status === "paid";
  const isOverdue = milestone.status === "overdue";
  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
      isPaid
        ? "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200/50 dark:border-emerald-800/30"
        : isOverdue
        ? "bg-rose-50/50 dark:bg-rose-950/20 border-rose-200/50 dark:border-rose-800/30"
        : "bg-slate-50/50 dark:bg-slate-800/20 border-slate-200/50 dark:border-slate-700/30"
    }`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
        isPaid ? "bg-emerald-100 dark:bg-emerald-900/50" : isOverdue ? "bg-rose-100 dark:bg-rose-900/50" : "bg-slate-100 dark:bg-slate-700/50"
      }`}>
        {isPaid ? (
          <CheckCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
        ) : isOverdue ? (
          <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
        ) : (
          <Clock className="w-4 h-4 text-slate-500 dark:text-slate-400" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <p className="text-sm font-bold text-slate-900 dark:text-white">{milestone.label}</p>
          <span className="text-xs text-slate-500 dark:text-slate-400">({milestone.percentage}%)</span>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">{milestone.dueDateLabel}</p>
        {isPaid && milestone.paidDate && (
          <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">Đã thu: {milestone.paidDate}</p>
        )}
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-black text-slate-900 dark:text-white">{fmt(milestone.amountVnd)}</p>
        {!isPaid && (
          <button
            onClick={() => onPay(contractId, milestone.id)}
            className="mt-1 px-2.5 py-1 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-black rounded-lg transition-all"
          >
            Ghi Thu
          </button>
        )}
      </div>
    </div>
  );
}

function ContractCard({
  contract,
  onSign,
  onPay,
}: {
  contract: ContractRecord;
  onSign: (id: string) => void;
  onPay: (cid: string, mid: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const paidTotal = contract.milestones.filter(m => m.status === "paid").reduce((s, m) => s + m.amountVnd, 0);
  const paidPct = Math.round((paidTotal / contract.finalValueVnd) * 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"
    >
      {/* Card Header */}
      <div className="p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200/50 dark:border-amber-700/30 flex items-center justify-center shrink-0">
              <FileText className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-black text-slate-900 dark:text-white">{contract.contractNo}</h3>
                <StatusBadge status={contract.status} />
              </div>
              <div className="flex items-center gap-4 mt-1 text-sm text-slate-500 dark:text-slate-400 flex-wrap">
                <span className="flex items-center gap-1"><User className="w-3.5 h-3.5" />{contract.customerName}</span>
                <span className="flex items-center gap-1"><Building2 className="w-3.5 h-3.5" />{contract.unitCode}</span>
                <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{contract.createdAt}</span>
              </div>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-2xl font-black text-slate-900 dark:text-white">{fmt(contract.finalValueVnd)}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Giá gốc: {fmt(contract.totalValueVnd)} + VAT {contract.vatRate}% + KPBT {contract.maintenanceFee}%
            </p>
          </div>
        </div>

        {/* Payment Progress */}
        <div className="mt-4 space-y-1.5">
          <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
            <span className="font-semibold">Tiến độ thu tiền</span>
            <span className="font-black text-slate-900 dark:text-white">{paidPct}% — {fmt(paidTotal)}</span>
          </div>
          <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${paidPct}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className={`h-full rounded-full ${paidPct === 100 ? "bg-emerald-500" : "bg-amber-500"}`}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="mt-4 flex items-center justify-between">
          <div className="flex gap-2">
            {contract.status === "draft" && (
              <button
                onClick={() => onSign(contract.id)}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all"
              >
                <CheckCheck className="w-4 h-4" />
                Ký Hợp Đồng
              </button>
            )}
            <span className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
              <User className="w-3.5 h-3.5" />Sale: {contract.saleName}
            </span>
          </div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 font-bold hover:text-amber-700 dark:hover:text-amber-300 transition-colors"
          >
            {expanded ? "Ẩn lịch thanh toán" : "Xem lịch thanh toán"}
            {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Expanded Milestones */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="border-t border-slate-100 dark:border-slate-800 overflow-hidden"
          >
            <div className="p-5 space-y-2">
              <h4 className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3">
                Lịch Thanh Toán Tiến Độ
              </h4>
              {contract.milestones.map(ms => (
                <MilestoneRow
                  key={ms.id}
                  milestone={ms}
                  contractId={contract.id}
                  onPay={onPay}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function RealEstateContractsPage() {
  const [contracts, setContracts] = useState<ContractRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetchContractsAction();
    if (res.success && res.data) setContracts(res.data);
    else toast.error(res.error ?? "Không thể tải dữ liệu hợp đồng");
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSign(contractId: string) {
    const res = await signContractAction(contractId);
    if (res.success) {
      toast.success("✅ Ký hợp đồng thành công!");
      await load();
    } else {
      toast.error(res.error ?? "Ký hợp đồng thất bại");
    }
  }

  async function handlePay(contractId: string, milestoneId: string) {
    const res = await recordMilestonePaymentAction(contractId, milestoneId);
    if (res.success) {
      toast.success("💰 Ghi nhận thanh toán thành công!");
      await load();
    } else {
      toast.error(res.error ?? "Ghi nhận thất bại");
    }
  }

  const filtered = contracts.filter(c => {
    const matchSearch =
      !search ||
      c.contractNo.toLowerCase().includes(search.toLowerCase()) ||
      c.customerName.toLowerCase().includes(search.toLowerCase()) ||
      c.unitCode.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "all" || c.status === filterStatus;
    return matchSearch && matchStatus;
  });

  // Summary stats
  const totalValue = contracts.reduce((s, c) => s + c.finalValueVnd, 0);
  const paidValue = contracts.reduce(
    (s, c) => s + c.milestones.filter(m => m.status === "paid").reduce((ms, m) => ms + m.amountVnd, 0),
    0
  );
  const activeCount = contracts.filter(c => c.status === "active").length;
  const completedCount = contracts.filter(c => c.status === "completed").length;

  return (
    <div className="space-y-8">
      {/* ─ Header ─ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <FileText className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            </div>
            Hợp Đồng & Đặt Cọc
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Quản lý HĐMB, lịch thanh toán tiến độ và công nợ khách hàng
          </p>
        </div>
        <button className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-black px-4 py-2.5 rounded-xl font-bold text-sm transition-all shadow-sm">
          <Plus className="w-4 h-4" />
          Lập Hợp Đồng Mới
        </button>
      </div>

      {/* ─ KPI Row ─ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: FileText, label: "Tổng Hợp Đồng", value: String(contracts.length), color: "blue" },
          { icon: CheckCircle2, label: "Đang Hiệu Lực", value: String(activeCount), color: "amber" },
          { icon: BadgeCheck, label: "Hoàn Tất", value: String(completedCount), color: "green" },
          { icon: TrendingUp, label: "Đã Thu / Tổng Giá Trị", value: `${fmt(paidValue)} / ${fmt(totalValue)}`, color: "purple" },
        ].map(kpi => (
          <div key={kpi.label} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1">{kpi.label}</p>
            <p className="text-xl font-black text-slate-900 dark:text-white">{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* ─ Filters ─ */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            placeholder="Tìm số HĐ, khách hàng, mã căn..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-amber-500/50"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          {["all", "draft", "active", "completed", "terminated"].map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                filterStatus === s
                  ? "bg-amber-500 text-black"
                  : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-amber-300"
              }`}
            >
              {s === "all" ? "Tất cả" : STATUS_CONFIG[s as keyof typeof STATUS_CONFIG]?.label ?? s}
            </button>
          ))}
        </div>
      </div>

      {/* ─ Contract List ─ */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <RefreshCw className="w-8 h-8 animate-spin text-amber-500" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400 dark:text-slate-500">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p className="font-semibold">Không có hợp đồng nào phù hợp</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(contract => (
            <ContractCard
              key={contract.id}
              contract={contract}
              onSign={handleSign}
              onPay={handlePay}
            />
          ))}
        </div>
      )}
    </div>
  );
}
