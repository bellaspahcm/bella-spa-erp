'use client';

/**
 * Service Items List Component
 * 
 * Displays list of service items with edit/delete actions
 */

import { useState } from 'react';
import { Trash2, Pencil, CheckCircle, XCircle } from 'lucide-react';
import { deleteServiceItem } from '@/modules/bookings/actions/service-items-actions';
import { useRouter } from 'next/navigation';

interface ServiceItem {
  id: string;
  booking_id: string;
  ktv_id: string | null;
  service_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  override_commission_type: string | null;
  override_commission_value: number | null;
  calculated_commission: number;
  status: string;
  completed_date: string | null;
  created_at: string;
  users?: {
    id: string;
    full_name: string;
  } | null;
}

interface Package {
  id: string;
  name: string;
  price: number | null;
}

interface ServiceItemsListProps {
  serviceItems: ServiceItem[];
  packages: Package[];
  bookingId: string;
  tenantId: string;
}

export function ServiceItemsList({ serviceItems, packages, bookingId, tenantId }: ServiceItemsListProps) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Filter out cancelled items
  const activeServiceItems = serviceItems.filter(item => item.status !== 'cancelled');

  const handleDelete = async (id: string) => {
    if (!confirm('Bạn có chắc muốn xóa dịch vụ này?')) {
      return;
    }

    setDeletingId(id);
    try {
      const result = await deleteServiceItem(id, tenantId);
      if (result.success) {
        router.refresh();
      } else {
        alert(`Lỗi: ${result.error}`);
      }
    } catch (error) {
      console.error('Error deleting service item:', error);
      alert('Không thể xóa dịch vụ');
    } finally {
      setDeletingId(null);
    }
  };

  if (activeServiceItems.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-12 text-center">
        <p className="text-muted-foreground">
          Chưa có dịch vụ nào. Nhấn nút "Thêm dịch vụ" để bắt đầu.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="p-3 text-left text-sm font-medium">Dịch vụ</th>
                <th className="p-3 text-left text-sm font-medium">KTV</th>
                <th className="p-3 text-right text-sm font-medium">SL</th>
                <th className="p-3 text-right text-sm font-medium">Đơn giá</th>
                <th className="p-3 text-right text-sm font-medium">Thành tiền</th>
                <th className="p-3 text-right text-sm font-medium">Hoa hồng</th>
                <th className="p-3 text-center text-sm font-medium">Trạng thái</th>
                <th className="p-3 text-center text-sm font-medium">Ngày hoàn thành</th>
                <th className="p-3 text-center text-sm font-medium">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {activeServiceItems.map((item) => (
                <tr key={item.id} className="border-b last:border-b-0 hover:bg-muted/30">
                  <td className="p-3">
                    <div className="font-medium">{item.service_name}</div>
                    {item.override_commission_type && (
                      <div className="text-xs text-muted-foreground">
                        Override: {item.override_commission_type === 'fixed' ? 'Cố định' : 'Phần trăm'}
                        {' '}({item.override_commission_value})
                      </div>
                    )}
                  </td>
                  <td className="p-3">
                    <div className="text-sm">{item.users?.full_name || '—'}</div>
                  </td>
                  <td className="p-3 text-right">
                    <div className="font-medium">{item.quantity}</div>
                  </td>
                  <td className="p-3 text-right">
                    <div className="font-medium">
                      {item.unit_price.toLocaleString('vi-VN')}đ
                    </div>
                  </td>
                  <td className="p-3 text-right">
                    <div className="font-semibold">
                      {item.subtotal.toLocaleString('vi-VN')}đ
                    </div>
                  </td>
                  <td className="p-3 text-right">
                    <div className="font-semibold text-primary">
                      {item.calculated_commission.toLocaleString('vi-VN')}đ
                    </div>
                  </td>
                  <td className="p-3 text-center">
                    {item.status === 'completed' ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
                        <CheckCircle className="h-3 w-3" />
                        Hoàn thành
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-700">
                        <XCircle className="h-3 w-3" />
                        Chưa hoàn thành
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-center text-sm">
                    {item.completed_date
                      ? new Date(item.completed_date).toLocaleDateString('vi-VN')
                      : '—'}
                  </td>
                  <td className="p-3">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => alert('Edit functionality coming soon')}
                        className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                        title="Sửa"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        disabled={deletingId === item.id}
                        className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                        title="Xóa"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
