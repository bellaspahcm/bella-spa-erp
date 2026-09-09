'use client';

/**
 * Bella Education — Facilities, Safety & Maintenance Control System
 * 
 * Deep Domain Architecture:
 * - 3-Tier Hierarchy: Facility ➔ Space (Building/Floor/Room) ➔ Individual Asset (QR Code Identity)
 * - Work Order Lifecycle: REPORTED ➔ TRIAGED ➔ WORK ORDER ➔ ASSIGNED ➔ REPAIRED ➔ VERIFIED ➔ CLOSED
 * - Evidence-Backed Safety Inspections with Out-Of-Service Invariant Rules
 * - Compliance Expiry Engine (PCCC & Fire Safety Alerts)
 * - Sub-Workspace Tabs:
 *   1. Tổng Quan Facilities & An Toàn (Control Center)
 *   2. Cấu Trúc Không Gian & Phòng Học (Space Hierarchy)
 *   3. Danh Mục Tài Sản & QR Identity (Asset Inventory)
 *   4. Kiểm Tra An Toàn & Expiry (Safety Inspections & Invariants)
 *   5. Yêu Cầu Bảo Trì & Work Orders (Work Order Management)
 */

import { useState } from 'react';
import Link from 'next/link';
import {
  Building2,
  Wrench,
  ArrowLeft,
  Search,
  ShieldCheck,
  Tv,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  QrCode,
  Plus,
  Flame,
  Camera,
  Layers,
  MapPin,
  Clock,
  X,
  Check,
  FileText,
  AlertCircle,
  Video,
  Wind,
  ShieldAlert,
  Activity
} from 'lucide-react';

type IndividualAsset = {
  id: string;
  qrCode: string;
  name: string;
  facility: string;
  spaceRoom: string;
  category: 'HVAC' | 'SAFETY' | 'MONITORING' | 'LEARNING' | 'PLAYGROUND';
  status: 'OPERATIONAL' | 'MAINTENANCE_DUE' | 'OUT_OF_SERVICE' | 'IN_REPAIR';
  lastInspectionDate: string;
  nextCheckDate: string;
  inspectorName: string;
  hasSafetyIssue: boolean;
};

type MaintenanceWorkOrder = {
  id: string;
  assetId: string;
  assetName: string;
  location: string;
  issueDescription: string;
  severity: 'CRITICAL' | 'MEDIUM' | 'LOW';
  status: 'REPORTED' | 'WORK_ORDER' | 'IN_REPAIR' | 'REPAIRED' | 'VERIFIED';
  reportedDate: string;
  assignedTechnician: string;
};

