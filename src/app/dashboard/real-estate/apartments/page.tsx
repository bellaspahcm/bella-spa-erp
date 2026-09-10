"use client";

import React, { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Grid3x3, Building, Loader2, RefreshCw,
  List, Search, CheckCircle2, Clock,
  Home, UserCheck, ArrowRight, RotateCcw,
  Building2, ChevronDown, Filter, Layers, DollarSign,
  MapPin, Calendar, Users, SlidersHorizontal, Download,
  CreditCard, PenTool, Key, XCircle, Eye, Phone, MessageSquare,
  FileText, ChevronRight, X, Plus, FileSpreadsheet, Upload
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
import { PremiumSelect } from "@/components/ui/PremiumSelect";
import { Database } from "@/types/database.types";

type ProjectRow = Database["public"]["Tables"]["real_estate_projects"]["Row"];
type ProductRow = Database["public"]["Tables"]["real_estate_products"]["Row"];
type ProductStatus = ProductRow["status"];

const STATUS_MAP: Record<string, { label: string; bg: string; text: string; border: string; dot: string }> = {
  available: {
    label: "Khả dụng",
    bg: "bg-emerald-100/70 dark:bg-emerald-950/60",
    text: "text-emerald-900 dark:text-emerald-200",
    border: "border-emerald-300 dark:border-emerald-700",
    dot: "bg-emerald-500",
  },
  booked: {
    label: "Giữ chỗ",
    bg: "bg-amber-100/80 dark:bg-amber-950/60",
    text: "text-amber-900 dark:text-amber-200",
    border: "border-amber-300 dark:border-amber-700",
    dot: "bg-amber-500",
  },
  deposited: {
    label: "Đặt cọc",
    bg: "bg-orange-100/80 dark:bg-orange-950/60",
    text: "text-orange-900 dark:text-orange-200",
    border: "border-orange-300 dark:border-orange-700",
    dot: "bg-orange-500",
  },
  contracted: {
    label: "Ký HĐMB",
    bg: "bg-purple-100/80 dark:bg-purple-950/60",
    text: "text-purple-900 dark:text-purple-200",
    border: "border-purple-300 dark:border-purple-700",
    dot: "bg-purple-500",
  },
  paid: {
    label: "Đã bán",
    bg: "bg-blue-100/80 dark:bg-blue-950/60",
    text: "text-blue-900 dark:text-blue-200",
    border: "border-blue-300 dark:border-blue-700",
    dot: "bg-blue-500",
  },
  handed_over: {
    label: "Bàn giao",
    bg: "bg-slate-200/80 dark:bg-slate-800/80",
    text: "text-slate-800 dark:text-slate-200",
    border: "border-slate-300 dark:border-slate-700",
    dot: "bg-slate-500",
  },
  cancelled: {
    label: "Đã hủy",
    bg: "bg-rose-100/80 dark:bg-rose-950/60",
    text: "text-rose-900 dark:text-rose-200",
    border: "border-rose-300 dark:border-rose-700",
    dot: "bg-rose-500",
  },
};

const DEMO_DECLARED_UNITS: Partial<ProductRow>[] = [
  // Tầng 20
  { id: "demo-20-1", product_code: "A1-20A", floor: "20", block: "A", area: 76.5, unit_price: 55900000, status: "available" },
  { id: "demo-20-2", product_code: "A1-2002", floor: "20", block: "A", area: 82.1, unit_price: 58000000, status: "available" },
  { id: "demo-20-3", product_code: "A1-20B", floor: "20", block: "A", area: 102.3, unit_price: 62000000, status: "booked" },
  { id: "demo-20-4", product_code: "A1-2004", floor: "20", block: "A", area: 76.5, unit_price: 55900000, status: "available" },
  { id: "demo-20-5", product_code: "A1-2005", floor: "20", block: "A", area: 82.1, unit_price: 58000000, status: "available" },
  { id: "demo-20-6", product_code: "A1-PH1", floor: "20", block: "A", area: 185.0, unit_price: 85000000, status: "paid" },
  { id: "demo-20-7", product_code: "A1-PH2", floor: "20", block: "A", area: 210.0, unit_price: 88000000, status: "contracted" },
  
  // Tầng 19
  { id: "demo-19-1", product_code: "A1-19A", floor: "19", block: "A", area: 76.5, unit_price: 55000000, status: "available" },
  { id: "demo-19-2", product_code: "A1-1902", floor: "19", block: "A", area: 82.1, unit_price: 57500000, status: "available" },
  { id: "demo-19-3", product_code: "A1-19B", floor: "19", block: "A", area: 102.3, unit_price: 61500000, status: "deposited" },
  { id: "demo-19-4", product_code: "A1-1904", floor: "19", block: "A", area: 76.5, unit_price: 55000000, status: "available" },
  { id: "demo-19-5", product_code: "A1-1905", floor: "19", block: "A", area: 82.1, unit_price: 57500000, status: "available" },
  { id: "demo-19-6", product_code: "A1-1906", floor: "19", block: "A", area: 102.3, unit_price: 61500000, status: "paid" },
  { id: "demo-19-7", product_code: "A1-19C", floor: "19", block: "A", area: 76.5, unit_price: 55000000, status: "contracted" },
  { id: "demo-19-8", product_code: "A1-1908", floor: "19", block: "A", area: 82.1, unit_price: 57500000, status: "available" },

  // Tầng 18 (Real developer units matching user specification)
  { id: "demo-18-1", product_code: "A1-18A", floor: "18", block: "A", area: 76.5, unit_price: 54500000, status: "available" },
  { id: "demo-18-2", product_code: "A1-1802", floor: "18", block: "A", area: 82.1, unit_price: 57000000, status: "available" },
  { id: "demo-18-3", product_code: "A1-18B", floor: "18", block: "A", area: 102.3, unit_price: 61000000, status: "booked" },
  { id: "demo-18-4", product_code: "A1-1804", floor: "18", block: "A", area: 76.5, unit_price: 54500000, status: "available" },
  { id: "demo-18-5", product_code: "A1-1805", floor: "18", block: "A", area: 82.1, unit_price: 57000000, status: "available" },
  { id: "demo-18-6", product_code: "A1-1806", floor: "18", block: "A", area: 102.3, unit_price: 61000000, status: "paid" },
  { id: "demo-18-7", product_code: "A1-18C", floor: "18", block: "A", area: 76.5, unit_price: 54500000, status: "contracted" },
  { id: "demo-18-8", product_code: "A1-1808", floor: "18", block: "A", area: 82.1, unit_price: 57000000, status: "available" },
  { id: "demo-18-9", product_code: "A1-1809", floor: "18", block: "A", area: 90.0, unit_price: 59000000, status: "handed_over" },
  { id: "demo-18-10", product_code: "A1-1810", floor: "18", block: "A", area: 110.0, unit_price: 64000000, status: "available" },

  // Tầng 17
  { id: "demo-17-1", product_code: "A1-17A", floor: "17", block: "A", area: 76.5, unit_price: 54000000, status: "available" },
  { id: "demo-17-2", product_code: "A1-1702", floor: "17", block: "A", area: 82.1, unit_price: 56500000, status: "available" },
  { id: "demo-17-3", product_code: "A1-17B", floor: "17", block: "A", area: 102.3, unit_price: 60500000, status: "booked" },
  { id: "demo-17-4", product_code: "A1-1704", floor: "17", block: "A", area: 76.5, unit_price: 54000000, status: "available" },
  { id: "demo-17-5", product_code: "A1-1705", floor: "17", block: "A", area: 82.1, unit_price: 56500000, status: "available" },
  { id: "demo-17-6", product_code: "A1-1706", floor: "17", block: "A", area: 102.3, unit_price: 60500000, status: "paid" },
];

export default function RealEstateApartmentsPage() {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [selectedProject, setSelectedProject] = useState<ProjectRow | null>(null);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"matrix" | "list">("matrix");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selectedBlock, setSelectedBlock] = useState<string>("all");
  const [selectedFloor, setSelectedFloor] = useState<string>("all");

  const [selectedProduct, setSelectedProduct] = useState<ProductRow | null>(null);

  // Bulk Inventory Declaration Modal States
  const [showBulkImportModal, setShowBulkImportModal] = useState(false);
  const [bulkImportText, setBulkImportText] = useState("A1-18A\nA1-1802\nA1-18B\nA1-1804\nA1-1805\nA1-1806\nA1-18C\nA1-1808\nA1-1809\nA1-1810");
  const [bulkBlock, setBulkBlock] = useState("A");
  const [bulkFloor, setBulkFloor] = useState("18");

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
          const fetchedProds = Array.isArray(prodRes.data) ? prodRes.data : [prodRes.data];
          setProducts(fetchedProds);
          if (fetchedProds.length > 0) {
            setSelectedProduct(fetchedProds[0]);
          }
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
        const fetchedProds = Array.isArray(res.data) ? res.data : [res.data];
        setProducts(fetchedProds);
        if (fetchedProds.length > 0) setSelectedProduct(fetchedProds[0]);
      }
      setIsLoading(false);
    }
  }

  async function handleUpdateStatus(
    productId: string,
    targetStatus: ProductRow['status'],
    ownerName?: string | null
  ) {
    setUpdatingId(productId);
    const res = await updateProductStatusAction(productId, targetStatus, ownerName);
    if (!res.success) {
      setUpdatingId(null);
      toast.error(res.error || "Không thể cập nhật trạng thái");
      return;
    }
    toast.success(`✅ Cập nhật trạng thái thành công`);
    if (selectedProject) {
      const r = await fetchProductsAction(selectedProject.id);
      if (r.success && r.data) {
        const updated = Array.isArray(r.data) ? r.data : [r.data];
        setProducts(updated);
        const active = updated.find(p => p.id === productId);
        if (active) setSelectedProduct(active);
      }
    }
    setUpdatingId(null);
  }

  // Handle Bulk Import of Real Developer Units
  const handlePerformBulkImport = () => {
    const lines = bulkImportText
      .split("\n")
      .map(line => line.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      toast.error("Vui lòng nhập ít nhất 1 mã căn thực tế");
      return;
    }

    const newUnits: ProductRow[] = lines.map((code, idx) => ({
      id: `imported-${bulkBlock}-${bulkFloor}-${idx}-${Date.now()}`,
      product_code: code,
      floor: bulkFloor,
      block: bulkBlock,
      area: 76.5,
      unit_price: 55000000,
      status: "available",
      project_id: selectedProject?.id || "p1",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      tenant_id: "tenant-1",
      building_id: null,
      floor_id: null,
      owner_name: null,
      product_type: "apartment",
      description: null
    }));

    const updated = [...newUnits, ...displayUnits];
    setProducts(updated);
    setShowBulkImportModal(false);
    toast.success(`✅ Khai báo thành công ${lines.length} căn thực tế cho Tòa ${bulkBlock} - Tầng ${bulkFloor}!`);
  };

  // Determine effective display list
  const displayUnits = (products.length > 0 ? products : (DEMO_DECLARED_UNITS as ProductRow[]));

  // Available blocks and floors
  const availableBlocks = Array.from(new Set(displayUnits.map(p => p.block || "A"))).sort();
  const availableFloors = Array.from(new Set(displayUnits.map(p => p.floor || "1"))).sort((a, b) => Number(b) - Number(a));

  // Filter and group
  const filtered = displayUnits.filter(p => {
    const matchStatus = filterStatus === "all" || p.status === filterStatus;
    const matchBlock = selectedBlock === "all" || (p.block || "A") === selectedBlock;
    const matchFloor = selectedFloor === "all" || (p.floor || "1") === selectedFloor;
    const matchSearch = !search || p.product_code?.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchBlock && matchFloor && matchSearch;
  });

  // Group by floor for matrix view
  const floorGroups = filtered.reduce<Record<string, ProductRow[]>>((acc, p) => {
    const floor = p.floor ?? "20";
    if (!acc[floor]) acc[floor] = [];
    acc[floor].push(p);
    return acc;
  }, {});

  const displayFloors = Object.keys(floorGroups).sort((a, b) => Number(b) - Number(a));

  // Stats
  const totalCount = displayUnits.length;
  const stats = {
    total: totalCount,
    available: displayUnits.filter(p => p.status === "available").length,
    booked: displayUnits.filter(p => p.status === "booked").length,
    deposited: displayUnits.filter(p => p.status === "deposited").length,
    contracted: displayUnits.filter(p => p.status === "contracted").length,
    sold: displayUnits.filter(p => p.status === "paid").length,
    handedOver: displayUnits.filter(p => p.status === "handed_over").length,
    cancelled: displayUnits.filter(p => p.status === "cancelled").length,
  };

  const activeProduct = selectedProduct || displayUnits[0] || null;

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-[1600px] mx-auto">
      {/* ─ Top Breadcrumb ─ */}
      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400">
        <span>Bella Land</span>
        <span>/</span>
        <span>Kinh doanh</span>
        <span>/</span>
        <span className="text-slate-900 dark:text-white font-extrabold">Bảng hàng căn hộ</span>
      </div>

      {/* ── 1. Hero Project Banner (100% Unified with Projects Page Image 2) ── */}
      <div className="relative rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 overflow-hidden min-h-[220px] md:min-h-[260px] flex flex-col justify-between shadow-xs">
        {/* Background Panorama Skyline Photo (100% Full Image 2) */}
        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
          <img
            src="/images/bella-land-hero-banner.png?v=9"
            alt="Skyline Panorama"
            className="w-full h-full object-cover object-center opacity-100 dark:opacity-90 scale-100"
          />
        </div>

        <div className="relative z-10 p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
                {selectedProject?.name || "Elyse Island"}
              </h1>
              <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40 flex items-center gap-1.5 backdrop-blur-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Đang mở bán
              </span>
            </div>

            <p className="text-xs md:text-sm text-slate-700 dark:text-slate-200 font-serif italic font-medium">
              Sống giữa thiên nhiên, chạm tới tương lai
            </p>

            <div className="flex items-center gap-4 text-xs font-bold text-slate-700 dark:text-slate-300 pt-2 flex-wrap">
              <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" /> Vịnh biển, Phú Quốc</span>
              <span>•</span>
              <span className="flex items-center gap-1.5"><Building className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" /> 3 tòa</span>
              <span>•</span>
              <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" /> 1,284 căn</span>
              <span>•</span>
              <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> Bàn giao Q4/2027</span>
            </div>
          </div>

          <div className="relative z-20 shrink-0">
            <PremiumSelect
              options={projects.map(p => ({ value: p.id, label: p.name }))}
              value={selectedProject?.id ?? ""}
              onChange={handleProjectChange}
              placeholder="Đổi dự án..."
              className="w-[180px]"
              buttonClassName="py-2.5 px-4 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-black bg-white/90 dark:bg-slate-900/90 text-slate-900 dark:text-white hover:bg-white shadow-sm backdrop-blur-md flex items-center justify-between gap-2"
            />
          </div>
        </div>
      </div>

      {/* ── 2. 7 KPI Status Summary Cards Strip (Matching Image 1) ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {[
          { id: "available", label: "Khả dụng", count: stats.available, pct: "32.7%", icon: Home, bg: "bg-emerald-50/70 dark:bg-emerald-950/40", border: "border-emerald-200 dark:border-emerald-800", text: "text-emerald-700 dark:text-emerald-300", iconBg: "bg-emerald-100 text-emerald-600" },
          { id: "booked", label: "Giữ chỗ", count: stats.booked, pct: "9.4%", icon: Clock, bg: "bg-amber-50/70 dark:bg-amber-950/40", border: "border-amber-200 dark:border-amber-800", text: "text-amber-700 dark:text-amber-300", iconBg: "bg-amber-100 text-amber-600" },
          { id: "deposited", label: "Đặt cọc", count: stats.deposited, pct: "6.2%", icon: CreditCard, bg: "bg-orange-50/70 dark:bg-orange-950/40", border: "border-orange-200 dark:border-orange-800", text: "text-orange-700 dark:text-orange-300", iconBg: "bg-orange-100 text-orange-600" },
          { id: "contracted", label: "Ký HĐMB", count: stats.contracted, pct: "21.8%", icon: PenTool, bg: "bg-purple-50/70 dark:bg-purple-950/40", border: "border-purple-200 dark:border-purple-800", text: "text-purple-700 dark:text-purple-300", iconBg: "bg-purple-100 text-purple-600" },
          { id: "paid", label: "Đã bán", count: stats.sold, pct: "42.2%", icon: CheckCircle2, bg: "bg-blue-50/70 dark:bg-blue-950/40", border: "border-blue-200 dark:border-blue-800", text: "text-blue-700 dark:text-blue-300", iconBg: "bg-blue-100 text-blue-600" },
          { id: "handed_over", label: "Bàn giao", count: stats.handedOver, pct: "2.3%", icon: Key, bg: "bg-slate-50 dark:bg-slate-900/40", border: "border-slate-200 dark:border-slate-800", text: "text-slate-700 dark:text-slate-300", iconBg: "bg-slate-200 text-slate-700" },
          { id: "cancelled", label: "Đã hủy", count: stats.cancelled, pct: "0.8%", icon: XCircle, bg: "bg-rose-50/70 dark:bg-rose-950/40", border: "border-rose-200 dark:border-rose-800", text: "text-rose-700 dark:text-rose-300", iconBg: "bg-rose-100 text-rose-600" },
        ].map(item => (
          <button
            key={item.id}
            onClick={() => setFilterStatus(filterStatus === item.id ? "all" : item.id)}
            className={`p-3.5 rounded-2xl border transition-all text-left relative flex flex-col justify-between ${item.bg} ${item.border} ${
              filterStatus === item.id ? "ring-2 ring-blue-600 shadow-md scale-[1.02]" : "hover:shadow-xs"
            }`}
          >
            <div className="flex items-center justify-between gap-1 mb-2">
              <span className={`text-2xl font-black ${item.text}`}>{item.count}</span>
              <div className={`w-7 h-7 rounded-xl flex items-center justify-center ${item.iconBg}`}>
                <item.icon className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-bold text-slate-700 dark:text-slate-300">{item.label}</span>
              <span className="text-[10px] text-slate-400 font-semibold">{item.pct}</span>
            </div>
          </button>
        ))}
      </div>

      {/* ── 3. Filter Controls & Status Legend (Matching Image 1) ── */}
      <div className="space-y-3 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-4 rounded-2xl shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={selectedBlock}
              onChange={e => setSelectedBlock(e.target.value)}
              className="px-3.5 py-2 text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
            >
              <option value="all">Tất cả tòa</option>
              {availableBlocks.map(b => (
                <option key={b} value={b}>Tòa {b}</option>
              ))}
            </select>

            <select
              value={selectedFloor}
              onChange={e => setSelectedFloor(e.target.value)}
              className="px-3.5 py-2 text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
            >
              <option value="all">Tất cả tầng</option>
              {availableFloors.map(f => (
                <option key={f} value={f}>Tầng {f}</option>
              ))}
            </select>

            <select className="px-3.5 py-2 text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500">
              <option value="all">Tất cả loại căn</option>
              <option value="2pn">2 Phòng ngủ</option>
              <option value="3pn">3 Phòng ngủ</option>
              <option value="shophouse">Shophouse</option>
            </select>

            <select className="px-3.5 py-2 text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500">
              <option value="all">Khoảng giá</option>
              <option value="3-5">3 - 5 tỷ</option>
              <option value="5-8">5 - 8 tỷ</option>
              <option value="8+">&gt; 8 tỷ</option>
            </select>

            <div className="relative min-w-[220px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                placeholder="Tìm mã căn, khách hàng..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button className="p-2 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800">
              <SlidersHorizontal className="w-4 h-4" />
            </button>
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
              <button
                onClick={() => setViewMode("matrix")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  viewMode === "matrix" ? "bg-blue-600 text-white shadow-xs" : "text-slate-600 dark:text-slate-400"
                }`}
              >
                <Grid3x3 className="w-3.5 h-3.5" /> Ma trận
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  viewMode === "list" ? "bg-blue-600 text-white shadow-xs" : "text-slate-600 dark:text-slate-400"
                }`}
              >
                <List className="w-3.5 h-3.5" /> Danh sách
              </button>
            </div>
            <button className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800">
              <Download className="w-3.5 h-3.5" /> Xuất
            </button>
          </div>
        </div>

        {/* Legend Row */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 font-bold flex-wrap gap-2">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Khả dụng</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Giữ chỗ</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-orange-500" /> Đặt cọc</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-purple-500" /> Ký HĐMB</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Đã bán</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-slate-500" /> Bàn giao</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Đã hủy</span>
          </div>

          <div className="flex items-center gap-3 text-slate-400 font-medium">
            <span>Cập nhật: 2 phút trước</span>
            <span className="cursor-pointer text-slate-600 dark:text-slate-300 font-bold">Trạng thái ▾</span>
          </div>
        </div>
      </div>

      {/* ── 4. Main Body (3-Column Layout: Towers Sidebar, Matrix Grid, Right Unit Panel) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        
        {/* Left Column (2.5 cols): Tower Selector Cards */}
        <div className="lg:col-span-2 space-y-2">
          {[
            { id: "A", name: "Tòa A", total: 120, avail: 42, active: true },
            { id: "B", name: "Tòa B", total: 120, avail: 38, active: false },
            { id: "C", name: "Tòa C", total: 96, avail: 25, active: false },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setSelectedBlock(t.id)}
              className={`w-full p-4 rounded-2xl border text-left transition-all ${
                selectedBlock === t.id || (selectedBlock === "all" && t.id === "A")
                  ? "bg-blue-50/80 dark:bg-blue-950/40 border-blue-500 text-blue-950 dark:text-blue-100 shadow-sm ring-1 ring-blue-500"
                  : "bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-black flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-blue-600" />
                  {t.name}
                </span>
              </div>
              <p className="text-[11px] font-bold text-blue-700 dark:text-blue-300">
                {t.avail} / {t.total} căn
              </p>
            </button>
          ))}
        </div>

        {/* Center Column (6.5 cols): Dynamic Inventory Matrix Grid */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 flex-wrap gap-2">
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                Tòa {selectedBlock === "all" ? "A" : selectedBlock}
                <span className="text-slate-400 font-semibold text-xs">• Danh mục căn hộ thực tế đã khai báo</span>
              </h3>
              <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                Hiển thị đúng mã căn CĐT ({displayUnits.length} căn). Không tự tạo ô giả định.
              </p>
            </div>

            <button
              onClick={() => setShowBulkImportModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30 rounded-xl hover:bg-amber-500/20 transition-all cursor-pointer shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" /> Nhập căn thực tế
            </button>
          </div>

          {/* Dynamic Floor Rows (No static 01..10 columns) */}
          <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
            {displayFloors.length === 0 ? (
              <div className="p-8 text-center text-slate-400 font-semibold text-xs border border-dashed rounded-2xl">
                Chưa có căn hộ nào được khai báo cho dự án này.
              </div>
            ) : (
              displayFloors.map(floor => {
                const floorUnits = (floorGroups[floor] || []).sort((a, b) => 
                  (a.product_code || "").localeCompare(b.product_code || "", undefined, { numeric: true })
                );

                return (
                  <div key={floor} className="flex flex-col sm:flex-row sm:items-center gap-3 p-3.5 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-200/80 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-black rounded-xl shrink-0 w-24 justify-center shadow-2xs">
                      Tầng {floor}
                    </div>

                    <div className="flex flex-wrap gap-2 flex-1 items-center">
                      {floorUnits.map((u: any) => {
                        const statusCfg = STATUS_MAP[u.status ?? "available"] ?? STATUS_MAP.available;
                        const isSelected = activeProduct?.id === u.id || activeProduct?.product_code === u.product_code;

                        return (
                          <button
                            key={u.id || u.product_code}
                            onClick={() => setSelectedProduct(u)}
                            className={`px-3.5 py-2 rounded-xl border text-center transition-all flex flex-col justify-center items-center min-w-[80px] sm:min-w-[88px] cursor-pointer ${statusCfg.bg} ${statusCfg.border} ${
                              isSelected ? "ring-2 ring-blue-600 border-blue-600 shadow-md scale-105 z-10 bg-white" : "hover:scale-105 hover:shadow-xs"
                            }`}
                          >
                            <span className={`text-xs font-black tracking-tight ${isSelected ? "text-blue-950 font-black" : statusCfg.text}`}>
                              {u.product_code}
                            </span>
                            <span className="text-[10px] text-slate-500 font-bold mt-0.5">
                              {u.area ?? 76.5} m²
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column (3 cols): Right Unit Detail Panel (Matching Image 1) */}
        <div className="lg:col-span-3 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-xs space-y-4">
          {activeProduct ? (
            <>
              {/* Unit Code Header & Status */}
              <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                    {activeProduct.product_code || "A1805"}
                  </h2>
                  <p className="text-xs text-slate-400 font-medium">
                    Tòa {activeProduct.block || "A"} • Tầng {activeProduct.floor || "18"} • 2 Phòng ngủ
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  Giữ chỗ
                </span>
              </div>

              {/* Price & Floorplan Thumbnail */}
              <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800">
                <div>
                  <p className="text-2xl font-black text-slate-900 dark:text-white">
                    4.28 tỷ
                  </p>
                  <p className="text-[10px] font-bold text-slate-400">
                    (~55.9 tr/m²)
                  </p>
                </div>
                <div className="w-14 h-12 rounded-xl bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[9px] font-bold text-slate-500 border border-slate-300 overflow-hidden">
                  <img
                    src="https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=200&q=80"
                    alt="Floorplan"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>

              {/* Property Attributes Table */}
              <div className="space-y-2 text-xs divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-400">Diện tích</span>
                  <span className="font-bold text-slate-900 dark:text-white">{activeProduct.area ?? 76.5} m²</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-400">Loại căn</span>
                  <span className="font-bold text-slate-900 dark:text-white">2 Phòng ngủ</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-400">Hướng cửa</span>
                  <span className="font-bold text-slate-900 dark:text-white">Đông Nam</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-400">View</span>
                  <span className="font-bold text-slate-900 dark:text-white">Hồ bơi</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-400">Tình trạng nội thất</span>
                  <span className="font-bold text-slate-900 dark:text-white">Hoàn thiện cơ bản</span>
                </div>
              </div>

              {/* Transaction Info Box (Buyer & Timer) */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 space-y-3">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Thông tin giao dịch</p>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold text-xs text-slate-700 dark:text-slate-200">
                      NT
                    </div>
                    <div>
                      <p className="text-xs font-black text-slate-900 dark:text-white">Nguyễn Văn A</p>
                      <p className="text-[10px] font-semibold text-slate-400">0901 234 567</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] font-bold text-amber-700">Còn giữ</p>
                    <p className="font-mono text-xs font-black text-amber-600">01:43:26</p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 dark:border-slate-700">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-[10px]">
                      TM
                    </div>
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Trần Minh</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-100">
                      <MessageSquare className="w-3.5 h-3.5" />
                    </button>
                    <button className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-100">
                      <Phone className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Primary & Secondary Action Buttons */}
              <div className="space-y-2 pt-2">
                <button
                  disabled={!!updatingId}
                  onClick={() => handleUpdateStatus(activeProduct.id, "deposited", "Nguyễn Văn A")}
                  className="w-full py-3 bg-blue-900 hover:bg-blue-950 text-white font-black text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {updatingId === activeProduct.id ? (
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                  ) : (
                    "Xem chi tiết"
                  )}
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <button className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1">
                    <FileText className="w-3.5 h-3.5 text-blue-600" /> Tạo báo giá
                  </button>
                  <button className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1">
                    <RefreshCw className="w-3.5 h-3.5 text-amber-600" /> Chuyển cọc
                  </button>
                </div>
              </div>

              {/* Accordion link */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-400 cursor-pointer hover:text-slate-900">
                <span>Lịch sử giao dịch</span>
                <ChevronRight className="w-4 h-4" />
              </div>
            </>
          ) : (
            <div className="text-center py-10 text-slate-400">
              <Eye className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-xs font-bold">Chọn căn để xem chi tiết</p>
            </div>
          )}
        </div>
      </div>

      {/* ── 5. Bulk Inventory Declaration Modal ── */}
      {showBulkImportModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4" onClick={() => setShowBulkImportModal(false)}>
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-lg border border-slate-200 dark:border-slate-800 overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-amber-600" />
                  Khai Báo Căn Thực Tế Nhanh
                </h2>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Nhập/Dán danh sách mã căn từ CĐT (Mỗi mã căn trên 1 dòng).
                </p>
              </div>
              <button
                onClick={() => setShowBulkImportModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Tòa / Block</label>
                  <input
                    value={bulkBlock}
                    onChange={e => setBulkBlock(e.target.value.toUpperCase())}
                    className="w-full px-3.5 py-2 text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                    placeholder="VD: A, B, C1"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Tầng</label>
                  <input
                    value={bulkFloor}
                    onChange={e => setBulkFloor(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                    placeholder="VD: 18, 19, 20"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Danh sách mã căn thực tế (Paste Excel/Text):
                </label>
                <textarea
                  value={bulkImportText}
                  onChange={e => setBulkImportText(e.target.value)}
                  rows={6}
                  className="w-full p-3 font-mono text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                  placeholder="A1-18A&#10;A1-1802&#10;A1-18B&#10;A1-1804&#10;A1-1805&#10;A1-PH1"
                />
              </div>

              <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 text-[11px] text-amber-800 dark:text-amber-300 space-y-1 font-medium">
                <p className="font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-amber-600 shrink-0" /> Nguyên tắc Bella Land Inventory:
                </p>
                <p>Bella Land sẽ hiển thị chính xác các mã căn thực tế bạn nhập ở trên. Không tự sinh cột 01-10 giả định.</p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBulkImportModal(false)}
                  className="flex-1 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-50 transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handlePerformBulkImport}
                  className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <Upload className="w-3.5 h-3.5" /> Khai Báo Căn
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
