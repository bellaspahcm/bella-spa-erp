/**
 * Rollback Confirmation Dialog
 * 
 * Shows impact preview and requires reason before executing rollback.
 * Includes step-by-step preview of compensating actions.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, RotateCcw, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { StepByStepRollbackPreview } from './StepByStepRollbackPreview';

interface TransactionStep {
  id: string;
  sequence: number;
  action: string;
  compensatingAction: string;
  entityType: string;
  entityId: string;
  snapshotBefore?: Record<string, any>;
  snapshotAfter?: Record<string, any>;
}

interface RollbackConfirmationDialogProps {
  open: boolean;
  transactionId: string | null;
  onConfirm: (transactionId: string, reason: string) => Promise<void>;
  onCancel: () => void;
}

export function RollbackConfirmationDialog({
  open,
  transactionId,
  onConfirm,
  onCancel,
}: RollbackConfirmationDialogProps) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [steps, setSteps] = useState<TransactionStep[]>([]);
  const [loadingSteps, setLoadingSteps] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const loadSteps = useCallback(async () => {
    if (!transactionId) return;

    setLoadingSteps(true);
    try {
      const response = await fetch(`/api/bella-auto/transactions/${transactionId}`);
      const data = await response.json();
      setSteps(data.steps || []);
    } catch (error) {
      console.error('Failed to load transaction steps:', error);
    } finally {
      setLoadingSteps(false);
    }
  }, [transactionId]); // ✅ Fixed: Wrapped with useCallback

  useEffect(() => {
    if (open && transactionId) {
      loadSteps();
      setReason('');
    }
  }, [open, transactionId, loadSteps]); // ✅ Fixed: Added loadSteps to dependencies

  const handleRollback = async () => {
    if (!transactionId || !reason.trim()) return;

    setLoading(true);
    try {
      await onConfirm(transactionId, reason.trim());
      setReason('');
    } catch (error) {
      console.error('Rollback failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const isValid = reason.trim().length >= 10; // Minimum 10 characters

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3 text-red-600">
            <AlertTriangle className="w-6 h-6" />
            <DialogTitle className="text-xl">Confirm Rollback Transaction</DialogTitle>
          </div>
          <DialogDescription>
            This will undo all operations in this transaction. This action cannot be reversed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Impact preview */}
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <RotateCcw className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h4 className="font-semibold text-red-800 mb-2">
                  Impact Summary
                </h4>
                {loadingSteps ? (
                  <div className="text-sm text-red-700">Loading steps...</div>
                ) : (
                  <>
                    <p className="text-sm text-red-700 mb-2">
                      This will rollback <span className="font-semibold">{steps.length}</span> operation{steps.length !== 1 ? 's' : ''}:
                    </p>
                    <ul className="space-y-1 text-sm text-red-700">
                      {steps.slice(0, 3).map((step) => (
                        <li key={step.id} className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-600" />
                          {step.action} → {step.compensatingAction}
                        </li>
                      ))}
                      {steps.length > 3 && (
                        <li className="text-red-600">
                          ... and {steps.length - 3} more operation{steps.length - 3 !== 1 ? 's' : ''}
                        </li>
                      )}
                    </ul>
                    
                    {steps.length > 0 && (
                      <Button
                        variant="link"
                        size="sm"
                        className="mt-2 p-0 h-auto text-red-700 hover:text-red-800"
                        onClick={() => setShowPreview(!showPreview)}
                      >
                        {showPreview ? 'Hide' : 'Show'} detailed preview
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Detailed preview */}
          {showPreview && steps.length > 0 && (
            <div className="border rounded-lg p-4">
              <StepByStepRollbackPreview steps={steps} />
            </div>
          )}

          {/* Reason input */}
          <div className="space-y-2">
            <Label htmlFor="reason" className="text-base font-semibold">
              Reason for Rollback <span className="text-red-600">*</span>
            </Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why this rollback is needed (minimum 10 characters)..."
              rows={4}
              className="resize-none"
            />
            <p className="text-xs text-gray-500">
              {reason.length}/10 characters minimum
            </p>
          </div>

          {/* Warning alert */}
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>⚠️ Cannot be undone</AlertTitle>
            <AlertDescription>
              This rollback operation cannot be reversed. All changes will be permanent
              and recorded in the audit trail.
            </AlertDescription>
          </Alert>

          {/* Audit trail notice */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
            <p className="text-blue-800">
              <strong>Audit Trail:</strong> This rollback will be logged with your user ID,
              timestamp, and reason. The complete history will be available for compliance review.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={loading}
          >
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={!isValid || loading || loadingSteps}
            onClick={handleRollback}
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                Rolling back...
              </>
            ) : (
              <>
                <RotateCcw className="w-4 h-4 mr-2" />
                Confirm Rollback
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
