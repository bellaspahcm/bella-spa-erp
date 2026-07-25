/**
 * Tab Quản Lý Phân Quyền (Scopes)
 * 
 * Hiển thị và cho phép thêm/xóa scopes
 * - Hiển thị scopes hiện tại grouped by category
 * - Thêm scopes mới
 * - Xóa scopes
 * - Áp dụng presets
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import type { APIPartner, APIScope } from '@/types/api-gateway';
import { SCOPE_PRESETS } from '@/types/api-gateway';

interface PartnerScopesTabProps {
  partner: APIPartner;
}

const SCOPE_CATEGORIES = [
  {
    name: 'Đơn Hàng (Orders)',
    scopes: [
      { value: 'order:read', label: 'Xem', description: 'Xem thông tin đơn hàng' },
      { value: 'order:write', label: 'Tạo', description: 'Tạo đơn hàng mới' },
      { value: 'order:complete', label: 'Hoàn tất', description: 'Đánh dấu đơn hoàn tất' },
      { value: 'order:cancel', label: 'Hủy', description: 'Hủy đơn hàng' },
      { value: 'order:*', label: 'Toàn quyền', description: 'Tất cả quyền đơn hàng' },
    ],
  },
  {
    name: 'Thanh Toán (Payments)',
    scopes: [
      { value: 'payment:read', label: 'Xem', description: 'Xem thông tin thanh toán' },
      { value: 'payment:write', label: 'Ghi nhận', description: 'Ghi nhận thanh toán' },
      { value: 'payment:refund', label: 'Hoàn tiền', description: 'Xử lý hoàn tiền' },
      { value: 'payment:*', label: 'Toàn quyền', description: 'Tất cả quyền thanh toán' },
    ],
  },
  {
    name: 'Hóa Đơn (Invoices)',
    scopes: [
      { value: 'invoice:read', label: 'Xem', description: 'Xem hóa đơn' },
      { value: 'invoice:create', label: 'Tạo', description: 'Tạo hóa đơn' },
      { value: 'invoice:cancel', label: 'Hủy', description: 'Hủy hóa đơn' },
      { value: 'invoice:*', label: 'Toàn quyền', description: 'Tất cả quyền hóa đơn' },
    ],
  },
  {
    name: 'POS',
    scopes: [
      { value: 'pos:sync', label: 'Đồng bộ', description: 'Đồng bộ dữ liệu POS' },
      { value: 'pos:read', label: 'Xem', description: 'Xem dữ liệu POS' },
      { value: 'pos:*', label: 'Toàn quyền', description: 'Tất cả quyền POS' },
    ],
  },
  {
    name: 'Nhân Sự (HR)',
    scopes: [
      { value: 'hr:sync', label: 'Đồng bộ', description: 'Đồng bộ dữ liệu HR' },
      { value: 'hr:read', label: 'Xem', description: 'Xem dữ liệu HR' },
      { value: 'hr:*', label: 'Toàn quyền', description: 'Tất cả quyền HR' },
    ],
  },
  {
    name: 'Phân Tích (Analytics)',
    scopes: [
      { value: 'analytics:read', label: 'Xem', description: 'Xem dữ liệu phân tích' },
      { value: 'analytics:*', label: 'Toàn quyền', description: 'Tất cả quyền analytics' },
    ],
  },
  {
    name: 'Webhooks',
    scopes: [
      { value: 'webhook:subscribe', label: 'Đăng ký', description: 'Đăng ký webhook' },
      { value: 'webhook:read', label: 'Xem', description: 'Xem webhook subscriptions' },
      { value: 'webhook:*', label: 'Toàn quyền', description: 'Tất cả quyền webhooks' },
    ],
  },
];

const PRESETS = [
  { key: 'basic', label: 'Cơ Bản', description: 'Chỉ đọc dữ liệu' },
  { key: 'pos_integration', label: 'POS', description: 'Tích hợp POS đầy đủ' },
  { key: 'payment_gateway', label: 'Thanh Toán', description: 'Cổng thanh toán' },
  { key: 'hr_platform', label: 'HR', description: 'Nền tảng HR' },
  { key: 'invoice_provider', label: 'Hóa Đơn', description: 'Nhà cung cấp hóa đơn' },
  { key: 'admin', label: 'Admin', description: '⚠️ Toàn quyền' },
];

export function PartnerScopesTab({ partner }: PartnerScopesTabProps) {
  const router = useRouter();
  const [selectedScopes, setSelectedScopes] = useState<APIScope[]>(partner.allowed_scopes);
  const [loading, setLoading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Toggle scope
  const toggleScope = (scope: APIScope) => {
    const newScopes = selectedScopes.includes(scope)
      ? selectedScopes.filter((s) => s !== scope)
      : [...selectedScopes, scope];

    setSelectedScopes(newScopes);
    setHasChanges(JSON.stringify(newScopes.sort()) !== JSON.stringify(partner.allowed_scopes.sort()));
  };

  // Apply preset
  const applyPreset = (presetKey: string) => {
    const scopes = SCOPE_PRESETS[presetKey as keyof typeof SCOPE_PRESETS];
    if (scopes) {
      setSelectedScopes(scopes);
      setHasChanges(JSON.stringify(scopes.sort()) !== JSON.stringify(partner.allowed_scopes.sort()));
      toast.success(`Đã áp dụng preset: ${PRESETS.find(p => p.key === presetKey)?.label}`);
    }
  };

  // Save changes
  const handleSave = async () => {
    if (selectedScopes.length === 0) {
      toast.error('Phải có ít nhất 1 scope');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/admin/partners/${partner.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          allowed_scopes: selectedScopes,
        }),
      });

      if (!response.ok) {
        throw new Error('Không thể cập nhật scopes');
      }

      toast.success('Đã cập nhật phân quyền thành công');
      setHasChanges(false);
      router.refresh();
    } catch (_error) {
      toast.error('Không thể cập nhật phân quyền');
    } finally {
      setLoading(false);
    }
  };

  // Reset changes
  const handleReset = () => {
    setSelectedScopes(partner.allowed_scopes);
    setHasChanges(false);
    toast.info('Đã khôi phục phân quyền ban đầu');
  };

  return (
    <div className="space-y-6">
      {/* Header với Save/Reset buttons */}
      {hasChanges && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-blue-900">Có thay đổi chưa lưu</p>
                <p className="text-sm text-blue-700">
                  {selectedScopes.length} scope được chọn
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleReset} disabled={loading}>
                  Hủy
                </Button>
                <Button onClick={handleSave} disabled={loading}>
                  {loading ? 'Đang lưu...' : 'Lưu Thay Đổi'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Presets */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Mẫu Phân Quyền Nhanh
          </CardTitle>
          <CardDescription>
            Áp dụng mẫu phân quyền có sẵn cho các loại đối tác
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {PRESETS.map((preset) => (
              <button
                key={preset.key}
                onClick={() => applyPreset(preset.key)}
                className="p-3 text-left border rounded-lg hover:border-primary hover:bg-primary/5 transition-colors"
              >
                <div className="font-medium text-sm">{preset.label}</div>
                <div className="text-xs text-muted-foreground mt-1">{preset.description}</div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Scopes by Category */}
      <div className="grid gap-6 md:grid-cols-2">
        {SCOPE_CATEGORIES.map((category) => {
          const categoryScopes = category.scopes;
          const activeScopesInCategory = categoryScopes.filter((s) =>
            selectedScopes.includes(s.value as APIScope)
          );

          return (
            <Card key={category.name}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{category.name}</CardTitle>
                  <Badge variant="outline">
                    {activeScopesInCategory.length}/{categoryScopes.length}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {categoryScopes.map((scope) => {
                    const isSelected = selectedScopes.includes(scope.value as APIScope);
                    const isWildcard = scope.value.endsWith(':*');

                    return (
                      <button
                        key={scope.value}
                        onClick={() => toggleScope(scope.value as APIScope)}
                        className={`w-full flex items-start gap-3 p-3 border rounded-lg hover:border-primary transition-colors ${
                          isSelected ? 'border-primary bg-primary/5' : ''
                        }`}
                      >
                        <div
                          className={`flex items-center justify-center h-5 w-5 rounded border-2 ${
                            isSelected
                              ? 'bg-primary border-primary'
                              : 'border-gray-300'
                          }`}
                        >
                          {isSelected && <Check className="h-3 w-3 text-white" />}
                        </div>
                        <div className="flex-1 text-left">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{scope.label}</span>
                            {isWildcard && (
                              <Badge variant="outline" className="text-xs bg-red-50 text-red-700">
                                Wildcard
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {scope.description}
                          </p>
                          <code className="text-xs bg-muted px-1 py-0.5 rounded mt-1 inline-block">
                            {scope.value}
                          </code>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle>Tổng Quan Phân Quyền</CardTitle>
          <CardDescription>
            Tổng hợp các quyền đang được cấp cho đối tác này
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Tổng số scopes:</span>
              <Badge variant="outline" className="text-base">
                {selectedScopes.length}
              </Badge>
            </div>

            <Separator />

            <div className="flex flex-wrap gap-2">
              {selectedScopes.length > 0 ? (
                selectedScopes.map((scope) => (
                  <Badge key={scope} variant="secondary" className="gap-1">
                    {scope}
                    <button
                      onClick={() => toggleScope(scope)}
                      className="ml-1 hover:text-red-600"
                    >
                      ×
                    </button>
                  </Badge>
                ))
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  Chưa có scope nào được chọn
                </p>
              )}
            </div>

            {selectedScopes.some(s => s.endsWith(':*')) && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mt-4">
                <p className="text-xs text-yellow-800">
                  <strong>⚠️ Cảnh báo:</strong> Đối tác có quyền wildcard (*) cho một số tài nguyên.
                  Điều này cấp toàn quyền trên nhóm tài nguyên đó. Chỉ nên cấp cho đối tác tin cậy tuyệt đối.
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
