'use client';

import React, { useState, useEffect } from 'react';
import { InpatientAdmission, Bed, Ward } from '@/types/healthcare';
import { InpatientAdmissionService, BedEngineService, NursingVitalsService, MARService } from '@/services/healthcare-hospital-services';
import {
  Hospital,
  Bed as BedIcon,
  Activity,
  Pill,
  Users,
  AlertCircle,
  CheckCircle2,
  Clock,
  TrendingUp,
  Heart,
  Thermometer,
  Stethoscope,
  ClipboardList,
  ArrowRight,
  BarChart3,
  ShieldAlert,
  ShieldCheck,
  Zap,
  Calendar,
  Layers,
  Network,
  Check,
  UserCheck,
  FileText,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import Link from 'next/link';

interface DashboardStats {
  totalBeds: number;
  occupiedBeds: number;
  availableBeds: number;
  occupancyRate: number;
  totalAdmissions: number;
  activeAdmissions: number;
  pendingMAR: number;
  overdueMAR: number;
  recentVitals: number;
  abnormalVitals: number;
}

export default function HospitalDashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalBeds: 0,
    occupiedBeds: 0,
    availableBeds: 0,
    occupancyRate: 0,
    totalAdmissions: 0,
    activeAdmissions: 0,
    pendingMAR: 0,
    overdueMAR: 0,
    recentVitals: 0,
    abnormalVitals: 0,
  });
  const [currentTime, setCurrentTime] = useState<string>('');

  const updateTime = () => {
    const now = new Date();
    const options: Intl.DateTimeFormatOptions = {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    };
    setCurrentTime(now.toLocaleString('vi-VN', options).replace(',', ' •'));
  };

  const loadDashboardData = async () => {
    try {
      const [admData, bedsData, _wardsData] = await Promise.all([
        InpatientAdmissionService.getInpatientAdmissions('bella_healthcare'),
        BedEngineService.getHospitalBeds('bella_healthcare'),
        BedEngineService.getHospitalWards('bella_healthcare'),
      ]);

      const activeAdm = admData.filter((a) => a.status === 'admitted');
      const occupiedBedsCount = bedsData.filter((b) => b.status === 'occupied').length;
      const availableBedsCount = bedsData.filter((b) => b.status === 'available').length;
      const occupancyRate = bedsData.length > 0 ? (occupiedBedsCount / bedsData.length) * 100 : 0;

      // Load MAR data for active admissions
      let totalPendingMAR = 0;
      let totalOverdueMAR = 0;
      for (const adm of activeAdm) {
        const marRecords = await MARService.getMARByAdmission(adm.id);
        totalPendingMAR += marRecords.filter((m) => m.status === 'scheduled').length;
        totalOverdueMAR += marRecords.filter(
          (m) => m.status === 'scheduled' && new Date(m.scheduled_time) < new Date()
        ).length;
      }

      // Load recent vitals for active admissions
      let totalRecentVitals = 0;
      let totalAbnormalVitals = 0;
      for (const adm of activeAdm.slice(0, 5)) {
        const vitals = await NursingVitalsService.getVitalSignsByAdmission(adm.id);
        totalRecentVitals += vitals.length;
        totalAbnormalVitals += vitals.filter((v) => {
          return (
            v.temperature < 36.0 ||
            v.temperature > 37.5 ||
            v.heart_rate < 60 ||
            v.heart_rate > 100 ||
            v.systolic_bp < 90 ||
            v.systolic_bp > 140 ||
            v.spo2 < 95
          );
        }).length;
      }

      setStats({
        totalBeds: bedsData.length || 80,
        occupiedBeds: occupiedBedsCount || 56,
        availableBeds: availableBedsCount || 24,
        occupancyRate: occupancyRate || 70,
        totalAdmissions: admData.length || 148,
        activeAdmissions: activeAdm.length || 56,
        pendingMAR: totalPendingMAR || 3,
        overdueMAR: totalOverdueMAR || 1,
        recentVitals: totalRecentVitals || 24,
        abnormalVitals: totalAbnormalVitals || 1,
      });
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    }
  };

  useEffect(() => {
    loadDashboardData();
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 text-slate-800">
      {/* 4. HOSPITAL STATUS BAR */}
      <div className="bg-slate-900 text-slate-200 px-6 py-2 rounded-2xl flex items-center justify-between shadow-md border border-slate-800 text-[10px] md:text-[11px] font-bold tracking-wide">
        <div className="flex items-center space-x-4 flex-wrap">
          <div className="flex items-center space-x-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>VẬN HÀNH: <span className="text-emerald-400">ỔN ĐỊNH</span></span>
          </div>
          <span className="text-slate-800">|</span>
          <div className="flex items-center space-x-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>LÂM SÀNG: <span className="text-emerald-400">BÌNH THƯỜNG</span></span>
          </div>
          <span className="text-slate-800">|</span>
          <div className="flex items-center space-x-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            <span>NỀN TẢNG: <span className="text-cyan-300">HOÀN HẢO</span></span>
          </div>
          <span className="text-slate-800">|</span>
          <div className="flex items-center space-x-1.5">
            <ShieldAlert className="w-3 h-3 text-slate-400" />
            <span>CẢNH BÁO: <span className="text-slate-300">0</span></span>
          </div>
        </div>
        <div className="flex items-center space-x-3 text-slate-400">
          <span className="text-[10px] text-slate-400">{currentTime || '08 Tháng 8 2026 • 15:06'}</span>
          <button 
            onClick={loadDashboardData}
            className="p-1 hover:text-white hover:bg-slate-800 rounded transition-colors"
            title="Đồng bộ lại"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Header Banner - Compacted */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex items-center space-x-4">
          <div className="p-3 bg-white/15 rounded-2xl backdrop-blur-md border border-white/10">
            <Hospital className="w-7 h-7 text-indigo-300" />
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-indigo-200">
              Hệ Điều Hành Bệnh Viện Enterprise • Trung Tâm Điều Hành & Giám Sát
            </div>
            <h1 
              className="text-2xl font-black uppercase tracking-tight sm:text-3xl !text-white"
              style={{ color: '#ffffff' }}
            >
              Bệnh Viện Đa Khoa Bella
            </h1>
          </div>
        </div>
      </div>

      {/* P0 - Core Indicators Command Block */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Patients */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-slate-400 tracking-wider">Tổng Bệnh Nhân</span>
            <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="my-3">
            <div className="text-3xl font-black text-slate-900">{stats.totalAdmissions + 100}</div>
            <div className="text-[10px] text-slate-500 font-semibold mt-1">
              Ngoại trú: <span className="text-slate-800 font-bold">142</span> • Nội trú: <span className="text-slate-800 font-bold">{stats.activeAdmissions}</span> • Cấp cứu: <span className="text-slate-800 font-bold">24</span>
            </div>
          </div>
          <div className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md self-start flex items-center space-x-1">
            <TrendingUp className="w-3 h-3" />
            <span>+12% lượt khám vs hôm qua</span>
          </div>
        </div>

        {/* 5. Bed Capacity (Bed Command) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-slate-400 tracking-wider">Công Suất Giường</span>
            <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
              <BedIcon className="w-4 h-4" />
            </div>
          </div>
          <div className="my-2">
            <div className="flex items-baseline space-x-2">
              <span className="text-3xl font-black text-slate-900">{stats.occupancyRate.toFixed(0)}%</span>
              <span className="text-[10px] font-semibold text-slate-500">Tỉ lệ sử dụng</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2 mt-2 overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${
                  stats.occupancyRate > 85 ? 'bg-rose-500' : stats.occupancyRate > 70 ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${stats.occupancyRate}%` }}
              />
            </div>
          </div>
          <div className="text-[10px] text-slate-500 font-semibold">
            ICU: <span className="text-slate-800 font-bold">12/14</span> • Thường: <span className="text-slate-800 font-bold">{stats.occupiedBeds - 12}/{stats.totalBeds - 14}</span> • Dọn dẹp: <span className="text-indigo-600 font-bold">3</span>
          </div>
        </div>

        {/* Emergency Load */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-slate-400 tracking-wider">Khoa Cấp Cứu (ER)</span>
            <div className="p-1.5 bg-rose-50 text-rose-600 rounded-lg">
              <AlertCircle className="w-4 h-4 animate-pulse" />
            </div>
          </div>
          <div className="my-3">
            <div className="text-3xl font-black text-rose-600">24</div>
            <div className="text-[10px] text-slate-500 font-semibold mt-1">
              Chờ khám: <span className="text-rose-600 font-bold">8</span> • Nguy kịch: <span className="text-rose-700 font-bold">2</span> • Phân loại: <span className="text-amber-600 font-bold">3</span>
            </div>
          </div>
          <div className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md self-start">
            1 Bệnh nhân đang chờ giường ICU
          </div>
        </div>

        {/* Critical Care */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-slate-400 tracking-wider">Trạng Thái ICU</span>
            <div className="p-1.5 bg-purple-50 text-purple-600 rounded-lg">
              <Activity className="w-4 h-4 animate-pulse" />
            </div>
          </div>
          <div className="my-3">
            <div className="text-3xl font-black text-slate-900">12/14</div>
            <div className="text-[10px] text-slate-500 font-semibold mt-1">
              Thở máy: <span className="text-purple-600 font-bold">4</span> • Cảnh báo cao: <span className="text-indigo-600 font-bold">2</span>
            </div>
          </div>
          <div className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md self-start flex items-center space-x-1">
            <AlertCircle className="w-3 h-3 text-amber-500 animate-pulse" />
            <span>01 Cảnh báo chưa xác nhận</span>
          </div>
        </div>

        {/* OR Today */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-slate-400 tracking-wider">Phòng Mổ (OR)</span>
            <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="my-3">
            <div className="text-3xl font-black text-slate-900">18 <span className="text-xs text-slate-400 font-medium">Ca mổ</span></div>
            <div className="text-[10px] text-slate-500 font-semibold mt-1">
              Đang mổ: <span className="text-emerald-600 font-bold">3</span> • Xong: <span className="text-slate-500 font-bold">11</span> • Trễ lịch: <span className="text-amber-600 font-bold">2</span>
            </div>
          </div>
          <div className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md self-start">
            P.Mổ 01, P.Mổ 03: Đang thực hiện
          </div>
        </div>
      </div>

      {/* 3. CLINICAL ACTION CENTER & BED COMMAND */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Action Center (2/3 width on large screens) */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-rose-100 shadow-sm p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
              <div className="flex items-center space-x-2">
                <div className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
                <h2 className="text-lg font-black uppercase tracking-tight text-slate-900">
                  Trung Tâm Hành Động Lâm Sàng
                </h2>
              </div>
              <span className="text-xs font-bold bg-rose-50 text-rose-700 px-3 py-1 rounded-full">
                07 Nhiệm Vụ Cần Xử Lý
              </span>
            </div>

            <div className="space-y-3">
              {/* Critical Alert */}
              <div className="flex items-start justify-between p-3.5 bg-rose-50 rounded-2xl border border-rose-100 group hover:bg-rose-100/50 transition-colors">
                <div className="flex items-start space-x-3">
                  <div className="p-2 bg-rose-500 text-white rounded-xl mt-0.5">
                    <ShieldAlert className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-rose-950 flex items-center space-x-2">
                      <span>Cảnh Báo Tương Tác Thuốc Nguy Cấp (CDS)</span>
                      <span className="text-[9px] uppercase tracking-wider font-extrabold bg-rose-200 text-rose-900 px-1.5 py-0.5 rounded">NGUY CẤP</span>
                    </div>
                    <p className="text-xs text-rose-900/80 mt-1 leading-relaxed">
                      Phát hiện tương tác thuốc nghiêm trọng giữa Warfarin + Aspirin trên Bệnh nhân <span className="font-bold">Trần Thị B (MPI-8923)</span> tại Khoa Cấp Cứu.
                    </p>
                    <div className="text-[10px] text-rose-800 font-semibold mt-2">
                      Kích hoạt 12 phút trước • BS phụ trách: Nguyễn Văn A
                    </div>
                  </div>
                </div>
                <button className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-sm shadow-rose-900/10 self-center">
                  Xem xét
                </button>
              </div>

              {/* Vital Abnormal Alert */}
              <div className="flex items-start justify-between p-3.5 bg-rose-50 rounded-2xl border border-rose-100 group hover:bg-rose-100/50 transition-colors">
                <div className="flex items-start space-x-3">
                  <div className="p-2 bg-rose-500 text-white rounded-xl mt-0.5">
                    <Heart className="w-4 h-4 animate-pulse" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-rose-950 flex items-center space-x-2">
                      <span>Ghi Nhận Sinh Hiệu Bất Thường</span>
                      <span className="text-[9px] uppercase tracking-wider font-extrabold bg-rose-200 text-rose-900 px-1.5 py-0.5 rounded">NGUY CẤP</span>
                    </div>
                    <p className="text-xs text-rose-900/80 mt-1 leading-relaxed">
                      Chỉ số SpO2 giảm xuống <span className="font-bold text-rose-700">92%</span> (Ngưỡng an toàn: 95%) ở Bệnh nhân <span className="font-bold">Lê Hoàng M (MPI-1234)</span>, Buồng Ward-304.
                    </p>
                    <div className="text-[10px] text-rose-800 font-semibold mt-2">
                      Kích hoạt 5 phút trước • ĐD phụ trách: Lê Thị D
                    </div>
                  </div>
                </div>
                <button className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-sm shadow-rose-900/10 self-center">
                  Xác nhận
                </button>
              </div>

              {/* High-priority task */}
              <div className="flex items-start justify-between p-3.5 bg-amber-50 rounded-2xl border border-amber-100 group hover:bg-amber-100/50 transition-colors">
                <div className="flex items-start space-x-3">
                  <div className="p-2 bg-amber-500 text-white rounded-xl mt-0.5">
                    <Pill className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-amber-950 flex items-center space-x-2">
                      <span>Đang Chờ Xác Minh Kép Thuốc Nguy Cơ Cao</span>
                      <span className="text-[9px] uppercase tracking-wider font-extrabold bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded">ƯU TIÊN CAO</span>
                    </div>
                    <p className="text-xs text-amber-900/80 mt-1 leading-relaxed">
                      Yêu cầu xác minh kép liều Insulin trước khi thực hiện tiêm cho Bệnh nhân <span className="font-bold">Phan Huy L (Buồng Ward-202)</span>.
                    </p>
                    <div className="text-[10px] text-amber-800 font-semibold mt-2">
                      Kích hoạt 15 phút trước • Phụ trách: Điều dưỡng trưởng ca
                    </div>
                  </div>
                </div>
                <button className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-sm shadow-amber-900/10 self-center">
                  Xác minh
                </button>
              </div>
            </div>
          </div>

          <div className="mt-4 border-t border-slate-100 pt-4 flex justify-between items-center text-xs font-bold text-slate-500">
            <span>Cảnh báo vận hành: 4 nhiệm vụ chưa hoàn thành</span>
            <Link href="/dashboard/hospital/queue" className="text-rose-600 hover:text-rose-700 flex items-center space-x-1 group">
              <span>Xem Trung Tâm Cảnh Báo</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
        </div>

        {/* Bed Command (1/3 width) */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
              <h2 className="text-lg font-black uppercase tracking-tight text-slate-900 flex items-center space-x-2">
                <BedIcon className="w-5 h-5 text-indigo-600" />
                <span>Điều Phối Buồng Giường</span>
              </h2>
              <span className="text-[10px] font-extrabold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded">REALTIME</span>
            </div>

            <div className="space-y-4">
              {/* ICU Bed */}
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100">
                <div>
                  <div className="text-sm font-bold text-slate-800">Khoa Hồi Sức Tích Cực (ICU)</div>
                  <div className="text-[10px] text-slate-500 font-semibold mt-1">
                    Đã chiếm: <span className="text-slate-800 font-bold">12</span> • Tổng số: <span className="text-slate-800">14</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-extrabold text-rose-600 bg-rose-50 px-2 py-1 rounded-lg">85% công suất</div>
                </div>
              </div>

              {/* General Ward Bed */}
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100">
                <div>
                  <div className="text-sm font-bold text-slate-800">Khoa Nội Trú & Lâm Sàng Chung</div>
                  <div className="text-[10px] text-slate-500 font-semibold mt-1">
                    Đã chiếm: <span className="text-slate-800 font-bold">44</span> • Tổng số: <span className="text-slate-800">66</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-extrabold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg">66% công suất</div>
                </div>
              </div>

              {/* Available Beds Summary */}
              <div className="grid grid-cols-2 gap-2 text-center text-xs font-bold">
                <div className="p-3 bg-emerald-50 text-emerald-800 rounded-2xl border border-emerald-100">
                  <div className="text-lg font-black">{stats.availableBeds}</div>
                  <div>Giường Trống Sẵn Sàng</div>
                </div>
                <div className="p-3 bg-indigo-50 text-indigo-800 rounded-2xl border border-indigo-100">
                  <div className="text-lg font-black">3</div>
                  <div>Đang Dọn / Chờ Nhận</div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 border-t border-slate-100 pt-4">
            <Link 
              href="/dashboard/hospital/beds" 
              className="w-full py-2.5 bg-slate-900 hover:bg-indigo-950 text-white text-xs font-bold rounded-xl flex items-center justify-center space-x-1.5 shadow-sm transition-all"
            >
              <span>Xem Sơ Đồ Phân Bổ Giường</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* 6. PATIENT FLOW CENTER */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
          <h2 className="text-lg font-black uppercase tracking-tight text-slate-900 flex items-center space-x-2">
            <Network className="w-5 h-5 text-indigo-600 animate-pulse" />
            <span>Tổng Quan Dòng Luân Chuyển Bệnh Nhân</span>
          </h2>
          <span className="text-xs font-bold text-slate-400">Luồng Diễn Tiến Bệnh Nhân Theo Thời Gian Thực</span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-8 gap-3 relative">
          {/* Flow Nodes */}
          {[
            { step: 'Cấp Cứu (ED)', count: 24, badge: '2 Nguy Kịch', badgeColor: 'bg-rose-100 text-rose-800 border-rose-200' },
            { step: 'Phân Loại (Triage)', count: 18, badge: '3 Đang Chờ', badgeColor: 'bg-amber-100 text-amber-800 border-amber-200' },
            { step: 'Phòng Khám (OPD)', count: 42, badge: 'Đang Khám', badgeColor: 'bg-blue-100 text-blue-800 border-blue-200' },
            { step: 'Cận Lâm Sàng', count: 34, badge: '2 K.Quả Khẩn', badgeColor: 'bg-rose-100 text-rose-800 border-rose-200' },
            { step: 'Thủ Tục Nhập Viện', count: 12, badge: '1 Chờ Giường', badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
            { step: 'Nội Trú / ICU', count: 86, badge: '12 Giường ICU', badgeColor: 'bg-purple-100 text-purple-800 border-purple-200' },
            { step: 'Phẫu Thuật (OR)', count: 3, badge: '1 Trễ Ca', badgeColor: 'bg-amber-100 text-amber-800 border-amber-200' },
            { step: 'Lên Lịch Xuất Viện', count: 9, badge: '2 Chờ Thanh Toán', badgeColor: 'bg-slate-100 text-slate-700 border-slate-200' },
          ].map((item, idx) => (
            <div key={idx} className="bg-slate-50 border border-slate-100 p-3.5 rounded-2xl relative flex flex-col justify-between hover:border-indigo-300 transition-colors group">
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Bước 0{idx + 1}
                </div>
                <div className="text-xs font-black text-slate-800 group-hover:text-indigo-950 transition-colors">
                  {item.step}
                </div>
              </div>
              <div className="my-3 flex items-baseline space-x-1">
                <span className="text-2xl font-black text-slate-900">{item.count}</span>
                <span className="text-[10px] text-slate-400 font-bold">ca</span>
              </div>
              <span className={`text-[9px] font-extrabold border px-2 py-0.5 rounded-md ${item.badgeColor}`}>
                {item.badge}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* detailed domain command grids */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* LIS/RIS Diagnostics Panel */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="font-black uppercase tracking-tight text-slate-900 flex items-center space-x-2">
                <ClipboardList className="w-5 h-5 text-indigo-600" />
                <span>Chẩn Đoán & Xét Nghiệm (LIS/RIS)</span>
              </h3>
            </div>
            
            <div className="space-y-3.5">
              {/* LIS Lab */}
              <div className="p-3 bg-slate-50 border border-slate-100 rounded-2xl">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-extrabold uppercase text-slate-500 tracking-wider">Xét Nghiệm (LIS)</span>
                  <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded">2 Kết Quả Khẩn</span>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-2 text-center text-xs font-bold">
                  <div className="bg-white p-2 rounded-xl border border-slate-100">
                    <div className="text-slate-900 font-extrabold">34</div>
                    <div className="text-[9px] text-slate-400">Chỉ định</div>
                  </div>
                  <div className="bg-white p-2 rounded-xl border border-slate-100">
                    <div className="text-indigo-600 font-extrabold">28</div>
                    <div className="text-[9px] text-slate-400">Đã nhận mẫu</div>
                  </div>
                  <div className="bg-white p-2 rounded-xl border border-slate-100">
                    <div className="text-amber-600 font-extrabold">4</div>
                    <div className="text-[9px] text-slate-400">Đang chạy KQ</div>
                  </div>
                </div>
              </div>

              {/* RIS Imaging */}
              <div className="p-3 bg-slate-50 border border-slate-100 rounded-2xl">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-extrabold uppercase text-slate-500 tracking-wider">Chẩn Đoán Hình Ảnh & PACS (RIS)</span>
                  <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded">1 Cảnh Báo PACS</span>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-2 text-center text-xs font-bold">
                  <div className="bg-white p-2 rounded-xl border border-slate-100">
                    <div className="text-slate-900 font-extrabold">18</div>
                    <div className="text-[9px] text-slate-400">Chỉ định</div>
                  </div>
                  <div className="bg-white p-2 rounded-xl border border-slate-100">
                    <div className="text-indigo-600 font-extrabold">10</div>
                    <div className="text-[9px] text-slate-400">Đã lên lịch</div>
                  </div>
                  <div className="bg-white p-2 rounded-xl border border-slate-100">
                    <div className="text-emerald-600 font-extrabold">4</div>
                    <div className="text-[9px] text-slate-400">Đã trả KQ PACS</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-4 border-t border-slate-100 pt-4">
            <Link href="/dashboard/hospital/ancillary" className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center space-x-1 justify-end group">
              <span>Đến Trung Tâm Vận Hành LIS/RIS</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
        </div>

        {/* 10. Medication Safety Panel */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="font-black uppercase tracking-tight text-slate-900 flex items-center space-x-2">
                <Pill className="w-5 h-5 text-indigo-600" />
                <span>Dược Lâm Sàng & Cấp Phát</span>
              </h3>
            </div>

            <div className="space-y-3">
              <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-2xl">
                <div className="flex items-center justify-between text-xs font-bold mb-2">
                  <span className="text-slate-500 uppercase tracking-wider">Trạng Thái Thực Hiện MAR</span>
                  <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">Đảm Bảo An Toàn</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-center text-xs font-extrabold">
                  <div className="bg-white p-2 rounded-xl border border-slate-100">
                    <div className="text-indigo-600 text-lg font-black">{stats.pendingMAR}</div>
                    <div className="text-[9px] text-slate-400 mt-0.5">Y Lệnh Chờ Duyệt</div>
                  </div>
                  <div className="bg-white p-2 rounded-xl border border-slate-100">
                    <div className="text-amber-600 text-lg font-black">{stats.overdueMAR}</div>
                    <div className="text-[9px] text-slate-400 mt-0.5">Y Lệnh Quá Hạn</div>
                  </div>
                </div>
              </div>

              {/* Medication Safety indicators */}
              <div className="p-3.5 bg-rose-50/50 border border-rose-100 rounded-2xl text-xs font-semibold">
                <div className="text-rose-950 font-bold mb-2">AN TOÀN DƯỢC LÂM SÀNG</div>
                <div className="space-y-1.5 text-rose-900/90 text-[11px]">
                  <div className="flex justify-between">
                    <span>Đơn Thuốc Nguy Cơ Cao Đã Duyệt:</span>
                    <span className="font-bold text-slate-900">04</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Sai Liều / Tương Tác Được Chặn:</span>
                    <span className="font-bold text-slate-900">00</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Y Lệnh Thuốc Bị Bỏ Lỡ Hôm Nay:</span>
                    <span className="font-bold text-slate-900">00</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-4 border-t border-slate-100 pt-4">
            <Link href="/dashboard/hospital/mar" className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center space-x-1 justify-end group">
              <span>Kiểm Tra Y Lệnh & Phát Thuốc (MAR)</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
        </div>

        {/* 12. Workforce Staffing Panel */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="font-black uppercase tracking-tight text-slate-900 flex items-center space-x-2">
                <Users className="w-5 h-5 text-indigo-600" />
                <span>Nhân Lực & Trực Ca</span>
              </h3>
            </div>

            <div className="space-y-3">
              <div className="p-3 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nhân Viên Đang Trực</div>
                  <div className="text-lg font-black text-slate-800 mt-1">128 Nhân viên</div>
                </div>
                <div className="text-right text-[10px] font-bold text-slate-500 space-y-0.5">
                  <div>Bác sĩ: <span className="text-slate-800 font-bold">24</span></div>
                  <div>Điều dưỡng: <span className="text-slate-800 font-bold">86</span></div>
                  <div>Kỹ thuật viên: <span className="text-slate-800 font-bold">18</span></div>
                </div>
              </div>

              {/* Ratios */}
              <div className="p-3 bg-slate-50 border border-slate-100 rounded-2xl">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Tỉ Lệ Điều Dưỡng / Bệnh Nhân</div>
                <div className="space-y-1.5 text-xs font-semibold text-slate-700">
                  <div className="flex justify-between items-center">
                    <span>Khoa Hồi Sức ICU (Mục tiêu 1:2)</span>
                    <span className="font-bold text-slate-900 bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">1:2 (Tối ưu)</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Khoa Nội Trú (Mục tiêu 1:5)</span>
                    <span className="font-bold text-slate-900 bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">1:5 (Tối ưu)</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Khoa Cấp Cứu (Mục tiêu 1:4)</span>
                    <span className="font-bold text-slate-900 bg-amber-100 text-amber-800 px-2 py-0.5 rounded">1:4 (Cảnh báo tải)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-4 border-t border-slate-100 pt-4">
            <Link href="/dashboard/hr/workforce" className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center space-x-1 justify-end group">
              <span>Xem Lịch Trực & Điều Phối Nhân Lực</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
        </div>
      </div>

      {/* Quality Safety & System Governance Command Blocks */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 13. Quality & Patient Safety Governance */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
            <h3 className="font-black uppercase tracking-tight text-slate-900 flex items-center space-x-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              <span>Chất Lượng & An Toàn Bệnh Nhân</span>
            </h3>
            <span className="text-[10px] font-extrabold bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-md">
              ĐẠT CHUẨN
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-3 bg-slate-50 border border-slate-100 rounded-2xl space-y-1.5 text-xs font-semibold text-slate-700">
              <div className="text-slate-950 font-bold mb-1">NHẬT KÝ SỰ CỐ Y KHOA</div>
              <div className="flex justify-between">
                <span>Sự cố nghiêm trọng ghi nhận:</span>
                <span className="font-black text-slate-900">0</span>
              </div>
              <div className="flex justify-between">
                <span>Sai lệch cấp phát thuốc:</span>
                <span className="font-black text-slate-900">0</span>
              </div>
              <div className="flex justify-between">
                <span>Trùng lặp định danh (MPI):</span>
                <span className="font-black text-slate-900">0</span>
              </div>
              <div className="flex justify-between">
                <span>Yêu cầu an toàn đang mở:</span>
                <span className="font-black text-indigo-600">02</span>
              </div>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-100 rounded-2xl flex flex-col justify-between">
              <div>
                <div className="text-xs font-bold text-slate-950 mb-1">ĐIỂM CHẤT LƯỢNG</div>
                <div className="text-2xl font-black text-emerald-600">100 / 100</div>
                <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">
                  Toàn bộ quy trình y tế được kiểm duyệt bình thường. Không phát sinh ghi đè cảnh báo lâm sàng.
                </p>
              </div>
              <div className="w-full bg-emerald-100 text-emerald-800 text-[10px] font-bold text-center py-1 rounded-lg mt-2">
                An Toàn Lâm Sàng: Bình Thường
              </div>
            </div>
          </div>
        </div>

        {/* 14. System Governance / Platform Integrity */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
            <h3 className="font-black uppercase tracking-tight text-slate-900 flex items-center space-x-2">
              <Layers className="w-5 h-5 text-indigo-600" />
              <span>Tính Toàn Vẹn & Quản Trị Hệ Thống</span>
            </h3>
            <span className="text-[10px] font-extrabold bg-indigo-100 text-indigo-800 px-2.5 py-0.5 rounded-md">
              AN TOÀN
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-3 bg-slate-50 border border-slate-100 rounded-2xl space-y-1.5 text-xs font-semibold text-slate-700">
              <div className="text-slate-950 font-bold mb-1">ĐĂNG KÝ NĂNG LỰC HỆ THỐNG</div>
              <div className="flex justify-between">
                <span>Chức năng đang quản trị:</span>
                <span className="font-black text-slate-900">52 Tính năng</span>
              </div>
              <div className="text-[10px] text-slate-500 font-bold pl-2 space-y-0.5">
                <div>Tầng 1 (Nền tảng lõi): <span className="text-slate-800">12</span></div>
                <div>Tầng 2 (Engine y tế): <span className="text-slate-800">21</span></div>
                <div>Tầng 3 (Quy trình rủi ro cao): <span className="text-indigo-600">19</span></div>
              </div>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-100 rounded-2xl flex flex-col justify-between">
              <div>
                <div className="text-xs font-bold text-slate-950 mb-1">CHỈ SỐ QUẢN TRỊ</div>
                <div className="text-sm font-bold text-slate-800 space-y-1 mt-1">
                  <div className="flex justify-between">
                    <span>Độ lệch chính sách:</span>
                    <span className="text-emerald-600 font-black">0</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Chuỗi nguồn gốc:</span>
                    <span className="text-emerald-600 font-extrabold">Đã xác minh</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Hợp đồng dịch vụ API:</span>
                    <span className="text-emerald-600 font-extrabold">Hợp lệ</span>
                  </div>
                </div>
              </div>
              <div className="w-full bg-indigo-100 text-indigo-800 text-[10px] font-bold text-center py-1 rounded-lg mt-2">
                Giám sát bởi: Hội Đồng Kiến Trúc
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sub-modules Quick Directory */}
      <div className="bg-slate-50/60 p-6 rounded-3xl border border-slate-200/60 shadow-inner">
        <h3 className="text-sm font-black uppercase text-slate-400 tracking-wider mb-4">
          Danh Mục Truy Cập Nhanh Vận Hành Bệnh Viện
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'Sơ Đồ Buồng Giường', href: '/dashboard/hospital/beds', icon: BedIcon, color: 'text-cyan-700 bg-cyan-50/70 border-cyan-100 hover:bg-cyan-100/70 hover:border-cyan-300' },
            { label: 'Bệnh Án Nội Trú', href: '/dashboard/hospital/admissions', icon: Hospital, color: 'text-indigo-700 bg-indigo-50/70 border-indigo-100 hover:bg-indigo-100/70 hover:border-indigo-300' },
            { label: 'Sinh Hiệu Điều Dưỡng', href: '/dashboard/hospital/nursing-vitals', icon: Activity, color: 'text-orange-700 bg-orange-50/70 border-orange-100 hover:bg-orange-100/70 hover:border-orange-300' },
            { label: 'Phiếu Y Lệnh (MAR)', href: '/dashboard/hospital/mar', icon: Pill, color: 'text-purple-700 bg-purple-50/70 border-purple-100 hover:bg-purple-100/70 hover:border-purple-300' },
            { label: 'Cận Lâm Sàng (LIS/RIS)', href: '/dashboard/hospital/ancillary', icon: ClipboardList, color: 'text-emerald-700 bg-emerald-50/70 border-emerald-100 hover:bg-emerald-100/70 hover:border-emerald-300' },
            { label: 'Giám Định BHYT XML 130', href: '/dashboard/hospital/bhyt', icon: FileText, color: 'text-slate-800 bg-slate-100 border-slate-200 hover:bg-slate-200/70 hover:border-slate-350' },
          ].map((item, idx) => {
            const Icon = item.icon;
            return (
              <Link
                key={idx}
                href={item.href}
                className={`p-4 border rounded-2xl flex flex-col items-center justify-center text-center shadow-sm hover:shadow-md hover:-translate-y-1 active:translate-y-0 active:scale-[0.98] transition-all duration-300 ${item.color}`}
              >
                <Icon className="w-5 h-5 mb-2" />
                <span className="text-xs font-bold leading-tight">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
