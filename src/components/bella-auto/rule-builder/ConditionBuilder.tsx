/**
 * Bella Auto - Visual Condition Builder
 * Phase 13 Week 2: No-code rule condition configuration
 */

'use client';

import { useState } from 'react';
import { Trash2, Plus } from 'lucide-react';

export interface RuleCondition {
  id: string;
  field: string;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'greater_or_equal' | 'less_or_equal' | 'contains' | 'not_contains' | 'in' | 'not_in' | 'between';
  value: any;
  logicOperator?: 'AND' | 'OR';
}

export interface ConditionBuilderProps {
  entityType: 'quotation' | 'booking' | 'trade_in' | 'loan' | 'service';
  conditions: RuleCondition[];
  onChange: (conditions: RuleCondition[]) => void;
  readonly?: boolean;
}

// Field definitions per entity type
const ENTITY_FIELDS: Record<string, Array<{ key: string; label: string; type: string }>> = {
  quotation: [
    { key: 'total_price', label: 'Tổng giá trị', type: 'number' },
    { key: 'discount', label: 'Chiết khấu', type: 'number' },
    { key: 'brand', label: 'Thương hiệu', type: 'text' },
    { key: 'model', label: 'Dòng xe', type: 'text' },
    { key: 'variant', label: 'Phiên bản', type: 'text' },
    { key: 'customer_type', label: 'Loại khách hàng', type: 'text' },
    { key: 'status', label: 'Trạng thái', type: 'text' },
    { key: 'created_at', label: 'Ngày tạo', type: 'date' },
  ],
  booking: [
    { key: 'total_price', label: 'Tổng giá trị', type: 'number' },
    { key: 'deposit_amount', label: 'Số tiền đặt cọc', type: 'number' },
    { key: 'brand', label: 'Thương hiệu', type: 'text' },
    { key: 'financing_method', label: 'Phương thức thanh toán', type: 'text' },
    { key: 'status', label: 'Trạng thái', type: 'text' },
  ],
  trade_in: [
    { key: 'appraisal_value', label: 'Giá thẩm định', type: 'number' },
    { key: 'old_vehicle_brand', label: 'Thương hiệu xe cũ', type: 'text' },
    { key: 'old_vehicle_year', label: 'Năm sản xuất', type: 'number' },
    { key: 'mileage', label: 'Số km đã đi', type: 'number' },
    { key: 'condition', label: 'Tình trạng', type: 'text' },
  ],
  loan: [
    { key: 'loan_amount', label: 'Số tiền vay', type: 'number' },
    { key: 'loan_term', label: 'Kỳ hạn (tháng)', type: 'number' },
    { key: 'interest_rate', label: 'Lãi suất (%)', type: 'number' },
    { key: 'bank_name', label: 'Ngân hàng', type: 'text' },
    { key: 'status', label: 'Trạng thái', type: 'text' },
  ],
  service: [
    { key: 'total_charge', label: 'Tổng chi phí', type: 'number' },
    { key: 'service_type', label: 'Loại dịch vụ', type: 'text' },
    { key: 'vehicle_brand', label: 'Thương hiệu xe', type: 'text' },
    { key: 'mileage', label: 'Số km', type: 'number' },
  ],
};

const OPERATORS: Record<string, Array<{ key: string; label: string }>> = {
  number: [
    { key: 'equals', label: 'Bằng (=)' },
    { key: 'not_equals', label: 'Khác (≠)' },
    { key: 'greater_than', label: 'Lớn hơn (>)' },
    { key: 'less_than', label: 'Nhỏ hơn (<)' },
    { key: 'greater_or_equal', label: 'Lớn hơn hoặc bằng (≥)' },
    { key: 'less_or_equal', label: 'Nhỏ hơn hoặc bằng (≤)' },
    { key: 'between', label: 'Trong khoảng' },
  ],
  text: [
    { key: 'equals', label: 'Bằng' },
    { key: 'not_equals', label: 'Khác' },
    { key: 'contains', label: 'Chứa' },
    { key: 'not_contains', label: 'Không chứa' },
    { key: 'in', label: 'Trong danh sách' },
    { key: 'not_in', label: 'Không trong danh sách' },
  ],
  date: [
    { key: 'equals', label: 'Bằng' },
    { key: 'greater_than', label: 'Sau ngày' },
    { key: 'less_than', label: 'Trước ngày' },
    { key: 'between', label: 'Trong khoảng' },
  ],
};

