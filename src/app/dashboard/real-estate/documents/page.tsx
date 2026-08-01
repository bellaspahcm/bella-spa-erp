"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  FileText, Search, Filter, Download, Eye, Clock,
  CheckCircle2, AlertCircle, XCircle, FileSignature,
  Stamp, Send
} from "lucide-react";

const DOC_STATUS = {
  draft: { label: "Nháp", icon: Clock, color: "text-white/40 bg-white/5 border-white/10" },
  pending_review: { label: "Đang duyệt", icon: AlertCircle, color: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
  approved: { label: "Đã duyệt", icon: CheckCircle2, color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
  signed: { label: "Đã ký", icon: FileSignature, color: "text-blue-400 bg-blue-500/10 border-blue-500/20" },
  rejected: { label: "Từ chối", icon: XCircle, color: "text-rose-400 bg-rose-500/10 border-rose-500/20" },
  cancelled: { label: "Huỷ", icon: XCircle, color: "text-white/20 bg-white/5 border-white/5" },
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

// Mock documents for demonstration
const MOCK_DOCS = [
  { id: "D001", name: "HĐMB - CH001 - Nguyễn Văn An", type: "Hợp đồng mua bán", status: "signed", date: "2026-07-15", project: "The Grand Tower" },
  { id: "D002", name: "Biên bản đặt cọc - CH042 - Trần Thị Bình", type: "Biên bản đặt cọc", status: "approved", date: "2026-07-20", project: "Riverside Heights" },
  { id: "D003", name: "HĐMB - SH008 - Lê Hoàng Cường", type: "Hợp đồng mua bán", status: "pending_review", date: "2026-07-28", project: "The Grand Tower" },
  { id: "D004", name: "Phụ lục HĐMB - CH001 - Thanh toán đợt 2", type: "Phụ lục hợp đồng", status: "draft", date: "2026-07-30", project: "The Grand Tower" },
  { id: "D005", name: "Biên bản bàn giao - CH015 - Phạm Minh Đức", type: "Biên bản bàn giao", status: "signed", date: "2026-06-10", project: "Riverside Heights" },
  { id: "D006", name: "GCN - TN012 - Hộ Ngô Thị Hà", type: "Giấy chứng nhận", status: "approved", date: "2026-07-02", project: "Sunrise Villa" },
  { id: "D007", name: "HĐMB - CH090 - Đinh Văn Giang (Huỷ)", type: "Hợp đồng mua bán", status: "cancelled", date: "2026-05-22", project: "Riverside Heights" },
  { id: "D008", name: "Văn bản pháp lý - Quyết định 1/500", type: "Văn bản pháp lý", status: "approved", date: "2026-07-01", project: "The Grand Tower" },
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
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("Tất cả");
  const [statusFilter, setStatusFilter] = useState<DocStatus | "all">("all");

  const filtered = MOCK_DOCS.filter(d => {
    const matchSearch = d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.project.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === "Tất cả" || d.type === typeFilter;
    const matchStatus = statusFilter === "all" || d.status === statusFilter;
    return matchSearch && matchType && matchStatus;
  });

  const counts = {
    total: MOCK_DOCS.length,
    signed: MOCK_DOCS.filter(d => d.status === "signed").length,
    pending: MOCK_DOCS.filter(d => d.status === "pending_review").length,
    draft: MOCK_DOCS.filter(d => d.status === "draft").length,
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight">Kho Tài Liệu Pháp Lý</h1>
          <p className="text-white/40 text-sm mt-1">Quản lý hợp đồng, đặt cọc và chứng từ pháp lý</p>
        </div>
        <button className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-black px-5 py-2.5 rounded-xl font-bold text-sm transition-all self-start">
          <FileText className="w-4 h-4" />
          Tạo Tài Liệu Mới
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Tổng tài liệu", value: counts.total, color: "text-white" },
          { label: "Đã ký số", value: counts.signed, color: "text-blue-400" },
          { label: "Đang duyệt", value: counts.pending, color: "text-amber-400" },
          { label: "Bản nháp", value: counts.draft, color: "text-white/40" },
        ].map(s => (
          <div key={s.label} className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
            <p className={`text-3xl font-black ${s.color}`}>{s.value}</p>
            <p className="text-white/40 text-xs mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Tìm theo tên tài liệu, dự án..."
            className="w-full pl-11 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-amber-500/50"
          />
        </div>
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500/50 cursor-pointer"
        >
          {DOC_TYPES.map(t => <option key={t} value={t} className="bg-slate-900">{t}</option>)}
        </select>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as DocStatus | "all")}
          className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500/50 cursor-pointer"
        >
          <option value="all" className="bg-slate-900">Tất cả trạng thái</option>
          {(Object.keys(DOC_STATUS) as DocStatus[]).map(s => (
            <option key={s} value={s} className="bg-slate-900">{DOC_STATUS[s].label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead className="border-b border-white/10">
              <tr className="text-white/30 text-xs uppercase tracking-wider">
                <th className="text-left px-5 py-3.5 font-semibold">Tài Liệu</th>
                <th className="text-left px-5 py-3.5 font-semibold">Loại</th>
                <th className="text-left px-5 py-3.5 font-semibold">Dự Án</th>
                <th className="text-left px-5 py-3.5 font-semibold">Ngày</th>
                <th className="text-left px-5 py-3.5 font-semibold">Trạng Thái</th>
                <th className="text-right px-5 py-3.5 font-semibold">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.map((doc, i) => (
                <motion.tr
                  key={doc.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.04 }}
                  className="hover:bg-white/5 transition-colors"
                >
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-amber-500/20 rounded-lg flex items-center justify-center shrink-0">
                        <FileText className="w-4 h-4 text-amber-400" />
                      </div>
                      <div>
                        <p className="text-white font-semibold text-sm">{doc.name}</p>
                        <p className="text-white/30 text-xs">#{doc.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-white/50 text-xs">{doc.type}</td>
                  <td className="px-5 py-4 text-white/50 text-xs">{doc.project}</td>
                  <td className="px-5 py-4 text-white/50 text-xs">{doc.date}</td>
                  <td className="px-5 py-4">
                    <StatusBadge status={doc.status as DocStatus} />
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-white/40 hover:text-white" title="Xem">
                        <Eye className="w-4 h-4" />
                      </button>
                      <button className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-white/40 hover:text-white" title="Tải xuống">
                        <Download className="w-4 h-4" />
                      </button>
                      {doc.status === "approved" && (
                        <button className="p-1.5 hover:bg-blue-500/20 rounded-lg transition-colors text-blue-400/60 hover:text-blue-400" title="Ký số">
                          <Stamp className="w-4 h-4" />
                        </button>
                      )}
                      {doc.status === "draft" && (
                        <button className="p-1.5 hover:bg-amber-500/20 rounded-lg transition-colors text-amber-400/60 hover:text-amber-400" title="Gửi duyệt">
                          <Send className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </motion.tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-white/20 text-sm italic">
                    Không tìm thấy tài liệu nào phù hợp
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
