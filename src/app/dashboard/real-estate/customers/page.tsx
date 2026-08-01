"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, Phone, Mail, MessageSquare, CalendarCheck, Building2,
  RefreshCw, Search, Plus, ChevronRight, ChevronDown,
  MapPin, TrendingUp, Clock, CheckCircle2,
  XCircle, ArrowRight, Target, Banknote,
  Globe, MessageCircle, Share2, Tag, PhoneCall,
  FileText
} from "lucide-react";
import { toast } from "sonner";
import {
  fetchInvestorsAction,
  addInvestorInteractionAction,
  updateInvestorStatusAction,
  createInvestorAction,
  type InvestorRecord,
} from "@/modules/real_estate/actions/investorActions";

import { PremiumSelect } from "@/components/ui/PremiumSelect";

function fmtBudget(min: number, max: number) {
  const f = (n: number) => n >= 1e9 ? `${(n / 1e9).toFixed(1)} tỷ` : `${(n / 1e6).toFixed(0)} triệu`;
  return `${f(min)} – ${f(max)}`;
}

function timeAgo(isoDate: string) {
  const diff = Date.now() - new Date(isoDate).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Hôm nay";
  if (days === 1) return "Hôm qua";
  if (days < 7) return `${days} ngày trước`;
  if (days < 30) return `${Math.floor(days / 7)} tuần trước`;
  return `${Math.floor(days / 30)} tháng trước`;
}

