"use client";

import { useState } from "react";
import { PremiumSelect } from "@/components/ui/PremiumSelect";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  FileText, Search, Download, Eye, Clock,
  CheckCircle2, AlertCircle, XCircle, FileSignature,
  Stamp, Send, Files, Filter, PenLine, Plus, X
} from "lucide-react";

const DOC_STATUS = {
  draft:          { label: "Nháp",        icon: Clock,         color: "text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/40" },
  pending_review: { label: "Đang duyệt",  icon: AlertCircle,   color: "text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-700/30" },
  approved:       { label: "Đã duyệt",    icon: CheckCircle2,  color: "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-700/30" },
  signed:         { label: "Đã ký",       icon: FileSignature, color: "text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-700/30" },
  rejected:       { label: "Từ chối",     icon: XCircle,       color: "text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-700/30" },
  cancelled:      { label: "Huỷ",         icon: XCircle,       color: "text-slate-400 dark:text-slate-600 bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800/40" },
} as const;

const DOC_TYPES = [
  "Tất cả",
  "Hợp đồng mua bán",
  "Biên bản đặt cọc",
  "Giấy chứng nhận",
  "Biên bản bàn giao",
  "Phụ lục hợp đồng",
  "Văn bản pháp lý",
];

const MOCK_DOCS = [
  { id: "D001", name: "HĐMB - CH001 - Nguyễn Văn An",             type: "Hợp đồng mua bán",  status: "signed",         date: "2026-07-15", project: "The Grand Tower"   },
  { id: "D002", name: "Biên bản đặt cọc - CH042 - Trần Thị Bình", type: "Biên bản đặt cọc",  status: "approved",       date: "2026-07-20", project: "Riverside Heights" },
  { id: "D003", name: "HĐMB - SH008 - Lê Hoàng Cường",            type: "Hợp đồng mua bán",  status: "pending_review", date: "2026-07-28", project: "The Grand Tower"   },
  { id: "D004", name: "Phụ lục HĐMB - CH001 - Thanh toán đợt 2",  type: "Phụ lục hợp đồng",  status: "draft",          date: "2026-07-30", project: "The Grand Tower"   },
  { id: "D005", name: "Biên bản bàn giao - CH015 - Phạm Minh Đức",type: "Biên bản bàn giao", status: "signed",         date: "2026-06-10", project: "Riverside Heights" },
  { id: "D006", name: "GCN - TN012 - Hộ Ngô Thị Hà",              type: "Giấy chứng nhận",   status: "approved",       date: "2026-07-02", project: "Sunrise Villa"     },
  { id: "D007", name: "HĐMB - CH090 - Đinh Văn Giang (Huỷ)",      type: "Hợp đồng mua bán",  status: "cancelled",      date: "2026-05-22", project: "Riverside Heights" },
  { id: "D008", name: "Văn bản pháp lý - Quyết định 1/500",        type: "Văn bản pháp lý",   status: "approved",       date: "2026-07-01", project: "The Grand Tower"   },
];

type DocStatus = keyof typeof DOC_STATUS;

