import { IInboxReceiver, InboundInboxItem } from '../../../../../../platform/contracts/v1/InboxReceiver';
import { MarketingLeadDomainModel } from '../../domain/marketing-lead';

/**
 * Real Estate Bounded Context Inbound Message Receiver
 * Implements Platform IInboxReceiver contract.
 */
export class RealEstateInboxReceiver implements IInboxReceiver {
  private receivedLeads: Map<string, MarketingLeadDomainModel> = new Map();

  async receiveInboxItem(tenantId: string, item: InboundInboxItem): Promise<{ success: boolean; error?: string }> {
    try {
      // 1. Map platform InboxItem to industry-specific MarketingLead
      const lead = new MarketingLeadDomainModel({
        id: item.id,
        tenantId,
        source: item.source,
        customerName: item.senderName,
        customerPhone: item.senderPhone,
        rawMessage: item.messageText,
        createdAt: item.timestamp,
        processed: false,
      });

      // 2. Persist or register the lead inside Bounded Context
      this.receivedLeads.set(lead.properties.id, lead);

      console.log(`[RealEstateInboxReceiver] Successfully processed lead for client ${item.senderName}`);
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to receive inbox item',
      };
    }
  }

  getLeads(): MarketingLeadDomainModel[] {
    return Array.from(this.receivedLeads.values());
  }
}
