/**
 * Partner Email Verification Page
 * 
 * Handles:
 * - Email verification via token (from email link)
 * - Resend verification email
 * - Show verification status
 */

'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { verifyEmail, resendVerificationEmail, getApplicationById } from '@/services/partner-registration-actions';
import type { PartnerApplication } from '@/types/partner-registration.types';

function VerifyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const token = searchParams.get('token');
  const applicationId = searchParams.get('application_id');
  
  const [status, setStatus] = useState<'verifying' | 'success' | 'error' | 'pending'>('verifying');
  const [message, setMessage] = useState('');
  const [application, setApplication] = useState<PartnerApplication | null>(null);
  const [isResending, setIsResending] = useState(false);
  
  // Verify email on mount if token is present
  useEffect(() => {
    if (token) {
      handleVerifyEmail(token);
    } else if (applicationId) {
      // Load application and show pending status
      loadApplication(applicationId);
    } else {
      setStatus('error');
      setMessage('Thiếu thông tin xác minh. Vui lòng kiểm tra lại email của bạn.');
    }
  }, [token, applicationId]);
  
  const handleVerifyEmail = async (verificationToken: string) => {
    setStatus('verifying');
    
    try {
      const response = await verifyEmail(verificationToken);
      
      if (response.success) {
        setStatus('success');
        setMessage('Xác minh email thành công! Đơn đăng ký của bạn đang được xem xét.');
        
        // Load application details
        if (response.application_id) {
          await loadApplication(response.application_id);
        }
      } else {
        setStatus('error');
        setMessage(response.error || 'Xác minh thất bại. Vui lòng thử lại.');
      }
    } catch (error) {
      setStatus('error');
      setMessage('Có lỗi xảy ra. Vui lòng thử lại sau.');
    }
  };
  
  const loadApplication = async (appId: string) => {
    try {
      const response = await getApplicationById(appId);
      
      if (response.success && response.application) {
        setApplication(response.application);
        
        // If email not verified yet, show pending status
        if (!response.application.email_verified_at) {
          setStatus('pending');
          setMessage('Đơn đăng ký của bạn đã được gửi. Vui lòng kiểm tra email để xác minh.');
        }
      }
    } catch (error) {
      console.error('Failed to load application:', error);
    }
  };
  
  const handleResendEmail = async () => {
    if (!applicationId) {
      setMessage('Không tìm thấy ID đơn đăng ký.');
      return;
    }
    
    setIsResending(true);
    
    try {
      const response = await resendVerificationEmail(applicationId);
      
      if (response.success) {
        setMessage('Email xác minh đã được gửi lại. Vui lòng kiểm tra hộp thư của bạn.');
      } else {
        setMessage(response.error || 'Không thể gửi lại email. Vui lòng thử lại sau.');
      }
    } catch (error) {
      setMessage('Có lỗi xảy ra. Vui lòng thử lại sau.');
    } finally {
      setIsResending(false);
    }
  };
  
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto">
        {/* Status Card */}
        <div className="bg-white rounded-lg shadow-sm p-8">
          {/* Icon */}
          <div className="flex justify-center mb-6">
            {status === 'verifying' && (
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-rose-600" />
            )}
            
            {status === 'success' && (
              <div className="rounded-full bg-green-100 p-3">
                <svg
                  className="h-12 w-12 text-green-600"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
            )}
            
            {status === 'error' && (
              <div className="rounded-full bg-red-100 p-3">
                <svg
                  className="h-12 w-12 text-red-600"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
            )}
            
            {status === 'pending' && (
              <div className="rounded-full bg-yellow-100 p-3">
                <svg
                  className="h-12 w-12 text-yellow-600"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
            )}
          </div>
          
          {/* Title */}
          <h1 className="text-2xl font-bold text-gray-900 text-center mb-4">
            {status === 'verifying' && 'Đang xác minh email...'}
            {status === 'success' && 'Xác minh thành công!'}
            {status === 'error' && 'Xác minh thất bại'}
            {status === 'pending' && 'Chờ xác minh email'}
          </h1>
          
          {/* Message */}
          <p className="text-gray-600 text-center mb-6">{message}</p>
          
          {/* Application Details */}
          {application && status === 'success' && (
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Thông tin đơn đăng ký</h3>
              <dl className="space-y-2">
                <div className="flex justify-between text-sm">
                  <dt className="text-gray-500">Mã đơn:</dt>
                  <dd className="text-gray-900 font-mono">{application.id.slice(0, 8)}</dd>
                </div>
                <div className="flex justify-between text-sm">
                  <dt className="text-gray-500">Email:</dt>
                  <dd className="text-gray-900">{application.email}</dd>
                </div>
                <div className="flex justify-between text-sm">
                  <dt className="text-gray-500">Ngày gửi:</dt>
                  <dd className="text-gray-900">
                    {application.submitted_at
                      ? new Date(application.submitted_at).toLocaleString('vi-VN')
                      : 'N/A'}
                  </dd>
                </div>
              </dl>
            </div>
          )}
          
          {/* Actions */}
          <div className="space-y-3">
            {status === 'success' && (
              <button
                onClick={() => router.push(`/partner/application-status?id=${application?.id}`)}
                className="
                  w-full px-6 py-3 bg-rose-600 text-white font-medium rounded-lg
                  hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-500
                  transition-colors
                "
              >
                Xem trạng thái đơn
              </button>
            )}
            
            {status === 'pending' && (
              <button
                onClick={handleResendEmail}
                disabled={isResending}
                className="
                  w-full px-6 py-3 bg-rose-600 text-white font-medium rounded-lg
                  hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-500
                  disabled:opacity-50 disabled:cursor-not-allowed
                  transition-colors
                "
              >
                {isResending ? 'Đang gửi...' : 'Gửi lại email xác minh'}
              </button>
            )}
            
            {status === 'error' && applicationId && (
              <button
                onClick={handleResendEmail}
                disabled={isResending}
                className="
                  w-full px-6 py-3 bg-rose-600 text-white font-medium rounded-lg
                  hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-500
                  disabled:opacity-50 disabled:cursor-not-allowed
                  transition-colors
                "
              >
                {isResending ? 'Đang gửi...' : 'Gửi lại email xác minh'}
              </button>
            )}
            
            <button
              onClick={() => router.push('/')}
              className="
                w-full px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg
                hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500
                transition-colors
              "
            >
              Về trang chủ
            </button>
          </div>
        </div>
        
        {/* Help Text */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            Gặp vấn đề?{' '}
            <a href="mailto:support@bella.ai" className="text-rose-600 hover:text-rose-700 font-medium">
              Liên hệ hỗ trợ
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function PartnerVerifyPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-rose-600" />
      </div>
    }>
      <VerifyContent />
    </Suspense>
  );
}
