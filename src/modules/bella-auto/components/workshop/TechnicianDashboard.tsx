'use client';

/**
 * Technician Dashboard Component
 * Displays technician workload, active jobs, and performance metrics
 */

import { User, Wrench, Clock, TrendingUp, Award } from 'lucide-react';

interface TechnicianWorkload {
  technicianId: string;
  technicianName: string;
  role?: string;
  activeOrders: number;
  totalHoursToday: number;
  completedToday: number;
  efficiency?: number; // percentage
  qualityScore?: number; // 0-100
  currentJobs: Array<{
    orderNumber: string;
    vehicleInfo: string;
    status: string;
    progress?: number;
    estimatedCompletion?: string;
  }>;
}

interface TechnicianDashboardProps {
  technicians: TechnicianWorkload[];
  onTechnicianClick?: (technicianId: string) => void;
}

export function TechnicianDashboard({
  technicians,
  onTechnicianClick,
}: TechnicianDashboardProps) {
  const getEfficiencyColor = (efficiency?: number) => {
    if (!efficiency) return 'text-gray-400';
    if (efficiency >= 90) return 'text-green-600';
    if (efficiency >= 70) return 'text-blue-600';
    if (efficiency >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getQualityColor = (score?: number) => {
    if (!score) return 'text-gray-400';
    if (score >= 90) return 'text-green-600';
    if (score >= 70) return 'text-blue-600';
    if (score >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getWorkloadStatus = (activeOrders: number) => {
    if (activeOrders === 0) return { label: 'Rảnh', color: 'bg-green-100 text-green-800' };
    if (activeOrders <= 2) return { label: 'Bình thường', color: 'bg-blue-100 text-blue-800' };
    if (activeOrders <= 4) return { label: 'Bận', color: 'bg-yellow-100 text-yellow-800' };
    return { label: 'Quá tải', color: 'bg-red-100 text-red-800' };
  };

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <User className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold">Dashboard Kỹ Thuật Viên</h2>
          </div>
          
          <div className="text-sm text-gray-600">
            <span className="font-semibold">{technicians.length}</span> KTV
          </div>
        </div>
      </div>

      {/* Technician Cards Grid */}
      <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {technicians.map(tech => {
          const workloadStatus = getWorkloadStatus(tech.activeOrders);
          
          return (
            <div
              key={tech.technicianId}
              onClick={() => onTechnicianClick?.(tech.technicianId)}
              className="border rounded-lg p-4 hover:shadow-md transition-all cursor-pointer"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="font-semibold text-base mb-1">
                    {tech.technicianName}
                  </div>
                  {tech.role && (
                    <div className="text-xs text-gray-500">{tech.role}</div>
                  )}
                </div>
                
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${workloadStatus.color}`}>
                  {workloadStatus.label}
                </span>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {tech.activeOrders}
                  </div>
                  <div className="text-xs text-gray-600">Công việc</div>
                </div>
                
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {tech.totalHoursToday.toFixed(1)}h
                  </div>
                  <div className="text-xs text-gray-600">Giờ hôm nay</div>
                </div>
                
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {tech.completedToday}
                  </div>
                  <div className="text-xs text-gray-600">Hoàn thành</div>
                </div>
              </div>

              {/* Performance Metrics */}
              <div className="flex items-center justify-around py-2 mb-3 bg-gray-50 rounded">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <TrendingUp className="h-3.5 w-3.5 text-gray-500" />
                    <span className={`text-sm font-semibold ${getEfficiencyColor(tech.efficiency)}`}>
                      {tech.efficiency ? `${tech.efficiency}%` : '—'}
                    </span>
                  </div>
                  <div className="text-xs text-gray-600">Hiệu suất</div>
                </div>

                <div className="w-px h-8 bg-gray-300" />

                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <Award className="h-3.5 w-3.5 text-gray-500" />
                    <span className={`text-sm font-semibold ${getQualityColor(tech.qualityScore)}`}>
                      {tech.qualityScore ? `${tech.qualityScore}` : '—'}
                    </span>
                  </div>
                  <div className="text-xs text-gray-600">Chất lượng</div>
                </div>
              </div>

              {/* Current Jobs */}
              {tech.currentJobs.length > 0 && (
                <div className="border-t pt-3">
                  <div className="text-xs font-medium text-gray-700 mb-2">
                    Công việc hiện tại:
                  </div>
                  <div className="space-y-2">
                    {tech.currentJobs.slice(0, 2).map((job, idx) => (
                      <div key={idx} className="text-xs">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium">{job.orderNumber}</span>
                          <span className="text-gray-500">{job.vehicleInfo}</span>
                        </div>
                        {job.progress !== undefined && (
                          <div className="w-full bg-gray-200 rounded-full h-1.5">
                            <div
                              className="bg-blue-600 h-1.5 rounded-full transition-all"
                              style={{ width: `${job.progress}%` }}
                            />
                          </div>
                        )}
                      </div>
                    ))}
                    {tech.currentJobs.length > 2 && (
                      <div className="text-xs text-gray-500 italic">
                        +{tech.currentJobs.length - 2} công việc khác
                      </div>
                    )}
                  </div>
                </div>
              )}

              {tech.currentJobs.length === 0 && (
                <div className="border-t pt-3 text-xs text-gray-400 italic text-center">
                  Chưa có công việc
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Empty state */}
      {technicians.length === 0 && (
        <div className="p-8 text-center text-gray-400">
          <User className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>Chưa có kỹ thuật viên nào</p>
        </div>
      )}

      {/* Summary Footer */}
      {technicians.length > 0 && (
        <div className="p-4 bg-gray-50 border-t">
          <div className="grid grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-blue-600">
                {technicians.reduce((sum, t) => sum + t.activeOrders, 0)}
              </div>
              <div className="text-xs text-gray-600">Tổng công việc</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-purple-600">
                {technicians.reduce((sum, t) => sum + t.totalHoursToday, 0).toFixed(1)}h
              </div>
              <div className="text-xs text-gray-600">Tổng giờ làm</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">
                {technicians.reduce((sum, t) => sum + t.completedToday, 0)}
              </div>
              <div className="text-xs text-gray-600">Đã hoàn thành</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-600">
                {technicians.filter(t => t.activeOrders === 0).length}
              </div>
              <div className="text-xs text-gray-600">KTV rảnh</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
