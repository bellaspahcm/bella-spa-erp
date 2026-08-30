/**
 * Bella Auto - Approval Dashboard
 * Phase 13 Week 2: User approval queue and history
 */

'use client';

import { useState, useEffect } from 'react';
import { Clock, CheckCircle, XCircle, AlertCircle, User } from 'lucide-react';

export interface ApprovalInstance {
  id: string;
  workflowName: string;
  entityType: string;
  entityId: string;
  currentLevel: number;
  requestedAt: string;
  ageHours: number;
  entityData?: Record<string, unknown>;
}

export interface ApprovalDashboardProps {
  userId: string;
  userRole: string;
  onApprove?: (instanceId: string, comment?: string) => Promise<void>;
  onReject?: (instanceId: string, reason: string) => Promise<void>;
}

export function ApprovalDashboard({
  userId,
  userRole,
  onApprove,
  onReject,
}: ApprovalDashboardProps) {
  const [pendingApprovals, setPendingApprovals] = useState<ApprovalInstance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedInstance, setSelectedInstance] = useState<string | null>(null);
  const [actionInProgress, setActionInProgress] = useState(false);

  async function fetchPendingApprovals() {
    setIsLoading(true);
    try {
      // TODO: Replace with actual RPC call
      // const { data } = await supabase.rpc('get_pending_approvals', {
      //   p_tenant_id: tenantId,
      //   p_user_id: userId,
      //   p_user_role: userRole
      // });

      // Mock data
      const mockData: ApprovalInstance[] = [
        {
          id: 'approval-1',
          workflowName: 'Phê duyệt 2 cấp',
          entityType: 'quotation',
          entityId: 'quote-001',
          currentLevel: 1,
          requestedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          ageHours: 2,
          entityData: {
            customer: 'Nguyễn Văn A',
            vehicle: 'BMW X5 2024',
            total: 2500000000,
          },
        },
        {
          id: 'approval-2',
          workflowName: 'Phê duyệt Giám đốc',
          entityType: 'loan',
          entityId: 'loan-002',
          currentLevel: 1,
          requestedAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
          ageHours: 5,
          entityData: {
            customer: 'Trần Thị B',
            loanAmount: 1800000000,
            term: 60,
          },
        },
      ];

      setPendingApprovals(mockData);
    } catch (error) {
      console.error('Failed to fetch approvals:', error);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchPendingApprovals();
    const interval = setInterval(fetchPendingApprovals, 30000);
    return () => clearInterval(interval);
  }, [userId, userRole]);

  const handleApprove = async (instanceId: string) => {
    if (!onApprove) return;

    const comment = prompt('Nhận xét (tùy chọn):');
    if (comment === null) return;

    setActionInProgress(true);
    try {
      await onApprove(instanceId, comment);
      setPendingApprovals(pendingApprovals.filter((a) => a.id !== instanceId));
      alert('✅ Đã phê duyệt thành công');
    } catch (error) {
      alert(`❌ Lỗi: ${error instanceof Error ? error.message : 'Unknown'}`);
    } finally {
      setActionInProgress(false);
    }
  };

  const handleReject = async (instanceId: string) => {
    if (!onReject) return;

    const reason = prompt('Lý do từ chối (bắt buộc):');
    if (!reason || reason.trim().length < 10) {
      alert('Lý do từ chối phải có ít nhất 10 ký tự');
      return;
    }

    setActionInProgress(true);
    try {
      await onReject(instanceId, reason);
      setPendingApprovals(pendingApprovals.filter((a) => a.id !== instanceId));
      alert('✅ Đã từ chối');
    } catch (error) {
      alert(`❌ Lỗi: ${error instanceof Error ? error.message : 'Unknown'}`);
    } finally {
      setActionInProgress(false);
    }
  };

  const getUrgencyColor = (ageHours: number) => {
    if (ageHours < 4) return 'text-green-600 bg-green-50';
    if (ageHours < 12) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  const getUrgencyIcon = (ageHours: number) => {
    if (ageHours < 4) return <Clock className="w-4 h-4" />;
    if (ageHours < 12) return <AlertCircle className="w-4 h-4" />;
    return <AlertCircle className="w-4 h-4 animate-pulse" />;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Đang tải...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Phê duyệt cần xử lý</h2>
          <p className="text-sm text-gray-600 mt-1">
            Vai trò của bạn: <strong>{userRole}</strong>
          </p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-lg">
          <User className="w-5 h-5 text-blue-600" />
          <span className="text-lg font-bold text-blue-900">
            {pendingApprovals.length}
          </span>
          <span className="text-sm text-blue-700">yêu cầu</span>
        </div>
      </div>

      {/* Approval List */}
      {pendingApprovals.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
          <p className="text-gray-600 font-medium">Không có yêu cầu phê duyệt nào</p>
          <p className="text-sm text-gray-500 mt-1">Bạn đã xử lý xong tất cả</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pendingApprovals.map((approval) => (
            <div
              key={approval.id}
              className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold text-gray-900">
                      {approval.workflowName}
                    </h3>
                    <span
                      className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${getUrgencyColor(
                        approval.ageHours
                      )}`}
                    >
                      {getUrgencyIcon(approval.ageHours)}
                      {approval.ageHours}h trước
                    </span>
                    <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                      Cấp {approval.currentLevel}
                    </span>
                  </div>

                  <div className="text-sm text-gray-600 space-y-1">
                    <p>
                      <strong>Loại:</strong> {approval.entityType}
                    </p>
                    {approval.entityData && (
                      <>
                        {typeof approval.entityData.customer === 'string' && (
                          <p>
                            <strong>Khách hàng:</strong> {approval.entityData.customer}
                          </p>
                        )}
                        {typeof approval.entityData.vehicle === 'string' && (
                          <p>
                            <strong>Xe:</strong> {approval.entityData.vehicle}
                          </p>
                        )}
                        {typeof approval.entityData.total === 'number' && (
                          <p>
                            <strong>Giá trị:</strong>{' '}
                            {approval.entityData.total.toLocaleString('vi-VN')} VND
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-2 ml-4">
                  <button
                    onClick={() => handleApprove(approval.id)}
                    disabled={actionInProgress}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Phê duyệt
                  </button>
                  <button
                    onClick={() => handleReject(approval.id)}
                    disabled={actionInProgress}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
                  >
                    <XCircle className="w-4 h-4" />
                    Từ chối
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
