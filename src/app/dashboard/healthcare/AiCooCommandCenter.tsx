'use client';

import React from 'react';
import { Bot, Zap, ArrowRight, AlertTriangle, CheckCircle2, Bell, ShieldAlert, Sparkles, X } from 'lucide-react';
import type { AiCooAction } from '@/modules/bella-healthcare/contexts/shared/domain-models';

export interface AiCooCommandCenterProps {
  readonly actions: AiCooAction[];
  readonly onExecuteAction?: (actionId: string, type: AiCooAction['actionType']) => void;
}

export function AiCooCommandCenter({
  actions,
  onExecuteAction,
}: AiCooCommandCenterProps) {
  // Enterprise default operational alerts detected by AI COO if actions array is small
  const defaultDetections = [
    {
      id: 'det-1',
      type: 'assign_room' as const,
      priority: 'high' as const,
      category: 'room',
      alertMessage: 'Phòng khám #03 đang quá tải công suất (97%)',
      recommendation: 'Đề xuất mời bệnh nhân sang Phòng #05 khả dụng',
      actionLabel: 'Mở thêm phòng / Điều phối',
      icon: ShieldAlert,
      badgeColor: 'bg-rose-50 text-rose-700 border-rose-200/80 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-900',
    },
    {
      id: 'det-2',
      type: 'assign_room' as const,
      priority: 'high' as const,
      category: 'patient_wait',
      alertMessage: 'Có 4 bệnh nhân chờ tiếp đón >15 phút (Vượt SLA)',
      recommendation: 'Ưu tiên xếp hàng tiếp đón nhanh cho bệnh nhân cao tuổi',
      actionLabel: 'Điều phối hàng đợi SLA',
      icon: AlertTriangle,
      badgeColor: 'bg-amber-50 text-amber-700 border-amber-200/80 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-900',
    },
    {
      id: 'det-3',
      type: 'reroute_queue' as const,
      priority: 'medium' as const,
      category: 'capacity',
      alertMessage: 'Doanh thu viện phí hôm nay giảm 18% so với trung bình',
      recommendation: 'Rà soát danh sách dịch vụ chưa thanh toán hoặc hỗ trợ BHYT',
      actionLabel: 'Thực hiện đối soát BHYT',
      icon: Sparkles,
      badgeColor: 'bg-blue-50 text-blue-700 border-blue-200/80 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-900',
    },
    {
      id: 'det-4',
      type: 'alert_doctor' as const,
      priority: 'info' as const,
      category: 'capacity',
      alertMessage: 'BS. Lê Minh sắp hết ca làm việc (còn 20 phút)',
      recommendation: 'Gửi thông báo chuyển giao ca khám cho BS. Trần Thảo',
      actionLabel: 'Thông báo chuyển ca',
      icon: Bell,
      badgeColor: 'bg-purple-50 text-purple-700 border-purple-200/80 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-900',
    },
  ];

  const displayActions = actions.length > 0 
    ? actions.map((act) => ({
        id: act.id,
        type: act.actionType,
        priority: act.priority,
        category: act.category,
        alertMessage: act.title,
        recommendation: act.description,
        actionLabel: act.actionLabel,
        icon: act.priority === 'high' ? AlertTriangle : Sparkles,
        badgeColor: act.priority === 'high' 
          ? 'bg-rose-50 text-rose-700 border-rose-200/80 dark:bg-rose-950/60 dark:text-rose-300' 
          : 'bg-teal-50 text-teal-700 border-teal-200/80 dark:bg-teal-950/60 dark:text-teal-300',
      }))
    : defaultDetections;

  return (
    <div className="p-6 md:p-7 rounded-[28px] bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200/80 dark:border-slate-800 shadow-lg space-y-6 relative overflow-hidden text-left font-sans">
      {/* Decorative Blur Background */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-teal-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Control Center Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-teal-600 to-emerald-500 text-white font-black flex items-center justify-center shadow-md shadow-teal-500/20 shrink-0">
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300 border border-teal-200/60 dark:border-teal-800/60 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-ping" />
                AI COO EXECUTIVE ACTIVE MONITORING
              </span>
            </div>
            <h3 className="text-base font-black text-slate-900 dark:text-white leading-tight mt-0.5 tracking-tight">
              Giám Đốc Vận Hành Số AI — AI COO Incident Control Center
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="px-3 py-1.5 rounded-xl text-xs font-black bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
            {displayActions.length} Bất thường phát hiện
          </span>
        </div>
      </div>

      {/* Incident Detections Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {displayActions.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.id}
              className="p-5 rounded-2xl bg-slate-50/80 dark:bg-slate-850/80 border border-slate-200/80 dark:border-slate-800 hover:border-teal-500/50 dark:hover:border-teal-500/50 transition-all duration-200 flex flex-col justify-between gap-4 group"
            >
              <div className="space-y-2">
                {/* Alert Badge Header */}
                <div className="flex items-center justify-between gap-2">
                  <span className={`px-2.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider border flex items-center gap-1 ${item.badgeColor}`}>
                    <Icon className="w-3 h-3" />
                    AI Phát hiện
                  </span>
                  <span className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {item.category === 'room' 
                      ? 'PHÒNG KHÁM' 
                      : item.category === 'chair'
                      ? 'GHẾ ĐIỀU TRỊ'
                      : item.category === 'patient_wait' 
                      ? 'SLA HÀNG ĐỢI' 
                      : item.category === 'capacity'
                      ? 'CÔNG SUẤT VẬN HÀNH'
                      : item.category === 'finance'
                      ? 'TÀI CHÍNH VIỆN PHÍ'
                      : item.category === 'staff'
                      ? 'CA LÀM BÁC SĨ'
                      : 'VẬN HÀNH Y TẾ'}
                  </span>
                </div>

                {/* Detected Issue Message */}
                <h4 className="font-extrabold text-sm text-slate-900 dark:text-white group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors leading-snug">
                  {item.alertMessage}
                </h4>

                {/* Recommended Action Detail */}
                <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
                  Đề xuất: <b className="text-slate-800 dark:text-slate-100">{item.recommendation}</b>
                </div>
              </div>

              {/* Action Buttons (Interactive 1-Click Operational Dispatch) */}
              <div className="flex items-center gap-2 pt-1 border-t border-slate-200/60 dark:border-slate-800">
                <button
                  onClick={() => onExecuteAction && onExecuteAction(item.id, item.type)}
                  className="flex-1 py-2 px-3 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-sm transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>{item.actionLabel}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onExecuteAction && onExecuteAction(item.id, item.type)}
                  className="p-2 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 border border-slate-200 dark:border-slate-800 transition-all text-xs font-bold shrink-0 cursor-pointer"
                  title="Bỏ qua cảnh báo"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

