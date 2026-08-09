/**
 * Bella Auto - Template Gallery
 * Phase 13 Week 2: Pre-built rule templates for quick setup
 */

'use client';

import { useState, useEffect } from 'react';
import { Copy, CheckCircle, Filter } from 'lucide-react';

export interface RuleTemplate {
  id: string;
  code: string;
  name: string;
  description: string;
  category: 'pricing' | 'approval' | 'allocation' | 'notification';
  entityType: string;
  conditionsTemplate: unknown[];
  actionsTemplate: unknown[];
  requiredParams: string[];
  exampleConfig: unknown;
  isSystem: boolean;
}

export interface TemplateGalleryProps {
  onApplyTemplate: (template: RuleTemplate) => void;
  selectedEntityType?: string;
}

const CATEGORY_INFO = {
  pricing: {
    label: 'Định giá & Chiết khấu',
    icon: '💰',
    color: 'blue',
  },
  approval: {
    label: 'Phê duyệt',
    icon: '✅',
    color: 'green',
  },
  allocation: {
    label: 'Phân bổ',
    icon: '🚗',
    color: 'purple',
  },
  notification: {
    label: 'Thông báo',
    icon: '🔔',
    color: 'orange',
  },
};

export function TemplateGallery({
  onApplyTemplate,
  selectedEntityType,
}: TemplateGalleryProps) {
  const [templates, setTemplates] = useState<RuleTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  async function fetchTemplates() {
    setIsLoading(true);
    try {
      // TODO: Replace with actual API call
      // const response = await fetch('/api/bella-auto/rule-templates');
      // const data = await response.json();
      
      // Mock data from seeded templates
      const mockTemplates: RuleTemplate[] = [
        {
          id: '1',
          code: 'high_value_approval',
          name: 'Phê duyệt giao dịch giá trị cao',
          description: 'Yêu cầu phê duyệt 2 cấp cho giao dịch trên ngưỡng giá',
          category: 'approval',
          entityType: 'quotation',
          conditionsTemplate: [
            { field: 'total_price', operator: 'greater_than', value: 2000000000 },
          ],
          actionsTemplate: [
            { type: 'require_approval', workflow: 'two_level_approval' },
          ],
          requiredParams: ['price_threshold', 'workflow_code'],
          exampleConfig: { price_threshold: 2000000000 },
          isSystem: true,
        },
        {
          id: '2',
          code: 'luxury_brand_approval',
          name: 'Phê duyệt thương hiệu cao cấp',
          description: 'Yêu cầu phê duyệt Giám đốc cho BMW, Mercedes, Audi',
          category: 'approval',
          entityType: 'quotation',
          conditionsTemplate: [
            { field: 'brand', operator: 'in', value: 'BMW,Mercedes-Benz,Audi' },
          ],
          actionsTemplate: [
            { type: 'require_approval', workflow: 'director_approval' },
          ],
          requiredParams: ['brands', 'workflow_code'],
          exampleConfig: { brands: ['BMW', 'Mercedes-Benz', 'Audi'] },
          isSystem: true,
        },
        {
          id: '3',
          code: 'max_discount_limit',
          name: 'Giới hạn chiết khấu',
          description: 'Đặt mức chiết khấu tối đa theo giá trị xe',
          category: 'pricing',
          entityType: 'quotation',
          conditionsTemplate: [
            { field: 'total_price', operator: 'less_than', value: 1000000000 },
          ],
          actionsTemplate: [
            { type: 'set_discount_limit', max_percent: 5 },
          ],
          requiredParams: ['price_threshold', 'max_discount_percent'],
          exampleConfig: { price_threshold: 1000000000, max_discount_percent: 5 },
          isSystem: true,
        },
        {
          id: '4',
          code: 'auto_allocate_showroom',
          name: 'Phân bổ xe showroom tự động',
          description: 'Tự động phân bổ xe từ showroom khi báo giá được duyệt',
          category: 'allocation',
          entityType: 'quotation',
          conditionsTemplate: [
            { field: 'status', operator: 'equals', value: 'approved' },
          ],
          actionsTemplate: [
            { type: 'allocate_vehicle', source: 'showroom' },
          ],
          requiredParams: ['vehicle_source'],
          exampleConfig: { vehicle_source: 'showroom' },
          isSystem: true,
        },
        {
          id: '5',
          code: 'high_value_notification',
          name: 'Thông báo giao dịch lớn',
          description: 'Gửi thông báo cho Giám đốc khi có giao dịch trên 3 tỷ',
          category: 'notification',
          entityType: 'quotation',
          conditionsTemplate: [
            { field: 'total_price', operator: 'greater_than', value: 3000000000 },
          ],
          actionsTemplate: [
            { type: 'trigger_notification', recipients: 'director', message: 'Giao dịch giá trị cao' },
          ],
          requiredParams: ['price_threshold', 'recipients'],
          exampleConfig: { price_threshold: 3000000000 },
          isSystem: true,
        },
        {
          id: '6',
          code: 'loan_high_amount_approval',
          name: 'Phê duyệt khoản vay lớn',
          description: 'Yêu cầu phê duyệt cho khoản vay trên 1.5 tỷ',
          category: 'approval',
          entityType: 'loan',
          conditionsTemplate: [
            { field: 'loan_amount', operator: 'greater_than', value: 1500000000 },
          ],
          actionsTemplate: [
            { type: 'require_approval', workflow: 'finance_approval' },
          ],
          requiredParams: ['loan_threshold'],
          exampleConfig: { loan_threshold: 1500000000 },
          isSystem: true,
        },
      ];

      setTemplates(mockTemplates);
    } catch (error) {
      console.error('Failed to fetch templates:', error);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchTemplates();
  }, []);

  const filteredTemplates = templates.filter((template) => {
    // Category filter
    if (selectedCategory !== 'all' && template.category !== selectedCategory) {
      return false;
    }

    // Entity type filter
    if (selectedEntityType && template.entityType !== selectedEntityType) {
      return false;
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        template.name.toLowerCase().includes(query) ||
        template.description.toLowerCase().includes(query) ||
        template.code.toLowerCase().includes(query)
      );
    }

    return true;
  });

  const getCategoryColor = (category: string) => {
    const info = CATEGORY_INFO[category as keyof typeof CATEGORY_INFO];
    return info?.color || 'gray';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Đang tải templates...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Template Gallery</h2>
        <p className="text-sm text-gray-600 mt-1">
          Chọn template có sẵn để tạo rule nhanh chóng
        </p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        {/* Search */}
        <div className="flex-1">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm kiếm template..."
            className="w-full px-4 py-2 border border-gray-300 rounded-md"
          />
        </div>

        {/* Category Filter */}
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-gray-500" />
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md bg-white"
          >
            <option value="all">Tất cả loại</option>
            {Object.entries(CATEGORY_INFO).map(([key, info]) => (
              <option key={key} value={key}>
                {info.icon} {info.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Template Grid */}
      {filteredTemplates.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <p className="text-gray-500">Không tìm thấy template phù hợp</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTemplates.map((template) => {
            const categoryInfo = CATEGORY_INFO[template.category as keyof typeof CATEGORY_INFO];
            const colorClass = getCategoryColor(template.category);

            return (
              <div
                key={template.id}
                className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => onApplyTemplate(template)}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{categoryInfo?.icon}</span>
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium bg-${colorClass}-100 text-${colorClass}-800`}
                    >
                      {categoryInfo?.label}
                    </span>
                  </div>
                  {template.isSystem && (
                    <span className="flex items-center gap-1 text-xs text-green-600">
                      <CheckCircle className="w-3 h-3" />
                      System
                    </span>
                  )}
                </div>

                {/* Content */}
                <div className="space-y-2">
                  <h3 className="font-semibold text-gray-900">{template.name}</h3>
                  <p className="text-sm text-gray-600 line-clamp-2">
                    {template.description}
                  </p>
                  <div className="text-xs text-gray-500">
                    <span className="font-mono bg-gray-100 px-2 py-1 rounded">
                      {template.code}
                    </span>
                  </div>
                </div>

                {/* Footer */}
                <div className="mt-4 pt-3 border-t border-gray-200">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onApplyTemplate(template);
                    }}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
                  >
                    <Copy className="w-4 h-4" />
                    Sử dụng template
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Stats */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-blue-900">
            <strong>{filteredTemplates.length}</strong> template
            {selectedCategory !== 'all' && ` trong loại ${CATEGORY_INFO[selectedCategory as keyof typeof CATEGORY_INFO]?.label}`}
          </span>
          {selectedEntityType && (
            <span className="text-blue-700">
              Chỉ hiển thị cho: <strong>{selectedEntityType}</strong>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
