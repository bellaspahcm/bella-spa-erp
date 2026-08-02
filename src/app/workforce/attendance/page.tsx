'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  MapPin, Milestone, Loader2, Navigation, CheckCircle2, 
  ChevronLeft, Camera, RefreshCw, Clock, AlertCircle, FileText
} from 'lucide-react';
import { getKTVTodayAttendance, ktvCheckIn, ktvCheckOut } from '@/services/attendance-actions';
import { getRealEstateProjects, projectSiteCheckIn, getMyCheckIns, RealEstateProjectSummary, ProjectCheckInRecord } from '@/services/workforce-actions';
import { toast } from 'sonner';
import Link from 'next/link';

export default function AttendanceAndCheckIn() {
  const [activeTab, setActiveTab] = useState<'shift' | 'project'>('shift');
  const [projects, setProjects] = useState<RealEstateProjectSummary[]>([]);
  const [checkIns, setCheckIns] = useState<ProjectCheckInRecord[]>([]);
  const [todayAttendance, setTodayAttendance] = useState<any>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [isGpsLoading, setIsGpsLoading] = useState(false);

  // Form states for project check-in
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [visitPurpose, setVisitPurpose] = useState<'site_duty' | 'customer_tour' | 'meeting' | 'training' | 'other'>('customer_tour');
  const [notes, setNotes] = useState('');
  const [coords, setCoords] = useState<{ latitude: number; longitude: number; accuracy: number } | null>(null);

  const fetchAttendanceAndProjects = useCallback(async () => {
    try {
      const [att, projs, history] = await Promise.all([
        getKTVTodayAttendance(),
        getRealEstateProjects(),
        getMyCheckIns()
      ]);
      setTodayAttendance(att);
      setProjects(projs);
      setCheckIns(history);
      if (projs.length > 0) {
        setSelectedProjectId(projs[0].id);
      }
    } catch (err) {
      console.error('[Attendance] Fetch failed:', err);
      toast.error('Lỗi khi tải dữ liệu chấm công');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAttendanceAndProjects();
  }, [fetchAttendanceAndProjects]);

  const requestGps = async () => {
    setIsGpsLoading(true);
    try {
      if (!('geolocation' in navigator)) {
        toast.error('Trình duyệt không hỗ trợ xác định vị trí GPS.');
        return;
      }
      
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          timeout: 10000,
          enableHighAccuracy: true
        });
      });
      
      setCoords({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy
      });
      toast.success('Đã lấy tọa độ định vị thành công!');
    } catch (err) {
      console.error('GPS permission failed:', err);
      toast.error('Không thể truy cập GPS. Vui lòng cho phép định vị trong cài đặt.');
    } finally {
      setIsGpsLoading(false);
    }
  };

  const handleShiftCheckIn = async () => {
    setIsActionLoading(true);
    try {
      const res = await ktvCheckIn();
      if (res.success) {
        toast.success('Check-in ca trực thành công!');
        fetchAttendanceAndProjects();
      } else {
        toast.error(res.error || 'Check-in thất bại');
      }
    } catch (err) {
      toast.error('Lỗi kết nối khi check-in');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleShiftCheckOut = async () => {
    setIsActionLoading(true);
    try {
      const res = await ktvCheckOut();
      if (res.success) {
        toast.success('Check-out ca trực thành công!');
        fetchAttendanceAndProjects();
      } else {
        toast.error(res.error || 'Check-out thất bại');
      }
    } catch (err) {
      toast.error('Lỗi kết nối khi check-out');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleProjectCheckInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId) {
      toast.error('Vui lòng chọn dự án');
      return;
    }
    if (!coords) {
      toast.error('Vui lòng bật định vị GPS trước khi check-in dự án');
      return;
    }

    setIsActionLoading(true);
    try {
      const res = await projectSiteCheckIn({
        project_id: selectedProjectId,
        latitude: coords.latitude,
        longitude: coords.longitude,
        notes: notes || undefined
      });

      if (res.success) {
        toast.success('Check-in tại dự án thành công!');
        setNotes('');
        fetchAttendanceAndProjects();
      } else {
        toast.error(res.error || 'Check-in dự án thất bại');
      }
    } catch (err) {
      toast.error('Lỗi kết nối khi check-in dự án');
    } finally {
      setIsActionLoading(false);
    }
  };

  const getPurposeLabel = (p: string) => {
    switch (p) {
      case 'site_duty': return 'Trực dự án';
      case 'customer_tour': return 'Dẫn khách xem nhà';
      case 'meeting': return 'Họp thực địa';
      case 'training': return 'Đào tạo';
      default: return 'Khác';
    }
  };

  return (
    <div className="pb-24 min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* HEADER */}
      <div className="px-6 pt-8 pb-4 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 sticky top-0 z-30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href="/workforce/dashboard" className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <h2 className="text-base font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">Điểm danh & Check-in</h2>
        </div>
      </div>

      {/* TABS */}
      <div className="px-5 mt-4">
        <div className="bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl flex">
          <button 
            onClick={() => setActiveTab('shift')}
            className={`flex-1 py-3 text-xs font-black uppercase tracking-wider rounded-xl transition-all ${activeTab === 'shift' ? 'bg-white dark:bg-slate-900 shadow-sm text-primary' : 'text-slate-500'}`}
          >
            Ca làm việc
          </button>
          <button 
            onClick={() => setActiveTab('project')}
            className={`flex-1 py-3 text-xs font-black uppercase tracking-wider rounded-xl transition-all ${activeTab === 'project' ? 'bg-white dark:bg-slate-900 shadow-sm text-primary' : 'text-slate-500'}`}
          >
            Check-in Dự án
          </button>
        </div>
      </div>

      {/* CONTENT */}
      <div className="p-5 space-y-6">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <p className="mt-2 text-xs text-slate-400 font-bold uppercase tracking-wider">Đang tải dữ liệu...</p>
          </div>
        ) : activeTab === 'shift' ? (
          /* TAB 1: SHIFT ATTENDANCE */
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm text-center space-y-4">
              <div className="w-16 h-16 bg-slate-55 rounded-2xl bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center mx-auto text-indigo-600 dark:text-indigo-400">
                <Clock className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-800 dark:text-slate-100">Điểm danh ngày hôm nay</h3>
                <p className="text-xs text-slate-400 font-medium mt-1">Ghi nhận giờ check-in và check-out hành chính</p>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-850">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Giờ vào</span>
                  <p className="text-base font-black text-slate-700 dark:text-slate-350 mt-1">
                    {todayAttendance?.checkin_time ? new Date(todayAttendance.checkin_time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                  </p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-850">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Giờ ra</span>
                  <p className="text-base font-black text-slate-700 dark:text-slate-350 mt-1">
                    {todayAttendance?.checkout_time ? new Date(todayAttendance.checkout_time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                  </p>
                </div>
              </div>

              <div className="pt-4">
                {!todayAttendance?.checkin_time ? (
                  <button
                    onClick={handleShiftCheckIn}
                    disabled={isActionLoading}
                    className="w-full bg-primary hover:bg-primary-hover text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-md transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isActionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                    Bắt đầu ca làm (Check-in)
                  </button>
                ) : !todayAttendance?.checkout_time ? (
                  <button
                    onClick={handleShiftCheckOut}
                    disabled={isActionLoading}
                    className="w-full bg-slate-850 hover:bg-slate-900 text-slate-700 dark:text-slate-300 py-4 rounded-2xl font-black text-xs uppercase tracking-widest border border-slate-200 dark:border-slate-700 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isActionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                    Kết thúc ca làm (Check-out)
                  </button>
                ) : (
                  <div className="bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 p-4 rounded-2xl border border-emerald-100 dark:border-emerald-900/40 text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2">
                    <CheckCircle2 className="w-5 h-5" /> Đã hoàn thành ngày công hôm nay!
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* TAB 2: SITE CHECK-IN */
          <div className="space-y-6">
            <form onSubmit={handleProjectCheckInSubmit} className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Chọn dự án</label>
                <select
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-750 rounded-2xl px-4 py-3.5 text-xs outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
                >
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Mục đích check-in</label>
                <select
                  value={visitPurpose}
                  onChange={(e: any) => setVisitPurpose(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-750 rounded-2xl px-4 py-3.5 text-xs outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
                >
                  <option value="customer_tour">Dẫn khách xem nhà mẫu</option>
                  <option value="site_duty">Trực sa bàn / dự án</option>
                  <option value="meeting">Họp tại công trường</option>
                  <option value="training">Tham gia đào tạo dự án</option>
                  <option value="other">Khác</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Ghi chú</label>
                <input
                  type="text"
                  placeholder="Ghi chú thêm (tên khách hàng đi cùng...)"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-750 rounded-2xl px-4 py-3 text-xs outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
                />
              </div>

              {/* GPS coordinates panel */}
              <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-850 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tọa độ GPS xác thực</span>
                  <button
                    type="button"
                    onClick={requestGps}
                    disabled={isGpsLoading}
                    className="p-1.5 bg-primary/10 text-primary border border-primary/20 hover:bg-primary/15 rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center gap-1"
                  >
                    {isGpsLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Navigation className="w-3 h-3" />}
                    Lấy vị trí
                  </button>
                </div>
                {coords ? (
                  <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-bold text-slate-650">
                    <div className="bg-white dark:bg-slate-850 p-2 rounded-xl border border-slate-100/50">
                      <span className="text-slate-400 uppercase tracking-widest text-[8px]">Vĩ độ</span>
                      <p className="mt-0.5 font-black text-slate-700 dark:text-slate-350">{coords.latitude.toFixed(5)}</p>
                    </div>
                    <div className="bg-white dark:bg-slate-850 p-2 rounded-xl border border-slate-100/50">
                      <span className="text-slate-400 uppercase tracking-widest text-[8px]">Kinh độ</span>
                      <p className="mt-0.5 font-black text-slate-700 dark:text-slate-350">{coords.longitude.toFixed(5)}</p>
                    </div>
                    <div className="bg-white dark:bg-slate-850 p-2 rounded-xl border border-slate-100/50">
                      <span className="text-slate-400 uppercase tracking-widest text-[8px]">Sai số</span>
                      <p className="mt-0.5 font-black text-slate-700 dark:text-slate-350">±{coords.accuracy.toFixed(0)}m</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-[10px] text-rose-500 font-bold text-center flex items-center justify-center gap-1.5 py-1">
                    <AlertCircle className="w-4 h-4" /> Vui lòng click "Lấy vị trí" để lấy tọa độ hiện tại.
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={isActionLoading || !coords}
                className="w-full bg-primary hover:bg-primary-hover text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-md transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isActionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                Xác thực điểm trực (Check-in dự án)
              </button>
            </form>

            {/* CHECK-IN HISTORY */}
            <div className="space-y-3">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Lịch sử check-in dự án</h3>
              {checkIns.length === 0 ? (
                <p className="text-slate-400 text-xs text-center py-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800">
                  Chưa ghi nhận lượt check-in dự án nào.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {checkIns.map(item => (
                    <div key={item.id} className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 rounded-xl flex items-center justify-center">
                          <CheckCircle2 className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-xs font-black text-slate-800 dark:text-slate-200">{item.project_name}</h4>
                          <p className="text-[9px] font-black uppercase text-indigo-500 mt-0.5">{getPurposeLabel(item.visit_purpose)}</p>
                          {item.notes && <p className="text-[10px] text-slate-500 mt-1">{item.notes}</p>}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-[9px] font-bold text-slate-400">{new Date(item.checkin_time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
                        <p className="text-[8px] font-black text-slate-300 dark:text-slate-500 uppercase tracking-wider mt-0.5">
                          {new Date(item.checkin_time).toLocaleDateString('vi-VN')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
