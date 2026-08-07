'use client';

import React, { useState, useEffect } from 'react';
import { InpatientAdmission, Bed, Ward, NursingVitalSigns, MedicationAdministrationRecord } from '@/types/healthcare';
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
  const [admissions, setAdmissions] = useState<InpatientAdmission[]>([]);
  const [beds, setBeds] = useState<Bed[]>([]);
  const [wards, setWards] = useState<Ward[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const [admData, bedsData, wardsData] = await Promise.all([
        InpatientAdmissionService.getInpatientAdmissions('bella_healthcare'),
        BedEngineService.getHospitalBeds('bella_healthcare'),
        BedEngineService.getHospitalWards('bella_healthcare'),
      ]);

      const activeAdm = admData.filter((a) => a.status === 'admitted');
      const occupiedBeds = bedsData.filter((b) => b.status === 'occupied').length;
      const availableBeds = bedsData.filter((b) => b.status === 'available').length;
      const occupancyRate = bedsData.length > 0 ? (occupiedBeds / bedsData.length) * 100 : 0;

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
        // Only check first 5 for performance
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
        totalBeds: bedsData.length,
        occupiedBeds,
        availableBeds,
        occupancyRate,
        totalAdmissions: admData.length,
        activeAdmissions: activeAdm.length,
        pendingMAR: totalPendingMAR,
        overdueMAR: totalOverdueMAR,
        recentVitals: totalRecentVitals,
        abnormalVitals: totalAbnormalVitals,
      });

      setAdmissions(admData);
      setBeds(bedsData);
      setWards(wardsData);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-cyan-900 rounded-3xl p-8 text-white shadow-2xl">
        <div className="flex items-center space-x-4 mb-2">
          <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm">
            <Hospital className="w-8 h-8" />
          </div>
          <div>
            <div className="text-sm font-semibold uppercase tracking-wider text-cyan-300">
              Bella General Hospital • Inpatient HIS Dashboard
            </div>
            <h1 className="text-4xl font-black uppercase tracking-tight">
              Dashboard Điều Hành Bệnh Viện
            </h1>
          </div>
        </div>
        <p className="text-cyan-100 text-sm mt-3 ml-20">
          Giám sát tổng quan buồng giường, bệnh nhân nội trú, sinh hiệu điều dưỡng và y lệnh thuốc real-time.
        </p>
      </div>

      {/* Stats Grid */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
            <div key={i} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm animate-pulse">
              <div className="h-12 bg-slate-200 rounded mb-2" />
              <div className="h-6 bg-slate-100 rounded" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {/* Total Beds */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-slate-100 rounded-lg">
                <BedIcon className="w-5 h-5 text-slate-700" />
              </div>
              <TrendingUp className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-3xl font-bold text-slate-900">{stats.totalBeds}</div>
            <div className="text-xs text-slate-500 font-medium mt-1">Tổng Số Giường</div>
          </div>

          {/* Occupied Beds */}
          <div className="bg-white p-6 rounded-2xl border border-rose-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-rose-100 rounded-lg">
                <Users className="w-5 h-5 text-rose-700" />
              </div>
              <div className="text-xs font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded">
                {stats.occupancyRate.toFixed(0)}%
              </div>
            </div>
            <div className="text-3xl font-bold text-rose-900">{stats.occupiedBeds}</div>
            <div className="text-xs text-slate-500 font-medium mt-1">Đang Có BN</div>
          </div>

          {/* Available Beds */}
          <div className="bg-white p-6 rounded-2xl border border-emerald-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <CheckCircle2 className="w-5 h-5 text-emerald-700" />
              </div>
            </div>
            <div className="text-3xl font-bold text-emerald-900">{stats.availableBeds}</div>
            <div className="text-xs text-slate-500 font-medium mt-1">Giường Trống</div>
          </div>

          {/* Active Admissions */}
          <div className="bg-white p-6 rounded-2xl border border-indigo-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-indigo-100 rounded-lg">
                <Hospital className="w-5 h-5 text-indigo-700" />
              </div>
            </div>
            <div className="text-3xl font-bold text-indigo-900">{stats.activeAdmissions}</div>
            <div className="text-xs text-slate-500 font-medium mt-1">BN Nội Trú</div>
          </div>

          {/* Total Admissions */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-slate-100 rounded-lg">
                <BarChart3 className="w-5 h-5 text-slate-700" />
              </div>
            </div>
            <div className="text-3xl font-bold text-slate-900">{stats.totalAdmissions}</div>
            <div className="text-xs text-slate-500 font-medium mt-1">Tổng Đợt NT</div>
          </div>

          {/* Pending MAR */}
          <div className="bg-white p-6 rounded-2xl border border-blue-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Pill className="w-5 h-5 text-blue-700" />
              </div>
            </div>
            <div className="text-3xl font-bold text-blue-900">{stats.pendingMAR}</div>
            <div className="text-xs text-slate-500 font-medium mt-1">Y Lệnh Chờ</div>
          </div>

          {/* Overdue MAR */}
          <div className="bg-white p-6 rounded-2xl border border-amber-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <Clock className="w-5 h-5 text-amber-700" />
              </div>
              {stats.overdueMAR > 0 && (
                <AlertCircle className="w-4 h-4 text-amber-700 animate-pulse" />
              )}
            </div>
            <div className="text-3xl font-bold text-amber-900">{stats.overdueMAR}</div>
            <div className="text-xs text-slate-500 font-medium mt-1">Y Lệnh Quá Hạn</div>
          </div>

          {/* Recent Vitals */}
          <div className="bg-white p-6 rounded-2xl border border-cyan-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-cyan-100 rounded-lg">
                <Activity className="w-5 h-5 text-cyan-700" />
              </div>
            </div>
            <div className="text-3xl font-bold text-cyan-900">{stats.recentVitals}</div>
            <div className="text-xs text-slate-500 font-medium mt-1">Sinh Hiệu Ghi Nhận</div>
          </div>

          {/* Abnormal Vitals */}
          <div className="bg-white p-6 rounded-2xl border border-orange-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Heart className="w-5 h-5 text-orange-700" />
              </div>
              {stats.abnormalVitals > 0 && (
                <AlertCircle className="w-4 h-4 text-orange-700 animate-pulse" />
              )}
            </div>
            <div className="text-3xl font-bold text-orange-900">{stats.abnormalVitals}</div>
            <div className="text-xs text-slate-500 font-medium mt-1">SH Bất Thường</div>
          </div>

          {/* Wards Count */}
          <div className="bg-white p-6 rounded-2xl border border-purple-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Stethoscope className="w-5 h-5 text-purple-700" />
              </div>
            </div>
            <div className="text-3xl font-bold text-purple-900">{wards.length}</div>
            <div className="text-xs text-slate-500 font-medium mt-1">Khoa Lâm Sàng</div>
          </div>
        </div>
      )}

      {/* Quick Actions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Bed Management */}
        <Link
          href="/dashboard/hospital/beds"
          className="group bg-gradient-to-br from-cyan-50 to-blue-50 hover:from-cyan-100 hover:to-blue-100 p-6 rounded-2xl border border-cyan-200 shadow-sm hover:shadow-lg transition-all"
        >
          <div className="flex items-start justify-between mb-4">
            <div className="p-3 bg-cyan-600 rounded-xl text-white group-hover:scale-110 transition-transform">
              <BedIcon className="w-6 h-6" />
            </div>
            <ArrowRight className="w-5 h-5 text-cyan-600 group-hover:translate-x-1 transition-transform" />
          </div>
          <h3 className="text-xl font-bold text-slate-800 mb-2">Sơ Đồ Buồng Giường</h3>
          <p className="text-sm text-slate-600 leading-relaxed">
            Theo dõi trạng thái giường real-time, phân bổ giường và điều phối nhập viện.
          </p>
          <div className="mt-4 flex items-center space-x-2 text-xs font-semibold text-cyan-700">
            <span>{stats.occupiedBeds} đang chiếm</span>
            <span>•</span>
            <span>{stats.availableBeds} trống</span>
          </div>
        </Link>

        {/* Admissions */}
        <Link
          href="/dashboard/hospital/admissions"
          className="group bg-gradient-to-br from-indigo-50 to-purple-50 hover:from-indigo-100 hover:to-purple-100 p-6 rounded-2xl border border-indigo-200 shadow-sm hover:shadow-lg transition-all"
        >
          <div className="flex items-start justify-between mb-4">
            <div className="p-3 bg-indigo-600 rounded-xl text-white group-hover:scale-110 transition-transform">
              <Hospital className="w-6 h-6" />
            </div>
            <ArrowRight className="w-5 h-5 text-indigo-600 group-hover:translate-x-1 transition-transform" />
          </div>
          <h3 className="text-xl font-bold text-slate-800 mb-2">Bệnh Án Nội Trú</h3>
          <p className="text-sm text-slate-600 leading-relaxed">
            Quản lý bệnh án EMR, tiếp nhận nhập viện, xuất viện và in phiếu.
          </p>
          <div className="mt-4 flex items-center space-x-2 text-xs font-semibold text-indigo-700">
            <span>{stats.activeAdmissions} đang điều trị</span>
          </div>
        </Link>

        {/* Nursing Vitals */}
        <Link
          href="/dashboard/hospital/nursing-vitals"
          className="group bg-gradient-to-br from-orange-50 to-red-50 hover:from-orange-100 hover:to-red-100 p-6 rounded-2xl border border-orange-200 shadow-sm hover:shadow-lg transition-all"
        >
          <div className="flex items-start justify-between mb-4">
            <div className="p-3 bg-orange-600 rounded-xl text-white group-hover:scale-110 transition-transform">
              <Activity className="w-6 h-6" />
            </div>
            <ArrowRight className="w-5 h-5 text-orange-600 group-hover:translate-x-1 transition-transform" />
          </div>
          <h3 className="text-xl font-bold text-slate-800 mb-2">Theo Dõi Sinh Hiệu</h3>
          <p className="text-sm text-slate-600 leading-relaxed">
            Ghi nhận và giám sát sinh hiệu: nhiệt độ, huyết áp, nhịp tim, SpO2.
          </p>
          <div className="mt-4 flex items-center space-x-2 text-xs font-semibold text-orange-700">
            <span>{stats.abnormalVitals} bất thường</span>
          </div>
        </Link>

        {/* MAR System */}
        <Link
          href="/dashboard/hospital/mar"
          className="group bg-gradient-to-br from-purple-50 to-pink-50 hover:from-purple-100 hover:to-pink-100 p-6 rounded-2xl border border-purple-200 shadow-sm hover:shadow-lg transition-all"
        >
          <div className="flex items-start justify-between mb-4">
            <div className="p-3 bg-purple-600 rounded-xl text-white group-hover:scale-110 transition-transform">
              <Pill className="w-6 h-6" />
            </div>
            <ArrowRight className="w-5 h-5 text-purple-600 group-hover:translate-x-1 transition-transform" />
          </div>
          <h3 className="text-xl font-bold text-slate-800 mb-2">Phiếu Y Lệnh (MAR)</h3>
          <p className="text-sm text-slate-600 leading-relaxed">
            Quản lý lịch uống thuốc và theo dõi thực hiện y lệnh của điều dưỡng.
          </p>
          <div className="mt-4 flex items-center space-x-2 text-xs font-semibold text-purple-700">
            <span>{stats.pendingMAR} chờ thực hiện</span>
            {stats.overdueMAR > 0 && (
              <>
                <span>•</span>
                <span className="text-amber-700">{stats.overdueMAR} quá hạn</span>
              </>
            )}
          </div>
        </Link>

        {/* Ancillary (LIS/RIS) */}
        <Link
          href="/dashboard/hospital/ancillary"
          className="group bg-gradient-to-br from-emerald-50 to-teal-50 hover:from-emerald-100 hover:to-teal-100 p-6 rounded-2xl border border-emerald-200 shadow-sm hover:shadow-lg transition-all"
        >
          <div className="flex items-start justify-between mb-4">
            <div className="p-3 bg-emerald-600 rounded-xl text-white group-hover:scale-110 transition-transform">
              <ClipboardList className="w-6 h-6" />
            </div>
            <ArrowRight className="w-5 h-5 text-emerald-600 group-hover:translate-x-1 transition-transform" />
          </div>
          <h3 className="text-xl font-bold text-slate-800 mb-2">Cận Lâm Sàng</h3>
          <p className="text-sm text-slate-600 leading-relaxed">
            LIS/RIS: Xét nghiệm sinh hóa, chẩn đoán hình ảnh PACS DICOM.
          </p>
        </Link>

        {/* BHYT Export */}
        <Link
          href="/dashboard/hospital/bhyt"
          className="group bg-gradient-to-br from-slate-50 to-gray-50 hover:from-slate-100 hover:to-gray-100 p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-lg transition-all"
        >
          <div className="flex items-start justify-between mb-4">
            <div className="p-3 bg-slate-700 rounded-xl text-white group-hover:scale-110 transition-transform">
              <Thermometer className="w-6 h-6" />
            </div>
            <ArrowRight className="w-5 h-5 text-slate-600 group-hover:translate-x-1 transition-transform" />
          </div>
          <h3 className="text-xl font-bold text-slate-800 mb-2">Giám Định BHYT</h3>
          <p className="text-sm text-slate-600 leading-relaxed">
            Kết xuất XML 130 chuẩn Bộ Y tế, gửi hồ sơ thanh toán BHYT.
          </p>
        </Link>
      </div>
    </div>
  );
}
