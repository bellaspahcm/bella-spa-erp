'use client';

import { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { 
  AlertTriangle, 
  CheckCircle2, 
  ChevronDown,
  ChevronUp,
  XCircle,
  AlertCircle,
  TrendingDown,
  TrendingUp,
  Calendar,
  Award
} from 'lucide-react';
import { KtvSalaryRecord } from '@/types/domain';
import { useState } from 'react';
import { useModuleVocabulary } from '@/hooks/useModuleVocabulary';

interface PayrollHealthCheckProps {
  salaries: KtvSalaryRecord[];
  currentMonth: string;
}

type AnomalyType = 'zero_salary' | 'negative_salary' | 'high_change' | 'high_amount' | 'missing_attendance' | 'missing_kpi';
type SeverityLevel = 'critical' | 'warning' | 'info';

interface Anomaly {
  id: string;
  ktvId: string;
  ktvName: string;
  type: AnomalyType;
  severity: SeverityLevel;
  message: string;
  details?: string;
  value?: number;
}

export function PayrollHealthCheck({ salaries, currentMonth }: PayrollHealthCheckProps) {
  const vocab = useModuleVocabulary();
  const [isExpanded, setIsExpanded] = useState(true);

  // Detect all anomalies
  const anomalies = useMemo(() => {
    const detected: Anomaly[] = [];
    
    salaries.forEach(ktv => {
      // Critical: Negative salary
      if (ktv.totalSalary < 0) {
        detected.push({
          id: `${ktv.id}-negative`,
          ktvId: ktv.id,
          ktvName: ktv.name,
          type: 'negative_salary',
          severity: 'critical',
          message: 'Lương âm',
          details: 'Tạm ứng hoặc phạt vượt quá thu nhập',
          value: ktv.totalSalary
        });
      }
      
      // Critical: Zero salary (but should have data)
      else if (ktv.totalSalary === 0) {
        detected.push({
          id: `${ktv.id}-zero`,
          ktvId: ktv.id,
          ktvName: ktv.name,
          type: 'zero_salary',
          severity: 'critical',
          message: 'Lương = 0',
          details: `Không có dữ liệu: ${ktv.sessions === 0 ? 'không có ca' : ''} ${ktv.actualDays === 0 ? 'không có ngày công' : ''}`.trim(),
          value: 0
        });
      }
      
      // Warning: High salary (>15M)
      if (ktv.totalSalary > 15000000) {
        detected.push({
          id: `${ktv.id}-high`,
          ktvId: ktv.id,
          ktvName: ktv.name,
          type: 'high_amount',
          severity: 'warning',
          message: 'Lương cao bất thường',
          details: `Vượt ngưỡng 15M (${ktv.totalSalary.toLocaleString()}đ)`,
          value: ktv.totalSalary
        });
      }
      
      // Warning: Missing attendance data (actualDays undefined or 0)
      if (ktv.actualDays === undefined || ktv.actualDays === 0) {
        detected.push({
          id: `${ktv.id}-attendance`,
          ktvId: ktv.id,
          ktvName: ktv.name,
          type: 'missing_attendance',
          severity: 'warning',
          message: 'Thiếu dữ liệu chấm công',
          details: 'Chưa có bản ghi attendance hoặc 0 ngày công'
        });
      }
      
      // Info: Missing KPI bonus (when should have it)
      const targetSessions = ktv.kpiTargetSessions ?? 12;
      if (ktv.sessions >= targetSessions && ktv.kpiBonus === 0) {
        detected.push({
          id: `${ktv.id}-kpi`,
          ktvId: ktv.id,
          ktvName: ktv.name,
          type: 'missing_kpi',
          severity: 'info',
          message: 'Thiếu thưởng KPI',
          details: `Đã hoàn thành ${ktv.sessions} ca nhưng KPI bonus = 0`
        });
      }
      
      // TODO: High change detection - requires historical data
      // This would compare ktv.totalSalary with previous month
    });
    
    return detected;
  }, [salaries]);

  // Group by severity
  const criticalAnomalies = anomalies.filter(a => a.severity === 'critical');
  const warningAnomalies = anomalies.filter(a => a.severity === 'warning');
  const infoAnomalies = anomalies.filter(a => a.severity === 'info');

  const totalAnomalies = anomalies.length;
  const affectedKtvCount = new Set(anomalies.map(a => a.ktvId)).size;
  
  const isHealthy = totalAnomalies === 0;
  const hasCritical = criticalAnomalies.length > 0;

  // Determine overall status
  const getStatusConfig = () => {
    if (hasCritical) {
      return {
        icon: <XCircle className="w-6 h-6" />,
        bgColor: 'bg-red-50 dark:bg-[rgba(239,115,122,0.12)]',
        borderColor: 'border-red-200 dark:border-[rgba(239,115,122,0.42)]',
        textColor: 'text-red-900 dark:text-[#F3F5F7]',
        descriptionColor: 'text-red-800 dark:text-[#D8E3EA]',
        iconColor: 'text-red-600 dark:text-[#EF737A]',
        iconBg: 'bg-red-100 dark:bg-[rgba(239,115,122,0.18)]',
        toneClass: 'payroll-health-check-panel--critical',
        label: 'CẦN XỬ LÝ NGAY',
        description: `Phát hiện ${criticalAnomalies.length} vấn đề nghiêm trọng cần khắc phục trước khi xuất bản`
      };
    }
    
    if (warningAnomalies.length > 0) {
      return {
        icon: <AlertTriangle className="w-6 h-6" />,
        bgColor: 'bg-amber-50 dark:bg-[rgba(241,174,83,0.12)]',
        borderColor: 'border-amber-200 dark:border-[rgba(241,174,83,0.42)]',
        textColor: 'text-amber-900 dark:text-[#F3F5F7]',
        descriptionColor: 'text-amber-800 dark:text-[#D8E3EA]',
        iconColor: 'text-amber-600 dark:text-[#F1AE53]',
        iconBg: 'bg-amber-100 dark:bg-[rgba(241,174,83,0.18)]',
        toneClass: 'payroll-health-check-panel--warning',
        label: 'CÓ CẢNH BÁO',
        description: `Phát hiện ${warningAnomalies.length} điểm bất thường nên xem xét trước khi xuất bản`
      };
    }
    
    if (infoAnomalies.length > 0) {
      return {
        icon: <AlertCircle className="w-6 h-6" />,
        bgColor: 'bg-blue-50 dark:bg-[rgba(115,181,237,0.12)]',
        borderColor: 'border-blue-200 dark:border-[rgba(115,181,237,0.42)]',
        textColor: 'text-blue-900 dark:text-[#F3F5F7]',
        descriptionColor: 'text-blue-800 dark:text-[#D8E3EA]',
        iconColor: 'text-blue-600 dark:text-[#73B5ED]',
        iconBg: 'bg-blue-100 dark:bg-[rgba(115,181,237,0.18)]',
        toneClass: 'payroll-health-check-panel--info',
        label: 'LƯU Ý',
        description: `${infoAnomalies.length} điểm cần lưu ý (không chặn xuất bản)`
      };
    }
    
    return {
      icon: <CheckCircle2 className="w-6 h-6" />,
      bgColor: 'bg-green-50 dark:bg-[rgba(39,197,150,0.12)]',
      borderColor: 'border-green-200 dark:border-[rgba(39,197,150,0.42)]',
      textColor: 'text-green-900 dark:text-[#F3F5F7]',
      descriptionColor: 'text-green-800 dark:text-[#D8E3EA]',
      iconColor: 'text-green-600 dark:text-[#27C596]',
      iconBg: 'bg-green-100 dark:bg-[rgba(39,197,150,0.18)]',
      toneClass: 'payroll-health-check-panel--healthy',
      label: 'BẢNG LƯƠNG KHỎE MẠNH',
      description: 'Không phát hiện vấn đề. Sẵn sàng xuất bản.'
    };
  };

  const statusConfig = getStatusConfig();

  const getAnomalyIcon = (type: AnomalyType) => {
    switch (type) {
      case 'zero_salary':
      case 'negative_salary':
        return <XCircle className="w-4 h-4" />;
      case 'high_change':
        return <TrendingUp className="w-4 h-4" />;
      case 'high_amount':
        return <TrendingDown className="w-4 h-4" />;
      case 'missing_attendance':
        return <Calendar className="w-4 h-4" />;
      case 'missing_kpi':
        return <Award className="w-4 h-4" />;
      default:
        return <AlertCircle className="w-4 h-4" />;
    }
  };

  const getSeverityColor = (severity: SeverityLevel) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-700 border-red-200 dark:bg-[rgba(239,115,122,0.14)] dark:text-[#EF737A] dark:border-[rgba(239,115,122,0.38)]';
      case 'warning':
        return 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-[rgba(241,174,83,0.14)] dark:text-[#F1AE53] dark:border-[rgba(241,174,83,0.38)]';
      case 'info':
        return 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-[rgba(115,181,237,0.14)] dark:text-[#73B5ED] dark:border-[rgba(115,181,237,0.38)]';
    }
  };

  return (
    <Card className={`payroll-health-check-panel ${statusConfig.toneClass} p-5 ${statusConfig.bgColor} border-2 ${statusConfig.borderColor} mb-6 dark:shadow-[0_18px_44px_rgba(2,12,24,0.35)]`}>
      {/* Header - Always Visible */}
      <div 
        className="flex items-start justify-between cursor-pointer gap-4"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-start gap-4 flex-1">
          <div className={`p-3 ${statusConfig.iconBg} rounded-xl ${statusConfig.iconColor} shrink-0`}>
            {statusConfig.icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <h3 className={`text-xs font-black uppercase tracking-wider ${statusConfig.textColor}`}>
                🏥 HEALTH CHECK: {statusConfig.label}
              </h3>
              {!isHealthy && (
                <span className={`px-2 py-1 ${statusConfig.iconBg} ${statusConfig.textColor} rounded-full text-[10px] font-black uppercase tracking-wide shrink-0`}>
                  {affectedKtvCount}/{salaries.length} {vocab.worker.short}
                </span>
              )}
            </div>
            <p className={`text-sm font-medium ${statusConfig.descriptionColor} leading-relaxed`}>
              {statusConfig.description}
            </p>
            {!isHealthy && (
              <div className="flex flex-wrap gap-2 mt-3">
                {criticalAnomalies.length > 0 && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-red-100 text-red-700 rounded-lg text-xs font-bold dark:bg-[rgba(239,115,122,0.16)] dark:text-[#EF737A]">
                    <span className="w-2 h-2 bg-red-600 rounded-full animate-pulse dark:bg-[#EF737A]"></span>
                    {criticalAnomalies.length} Critical
                  </div>
                )}
                {warningAnomalies.length > 0 && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-100 text-amber-700 rounded-lg text-xs font-bold dark:bg-[rgba(241,174,83,0.16)] dark:text-[#F1AE53]">
                    <span className="w-2 h-2 bg-amber-600 rounded-full dark:bg-[#F1AE53]"></span>
                    {warningAnomalies.length} Warning
                  </div>
                )}
                {infoAnomalies.length > 0 && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-100 text-blue-700 rounded-lg text-xs font-bold dark:bg-[rgba(115,181,237,0.16)] dark:text-[#73B5ED]">
                    <span className="w-2 h-2 bg-blue-600 rounded-full dark:bg-[#73B5ED]"></span>
                    {infoAnomalies.length} Info
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        
        <div className={`${statusConfig.textColor} shrink-0 mt-1`}>
          {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </div>
      </div>

      {/* Expanded Content - Anomaly List */}
      {isExpanded && !isHealthy && (
        <div className="mt-5 pt-5 border-t-2 border-white dark:border-[#243F52]">
          <div className="space-y-3">
            {/* Critical Anomalies */}
            {criticalAnomalies.length > 0 && (
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-red-900 mb-2 dark:text-[#F3F5F7]">
                  🔴 Vấn đề nghiêm trọng (chặn xuất bản)
                </h4>
                <div className="space-y-2">
                  {criticalAnomalies.map(anomaly => (
                    <div 
                      key={anomaly.id}
                      className={`payroll-health-check-row flex flex-col sm:flex-row sm:items-center gap-3 p-4 bg-white rounded-lg border-2 ${getSeverityColor(anomaly.severity)} hover:shadow-sm transition-shadow dark:bg-[#112E43] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]`}
                    >
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className={`mt-0.5 shrink-0 p-2 rounded-lg ${getSeverityColor(anomaly.severity)}`}>
                          {getAnomalyIcon(anomaly.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-sm text-gray-900 mb-1 dark:text-[#F3F5F7]">
                            {anomaly.ktvName}
                          </div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-semibold text-red-700 dark:text-[#EF737A]">
                              → {anomaly.message}
                            </span>
                          </div>
                          <p className="text-xs text-gray-600 leading-relaxed dark:text-[#D8E3EA]">
                            {anomaly.details}
                          </p>
                        </div>
                      </div>
                      {anomaly.value !== undefined && (
                        <div className="sm:text-right shrink-0">
                          <span className="text-sm font-bold text-gray-900 bg-gray-100 px-3 py-1.5 rounded-lg inline-block dark:bg-[#091A2D] dark:text-[#F3F5F7] dark:border dark:border-[#243F52]">
                            {anomaly.value.toLocaleString()}đ
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Warning Anomalies */}
            {warningAnomalies.length > 0 && (
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-amber-900 mb-2 dark:text-[#F3F5F7]">
                  ⚠️ Cảnh báo (nên xem xét)
                </h4>
                <div className="space-y-2">
                  {warningAnomalies.map(anomaly => (
                    <div 
                      key={anomaly.id}
                      className={`payroll-health-check-row flex flex-col sm:flex-row sm:items-center gap-3 p-4 bg-white rounded-lg border ${getSeverityColor(anomaly.severity)} hover:shadow-sm transition-shadow dark:bg-[#112E43] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]`}
                    >
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className={`mt-0.5 shrink-0 p-2 rounded-lg ${getSeverityColor(anomaly.severity)}`}>
                          {getAnomalyIcon(anomaly.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-sm text-gray-900 mb-1 dark:text-[#F3F5F7]">
                            {anomaly.ktvName}
                          </div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-semibold text-amber-700 dark:text-[#F1AE53]">
                              → {anomaly.message}
                            </span>
                          </div>
                          <p className="text-xs text-gray-600 leading-relaxed dark:text-[#D8E3EA]">
                            {anomaly.details}
                          </p>
                        </div>
                      </div>
                      {anomaly.value !== undefined && (
                        <div className="sm:text-right shrink-0">
                          <span className="text-sm font-bold text-gray-900 bg-gray-100 px-3 py-1.5 rounded-lg inline-block dark:bg-[#091A2D] dark:text-[#F3F5F7] dark:border dark:border-[#243F52]">
                            {anomaly.value.toLocaleString()}đ
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Info Anomalies */}
            {infoAnomalies.length > 0 && (
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-blue-900 mb-2 dark:text-[#F3F5F7]">
                  ℹ️ Lưu ý (không chặn)
                </h4>
                <div className="space-y-2">
                  {infoAnomalies.map(anomaly => (
                    <div 
                      key={anomaly.id}
                      className={`payroll-health-check-row flex flex-col sm:flex-row sm:items-center gap-3 p-4 bg-white rounded-lg border ${getSeverityColor(anomaly.severity)} hover:shadow-sm transition-shadow dark:bg-[#112E43] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]`}
                    >
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className={`mt-0.5 shrink-0 p-2 rounded-lg ${getSeverityColor(anomaly.severity)}`}>
                          {getAnomalyIcon(anomaly.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-sm text-gray-900 mb-1 dark:text-[#F3F5F7]">
                            {anomaly.ktvName}
                          </div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-semibold text-blue-700 dark:text-[#73B5ED]">
                              → {anomaly.message}
                            </span>
                          </div>
                          <p className="text-xs text-gray-600 leading-relaxed dark:text-[#D8E3EA]">
                            {anomaly.details}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Healthy State - Show Quick Stats */}
      {isExpanded && isHealthy && (
        <div className="mt-5 pt-5 border-t-2 border-white dark:border-[#243F52]">
          <div className="grid grid-cols-3 gap-2 sm:gap-4">
            <div className="bg-white p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200/60 shadow-md hover:shadow-lg transition-all min-w-0 dark:bg-[#112E43] dark:border-[#243F52]">
              <p className="text-[10px] sm:text-xs font-black text-slate-400 uppercase tracking-wider mb-1 truncate dark:text-[#A9BBC8]" title={`Tổng ${vocab.worker.short}`}>
                Tổng {vocab.worker.short}
              </p>
              <p className="text-sm sm:text-lg md:text-xl lg:text-2xl font-black text-slate-900 truncate dark:text-[#F3F5F7]">
                {salaries.length}
              </p>
            </div>
            <div className="bg-white p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200/60 shadow-md hover:shadow-lg transition-all min-w-0 dark:bg-[#112E43] dark:border-[#243F52]">
              <p className="text-[10px] sm:text-xs font-black text-slate-400 uppercase tracking-wider mb-1 truncate dark:text-[#A9BBC8]" title="Lương trung bình">
                Lương trung bình
              </p>
              <p className="text-sm sm:text-lg md:text-xl lg:text-2xl font-black text-slate-900 truncate dark:text-[#F3F5F7]" title={`${Math.round(salaries.reduce((sum, s) => sum + s.totalSalary, 0) / salaries.length).toLocaleString()}đ`}>
                {Math.round(salaries.reduce((sum, s) => sum + s.totalSalary, 0) / salaries.length).toLocaleString()}đ
              </p>
            </div>
            <div className="bg-white p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200/60 shadow-md hover:shadow-lg transition-all min-w-0 dark:bg-[#112E43] dark:border-[#243F52]">
              <p className="text-[10px] sm:text-xs font-black text-slate-400 uppercase tracking-wider mb-1 truncate dark:text-[#A9BBC8]" title="Tổng quỹ lương">
                Tổng quỹ lương
              </p>
              <p className="text-sm sm:text-lg md:text-xl lg:text-2xl font-black text-slate-900 truncate dark:text-[#F3F5F7]" title={`${salaries.reduce((sum, s) => sum + s.totalSalary, 0).toLocaleString()}đ`}>
                {salaries.reduce((sum, s) => sum + s.totalSalary, 0).toLocaleString()}đ
              </p>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

// Export anomaly detection for use in publish modal
export function getPayrollAnomalies(salaries: KtvSalaryRecord[]) {
  const anomalies: Anomaly[] = [];
  
  salaries.forEach(ktv => {
    if (ktv.totalSalary < 0) {
      anomalies.push({
        id: `${ktv.id}-negative`,
        ktvId: ktv.id,
        ktvName: ktv.name,
        type: 'negative_salary',
        severity: 'critical',
        message: 'Lương âm',
        details: 'Tạm ứng hoặc phạt vượt quá thu nhập',
        value: ktv.totalSalary
      });
    } else if (ktv.totalSalary === 0) {
      anomalies.push({
        id: `${ktv.id}-zero`,
        ktvId: ktv.id,
        ktvName: ktv.name,
        type: 'zero_salary',
        severity: 'critical',
        message: 'Lương = 0',
        details: 'Không có dữ liệu công/ca',
        value: 0
      });
    }
    
    if (ktv.totalSalary > 15000000) {
      anomalies.push({
        id: `${ktv.id}-high`,
        ktvId: ktv.id,
        ktvName: ktv.name,
        type: 'high_amount',
        severity: 'warning',
        message: 'Lương cao bất thường',
        details: `Vượt ngưỡng 15M (${ktv.totalSalary.toLocaleString()}đ)`,
        value: ktv.totalSalary
      });
    }
    
    if (ktv.actualDays === undefined || ktv.actualDays === 0) {
      anomalies.push({
        id: `${ktv.id}-attendance`,
        ktvId: ktv.id,
        ktvName: ktv.name,
        type: 'missing_attendance',
        severity: 'warning',
        message: 'Thiếu dữ liệu chấm công',
        details: 'Chưa có bản ghi attendance hoặc 0 ngày công'
      });
    }
    
    const targetSessions = ktv.kpiTargetSessions ?? 12;
    if (ktv.sessions >= targetSessions && ktv.kpiBonus === 0) {
      anomalies.push({
        id: `${ktv.id}-kpi`,
        ktvId: ktv.id,
        ktvName: ktv.name,
        type: 'missing_kpi',
        severity: 'info',
        message: 'Thiếu thưởng KPI',
        details: `Đã hoàn thành ${ktv.sessions} ca nhưng KPI bonus = 0`
      });
    }
  });
  
  return anomalies;
}

export type { Anomaly, AnomalyType, SeverityLevel };
