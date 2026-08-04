'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

type VerificationStatus = 'verifying' | 'success' | 'error' | 'expired';

export default function PartnerVerifyPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');
  
  const [status, setStatus] = useState<VerificationStatus>('verifying');
  const [message, setMessage] = useState('');
  const [applicationId, setApplicationId] = useState<string | null>(null);

  const verifyEmail = useCallback(async () => {
    if (!token) {
      setStatus('error');
      setMessage('Token xác nhận không hợp lệ');
      return;
    }
    try {
      const response = await fetch(`/api/partner/verify?token=${token}`);
      const data = await response.json();

      if (data.success) {
        setStatus('success');
        setMessage('Email đã được xác nhận thành công!');
        setApplicationId(data.application_id);
      } else {
        if (data.error?.includes('expired')) {
          setStatus('expired');
          setMessage('Link xác nhận đã hết hạn');
        } else {
          setStatus('error');
          setMessage(data.error || 'Xác nhận thất bại');
        }
      }
    } catch (error) {
      console.error('[verifyEmail] Error:', error);
      setStatus('error');
      setMessage('Có lỗi xảy ra. Vui lòng thử lại sau.');
    }
  }, [token]);

  useEffect(() => {
    void verifyEmail();
  }, [verifyEmail]);

  const handleResend = async () => {
    // TODO: Implement resend verification email
    alert('Chức năng gửi lại email đang được phát triển');
  };

  const handleViewStatus = () => {
    if (applicationId) {
      router.push(`/partner/application-status?id=${applicationId}`);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 to-pink-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-rose-500 to-pink-500 rounded-full mb-4">
              <span className="text-2xl">🔐</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Xác nhận Email</h1>
          </div>

          {/* Status Icons & Messages */}
          {status === 'verifying' && (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-16 w-16 border-b-4 border-rose-600 mb-4" />
              <p className="text-gray-600">Đang xác nhận email của bạn...</p>
            </div>
          )}

          {status === 'success' && (
            <>
              <div className="text-center py-8">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-4">
                  <svg className="w-10 h-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold text-gray-900 mb-2">
                  Xác nhận thành công!
                </h2>
                <p className="text-gray-600 mb-6">
                  {message}
                </p>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                  <p className="text-sm text-blue-800">
                    📝 Hồ sơ của bạn đang được xem xét bởi đội ngũ quản trị. 
                    Chúng tôi sẽ thông báo kết quả trong vòng 24-48 giờ.
                  </p>
                </div>
              </div>
              
              <button
                onClick={handleViewStatus}
                className="w-full py-3 bg-gradient-to-r from-rose-600 to-pink-600 text-white rounded-lg font-medium hover:from-rose-700 hover:to-pink-700 transition-all"
              >
                Xem trạng thái hồ sơ
              </button>
            </>
          )}

          {status === 'expired' && (
            <>
              <div className="text-center py-8">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-yellow-100 rounded-full mb-4">
                  <svg className="w-10 h-10 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold text-gray-900 mb-2">
                  Link đã hết hạn
                </h2>
                <p className="text-gray-600 mb-6">
                  Link xác nhận đã hết hạn (24 giờ). Vui lòng yêu cầu gửi lại email xác nhận.
                </p>
              </div>
              
              <button
                onClick={handleResend}
                className="w-full py-3 bg-gradient-to-r from-rose-600 to-pink-600 text-white rounded-lg font-medium hover:from-rose-700 hover:to-pink-700 transition-all"
              >
                Gửi lại email xác nhận
              </button>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="text-center py-8">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-red-100 rounded-full mb-4">
                  <svg className="w-10 h-10 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold text-gray-900 mb-2">
                  Xác nhận thất bại
                </h2>
                <p className="text-gray-600 mb-6">
                  {message}
                </p>
              </div>
              
              <button
                onClick={() => router.push('/partner/register')}
                className="w-full py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-all"
              >
                Quay lại trang đăng ký
              </button>
            </>
          )}

          {/* Footer */}
          <div className="mt-8 pt-6 border-t text-center">
            <p className="text-sm text-gray-500">
              Cần hỗ trợ?{' '}
              <a href="mailto:support@bella-erp.com" className="text-rose-600 hover:text-rose-700">
                Liên hệ chúng tôi
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
