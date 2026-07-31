import { InboundInboxItem, IInboxReceiver } from '../../../platform/contracts/v1/InboxReceiver';

export interface RawFacebookMessageWebhook {
  entry: Array<{
    id: string;
    messaging: Array<{
      sender: { id: string };
      message: { text: string };
      timestamp: number;
    }>;
  }>;
}

export class FacebookInboundAdapter {
  static translate(webhookData: RawFacebookMessageWebhook): InboundInboxItem {
    const entry = webhookData.entry?.[0];
    const messaging = entry?.messaging?.[0];

    if (!messaging) {
      throw new Error('Invalid Facebook Webhook payload');
    }

    return {
      id: `fb-msg-${messaging.timestamp}-${Math.random().toString(36).substr(2, 5)}`,
      source: 'facebook',
      senderName: `FB-User-${messaging.sender.id}`,
      senderPhone: '', // Not provided by webhook directly
      messageText: messaging.message.text,
      timestamp: new Date(messaging.timestamp).toISOString(),
    };
  }

  static async routeToReceiver(
    tenantId: string,
    webhookData: RawFacebookMessageWebhook,
    receiver: IInboxReceiver
  ): Promise<{ success: boolean; error?: string }> {
    const item = this.translate(webhookData);
    return receiver.receiveInboxItem(tenantId, item);
  }
}
