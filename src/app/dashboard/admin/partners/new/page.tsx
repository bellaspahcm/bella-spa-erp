/**
 * New Partner Page
 * 
 * Page for creating a new API partner
 */

import { Metadata } from 'next';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { PartnerFormWizard } from '@/components/admin/partners/PartnerFormWizard';
import { createClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'New Partner | Admin',
  description: 'Create a new API partner',
};

export default async function NewPartnerPage() {
  // Get current tenant
  const supabase = await createClient();
  
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Get user's tenant
  const { data: profile } = await supabase
    .from('users')
    .select('tenant_id')
    .eq('id', user.id)
    .single();

  if (!profile?.tenant_id) {
    redirect('/dashboard');
  }

  return (
    <div className="min-h-screen bg-white p-6 md:p-8 lg:p-10 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 border-b border-slate-100 pb-4">
        <Link href="/dashboard/admin/partners">
          <Button
            variant="ghost"
            size="icon"
            className="hover:bg-slate-100 active:scale-95 transition-all cursor-pointer"
            title="Quay lại danh sách"
          >
            <ArrowLeft className="h-5 w-5 text-slate-700" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">
            Create New Partner
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Set up a new API partner with authentication and permissions
          </p>
        </div>
      </div>

      {/* Form Wizard */}
      <PartnerFormWizard mode="create" tenantId={profile.tenant_id} />
    </div>
  );
}
