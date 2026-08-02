"use client";

import React, { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Grid3x3, Building, Loader2, RefreshCw,
  List, Search, CheckCircle2, Clock,
  Home, UserCheck, ArrowRight, RotateCcw
} from "lucide-react";
import { toast } from "sonner";
import {
  fetchProjectsAction,
} from "@/modules/real_estate/actions/projectActions";
import {
  fetchProductsAction,
  updateProductStatusAction,
  updateProductDetailsAction,
} from "@/modules/real_estate/actions/productActions";
import { UnitDetailModal } from "@/modules/real_estate/components/UnitDetailModal";
import { PremiumSelect } from "@/components/ui/PremiumSelect";
import { Database } from "@/types/database.types";

type ProjectRow = Database["public"]["Tables"]["real_estate_projects"]["Row"];
type ProductRow = Database["public"]["Tables"]["real_estate_products"]["Row"];

type ProductStatus = ProductRow["status"];

const STATUS_CFG: Record<string, { label: string; short: string; bg: string; text: string; border: string; dot: string }> = {
  available: {
    label: "Còn Trống", short: "TRỐNG",
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
    text: "text-emerald-700 dark:text-emerald-400",
    border: "border-emerald-200 dark:border-emerald-700/40",
    dot: "bg-emerald-500",
  },
  booked: {
    label: "Đã Giữ Chỗ", short: "GIỮ",
    bg: "bg-amber-50 dark:bg-amber-950/30",
    text: "text-amber-700 dark:text-amber-400",
    border: "border-amber-200 dark:border-amber-700/40",
    dot: "bg-amber-500",
  },
  deposited: {
    label: "Đã Đặt Cọc", short: "CỌC",
    bg: "bg-orange-50 dark:bg-orange-950/30",
    text: "text-orange-700 dark:text-orange-400",
    border: "border-orange-200 dark:border-orange-700/40",
    dot: "bg-orange-500",
  },
  paid: {
    label: "Đã Bán", short: "BÁN",
    bg: "bg-blue-50 dark:bg-blue-950/30",
    text: "text-blue-700 dark:text-blue-400",
    border: "border-blue-200 dark:border-blue-700/40",
    dot: "bg-blue-500",
  },
  cancelled: {
    label: "Đã Hủy", short: "HỦY",
    bg: "bg-slate-100 dark:bg-slate-800/40",
    text: "text-slate-500 dark:text-slate-400",
    border: "border-slate-200 dark:border-slate-700/40",
    dot: "bg-slate-400",
  },
};

function UnitCell({
  product,
  onAction,
  isUpdating,
  onClick,
}: {
  product: ProductRow;
  onAction: (id: string, from: ProductStatus, to: ProductStatus) => void;
  isUpdating: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const cfg = STATUS_CFG[product.status ?? "available"] ?? STATUS_CFG.available;

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`relative border rounded-xl p-2.5 transition-all duration-200 cursor-pointer min-w-0 ${cfg.bg} ${cfg.border} ${hovered ? "scale-105 shadow-lg z-10" : ""}`}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-black text-slate-700 dark:text-slate-300 truncate">{product.product_code}</span>
        <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
      </div>
      <p className={`text-[9px] font-bold uppercase tracking-wide ${cfg.text}`}>{cfg.short}</p>
      {product.area && (
        <p className="text-[9px] text-slate-400 dark:text-slate-500 mt-0.5">{product.area}m²</p>
      )}

      {/* Hover action tooltip */}
      {hovered && !isUpdating && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-20 bg-slate-900 dark:bg-slate-800 rounded-xl shadow-2xl p-3 w-48 border border-slate-700">
          <p className="text-xs font-black text-white mb-1">{product.product_code}</p>
          <p className="text-[10px] text-slate-400 mb-2">
            Tầng {product.floor ?? "?"} · Block {product.block ?? "?"} · {product.area ?? 0}m²
          </p>
          {product.unit_price > 0 && (
            <p className="text-[10px] text-amber-400 font-bold mb-2">
              {((product.unit_price * (product.area ?? 0)) / 1e9).toFixed(2)} tỷ
            </p>
          )}
          {product.owner_name && (
            <p className="text-[10px] text-blue-400 flex items-center gap-1 mb-2">
              <UserCheck className="w-3 h-3" />{product.owner_name}
            </p>
          )}
          <div className="space-y-1">
            {product.status === "available" && (
              <button
                onClick={e => { e.stopPropagation(); onAction(product.id, "available", "booked"); }}
                className="w-full py-1 bg-amber-500 hover:bg-amber-600 text-black text-[10px] font-black rounded-lg transition-colors"
              >
                Đặt Giữ Chỗ
              </button>
            )}
            {product.status === "booked" && (
              <>
                <button
                  onClick={e => { e.stopPropagation(); onAction(product.id, "booked", "deposited"); }}
                  className="w-full py-1 bg-orange-500 hover:bg-orange-600 text-white text-[10px] font-black rounded-lg transition-colors"
                >
                  Xác Nhận Cọc
                </button>
                <button
                  onClick={e => { e.stopPropagation(); onAction(product.id, "booked", "available"); }}
                  className="w-full py-1 bg-slate-700 hover:bg-slate-600 text-white text-[10px] font-bold rounded-lg transition-colors"
                >
                  Hủy Giữ
                </button>
              </>
            )}
            {product.status === "deposited" && (
              <button
                onClick={e => { e.stopPropagation(); onAction(product.id, "deposited", "paid"); }}
                className="w-full py-1 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black rounded-lg transition-colors"
              >
                Ký HĐMB → Bán
              </button>
            )}
          </div>
        </div>
      )}

      {isUpdating && (
        <div className="absolute inset-0 bg-white/60 dark:bg-slate-900/60 rounded-xl flex items-center justify-center">
          <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
        </div>
      )}
    </div>
  );
}

