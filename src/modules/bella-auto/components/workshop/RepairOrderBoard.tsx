'use client';

/**
 * Repair Order Board Component
 * Kanban-style board for tracking repair orders through workflow stages
 */

import { useState } from 'react';
import { Wrench, Clock, CheckCircle, AlertCircle, User, Car } from 'lucide-react';

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
  { key: 'open', label: 'Mới tiếp nhận', color: 'bg-blue-50 border-blue-200' },
  { key: 'diagnosed', label: 'Đã chẩn đoán', color: 'bg-yellow-50 border-yellow-200' },
  { key: 'approved', label: 'Đã duyệt', color: 'bg-green-50 border-green-200' },
  { key: 'in_progress', label: 'Đang sửa chữa', color: 'bg-purple-50 border-purple-200' },
  { key: 'quality_check', label: 'Kiểm tra chất lượng', color: 'bg-indigo-50 border-indigo-200' },
  { key: 'completed', label: 'Hoàn thành', color: 'bg-gray-50 border-gray-200' },
];

export function RepairOrderBoard({
  orders,
  onOrderClick,
  onStatusChange,
}: RepairOrderBoardProps) {
  const [selectedStage, setSelectedStage] = useState<string | null>(null);

  // Group orders by status
  const ordersByStage = WORKFLOW_STAGES.reduce((acc, stage) => {
    acc[stage.key] = orders.filter(order => order.status === stage.key);
    return acc;
  }, {} as Record<string, RepairOrder[]>);

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-500';
      case 'high':
        return 'bg-orange-500';
      case 'normal':
        return 'bg-blue-500';
      default:
        return 'bg-gray-400';
    }
  };

  const getPriorityLabel = (priority?: string) => {
    switch (priority) {
      case 'urgent':
        return 'Khẩn cấp';
      case 'high':
        return 'Cao';
      case 'normal':
        return 'Bình thường';
      default:
        return 'Thấp';
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
    <div className="bg-white rounded-lg shadow">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wrench className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold">Bảng Theo Dõi Sửa Chữa</h2>
          </div>
          
          <div className="text-sm text-gray-600">
            Tổng: <span className="font-semibold">{orders.length}</span> phiếu
          </div>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="p-4 overflow-x-auto">
        <div className="flex gap-4" style={{ minWidth: 'max-content' }}>
          {WORKFLOW_STAGES.map(stage => {
            const stageOrders = ordersByStage[stage.key] || [];
            
            return (
              <div
                key={stage.key}
                className={`flex-shrink-0 w-80 rounded-lg border-2 ${stage.color}`}
              >
                {/* Stage Header */}
                <div className="p-3 border-b bg-white/50">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-sm">{stage.label}</h3>
                    <span className="px-2 py-1 text-xs font-bold rounded-full bg-white border">
                      {stageOrders.length}
                    </span>
                  </div>
                </div>

                {/* Cards */}
                <div className="p-2 space-y-2" style={{ maxHeight: '600px', overflowY: 'auto' }}>
                  {stageOrders.length === 0 ? (
                    <div className="p-4 text-center text-sm text-gray-400 italic">
                      Chưa có phiếu
                    </div>
                  ) : (
                    stageOrders.map(order => (
                      <div
                        key={order.id}
                        onClick={() => onOrderClick?.(order)}
                        className="bg-white p-3 rounded-lg border shadow-sm cursor-pointer hover:shadow-md transition-all"
                      >
                        {/* Priority indicator */}
                        {order.priority && (
                          <div className="flex items-center gap-2 mb-2">
                            <div className={`w-2 h-2 rounded-full ${getPriorityColor(order.priority)}`} />
                            <span className="text-xs text-gray-600">
                              {getPriorityLabel(order.priority)}
                            </span>
                          </div>
                        )}

                        {/* Order number */}
                        <div className="font-semibold text-sm mb-2">
                          {order.orderNumber}
                        </div>

                        {/* Customer */}
                        <div className="flex items-center gap-1 text-sm text-gray-700 mb-1">
                          <User className="h-3.5 w-3.5" />
                          <span>{order.customerName}</span>
                        </div>

                        {/* Vehicle */}
                        <div className="flex items-center gap-1 text-sm text-gray-700 mb-2">
                          <Car className="h-3.5 w-3.5" />
                          <span>{order.vehicleInfo}</span>
                          <span className="font-mono text-xs ml-1">
                            {order.licensePlate}
                          </span>
                        </div>

                        {/* Service type */}
                        <div className="text-xs text-gray-600 mb-2">
                          {order.orderType}
                        </div>

                        {/* Technician */}
                        {order.primaryTechnicianName && (
                          <div className="flex items-center gap-1 text-xs text-gray-600 mb-2">
                            <Wrench className="h-3 w-3" />
                            <span>{order.primaryTechnicianName}</span>
                          </div>
                        )}

                        {/* Bay number */}
                        {order.bayNumber && (
                          <div className="inline-block px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 rounded mb-2">
                            Bay {order.bayNumber}
                          </div>
                        )}

                        {/* Footer */}
                        <div className="flex items-center justify-between pt-2 border-t text-xs text-gray-500">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {order.status === 'in_progress' || order.status === 'quality_check' || order.status === 'completed' ? (
                              <span>{formatDuration(order.actualHours)} / {formatDuration(order.estimatedHours)}</span>
                            ) : (
                              <span>~{formatDuration(order.estimatedHours)}</span>
                            )}
                          </div>
                          <span>{formatDate(order.openedAt)}</span>
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

      {/* Statistics */}
      <div className="p-4 bg-gray-50 border-t">
        <div className="grid grid-cols-6 gap-4 text-center">
          {WORKFLOW_STAGES.map(stage => {
            const count = ordersByStage[stage.key]?.length || 0;
            return (
              <div key={stage.key}>
                <div className="text-2xl font-bold text-gray-900">{count}</div>
                <div className="text-xs text-gray-600">{stage.label}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
