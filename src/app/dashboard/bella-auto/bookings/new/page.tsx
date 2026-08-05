import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase-server';

export const metadata = {
  title: 'Tạo Booking Mới | Bella Auto',
  description: 'Tạo đơn đặt cọc xe mới',
};

export default async function NewBookingPage() {
  const supabase = await createClient();

  // Auth check
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    redirect('/login');
  }

  return (
    <div className="flex-1 overflow-auto bg-slate-50 dark:bg-slate-950 p-6 md:p-10">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
            Tạo Booking Mới
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
            Tạo đơn đặt cọc xe cho khách hàng
          </p>
        </div>

        {/* Coming Soon Card */}
        <div className="bg-white dark:bg-slate-950 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-lg p-12 text-center">
          <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-cyan-100 to-blue-100 dark:from-cyan-950 dark:to-blue-950 flex items-center justify-center">
            <svg className="w-12 h-12 text-cyan-600 dark:text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </div>
          
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">
            Tính Năng Đang Phát Triển
          </h2>
          
          <p className="text-slate-600 dark:text-slate-400 mb-6 max-w-md mx-auto">
            Form tạo booking mới đang được phát triển. Tính năng này sẽ cho phép bạn:
          </p>

          <ul className="text-left max-w-md mx-auto space-y-3 mb-8">
            <li className="flex items-start gap-3 text-sm text-slate-600 dark:text-slate-400">
              <svg className="w-5 h-5 text-cyan-600 dark:text-cyan-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Chọn khách hàng hoặc tạo khách hàng mới</span>
            </li>
            <li className="flex items-start gap-3 text-sm text-slate-600 dark:text-slate-400">
              <svg className="w-5 h-5 text-cyan-600 dark:text-cyan-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Chọn dòng xe, màu sắc và phiên bản</span>
            </li>
            <li className="flex items-start gap-3 text-sm text-slate-600 dark:text-slate-400">
              <svg className="w-5 h-5 text-cyan-600 dark:text-cyan-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Phân bổ VIN từ kho (nếu có sẵn)</span>
            </li>
            <li className="flex items-start gap-3 text-sm text-slate-600 dark:text-slate-400">
              <svg className="w-5 h-5 text-cyan-600 dark:text-cyan-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Thiết lập giá bán và số tiền cọc yêu cầu</span>
            </li>
            <li className="flex items-start gap-3 text-sm text-slate-600 dark:text-slate-400">
              <svg className="w-5 h-5 text-cyan-600 dark:text-cyan-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Xác nhận thanh toán cọc ngay (nếu có)</span>
            </li>
          </ul>

          <a
            href="/dashboard/bella-auto/bookings"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Quay Lại Danh Sách Booking
          </a>
        </div>
      </div>
    </div>
  );
}
