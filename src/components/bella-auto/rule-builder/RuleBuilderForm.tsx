/**
 * Bella Auto - Rule Builder Form
 * Phase 13 Week 2: Main form wrapper integrating conditions and actions
 */

'use client';

import { useState } from 'react';
import { Save, TestTube, X } from 'lucide-react';
import { ConditionBuilder, RuleCondition } from './ConditionBuilder';
import { ActionConfigurator, RuleAction } from './ActionConfigurator';

export interface BusinessRule {
  id?: string;
  code: string;
  name: string;
  description?: string;
  entityType: 'quotation' | 'booking' | 'trade_in' | 'loan' | 'service';
  priority: number;
  conditions: RuleCondition[];
  actions: RuleAction[];
  isActive: boolean;
  effectiveFrom?: string;
  effectiveUntil?: string;
}

export interface RuleBuilderFormProps {
  initialRule?: BusinessRule;
  onSave: (rule: BusinessRule) => Promise<void>;
  onCancel: () => void;
  readonly?: boolean;
}

const ENTITY_TYPES = [
  { key: 'quotation', label: 'Báo giá (Quotation)' },
  { key: 'booking', label: 'Hợp đồng đặt cọc (Booking)' },
  { key: 'trade_in', label: 'Thu mua xe cũ (Trade-In)' },
  { key: 'loan', label: 'Hồ sơ vay (Loan)' },
  { key: 'service', label: 'Dịch vụ sửa chữa (Service)' },
];

