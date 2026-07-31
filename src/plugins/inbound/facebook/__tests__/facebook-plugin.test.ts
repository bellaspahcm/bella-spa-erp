import { FacebookInboundAdapter, RawFacebookMessageWebhook } from '../adapter';
import { IInboxReceiver, InboundInboxItem } from '../../../platform/contracts/v1/InboxReceiver';

// Create a local mock implementation of the platform IInboxReceiver contract
// to avoid importing from src/modules/ (violating Principle 14).
class MockInboxReceiver implements IInboxReceiver {
  public receivedItems: InboundInboxItem[] = [];

  async receiveInboxItem(tenantId: string, item: InboundInboxItem): Promise<{ success: boolean; error?: string }> {
    this.receivedItems.push(item);
    return { success: true };
  }
}

describe('Facebook Inbound Plugin Adapter', () => {
  it('should translate raw FB Webhook payload to Platform InboundInboxItem', () => {
    const rawWebhook: RawFacebookMessageWebhook = {
      entry: [
        {
          id: 'entry-123',
          messaging: [
            {
              sender: { id: 'fb-user-789' },
              message: { text: 'Tôi muốn tư vấn căn hộ Gold 2 phòng ngủ' },
              timestamp: 1785483653851,
            },
          ],
        },
      ],
    };

    const item = FacebookInboundAdapter.translate(rawWebhook);

    expect(item.source).toBe('facebook');
    expect(item.senderName).toBe('FB-User-fb-user-789');
    expect(item.messageText).toBe('Tôi muốn tư vấn căn hộ Gold 2 phòng ngủ');
  });

  it('should successfully route translated message to Inbox Receiver via Contract', async () => {
    const rawWebhook: RawFacebookMessageWebhook = {
      entry: [
        {
          id: 'entry-123',
          messaging: [
            {
              sender: { id: 'fb-user-789' },
              message: { text: 'Giá bán căn hộ bao nhiêu?' },
              timestamp: 1785483653852,
            },
          ],
        },
      ],
    };

    const receiver = new MockInboxReceiver();
    const result = await FacebookInboundAdapter.routeToReceiver('tenant-123', rawWebhook, receiver);

    expect(result.success).toBe(true);
    expect(receiver.receivedItems.length).toBe(1);
    expect(receiver.receivedItems[0].messageText).toBe('Giá bán căn hộ bao nhiêu?');
  });
});
