"use client";

import React, { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  FolderKanban, PlusCircle, Building, MapPin, Loader2,
  BarChart3, TrendingUp, Home, CheckCircle2, Clock,
  ChevronRight, X, Calendar
} from "lucide-react";
import { toast } from "sonner";
import {
  fetchProjectsAction,
  createProjectAction,
} from "@/modules/real_estate/actions/projectActions";
import { fetchProductsAction } from "@/modules/real_estate/actions/productActions";
import { PremiumSelect } from "@/components/ui/PremiumSelect";
import { Database } from "@/types/database.types";

type ProjectRow = Database["public"]["Tables"]["real_estate_projects"]["Row"];
type ProductRow = Database["public"]["Tables"]["real_estate_products"]["Row"];

interface ProjectStats {
  total: number;
  available: number;
  booked: number;
  deposited: number;
  sold: number;
}

const STATUS_LABEL: Record<string, string> = {
  planning: "Quy Hoạch",
  presale: "Chuẩn Bị MH",
  on_sale: "Đang Mở Bán",
  sold_out: "Đã Bán Hết",
  completed: "Hoàn Tất",
};

const STATUS_COLOR: Record<string, string> = {
  planning: "bg-slate-100 text-slate-700 dark:bg-slate-800/60 dark:text-slate-300",
  presale: "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300",
  on_sale: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  sold_out: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  completed: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
};

