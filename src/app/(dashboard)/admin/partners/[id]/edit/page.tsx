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
import type { APIPartner } from '@/types/api-gateway';

export const metadata: Metadata = {
  title: 'Edit Partner | Admin',
  description: 'Edit API partner details',
};

interface EditPartnerPageProps {
  params: {
    id: string;
  };
}

export default async function EditPartnerPage({ params }: EditPartnerPageProps) {
  const { id } = params;

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

  // Fetch existing partner
  // Note: api_partners table exists in migration but not yet in generated types
  const { data: partner, error } = await (supabase as any)
    .from('api_partners')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', profile.tenant_id) // Security: ensure partner belongs to user's tenant
    .single();

  if (error || !partner) {
    notFound();
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={`/admin/partners/${id}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Edit Partner</h1>
          <p className="text-muted-foreground">
            Update details for <strong>{partner.partner_name}</strong>
          </p>
        </div>
      </div>

      {/* Form Wizard */}
      <PartnerFormWizard
        mode="edit"
        existingPartner={partner as APIPartner}
        tenantId={profile.tenant_id}
      />
    </div>
  );
}
