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
import Link from 'next/link';
import { ChevronRight, ArrowLeft } from 'lucide-react';
import { PartnersList } from '@/components/admin/partners/PartnersList';
import { PartnersListSkeleton } from '@/components/admin/partners/PartnersListSkeleton';

export const metadata: Metadata = {
  title: 'API Partners | Admin',
  description: 'Manage API partners, keys, and permissions',
};

interface PartnersPageProps {
  searchParams?: Promise<{
    embedded?: string;
  }>;
}

export default async function PartnersPage({ searchParams }: PartnersPageProps) {
  const sParams = await searchParams;
  const isEmbedded = sParams?.embedded === 'true';

  return (
    <div className={`space-y-8 ${isEmbedded ? 'px-4 md:px-6 py-2' : 'p-6 md:p-8 lg:p-10'}`}>
      {/* Breadcrumbs & Navigation */}
      {!isEmbedded && (
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-emerald-950/5 pb-4">
          <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-slate-500 uppercase">
            <Link href="/dashboard" className="hover:text-emerald-800 transition-colors">
              Tổng quan
            </Link>
            <ChevronRight size={12} className="opacity-40" />
            <span className="text-emerald-800 font-bold">API Partners</span>
          </div>
          
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-1.5 text-xs font-bold text-slate-600 shadow-sm transition-all duration-200 hover:bg-slate-50 hover:text-emerald-800 hover:border-emerald-800/30 group"
          >
            <ArrowLeft size={14} className="transition-transform group-hover:-translate-x-1" />
            <span>Trở về tổng quan</span>
          </Link>
        </div>
      )}

      {/* Header & Title */}
      <div className="space-y-1.5">
        <span className="text-xs font-bold text-emerald-800 uppercase tracking-widest block">
          Hệ thống quản trị
        </span>
        <h1 className="font-serif text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight">
          API Partners
        </h1>
        <p className="text-sm text-slate-600 font-medium max-w-xl">
          Quản lý đối tác API, authentication keys và phân quyền truy cập
        </p>
      </div>

      {/* Partners List */}
      <Suspense fallback={<PartnersListSkeleton />}>
        <PartnersList />
      </Suspense>
    </div>
  );
}