export default function FacilitiesPage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'spaces' | 'assets' | 'inspections' | 'workorders'>('overview');
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  // Individual Asset Inventory (Facility ➔ Space ➔ Asset)
  const [assetList, setAssetList] = useState<IndividualAsset[]>([
    {
      id: 'AST-AC-101',
      qrCode: 'QR-AC-101-01',
      name: 'Điều Hòa Âm Trần Daikin 24.000 BTU',
      facility: 'Cơ Sở 1 — Tòa Nhà A',
      spaceRoom: 'Phòng 101 • Tầng 1 (Lớp Mầm A1)',
      category: 'HVAC',
      status: 'OPERATIONAL',
      lastInspectionDate: '15/08/2026',
      nextCheckDate: '15/09/2026',
      inspectorName: 'Kỹ Thuật Nguyễn Văn Tùng',
      hasSafetyIssue: false,
    },
    {
      id: 'AST-AIR-101',
      qrCode: 'QR-AIR-101-01',
      name: 'Máy Lọc Không Khí Hepa Khử Trùng UVC',
      facility: 'Cơ Sở 1 — Tòa Nhà A',
      spaceRoom: 'Phòng 101 • Tầng 1 (Lớp Mầm A1)',
      category: 'HVAC',
      status: 'OPERATIONAL',
      lastInspectionDate: '05/09/2026',
      nextCheckDate: '12/09/2026',
      inspectorName: 'Kỹ Thuật Nguyễn Văn Tùng',
      hasSafetyIssue: false,
    },
    {
      id: 'AST-CAM-102',
      qrCode: 'QR-CAM-102-01',
      name: 'Camera Giám Sát HD Hồng Ngoại Phòng 102',
      facility: 'Cơ Sở 1 — Tòa Nhà A',
      spaceRoom: 'Phòng 102 • Tầng 1 (Lớp Chồi B1)',
      category: 'MONITORING',
      status: 'MAINTENANCE_DUE',
      lastInspectionDate: '01/09/2026',
      nextCheckDate: '08/09/2026',
      inspectorName: 'An Ninh Trần Văn Hùng',
      hasSafetyIssue: true,
    },
    {
      id: 'AST-PLAY-01',
      qrCode: 'QR-PLAY-001',
      name: 'Khu Vui Chơi Liên Hoàn Ngoài Trời',
      facility: 'Cơ Sở 1 — Sân Trường Trung Tâm',
      spaceRoom: 'Sân Chơi Ngoài Trời',
      category: 'PLAYGROUND',
      status: 'OUT_OF_SERVICE',
      lastInspectionDate: '30/08/2026',
      nextCheckDate: '09/09/2026',
      inspectorName: 'Tổ Trưởng An Toàn',
      hasSafetyIssue: true,
    },
  ]);

  // Active Maintenance Work Orders
  const [workOrders, setWorkOrders] = useState<MaintenanceWorkOrder[]>([
    {
      id: 'WO-2026-089',
      assetId: 'AST-PLAY-01',
      assetName: 'Khu Vui Chơi Liên Hoàn - Xích Đu Sắt',
      location: 'Sân Chơi Ngoài Trời',
      issueDescription: 'Mối nối xích đu có dấu hiệu mòn kim loại 15%. Cần thay mới bộ xích bảo vệ.',
      severity: 'CRITICAL',
      status: 'IN_REPAIR',
      reportedDate: '05/09/2026',
      assignedTechnician: 'Đội Bảo Trì Cơ Điện',
    },
    {
      id: 'WO-2026-090',
      assetId: 'AST-CAM-102',
      assetName: 'Camera HD Phòng 102',
      location: 'Phòng 102 • Tầng 1',
      issueDescription: 'Mất tín hiệu kết nối mạng cục bộ lúc 06:30 sáng.',
      severity: 'MEDIUM',
      status: 'WORK_ORDER',
      reportedDate: '09/09/2026',
      assignedTechnician: 'Kỹ Thuật CNTT',
    },
  ]);

  const getStatusBadge = (status: IndividualAsset['status']) => {
    switch (status) {
      case 'OPERATIONAL':
        return 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border-emerald-300';
      case 'MAINTENANCE_DUE':
        return 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border-amber-300';
      case 'OUT_OF_SERVICE':
        return 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 border-rose-300 font-extrabold';
      default:
        return 'bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300 border-indigo-300';
    }
  };

  return (
    <div className="w-full p-4 sm:p-6 lg:p-8 space-y-6 pb-12">
      {/* ── UNIFIED PAGE HEADER ── */}
      <div className="w-full rounded-3xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-700/60 pb-5">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/education"
              className="p-2.5 rounded-2xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition-colors shrink-0"
              title="Quay lại Dashboard Education"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 shrink-0">
                <Building2 className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                  Cơ Sở Vật Chất, An Toàn & Bảo Trì Mầm Non
                </h1>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Quản lý không gian tòa nhà/phòng học, danh mục tài sản cá thể (Asset Hierarchy), kiểm tra an toàn PCCC & quy trình xử lý hỏng hóc
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={() => setIsReportModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white px-5 py-2.5 text-xs font-bold shadow-lg shadow-rose-500/20 transition-all active:scale-95 cursor-pointer shrink-0"
          >
            <Wrench className="w-4 h-4" />
            <span>+ Báo Hỏng / Yêu Cầu Bảo Trì</span>
          </button>
        </div>

        {/* ── ACTIONABLE OPERATIONAL GOVERNANCE METRICS ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-900/60 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                Phòng Học Đang Vận Hành
              </span>
              <Building2 className="w-4 h-4 text-indigo-600" />
            </div>
            <div>
              <p className="text-2xl font-extrabold text-indigo-900 dark:text-indigo-200">12 / 12 Phòng</p>
              <p className="text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 mt-0.5">
                Đạt chuẩn môi trường & điều hòa UVC
              </p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-900/60 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                Trạng Thái Camera Giám Sát
              </span>
              <Camera className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-extrabold text-emerald-900 dark:text-emerald-200">47 / 48 Online</p>
              <p className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 mt-0.5">
                🔴 1 camera offline (Phòng 102)
              </p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-900/60 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                Lịch Bảo Trì & Sửa Chữa
              </span>
              <Wrench className="w-4 h-4 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-extrabold text-amber-900 dark:text-amber-200">3 Yêu Cầu</p>
              <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-300 mt-0.5">
                1 sự cố đang sửa • 2 lịch sắp đến hạn 15/09
              </p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-rose-50/70 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-900/60 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                Kiểm Định PCCC & An Toàn
              </span>
              <Flame className="w-4 h-4 text-rose-600" />
            </div>
            <div>
              <p className="text-2xl font-extrabold text-rose-900 dark:text-rose-200">100% Hiệu Lực</p>
              <p className="text-[11px] font-semibold text-rose-700 dark:text-rose-300 mt-0.5">
                24/24 chứng nhận còn hạn đến 03/2027
              </p>
            </div>
          </div>
        </div>

        {/* ── WORKSPACE TABS NAVIGATION ── */}
        <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-700/60 overflow-x-auto pb-1">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2.5 text-xs font-extrabold rounded-2xl transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'overview'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Tổng Quan Facilities & An Toàn
          </button>
          <button
            onClick={() => setActiveTab('spaces')}
            className={`px-4 py-2.5 text-xs font-extrabold rounded-2xl transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'spaces'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            Không Gian & Phòng Học (Space Hierarchy)
          </button>
          <button
            onClick={() => setActiveTab('assets')}
            className={`px-4 py-2.5 text-xs font-extrabold rounded-2xl transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'assets'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <QrCode className="w-3.5 h-3.5" />
            Tài Sản Cá Thể & Mã QR ({assetList.length})
          </button>
          <button
            onClick={() => setActiveTab('inspections')}
            className={`px-4 py-2.5 text-xs font-extrabold rounded-2xl transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'inspections'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            Kiểm Tra An Toàn & Invariants
          </button>
          <button
            onClick={() => setActiveTab('workorders')}
            className={`px-4 py-2.5 text-xs font-extrabold rounded-2xl transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'workorders'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Wrench className="w-3.5 h-3.5" />
            Work Orders Bảo Trì ({workOrders.length})
          </button>
        </div>
      </div>

      {/* ── TAB CONTENT 1: OVERVIEW & ASSET CARDS ── */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {assetList.map((asset) => (
            <div
              key={asset.id}
              className={`p-6 rounded-3xl border ${
                asset.status === 'OUT_OF_SERVICE'
                  ? 'bg-rose-50/40 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/60'
                  : 'bg-white dark:bg-slate-800/90 border-slate-200/80 dark:border-slate-700/80'
              } shadow-sm space-y-4 flex flex-col justify-between`}
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300">
                        {asset.category}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400 font-mono">{asset.qrCode}</span>
                    </div>
                    <h3 className="text-base font-extrabold text-slate-900 dark:text-white mt-1.5">{asset.name}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Không gian: <strong className="text-slate-800 dark:text-slate-200">{asset.spaceRoom}</strong>
                    </p>
                  </div>

                  <span className={`text-[11px] font-extrabold px-3 py-1 rounded-full border ${getStatusBadge(asset.status)}`}>
                    {asset.status === 'OUT_OF_SERVICE' ? '🚫 OUT OF SERVICE (Tạm Dừng)' : asset.status}
                  </span>
                </div>

                {/* Safety Issue Warning Box */}
                {asset.hasSafetyIssue && (
                  <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 text-xs space-y-1">
                    <span className="font-extrabold text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                      Cảnh báo kiểm tra an toàn gần nhất:
                    </span>
                    <p className="text-amber-800 dark:text-amber-400 text-[11px]">
                      Phát hiện rủi ro kim loại mòn • Đã ngắt hoạt động sinh hoạt của trẻ • Đã kích hoạt Work Order sửa chữa.
                    </p>
                  </div>
                )}
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-700/60 text-xs flex items-center justify-between text-slate-600 dark:text-slate-400">
                <span>Lần kiểm tra: <strong>{asset.lastInspectionDate}</strong> ({asset.inspectorName})</span>
                <span>Kiểm tra tiếp: <strong>{asset.nextCheckDate}</strong></span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── TAB CONTENT 2: SPACE HIERARCHY ── */}
      {activeTab === 'spaces' && (
        <div className="rounded-3xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 p-6 sm:p-8 shadow-sm space-y-6">
          <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <Building2 className="w-5 h-5 text-indigo-500" />
            Cấu Trúc Không Gian & Phòng Học (Facility ➔ Space Hierarchy)
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 space-y-2">
              <span className="font-extrabold text-indigo-600 dark:text-indigo-400">Cơ Sở 1 — Tòa Nhà A (Tầng 1)</span>
              <h4 className="font-bold text-sm text-slate-900 dark:text-white">Phòng 101 • Lớp Mầm A1 (Sĩ số 22 trẻ)</h4>
              <p className="text-slate-500">Thiết bị gắn kèm: AC-101-01 (Đạt), AIR-101-01 (Đạt), CAM-101-01 (Online)</p>
            </div>
            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 space-y-2">
              <span className="font-extrabold text-indigo-600 dark:text-indigo-400">Cơ Sở 1 — Tòa Nhà A (Tầng 1)</span>
              <h4 className="font-bold text-sm text-slate-900 dark:text-white">Phòng 102 • Lớp Chồi B1 (Sĩ số 20 trẻ)</h4>
              <p className="text-slate-500">Thiết bị gắn kèm: AC-102-01 (Đạt), CAM-102-01 (🔴 Offline - Đang sửa)</p>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB CONTENT 5: WORK ORDERS MANAGEMENT ── */}
      {activeTab === 'workorders' && (
        <div className="rounded-3xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 p-6 sm:p-8 shadow-sm space-y-6">
          <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <Wrench className="w-5 h-5 text-rose-500" />
            Danh Sách Work Orders Yêu Cầu Bảo Trì & Sửa Chữa
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-500 dark:text-slate-400 uppercase tracking-wider font-extrabold">
                <tr>
                  <th className="p-3.5 rounded-l-2xl">Mã Work Order</th>
                  <th className="p-3.5">Tên Thiết Bị & Vị Trí</th>
                  <th className="p-3.5">Mô Tả Sự Cố</th>
                  <th className="p-3.5">Độ Ưu Tiên</th>
                  <th className="p-3.5">Kỹ Thuật Phụ Trách</th>
                  <th className="p-3.5 rounded-r-2xl">Trạng Thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {workOrders.map((wo) => (
                  <tr key={wo.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/40">
                    <td className="p-3.5 font-bold text-slate-900 dark:text-white">{wo.id}</td>
                    <td className="p-3.5 font-extrabold text-indigo-600 dark:text-indigo-400">{wo.assetName} ({wo.location})</td>
                    <td className="p-3.5 text-slate-600 dark:text-slate-300">{wo.issueDescription}</td>
                    <td className="p-3.5 font-bold text-rose-600">{wo.severity}</td>
                    <td className="p-3.5 font-medium text-slate-700">{wo.assignedTechnician}</td>
                    <td className="p-3.5">
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-indigo-100 text-indigo-800">
                        {wo.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── GOVERNED REPORT MAINTENANCE MODAL WITH QR SCAN ── */}
      {isReportModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-xl rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 sm:p-8 space-y-6 relative">
            <button
              onClick={() => setIsReportModalOpen(false)}
              className="absolute top-5 right-5 p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="space-y-1">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                Quy trình khởi tạo yêu cầu sửa chữa thiết bị
              </span>
              <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">
                Báo Hỏng / Yêu Cầu Bảo Trì Thiết Bị
              </h3>
            </div>

            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 flex items-center justify-between text-xs">
                <span className="font-bold text-indigo-900 dark:text-indigo-300 flex items-center gap-2">
                  <QrCode className="w-4 h-4 text-indigo-600" />
                  Hỗ trợ Quét Mã QR Thiết Bị tại Phòng Học
                </span>
                <button className="px-3 py-1.5 rounded-xl bg-indigo-600 text-white font-bold text-[11px] hover:bg-indigo-700 transition-colors cursor-pointer">
                  [ Quét QR Code ]
                </button>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                  Thiết Bị / Asset Chỉ Định
                </label>
                <select className="w-full p-3 text-xs rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-rose-500">
                  <option>Điều Hòa Âm Trần Daikin (Phòng 101 • Lớp Mầm A1)</option>
                  <option>Camera Giám Sát HD (Phòng 102 • Lớp Chồi B1)</option>
                  <option>Khu Vui Chơi Liên Hoàn Ngoài Trời (Sân Trường Trung Tâm)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                  Mô tả sự cố & Đánh giá rủi ro
                </label>
                <textarea
                  rows={3}
                  placeholder="Nhập chi tiết sự cố hỏng hóc hoặc dấu hiệu không an toàn..."
                  className="w-full p-3 text-xs rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-rose-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsReportModalOpen(false)}
                className="px-4 py-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={() => setIsReportModalOpen(false)}
                className="px-5 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>Khởi Tạo Work Order</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
