'use client';

/**
 * Repair Order Board Component
 * Kanban-style board for tracking repair orders through workflow stages
 */

import { useState } from 'react';
import { Wrench, Clock, User, Car, Sparkles, AlertCircle } from 'lucide-react';

interface RepairOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  vehicleInfo: string;
  licensePlate: string;
  orderType: string;
  status: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  primaryTechnicianName?: string;
  estimatedHours?: number;
  actualHours?: number;
  openedAt: string;
  bayNumber?: string;
}

interface RepairOrderBoardProps {
  orders: RepairOrder[];
  onOrderClick?: (order: RepairOrder) => void;
  onStatusChange?: (orderId: string, newStatus: string) => void;
}

const WORKFLOW_STAGES = [
  { key: 'open', label: 'Mới tiếp nhận', color: 'from-blue-50/40 to-blue-100/10 dark:from-blue-950/20 dark:to-blue-900/5 border-blue-100/50 dark:border-blue-900/20 text-blue-700 dark:text-blue-400' },
  { key: 'diagnosed', label: 'Đã chẩn đoán', color: 'from-yellow-50/40 to-yellow-100/10 dark:from-yellow-950/20 dark:to-yellow-900/5 border-yellow-100/50 dark:border-yellow-900/20 text-yellow-700 dark:text-yellow-400' },
  { key: 'approved', label: 'Đã duyệt', color: 'from-emerald-50/40 to-emerald-100/10 dark:from-emerald-950/20 dark:to-emerald-900/5 border-emerald-100/50 dark:border-emerald-900/20 text-emerald-700 dark:text-emerald-400' },
  { key: 'in_progress', label: 'Đang sửa chữa', color: 'from-purple-50/40 to-purple-100/10 dark:from-purple-950/20 dark:to-purple-900/5 border-purple-100/50 dark:border-purple-900/20 text-purple-700 dark:text-purple-400' },
  { key: 'quality_check', label: 'Kiểm tra chất lượng', color: 'from-indigo-50/40 to-indigo-100/10 dark:from-indigo-950/20 dark:to-indigo-900/5 border-indigo-100/50 dark:border-indigo-900/20 text-indigo-700 dark:text-indigo-400' },
  { key: 'completed', label: 'Hoàn thành', color: 'from-slate-50/40 to-slate-100/10 dark:from-slate-900/30 dark:to-slate-800/5 border-slate-100/50 dark:border-slate-800/30 text-slate-700 dark:text-slate-400' },
];

