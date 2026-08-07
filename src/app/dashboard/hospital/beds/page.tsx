'use client';

import React, { useState, useEffect } from 'react';
import { Bed, Ward, BedStatus } from '@/types/healthcare';
import { useBedEngine } from '@/hooks/use-bed-engine';
import { BreakGlassSecurityService } from '@/services/healthcare-hospital-services';
import {
  Bed as BedIcon,
  Building,
  ShieldAlert,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  User,
  Clock,
  Activity,
  Plus,
} from 'lucide-react';

export default function HospitalBedsPage() {
  // Use Bed Engine hook instead of direct service calls
  const { queryBeds, allocateBed, releaseBed, loading: engineLoading, error: engineError } = useBedEngine();
  
  const [wards, setWards] = useState<Ward[]>([]);
  const [beds, setBeds] = useState<Bed[]>([]);
  const [selectedWardId, setSelectedWardId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  // Break-Glass Modal State
  const [showBreakGlassModal, setShowBreakGlassModal] = useState<boolean>(false);
  const [breakGlassPatientId, setBreakGlassPatientId] = useState<string>('');
  const [breakGlassReason, setBreakGlassReason] = useState<string>('');
  const [breakGlassSuccess, setBreakGlassSuccess] = useState<string>('');

  useEffect(() => {
    loadHospitalData();
  }, []);

  const loadHospitalData = async () => {
    setLoading(true);
    try {
      // Use queryBeds from useBedEngine hook
      const result = await queryBeds({ tenantId: 'bella_healthcare' });
      
      if (result.success && result.data) {
        setBeds(result.data);
        
        // Extract unique wards from beds
        const uniqueWards = Array.from(
          new Set(result.data.map((b) => b.ward_id))
        ).map((wardId) => {
          const bed = result.data.find((b) => b.ward_id === wardId);
          return {
            id: wardId,
            name: `Ward ${wardId}`, // Placeholder, should fetch from wards table
            code: wardId,
            tenant_id: 'bella_healthcare',
            capacity: 0,
            current_occupancy: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          } as Ward;
        });
        setWards(uniqueWards);
      }
    } catch (error) {
      console.error('[BedsPage] Failed to load beds:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (bedId: string, newStatus: BedStatus) => {
    try {
      // For now, update beds directly via Supabase
      // TODO: Add updateBedStatus to useBedEngine hook
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();
      
      const { data, error } = await supabase
        .from('hc_beds')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', bedId)
        .select()
        .single();
        
      if (error) throw error;
      if (data) {
        setBeds((prev) => prev.map((b) => (b.id === bedId ? data as Bed : b)));
      }
    } catch (error) {
      console.error('[BedsPage] Failed to update bed status:', error);
      alert('Không thể cập nhật trạng thái giường');
    }
  };

  const handleActivateBreakGlass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!breakGlassReason.trim()) return;

    try {
      await BreakGlassSecurityService.activateBreakGlassAccess({
        tenantId: 'bella_healthcare',
        userId: 'usr-doctor-001',
        userEmail: 'doctor@bella.vn',
        userName: 'BS. Trịnh Văn Nam (Trưởng Khoa ICU)',
        patientId: breakGlassPatientId || 'pat-001',
        reason: breakGlassReason,
      });

      setBreakGlassSuccess('Đã kích hoạt quyền mở EMR khẩn cấp khẩn cấp thành công! Tất cả hành động đã được ghi vết Audit Log.');
      setTimeout(() => {
        setShowBreakGlassModal(false);
        setBreakGlassSuccess('');
        setBreakGlassReason('');
      }, 2500);
    } catch {
      alert('Kích hoạt Break-Glass thất bại');
    }
  };

  const filteredBeds = beds.filter((bed) => {
    const matchesWard = selectedWardId === 'all' || bed.ward_id === selectedWardId;
    const matchesSearch = bed.bed_code.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesWard && matchesSearch;
  });

  const getStatusBadge = (status: BedStatus) => {
    switch (status) {
      case 'available':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">Trống (Sẵn sàng)</span>;
      case 'occupied':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-300">Đã có Bệnh nhân</span>;
      case 'cleaning':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">Đang Vệ sinh Khử khuẩn</span>;
      case 'maintenance':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-300">Bảo trì Thiết bị</span>;
      default:
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-800">{status}</span>;
    }
  };

  const getBedTypeLabel = (bedType: string) => {
    switch (bedType) {
      case 'icu': return 'Giường ICU Hồi sức';
      case 'vip': return 'Giường VIP Phòng Đơn';
      case 'isolation': return 'Giường Cách ly Đặc biệt';
      default: return 'Giường Nội trú Tiêu chuẩn';
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-cyan-900 via-teal-800 to-blue-900 rounded-2xl p-6 text-white shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center space-x-2 text-cyan-300 mb-1">
            <Building className="w-5 h-5" />
            <span className="text-xs font-semibold uppercase tracking-wider">Bella Hospital Core • Bed Engine System</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold">Sơ Đồ Quản Lý Buồng Giường Nội Trú</h1>
          <p className="text-cyan-100 text-sm mt-1">
            Theo dõi trạng thái buồng giường thời gian thực, điều phối nhập viện và hỗ trợ Break-Glass EMR khẩn cấp.
          </p>
        </div>
        <button
          onClick={() => setShowBreakGlassModal(true)}
          className="flex items-center space-x-2 bg-rose-600 hover:bg-rose-700 text-white px-4 py-2.5 rounded-xl font-semibold shadow-lg hover:shadow-rose-900/50 transition-all border border-rose-400/30"
        >
          <ShieldAlert className="w-5 h-5" />
          <span>Break-Glass Mở EMR Khẩn Cấp</span>
        </button>
      </div>

      {/* Stats Summary Widgets */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-3">
          <div className="p-3 bg-cyan-100 rounded-lg text-cyan-700">
            <BedIcon className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-800">{beds.length}</div>
            <div className="text-xs font-medium text-slate-500">Tổng Số Giường</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-3">
          <div className="p-3 bg-emerald-100 rounded-lg text-emerald-700">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-emerald-700">
              {beds.filter((b) => b.status === 'available').length}
            </div>
            <div className="text-xs font-medium text-slate-500">Giường Trống (Sẵn Sàng)</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-3">
          <div className="p-3 bg-rose-100 rounded-lg text-rose-700">
            <User className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-rose-700">
              {beds.filter((b) => b.status === 'occupied').length}
            </div>
            <div className="text-xs font-medium text-slate-500">Đang Có Bệnh Nhân</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-3">
          <div className="p-3 bg-amber-100 rounded-lg text-amber-700">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-amber-700">
              {beds.filter((b) => b.status === 'cleaning' || b.status === 'maintenance').length}
            </div>
            <div className="text-xs font-medium text-slate-500">Vệ Sinh / Bảo Trì</div>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex items-center space-x-3 w-full md:w-auto">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-semibold text-slate-700">Khoa điều trị:</span>
          <select
            value={selectedWardId}
            onChange={(e) => setSelectedWardId(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-800 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
          >
            <option value="all">Toàn bộ Các Khoa Nội Trú</option>
            {wards.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name} ({w.code})
              </option>
            ))}
          </select>
        </div>

        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm mã giường (ví dụ: ICU-BED-01)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-3 py-1.5 w-full border border-slate-300 rounded-lg text-sm bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
          />
        </div>
      </div>

      {/* Bed Grid Display */}
      {loading ? (
        <div className="p-12 text-center text-slate-500">Đang tải sơ đồ giường bệnh thời gian thực...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredBeds.map((bed) => {
            const ward = wards.find((w) => w.id === bed.ward_id);
            return (
              <div
                key={bed.id}
                className={`p-5 rounded-2xl border transition-all shadow-sm hover:shadow-md flex flex-col justify-between space-y-4 ${
                  bed.status === 'occupied'
                    ? 'border-rose-200 bg-gradient-to-br from-rose-50/50 via-white to-rose-50/30'
                    : bed.status === 'available'
                    ? 'border-emerald-200 bg-gradient-to-br from-emerald-50/50 via-white to-emerald-50/30'
                    : 'border-slate-200 bg-white'
                }`}
              >
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className="text-xs font-semibold text-cyan-700 uppercase tracking-wider">
                        {ward?.name || 'Khoa Nội Trú'}
                      </span>
                      <h3 className="text-lg font-bold text-slate-800">{bed.bed_code}</h3>
                    </div>
                    {getStatusBadge(bed.status)}
                  </div>

                  <div className="text-xs text-slate-600 space-y-1 mt-2">
                    <div className="flex justify-between">
                      <span>Loại giường:</span>
                      <span className="font-semibold text-slate-800">{getBedTypeLabel(bed.bed_type)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Giá viện phí giường/ngày:</span>
                      <span className="font-semibold text-emerald-700">
                        {bed.daily_rate.toLocaleString('vi-VN')} VNĐ
                      </span>
                    </div>
                    {bed.current_patient_id && (
                      <div className="mt-3 p-2.5 bg-rose-100/70 border border-rose-200 rounded-lg text-rose-900">
                        <div className="flex items-center space-x-1.5 font-bold text-xs">
                          <User className="w-3.5 h-3.5 text-rose-700" />
                          <span>Mã Bệnh nhân: {bed.current_patient_id}</span>
                        </div>
                        <div className="text-[11px] text-rose-700 mt-0.5">
                          Đợt nhập viện: {bed.current_admission_id}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Quick Action Bar */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <span className="text-[11px] text-slate-400 flex items-center">
                    <Clock className="w-3 h-3 mr-1" /> Cập nhật vừa xong
                  </span>
                  <div className="flex items-center space-x-1">
                    {bed.status === 'occupied' && (
                      <button
                        onClick={() => handleStatusChange(bed.id, 'cleaning')}
                        className="px-2.5 py-1 text-xs font-semibold bg-amber-600 text-white rounded-lg hover:bg-amber-700"
                      >
                        Cho Vệ sinh
                      </button>
                    )}
                    {bed.status === 'cleaning' && (
                      <button
                        onClick={() => handleStatusChange(bed.id, 'available')}
                        className="px-2.5 py-1 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                      >
                        Sẵn sàng Trống
                      </button>
                    )}
                    {bed.status === 'available' && (
                      <button
                        onClick={() => handleStatusChange(bed.id, 'occupied')}
                        className="px-2.5 py-1 text-xs font-semibold bg-cyan-700 text-white rounded-lg hover:bg-cyan-800"
                      >
                        Gán Nhập viện
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Break-Glass Access Emergency Modal */}
      {showBreakGlassModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-rose-200">
            <div className="flex items-center space-x-3 text-rose-700 mb-3">
              <ShieldAlert className="w-7 h-7" />
              <h2 className="text-xl font-bold">Kích Hoạt Break-Glass Mở EMR Khẩn Cấp</h2>
            </div>
            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              Tính năng Break-Glass cho phép Bác sĩ vượt rào xem hồ sơ bệnh án EMR của bệnh nhân trong các tình huống cấp cứu khẩn cấp. Mọi thao tác đều được lưu vết vĩnh viễn vào <strong>hc_security_break_glass_logs</strong> và gửi cảnh báo an ninh tới CISO.
            </p>

            {breakGlassSuccess ? (
              <div className="p-4 bg-emerald-100 border border-emerald-300 text-emerald-800 text-sm font-semibold rounded-xl flex items-center space-x-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span>{breakGlassSuccess}</span>
              </div>
            ) : (
              <form onSubmit={handleActivateBreakGlass} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Bệnh Nhân (ID / MRN Code):</label>
                  <input
                    type="text"
                    required
                    value={breakGlassPatientId}
                    onChange={(e) => setBreakGlassPatientId(e.target.value)}
                    placeholder="Nhập Mã MRN hoặc ID bệnh nhân (ví dụ: pat-001)..."
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-rose-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Lý Do Khẩn Cấp Bắt Buộc (Reason):</label>
                  <textarea
                    required
                    rows={3}
                    value={breakGlassReason}
                    onChange={(e) => setBreakGlassReason(e.target.value)}
                    placeholder="Nhập lý do y khoa khẩn cấp (ví dụ: Bệnh nhân suy hô hấp cấp tại ICU, cần xem tiền sử dị ứng penicillin)..."
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-rose-500 focus:outline-none"
                  />
                </div>

                <div className="flex justify-end space-x-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowBreakGlassModal(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 text-xs font-semibold text-white bg-rose-600 rounded-lg hover:bg-rose-700 shadow-md"
                  >
                    Xác Nhận Kích Hoạt Break-Glass
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
