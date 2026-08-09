/**
 * Partner Application Status Page
 * 
 * Shows:
 * - Current application status
 * - Timeline of status changes
 * - Next steps
 * - Info request message (if any)
 */

'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { getApplicationById } from '@/services/partner-registration-actions';
import type { PartnerApplication } from '@/types/partner-registration.types';
import { getStatusLabel, getStatusColor } from '@/types/partner-registration.types';

function StatusContent() {
  const searchParams = useSearchParams();
  const applicationId = searchParams.get('id');
  
  const [application, setApplication] = useState<PartnerApplication | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const loadApplication = async (id: string) => {
    setIsLoading(true);
    
    try {
      const result = await getApplicationById(id);
      
      if (result.success && result.data) {
        setApplication(result.data);
      } else {
        setError(result.error || 'Không thể tải thông tin đơn đăng ký');
      }
    } catch (err: unknown) {
      console.error('[loadApplication] Error:', err);
      setError('Có lỗi xảy ra. Vui lòng thử lại sau.');
    } finally {
      setIsLoading(false);
    }
  };
  
  useEffect(() => {
    if (applicationId) {
      void loadApplication(applicationId);
    } else {
      setError('Không tìm thấy ID đơn đăng ký');
      setIsLoading(false);
    }
  }, [applicationId]);
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-rose-600" />
      </div>
    );
  }
  
  if (error || !application) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md mx-auto">
          <div className="bg-white rounded-lg shadow-sm p-8 text-center">
            <div className="rounded-full bg-red-100 p-3 inline-flex mb-4">
              <svg className="h-12 w-12 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Không tìm thấy đơn</h1>
            <p className="text-gray-600 mb-6">{error}</p>
            <button
              onClick={() => window.location.href = '/partner/register'}
              className="px-6 py-3 bg-rose-600 text-white font-medium rounded-lg hover:bg-rose-700"
            >
              Đăng ký mới
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  const statusColor = getStatusColor(application.status);
  const statusBgColor = {
    gray: 'bg-gray-100 text-gray-800',
    yellow: 'bg-yellow-100 text-yellow-800',
    blue: 'bg-blue-100 text-blue-800',
    green: 'bg-green-100 text-green-800',
    red: 'bg-red-100 text-red-800',
  }[statusColor];
  
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Trạng thái đơn đăng ký</h1>
          <p className="mt-2 text-gray-600">
            Mã đơn: <span className="font-mono font-medium">{application.id.slice(0, 8)}</span>
          </p>
        </div>
        
        {/* Status Card */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Trạng thái hiện tại</h2>
            <span className={`px-4 py-2 rounded-full text-sm font-medium ${statusBgColor}`}>
              {getStatusLabel(application.status)}
            </span>
          </div>
          
          {/* Status Description */}
          <div className="prose prose-sm max-w-none">
            {application.status === 'draft' && (
              <p className="text-gray-600">
                Đơn đăng ký đang ở trạng thái nháp. Vui lòng hoàn tất và gửi đơn.
              </p>
            )}
            
            {application.status === 'pending_verification' && (
              <p className="text-gray-600">
                Đơn đăng ký đã được gửi và đang chờ xác minh email. Vui lòng kiểm tra email của bạn.
              </p>
            )}
            
            {application.status === 'need_more_info' && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h3 className="text-sm font-medium text-yellow-800 mb-2">
                  Yêu cầu bổ sung thông tin
                </h3>
                <p className="text-sm text-yellow-700 mb-3">
                  {application.info_request_message || 'Vui lòng bổ sung thông tin theo yêu cầu'}
                </p>
                {application.info_request_fields && application.info_request_fields.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-yellow-800 mb-2">
                      Các trường cần bổ sung:
                    </p>
                    <ul className="list-disc list-inside text-sm text-yellow-700 space-y-1">
                      {application.info_request_fields.map((field, index) => (
                        <li key={index}>{field}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
            
            {application.status === 'approved' && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h3 className="text-sm font-medium text-green-800 mb-2">
                  Đơn đăng ký đã được phê duyệt!
                </h3>
                <p className="text-sm text-green-700">
                  Chúng tôi đang tiến hành cấp quyền truy cập cho bạn. Bạn sẽ nhận được email thông báo khi tài khoản được kích hoạt.
                </p>
                {application.approval_notes && (
                  <p className="text-sm text-green-700 mt-2">
                    <strong>Ghi chú:</strong> {application.approval_notes}
                  </p>
                )}
              </div>
            )}
            
            {application.status === 'rejected' && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h3 className="text-sm font-medium text-red-800 mb-2">
                  Đơn đăng ký bị từ chối
                </h3>
                <p className="text-sm text-red-700">
                  {application.rejection_reason || 'Đơn đăng ký của bạn không đáp ứng yêu cầu'}
                </p>
                {application.rejection_category && (
                  <p className="text-sm text-red-700 mt-2">
                    <strong>Loại:</strong> {getRejectionCategoryLabel(application.rejection_category)}
                  </p>
                )}
              </div>
            )}
            
            {application.status === 'provisioned' && (
              <p className="text-gray-600">
                Tài khoản đã được cấp quyền. Vui lòng kiểm tra email để nhận thông tin đăng nhập.
              </p>
            )}
            
            {application.status === 'activated' && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h3 className="text-sm font-medium text-green-800 mb-2">
                  Tài khoản đã được kích hoạt!
                </h3>
                <p className="text-sm text-green-700">
                  Bạn có thể đăng nhập vào hệ thống và bắt đầu sử dụng dịch vụ.
                </p>
              </div>
            )}
          </div>
        </div>
        
        {/* Application Details */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Thông tin đơn đăng ký</h2>
          
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <dt className="text-sm font-medium text-gray-500">Họ và tên</dt>
              <dd className="mt-1 text-sm text-gray-900">{application.full_name}</dd>
            </div>
            
            <div>
              <dt className="text-sm font-medium text-gray-500">Email</dt>
              <dd className="mt-1 text-sm text-gray-900">{application.email}</dd>
            </div>
            
            <div>
              <dt className="text-sm font-medium text-gray-500">Số điện thoại</dt>
              <dd className="mt-1 text-sm text-gray-900">{application.phone}</dd>
            </div>
            
            <div>
              <dt className="text-sm font-medium text-gray-500">Ngày gửi</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {application.submitted_at
                  ? new Date(application.submitted_at).toLocaleString('vi-VN')
                  : 'Chưa gửi'}
              </dd>
            </div>
            
            {application.email_verified_at && (
              <div>
                <dt className="text-sm font-medium text-gray-500">Email đã xác minh</dt>
                <dd className="mt-1 text-sm text-green-600 flex items-center">
                  <svg className="h-4 w-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  {new Date(application.email_verified_at).toLocaleString('vi-VN')}
                </dd>
              </div>
            )}
          </dl>
        </div>
        
        {/* Actions */}
        <div className="flex justify-center">
          <button
            onClick={() => window.location.href = '/'}
            className="
              px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg
              hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500
              transition-colors
            "
          >
            Về trang chủ
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ApplicationStatusPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-rose-600" />
      </div>
    }>
      <StatusContent />
    </Suspense>
  );
}

// Helper function
function getRejectionCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    invalid_docs: 'Tài liệu không hợp lệ',
    duplicate: 'Đăng ký trùng lặp',
    policy_violation: 'Vi phạm chính sách',
    other: 'Khác',
  };
  return labels[category] || category;
}
