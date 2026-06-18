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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">API Partners</h1>
          <p className="text-muted-foreground">
            Manage API partners, authentication keys, and access permissions
          </p>
        </div>
      </div>

      {/* Partners List */}
      <Suspense fallback={<PartnersListSkeleton />}>
        <PartnersList />
      </Suspense>
    </div>
  );
}
