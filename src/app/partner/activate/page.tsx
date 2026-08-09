'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

export default function PartnerActivatePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');
  
  const [step, setStep] = useState<'validating' | 'set-password' | 'success' | 'error'>('validating');
  const [error, setError] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateToken = useCallback(async () => {
    try {
      const response = await fetch(`/api/partner/activate/validate?token=${token}`);
      const data = await response.json();

      if (data.success) {
        setStep('set-password');
      } else {
        setStep('error');
        setError(data.error || 'Token không hợp lệ hoặc đã hết hạn');
      }
    } catch (err: unknown) {
      console.error('[validateToken] Error:', err);
      setStep('error');
      setError('Có lỗi xảy ra. Vui lòng thử lại sau.');
    }
  }, [token]);

  useEffect(() => {
    if (!token) {
      setStep('error');
      setError('Token kích hoạt không hợp lệ');
      return;
    }

    void validateToken();
  }, [token, validateToken]);

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 8) {
      alert('Mật khẩu phải có ít nhất 8 ký tự');
      return;
    }

    if (password !== confirmPassword) {
      alert('Mật khẩu xác nhận không khớp');
      return;
    }
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/partner/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });

      const data = await response.json();

      if (data.success) {
        setStep('success');
      } else {
        alert(data.error || 'Kích hoạt thất bại');
      }
    } catch (err: unknown) {
      console.error('[handleActivate] Error:', err);
      alert('Có lỗi xảy ra. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 to-pink-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-rose-500 to-pink-500 rounded-full mb-4">
              <span className="text-2xl">🎉</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Kích hoạt tài khoản</h1>
          </div>

          {/* Validating */}
          {step === 'validating' && (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-16 w-16 border-b-4 border-rose-600 mb-4" />
              <p className="text-gray-600">Đang kiểm tra token kích hoạt...</p>
            </div>
          )}

          {/* Set Password */}
          {step === 'set-password' && (
            <form onSubmit={handleActivate}>
              <div className="mb-6">
                <p className="text-gray-600 text-center mb-6">
                  Chào mừng bạn đến với Bella ERP! Vui lòng đặt mật khẩu để hoàn tất kích hoạt tài khoản.
                </p>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Mật khẩu mới *
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
                  placeholder="Tối thiểu 8 ký tự"
                  required
                  minLength={8}
                />
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Xác nhận mật khẩu *
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
                  placeholder="Nhập lại mật khẩu"
                  required
                  minLength={8}
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-blue-800">
                  💡 <strong>Lưu ý:</strong> Mật khẩu nên có ít nhất 8 ký tự, bao gồm chữ hoa, chữ thường và số.
                </p>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 bg-gradient-to-r from-rose-600 to-pink-600 text-white rounded-lg font-medium hover:from-rose-700 hover:to-pink-700 transition-all disabled:opacity-50"
              >
                {isSubmitting ? 'Đang kích hoạt...' : 'Kích hoạt tài khoản'}
              </button>
            </form>
          )}

          {/* Success */}
          {step === 'success' && (
            <>
              <div className="text-center py-8">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-4">
                  <svg className="w-10 h-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold text-gray-900 mb-2">
                  Kích hoạt thành công!
                </h2>
                <p className="text-gray-600 mb-6">
                  Tài khoản của bạn đã được kích hoạt. Bạn có thể đăng nhập ngay bây giờ.
                </p>
              </div>
              
              <button
                onClick={() => router.push('/login')}
                className="w-full py-3 bg-gradient-to-r from-rose-600 to-pink-600 text-white rounded-lg font-medium hover:from-rose-700 hover:to-pink-700 transition-all"
              >
                Đăng nhập ngay
              </button>
            </>
          )}

          {/* Error */}
          {step === 'error' && (
            <>
              <div className="text-center py-8">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-red-100 rounded-full mb-4">
                  <svg className="w-10 h-10 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold text-gray-900 mb-2">
                  Kích hoạt thất bại
                </h2>
                <p className="text-gray-600 mb-6">
                  {error}
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
