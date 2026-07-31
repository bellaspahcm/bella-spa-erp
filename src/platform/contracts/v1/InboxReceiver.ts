export interface InboundInboxItem {
  id: string;
  source: 'facebook' | 'tiktok' | 'website' | 'call';
  senderName: string;
  senderPhone: string;
  messageText: string;
  timestamp: string;
}

/**
 * BELLA EIP Inbound Inbox Receiver Contract (v1)
 * Verticals implement this contract to process messages incoming from Platform Inbound Plugins.
 */
export interface IInboxReceiver {
  receiveInboxItem(tenantId: string, item: InboundInboxItem): Promise<{ success: boolean; error?: string }>;
}