export function ConditionBuilder({
  entityType,
  conditions,
  onChange,
  readonly = false,
}: ConditionBuilderProps) {
  const fields = ENTITY_FIELDS[entityType] || [];

  const addCondition = () => {
    const newCondition: RuleCondition = {
      id: `cond-${Date.now()}`,
      field: fields[0]?.key || '',
      operator: 'equals',
      value: '',
      logicOperator: conditions.length > 0 ? 'AND' : undefined,
    };
    onChange([...conditions, newCondition]);
  };

  const removeCondition = (id: string) => {
    onChange(conditions.filter((c) => c.id !== id));
  };

  const updateCondition = (id: string, updates: Partial<RuleCondition>) => {
    onChange(
      conditions.map((c) => (c.id === id ? { ...c, ...updates } : c))
    );
  };

  const getFieldType = (fieldKey: string): string => {
    return fields.find((f) => f.key === fieldKey)?.type || 'text';
  };

  const getOperators = (fieldKey: string) => {
    const fieldType = getFieldType(fieldKey);
    return OPERATORS[fieldType] || OPERATORS.text;
  };

  const renderValueInput = (condition: RuleCondition) => {
    const fieldType = getFieldType(condition.field);

    if (condition.operator === 'between') {
      return (
        <div className="flex items-center gap-2">
          <input
            type={fieldType === 'date' ? 'date' : 'number'}
            value={condition.value?.from || ''}
            onChange={(e) =>
              updateCondition(condition.id, {
                value: { ...condition.value, from: e.target.value },
              })
            }
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
            placeholder="Từ"
            disabled={readonly}
          />
          <span className="text-gray-500">đến</span>
          <input
            type={fieldType === 'date' ? 'date' : 'number'}
            value={condition.value?.to || ''}
            onChange={(e) =>
              updateCondition(condition.id, {
                value: { ...condition.value, to: e.target.value },
              })
            }
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
            placeholder="Đến"
            disabled={readonly}
          />
        </div>
      );
    }

    if (condition.operator === 'in' || condition.operator === 'not_in') {
      return (
        <input
          type="text"
          value={condition.value || ''}
          onChange={(e) => updateCondition(condition.id, { value: e.target.value })}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
          placeholder="Nhập danh sách, phân cách bằng dấu phẩy"
          disabled={readonly}
        />
      );
    }

    return (
      <input
        type={fieldType === 'date' ? 'date' : fieldType === 'number' ? 'number' : 'text'}
        value={condition.value || ''}
        onChange={(e) => updateCondition(condition.id, { value: e.target.value })}
        className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
        placeholder="Nhập giá trị"
        disabled={readonly}
      />
    );
  };

  const renderNaturalLanguage = () => {
    if (conditions.length === 0) {
      return <p className="text-gray-400 italic">Chưa có điều kiện nào</p>;
    }

    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm font-medium text-blue-900 mb-2">Mô tả tự nhiên:</p>
        <p className="text-blue-800">
          {conditions.map((condition, index) => {
            const field = fields.find((f) => f.key === condition.field);
            const operator = getOperators(condition.field).find((op) => op.key === condition.operator);
            const prefix = index > 0 ? ` ${condition.logicOperator} ` : '';

            let valueText = condition.value;
            if (condition.operator === 'between') {
              valueText = `${condition.value?.from} đến ${condition.value?.to}`;
            }

            return `${prefix}${field?.label || condition.field} ${operator?.label || condition.operator} ${valueText}`;
          }).join('')}
        </p>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Condition List */}
      <div className="space-y-3">
        {conditions.map((condition, index) => (
          <div key={condition.id} className="flex items-start gap-2">
            {/* Logic Operator */}
            {index > 0 && (
              <select
                value={condition.logicOperator || 'AND'}
                onChange={(e) =>
                  updateCondition(condition.id, {
                    logicOperator: e.target.value as 'AND' | 'OR',
                  })
                }
                className="px-3 py-2 border border-gray-300 rounded-md bg-white"
                disabled={readonly}
              >
                <option value="AND">VÀ</option>
                <option value="OR">HOẶC</option>
              </select>
            )}

            {/* Field Selector */}
            <select
              value={condition.field}
              onChange={(e) => updateCondition(condition.id, { field: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-md bg-white min-w-[200px]"
              disabled={readonly}
            >
              {fields.map((field) => (
                <option key={field.key} value={field.key}>
                  {field.label}
                </option>
              ))}
            </select>

            {/* Operator Selector */}
            <select
              value={condition.operator}
              onChange={(e) => updateCondition(condition.id, { operator: e.target.value as any })}
              className="px-3 py-2 border border-gray-300 rounded-md bg-white min-w-[150px]"
              disabled={readonly}
            >
              {getOperators(condition.field).map((op) => (
                <option key={op.key} value={op.key}>
                  {op.label}
                </option>
              ))}
            </select>

            {/* Value Input */}
            {renderValueInput(condition)}

            {/* Delete Button */}
            {!readonly && (
              <button
                onClick={() => removeCondition(condition.id)}
                className="p-2 text-red-600 hover:bg-red-50 rounded-md"
                title="Xóa điều kiện"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Add Button */}
      {!readonly && (
        <button
          onClick={addCondition}
          className="flex items-center gap-2 px-4 py-2 text-blue-600 border border-blue-300 rounded-md hover:bg-blue-50"
        >
          <Plus className="w-4 h-4" />
          Thêm điều kiện
        </button>
      )}

      {/* Natural Language Preview */}
      {renderNaturalLanguage()}
    </div>
  );
}
