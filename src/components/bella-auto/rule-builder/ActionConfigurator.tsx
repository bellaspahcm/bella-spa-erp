/**
 * Bella Auto - Action Configurator
 * Phase 13 Week 2: Configure rule actions when conditions match
 */

'use client';

import { useState } from 'react';
import { Trash2, Plus, Settings } from 'lucide-react';

export interface RuleAction {
  id: string;
  type: 'require_approval' | 'auto_approve' | 'auto_reject' | 'set_discount_limit' | 'allocate_vehicle' | 'assign_sales_person' | 'trigger_notification' | 'create_task';
  [key: string]: any;
}

export interface ActionConfiguratorProps {
  actions: RuleAction[];
  onChange: (actions: RuleAction[]) => void;
  readonly?: boolean;
}

const ACTION_TYPES = [
  {
    key: 'require_approval',
    label: 'Yêu cầu phê duyệt',
    icon: '✅',
    description: 'Khởi động quy trình phê duyệt đa cấp',
    params: [
      { key: 'workflow', label: 'Workflow', type: 'select', options: ['two_level_approval', 'director_approval', 'ceo_approval'] },
    ],
  },
  {
    key: 'auto_approve',
    label: 'Tự động phê duyệt',
    icon: '✓',
    description: 'Phê duyệt tự động không cần can thiệp',
    params: [],
  },
  {
    key: 'auto_reject',
    label: 'Tự động từ chối',
    icon: '✗',
    description: 'Từ chối tự động với lý do',
    params: [
      { key: 'reason', label: 'Lý do', type: 'text' },
    ],
  },
  {
    key: 'set_discount_limit',
    label: 'Đặt giới hạn chiết khấu',
    icon: '%',
    description: 'Thiết lập mức chiết khấu tối đa',
    params: [
      { key: 'max_percent', label: 'Tối đa (%)', type: 'number' },
    ],
  },
  {
    key: 'allocate_vehicle',
    label: 'Phân bổ xe tự động',
    icon: '🚗',
    description: 'Tự động phân bổ xe từ kho/showroom',
    params: [
      { key: 'source', label: 'Nguồn', type: 'select', options: ['warehouse', 'showroom', 'any'] },
    ],
  },
  {
    key: 'assign_sales_person',
    label: 'Phân công Sale',
    icon: '👤',
    description: 'Tự động phân công nhân viên bán hàng',
    params: [
      { key: 'strategy', label: 'Chiến lược', type: 'select', options: ['round_robin', 'best_performer', 'least_busy'] },
    ],
  },
  {
    key: 'trigger_notification',
    label: 'Gửi thông báo',
    icon: '🔔',
    description: 'Gửi thông báo đến người dùng/vai trò',
    params: [
      { key: 'recipients', label: 'Người nhận', type: 'text' },
      { key: 'message', label: 'Nội dung', type: 'textarea' },
    ],
  },
  {
    key: 'create_task',
    label: 'Tạo công việc',
    icon: '📋',
    description: 'Tạo task tự động cho người phụ trách',
    params: [
      { key: 'assignee_role', label: 'Vai trò', type: 'text' },
      { key: 'title', label: 'Tiêu đề', type: 'text' },
      { key: 'due_hours', label: 'Hạn (giờ)', type: 'number' },
    ],
  },
];