function ProjectCard({
  project,
  stats,
  onView,
}: {
  project: ProjectRow;
  stats: ProjectStats;
  onView: (p: ProjectRow) => void;
}) {
  const occupancyPct = stats.total > 0 ? Math.round(((stats.total - stats.available) / stats.total) * 100) : 0;
  const statusKey = project.status ?? "planning";

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 cursor-pointer"
      onClick={() => onView(project)}
    >
      {/* Color accent strip */}
      <div className="h-1.5 bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500" />

      <div className="p-6 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200/60 dark:border-amber-700/30 flex items-center justify-center shrink-0">
              <Building className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white leading-tight">{project.name}</h3>
              <div className="flex items-center gap-1.5 mt-0.5">
                <MapPin className="w-3 h-3 text-slate-400" />
                <span className="text-xs text-slate-500 dark:text-slate-400">Việt Nam · BELLA Group</span>
              </div>
            </div>
          </div>
          <span className={`px-2.5 py-1 rounded-full text-xs font-bold shrink-0 ${STATUS_COLOR[statusKey]}`}>
            {STATUS_LABEL[statusKey] ?? statusKey}
          </span>
        </div>

        {/* Description */}
        {project.description && (
          <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2">{project.description}</p>
        )}

        {/* Inventory stats */}
        <div className="grid grid-cols-4 gap-2 text-center">
          {[
            { label: "Tổng", value: stats.total, color: "text-slate-700 dark:text-slate-300" },
            { label: "Trống", value: stats.available, color: "text-emerald-600 dark:text-emerald-400" },
            { label: "Giữ/Cọc", value: stats.booked + stats.deposited, color: "text-amber-600 dark:text-amber-400" },
            { label: "Đã Bán", value: stats.sold, color: "text-blue-600 dark:text-blue-400" },
          ].map(s => (
            <div key={s.label} className="bg-slate-50 dark:bg-slate-800/40 rounded-xl py-2">
              <p className={`text-lg font-black ${s.color}`}>{s.value}</p>
              <p className="text-[10px] text-slate-500 dark:text-slate-500 font-semibold">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Occupancy bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-slate-500 dark:text-slate-400 font-semibold">Tỷ lệ kín</span>
            <span className="font-black text-slate-900 dark:text-white">{occupancyPct}%</span>
          </div>
          <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${occupancyPct}%` }}
              transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
              className={`h-full rounded-full ${occupancyPct >= 80 ? "bg-emerald-500" : occupancyPct >= 50 ? "bg-amber-500" : "bg-slate-400"}`}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500">
            <Calendar className="w-3.5 h-3.5" />
            <span>ID: {project.id.slice(0, 8)}…</span>
          </div>
          <span className="flex items-center gap-1 text-xs font-bold text-amber-600 dark:text-amber-400 group-hover:gap-2 transition-all">
            Xem chi tiết <ChevronRight className="w-3.5 h-3.5" />
          </span>
        </div>
      </div>
    </motion.div>
  );
}

export default function RealEstateProjectsPage() {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [statsMap, setStatsMap] = useState<Record<string, ProjectStats>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState<ProjectRow | null>(null);
  const [newProject, setNewProject] = useState({ name: "", description: "", status: "on_sale" });
  const [saving, setSaving] = useState(false);

  const loadProjects = useCallback(async () => {
    setIsLoading(true);
    const res = await fetchProjectsAction();
    if (res.success && res.data) {
      const list = Array.isArray(res.data) ? res.data : [res.data];
      setProjects(list);

      // Load stats for each project concurrently
      const statsEntries = await Promise.all(
        list.map(async (p) => {
          const prodRes = await fetchProductsAction(p.id);
          const products: ProductRow[] = prodRes.success && prodRes.data
            ? (Array.isArray(prodRes.data) ? prodRes.data : [prodRes.data])
            : [];
          const stats: ProjectStats = {
            total: products.length,
            available: products.filter(x => x.status === "available").length,
            booked: products.filter(x => x.status === "booked").length,
            deposited: products.filter(x => x.status === "deposited").length,
            sold: products.filter(x => x.status === "paid").length,
          };
          return [p.id, stats] as [string, ProjectStats];
        })
      );
      setStatsMap(Object.fromEntries(statsEntries));
    } else {
      toast.error(res.error ?? "Không thể tải danh sách dự án");
    }
    setIsLoading(false);
  }, []);

  useEffect(() => { loadProjects(); }, [loadProjects]);

  async function handleCreateProject(e: React.FormEvent) {
    e.preventDefault();
    if (!newProject.name.trim()) { toast.error("Vui lòng điền tên dự án"); return; }
    setSaving(true);
    const res = await createProjectAction({
      name: newProject.name.trim(),
      description: newProject.description.trim() || null,
      status: newProject.status as ProjectRow["status"],
    });
    if (res.success) {
      toast.success("✅ Tạo dự án thành công!");
      setShowAddModal(false);
      setNewProject({ name: "", description: "", status: "on_sale" });
      await loadProjects();
    } else {
      toast.error(res.error ?? "Lỗi khi tạo dự án");
    }
    setSaving(false);
  }

  // Grand totals
  const totals = Object.values(statsMap).reduce(
    (acc, s) => ({ total: acc.total + s.total, available: acc.available + s.available, sold: acc.sold + s.sold }),
    { total: 0, available: 0, sold: 0 }
  );

  return (
    <div className="space-y-8">
      {/* ─ Header ─ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <FolderKanban className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            </div>
            Dự Án Bất Động Sản
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Quản lý danh mục dự án, tiến độ mở bán và tỷ lệ kín căn
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-black px-4 py-2.5 rounded-xl font-bold text-sm transition-all shadow-sm"
        >
          <PlusCircle className="w-4 h-4" />
          Tạo Dự Án Mới
        </button>
      </div>

      {/* ─ Grand KPI ─ */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Tổng Căn", value: totals.total, icon: Home, color: "text-slate-700 dark:text-slate-300" },
          { label: "Còn Trống", value: totals.available, icon: CheckCircle2, color: "text-emerald-600 dark:text-emerald-400" },
          { label: "Đã Bán", value: totals.sold, icon: TrendingUp, color: "text-blue-600 dark:text-blue-400" },
        ].map(k => (
          <div key={k.label} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
              <k.icon className={`w-5 h-5 ${k.color}`} />
            </div>
            <div>
              <p className="text-2xl font-black text-slate-900 dark:text-white">{k.value}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">{k.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ─ Project Grid ─ */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center py-20 text-slate-400 dark:text-slate-500">
          <FolderKanban className="w-14 h-14 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-bold">Chưa có dự án nào</p>
          <p className="text-sm mt-1">Nhấn "Tạo Dự Án Mới" để bắt đầu</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {projects.map(proj => (
            <ProjectCard
              key={proj.id}
              project={proj}
              stats={statsMap[proj.id] ?? { total: 0, available: 0, booked: 0, deposited: 0, sold: 0 }}
              onView={setSelectedProject}
            />
          ))}
        </div>
      )}

      {/* ─ Add Project Modal ─ */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-800 overflow-hidden"
          >
            <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-xl font-black text-slate-900 dark:text-white">Thêm Dự Án Mới</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                <X className="w-4 h-4 text-slate-600 dark:text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleCreateProject} className="p-6 space-y-5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Tên Dự Án *</label>
                <input
                  type="text"
                  value={newProject.name}
                  onChange={e => setNewProject({ ...newProject, name: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-sm focus:outline-none focus:border-amber-500 transition-colors"
                  placeholder="Ví dụ: Bella Gold Tower"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Trạng Thái</label>
                <PremiumSelect
                  options={Object.entries(STATUS_LABEL).map(([k, v]) => ({ value: k, label: v }))}
                  value={newProject.status}
                  onChange={value => setNewProject({ ...newProject, status: value })}
                  placeholder="Chọn trạng thái..."
                  buttonClassName="py-3 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:border-amber-500 active:scale-100"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Mô Tả</label>
                <textarea
                  value={newProject.description}
                  onChange={e => setNewProject({ ...newProject, description: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-sm focus:outline-none focus:border-amber-500 h-24 resize-none"
                  placeholder="Mô tả sơ lược về dự án..."
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-3 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-black rounded-xl text-sm font-black transition-all flex items-center justify-center gap-2"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Xác Nhận Tạo
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* ─ Project Detail Popup Modal ─ */}
      {selectedProject && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedProject(null)}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-800 overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-xl font-black text-slate-900 dark:text-white">{selectedProject.name}</h2>
              <button
                onClick={() => setSelectedProject(null)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                <X className="w-4 h-4 text-slate-600 dark:text-slate-400" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${STATUS_COLOR[selectedProject.status ?? "planning"]}`}>
                  {STATUS_LABEL[selectedProject.status ?? "planning"]}
                </span>
              </div>
              {selectedProject.description && (
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed bg-slate-50 dark:bg-slate-800/20 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                  {selectedProject.description}
                </p>
              )}
              <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-800/50 rounded-2xl p-5 space-y-3">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Thống Kê Tồn Kho</p>
                {Object.entries(statsMap[selectedProject.id] ?? {}).map(([k, v]) => (
                  <div key={k} className="flex justify-between items-center text-sm">
                    <span className="text-slate-600 dark:text-slate-400 capitalize">{k}</span>
                    <span className="font-bold text-slate-900 dark:text-white bg-white dark:bg-slate-800 px-2.5 py-0.5 rounded-lg border border-slate-200 dark:border-slate-700">{v}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500 text-center">ID: {selectedProject.id}</p>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
