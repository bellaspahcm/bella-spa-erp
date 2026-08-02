/**
 * Partner Portal - Bookings Module
 * Đăng ký giữ chỗ & Upload chứng từ cọc
 */
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser } from '@/services/user-actions';
import { 
  fetchPartnerBookings, 
  createBookingRequest, 
  uploadBookingDocument 
} from '@/services/partner-actions';

type BookingStatus = 'pending' | 'approved' | 'rejected' | 'completed';

interface Booking {
  id: string;
  project_name: string;
  unit_code: string;
  customer_name: string;
  customer_phone: string;
  deposit_amount: number;
  status: BookingStatus;
  created_at: string;
  documents?: { name: string; url: string; type: string }[];
}

const STATUS_LABELS: Record<BookingStatus, string> = {
  pending: 'Chờ duyệt',
  approved: 'Đã duyệt',
  rejected: 'Từ chối',
  completed: 'Hoàn tất',
};

const STATUS_COLORS: Record<BookingStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  completed: 'bg-blue-100 text-blue-800',
};

export default function PartnerBookingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);

  // Pre-fill form from lead conversion (query params)
  const [prefillData, setPrefillData] = useState<{
    lead_id?: string;
    name?: string;
    phone?: string;
    email?: string;
    budget?: string;
  }>({});

  useEffect(() => {
    // Check for lead conversion params in URL
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const leadId = params.get('lead_id');
      const name = params.get('name');
      const phone = params.get('phone');
      const email = params.get('email');
      const budget = params.get('budget');
      
      if (leadId) {
        setPrefillData({ lead_id: leadId, name: name || '', phone: phone || '', email: email || '', budget: budget || '' });
        setShowCreateModal(true); // Auto-open modal
      }
    }

    const loadUser = async () => {
      const user = await getCurrentUser();
      if (!user) {
        router.push('/login');
        return;
      }
      await loadBookings(user.id);
    };
    void loadUser();
  }, [router]);

  const loadBookings = async (userId: string) => {
    try {
      setLoading(true);
      const data = await fetchPartnerBookings(userId);
      setBookings(data);
    } catch (error) {
      console.error('Failed to load bookings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBooking = async (formData: FormData) => {
    try {
      const user = await getCurrentUser();
      if (!user) return;

      await createBookingRequest({
        user_id: user.id,
        project_name: formData.get('project_name') as string,
        unit_code: formData.get('unit_code') as string,
        customer_name: formData.get('customer_name') as string,
        customer_phone: formData.get('customer_phone') as string,
        deposit_amount: Number(formData.get('deposit_amount')),
      });

      setShowCreateModal(false);
      await loadBookings(user.id);
    } catch (error) {
      console.error('Failed to create booking:', error);
      alert('Không thể tạo booking. Vui lòng thử lại.');
    }
  };

  const handleUploadDocument = async (bookingId: string, file: File, docType: string) => {
    try {
      setUploadingDoc(true);
      await uploadBookingDocument(bookingId, file, docType);
      
      const user = await getCurrentUser();
      if (user) {
        await loadBookings(user.id);
      }
    } catch (error) {
      console.error('Failed to upload document:', error);
      alert('Upload tài liệu thất bại. Vui lòng thử lại.');
    } finally {
      setUploadingDoc(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center pb-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-gray-900">Đăng Ký Giữ Chỗ</h1>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
            >
              + Tạo Booking
            </button>
          </div>
        </div>
      </div>

      {/* Bookings List */}
      <div className="p-4 space-y-4">
        {bookings.length === 0 ? (
          <div className="bg-white rounded-lg p-8 text-center">
            <p className="text-gray-500">Chưa có booking nào</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-4 text-blue-600 hover:text-blue-700 font-medium"
            >
              Tạo booking đầu tiên →
            </button>
          </div>
        ) : (
          bookings.map((booking) => (
            <div key={booking.id} className="bg-white rounded-lg shadow-sm p-4">
              {/* Booking Header */}
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-gray-900">{booking.project_name}</h3>
                  <p className="text-sm text-gray-600">Căn hộ: {booking.unit_code}</p>
                </div>
                <span className={`px-3 py-1 text-xs font-medium rounded-full ${STATUS_COLORS[booking.status]}`}>
                  {STATUS_LABELS[booking.status]}
                </span>
              </div>

              {/* Customer Info */}
              <div className="space-y-1 mb-3">
                <p className="text-sm text-gray-700">
                  <span className="font-medium">Khách hàng:</span> {booking.customer_name}
                </p>
                <p className="text-sm text-gray-700">
                  <span className="font-medium">SĐT:</span> {booking.customer_phone}
                </p>
                <p className="text-sm text-gray-700">
                  <span className="font-medium">Số tiền cọc:</span>{' '}
                  {booking.deposit_amount.toLocaleString('vi-VN')} VNĐ
                </p>
              </div>

              {/* Documents */}
              {booking.documents && booking.documents.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <p className="text-sm font-medium text-gray-700 mb-2">Tài liệu đã tải lên:</p>
                  <div className="space-y-1">
                    {booking.documents.map((doc, idx) => (
                      <div key={idx} className="flex items-center text-sm text-blue-600">
                        <span className="mr-2">📄</span>
                        <span>{doc.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Upload Button */}
              {booking.status === 'pending' && (
                <div className="mt-3">
                  <label className="block">
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*,application/pdf"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          void handleUploadDocument(booking.id, file, 'deposit_proof');
                        }
                      }}
                      disabled={uploadingDoc}
                    />
                    <span className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 cursor-pointer">
                      📎 Upload chứng từ
                    </span>
                  </label>
                </div>
              )}

              {/* Timestamp */}
              <p className="text-xs text-gray-400 mt-3">
                Ngày tạo: {new Date(booking.created_at).toLocaleDateString('vi-VN')}
              </p>
            </div>
          ))
        )}
      </div>

      {/* Create Booking Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              {prefillData.lead_id ? (
                <>
                  Tạo Booking từ Lead
                  <span className="block text-sm text-emerald-600 font-normal mt-1">
                    Khách hàng: {prefillData.name}
                  </span>
                </>
              ) : (
                'Tạo Booking Mới'
              )}
            </h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                void handleCreateBooking(formData);
              }}
            >
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tên dự án
                  </label>
                  <input
                    type="text"
                    name="project_name"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="VD: Vinhomes Grand Park"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Mã căn hộ
                  </label>
                  <input
                    type="text"
                    name="unit_code"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="VD: S1.01.05"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tên khách hàng
                  </label>
                  <input
                    type="text"
                    name="customer_name"
                    required
                    defaultValue={prefillData.name || ''}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Họ và tên"
                  />
                  {prefillData.lead_id && (
                    <p className="text-xs text-emerald-600 mt-1 font-medium">✓ Từ khách hàng đã đăng ký</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Số điện thoại
                  </label>
                  <input
                    type="tel"
                    name="customer_phone"
                    required
                    defaultValue={prefillData.phone || ''}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="0912345678"
                  />
                </div>

                {prefillData.email && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email (từ lead)
                    </label>
                    <input
                      type="email"
                      name="customer_email"
                      defaultValue={prefillData.email}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-slate-50 text-slate-600"
                      placeholder="email@example.com"
                      readOnly
                    />
                  </div>
                )}

                {prefillData.budget && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Ngân sách tham khảo (từ lead)
                    </label>
                    <input
                      type="text"
                      defaultValue={prefillData.budget}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-slate-50 text-slate-600"
                      readOnly
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Số tiền cọc (VNĐ)
                  </label>
                  <input
                    type="number"
                    name="deposit_amount"
                    required
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="50000000"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Tạo Booking
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
