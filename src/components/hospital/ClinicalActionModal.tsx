'use client';

import React, { useState } from 'react';
import { X, AlertTriangle, CheckCircle, Clock, User, Layers, UserPlus, ArrowUpCircle, Info, AlertCircle } from 'lucide-react';

// Types
export interface ClinicalAlert {
  id: string;
  type: 'drug_interaction' | 'vital_abnormal' | 'medication_verification' | 'general';
  priority: 'urgent' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  patientName: string;
  patientMPI: string;
  location?: string;
  assignedTo?: string;
  triggeredAt: string;
  actionRequired: 'review' | 'confirm' | 'verify' | 'acknowledge';
  metadata?: Record<string, unknown>;
}

interface ClinicalActionModalProps {
  alert: ClinicalAlert | null;
  isOpen: boolean;
  onClose: () => void;
  onAction: (alertId: string, action: string, notes?: string) => Promise<void>;
}

interface NotificationPopup {
  show: boolean;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message: string;
}

export default function ClinicalActionModal({
  alert,
  isOpen,
  onClose,
  onAction,
}: ClinicalActionModalProps) {
  const [notes, setNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignTo, setAssignTo] = useState('');
  const [notification, setNotification] = useState<NotificationPopup>({
    show: false,
    type: 'success',
    title: '',
    message: ''
  });

  if (!isOpen || !alert) return null;

  const showNotification = (type: NotificationPopup['type'], title: string, message: string) => {
    console.log('🔔 Showing notification:', { type, title, message }); // DEBUG
    setNotification({ show: true, type, title, message });
    
    // Auto hide after 3 seconds
    setTimeout(() => {
      console.log('⏰ Auto-hiding notification'); // DEBUG
      setNotification(prev => ({ ...prev, show: false }));
    }, 3000);
  };

  const handleAction = async (actionType: string) => {
    if (!alert) return;

    setIsProcessing(true);
    try {
      await onAction(alert.id, actionType, notes);
      setNotes('');
      
      // Show success notification
      if (actionType === 'acknowledge') {
        showNotification('success', 'Đã Xác Nhận', `Cảnh báo "${alert.title}" sẽ được xử lý sau.`);
      } else {
        showNotification('success', 'Xử Lý Thành Công', `Cảnh báo "${alert.title}" đã được xử lý.`);
      }
      
      // Close modal after 1 second
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (error) {
      console.error('Failed to process action:', error);
      showNotification('error', 'Có Lỗi Xảy Ra', error instanceof Error ? error.message : 'Vui lòng thử lại sau.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleWorkspace = () => {
    // Navigate to clinical workspace for this patient
    showNotification('info', 'Đang Mở Workspace', `Xem hồ sơ bệnh nhân ${alert.patientName}`);
    window.open(`/dashboard/hospital/patients/${alert.patientMPI}`, '_blank');
  };

  const handleAssign = async () => {
    if (!assignTo.trim()) {
      showNotification('warning', 'Chưa Chọn Người Xử Lý', 'Vui lòng chọn người được gán trước khi xác nhận.');
      return;
    }
    
    setIsProcessing(true);
    try {
      await onAction(alert.id, 'assign', `Assigned to: ${assignTo}`);
      
      showNotification('success', 'Đã Gán Người Xử Lý', `Cảnh báo "${alert.title}" đã được gán cho ${assignTo}.`);
      
      setShowAssignModal(false);
      setAssignTo('');
      
      // Close modal after 1 second
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (error) {
      console.error('Failed to assign:', error);
      showNotification('error', 'Có Lỗi Xảy Ra', error instanceof Error ? error.message : 'Vui lòng thử lại sau.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEscalate = async () => {
    const confirmEscalate = window.confirm(
      'Bạn có chắc chắn muốn leo thang cảnh báo này lên cấp cao hơn không?'
    );
    
    if (!confirmEscalate) return;

    setIsProcessing(true);
    try {
      await onAction(alert.id, 'escalate', notes || 'Escalated to higher authority');
      
      showNotification('success', 'Đã Leo Thang', `Cảnh báo "${alert.title}" đã được chuyển lên cấp cao hơn.`);
      
      // Close modal after 1 second
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (error) {
      console.error('Failed to escalate:', error);
      showNotification('error', 'Có Lỗi Xảy Ra', error instanceof Error ? error.message : 'Vui lòng thử lại sau.');
    } finally {
      setIsProcessing(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-rose-50 border-rose-200 text-rose-900';
      case 'high':
        return 'bg-amber-50 border-amber-200 text-amber-900';
      case 'medium':
        return 'bg-blue-50 border-blue-200 text-blue-900';
      default:
        return 'bg-slate-50 border-slate-200 text-slate-900';
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-rose-100 text-rose-800 border-rose-200';
      case 'high':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'medium':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  const getActionButtonLabel = (actionType: string) => {
    switch (actionType) {
      case 'review':
        return 'Xem Xét & Xử Lý';
      case 'confirm':
        return 'Xác Nhận';
      case 'verify':
        return 'Xác Minh';
      default:
        return 'Xác Nhận';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className={`p-6 border-b ${getPriorityColor(alert.priority)}`}>
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-3">
              <div className={`p-2 rounded-xl ${alert.priority === 'urgent' ? 'bg-rose-200' : 'bg-amber-200'}`}>
                <AlertTriangle className={`w-6 h-6 ${alert.priority === 'urgent' ? 'text-rose-700' : 'text-amber-700'}`} />
              </div>
              <div>
                <h2 className="text-xl font-black">{alert.title}</h2>
                <div className="flex items-center space-x-2 mt-1">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded border ${getPriorityBadge(alert.priority)} uppercase`}>
                    {alert.priority === 'urgent' ? 'Nguy Cấp' : alert.priority === 'high' ? 'Ưu Tiên Cao' : 'Bình Thường'}
                  </span>
                  <span className="text-xs text-slate-500 font-semibold">
                    {alert.triggeredAt}
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/50 rounded-xl transition-colors"
              disabled={isProcessing}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Patient Info */}
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
            <div className="flex items-center space-x-2 mb-3">
              <User className="w-4 h-4 text-indigo-600" />
              <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">
                Thông Tin Bệnh Nhân
              </h3>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-xs text-slate-500 font-semibold mb-1">Họ Tên</div>
                <div className="font-bold text-slate-900">{alert.patientName}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500 font-semibold mb-1">MPI</div>
                <div className="font-bold text-indigo-600">{alert.patientMPI}</div>
              </div>
              {alert.location && (
                <div>
                  <div className="text-xs text-slate-500 font-semibold mb-1">Vị Trí</div>
                  <div className="font-bold text-slate-900">{alert.location}</div>
                </div>
              )}
              {alert.assignedTo && (
                <div>
                  <div className="text-xs text-slate-500 font-semibold mb-1">Phụ Trách</div>
                  <div className="font-bold text-slate-900">{alert.assignedTo}</div>
                </div>
              )}
            </div>
          </div>

          {/* Alert Description */}
          <div>
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span>Chi Tiết Cảnh Báo</span>
            </h3>
            <div className="bg-white border border-slate-200 rounded-2xl p-4">
              <p className="text-sm text-slate-700 leading-relaxed">
                {alert.description}
              </p>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div>
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-3">
              Hành Động Nhanh
            </h3>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={handleWorkspace}
                disabled={isProcessing}
                className="flex flex-col items-center justify-center p-4 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-2xl transition-all disabled:opacity-50 group"
              >
                <div className="p-2 bg-blue-100 rounded-xl mb-2 group-hover:bg-blue-200 transition-colors">
                  <Layers className="w-5 h-5 text-blue-600" />
                </div>
                <span className="text-xs font-bold text-blue-900">Workspace</span>
                <span className="text-[10px] text-blue-600 mt-0.5">Xem chi tiết</span>
              </button>

              <button
                onClick={() => setShowAssignModal(true)}
                disabled={isProcessing}
                className="flex flex-col items-center justify-center p-4 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-2xl transition-all disabled:opacity-50 group"
              >
                <div className="p-2 bg-indigo-100 rounded-xl mb-2 group-hover:bg-indigo-200 transition-colors">
                  <UserPlus className="w-5 h-5 text-indigo-600" />
                </div>
                <span className="text-xs font-bold text-indigo-900">Assign</span>
                <span className="text-[10px] text-indigo-600 mt-0.5">Gán người xử lý</span>
              </button>

              <button
                onClick={handleEscalate}
                disabled={isProcessing}
                className="flex flex-col items-center justify-center p-4 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-2xl transition-all disabled:opacity-50 group"
              >
                <div className="p-2 bg-rose-100 rounded-xl mb-2 group-hover:bg-rose-200 transition-colors">
                  <ArrowUpCircle className="w-5 h-5 text-rose-600" />
                </div>
                <span className="text-xs font-bold text-rose-900">Escalate</span>
                <span className="text-[10px] text-rose-600 mt-0.5">Leo thang</span>
              </button>
            </div>
          </div>

          {/* Additional Metadata */}
          {alert.metadata && Object.keys(alert.metadata).length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-2">
                Thông Tin Bổ Sung
              </h3>
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-2">
                {Object.entries(alert.metadata).map(([key, value]) => (
                  <div key={key} className="flex justify-between text-sm">
                    <span className="text-slate-500 font-semibold capitalize">
                      {key.replace(/_/g, ' ')}:
                    </span>
                    <span className="font-bold text-slate-900">
                      {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes Input */}
          <div>
            <label className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-2 block">
              Ghi Chú (Tùy Chọn)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Nhập ghi chú hoặc lý do xử lý..."
              className="w-full p-4 border border-slate-200 rounded-2xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
              rows={4}
              disabled={isProcessing}
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-6 py-2.5 text-sm font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors"
            disabled={isProcessing}
          >
            Hủy
          </button>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => handleAction('acknowledge')}
              className="px-6 py-2.5 text-sm font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-50"
              disabled={isProcessing}
            >
              <Clock className="w-4 h-4 inline mr-2" />
              Xử Lý Sau
            </button>
            <button
              onClick={() => handleAction(alert.actionRequired)}
              className={`px-6 py-2.5 text-sm font-bold text-white rounded-xl transition-all shadow-sm disabled:opacity-50 flex items-center space-x-2 ${
                alert.priority === 'urgent'
                  ? 'bg-rose-600 hover:bg-rose-700'
                  : 'bg-indigo-600 hover:bg-indigo-700'
              }`}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Đang Xử Lý...</span>
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  <span>{getActionButtonLabel(alert.actionRequired)}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Assign Modal (nested) */}
      {showAssignModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/30">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">Gán Người Xử Lý</h3>
              <button
                onClick={() => setShowAssignModal(false)}
                className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
                disabled={isProcessing}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  Chọn Người Xử Lý
                </label>
                <select
                  value={assignTo}
                  onChange={(e) => setAssignTo(e.target.value)}
                  className="w-full p-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  disabled={isProcessing}
                >
                  <option value="">-- Chọn người --</option>
                  <option value="Dr. Nguyen Van A">BS. Nguyễn Văn A (Khoa Nội)</option>
                  <option value="Dr. Tran Thi B">BS. Trần Thị B (Khoa Ngoại)</option>
                  <option value="Nurse Le Van C">ĐD. Lê Văn C (Điều Dưỡng Trưởng)</option>
                  <option value="Pharmacist Pham Thi D">DS. Phạm Thị D (Dược Sĩ)</option>
                </select>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowAssignModal(false)}
                  className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                  disabled={isProcessing}
                >
                  Hủy
                </button>
                <button
                  onClick={handleAssign}
                  className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors disabled:opacity-50"
                  disabled={isProcessing || !assignTo}
                >
                  {isProcessing ? 'Đang Gán...' : 'Xác Nhận Gán'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Notification Popup */}
      {notification.show && (
        <div 
          className="fixed top-4 right-4 z-[70] transition-all duration-300 ease-out"
          style={{
            animation: 'slideInFromTop 0.3s ease-out'
          }}
        >
          <style jsx>{`
            @keyframes slideInFromTop {
              from {
                opacity: 0;
                transform: translateY(-20px);
              }
              to {
                opacity: 1;
                transform: translateY(0);
              }
            }
          `}</style>
          <div 
            className={`
              min-w-[320px] max-w-md p-4 rounded-2xl shadow-2xl border-2
              ${notification.type === 'success' ? 'bg-emerald-50 border-emerald-500' : ''}
              ${notification.type === 'error' ? 'bg-rose-50 border-rose-500' : ''}
              ${notification.type === 'warning' ? 'bg-amber-50 border-amber-500' : ''}
              ${notification.type === 'info' ? 'bg-blue-50 border-blue-500' : ''}
            `}
          >
            <div className="flex items-start space-x-3">
              <div className={`
                p-2 rounded-xl flex-shrink-0
                ${notification.type === 'success' ? 'bg-emerald-100' : ''}
                ${notification.type === 'error' ? 'bg-rose-100' : ''}
                ${notification.type === 'warning' ? 'bg-amber-100' : ''}
                ${notification.type === 'info' ? 'bg-blue-100' : ''}
              `}>
                {notification.type === 'success' && <CheckCircle className="w-6 h-6 text-emerald-600" />}
                {notification.type === 'error' && <AlertCircle className="w-6 h-6 text-rose-600" />}
                {notification.type === 'warning' && <AlertTriangle className="w-6 h-6 text-amber-600" />}
                {notification.type === 'info' && <Info className="w-6 h-6 text-blue-600" />}
              </div>
              
              <div className="flex-1 min-w-0">
                <h4 className={`
                  text-sm font-black mb-1
                  ${notification.type === 'success' ? 'text-emerald-900' : ''}
                  ${notification.type === 'error' ? 'text-rose-900' : ''}
                  ${notification.type === 'warning' ? 'text-amber-900' : ''}
                  ${notification.type === 'info' ? 'text-blue-900' : ''}
                `}>
                  {notification.title}
                </h4>
                <p className={`
                  text-xs leading-relaxed
                  ${notification.type === 'success' ? 'text-emerald-700' : ''}
                  ${notification.type === 'error' ? 'text-rose-700' : ''}
                  ${notification.type === 'warning' ? 'text-amber-700' : ''}
                  ${notification.type === 'info' ? 'text-blue-700' : ''}
                `}>
                  {notification.message}
                </p>
              </div>
              
              <button
                onClick={() => setNotification(prev => ({ ...prev, show: false }))}
                className={`
                  p-1.5 rounded-lg transition-colors flex-shrink-0
                  ${notification.type === 'success' ? 'hover:bg-emerald-100' : ''}
                  ${notification.type === 'error' ? 'hover:bg-rose-100' : ''}
                  ${notification.type === 'warning' ? 'hover:bg-amber-100' : ''}
                  ${notification.type === 'info' ? 'hover:bg-blue-100' : ''}
                `}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
