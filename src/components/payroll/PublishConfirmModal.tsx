'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { 
  X, 
  AlertTriangle, 
  CheckCircle2, 
  Users, 
  DollarSign,
  Send,
  XCircle,
  Info
} from 'lucide-react';
import { KtvSalaryRecord } from '@/types/domain';
import { getPayrollAnomalies, type Anomaly } from './PayrollHealthCheck';

interface PublishConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  salaries: KtvSalaryRecord[];
  currentMonth: string;
}

export function PublishConfirmModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  salaries,
  currentMonth 
}: PublishConfirmModalProps) {
  const [isPublishing, setIsPublishing] = useState(false);
  
  if (!isOpen) return null;

  const anomalies = getPayrollAnomalies(salaries);
  const criticalAnomalies = anomalies.filter(a => a.severity === 'critical');
  const warningAnomalies = anomalies.filter(a => a.severity === 'warning');
  
  const hasCritical = criticalAnomalies.length > 0;
  const hasWarning = warningAnomalies.length > 0;
  
  const totalKtvs = salaries.length;
  const totalSalary = salaries.reduce((sum, s) => sum + s.totalSalary, 0);
  const avgSalary = totalKtvs > 0 ? totalSalary / totalKtvs : 0;

  const handleConfirm = async () => {
    if (hasCritical) return; // Cannot publish with critical issues
    
    setIsPublishing(true);
    try {
      await onConfirm();
      onClose();
    } catch (error) {
      console.error('Publish failed:', error);
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-3xl max-h-[90vh] overflow-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                Xác nhận gửi đối soát lương
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Tháng {currentMonth}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              disabled={isPublishing}
            >
              <X size={24} className="text-gray-500" />
            </button>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <Card className="p-4 bg-blue-50 border-blue-200">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Users className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-600 font-medium">Tổng KTV</p>
                  <p className="text-2xl font-bold text-gray-900">{totalKtvs}</p>
                </div>
              </div>
            </Card>

            <Card className="p-4 bg-green-50 border-green-200">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <DollarSign className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-600 font-medium">Tổng quỹ lương</p>
                  <p className="text-xl font-bold text-gray-900">
                    {totalSalary.toLocaleString()}đ
                  </p>
                </div>
              </div>
            </Card>

            <Card className="p-4 bg-purple-50 border-purple-200">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <DollarSign className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-600 font-medium">Lương TB</p>
                  <p className="text-xl font-bold text-gray-900">
                    {Math.round(avgSalary).toLocaleString()}đ
                  </p>
                </div>
              </div>
            </Card>
          </div>

          {/* Critical Anomalies - Blocking */}
          {hasCritical && (
            <Card className="p-5 mb-4 bg-red-50 border-2 border-red-300">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-red-100 rounded-lg mt-0.5">
                  <XCircle className="w-5 h-5 text-red-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-red-900 mb-2">
                    ⛔ KHÔNG THỂ XUẤT BẢN - {criticalAnomalies.length} vấn đề nghiêm trọng
                  </h3>
                  <p className="text-sm text-red-800 mb-3">
                    Bạn phải khắc phục các vấn đề sau trước khi gửi đối soát:
                  </p>
                  <div className="space-y-2">
                    {criticalAnomalies.map((anomaly) => (
                      <div 
                        key={anomaly.id}
                        className="flex items-start gap-2 p-3 bg-white rounded-lg border border-red-200"
                      >
                        <XCircle className="w-4 h-4 text-red-600 mt-0.5" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-bold text-sm">{anomaly.ktvName}</span>
                            <span className="text-xs text-gray-500">→</span>
                            <span className="text-xs font-semibold text-red-700">{anomaly.message}</span>
                          </div>
                          <p className="text-xs text-gray-600">{anomaly.details}</p>
                        </div>
                        {anomaly.value !== undefined && (
                          <span className="text-sm font-bold text-red-700">
                            {anomaly.value.toLocaleString()}đ
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Warning Anomalies - Non-blocking */}
          {!hasCritical && hasWarning && (
            <Card className="p-5 mb-4 bg-amber-50 border-2 border-amber-300">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-amber-100 rounded-lg mt-0.5">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-amber-900 mb-2">
                    ⚠️ CÓ {warningAnomalies.length} CẢNH BÁO
                  </h3>
                  <p className="text-sm text-amber-800 mb-3">
                    Các vấn đề sau không chặn xuất bản nhưng nên xem xét:
                  </p>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {warningAnomalies.map((anomaly) => (
                      <div 
                        key={anomaly.id}
                        className="flex items-start gap-2 p-3 bg-white rounded-lg border border-amber-200"
                      >
                        <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-bold text-sm">{anomaly.ktvName}</span>
                            <span className="text-xs text-gray-500">→</span>
                            <span className="text-xs font-semibold text-amber-700">{anomaly.message}</span>
                          </div>
                          <p className="text-xs text-gray-600">{anomaly.details}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* All Clear */}
          {!hasCritical && !hasWarning && (
            <Card className="p-5 mb-4 bg-green-50 border-2 border-green-200">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-green-900 mb-1">
                    ✅ Bảng lương khỏe mạnh
                  </h3>
                  <p className="text-sm text-green-800">
                    Không phát hiện vấn đề. Sẵn sàng gửi đối soát cho tất cả {totalKtvs} KTV.
                  </p>
                </div>
              </div>
            </Card>
          )}

          {/* What Happens Next */}
          <Card className="p-5 mb-6 bg-blue-50 border border-blue-200">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-600 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-bold text-blue-900 mb-2">Sau khi gửi đối soát:</h3>
                <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                  <li>Tất cả KTV sẽ nhận được thông báo trên app</li>
                  <li>KTV có thể xem chi tiết và xác nhận bảng lương</li>
                  <li>Trạng thái chuyển sang "Chờ KTV xác nhận"</li>
                  <li>Bạn có thể theo dõi tiến độ xác nhận tại màn hình này</li>
                </ul>
              </div>
            </div>
          </Card>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isPublishing}
              size="lg"
            >
              Hủy bỏ
            </Button>
            
            <Button
              onClick={handleConfirm}
              disabled={hasCritical || isPublishing}
              size="lg"
              className={`flex items-center gap-2 ${
                hasCritical 
                  ? 'bg-gray-300 cursor-not-allowed' 
                  : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600'
              }`}
            >
              {isPublishing ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Đang gửi...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  Xác nhận gửi {totalKtvs} KTV
                </>
              )}
            </Button>
          </div>

          {/* Critical Block Message */}
          {hasCritical && (
            <p className="text-xs text-red-600 text-center mt-3">
              ⛔ Nút gửi bị khóa do có {criticalAnomalies.length} vấn đề nghiêm trọng cần khắc phục trước
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}