function FloorGroup({
  floor,
  products,
  onAction,
  updatingId,
  onSelectProduct,
}: {
  floor: string;
  products: ProductRow[];
  onAction: (id: string, from: ProductStatus, to: ProductStatus) => void;
  updatingId: string | null;
  onSelectProduct: (product: ProductRow) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest w-14 shrink-0">
          T.{floor}
        </span>
        <div className="flex-1 h-px bg-slate-100 dark:bg-slate-800" />
        <span className="text-[10px] text-slate-400 dark:text-slate-500 shrink-0">{products.length} căn</span>
      </div>
      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 xl:grid-cols-12 gap-1.5 ml-16">
        {products.map(p => (
          <UnitCell
            key={p.id}
            product={p}
            onAction={onAction}
            isUpdating={updatingId === p.id}
            onClick={() => onSelectProduct(p)}
          />
        ))}
      </div>
    </div>
  );
}

export default function RealEstateApartmentsPage() {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [selectedProject, setSelectedProject] = useState<ProjectRow | null>(null);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"matrix" | "list">("matrix");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [search, setSearch] = useState("");

  const [selectedProduct, setSelectedProduct] = useState<ProductRow | null>(null);
  // Always resolve from updated products array so modal shows fresh data after save
  const activeProduct = selectedProduct
    ? products.find(p => p.id === selectedProduct.id) || selectedProduct
    : null;

  const loadInitialData = useCallback(async () => {
    setIsLoading(true);
    const resProjects = await fetchProjectsAction();
    if (resProjects.success && resProjects.data) {
      const list = Array.isArray(resProjects.data) ? resProjects.data : [resProjects.data];
      setProjects(list);
      if (list.length > 0) {
        setSelectedProject(list[0]);
        const prodRes = await fetchProductsAction(list[0].id);
        if (prodRes.success && prodRes.data) {
          setProducts(Array.isArray(prodRes.data) ? prodRes.data : [prodRes.data]);
        }
      }
    }
    setIsLoading(false);
  }, []);

  useEffect(() => { loadInitialData(); }, [loadInitialData]);

  async function handleProjectChange(projId: string) {
    const proj = projects.find(p => p.id === projId) || null;
    setSelectedProject(proj);
    if (proj) {
      setIsLoading(true);
      const res = await fetchProductsAction(proj.id);
      if (res.success && res.data) {
        setProducts(Array.isArray(res.data) ? res.data : [res.data]);
      }
      setIsLoading(false);
    }
  }

  async function handleAction(productId: string, _from: ProductStatus, to: ProductStatus) {
    setUpdatingId(productId);
    const ownerName = to === "booked" ? "Khách hàng đặt giữ" : to === "deposited" ? "Khách hàng đặt cọc" : null;
    const res = await updateProductStatusAction(productId, to, ownerName);
    if (res.success) {
      toast.success(`✅ Chuyển trạng thái căn → ${STATUS_CFG[to]?.label}`);
      if (selectedProject) {
        const r = await fetchProductsAction(selectedProject.id);
        if (r.success && r.data) setProducts(Array.isArray(r.data) ? r.data : [r.data]);
      }
    } else {
      toast.error(res.error ?? "Không thể cập nhật trạng thái");
    }
    setUpdatingId(null);
  }

  async function handleUpdateStatus(
    productId: string,
    targetStatus: ProductRow['status'],
    ownerName?: string | null
  ) {
    const res = await updateProductStatusAction(productId, targetStatus, ownerName);
    if (!res.success) {
      throw new Error(res.error || "Không thể cập nhật trạng thái");
    }
    toast.success(`✅ Cập nhật trạng thái thành công`);
    if (selectedProject) {
      const r = await fetchProductsAction(selectedProject.id);
      if (r.success && r.data) setProducts(Array.isArray(r.data) ? r.data : [r.data]);
    }
  }

  async function handleUpdateDetails(
    productId: string,
    payload: {
      unit_price?: number;
      area?: number;
      product_code?: string;
      product_type?: string;
      block?: string | null;
      floor?: string | null;
    }
  ) {
    const res = await updateProductDetailsAction(productId, payload);
    if (!res.success) {
      throw new Error(res.error || "Không thể cập nhật thông tin");
    }
    toast.success(`✅ Cập nhật thông tin căn thành công`);
    if (selectedProject) {
      const r = await fetchProductsAction(selectedProject.id);
      if (r.success && r.data) setProducts(Array.isArray(r.data) ? r.data : [r.data]);
    }
  }

  // Filter and group
  const filtered = products.filter(p => {
    const matchStatus = filterStatus === "all" || p.status === filterStatus;
    const matchSearch = !search || p.product_code?.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  // Group by floor for matrix view
  const floorGroups = filtered.reduce<Record<string, ProductRow[]>>((acc, p) => {
    const floor = p.floor ?? "?";
    if (!acc[floor]) acc[floor] = [];
    acc[floor].push(p);
    return acc;
  }, {});
  const floors = Object.keys(floorGroups).sort((a, b) => Number(b) - Number(a));

  // Stats
  const stats = {
    total: products.length,
    available: products.filter(p => p.status === "available").length,
    booked: products.filter(p => p.status === "booked").length,
    deposited: products.filter(p => p.status === "deposited").length,
    sold: products.filter(p => p.status === "paid").length,
  };

  return (
    <div className="space-y-6">
      {/* ─ Header ─ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <Grid3x3 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            Bảng Hàng Căn Hộ
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Sơ đồ ma trận căn hộ theo tầng · Click vào căn hộ để chỉnh sửa giá hoặc cập nhật trạng thái
          </p>
        </div>

        {/* Project selector */}
        <div className="flex items-center gap-3 min-w-[220px]">
          <Building className="w-5 h-5 text-slate-400 shrink-0" />
          <PremiumSelect
            options={projects.map(p => ({ value: p.id, label: p.name }))}
            value={selectedProject?.id ?? ""}
            onChange={handleProjectChange}
            placeholder="Chọn dự án..."
            className="w-full max-w-[260px]"
            buttonClassName="py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-800 text-sm font-bold bg-white dark:bg-slate-900 focus:border-amber-500 focus:ring-amber-500/10 focus:ring-2 focus:ring-offset-0 focus:outline-none active:scale-100"
          />
        </div>
      </div>

      {/* ─ Status KPI strip ─ */}
      <div className="flex gap-3 flex-wrap">
        {Object.entries(STATUS_CFG).map(([k, cfg]) => {
          const count = products.filter(p => p.status === k).length;
          return (
            <button
              key={k}
              onClick={() => setFilterStatus(filterStatus === k ? "all" : k)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-bold transition-all ${
                filterStatus === k
                  ? `${cfg.bg} ${cfg.text} ${cfg.border} shadow-sm`
                  : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
              {cfg.label}
              <span className={`text-xs font-black px-1.5 py-0.5 rounded-md ${filterStatus === k ? cfg.bg : "bg-slate-100 dark:bg-slate-800"}`}>
                {count}
              </span>
            </button>
          );
        })}
        {filterStatus !== "all" && (
          <button
            onClick={() => setFilterStatus("all")}
            className="flex items-center gap-1 px-3 py-2 text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Tất cả
          </button>
        )}
      </div>

      {/* ─ Search + View toggle ─ */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            placeholder="Tìm mã căn..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-amber-500/50"
          />
        </div>
        <div className="flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-1">
          {[
            { mode: "matrix" as const, icon: Grid3x3, label: "Ma Trận" },
            { mode: "list" as const, icon: List, label: "Danh Sách" },
          ].map(({ mode, icon: Icon, label }) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === mode
                  ? "bg-amber-500 text-black shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 ml-auto">
          {filtered.length} / {products.length} căn
        </p>
      </div>

      {/* ─ Content ─ */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-20 text-slate-400 dark:text-slate-500">
          <Home className="w-14 h-14 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-bold">Dự án chưa có căn hộ nào</p>
          <p className="text-sm mt-1">Thêm sản phẩm qua phần quản lý dự án</p>
        </div>
      ) : viewMode === "matrix" ? (
        /* ─ Floor Matrix ─ */
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-5 overflow-visible">
          {floors.map(floor => (
            <FloorGroup
              key={floor}
              floor={floor}
              products={floorGroups[floor]}
              onAction={handleAction}
              updatingId={updatingId}
              onSelectProduct={setSelectedProduct}
            />
          ))}
        </div>
      ) : (
        /* ─ List View ─ */
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 dark:border-slate-800">
              <tr className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <th className="px-5 py-3 text-left">Mã Căn</th>
                <th className="px-5 py-3 text-left">Tầng</th>
                <th className="px-5 py-3 text-left">Block</th>
                <th className="px-5 py-3 text-right">DT (m²)</th>
                <th className="px-5 py-3 text-right">Đơn Giá</th>
                <th className="px-5 py-3 text-left">Trạng Thái</th>
                <th className="px-5 py-3 text-left">Khách Hàng</th>
                <th className="px-5 py-3 text-left">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.map(p => {
                const cfg = STATUS_CFG[p.status ?? "available"] ?? STATUS_CFG.available;
                return (
                  <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors cursor-pointer" onClick={() => setSelectedProduct(p)}>
                    <td className="px-5 py-3 font-black text-slate-900 dark:text-white">{p.product_code}</td>
                    <td className="px-5 py-3 text-slate-600 dark:text-slate-400">{p.floor ?? "—"}</td>
                    <td className="px-5 py-3 text-slate-600 dark:text-slate-400">{p.block ?? "—"}</td>
                    <td className="px-5 py-3 text-right text-slate-600 dark:text-slate-400">{p.area ?? "—"}</td>
                    <td className="px-5 py-3 text-right font-semibold text-slate-900 dark:text-white">
                      {p.unit_price > 0 ? `${(p.unit_price * (p.area ?? 0) / 1e9).toFixed(2)} tỷ` : "—"}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${cfg.bg} ${cfg.text} border ${cfg.border}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                        {cfg.label}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-600 dark:text-slate-400 text-sm">
                      {p.owner_name ?? <span className="text-slate-300 dark:text-slate-600">—</span>}
                    </td>
                    <td className="px-5 py-3" onClick={e => e.stopPropagation()}>
                      <div className="flex gap-1.5">
                        {p.status === "available" && (
                          <button
                            disabled={updatingId === p.id}
                            onClick={() => handleAction(p.id, "available", "booked")}
                            className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-black text-xs font-bold rounded-lg transition-all disabled:opacity-50"
                          >
                            Giữ
                          </button>
                        )}
                        {p.status === "booked" && (
                          <>
                            <button
                              disabled={updatingId === p.id}
                              onClick={() => handleAction(p.id, "booked", "deposited")}
                              className="px-2.5 py-1 bg-orange-50 hover:bg-orange-600 text-white text-xs font-bold rounded-lg transition-all disabled:opacity-50"
                            >
                              Cọc
                            </button>
                            <button
                              disabled={updatingId === p.id}
                              onClick={() => handleAction(p.id, "booked", "available")}
                              className="px-2.5 py-1 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-lg transition-all disabled:opacity-50"
                            >
                              Hủy
                            </button>
                          </>
                        )}
                        {p.status === "deposited" && (
                          <button
                            disabled={updatingId === p.id}
                            onClick={() => handleAction(p.id, "deposited", "paid")}
                            className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-all disabled:opacity-50"
                          >
                            Ký HĐ
                          </button>
                        )}
                        {updatingId === p.id && <Loader2 className="w-4 h-4 animate-spin text-amber-500" />}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 flex-wrap text-xs text-slate-500 dark:text-slate-400">
        <span className="font-bold">Màu sắc trạng thái:</span>
        {Object.entries(STATUS_CFG).map(([k, cfg]) => (
          <span key={k} className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
            {cfg.label}
          </span>
        ))}
      </div>

      {/* Unit Detail Modal */}
      <UnitDetailModal
        product={activeProduct}
        isOpen={!!selectedProduct}
        onClose={() => setSelectedProduct(null)}
        onUpdateStatus={handleUpdateStatus}
        onUpdateDetails={handleUpdateDetails}
      />
    </div>
  );
}
