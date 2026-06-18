/**
 * Admin UI - Partner Management List Page
 * 
 * Displays list of API partners with:
 * - Search & filters (type, status, sandbox)
 * - Pagination
 * - Quick actions (view, edit, regenerate key)
 * - Create new partner button
 */

import { Suspense } from 'react';
import { Metadata } from 'next';
import { PartnersList } from '@/components/admin/partners/PartnersList';
import { PartnersListSkeleton } from '@/components/admin/partners/PartnersListSkeleton';

export const metadata: Metadata = {
  title: 'API Partners | Admin',
  description: 'Manage API partners, keys, and permissions',
};

export default function PartnersPage() {
  return (
    <div className="space-y-6">
      {/* Header - Bella ERP Style */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-rose-50 via-pink-50 to-purple-50 dark:from-rose-950/20 dark:via-pink-950/20 dark:to-purple-950/20 border border-rose-200 dark:border-rose-900 p-8 shadow-sm">
        {/* Decorative elements */}
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/10 dark:bg-rose-500/5 rounded-full blur-[100px]" />
        <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-purple-300/20 dark:bg-purple-500/5 rounded-full blur-[100px]" />
        
        <div className="relative flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-pink-600 dark:from-rose-600 dark:to-pink-600 flex items-center justify-center shadow-lg shadow-primary/20 dark:shadow-rose-500/20">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
                API Partners
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Quản lý đối tác API, authentication keys và phân quyền truy cập
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Partners List */}
      <Suspense fallback={<PartnersListSkeleton />}>
        <PartnersList />
      </Suspense>
    </div>
  );
}
