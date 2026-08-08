'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Users,
  Activity,
  Pill,
  CheckCircle2,
  Clock,
  ArrowRight,
  Eye,
  PhoneCall,
  Check,
  History,
  AlertCircle,
  RefreshCw,
  Search,
  Filter,
  UserCheck
} from 'lucide-react';

// Type definitions ensuring zero 'any' types (Law 11 compliance)
interface SafetyIndicator {
  label: string;
  value: number | string;
  status: 'critical' | 'high' | 'warning' | 'normal';
  colorClass: string;
}

interface SafetyAlert {
  id: string;
  severity: 'critical' | 'high' | 'warning';
  patientName: string;
  room: string;
  issue: string;
  detectedAt: string;
  timeDiff: string;
}

interface PatientMonitorItem {
  name: string;
  room: string;
  risk: 'high' | 'medium' | 'stable';
  vitals: 'abnormal' | 'stable';
  vitalsDetail: string;
  medication: 'ok' | 'pending';
  lastEvent: string;
}

interface SafetyDomain {
  name: string;
  status: 'normal' | 'alert';
  details: string;
}

interface IncidentItem {
  id: string;
  title: string;
  patient: string;
  severity: 'high' | 'critical' | 'warning';
  timeline: {
    status: string;
    time: string;
    detail: string;
  }[];
  currentStatus: string;
}

interface SafetyEvent {
  time: string;
  status: 'normal' | 'high' | 'warning' | 'critical';
  message: string;
}

