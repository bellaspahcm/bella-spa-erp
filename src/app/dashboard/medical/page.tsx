'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Legacy /dashboard/medical route
 * Redirects to /dashboard/hospital for hospital_inpatient tenants
 * or /dashboard/healthcare for outpatient clinic tenants
 */
export default function MedicalDashboardRedirect() {
  const router = useRouter();

  useEffect(() => {
    // Check if this is a hospital inpatient tenant
    const path = window.location.pathname;
    
    // For now, redirect all /medical to /hospital
    // In the future, could check tenant capabilities to determine clinic vs hospital
    console.log('[Medical Redirect] Redirecting from /dashboard/medical to /dashboard/hospital');
    router.replace('/dashboard/hospital');
  }, [router]);

  // Show loading skeleton during redirect
  return (
    <div className="flex-1 p-8 space-y-6 animate-pulse bg-slate-50 dark:bg-slate-950 min-h-screen">
      <div className="h-20 bg-slate-200 dark:bg-slate-800 rounded-2xl w-full" />
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="h-32 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
        <div className="h-32 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
        <div className="h-32 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
        <div className="h-32 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
      </div>
      <div className="h-96 bg-slate-200 dark:bg-slate-800 rounded-3xl w-full" />
    </div>
  );
}