function StatusBadge({ status }: { status: DocStatus }) {
  const cfg = DOC_STATUS[status];
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border ${cfg.color}`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

export default function DocumentsPage() {
  const [docs, setDocs] = useState(MOCK_DOCS);
  const [search, setSearch]           = useState("");
  const [typeFilter, setTypeFilter]   = useState("Tất cả");
  const [statusFilter, setStatusFilter] = useState<DocStatus | "all">("all");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newDoc, setNewDoc] = useState({
    name: "",
    type: "Hợp đồng mua bán",
    project: "The Grand Tower",
    status: "draft" as DocStatus,
    date: new Date().toISOString().split("T")[0],
  });

  const handleCreateDoc = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDoc.name.trim()) {
      toast.error("Vui lòng nhập tên tài liệu!");
      return;
    }

    const docId = `D${String(docs.length + 1).padStart(3, "0")}`;
    const docToAdd = {
      id: docId,
      name: newDoc.name.trim(),
      type: newDoc.type,
      project: newDoc.project,
      status: newDoc.status,
      date: newDoc.date,
    };

    setDocs([docToAdd, ...docs]);
    toast.success(`Đã tạo tài liệu "${docToAdd.name}" thành công!`);
    setIsModalOpen(false);
    setNewDoc({
      name: "",
      type: "Hợp đồng mua bán",
      project: "The Grand Tower",
      status: "draft",
      date: new Date().toISOString().split("T")[0],
    });
  };

  const handleUpdateStatus = (id: string, newStatus: DocStatus) => {
    setDocs(prev => prev.map(d => d.id === id ? { ...d, status: newStatus } : d));
  };

  const filtered = docs.filter(d => {
    const matchSearch = d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.project.toLowerCase().includes(search.toLowerCase());
    const matchType   = typeFilter === "Tất cả" || d.type === typeFilter;
    const matchStatus = statusFilter === "all"    || d.status === statusFilter;
    return matchSearch && matchType && matchStatus;
  });

  const counts = {
    total:   docs.length,
    signed:  docs.filter(d => d.status === "signed").length,
    pending: docs.filter(d => d.status === "pending_review").length,
    draft:   docs.filter(d => d.status === "draft").length,
  };

  const kpis = [
    { label: "Tổng tài liệu", value: counts.total,   icon: Files,       iconColor: "text-blue-600 dark:text-blue-400",    iconBg: "bg-blue-100 dark:bg-blue-900/30"    },
    { label: "Đã ký số",      value: counts.signed,  icon: FileSignature, iconColor: "text-emerald-600 dark:text-emerald-400", iconBg: "bg-emerald-100 dark:bg-emerald-900/30" },
    { label: "Đang duyệt",   value: counts.pending, icon: Clock,       iconColor: "text-amber-600 dark:text-amber-400",  iconBg: "bg-amber-100 dark:bg-amber-900/30"  },
    { label: "Bản nháp",      value: counts.draft,   icon: PenLine,     iconColor: "text-slate-500 dark:text-slate-400",  iconBg: "bg-slate-100 dark:bg-slate-800/60"  },
  ];

  return (
    <div className="space-y-8">
      {/* ─ Header ─ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <Files className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            </div>
            Kho Tài Liệu Pháp Lý
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Quản lý hợp đồng, đặt cọc và chứng từ pháp lý
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-black px-5 py-2.5 rounded-xl font-bold text-sm transition-all self-start shadow-sm active:scale-[0.98]"
        >
          <FileText className="w-4 h-4" />
          Tạo Tài Liệu Mới
        </button>
      </div>

      {/* ─ KPI Row ─ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {kpis.map(k => (
          <div key={k.label} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${k.iconBg}`}>
              <k.icon className={`w-5 h-5 ${k.iconColor}`} />
            </div>
            <p className="text-2xl font-black text-slate-900 dark:text-white">{k.value}</p>
            <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">{k.label}</p>
          </div>
        ))}
      </div>

      {/* ─ Filters ─ */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Tìm theo tên tài liệu, dự án..."
            className="w-full pl-11 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white text-sm placeholder:text-slate-400 focus:outline-none focus:border-amber-500/50"
          />
        </div>
        <PremiumSelect
          options={DOC_TYPES.map(t => ({ value: t, label: t }))}
          value={typeFilter}
          onChange={setTypeFilter}
          placeholder="Loại tài liệu..."
          className="w-full sm:w-[200px]"
          buttonClassName="py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-800 text-sm font-bold bg-white dark:bg-slate-900 focus:border-amber-500 focus:ring-amber-500/10 active:scale-100"
        />
        <PremiumSelect
          options={[
            { value: "all", label: "Tất cả trạng thái" },
            ...(Object.keys(DOC_STATUS) as DocStatus[]).map(s => ({ value: s, label: DOC_STATUS[s].label }))
          ]}
          value={statusFilter}
          onChange={value => setStatusFilter(value as DocStatus | "all")}
          placeholder="Trạng thái..."
          className="w-full sm:w-[200px]"
          buttonClassName="py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-800 text-sm font-bold bg-white dark:bg-slate-900 focus:border-amber-500 focus:ring-amber-500/10 active:scale-100"
        />
      </div>

      {/* ─ Table ─ */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead className="border-b border-slate-100 dark:border-slate-800">
              <tr className="text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">
                <th className="text-left px-5 py-3.5 font-semibold">Tài Liệu</th>
                <th className="text-left px-5 py-3.5 font-semibold">Loại</th>
                <th className="text-left px-5 py-3.5 font-semibold">Dự Án</th>
                <th className="text-left px-5 py-3.5 font-semibold">Ngày</th>
                <th className="text-left px-5 py-3.5 font-semibold">Trạng Thái</th>
                <th className="text-right px-5 py-3.5 font-semibold">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.map((doc, i) => (
                <motion.tr
                  key={doc.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.04 }}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-amber-100 dark:bg-amber-900/30 rounded-lg flex items-center justify-center shrink-0">
                        <FileText className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                      </div>
                      <div>
                        <p className="text-slate-900 dark:text-white font-semibold text-sm">{doc.name}</p>
                        <p className="text-slate-400 dark:text-slate-500 text-xs">#{doc.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-slate-600 dark:text-slate-400 text-xs">{doc.type}</td>
                  <td className="px-5 py-4 text-slate-600 dark:text-slate-400 text-xs">{doc.project}</td>
                  <td className="px-5 py-4 text-slate-600 dark:text-slate-400 text-xs">{doc.date}</td>
                  <td className="px-5 py-4">
                    <StatusBadge status={doc.status as DocStatus} />
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => toast.success(`Đang xem chi tiết tài liệu: ${doc.name}`)}
                        className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                        title="Xem"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => toast.success(`Đang tải xuống tài liệu: ${doc.name}`)}
                        className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                        title="Tải xuống"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      {doc.status === "approved" && (
                        <button
                          onClick={() => {
                            handleUpdateStatus(doc.id, "signed");
                            toast.success(`Ký số thành công tài liệu: ${doc.name}`);
                          }}
                          className="p-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors text-blue-400 hover:text-blue-600 dark:hover:text-blue-300"
                          title="Ký số"
                        >
                          <Stamp className="w-4 h-4" />
                        </button>
                      )}
                      {doc.status === "draft" && (
                        <button
                          onClick={() => {
                            handleUpdateStatus(doc.id, "pending_review");
                            toast.success(`Đã gửi yêu cầu duyệt tài liệu: ${doc.name}`);
                          }}
                          className="p-1.5 hover:bg-amber-50 dark:hover:bg-amber-900/30 rounded-lg transition-colors text-amber-500 hover:text-amber-700 dark:hover:text-amber-300"
                          title="Gửi duyệt"
                        >
                          <Send className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </motion.tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-slate-400 dark:text-slate-500 text-sm italic">
                    Không tìm thấy tài liệu nào phù hợp
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─ Create Document Modal ─ */}
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
                  <FileText className="w-5 h-5 text-amber-500" />
                  Tạo Tài Liệu Pháp Lý Mới
                </h3>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form Body */}
              <form onSubmit={handleCreateDoc} className="flex-1 overflow-y-auto p-6 space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Tên Tài Liệu <span className="text-rose-500">*</span>
                  </label>
                  <input
                    required
                    value={newDoc.name}
                    onChange={e => setNewDoc(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="VD: HĐMB - CH009 - Nguyễn Thị Hạnh"
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-amber-500/50"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Loại Tài Liệu
                    </label>
                    <PremiumSelect
                      options={DOC_TYPES.slice(1).map(t => ({ value: t, label: t }))}
                      value={newDoc.type}
                      onChange={val => setNewDoc(prev => ({ ...prev, type: val }))}
                      className="w-full"
                      buttonClassName="w-full py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-800 text-sm bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:border-amber-500 focus:ring-amber-500/10 active:scale-100 font-medium"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Dự Án Liên Quan
                    </label>
                    <PremiumSelect
                      options={[
                        { value: "The Grand Tower", label: "The Grand Tower" },
                        { value: "Riverside Heights", label: "Riverside Heights" },
                        { value: "Sunrise Villa", label: "Sunrise Villa" },
                      ]}
                      value={newDoc.project}
                      onChange={val => setNewDoc(prev => ({ ...prev, project: val }))}
                      className="w-full"
                      buttonClassName="w-full py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-800 text-sm bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:border-amber-500 focus:ring-amber-500/10 active:scale-100 font-medium"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Trạng Thái Ban Đầu
                    </label>
                    <PremiumSelect
                      options={[
                        { value: "draft", label: "Nháp" },
                        { value: "pending_review", label: "Đang duyệt" },
                        { value: "approved", label: "Đã duyệt" },
                      ]}
                      value={newDoc.status}
                      onChange={val => setNewDoc(prev => ({ ...prev, status: val as DocStatus }))}
                      className="w-full"
                      buttonClassName="w-full py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-800 text-sm bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:border-amber-500 focus:ring-amber-500/10 active:scale-100 font-medium"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Ngày Lập
                    </label>
                    <input
                      type="date"
                      required
                      value={newDoc.date}
                      onChange={e => setNewDoc(prev => ({ ...prev, date: e.target.value }))}
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:border-amber-500/50"
                    />
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3 mt-6">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2.5 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 text-sm font-bold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-black text-sm font-bold rounded-xl shadow-sm transition-all flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    Tạo Tài Liệu
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

