/**
 * Partner Portal - Commission Wallet Module
 * Ví hoa hồng đối tác & đối soát dòng tiền
 */
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser } from '@/services/user-actions';
import { fetchPartnerCommissions } from '@/services/partner-actions';

type CommissionStatus = 'pending' | 'approved' | 'paid';

interface CommissionRecord {
  id: string;
  booking_id: string;
  project_name: string;
  unit_code: string;
  transaction_amount: number;
  commission_rate: number;
  commission_amount: number;
  tax_deduction: number;
  net_amount: number;
  status: CommissionStatus;
  approved_date: string | null;
  paid_date: string | null;
  created_at: string;
}

interface CommissionSummary {
  total_earned: number;
  pending_amount: number;
  approved_amount: number;
  paid_amount: number;
}

const STATUS_LABELS: Record<CommissionStatus, string> = {
  pending: 'Chờ duyệt',
  approved: 'Đã duyệt',
  paid: 'Đã thanh toán',
};

const STATUS_COLORS: Record<CommissionStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  paid: 'bg-blue-100 text-blue-800',
};

export default function PartnerCommissionPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [commissions, setCommissions] = useState<CommissionRecord[]>([]);
  const [summary, setSummary] = useState<CommissionSummary>({
    total_earned: 0,
    pending_amount: 0,
    approved_amount: 0,
    paid_amount: 0,
  });
  const [selectedFilter, setSelectedFilter] = useState<CommissionStatus | 'all'>('all');

  async function loadCommissions(userId: string) {
    try {
      setLoading(true);
      const data = await fetchPartnerCommissions(userId);
      setCommissions(data);

      // Calculate summary
      const newSummary: CommissionSummary = {
        total_earned: 0,
        pending_amount: 0,
        approved_amount: 0,
        paid_amount: 0,
      };

      data.forEach((comm) => {
        newSummary.total_earned += comm.net_amount;
        if (comm.status === 'pending') {
          newSummary.pending_amount += comm.net_amount;
        } else if (comm.status === 'approved') {
          newSummary.approved_amount += comm.net_amount;
        } else if (comm.status === 'paid') {
          newSummary.paid_amount += comm.net_amount;
        }
      });

      setSummary(newSummary);
    } catch (error) {
      console.error('Failed to load commissions:', error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const loadUser = async () => {
      const user = await getCurrentUser();
      if (!user) {
        router.push('/login');
        return;
      }
      await loadCommissions(user.id);
    };
    void loadUser();
  }, [router]);

  const filteredCommissions =
    selectedFilter === 'all'
      ? commissions
      : commissions.filter((c) => c.status === selectedFilter);

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
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
        <div className="px-4 py-6">
          <h1 className="text-xl font-bold mb-4">Ví Hoa Hồng</h1>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3">
              <p className="text-xs text-blue-100 mb-1">Tổng hoa hồng</p>
              <p className="text-lg font-bold">
                {summary.total_earned.toLocaleString('vi-VN')}
              </p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3">
              <p className="text-xs text-blue-100 mb-1">Đã thanh toán</p>
              <p className="text-lg font-bold">
                {summary.paid_amount.toLocaleString('vi-VN')}
              </p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3">
              <p className="text-xs text-blue-100 mb-1">Chờ duyệt</p>
              <p className="text-lg font-bold">
                {summary.pending_amount.toLocaleString('vi-VN')}
              </p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3">
              <p className="text-xs text-blue-100 mb-1">Đã duyệt</p>
              <p className="text-lg font-bold">
                {summary.approved_amount.toLocaleString('vi-VN')}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="flex overflow-x-auto px-4 py-2 gap-2">
          <button
            onClick={() => setSelectedFilter('all')}
            className={`px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap ${
              selectedFilter === 'all'
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Tất cả ({commissions.length})
          </button>
          <button
            onClick={() => setSelectedFilter('pending')}
            className={`px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap ${
              selectedFilter === 'pending'
                ? 'bg-yellow-100 text-yellow-800'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Chờ duyệt
          </button>
          <button
            onClick={() => setSelectedFilter('approved')}
            className={`px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap ${
              selectedFilter === 'approved'
                ? 'bg-green-100 text-green-800'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Đã duyệt
          </button>
          <button
            onClick={() => setSelectedFilter('paid')}
            className={`px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap ${
              selectedFilter === 'paid'
                ? 'bg-blue-100 text-blue-800'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Đã thanh toán
          </button>
        </div>
      </div>

      {/* Commissions List */}
      <div className="p-4 space-y-4">
        {filteredCommissions.length === 0 ? (
          <div className="bg-white rounded-lg p-8 text-center">
            <p className="text-gray-500">
              {selectedFilter === 'all'
                ? 'Chưa có hoa hồng nào'
                : `Không có hoa hồng ${STATUS_LABELS[selectedFilter as CommissionStatus]?.toLowerCase()}`}
            </p>
          </div>
        ) : (
          filteredCommissions.map((comm) => (
            <div key={comm.id} className="bg-white rounded-lg shadow-sm p-4">
              {/* Commission Header */}
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-gray-900">{comm.project_name}</h3>
                  <p className="text-sm text-gray-600">Căn: {comm.unit_code}</p>
                </div>
                <span className={`px-3 py-1 text-xs font-medium rounded-full ${STATUS_COLORS[comm.status]}`}>
                  {STATUS_LABELS[comm.status]}
                </span>
              </div>

              {/* Transaction Details */}
              <div className="space-y-2 mb-3 bg-gray-50 rounded-lg p-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Giá trị giao dịch:</span>
                  <span className="font-medium text-gray-900">
                    {comm.transaction_amount.toLocaleString('vi-VN')} VNĐ
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Tỷ lệ hoa hồng:</span>
                  <span className="font-medium text-gray-900">{comm.commission_rate}%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Hoa hồng gốc:</span>
                  <span className="font-medium text-blue-600">
                    {comm.commission_amount.toLocaleString('vi-VN')} VNĐ
                  </span>
                </div>
                {comm.tax_deduction > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Thuế TNCN:</span>
                    <span className="font-medium text-red-600">
                      -{comm.tax_deduction.toLocaleString('vi-VN')} VNĐ
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-sm pt-2 border-t border-gray-200">
                  <span className="font-medium text-gray-700">Thực nhận:</span>
                  <span className="font-bold text-green-600 text-base">
                    {comm.net_amount.toLocaleString('vi-VN')} VNĐ
                  </span>
                </div>
              </div>

              {/* Dates */}
              <div className="space-y-1">
                <p className="text-xs text-gray-500">
                  Ngày tạo: {new Date(comm.created_at).toLocaleDateString('vi-VN')}
                </p>
                {comm.approved_date && (
                  <p className="text-xs text-gray-500">
                    Ngày duyệt: {new Date(comm.approved_date).toLocaleDateString('vi-VN')}
                  </p>
                )}
                {comm.paid_date && (
                  <p className="text-xs text-green-600 font-medium">
                    Ngày thanh toán: {new Date(comm.paid_date).toLocaleDateString('vi-VN')}
                  </p>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