function ClinicalSafetyCommandCenterContent() {
  const searchParams = useSearchParams();
  const filterParam = searchParams.get('filter');
  const severityParam = searchParams.get('severity');

  const [currentTime, setCurrentTime] = useState<string>('');
  const [filterSeverity, setFilterSeverity] = useState<string>('all');

  // Synchronize URL query params with state
  useEffect(() => {
    if (severityParam) {
      setFilterSeverity(severityParam);
    } else {
      setFilterSeverity('all');
    }
  }, [severityParam]);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const options: Intl.DateTimeFormatOptions = {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      };
      setCurrentTime(now.toLocaleTimeString('vi-VN', options));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const isActionQueueMode = filterParam === 'active';

  // Mock data for Safety Overview Indicators
  const safetyIndicators: SafetyIndicator[] = [
    { label: 'Cảnh báo Critical', value: 0, status: 'critical', colorClass: 'border-rose-200 bg-rose-50/70 text-rose-800' },
    { label: 'Cảnh báo High', value: 2, status: 'high', colorClass: 'border-amber-200 bg-amber-50/70 text-amber-800' },
    { label: 'Cảnh báo Warning', value: 4, status: 'warning', colorClass: 'border-yellow-200 bg-yellow-50/70 text-yellow-800' },
    { label: 'BN đang giám sát', value: 28, status: 'normal', colorClass: 'border-blue-200 bg-blue-50/70 text-blue-800' },
    { label: 'Sinh hiệu bất thường', value: 1, status: 'high', colorClass: 'border-orange-200 bg-orange-50/70 text-orange-800' },
    { label: 'Y lệnh quá hạn', value: 0, status: 'normal', colorClass: 'border-slate-200 bg-slate-50/70 text-slate-800' },
    { label: 'Identity Risk', value: 0, status: 'normal', colorClass: 'border-slate-200 bg-slate-50/70 text-slate-800' },
    { label: 'Incident đang xử lý', value: 1, status: 'high', colorClass: 'border-amber-200 bg-amber-50/70 text-amber-800' },
  ];

  // Active Clinical Safety Alerts
  const [activeAlerts, setActiveAlerts] = useState<SafetyAlert[]>([
    {
      id: 'alt-001',
      severity: 'critical',
      patientName: 'Nguyễn Văn Hùng',
      room: 'Phòng 302',
      issue: 'SpO₂ 88% — dưới ngưỡng an toàn (90%)',
      detectedAt: '08:47:21',
      timeDiff: '3 phút trước'
    },
    {
      id: 'alt-002',
      severity: 'high',
      patientName: 'Trần Thị Thu Hà',
      room: 'Khoa Nội trú (Buồng 305)',
      issue: 'Y lệnh thuốc MAR chưa thực hiện quá thời gian',
      detectedAt: '08:38:12',
      timeDiff: '12 phút trước'
    },
  ]);

  // Patients Safety Monitor
  const patientsMonitor: PatientMonitorItem[] = [
    {
      name: 'Nguyễn Văn Hùng',
      room: 'Nội 302',
      risk: 'high',
      vitals: 'abnormal',
      vitalsDetail: 'SpO₂ 88%',
      medication: 'ok',
      lastEvent: '30 giây trước'
    },
    {
      name: 'Trần Thị Thu Hà',
      room: 'Nội 305',
      risk: 'medium',
      vitals: 'stable',
      vitalsDetail: 'Sinh hiệu ổn định',
      medication: 'pending',
      lastEvent: '2 phút trước'
    },
    {
      name: 'Phạm Minh Anh',
      room: 'ICU 01',
      risk: 'stable',
      vitals: 'stable',
      vitalsDetail: 'Sinh hiệu ổn định',
      medication: 'ok',
      lastEvent: '10 giây trước'
    },
  ];

  // Clinical Safety Domains Status
  const safetyDomains: SafetyDomain[] = [
    { name: 'An Toàn Cấp Phát Thuốc (Medication)', status: 'normal', details: 'Bình thường' },
    { name: 'Theo Dõi Sinh Hiệu (Vital Signs)', status: 'alert', details: '1 Cảnh báo hoạt động' },
    { name: 'Xác Thực Danh Tính (Identity)', status: 'normal', details: 'Bình thường' },
    { name: 'Kiểm Soát Dị Ứng (Allergy Safety)', status: 'normal', details: 'Bình thường' },
    { name: 'Giá Trị Xét Nghiệm Cảnh Báo (Critical Lab)', status: 'normal', details: 'Bình thường' },
    { name: 'Truyền Máu An Toàn (Blood Safety)', status: 'normal', details: 'Bình thường' },
    { name: 'Bảo Vệ Phòng Mổ (Surgical Safety)', status: 'normal', details: 'Bình thường' },
    { name: 'Phân Loại Cấp Cứu (Triage)', status: 'normal', details: 'Bình thường' },
  ];

  // Safety Event Stream (Timeline)
  const eventStream: SafetyEvent[] = [
    { time: '08:50:31', status: 'normal', message: 'Y lệnh thuốc được hoàn thành cho bệnh nhân Trần Thị Thu Hà' },
    { time: '08:49:12', status: 'warning', message: 'Ngưỡng sinh hiệu tiến gần giới hạn cảnh báo tại giường ICU-02' },
    { time: '08:48:45', status: 'high', message: 'Cảnh báo điều dưỡng tại phòng 302 đã được xác nhận (Acknowledged)' },
    { time: '08:47:21', status: 'critical', message: 'Phát hiện SpO₂ bất thường (88%) của bệnh nhân Nguyễn Văn Hùng (P.302)' },
    { time: '08:46:03', status: 'normal', message: 'Bệnh nhân Phạm Minh Anh nhập khoa ICU' },
  ];

  // Incident Lifecycle mock data
  const incidentCenter: IncidentItem = {
    id: 'INC-2026-0081',
    title: 'Medication administration delay (Trễ y lệnh cấp phát thuốc)',
    patient: 'Trần Thị Thu Hà',
    severity: 'high',
    timeline: [
      { status: 'Detected', time: '08:31', detail: 'Hệ thống tự động phát hiện trễ y lệnh 15 phút' },
      { status: 'Acknowledged', time: '08:33', detail: 'Xác nhận bởi Điều dưỡng trưởng' },
      { status: 'Assigned', time: '08:35', detail: 'Giao xử lý cho Trạm Điều Dưỡng 02' },
      { status: 'Investigating', time: '08:38', detail: 'Đang kiểm tra tồn kho tủ thuốc trực phân khoa' },
    ],
    currentStatus: 'Investigating (Đang điều tra)'
  };

  const handleAcknowledgeAlert = (alertId: string) => {
    setActiveAlerts((prev) => prev.filter((alert) => alert.id !== alertId));
  };

  const filteredAlerts = activeAlerts.filter(
    (a) => filterSeverity === 'all' || a.severity === filterSeverity
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 text-slate-800">
      {/* HEADER COMMAND AREA */}
      <div className="bg-slate-900 text-slate-200 px-6 py-4 rounded-3xl flex flex-col md:flex-row md:items-center md:justify-between shadow-lg border border-slate-800 gap-4">
        <div>
          <div className="flex items-center space-x-2 text-rose-400 mb-1">
            <ShieldAlert className="w-5 h-5 animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-wider">
              {isActionQueueMode ? 'Clinical Safety Action Queue' : 'Clinical Safety Command Center'}
            </span>
          </div>
          <h1 className="text-2xl font-black uppercase tracking-tight text-white">
            {isActionQueueMode ? 'Xử Lý Cảnh Báo An Toàn' : 'Giám Sát An Toàn Lâm Sàng'}
          </h1>
          <div className="text-[11px] text-slate-400 font-bold mt-0.5 flex items-center space-x-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
            <span>
              {isActionQueueMode 
                ? 'HÀNG ĐỢI HÀNH ĐỘNG KHẨN CẤP' 
                : 'HỆ THỐNG ĐANG HOẠT ĐỘNG CẬP NHẬT REAL-TIME'} • {currentTime || '08:50:32'}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button 
            onClick={() => setFilterSeverity('critical')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
              filterSeverity === 'critical' 
                ? 'bg-rose-600 border-rose-500 text-white shadow-md' 
                : 'bg-slate-800 border-slate-700 text-rose-400 hover:bg-slate-700'
            }`}
          >
            🔴 P0 Critical
          </button>
          <button 
            onClick={() => setFilterSeverity('high')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
              filterSeverity === 'high' 
                ? 'bg-amber-600 border-amber-500 text-white shadow-md' 
                : 'bg-slate-800 border-slate-700 text-amber-400 hover:bg-slate-700'
            }`}
          >
            🟠 P1 High
          </button>
          <button 
            onClick={() => setFilterSeverity('warning')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
              filterSeverity === 'warning' 
                ? 'bg-yellow-600 border-yellow-500 text-white shadow-md' 
                : 'bg-slate-800 border-slate-700 text-yellow-400 hover:bg-slate-700'
            }`}
          >
            🟡 P2 Warning
          </button>
          {filterSeverity !== 'all' && (
            <button 
              onClick={() => setFilterSeverity('all')}
              className="px-2.5 py-1.5 bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 rounded-xl text-xs font-bold transition-all"
            >
              Reset Lọc
            </button>
          )}
          <span className="text-slate-700 px-1 hidden sm:inline">|</span>
          <Link
            href="/dashboard/hospital/queue?tab=incidents"
            className="px-4 py-1.5 bg-slate-800 border border-slate-700 text-slate-200 hover:bg-slate-700 rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow"
          >
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Incident Center</span>
          </Link>
        </div>
      </div>

      {/* 1. SAFETY OVERVIEW - TOP KPI ROW */}
      <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200/60 shadow-inner">
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {safetyIndicators.map((indicator, idx) => {
            const isCriticalZero = indicator.status === 'critical' && indicator.value === 0;
            return (
              <div 
                key={idx}
                className={`p-4 border rounded-2xl flex flex-col justify-between shadow-sm transition-all hover:shadow-md ${indicator.colorClass} ${
                  isCriticalZero ? 'ring-2 ring-emerald-500/30 border-emerald-200 bg-emerald-50/80 text-emerald-900 shadow-emerald-100' : ''
                }`}
              >
                <div className="text-[10px] uppercase font-bold tracking-wider opacity-80 leading-snug">
                  {indicator.label}
                </div>
                <div className="flex items-baseline space-x-1 mt-2">
                  <span className={`text-2xl font-black ${
                    isCriticalZero ? 'text-emerald-600' : ''
                  }`}>
                    {indicator.value}
                  </span>
                  {isCriticalZero && (
                    <span className="text-[9px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded uppercase">An toàn</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* TWO COLUMN GRID LAYOUT WITH CONDITIONAL VIEW MODES */}
      {isActionQueueMode ? (
        /* MODE A: ACTION QUEUE MODE (Full-width Active Alerts only) */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-3 space-y-6">
            <div className="bg-white rounded-3xl border-2 border-indigo-100 shadow-md p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <h2 className="text-base font-black uppercase text-slate-900 tracking-tight flex items-center space-x-2">
                  <ShieldAlert className="w-5.5 h-5.5 text-rose-600 animate-pulse" />
                  <span className="text-rose-700">Hàng Đợi Xử Lý Cảnh Báo An Toàn Hoạt Động ({filteredAlerts.length})</span>
                </h2>
                <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">
                  Chế độ tập trung tác vụ (Action Mode)
                </span>
              </div>

              {filteredAlerts.length === 0 ? (
                <div className="p-16 border border-dashed border-slate-200 rounded-3xl flex flex-col items-center justify-center text-center space-y-3 bg-slate-50/50">
                  <CheckCircle2 className="w-12 h-12 text-emerald-500" />
                  <div className="text-sm font-extrabold text-slate-800 uppercase">Sạch cảnh báo hoạt động</div>
                  <p className="text-xs text-slate-500 max-w-sm">Không còn bất kỳ cảnh báo nguy hiểm hoặc y lệnh quá hạn nào đang chờ xử lý.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredAlerts.map((alert) => {
                    const isCritical = alert.severity === 'critical';
                    const isHigh = alert.severity === 'high';
                    return (
                      <div 
                        key={alert.id}
                        className={`p-5 border-2 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-sm hover:shadow transition-all ${
                          isCritical 
                            ? 'bg-rose-50/90 border-rose-200 ring-2 ring-rose-300/10' 
                            : isHigh 
                            ? 'bg-amber-50/95 border-amber-200' 
                            : 'bg-yellow-50/95 border-yellow-200'
                        }`}
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center space-x-2.5">
                            <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-md ${
                              isCritical 
                                ? 'bg-rose-600 text-white animate-pulse' 
                                : isHigh 
                                ? 'bg-amber-500 text-white' 
                                : 'bg-yellow-500 text-slate-900'
                            }`}>
                              {alert.severity} — YÊU CẦU XỬ LÝ
                            </span>
                            <span className="text-xs text-slate-400 font-bold">{alert.detectedAt} ({alert.timeDiff})</span>
                          </div>
                          <div className="text-base font-extrabold text-slate-900">
                            Bệnh nhân: {alert.patientName} — <span className="text-slate-500 font-semibold">{alert.room}</span>
                          </div>
                          <p className={`text-sm font-bold ${isCritical ? 'text-rose-700' : 'text-slate-700'}`}>
                            {alert.issue}
                          </p>
                        </div>

                        <div className="flex items-center gap-3.5 w-full md:w-auto justify-end">
                          <button className="flex-1 md:flex-initial px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl flex items-center justify-center space-x-1.5 shadow-sm transition-all">
                            <Eye className="w-4 h-4" />
                            <span>Mở Bệnh Án</span>
                          </button>
                          <button className="flex-1 md:flex-initial px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl flex items-center justify-center space-x-1.5 shadow-sm transition-all">
                            <PhoneCall className="w-4 h-4" />
                            <span>Gọi Đ.Dưỡng</span>
                          </button>
                          <button 
                            onClick={() => handleAcknowledgeAlert(alert.id)}
                            className="flex-1 md:flex-initial px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl flex items-center justify-center space-x-1.5 shadow-sm transition-all"
                          >
                            <Check className="w-4 h-4 text-emerald-400" />
                            <span>Đã Giải Quyết (ACK)</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Back button link to Overview */}
            <div className="flex justify-start">
              <Link 
                href="/dashboard/hospital/queue"
                className="text-xs font-bold text-slate-500 hover:text-slate-700 flex items-center space-x-1.5"
              >
                <span>← Trở lại Bảng Giám Sát Tổng Quan</span>
              </Link>
            </div>
          </div>
        </div>
      ) : (
        /* MODE B: FULL COMMAND CENTER OVERVIEW MODE */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* LEFT COLUMN: ALERTS & PATIENT MONITORING (2/3 width) */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* 2. CLINICAL SAFETY ALERTS - CENTRAL ACTION CENTER */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h2 className="text-base font-extrabold uppercase text-slate-900 tracking-tight flex items-center space-x-2">
                  <ShieldAlert className="w-5 h-5 text-rose-600" />
                  <span>Cảnh báo An toàn Lâm sàng kích hoạt ({filteredAlerts.length})</span>
                </h2>
                <span className="text-xs font-bold text-slate-400">Yêu cầu hành động tức thì</span>
              </div>

              {filteredAlerts.length === 0 ? (
                <div className="p-8 border border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center text-center space-y-2 bg-slate-50/50">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                  <div className="text-xs font-extrabold text-slate-800 uppercase">Không có cảnh báo hoạt động</div>
                  <p className="text-[11px] text-slate-500 max-w-sm">Hệ thống an toàn lâm sàng hiện tại ở trạng thái hoàn hảo.</p>
                </div>
              ) : (
                <div className="space-y-3.5">
                  {filteredAlerts.map((alert) => {
                    const isCritical = alert.severity === 'critical';
                    const isHigh = alert.severity === 'high';
                    return (
                      <div 
                        key={alert.id}
                        className={`p-4 border rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3.5 shadow-sm transition-all ${
                          isCritical 
                            ? 'bg-rose-50/80 border-rose-200 ring-1 ring-rose-300/20' 
                            : isHigh 
                            ? 'bg-amber-50/80 border-amber-200' 
                            : 'bg-yellow-50/80 border-yellow-200'
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                              isCritical 
                                ? 'bg-rose-600 text-white animate-pulse' 
                                : isHigh 
                                ? 'bg-amber-500 text-white' 
                                : 'bg-yellow-500 text-slate-900'
                            }`}>
                              {alert.severity} — YÊU CẦU XỬ LÝ
                            </span>
                            <span className="text-[10px] text-slate-400 font-bold">{alert.detectedAt} ({alert.timeDiff})</span>
                          </div>
                          <div className="text-sm font-extrabold text-slate-900">
                            BN {alert.patientName} — <span className="text-slate-600">{alert.room}</span>
                          </div>
                          <p className={`text-xs font-semibold ${isCritical ? 'text-rose-700' : 'text-slate-700'}`}>
                            {alert.issue}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                          <button className="flex-1 sm:flex-initial px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl flex items-center justify-center space-x-1 shadow-sm transition-all">
                            <Eye className="w-3.5 h-3.5" />
                            <span>Bệnh án</span>
                          </button>
                          <button className="flex-1 sm:flex-initial px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl flex items-center justify-center space-x-1 shadow-sm transition-all">
                            <PhoneCall className="w-3.5 h-3.5" />
                            <span>Gọi Đ.Dưỡng</span>
                          </button>
                          <button 
                            onClick={() => handleAcknowledgeAlert(alert.id)}
                            className="flex-1 sm:flex-initial px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl flex items-center justify-center space-x-1 shadow-sm transition-all"
                          >
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Xác nhận (ACK)</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 3. PATIENT SAFETY MONITOR - RISK LEVEL LIST */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h2 className="text-base font-extrabold uppercase text-slate-900 tracking-tight flex items-center space-x-2">
                  <Users className="w-5 h-5 text-indigo-600" />
                  <span>Bảng Giám Sát Cấp Độ Rủi Ro Bệnh Nhân</span>
                </h2>
                <span className="text-xs font-bold text-slate-400">Cập nhật 15s trước</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 text-[11px] font-black uppercase text-slate-400 tracking-wider">
                      <th className="p-2.5">Bệnh Nhân</th>
                      <th className="p-2.5">Phân Khoa / Phòng</th>
                      <th className="p-2.5 text-center">Cấp Độ Rủi Ro (Risk)</th>
                      <th className="p-2.5">Trạng Thái Sinh Hiệu</th>
                      <th className="p-2.5">Cấp Phát Thuốc (Med)</th>
                      <th className="p-2.5 text-right">Cập Nhật Cuối</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-semibold">
                    {patientsMonitor.map((item, idx) => {
                      const isHigh = item.risk === 'high';
                      const isMedium = item.risk === 'medium';
                      return (
                        <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                          <td className="p-3 font-extrabold text-slate-900">{item.name}</td>
                          <td className="p-3 text-slate-600">{item.room}</td>
                          <td className="p-3 text-center">
                            <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                              isHigh 
                                ? 'bg-rose-100 text-rose-800 border border-rose-200' 
                                : isMedium 
                                ? 'bg-amber-100 text-amber-800 border border-amber-200' 
                                : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            }`}>
                              {item.risk}
                            </span>
                          </td>
                          <td className="p-3">
                            <span className="flex items-center space-x-1.5">
                              <span className={`w-2 h-2 rounded-full ${item.vitals === 'abnormal' ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'}`} />
                              <span className={item.vitals === 'abnormal' ? 'text-rose-600 font-bold' : 'text-slate-700'}>
                                {item.vitalsDetail}
                              </span>
                            </span>
                          </td>
                          <td className="p-3">
                            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                              item.medication === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                            }`}>
                              {item.medication.toUpperCase()}
                            </span>
                          </td>
                          <td className="p-3 text-right text-slate-400 text-[10px]">{item.lastEvent}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

          </div>

          {/* RIGHT COLUMN: DOMAINS, INCIDENTS & REAL-TIME EVENT STREAM (1/3 width) */}
          <div className="space-y-6">

            {/* 5. SAFETY DOMAINS STATUS */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-extrabold uppercase text-slate-900 text-sm tracking-tight flex items-center space-x-2">
                  <ShieldCheck className="w-5 h-5 text-indigo-600" />
                  <span>Trạng Thái Phân Hệ An Toàn</span>
                </h3>
              </div>

              <div className="space-y-2.5">
                {safetyDomains.map((domain, idx) => {
                  const isAlert = domain.status === 'alert';
                  return (
                    <div 
                      key={idx} 
                      className={`flex items-center justify-between p-2.5 rounded-xl border transition-all text-xs ${
                        isAlert 
                          ? 'bg-amber-50/70 border-amber-200 text-amber-900 shadow-sm' 
                          : 'bg-slate-50/40 border-slate-100 text-slate-700'
                      }`}
                    >
                      <span className="font-bold">{domain.name}</span>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                        isAlert ? 'bg-amber-500 text-white animate-pulse' : 'bg-emerald-600 text-white'
                      }`}>
                        {isAlert ? 'Alert' : 'Normal'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 6. INCIDENT LIFE-CYCLE CONTROLLER */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-extrabold uppercase text-slate-900 text-sm tracking-tight flex items-center space-x-2">
                  <AlertCircle className="w-5 h-5 text-amber-600" />
                  <span>Incident Center (Vòng đời Sự cố)</span>
                </h3>
                <span className="text-[10px] font-black text-amber-700 bg-amber-50 px-2 py-0.5 rounded">High Severity</span>
              </div>

              <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-2xl space-y-2.5">
                <div className="text-[11px] font-bold text-slate-400 flex justify-between">
                  <span>MÃ SỰ CỐ: {incidentCenter.id}</span>
                  <span className="text-slate-600 uppercase">Trạng thái: {incidentCenter.currentStatus}</span>
                </div>
                <div className="text-xs font-extrabold text-slate-900">
                  {incidentCenter.title}
                </div>
                <div className="text-[11px] text-slate-500 font-semibold pl-2">
                  Bệnh nhân ảnh hưởng: <span className="text-slate-800 font-bold">{incidentCenter.patient}</span>
                </div>

                {/* Lifecycle Progress Timeline */}
                <div className="relative border-l border-slate-200 pl-4 ml-1 space-y-3.5 mt-4">
                  {incidentCenter.timeline.map((step, idx) => (
                    <div key={idx} className="relative">
                      {/* Bullet indicator */}
                      <span className={`absolute -left-[20.5px] top-1 w-2.5 h-2.5 rounded-full border border-white ${
                        idx === incidentCenter.timeline.length - 1 
                          ? 'bg-amber-500 ring-2 ring-amber-400/30' 
                          : 'bg-emerald-500'
                      }`} />
                      <div className="text-[10px] font-bold text-slate-400 flex items-center space-x-1.5">
                        <span className={idx === incidentCenter.timeline.length - 1 ? 'text-amber-600 font-extrabold' : 'text-emerald-600'}>
                          {step.status}
                        </span>
                        <span>•</span>
                        <span>{step.time}</span>
                      </div>
                      <p className="text-[10px] text-slate-700 font-bold leading-tight mt-0.5">{step.detail}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 4. REAL-TIME SAFETY EVENT STREAM */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-extrabold uppercase text-slate-900 text-sm tracking-tight flex items-center space-x-2">
                  <History className="w-5 h-5 text-indigo-600" />
                  <span>Safety Event Stream (Dòng Sự kiện)</span>
                </h3>
                <span className="text-[10px] font-bold text-slate-400">Thời gian thực</span>
              </div>

              <div className="space-y-3 pl-1 max-h-[220px] overflow-y-auto pr-1">
                {eventStream.map((event, idx) => {
                  const isCritical = event.status === 'critical';
                  const isHigh = event.status === 'high';
                  const isWarning = event.status === 'warning';
                  return (
                    <div key={idx} className="flex items-start space-x-3 text-[11px] font-bold leading-normal">
                      <span className="text-slate-400 tabular-nums">{event.time}</span>
                      <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                        isCritical 
                          ? 'bg-rose-500 ring-2 ring-rose-400/20' 
                          : isHigh 
                          ? 'bg-amber-500' 
                          : isWarning 
                          ? 'bg-yellow-400' 
                          : 'bg-emerald-500'
                      }`} />
                      <span className={isCritical ? 'text-rose-700 font-extrabold' : isHigh ? 'text-amber-800' : 'text-slate-700'}>
                        {event.message}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>

        </div>
      )}
    </div>
  );
}

export default function ClinicalSafetyCommandCenter() {
  return (
    <Suspense fallback={<div className="p-6 text-center text-xs font-bold text-slate-500">Đang tải trung tâm an toàn...</div>}>
      <ClinicalSafetyCommandCenterContent />
    </Suspense>
  );
}
