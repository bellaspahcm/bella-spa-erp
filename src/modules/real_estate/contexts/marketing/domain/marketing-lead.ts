export interface MarketingLeadProperties {
  id: string;
  tenantId: string;
  source: string; // 'facebook', 'tiktok', 'website'
  customerName: string;
  customerPhone: string;
  rawMessage: string;
  createdAt: string;
  processed: boolean;
}

export class MarketingLeadDomainModel {
  constructor(private props: MarketingLeadProperties) {}

  get properties(): MarketingLeadProperties {
    return { ...this.props };
  }

  process(): void {
    this.props.processed = true;
  }
}
