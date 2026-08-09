/**
 * Step-by-Step Rollback Preview
 * 
 * Visualizes the cascade rollback sequence with before/after comparisons.
 * Shows compensating actions that will be executed in reverse order.
 */

'use client';

import { ChevronDown } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface TransactionStep {
  id: string;
  sequence: number;
  action: string;
  compensatingAction: string;
  entityType: string;
  entityId: string;
  snapshotBefore?: Record<string, unknown>;
  snapshotAfter?: Record<string, unknown>;
}

interface StepByStepRollbackPreviewProps {
  steps: TransactionStep[];
}

export function StepByStepRollbackPreview({ steps }: StepByStepRollbackPreviewProps) {
  // Reverse order for rollback visualization
  const reversedSteps = [...steps].reverse();

  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    return String(value);
  };

  const getStepColor = (index: number) => {
    const colors = [
      'bg-red-50 border-red-200',
      'bg-orange-50 border-orange-200',
      'bg-yellow-50 border-yellow-200',
      'bg-blue-50 border-blue-200',
      'bg-purple-50 border-purple-200',
      'bg-pink-50 border-pink-200',
      'bg-gray-50 border-gray-200',
    ];
    return colors[index % colors.length];
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-lg">Rollback Execution Order</h3>
        <Badge variant="outline">{steps.length} steps (reverse order)</Badge>
      </div>

      {/* Timeline visualization */}
      <div className="relative">
        {reversedSteps.map((step, index) => (
          <div key={step.id} className="flex gap-4 mb-6 last:mb-0">
            {/* Step number & connector */}
            <div className="flex flex-col items-center flex-shrink-0">
              <div className="w-10 h-10 rounded-full bg-red-100 border-2 border-red-300 flex items-center justify-center text-red-700 font-bold text-sm">
                {index + 1}
              </div>
              {index < reversedSteps.length - 1 && (
                <div className="w-0.5 h-full bg-red-200 my-2 min-h-[60px]" />
              )}
            </div>

            {/* Step details */}
            <div className={`flex-1 border rounded-lg p-4 ${getStepColor(index)}`}>
              {/* Header */}
              <div className="mb-3">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-semibold text-gray-900">
                    {step.action}
                  </h4>
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                  <code className="text-sm font-mono text-red-600 bg-white px-2 py-0.5 rounded">
                    {step.compensatingAction}
                  </code>
                </div>
                <div className="text-xs text-gray-600">
                  Entity: <span className="font-mono">{step.entityType}</span>
                  {' · '}
                  ID: <span className="font-mono text-xs">{step.entityId.slice(0, 8)}...</span>
                </div>
              </div>

              {/* Before/After comparison */}
              {step.snapshotBefore && step.snapshotAfter && (
                <div className="grid grid-cols-2 gap-3">
                  {/* Current state (after) */}
                  <div className="bg-white rounded border border-gray-200 p-3">
                    <div className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-500" />
                      Current State
                    </div>
                    <pre className="text-xs font-mono text-gray-700 overflow-x-auto whitespace-pre-wrap">
                      {formatValue(step.snapshotAfter)}
                    </pre>
                  </div>

                  {/* After rollback (before) */}
                  <div className="bg-green-50 rounded border border-green-200 p-3">
                    <div className="text-xs font-semibold text-green-700 mb-2 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-green-500" />
                      After Rollback
                    </div>
                    <pre className="text-xs font-mono text-green-700 overflow-x-auto whitespace-pre-wrap">
                      {formatValue(step.snapshotBefore)}
                    </pre>
                  </div>
                </div>
              )}

              {/* No snapshot available */}
              {!step.snapshotBefore && !step.snapshotAfter && (
                <div className="text-sm text-gray-500 italic">
                  State snapshots not available for this step
                </div>
              )}

              {/* Compensating action explanation */}
              <div className="mt-3 text-xs text-gray-600 bg-white/50 rounded p-2">
                <strong>Will execute:</strong> {getCompensatingActionDescription(step.compensatingAction)}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Summary footer */}
      <Card className="bg-gray-50 p-4 border-gray-300">
        <div className="text-sm text-gray-700">
          <p className="font-semibold mb-2">📋 Rollback Summary:</p>
          <ul className="space-y-1 ml-4">
            <li>• All {steps.length} steps will be executed in <strong>reverse order</strong></li>
            <li>• Each compensating action will undo its corresponding operation</li>
            <li>• The entire process is <strong>atomic</strong> - if any step fails, remaining steps will still attempt to execute</li>
            <li>• Complete audit trail will be recorded for compliance</li>
          </ul>
        </div>
      </Card>
    </div>
  );
}

/**
 * Get human-readable description for compensating actions
 */
function getCompensatingActionDescription(action: string): string {
  const descriptions: Record<string, string> = {
    'revert_vehicle_status': 'Restore vehicle to previous status',
    'reverse_accounting_entry': 'Create reversal journal entry in accounting',
    'revert_journey_stage': 'Move customer journey back to previous stage',
    'cancel_notification': 'Mark notification as cancelled (cannot unsend)',
    'remove_ai_event': 'Remove event from AI insights and analytics',
    'revert_commission': 'Reverse commission calculation and remove earnings',
    'restore_inventory': 'Add quantity back to inventory',
    'revert_service_status': 'Restore service appointment to previous status',
    'restore_parts': 'Return deducted parts to inventory',
    'cancel_service_history': 'Mark service history record as cancelled',
    'revert_appraisal_status': 'Change trade-in appraisal back to pending',
    'remove_trade_in_credit': 'Remove trade-in credit from booking',
    'revert_loan_status': 'Change loan application status back',
    'reverse_disbursement': 'Create reversal transaction for disbursed amount',
    'revert_quotation_status': 'Change quotation back to pending approval',
    'release_reserved_vehicle': 'Make reserved vehicle available again',
  };

  return descriptions[action] || `Execute ${action.replace(/_/g, ' ')}`;
}
