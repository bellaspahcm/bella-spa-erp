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
import { useModuleVocabulary } from '@/hooks/useModuleVocabulary';

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
  const vocab = useModuleVocabulary();
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
      <Card className="w-full max-w-3xl max-h-[90vh] overflow-auto dark:bg-[#112E43] dark:border-[#243F52] dark:text-[#F3F5F7]">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-[#F3F5F7]">
                Xác nhận gửi đối soát lương
              </h2>
              <p className="text-sm text-gray-600 mt-1 dark:text-[#D8E3EA]">
                Tháng {currentMonth}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors dark:hover:bg-[#193A50]"
              disabled={isPublishing}
            >
              <X size={24} className="text-gray-500 dark:text-[#A9BBC8]" />
            </button>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <Card className="p-4 bg-blue-50 border-blue-200 dark:bg-[rgba(115,181,237,0.12)] dark:border-[rgba(115,181,237,0.38)]">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg dark:bg-[rgba(115,181,237,0.18)]">
                  <Users className="w-5 h-5 text-blue-600 dark:text-[#73B5ED]" />
                </div>
                <div>
                  <p className="text-xs text-gray-600 font-medium dark:text-[#D8E3EA]">Tổng {vocab.worker.short}</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-[#F3F5F7]">{totalKtvs}</p>
                </div>
              </div>
            </Card>

            <Card className="p-4 bg-green-50 border-green-200 dark:bg-[rgba(39,197,150,0.12)] dark:border-[rgba(39,197,150,0.38)]">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg dark:bg-[rgba(39,197,150,0.18)]">
                  <DollarSign className="w-5 h-5 text-green-600 dark:text-[#27C596]" />
                </div>
                <div>
                  <p className="text-xs text-gray-600 font-medium dark:text-[#D8E3EA]">Tổng quỹ lương</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-[#F3F5F7]">
                    {totalSalary.toLocaleString()}đ
                  </p>
                </div>
              </div>
            </Card>

            <Card className="p-4 bg-purple-50 border-purple-200 dark:bg-[rgba(169,155,235,0.12)] dark:border-[rgba(169,155,235,0.38)]">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg dark:bg-[rgba(169,155,235,0.18)]">
                  <DollarSign className="w-5 h-5 text-purple-600 dark:text-[#A99BEB]" />
                </div>
                <div>
                  <p className="text-xs text-gray-600 font-medium dark:text-[#D8E3EA]">Lương TB</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-[#F3F5F7]">
                    {Math.round(avgSalary).toLocaleString()}đ
                  </p>
                </div>
              </div>
            </Card>
          </div>

          {/* Critical Anomalies - Blocking */}
          {hasCritical && (
            <Card className="p-5 mb-4 bg-red-50 border-2 border-red-300 dark:bg-[rgba(239,115,122,0.12)] dark:border-[rgba(239,115,122,0.44)]">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-red-100 rounded-lg mt-0.5 dark:bg-[rgba(239,115,122,0.18)]">
                  <XCircle className="w-5 h-5 text-red-600 dark:text-[#EF737A]" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-red-900 mb-2 dark:text-[#F3F5F7]">
                    ⛔ KHÔNG THỂ XUẤT BẢN - {criticalAnomalies.length} vấn đề nghiêm trọng
                  </h3>
                  <p className="text-sm text-red-800 mb-3 dark:text-[#D8E3EA]">
                    Bạn phải khắc phục các vấn đề sau trước khi gửi đối soát:
                  </p>
                  <div className="space-y-2">
                    {criticalAnomalies.map((anomaly) => (
                      <div 
                        key={anomaly.id}
                        className="flex items-start gap-2 p-3 bg-white rounded-lg border border-red-200 dark:bg-[#112E43] dark:border-[rgba(239,115,122,0.38)]"
                      >
                        <XCircle className="w-4 h-4 text-red-600 mt-0.5 dark:text-[#EF737A]" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-bold text-sm dark:text-[#F3F5F7]">{anomaly.ktvName}</span>
                            <span className="text-xs text-gray-500 dark:text-[#A9BBC8]">→</span>
                            <span className="text-xs font-semibold text-red-700 dark:text-[#EF737A]">{anomaly.message}</span>
                          </div>
                          <p className="text-xs text-gray-600 dark:text-[#D8E3EA]">{anomaly.details}</p>
                        </div>
                        {anomaly.value !== undefined && (
                          <span className="text-sm font-bold text-red-700 dark:text-[#EF737A]">
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
            <Card className="p-5 mb-4 bg-amber-50 border-2 border-amber-300 dark:bg-[rgba(241,174,83,0.12)] dark:border-[rgba(241,174,83,0.44)]">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-amber-100 rounded-lg mt-0.5 dark:bg-[rgba(241,174,83,0.18)]">
                  <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-[#F1AE53]" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-amber-900 mb-2 dark:text-[#F3F5F7]">
                    ⚠️ CÓ {warningAnomalies.length} CẢNH BÁO
                  </h3>
                  <p className="text-sm text-amber-800 mb-3 dark:text-[#D8E3EA]">
                    Các vấn đề sau không chặn xuất bản nhưng nên xem xét:
                  </p>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {warningAnomalies.map((anomaly) => (
                      <div 
                        key={anomaly.id}
                        className="flex items-start gap-2 p-3 bg-white rounded-lg border border-amber-200 dark:bg-[#112E43] dark:border-[rgba(241,174,83,0.38)]"
                      >
                        <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 dark:text-[#F1AE53]" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-bold text-sm dark:text-[#F3F5F7]">{anomaly.ktvName}</span>
                            <span className="text-xs text-gray-500 dark:text-[#A9BBC8]">→</span>
                            <span className="text-xs font-semibold text-amber-700 dark:text-[#F1AE53]">{anomaly.message}</span>
                          </div>
                          <p className="text-xs text-gray-600 dark:text-[#D8E3EA]">{anomaly.details}</p>
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
            <Card className="p-5 mb-4 bg-green-50 border-2 border-green-200 dark:bg-[rgba(39,197,150,0.12)] dark:border-[rgba(39,197,150,0.42)]">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-green-100 rounded-lg dark:bg-[rgba(39,197,150,0.18)]">
                  <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-[#27C596]" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-green-900 mb-1 dark:text-[#F3F5F7]">
                    ✅ Bảng lương khỏe mạnh
                  </h3>
                  <p className="text-sm text-green-800 dark:text-[#D8E3EA]">
                    Không phát hiện vấn đề. Sẵn sàng gửi đối soát cho tất cả {totalKtvs} {vocab.worker.short}.
                  </p>
                </div>
              </div>
            </Card>
          )}

          {/* What Happens Next */}
          <Card className="p-5 mb-6 bg-blue-50 border border-blue-200 dark:bg-[rgba(115,181,237,0.12)] dark:border-[rgba(115,181,237,0.38)]">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-600 mt-0.5 dark:text-[#73B5ED]" />
              <div className="flex-1">
                <h3 className="font-bold text-blue-900 mb-2 dark:text-[#F3F5F7]">Sau khi gửi đối soát:</h3>
                <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside dark:text-[#D8E3EA]">
                  <li>Tất cả {vocab.worker.plural.toLowerCase()} sẽ nhận được thông báo trên app</li>
                  <li>{vocab.worker.plural} có thể xem chi tiết và xác nhận bảng lương</li>
                  <li>Trạng thái chuyển sang &quot;Chờ {vocab.worker.short} xác nhận&quot;</li>
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
                  ? 'bg-gray-300 cursor-not-allowed dark:bg-[#193A50] dark:text-[#A9BBC8]'
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
                  Xác nhận gửi {totalKtvs} {vocab.worker.short}
                </>
              )}
            </Button>
          </div>

          {/* Critical Block Message */}
          {hasCritical && (
            <p className="text-xs text-red-600 text-center mt-3 dark:text-[#EF737A]">
              ⛔ Nút gửi bị khóa do có {criticalAnomalies.length} vấn đề nghiêm trọng cần khắc phục trước
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}
