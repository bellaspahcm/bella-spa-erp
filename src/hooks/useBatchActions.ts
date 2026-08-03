import { useState } from 'react';

interface BatchActionOptions {
  action: 'approve' | 'reject';
  applicationIds: string[];
  reason?: string;
  notes?: string;
}

interface BatchResult {
  success: number;
  failed: number;
  errors: Array<{ id: string; error: string }>;
}

export function useBatchActions() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BatchResult | null>(null);

  const executeBatch = async (options: BatchActionOptions) => {
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/admin/partner-applications/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options),
      });

      const data = await response.json();

      if (data.success) {
        setResult(data.results);
        return { success: true, results: data.results };
      } else {
        return { success: false, error: data.error };
      }
    } catch (error) {
      return { success: false, error: 'Network error' };
    } finally {
      setLoading(false);
    }
  };

  return { executeBatch, loading, result };
}