const STATUS_CFG: Record<InvestorRecord["status"], { label: string; color: string; dot: string }> = {
  lead: { label: "Lead Mới", color: "bg-slate-100 text-slate-700 dark:bg-slate-800/60 dark:text-slate-300", dot: "bg-slate-400" },
  contacted: { label: "Đã Liên Hệ", color: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300", dot: "bg-blue-500" },
  negotiating: { label: "Đang Đàm Phán", color: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300", dot: "bg-amber-500" },
  closed_won: { label: "Chốt Thành Công", color: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300", dot: "bg-emerald-500" },
  closed_lost: { label: "Không Tiếp Tục", color: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300", dot: "bg-rose-500" },
};

const SOURCE_CFG: Record<InvestorRecord["source"], { label: string; icon: React.ElementType; iconColor: string }> = {
  facebook:  { label: "Facebook Ads", icon: Globe,          iconColor: "text-blue-500 dark:text-blue-400" },
  zalo:      { label: "Zalo OA",      icon: MessageCircle,  iconColor: "text-sky-500 dark:text-sky-400" },
  referral:  { label: "Giới Thiệu",   icon: Share2,         iconColor: "text-emerald-500 dark:text-emerald-400" },
  website:   { label: "Website",      icon: Globe,          iconColor: "text-violet-500 dark:text-violet-400" },
  event:     { label: "Sự Kiện",      icon: Tag,            iconColor: "text-orange-500 dark:text-orange-400" },
  cold_call: { label: "Telesale",     icon: PhoneCall,      iconColor: "text-rose-500 dark:text-rose-400" },
};

const INTERACTION_ICONS: Record<InvestorRecord["interactions"][0]["type"], { icon: typeof Phone; label: string; color: string }> = {
  call: { icon: Phone, label: "Cuộc gọi", color: "text-blue-500 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30" },
  viewing: { icon: Building2, label: "Tham quan", color: "text-purple-500 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/30" },
  email: { icon: Mail, label: "Email", color: "text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/40" },
  meeting: { icon: CalendarCheck, label: "Họp tư vấn", color: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30" },
  whatsapp: { icon: MessageSquare, label: "WhatsApp", color: "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30" },
};

function StatusBadge({ status }: { status: InvestorRecord["status"] }) {
  const cfg = STATUS_CFG[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${cfg.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function InvestorCard({
  investor,
  onAddInteraction,
  onUpdateStatus,
}: {
  investor: InvestorRecord;
  onAddInteraction: (id: string, type: InvestorRecord["interactions"][0]["type"], notes: string) => void;
  onUpdateStatus: (id: string, status: InvestorRecord["status"]) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [addingNote, setAddingNote] = useState(false);
  const [noteType, setNoteType] = useState<InvestorRecord["interactions"][0]["type"]>("call");
  const [noteText, setNoteText] = useState("");

  const src = SOURCE_CFG[investor.source];
  const SrcIcon = src.icon;
  const sorted = [...investor.interactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  function handleSubmitNote() {
    if (!noteText.trim()) return;
    onAddInteraction(investor.id, noteType, noteText.trim());
    setNoteText("");
    setAddingNote(false);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"
    >
      {/* Card Header */}
      <div className="p-5">
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center shrink-0 text-blue-700 dark:text-blue-300 font-black text-lg">
            {investor.fullName.charAt(0)}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-black text-slate-900 dark:text-white">{investor.fullName}</h3>
              <StatusBadge status={investor.status} />
            </div>
            <div className="flex items-center gap-3 mt-1 text-sm text-slate-500 dark:text-slate-400 flex-wrap">
              <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{investor.phone}</span>
              <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" />{investor.email}</span>
              <span className="flex items-center gap-1"><Banknote className="w-3.5 h-3.5" />{fmtBudget(investor.budgetMin, investor.budgetMax)}</span>
            </div>
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              <span className="inline-flex items-center gap-1.5 text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-lg font-medium">
                <SrcIcon className={`w-3 h-3 ${src.iconColor}`} />
                {src.label}
              </span>
              {investor.interestedProjects.map(p => (
                <span key={p} className="inline-flex items-center gap-1 text-xs bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-lg font-medium">
                  <Building2 className="w-3 h-3" />{p}
                </span>
              ))}
              <span className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1">
                <Target className="w-3 h-3" />Sale: {investor.saleOwner}
              </span>
            </div>
          </div>

          {/* Last contact + action */}
          <div className="text-right shrink-0">
            {investor.lastContactedAt && (
              <p className="text-xs text-slate-400 dark:text-slate-500">
                <Clock className="w-3 h-3 inline mr-1" />
                {timeAgo(investor.lastContactedAt)}
              </p>
            )}
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
              {investor.interactions.length} tương tác
            </p>
          </div>
        </div>

        {/* Note preview */}
        {investor.note && (
          <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-700/30 rounded-xl flex items-start gap-2">
            <MapPin className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 dark:text-amber-300 italic">{investor.note}</p>
          </div>
        )}

        {/* Actions */}
        <div className="mt-4 flex items-center gap-2 flex-wrap">
          <button
            onClick={() => { setAddingNote(true); setExpanded(true); }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            Ghi Tương Tác
          </button>
          {investor.status !== "closed_won" && investor.status !== "closed_lost" && (
            <button
              onClick={() => onUpdateStatus(investor.id, "negotiating")}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-black text-xs font-bold rounded-xl transition-all"
            >
              <ArrowRight className="w-3.5 h-3.5" />
              Chuyển Đàm Phán
            </button>
          )}
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 font-bold hover:text-slate-700 dark:hover:text-slate-200 transition-colors ml-auto"
          >
            {expanded ? "Ẩn lịch sử" : "Xem lịch sử"}
            {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Expanded: Interaction Timeline + Add Note */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="border-t border-slate-100 dark:border-slate-800 overflow-hidden"
          >
            <div className="p-5 space-y-4">
              {/* Add interaction form */}
              {addingNote && (
                <div className="p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-700/30 rounded-2xl space-y-3">
                  <h4 className="text-xs font-black text-blue-800 dark:text-blue-300 uppercase tracking-wider">Ghi nhận tương tác mới</h4>
                  <div className="flex gap-2 flex-wrap">
                    {(["call", "viewing", "email", "meeting"] as const).map(t => (
                      <button
                        key={t}
                        onClick={() => setNoteType(t)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                          noteType === t
                            ? "bg-blue-600 text-white"
                            : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                        }`}
                      >
                        {INTERACTION_ICONS[t].label}
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={noteText}
                    onChange={e => setNoteText(e.target.value)}
                    placeholder="Ghi chú nội dung tương tác..."
                    rows={2}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-blue-400 resize-none"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setAddingNote(false)}
                      className="px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                    >
                      Hủy
                    </button>
                    <button
                      onClick={handleSubmitNote}
                      className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all"
                    >
                      Lưu
                    </button>
                  </div>
                </div>
              )}

              {/* Timeline */}
              <h4 className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                Lịch Sử Tương Tác ({sorted.length})
              </h4>
              {sorted.length === 0 && (
                <p className="text-sm text-slate-400 dark:text-slate-500 italic">Chưa có tương tác nào được ghi nhận.</p>
              )}
              <div className="relative space-y-3 pl-6">
                {sorted.map((int, idx) => {
                  const cfg = INTERACTION_ICONS[int.type];
                  const Icon = cfg.icon;
                  return (
                    <div key={int.id} className="relative">
                      {/* Connector line */}
                      {idx < sorted.length - 1 && (
                        <div className="absolute left-[-16px] top-8 bottom-0 w-px bg-slate-200 dark:bg-slate-700" />
                      )}
                      {/* Dot */}
                      <div className={`absolute left-[-24px] top-2 w-8 h-8 rounded-full flex items-center justify-center ${cfg.color}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      {/* Content */}
                      <div className="bg-slate-50 dark:bg-slate-800/40 rounded-xl p-3 ml-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{cfg.label}</span>
                          <span className="text-xs text-slate-400 dark:text-slate-500">{timeAgo(int.date)}</span>
                        </div>
                        <p className="text-sm text-slate-700 dark:text-slate-300 mt-1">{int.notes}</p>
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 italic">— {int.staffName}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function RealEstateCustomersPage() {
  const [investors, setInvestors] = useState<InvestorRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [cccd, setCccd] = useState("");
  const [budgetMin, setBudgetMin] = useState(2000000000);
  const [budgetMax, setBudgetMax] = useState(5000000000);
  const [source, setSource] = useState<InvestorRecord["source"]>("facebook");
  const [saleOwner, setSaleOwner] = useState("Nguyễn Văn Minh");
  const [interestedProjects, setInterestedProjects] = useState<string[]>(["Bella Residences"]);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !phone || !email || !saleOwner) {
      toast.error("Vui lòng nhập đầy đủ các trường bắt buộc!");
      return;
    }
    setSubmitting(true);
    const res = await createInvestorAction({
      fullName,
      phone,
      email,
      cccd,
      budgetMin,
      budgetMax,
      source,
      saleOwner,
      interestedProjects,
      note,
    });
    setSubmitting(false);
    if (res.success) {
      toast.success("✅ Thêm khách hàng mới thành công!");
      setIsModalOpen(false);
      // Reset form
      setFullName("");
      setPhone("");
      setEmail("");
      setCccd("");
      setBudgetMin(2000000000);
      setBudgetMax(5000000000);
      setNote("");
      await load();
    } else {
      toast.error(res.error ?? "Không thể thêm khách hàng");
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetchInvestorsAction();
    if (res.success && res.data) setInvestors(res.data);
    else toast.error(res.error ?? "Không thể tải danh sách khách hàng");
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleAddInteraction(
    investorId: string,
    type: InvestorRecord["interactions"][0]["type"],
    notes: string
  ) {
    const res = await addInvestorInteractionAction(investorId, { type, notes, staffName: "Bạn" });
    if (res.success) {
      toast.success("✅ Ghi nhận tương tác thành công!");
      await load();
    } else {
      toast.error(res.error ?? "Ghi nhận thất bại");
    }
  }

  async function handleUpdateStatus(investorId: string, status: InvestorRecord["status"]) {
    const res = await updateInvestorStatusAction(investorId, status);
    if (res.success) {
      toast.success(`✅ Cập nhật trạng thái thành công!`);
      await load();
    } else {
      toast.error(res.error ?? "Cập nhật thất bại");
    }
  }

  const filtered = investors.filter(inv => {
    const matchSearch =
      !search ||
      inv.fullName.toLowerCase().includes(search.toLowerCase()) ||
      inv.phone.includes(search) ||
      inv.email.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "all" || inv.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const totalBudget = investors.reduce((s, i) => s + (i.budgetMin + i.budgetMax) / 2, 0);

  return (
    <div className="space-y-8">
      {/* ─ Header ─ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            Khách Hàng & Nhà Đầu Tư
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Hồ sơ 360° nhà đầu tư, hành trình khách hàng và lịch sử tương tác
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-bold text-sm transition-all shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Thêm Khách Hàng
        </button>
      </div>

      {/* ─ KPI Row ─ */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {(["lead", "contacted", "negotiating", "closed_won", "closed_lost"] as const).map(status => {
          const cfg = STATUS_CFG[status];
          const count = investors.filter(i => i.status === status).length;
          return (
            <div key={status} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center gap-1.5 mb-1">
                <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">{cfg.label}</p>
              </div>
              <p className="text-2xl font-black text-slate-900 dark:text-white">{count}</p>
            </div>
          );
        })}
      </div>

      {/* ─ Filters ─ */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            placeholder="Tìm tên, SĐT, email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-blue-500/50"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {["all", ...Object.keys(STATUS_CFG)].map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                filterStatus === s
                  ? "bg-blue-600 text-white"
                  : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-blue-300"
              }`}
            >
              {s === "all" ? "Tất cả" : STATUS_CFG[s as keyof typeof STATUS_CFG]?.label ?? s}
            </button>
          ))}
        </div>
      </div>

      {/* ─ Investor List ─ */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400 dark:text-slate-500">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p className="font-semibold">Không tìm thấy khách hàng nào</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(investor => (
            <InvestorCard
              key={investor.id}
              investor={investor}
              onAddInteraction={handleAddInteraction}
              onUpdateStatus={handleUpdateStatus}
            />
          ))}
        </div>
      )}

      {/* ─ Create Investor Modal ─ */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            />

            {/* Modal Content */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-2xl z-10 flex flex-col max-h-[90vh]"
            >
              {/* Header */}
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-500" />
                  Thêm Khách Hàng Mới
                </h3>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              {/* Form Body */}
              <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Họ Và Tên <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Nguyễn Văn B"
                      value={fullName}
                      onChange={e => setFullName(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Số Điện Thoại <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="0912 345 678"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Email <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="khachhang@gmail.com"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Số CCCD/Hộ Chiếu
                    </label>
                    <input
                      type="text"
                      placeholder="079080012345"
                      value={cccd}
                      onChange={e => setCccd(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Ngân Sách Tối Thiểu (VNĐ)
                    </label>
                    <input
                      type="number"
                      required
                      min={0}
                      value={budgetMin}
                      onChange={e => setBudgetMin(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Ngân Sách Tối Đa (VNĐ)
                    </label>
                    <input
                      type="number"
                      required
                      min={0}
                      value={budgetMax}
                      onChange={e => setBudgetMax(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Nguồn Khách Hàng
                    </label>
                    <PremiumSelect
                      options={[
                        { value: "facebook", label: "Facebook Ads" },
                        { value: "zalo", label: "Zalo OA" },
                        { value: "referral", label: "Giới Thiệu" },
                        { value: "website", label: "Website" },
                        { value: "event", label: "Sự Kiện" },
                        { value: "cold_call", label: "Telesale" },
                      ]}
                      value={source}
                      onChange={(val) => setSource(val as any)}
                      buttonClassName="h-9 py-0 px-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-normal text-slate-900 dark:text-white hover:bg-slate-100/50 dark:hover:bg-slate-900/50 shadow-none focus:border-blue-500/50 focus:ring-0 focus:ring-offset-0"
                      dropdownClassName="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-xl rounded-xl py-1"
                      itemClassName="px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-800 dark:text-slate-200 text-sm font-normal transition-colors"
                      selectedItemClassName="bg-blue-600/10 text-blue-600 dark:text-blue-400 font-semibold px-4 py-2 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Dự Án Quan Tâm
                    </label>
                    <select
                      multiple
                      value={interestedProjects}
                      onChange={e => {
                        const values = Array.from(e.target.selectedOptions, option => option.value);
                        setInterestedProjects(values);
                      }}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:border-blue-500 h-20"
                    >
                      <option value="Bella Residences">Bella Residences</option>
                      <option value="Bella Premium">Bella Premium</option>
                      <option value="Bella Sky">Bella Sky</option>
                    </select>
                    <p className="text-[10px] text-slate-400">Giữ Ctrl / Command để chọn nhiều dự án</p>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Chuyên Viên Chăm Sóc (Sale) <span className="text-rose-500">*</span>
                  </label>
                  <PremiumSelect
                    options={[
                      { value: "Nguyễn Văn Minh", label: "Nguyễn Văn Minh" },
                      { value: "Trần Thị Anh", label: "Trần Thị Anh" },
                      { value: "Lê Quốc Binh", label: "Lê Quốc Binh" },
                      { value: "Phạm Thị Cam", label: "Phạm Thị Cam" },
                      { value: "Đỗ Hải Đăng", label: "Đỗ Hải Đăng" },
                    ]}
                    value={saleOwner}
                    onChange={setSaleOwner}
                    buttonClassName="h-9 py-0 px-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-normal text-slate-900 dark:text-white hover:bg-slate-100/50 dark:hover:bg-slate-900/50 shadow-none focus:border-blue-500/50 focus:ring-0 focus:ring-offset-0"
                    dropdownClassName="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-xl rounded-xl py-1"
                    itemClassName="px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-800 dark:text-slate-200 text-sm font-normal transition-colors"
                    selectedItemClassName="bg-blue-600/10 text-blue-600 dark:text-blue-400 font-semibold px-4 py-2 text-sm"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Ghi Chú Nhu Cầu
                  </label>
                  <textarea
                    rows={2}
                    placeholder="VD: Cần tìm tầng cao view sông..."
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:border-blue-500 resize-none"
                  />
                </div>

                {/* Footer buttons */}
                <div className="flex gap-3 justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 text-sm font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl transition-colors"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 text-sm font-bold bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl transition-colors flex items-center gap-1.5"
                  >
                    {submitting ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Plus className="w-4 h-4" />
                    )}
                    Thêm Khách Hàng
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
