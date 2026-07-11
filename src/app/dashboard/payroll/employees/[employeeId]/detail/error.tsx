'use client';

import { useEffect } from 'react';

export default function DetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[EmployeeDetailPage] Runtime error:', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 p-8">
      <h2 className="text-xl font-bold text-red-600">Lỗi tải trang chi tiết</h2>
      <p className="text-gray-600 text-sm font-mono bg-gray-100 p-4 rounded-lg max-w-lg text-wrap break-all">
        {error.message || 'Unknown error'}
        {error.digest && <span className="block mt-2 text-xs text-gray-400">Digest: {error.digest}</span>}
      </p>
      <button
        onClick={reset}
        className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
      >
        Thử lại
      </button>
    </div>
  );
}