export function RuleBuilderForm({
  initialRule,
  onSave,
  onCancel,
  readonly = false,
}: RuleBuilderFormProps) {
  const [rule, setRule] = useState<BusinessRule>(
    initialRule || {
      code: '',
      name: '',
      description: '',
      entityType: 'quotation',
      priority: 100,
      conditions: [],
      actions: [],
      isActive: true,
    }
  );

  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const updateRule = (updates: Partial<BusinessRule>) => {
    setRule({ ...rule, ...updates });
    // Clear errors for updated fields
    const newErrors = { ...errors };
    Object.keys(updates).forEach((key) => {
      delete newErrors[key];
    });
    setErrors(newErrors);
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!rule.code.trim()) {
      newErrors.code = 'Mã rule bắt buộc';
    } else if (!/^[a-z0-9_]+$/.test(rule.code)) {
      newErrors.code = 'Mã rule chỉ chứa chữ thường, số và dấu gạch dưới';
    }

    if (!rule.name.trim()) {
      newErrors.name = 'Tên rule bắt buộc';
    }

    if (rule.priority < 1 || rule.priority > 1000) {
      newErrors.priority = 'Priority phải từ 1-1000';
    }

    if (rule.conditions.length === 0) {
      newErrors.conditions = 'Phải có ít nhất 1 điều kiện';
    }

    if (rule.actions.length === 0) {
      newErrors.actions = 'Phải có ít nhất 1 hành động';
    }

    // Validate condition values
    rule.conditions.forEach((condition, index) => {
      if (!condition.value && condition.value !== 0) {
        newErrors[`condition_${index}`] = 'Giá trị điều kiện không được trống';
      }
    });

    // Validate action params
    rule.actions.forEach((action, index) => {
      if (action.type === 'require_approval' && !action.workflow) {
        newErrors[`action_${index}`] = 'Phải chọn workflow cho hành động phê duyệt';
      }
      if (action.type === 'set_discount_limit' && !action.max_percent) {
        newErrors[`action_${index}`] = 'Phải nhập giới hạn chiết khấu';
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) {
      return;
    }

    setIsSaving(true);
    try {
      await onSave(rule);
    } catch (error) {
      console.error('Failed to save rule:', error);
      alert(`Lỗi khi lưu rule: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async () => {
    if (!validate()) {
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      // Mock test with sample data
      const sampleData = getSampleDataForEntity(rule.entityType);
      
      // Simulate rule evaluation
      await new Promise((resolve) => setTimeout(resolve, 1000));
      
      // Mock result
      const matched = rule.conditions.length > 0; // Simplified
      setTestResult({
        matched,
        conditions: rule.conditions.map((c) => ({
          field: c.field,
          operator: c.operator,
          value: c.value,
          result: true, // Mock
        })),
        actions: matched ? rule.actions : [],
        sampleData,
      });
    } catch (error) {
      console.error('Test failed:', error);
      alert(`Lỗi khi test rule: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsTesting(false);
    }
  };

  const getSampleDataForEntity = (entityType: string) => {
    const samples: Record<string, any> = {
      quotation: {
        total_price: 2500000000,
        discount: 50000000,
        brand: 'BMW',
        model: 'X5',
        customer_type: 'VIP',
      },
      booking: {
        total_price: 1800000000,
        deposit_amount: 200000000,
        financing_method: 'bank_loan',
      },
      trade_in: {
        appraisal_value: 400000000,
        old_vehicle_brand: 'Honda',
        old_vehicle_year: 2018,
        mileage: 50000,
      },
      loan: {
        loan_amount: 1400000000,
        loan_term: 60,
        interest_rate: 8.5,
        bank_name: 'VPBank',
      },
      service: {
        total_charge: 15000000,
        service_type: 'repair',
        mileage: 80000,
      },
    };
    return samples[entityType] || {};
  };

  return (
    <div className="max-w-5xl mx-auto bg-white rounded-lg shadow-lg">
      {/* Header */}
      <div className="border-b border-gray-200 px-6 py-4">
        <h2 className="text-2xl font-bold text-gray-900">
          {initialRule ? 'Chỉnh sửa Rule' : 'Tạo Rule mới'}
        </h2>
        <p className="text-sm text-gray-600 mt-1">
          Cấu hình rule tự động cho quy trình kinh doanh
        </p>
      </div>

      {/* Form Content */}
      <div className="px-6 py-6 space-y-6">
        {/* Basic Info */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Thông tin cơ bản</h3>
          
          <div className="grid grid-cols-2 gap-4">
            {/* Code */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Mã Rule <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={rule.code}
                onChange={(e) => updateRule({ code: e.target.value })}
                className={`w-full px-3 py-2 border rounded-md ${
                  errors.code ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="vd: high_value_approval"
                disabled={readonly || !!initialRule}
              />
              {errors.code && (
                <p className="text-sm text-red-600 mt-1">{errors.code}</p>
              )}
            </div>

            {/* Priority */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Độ ưu tiên <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={rule.priority}
                onChange={(e) => updateRule({ priority: parseInt(e.target.value) })}
                className={`w-full px-3 py-2 border rounded-md ${
                  errors.priority ? 'border-red-500' : 'border-gray-300'
                }`}
                min="1"
                max="1000"
                disabled={readonly}
              />
              <p className="text-xs text-gray-500 mt-1">
                Số nhỏ hơn = Ưu tiên cao hơn (1-1000)
              </p>
              {errors.priority && (
                <p className="text-sm text-red-600 mt-1">{errors.priority}</p>
              )}
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tên Rule <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={rule.name}
              onChange={(e) => updateRule({ name: e.target.value })}
              className={`w-full px-3 py-2 border rounded-md ${
                errors.name ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="vd: Phê duyệt giao dịch giá trị cao"
              disabled={readonly}
            />
            {errors.name && (
              <p className="text-sm text-red-600 mt-1">{errors.name}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mô tả
            </label>
            <textarea
              value={rule.description || ''}
              onChange={(e) => updateRule({ description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              rows={2}
              placeholder="Mô tả chi tiết về rule này..."
              disabled={readonly}
            />
          </div>

          {/* Entity Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Áp dụng cho <span className="text-red-500">*</span>
            </label>
            <select
              value={rule.entityType}
              onChange={(e) => updateRule({ entityType: e.target.value as any })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white"
              disabled={readonly}
            >
              {ENTITY_TYPES.map((type) => (
                <option key={type.key} value={type.key}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          {/* Effective Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Hiệu lực từ ngày
              </label>
              <input
                type="date"
                value={rule.effectiveFrom || ''}
                onChange={(e) => updateRule({ effectiveFrom: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                disabled={readonly}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Hiệu lực đến ngày
              </label>
              <input
                type="date"
                value={rule.effectiveUntil || ''}
                onChange={(e) => updateRule({ effectiveUntil: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                disabled={readonly}
              />
            </div>
          </div>

          {/* Active Toggle */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isActive"
              checked={rule.isActive}
              onChange={(e) => updateRule({ isActive: e.target.checked })}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded"
              disabled={readonly}
            />
            <label htmlFor="isActive" className="text-sm font-medium text-gray-700">
              Kích hoạt rule này
            </label>
          </div>
        </div>

        {/* Conditions */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">
              Điều kiện <span className="text-red-500">*</span>
            </h3>
            {errors.conditions && (
              <p className="text-sm text-red-600">{errors.conditions}</p>
            )}
          </div>
          <ConditionBuilder
            entityType={rule.entityType}
            conditions={rule.conditions}
            onChange={(conditions) => updateRule({ conditions })}
            readonly={readonly}
          />
        </div>

        {/* Actions */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">
              Hành động <span className="text-red-500">*</span>
            </h3>
            {errors.actions && (
              <p className="text-sm text-red-600">{errors.actions}</p>
            )}
          </div>
          <ActionConfigurator
            actions={rule.actions}
            onChange={(actions) => updateRule({ actions })}
            readonly={readonly}
          />
        </div>

        {/* Test Result */}
        {testResult && (
          <div className="bg-gray-50 border border-gray-300 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Kết quả test</h3>
            <div className="space-y-3">
              <div>
                <span className="font-medium">Dữ liệu mẫu:</span>
                <pre className="bg-white p-3 rounded border text-xs mt-1 overflow-auto">
                  {JSON.stringify(testResult.sampleData, null, 2)}
                </pre>
              </div>
              <div>
                <span className="font-medium">Kết quả khớp:</span>
                <span
                  className={`ml-2 px-3 py-1 rounded text-sm font-medium ${
                    testResult.matched
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                  }`}
                >
                  {testResult.matched ? '✓ Khớp' : '✗ Không khớp'}
                </span>
              </div>
              {testResult.matched && (
                <div>
                  <span className="font-medium">Hành động sẽ thực hiện:</span>
                  <ul className="list-disc list-inside mt-1">
                    {testResult.actions.map((action: any, index: number) => (
                      <li key={index}>{action.type}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="border-t border-gray-200 px-6 py-4 flex items-center justify-between bg-gray-50">
        <button
          onClick={onCancel}
          className="flex items-center gap-2 px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-100"
          disabled={isSaving || isTesting}
        >
          <X className="w-4 h-4" />
          Hủy
        </button>

        <div className="flex items-center gap-3">
          {!readonly && (
            <button
              onClick={handleTest}
              className="flex items-center gap-2 px-4 py-2 text-blue-600 border border-blue-300 rounded-md hover:bg-blue-50"
              disabled={isSaving || isTesting}
            >
              <TestTube className="w-4 h-4" />
              {isTesting ? 'Đang test...' : 'Test với dữ liệu mẫu'}
            </button>
          )}
          {!readonly && (
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              disabled={isSaving || isTesting}
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Đang lưu...' : 'Lưu Rule'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
