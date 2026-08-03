'use client';

import { useState } from 'react';
import { useBatchActions } from '@/hooks/useBatchActions';

interface BatchActionsBarProps {
  selectedIds: string[];
  onSuccess: () => void;
  onClear: () => void;
}

export default function BatchActionsBar({
  selectedIds,
  onSuccess,
  onClear,
}: BatchActionsBarProps) {
  const { executeBatch, loading } = useBatchActions();
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  if (selectedIds.length === 0) return null;

  const handleApprove = async () => {
    if (!confirm(`Approve ${selectedIds.length} applications?`)) return;

    const result = await executeBatch({
      action: 'approve',
      applicationIds: selectedIds,
    });

    if (result.success) {
      alert(`Success: ${result.results?.success}, Failed: ${result.results?.failed}`);
      onSuccess();
      onClear();
    } else {
      alert(`Error: ${result.error}`);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      alert('Reason required');
      return;
    }

    const result = await executeBatch({
      action: 'reject',
      applicationIds: selectedIds,
      reason: rejectReason,
    });

    if (result.success) {
      alert(`Success: ${result.results?.success}, Failed: ${result.results?.failed}`);
      onSuccess();
      onClear();
      setShowRejectModal(false);
      setRejectReason('');
    } else {
      alert(`Error: ${result.error}`);
    }
  };

  return (
    <>
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white shadow-lg rounded-lg border border-gray-200 p-4 z-50">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-gray-700">
            {selectedIds.length} selected
          </span>

          <button
            onClick={handleApprove}
            disabled={loading}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 text-sm font-medium"
          >
            Approve All
          </button>

          <button
            onClick={() => setShowRejectModal(true)}
            disabled={loading}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 text-sm font-medium"
          >
            Reject All
          </button>

          <button
            onClick={onClear}
            disabled={loading}
            className="px-3 py-2 text-gray-600 hover:text-gray-900 text-sm"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Reject Applications</h3>

            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Reason for rejection..."
              className="w-full border rounded p-3 mb-4 min-h-[100px]"
              autoFocus
            />

            <div className="flex gap-3">
              <button
                onClick={handleReject}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
              >
                {loading ? 'Processing...' : 'Confirm Reject'}
              </button>
              <button
                onClick={() => setShowRejectModal(false)}
                disabled={loading}
                className="px-4 py-2 border rounded hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