export function ActionConfigurator({
  actions,
  onChange,
  readonly = false,
}: ActionConfiguratorProps) {
  const [expandedActions, setExpandedActions] = useState<Set<string>>(new Set());

  const addAction = () => {
    const newAction: RuleAction = {
      id: `action-${Date.now()}`,
      type: 'require_approval',
    };
    onChange([...actions, newAction]);
    setExpandedActions(new Set([...expandedActions, newAction.id]));
  };

  const removeAction = (id: string) => {
    onChange(actions.filter((a) => a.id !== id));
    const newExpanded = new Set(expandedActions);
    newExpanded.delete(id);
    setExpandedActions(newExpanded);
  };

  const updateAction = (id: string, updates: Partial<RuleAction>) => {
    onChange(
      actions.map((a) => (a.id === id ? { ...a, ...updates } : a))
    );
  };

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedActions);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedActions(newExpanded);
  };

  const getActionTypeInfo = (type: string) => {
    return ACTION_TYPES.find((at) => at.key === type) || ACTION_TYPES[0];
  };

  const renderActionParams = (action: RuleAction) => {
    const actionType = getActionTypeInfo(action.type);
    if (!actionType.params || actionType.params.length === 0) {
      return (
        <p className="text-sm text-gray-500 italic">Không cần cấu hình thêm</p>
      );
    }

    return (
      <div className="space-y-3">
        {actionType.params.map((param) => (
          <div key={param.key}>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {param.label}
            </label>
            {param.type === 'select' ? (
              <select
                value={action[param.key] || ''}
                onChange={(e) => updateAction(action.id, { [param.key]: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white"
                disabled={readonly}
              >
                <option value="">-- Chọn --</option>
                {param.options?.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            ) : param.type === 'textarea' ? (
              <textarea
                value={action[param.key] || ''}
                onChange={(e) => updateAction(action.id, { [param.key]: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                rows={3}
                disabled={readonly}
              />
            ) : (
              <input
                type={param.type}
                value={action[param.key] || ''}
                onChange={(e) => updateAction(action.id, { [param.key]: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                disabled={readonly}
              />
            )}
          </div>
        ))}
      </div>
    );
  };

  const renderActionPreview = () => {
    if (actions.length === 0) {
      return <p className="text-gray-400 italic">Chưa có hành động nào</p>;
    }

    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <p className="text-sm font-medium text-green-900 mb-2">Hành động sẽ thực hiện:</p>
        <ul className="space-y-1 text-green-800">
          {actions.map((action, index) => {
            const actionType = getActionTypeInfo(action.type);
            let detail = '';
            
            if (action.type === 'require_approval' && action.workflow) {
              detail = ` (${action.workflow})`;
            } else if (action.type === 'set_discount_limit' && action.max_percent) {
              detail = ` (tối đa ${action.max_percent}%)`;
            } else if (action.type === 'allocate_vehicle' && action.source) {
              detail = ` (từ ${action.source})`;
            }

            return (
              <li key={action.id}>
                {index + 1}. {actionType.icon} {actionType.label}{detail}
              </li>
            );
          })}
        </ul>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Action List */}
      <div className="space-y-3">
        {actions.map((action) => {
          const actionType = getActionTypeInfo(action.type);
          const isExpanded = expandedActions.has(action.id);

          return (
            <div
              key={action.id}
              className="border border-gray-300 rounded-lg overflow-hidden"
            >
              {/* Action Header */}
              <div className="flex items-center justify-between bg-gray-50 px-4 py-3">
                <div className="flex items-center gap-3 flex-1">
                  <span className="text-2xl">{actionType.icon}</span>
                  <div className="flex-1">
                    <select
                      value={action.type}
                      onChange={(e) => updateAction(action.id, { type: e.target.value as any })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white font-medium"
                      disabled={readonly}
                    >
                      {ACTION_TYPES.map((at) => (
                        <option key={at.key} value={at.key}>
                          {at.label}
                        </option>
                      ))}
                    </select>
                    <p className="text-sm text-gray-600 mt-1">{actionType.description}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {actionType.params && actionType.params.length > 0 && (
                    <button
                      onClick={() => toggleExpand(action.id)}
                      className="p-2 text-gray-600 hover:bg-gray-200 rounded-md"
                      title="Cấu hình"
                    >
                      <Settings className="w-5 h-5" />
                    </button>
                  )}
                  {!readonly && (
                    <button
                      onClick={() => removeAction(action.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-md"
                      title="Xóa hành động"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Action Parameters (expandable) */}
              {isExpanded && (
                <div className="px-4 py-3 bg-white border-t border-gray-200">
                  {renderActionParams(action)}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add Button */}
      {!readonly && (
        <button
          onClick={addAction}
          className="flex items-center gap-2 px-4 py-2 text-green-600 border border-green-300 rounded-md hover:bg-green-50"
        >
          <Plus className="w-4 h-4" />
          Thêm hành động
        </button>
      )}

      {/* Action Preview */}
      {renderActionPreview()}
    </div>
  );
}