export function RepairOrderBoard({
  orders,
  onOrderClick,
  onStatusChange,
}: RepairOrderBoardProps) {
  // Group orders by status
  const ordersByStage = WORKFLOW_STAGES.reduce((acc, stage) => {
    acc[stage.key] = orders.filter(order => order.status === stage.key);
    return acc;
  }, {} as Record<string, RepairOrder[]>);

  const getPriorityBadgeClass = (priority?: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400 border-red-200/50 dark:border-red-900/30';
      case 'high':
        return 'bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400 border-orange-200/50 dark:border-orange-900/30';
      case 'normal':
        return 'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400 border-blue-200/50 dark:border-blue-900/30';
      default:
        return 'bg-slate-50 text-slate-650 dark:bg-slate-900 dark:text-slate-450 border-slate-200/50 dark:border-slate-800/80';
    }
  };

  const getPriorityLabel = (priority?: string) => {
    switch (priority) {
      case 'urgent': return 'Khẩn cấp';
      case 'high': return 'Ưu tiên cao';
      case 'normal': return 'Bình thường';
      default: return 'Ưu tiên thấp';
    }
  };

  const formatDuration = (hours?: number) => {
    if (!hours) return '—';
    return `${hours.toFixed(1)}h`;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffHours < 1) return 'Vừa xong';
    if (diffHours < 24) return `${diffHours}h trước`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} ngày trước`;
  };

  return (
    <div className="bg-white dark:bg-slate-950 rounded-3xl border border-slate-150 dark:border-slate-900 shadow-lg dark:shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-slate-100 dark:border-slate-900 bg-slate-50/30 dark:bg-slate-950 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-cyan-50 dark:bg-cyan-950/30 text-cyan-600 dark:text-cyan-400 shadow-sm border border-cyan-100/30 dark:border-cyan-900/20">
            <Wrench className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-wide">Bảng Theo Dõi Sửa Chữa</h2>
            <p className="text-xs text-slate-400 mt-0.5">Tiến độ quy trình sửa chữa và bảo dưỡng xe hiện hành</p>
          </div>
        </div>
        
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100/80 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/80 rounded-xl text-xs font-bold text-slate-650 dark:text-slate-350 shadow-sm">
          Tổng cộng: <span className="text-cyan-600 dark:text-cyan-400">{orders.length}</span> phiếu sửa chữa
        </div>
      </div>

      {/* Kanban Board */}
      <div className="p-6 overflow-x-auto">
        <div className="flex gap-4 pb-2" style={{ minWidth: 'max-content' }}>
          {WORKFLOW_STAGES.map(stage => {
            const stageOrders = ordersByStage[stage.key] || [];
            
            return (
              <div
                key={stage.key}
                className={`flex-shrink-0 w-80 rounded-2xl border bg-gradient-to-b p-3 flex flex-col shadow-md ${stage.color}`}
              >
                {/* Stage Header */}
                <div className="pb-3 border-b border-slate-100/60 dark:border-slate-800/30 mb-3 px-1">
                  <div className="flex items-center justify-between">
                    <h3 className="font-extrabold text-xs tracking-wider uppercase opacity-90">{stage.label}</h3>
                    <span className="px-2.5 py-0.5 text-xs font-black rounded-lg bg-white/80 dark:bg-slate-950/80 border border-slate-200/30 shadow-sm">
                      {stageOrders.length}
                    </span>
                  </div>
                </div>

                {/* Cards Container */}
                <div className="space-y-3 overflow-y-auto pr-1 flex-1 max-h-[500px] scrollbar-thin">
                  {stageOrders.length === 0 ? (
                    <div className="py-12 text-center border border-dashed border-slate-200/30 dark:border-slate-800/30 rounded-2xl opacity-40">
                      <span className="text-[10px] font-bold tracking-widest uppercase text-slate-400 dark:text-slate-500">Chưa có phiếu</span>
                    </div>
                  ) : (
                    stageOrders.map(order => (
                      <div
                        key={order.id}
                        onClick={() => onOrderClick?.(order)}
                        className="bg-white dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200/40 dark:border-slate-800/30 shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 cursor-pointer"
                      >
                        {/* Priority indicator */}
                        {order.priority && (
                          <div className="mb-2.5">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-extrabold border uppercase tracking-wider ${getPriorityBadgeClass(order.priority)}`}>
                              {getPriorityLabel(order.priority)}
                            </span>
                          </div>
                        )}

                        {/* Order number */}
                        <div className="font-extrabold text-xs text-slate-900 dark:text-white tracking-wider mb-2.5">
                          {order.orderNumber}
                        </div>

                        {/* Info list */}
                        <div className="space-y-2 mb-3">
                          <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-350">
                            <User className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                            <span className="truncate">{order.customerName}</span>
                          </div>

                          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-450">
                            <Car className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                            <span className="truncate">{order.vehicleInfo}</span>
                            <span className="font-mono text-[9px] font-bold px-1.5 py-0.5 bg-slate-900/5 dark:bg-slate-100/10 rounded text-slate-750 dark:text-slate-300 uppercase tracking-wider shrink-0">
                              {order.licensePlate}
                            </span>
                          </div>
                        </div>

                        {/* Order details & tech */}
                        <div className="flex items-center justify-between flex-wrap gap-2 pt-2.5 border-t border-slate-100/50 dark:border-slate-800/30 mb-2">
                          <div className="text-[10px] font-medium text-slate-400 dark:text-slate-500">
                            {order.orderType}
                          </div>
                          
                          {order.bayNumber && (
                            <span className="inline-block px-1.5 py-0.5 text-[9px] font-bold bg-cyan-50 dark:bg-cyan-950/40 text-cyan-600 dark:text-cyan-400 border border-cyan-150/30 rounded">
                              Khoang {order.bayNumber}
                            </span>
                          )}
                        </div>

                        {/* Technician assigned */}
                        {order.primaryTechnicianName && (
                          <div className="flex items-center gap-1.5 p-2 rounded-lg bg-slate-50/50 dark:bg-slate-900/30 border border-slate-100/40 dark:border-slate-800/20 text-[10px] text-slate-500 dark:text-slate-400 mb-2.5">
                            <Wrench className="h-3 w-3 text-slate-400 shrink-0" />
                            <span>KTV: <span className="font-bold">{order.primaryTechnicianName}</span></span>
                          </div>
                        )}

                        {/* Card Footer */}
                        <div className="flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500 font-semibold">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3 text-slate-400" />
                            {order.status === 'in_progress' || order.status === 'quality_check' || order.status === 'completed' ? (
                              <span>Thực tế: <span className="font-extrabold text-slate-650 dark:text-slate-350">{formatDuration(order.actualHours)}</span> / {formatDuration(order.estimatedHours)}</span>
                            ) : (
                              <span>Ước lượng: <span className="font-extrabold text-slate-650 dark:text-slate-350">{formatDuration(order.estimatedHours)}</span></span>
                            )}
                          </div>
                          <span className="text-[9px] opacity-75">{formatDate(order.openedAt)}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Summary Footer */}
      <div className="p-6 bg-slate-50/50 dark:bg-slate-900/20 border-t border-slate-100 dark:border-slate-900">
        <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
          {WORKFLOW_STAGES.map(stage => {
            const count = ordersByStage[stage.key]?.length || 0;
            return (
              <div key={stage.key} className="p-3 bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-900 rounded-xl text-center shadow-[0_2px_8px_rgba(0,0,0,0.005)]">
                <div className="text-xl font-extrabold text-slate-900 dark:text-white">{count}</div>
                <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mt-1 truncate">{stage.label}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
