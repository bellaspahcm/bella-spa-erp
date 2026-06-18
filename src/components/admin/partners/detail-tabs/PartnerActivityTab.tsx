'use client';

import { PartnerActivityTimeline } from '@/components/admin/partners/PartnerActivityTimeline';
import type { APIPartner } from '@/types/api-gateway';

interface PartnerActivityTabProps {
  partner: APIPartner;
}

export function PartnerActivityTab({ partner }: PartnerActivityTabProps) {
  return (
    <div className="space-y-6">
      <PartnerActivityTimeline
        partnerId={partner.id}
        partnerName={partner.partner_name}
        maxHeight="700px"
      />
    </div>
  );
}
