/**
 * Edit Partner Page
 * 
 * Page for editing an existing API partner
 */

import { Metadata } from 'next';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { PartnerFormWizard } from '@/components/admin/partners/PartnerFormWizard';
import { createClient } from '@/lib/supabase-server';
import { getPartnerById } from '@/services/api-gateway/partner.service';

export const metadata: Metadata = {
  title: 'Edit Partner | Admin',
  description: 'Edit API partner details',
};

interface EditPartnerPageProps {
  params: Promise<{
    id: string;
  }>;
  searchParams?: Promise<{
    embedded?: string;
  }>;
}

export default async function EditPartnerPage({ params, searchParams }: EditPartnerPageProps) {
  const { id } = await params;
  const sParams = await searchParams;
  const isEmbedded = sParams?.embedded === 'true';

  // Get current user and tenant
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

  const partner = await getPartnerById(id, profile.tenant_id);

  if (!partner) {
    notFound();
  }

  return (
    <div className={`space-y-6 bg-white min-h-screen ${isEmbedded ? 'px-4 md:px-6 py-2' : 'p-6 md:p-8 lg:p-10'}`}>
      {/* Header */}
      <div className="flex items-center gap-4 border-b border-slate-100 pb-4">
        {!isEmbedded && (
          <Link href={`/dashboard/admin/partners/${id}`}>
            <Button
              variant="ghost"
              size="icon"
              className="hover:bg-slate-100 active:scale-95 transition-all cursor-pointer"
              title="Quay lại chi tiết"
            >
              <ArrowLeft className="h-5 w-5 text-slate-700" />
            </Button>
          </Link>
        )}
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">Edit Partner</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Update details for <strong className="text-slate-800">{partner.partner_name}</strong>
          </p>
        </div>
      </div>

      {/* Form Wizard */}
      <PartnerFormWizard
        mode="edit"
        existingPartner={partner}
        tenantId={profile.tenant_id}
      />
    </div>
  );
}
