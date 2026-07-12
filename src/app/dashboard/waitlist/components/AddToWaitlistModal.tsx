'use client';

import { useState, useEffect } from 'react';
import { X, Loader2, Package, Clock, User } from 'lucide-react';
import { toast } from 'sonner';
import type { AddToWaitlistInput } from '@/types/waitlist';
import { PremiumSelect } from '@/components/ui/PremiumSelect';

interface AddToWaitlistModalProps {
  isOpen: boolean;
  tenantId: string;
  onClose: () => void;
  onSuccess: () => void;
}

interface Customer {
  id: string;
  name: string; // Changed from name_mother - API returns "name"
  name_baby: string | null;
  phone: string;
  tier: 'vip' | 'loyal' | 'new';
  // total_spending removed - not needed for waitlist
}

interface Package {
  id: string;
  name: string;
  price: number;
  duration_minutes: number;
}

interface KTV {
  id: string;
  name: string;
}

export function AddToWaitlistModal({
  isOpen,
  tenantId,
  onClose,
  onSuccess,
}: AddToWaitlistModalProps) {
  // Form state
  const [formData, setFormData] = useState<Partial<AddToWaitlistInput>>({
    tenant_id: tenantId,
    preferred_start_time: '14:00',
    duration_minutes: 90,
    is_flexible: false,
  });

  // Lookup data
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [ktvs, setKtvs] = useState<KTV[]>([]);

  // UI state
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(false);
  const [isLoadingPackages, setIsLoadingPackages] = useState(false);
  const [isLoadingKtvs, setIsLoadingKtvs] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Priority preview
  const [priorityPreview, setPriorityPreview] = useState({
    position: 0,
    score: 0,
    tierScore: 0,
    valueScore: 0,
    flexibilityBonus: 0,
  });

  // Fetch customers (with debounce for search)
  useEffect(() => {
    if (!isOpen || !tenantId) return;

    const timeoutId = setTimeout(() => {
      void fetchCustomers();
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [isOpen, tenantId, searchQuery]);

  // Fetch packages and KTVs on open
  useEffect(() => {
    if (!isOpen || !tenantId) return;
    void fetchPackages();
    void fetchKtvs();
  }, [isOpen, tenantId]);

  // Calculate priority preview when form changes
  useEffect(() => {
    if (formData.customer_id && formData.package_id) {
      void calculatePriorityPreview();
    }
  }, [formData.customer_id, formData.package_id, formData.is_flexible]);

  const fetchCustomers = async () => {
    setIsLoadingCustomers(true);
    try {
      const params = new URLSearchParams({
        tenant_id: tenantId,
        limit: '10',
      });
      if (searchQuery) params.set('search', searchQuery);

      const response = await fetch(`/api/customers?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setCustomers(data.customers || []);
      }
    } catch (err) {
      console.error('Error fetching customers:', err);
    } finally {
      setIsLoadingCustomers(false);
    }
  };

  const fetchPackages = async () => {
    setIsLoadingPackages(true);
    try {
      const response = await fetch(`/api/packages?tenant_id=${tenantId}&limit=100`);
      if (response.ok) {
        const data = await response.json();
        setPackages(data.packages || []);
      }
    } catch (err) {
      console.error('Error fetching packages:', err);
    } finally {
      setIsLoadingPackages(false);
    }
  };

  const fetchKtvs = async () => {
    setIsLoadingKtvs(true);
    try {
      const response = await fetch(`/api/users?tenant_id=${tenantId}&role=ktv&limit=100`);
      if (response.ok) {
        const data = await response.json();
        setKtvs(data.users || []);
      }
    } catch (err) {
      console.error('Error fetching KTVs:', err);
    } finally {
      setIsLoadingKtvs(false);
    }
  };

  const calculatePriorityPreview = async () => {
    const customer = customers.find((c) => c.id === formData.customer_id);
    const pkg = packages.find((p) => p.id === formData.package_id);

    if (!customer || !pkg) return;

    // Simple priority calculation (matches backend logic)
    const tierScores = { vip: 40, loyal: 25, new: 10 };
    const tierScore = tierScores[customer.tier];

    const valueScore = Math.min(30, Math.round((pkg.price / 10000000) * 30));
    const flexibilityBonus = formData.is_flexible ? 10 : 0;

    const totalScore = tierScore + valueScore + flexibilityBonus;

    // Estimate position (simplified - real calculation is in backend)
    let position = 1;
    if (totalScore < 40) position = 5;
    else if (totalScore < 60) position = 3;
    else if (totalScore < 80) position = 2;

    setPriorityPreview({
      position,
      score: totalScore,
      tierScore,
      valueScore,
      flexibilityBonus,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.customer_id || !formData.package_id || !formData.preferred_date || !formData.preferred_start_time) {
      toast.error('Vui lòng điền đầy đủ thông tin bắt buộc');
      return;
    }

    const pkg = packages.find((p) => p.id === formData.package_id);
    if (!pkg) {
      toast.error('Không tìm thấy thông tin dịch vụ');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload: AddToWaitlistInput = {
        tenant_id: tenantId,
        customer_id: formData.customer_id,
        package_id: formData.package_id,
        preferred_date: formData.preferred_date,
        preferred_start_time: formData.preferred_start_time,
        booking_value: pkg.price,
        duration_minutes: formData.duration_minutes || pkg.duration_minutes,
        preferred_ktv_id: formData.preferred_ktv_id || undefined,
        is_flexible: formData.is_flexible || false,
        notes: formData.notes || undefined,
      };

      const response = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Không thể thêm vào danh sách chờ');
      }

      const data = await response.json();
      
      toast.success(`Đã thêm vào vị trí #${data.position || '?'} trong hàng chờ`);
      onSuccess();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Lỗi không xác định');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const selectedCustomer = customers.find((c) => c.id === formData.customer_id);
  const selectedPackage = packages.find((p) => p.id === formData.package_id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-xl font-bold text-gray-900">
            Thêm khách vào danh sách chờ
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Customer Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Khách hàng <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theo tên hoặc SĐT..."
              className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            {isLoadingCustomers && (
              <div className="mt-2 text-sm text-gray-600">Đang tìm...</div>
            )}
            {customers.length > 0 && !formData.customer_id && (
              <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-gray-200">
                {customers.map((customer) => (
                  <button
                    key={customer.id}
                    type="button"
                    onClick={() => {
                      setFormData({ ...formData, customer_id: customer.id });
                      setSearchQuery('');
                    }}
                    className="w-full px-4 py-2 text-left hover:bg-gray-50"
                  >
                    <div className="text-sm font-medium text-gray-900">
                      {customer.name}
                      {customer.name_baby && ` - ${customer.name_baby}`}
                    </div>
                    <div className="text-xs text-gray-600">
                      {customer.phone} • {customer.tier.toUpperCase()}
                    </div>
                  </button>
                ))}
              </div>
            )}
            {selectedCustomer && (
              <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
                <div className="text-sm font-medium text-gray-900">
                  {selectedCustomer.name}
                  {selectedCustomer.name_baby && ` - ${selectedCustomer.name_baby}`}
                </div>
                <div className="text-xs text-gray-600">
                  {selectedCustomer.phone} • {selectedCustomer.tier.toUpperCase()}
                </div>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, customer_id: undefined })}
                  className="mt-2 text-xs text-emerald-700 hover:underline"
                >
                  Chọn khách khác
                </button>
              </div>
            )}
          </div>

          {/* Service */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Dịch vụ <span className="text-red-500">*</span>
            </label>
            <PremiumSelect
              value={formData.package_id || ''}
              onChange={(value) => setFormData({ ...formData, package_id: value })}
              disabled={isLoadingPackages}
              placeholder="Chọn dịch vụ"
              options={[
                { value: '', label: 'Chọn dịch vụ', icon: <Package className="w-4 h-4" /> },
                ...packages.map((pkg) => ({
                  value: pkg.id,
                  label: `${pkg.name} - ${pkg.price.toLocaleString('vi-VN')} VNĐ - ${pkg.duration_minutes} phút`,
                  icon: <Package className="w-4 h-4" />,
                })),
              ]}
            />
          </div>

          {/* Date and Time */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ngày mong muốn <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={formData.preferred_date || ''}
                onChange={(e) => setFormData({ ...formData, preferred_date: e.target.value })}
                min={new Date().toISOString().split('T')[0]}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Giờ <span className="text-red-500">*</span>
              </label>
              <input
                type="time"
                value={formData.preferred_start_time || ''}
                onChange={(e) => setFormData({ ...formData, preferred_start_time: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                required
              />
            </div>
          </div>

          {/* Duration and KTV */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Thời lượng (phút)
              </label>
              <PremiumSelect
                value={String(formData.duration_minutes || selectedPackage?.duration_minutes || 90)}
                onChange={(value) => setFormData({ ...formData, duration_minutes: parseInt(value, 10) })}
                options={[
                  { value: '60', label: '60 phút', icon: <Clock className="w-4 h-4" /> },
                  { value: '90', label: '90 phút', icon: <Clock className="w-4 h-4" /> },
                  { value: '120', label: '120 phút', icon: <Clock className="w-4 h-4" /> },
                  { value: '180', label: '180 phút', icon: <Clock className="w-4 h-4" /> },
                ]}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ưu tiên KTV (tùy chọn)
              </label>
              <PremiumSelect
                value={formData.preferred_ktv_id || ''}
                onChange={(value) => setFormData({ ...formData, preferred_ktv_id: value || undefined })}
                disabled={isLoadingKtvs}
                placeholder="Không chỉ định"
                options={[
                  { value: '', label: 'Không chỉ định', icon: <User className="w-4 h-4" /> },
                  ...ktvs.map((ktv) => ({
                    value: ktv.id,
                    label: ktv.name,
                    icon: <User className="w-4 h-4" />,
                  })),
                ]}
              />
            </div>
          </div>

          {/* Flexibility */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_flexible || false}
                onChange={(e) => setFormData({ ...formData, is_flexible: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <span className="text-sm text-gray-700">
                Có thể nhận lịch thay thế gần giờ mong muốn (+10 điểm ưu tiên)
              </span>
            </label>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ghi chú
            </label>
            <textarea
              value={formData.notes || ''}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              placeholder="Ghi chú thêm..."
              className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Priority Preview */}
          {formData.customer_id && formData.package_id && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">
                📊 Dự kiến
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-700">Vị trí trong hàng:</span>
                  <span className="font-semibold text-gray-900">
                    #{priorityPreview.position}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-700">Điểm ưu tiên:</span>
                  <span className="font-semibold text-gray-900">
                    {priorityPreview.score}/100
                  </span>
                </div>
                <div className="mt-2 space-y-1 text-xs text-gray-600">
                  <div className="flex justify-between">
                    <span>• Hạng {selectedCustomer?.tier.toUpperCase()}:</span>
                    <span>{priorityPreview.tierScore} điểm</span>
                  </div>
                  <div className="flex justify-between">
                    <span>• Giá trị đơn:</span>
                    <span>{priorityPreview.valueScore} điểm</span>
                  </div>
                  {priorityPreview.flexibilityBonus > 0 && (
                    <div className="flex justify-between">
                      <span>• Linh hoạt:</span>
                      <span>{priorityPreview.flexibilityBonus} điểm</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !formData.customer_id || !formData.package_id || !formData.preferred_date}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isSubmitting ? 'Đang thêm...' : 'Thêm vào hàng'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
