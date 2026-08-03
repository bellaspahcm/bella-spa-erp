'use client';

import React, { ReactNode } from 'react';
import { ErrorBoundary } from './ErrorBoundary';

interface Props {
  children: ReactNode;
  moduleName: string;
}

export function ModuleErrorBoundary({ children, moduleName }: Props) {
  return (
    <ErrorBoundary
      context={`module:${moduleName}`}
      fallback={
        <div className="p-6 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-yellow-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3 flex-1">
              <h4 className="text-sm font-medium text-yellow-800">
                Lỗi trong module {moduleName}
              </h4>
              <div className="mt-2 text-sm text-yellow-700">
                <p>
                  Module này đang gặp sự cố. Các phần khác của ứng dụng vẫn hoạt động bình thường.
                </p>
              </div>
              <div className="mt-4">
                <button
                  onClick={() => window.location.reload()}
                  className="text-sm font-medium text-yellow-800 hover:text-yellow-900 underline hover:no-underline"
                >
                  Tải lại trang →
                </button>
              </div>
            </div>
          </div>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  );
}
